// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IMezoBorrowerOperations, IMezoTroveManager, IMezoPriceFeed} from "./interfaces/IMezo.sol";

/// @title AgentVault
/// @notice A single BTC-backed MUSD loan that an authorised agent can defend.
///         The owner controls collateral and debt; the agent can only add
///         collateral or repay debt (never withdraw funds).
contract AgentVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MIN_SAFE_ICR = 1_100_000_000_000_000_000; // 110%
    uint256 public constant MAX_RULE_ICR = 10_000_000_000_000_000_000; // 1000%

    enum ActionKind {
        None,
        TopUp,
        Repay,
        Both
    }

    IERC20 public immutable musd;
    IMezoBorrowerOperations public immutable borrowerOps;
    IMezoTroveManager public immutable troveManager;
    IMezoPriceFeed public immutable priceFeed;

    address public owner;
    address public agent;

    /// @notice The agent acts when the position ICR falls below this value.
    uint256 public triggerICR;
    /// @notice The agent restores the position to this ICR when it acts.
    uint256 public targetICR;
    /// @notice Owner kill-switch for every agent action.
    bool public autoProtect;

    event LoanOpened(address indexed owner, uint256 coll, uint256 debt);
    event CollateralAdded(address indexed from, uint256 amount);
    event CollateralWithdrawn(address indexed to, uint256 amount);
    event DebtRepaid(address indexed from, uint256 amount);
    event Borrowed(address indexed to, uint256 amount);
    event BufferFunded(address indexed from, uint256 amount);
    event ReserveFunded(address indexed from, uint256 amount);
    event RulesUpdated(uint256 triggerICR, uint256 targetICR, bool autoProtect);
    event AgentChanged(address indexed agent);
    event AgentAction(
        uint8 indexed kind,
        uint256 repayAmount,
        uint256 topUpAmount,
        uint256 price,
        uint256 icrBefore,
        uint256 icrAfter
    );
    event LoanClosed(address indexed owner, uint256 collateralReturned);

    modifier onlyOwner() {
        require(msg.sender == owner, "AgentVault: not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "AgentVault: not agent");
        _;
    }

    constructor(
        address owner_,
        address agent_,
        address musd_,
        address borrowerOps_,
        address troveManager_,
        address priceFeed_,
        uint256 triggerICR_,
        uint256 targetICR_,
        bool autoProtect_
    ) {
        require(owner_ != address(0), "AgentVault: owner zero");
        require(agent_ != address(0), "AgentVault: agent zero");
        require(musd_ != address(0), "AgentVault: musd zero");
        require(borrowerOps_ != address(0), "AgentVault: ops zero");
        require(troveManager_ != address(0), "AgentVault: trove zero");
        require(priceFeed_ != address(0), "AgentVault: feed zero");
        _validateRules(triggerICR_, targetICR_);

        owner = owner_;
        agent = agent_;
        musd = IERC20(musd_);
        borrowerOps = IMezoBorrowerOperations(borrowerOps_);
        troveManager = IMezoTroveManager(troveManager_);
        priceFeed = IMezoPriceFeed(priceFeed_);
        triggerICR = triggerICR_;
        targetICR = targetICR_;
        autoProtect = autoProtect_;
    }

    receive() external payable {
        emit BufferFunded(msg.sender, msg.value);
    }

    // ---------------------------------------------------------------------
    // Owner actions
    // ---------------------------------------------------------------------

    /// @notice Open the Mezo trove and send the borrowed MUSD to the owner.
    function openLoan(uint256 debtAmount) external payable onlyOwner nonReentrant {
        require(msg.value > 0, "AgentVault: no collateral");
        require(
            troveManager.getTroveStatus(address(this)) != 1,
            "AgentVault: loan active"
        );
        require(
            debtAmount >= borrowerOps.minNetDebt(),
            "AgentVault: debt below minimum"
        );

        uint256 before = musd.balanceOf(address(this));
        borrowerOps.openTrove{value: msg.value}(
            debtAmount,
            address(0),
            address(0)
        );
        uint256 minted = musd.balanceOf(address(this)) - before;
        musd.safeTransfer(owner, minted);

        emit LoanOpened(owner, msg.value, debtAmount);
    }

    /// @notice Add BTC collateral to the existing trove.
    function addCollateral() external payable nonReentrant {
        require(msg.value > 0, "AgentVault: no collateral");
        borrowerOps.addColl{value: msg.value}(address(0), address(0));
        emit CollateralAdded(msg.sender, msg.value);
    }

    /// @notice Pull MUSD from the caller and repay the loan principal.
    function repay(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "AgentVault: amount zero");
        musd.safeTransferFrom(msg.sender, address(this), amount);
        borrowerOps.repayMUSD(amount, address(0), address(0));
        emit DebtRepaid(msg.sender, amount);
    }

    /// @notice Increase debt and send the new MUSD to the owner.
    function borrowMore(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "AgentVault: amount zero");
        uint256 before = musd.balanceOf(address(this));
        borrowerOps.withdrawMUSD(amount, address(0), address(0));
        uint256 minted = musd.balanceOf(address(this)) - before;
        musd.safeTransfer(owner, minted);
        emit Borrowed(owner, minted);
    }

    /// @notice Withdraw free collateral from the trove.
    function withdrawCollateral(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "AgentVault: amount zero");
        uint256 before = address(this).balance;
        borrowerOps.withdrawColl(amount, address(0), address(0));
        uint256 received = address(this).balance - before;
        _sendBTC(owner, received);
        emit CollateralWithdrawn(owner, received);
    }

    /// @notice Close the trove and return all collateral held by the vault.
    function closeLoan() external onlyOwner nonReentrant {
        borrowerOps.closeTrove();
        uint256 balance = address(this).balance;
        if (balance > 0) {
            _sendBTC(owner, balance);
        }
        emit LoanClosed(owner, balance);
    }

    /// @notice Move MUSD into the vault so the agent can repay without a wallet popup.
    function fundReserve(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "AgentVault: amount zero");
        musd.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveFunded(msg.sender, amount);
    }

    /// @notice Withdraw the MUSD safety reserve.
    function sweepMUSD(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "AgentVault: to zero");
        musd.safeTransfer(to, amount);
    }

    /// @notice Withdraw unused BTC buffer.
    function sweepBTC(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "AgentVault: to zero");
        _sendBTC(to, amount);
    }

    function setRules(
        uint256 triggerICR_,
        uint256 targetICR_,
        bool autoProtect_
    ) external onlyOwner {
        _validateRules(triggerICR_, targetICR_);
        triggerICR = triggerICR_;
        targetICR = targetICR_;
        autoProtect = autoProtect_;
        emit RulesUpdated(triggerICR_, targetICR_, autoProtect_);
    }

    function setAgent(address agent_) external onlyOwner {
        require(agent_ != address(0), "AgentVault: agent zero");
        agent = agent_;
        emit AgentChanged(agent_);
    }

    // ---------------------------------------------------------------------
    // Agent actions
    // ---------------------------------------------------------------------

    /// @notice Defend the loan. The agent may spend the vault's MUSD reserve
    ///         and/or its BTC buffer, but can never withdraw funds.
    function protect(
        uint256 repayAmount,
        uint256 topUpAmount
    ) external onlyAgent nonReentrant {
        require(autoProtect, "AgentVault: paused");
        require(
            troveManager.getTroveStatus(address(this)) == 1,
            "AgentVault: loan not active"
        );

        uint256 price = priceFeed.fetchPrice();
        uint256 icrBefore = troveManager.getCurrentICR(address(this), price);

        uint256 reserve = musd.balanceOf(address(this));
        if (repayAmount > reserve) repayAmount = reserve;
        if (repayAmount > 0) {
            borrowerOps.repayMUSD(repayAmount, address(0), address(0));
            emit DebtRepaid(address(this), repayAmount);
        }

        uint256 buffer = address(this).balance;
        if (topUpAmount > buffer) topUpAmount = buffer;
        if (topUpAmount > 0) {
            borrowerOps.addColl{value: topUpAmount}(address(0), address(0));
            emit CollateralAdded(address(this), topUpAmount);
        }

        if (repayAmount == 0 && topUpAmount == 0) return;

        uint256 icrAfter = troveManager.getCurrentICR(address(this), price);
        ActionKind kind = repayAmount > 0 && topUpAmount > 0
            ? ActionKind.Both
            : repayAmount > 0
                ? ActionKind.Repay
                : ActionKind.TopUp;

        emit AgentAction(
            uint8(kind),
            repayAmount,
            topUpAmount,
            price,
            icrBefore,
            icrAfter
        );
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function health()
        external
        view
        returns (
            uint256 coll,
            uint256 debt,
            uint256 price,
            uint256 icr,
            uint8 status,
            uint256 btcBuffer,
            uint256 musdReserve
        )
    {
        price = priceFeed.fetchPrice();
        coll = troveManager.getTroveColl(address(this));
        debt = troveManager.getTroveDebt(address(this));
        icr = debt == 0
            ? 0
            : troveManager.getCurrentICR(address(this), price);
        status = troveManager.getTroveStatus(address(this));
        btcBuffer = address(this).balance;
        musdReserve = musd.balanceOf(address(this));
    }

    /// @notice BTC price at which this vault would be liquidated (110% ICR).
    function liquidationPrice() external view returns (uint256) {
        uint256 debt = troveManager.getTroveDebt(address(this));
        uint256 coll = troveManager.getTroveColl(address(this));
        if (coll == 0 || debt == 0) return 0;
        return (debt * MIN_SAFE_ICR) / coll;
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _validateRules(uint256 triggerICR_, uint256 targetICR_) internal pure {
        require(triggerICR_ > MIN_SAFE_ICR, "AgentVault: trigger too low");
        require(targetICR_ >= triggerICR_, "AgentVault: target < trigger");
        require(targetICR_ <= MAX_RULE_ICR, "AgentVault: target too high");
    }

    function _sendBTC(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "AgentVault: btc transfer failed");
    }
}
