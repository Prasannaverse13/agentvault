// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IMezoBorrowerOperations, IMezoTroveManager, IMezoPriceFeed, IMezoStabilityPool} from "./interfaces/IMezo.sol";

/// @title AgentVault (v2)
/// @notice A single BTC-backed MUSD loan that an authorised agent can defend.
///
///         The owner controls collateral and debt. The agent can only move value
///         *towards* the loan: add collateral, repay debt, pull the vault's own
///         MUSD back out of the Stability Pool to repay, and harvest Stability
///         Pool BTC gains into the trove. It can never send funds anywhere except
///         the trove, the fee recipient (fixed at deploy, capped) and the owner.
///
///         v2 adds:
///           - Earn: the idle MUSD reserve sits in the Mezo Stability Pool, earns
///             liquidated BTC, and is unwound by the agent when the loan needs it.
///           - claimSurplus(): recovers BTC left in the CollSurplusPool after a
///             redemption (or a Recovery Mode liquidation) and sends it to the owner.
///           - Repay cap: protect() never repays below Mezo's minimum net debt, so it
///             cannot revert on BorrowerOperations' min-debt check.
///           - Fees: a small fee on each protect action and a performance fee on
///             Stability Pool BTC gains, both fixed at deploy with hard caps.
contract AgentVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public constant VERSION = "2.0.0";

    uint256 public constant MIN_SAFE_ICR = 1_100_000_000_000_000_000; // 110%
    uint256 public constant MAX_RULE_ICR = 10_000_000_000_000_000_000; // 1000%
    /// @notice Mezo MUSD gas compensation reserved inside every trove's debt.
    uint256 public constant MUSD_GAS_COMPENSATION = 200e18;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_PROTECT_FEE_BPS = 100; // 1%
    uint256 public constant MAX_PERFORMANCE_FEE_BPS = 2_000; // 20%
    /// @dev Gas given to a Stability Pool unwind inside protect(). A pool that
    ///      misbehaves or burns gas can never eat the rescue.
    uint256 public constant UNWIND_GAS = 1_500_000;

    uint8 internal constant STATUS_ACTIVE = 1;

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
    /// @notice Mezo Stability Pool. Zero disables the Earn features.
    IMezoStabilityPool public immutable stabilityPool;

    address public immutable feeRecipient;
    uint256 public immutable protectFeeBps;
    uint256 public immutable performanceFeeBps;

    address public owner;
    address public agent;

    /// @notice The agent acts when the position ICR falls below this value.
    uint256 public triggerICR;
    /// @notice The agent restores the position to this ICR when it acts.
    uint256 public targetICR;
    /// @notice Owner kill-switch for every agent action.
    bool public autoProtect;

    /// @notice Lifetime counters, for the dashboard and for transparency.
    uint256 public totalEarnedBtc;
    uint256 public totalFeesBtc;
    uint256 public totalFeesMusd;
    uint256 public totalSurplusClaimed;

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

    event EarnDeposited(address indexed by, uint256 amount);
    event EarnWithdrawn(address indexed by, uint256 musdOut, uint256 btcGain);
    event EarnUnwindFailed(uint256 requested);
    event Harvested(address indexed by, uint256 btcGain, uint256 toTrove, uint256 fee);
    event SurplusClaimed(address indexed by, address indexed to, uint256 amount);
    event FeePaid(address indexed to, uint256 btcAmount, uint256 musdAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "AgentVault: not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "AgentVault: not agent");
        _;
    }

    modifier onlyOwnerOrAgent() {
        require(
            msg.sender == owner || msg.sender == agent,
            "AgentVault: not owner or agent"
        );
        _;
    }

    modifier earnEnabled() {
        require(
            address(stabilityPool) != address(0),
            "AgentVault: earn disabled"
        );
        _;
    }

    struct Config {
        address owner;
        address agent;
        address musd;
        address borrowerOps;
        address troveManager;
        address priceFeed;
        address stabilityPool;
        address feeRecipient;
        uint256 protectFeeBps;
        uint256 performanceFeeBps;
        uint256 triggerICR;
        uint256 targetICR;
        bool autoProtect;
    }

    constructor(Config memory c) {
        require(c.owner != address(0), "AgentVault: owner zero");
        require(c.agent != address(0), "AgentVault: agent zero");
        require(c.musd != address(0), "AgentVault: musd zero");
        require(c.borrowerOps != address(0), "AgentVault: ops zero");
        require(c.troveManager != address(0), "AgentVault: trove zero");
        require(c.priceFeed != address(0), "AgentVault: feed zero");
        require(
            c.protectFeeBps <= MAX_PROTECT_FEE_BPS,
            "AgentVault: protect fee too high"
        );
        require(
            c.performanceFeeBps <= MAX_PERFORMANCE_FEE_BPS,
            "AgentVault: performance fee too high"
        );
        require(
            c.feeRecipient != address(0) ||
                (c.protectFeeBps == 0 && c.performanceFeeBps == 0),
            "AgentVault: fee recipient zero"
        );
        _validateRules(c.triggerICR, c.targetICR);

        owner = c.owner;
        agent = c.agent;
        musd = IERC20(c.musd);
        borrowerOps = IMezoBorrowerOperations(c.borrowerOps);
        troveManager = IMezoTroveManager(c.troveManager);
        priceFeed = IMezoPriceFeed(c.priceFeed);
        stabilityPool = IMezoStabilityPool(c.stabilityPool);
        feeRecipient = c.feeRecipient;
        protectFeeBps = c.protectFeeBps;
        performanceFeeBps = c.performanceFeeBps;
        triggerICR = c.triggerICR;
        targetICR = c.targetICR;
        autoProtect = c.autoProtect;
    }

    /// @dev Receives the owner's BTC buffer, trove refunds, Stability Pool gains
    ///      and CollSurplusPool claims. Only external senders count as funding.
    receive() external payable {
        if (
            msg.sender != address(borrowerOps) &&
            msg.sender != address(stabilityPool)
        ) {
            emit BufferFunded(msg.sender, msg.value);
        }
    }

    // ---------------------------------------------------------------------
    // Owner actions
    // ---------------------------------------------------------------------

    /// @notice Open the Mezo trove and send the borrowed MUSD to the owner.
    function openLoan(uint256 debtAmount) external payable onlyOwner nonReentrant {
        require(msg.value > 0, "AgentVault: no collateral");
        require(
            troveManager.getTroveStatus(address(this)) != STATUS_ACTIVE,
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

    /// @notice Close the trove and return everything the vault holds to the owner.
    ///         Pooled MUSD is pulled out of the Stability Pool first so it can pay
    ///         the debt; any MUSD left over after closing goes to the owner too.
    function closeLoan() external onlyOwner nonReentrant {
        if (
            address(stabilityPool) != address(0) &&
            stabilityPool.getCompoundedMUSDDeposit(address(this)) > 0
        ) {
            (uint256 musdOut, uint256 gain) = _withdrawEarn(type(uint256).max);
            emit EarnWithdrawn(msg.sender, musdOut, gain);
        }
        borrowerOps.closeTrove();
        uint256 balance = address(this).balance;
        if (balance > 0) {
            _sendBTC(owner, balance);
        }
        uint256 leftover = musd.balanceOf(address(this));
        if (leftover > 0) {
            musd.safeTransfer(owner, leftover);
        }
        emit LoanClosed(owner, balance);
    }

    /// @notice Move MUSD into the vault so the agent can repay without a wallet popup.
    function fundReserve(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "AgentVault: amount zero");
        musd.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveFunded(msg.sender, amount);
    }

    /// @notice Withdraw liquid MUSD from the vault (use earnWithdraw first for pooled MUSD).
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
    // Earn: the MUSD reserve works in the Mezo Stability Pool
    // ---------------------------------------------------------------------

    /// @notice Put liquid MUSD reserve to work in the Stability Pool.
    ///         Callable by the agent too: it only moves the vault's own MUSD
    ///         between the vault and the pool.
    function earnDeposit(
        uint256 amount
    ) external onlyOwnerOrAgent earnEnabled nonReentrant {
        uint256 liquid = musd.balanceOf(address(this));
        if (amount > liquid) amount = liquid;
        require(amount > 0, "AgentVault: amount zero");

        uint256 btcBefore = address(this).balance;
        musd.forceApprove(address(stabilityPool), amount);
        stabilityPool.provideToSP(amount);
        // provideToSP pays out any pending BTC gain to the vault.
        _bookGain(address(this).balance - btcBefore);

        emit EarnDeposited(msg.sender, amount);
    }

    /// @notice Bring pooled MUSD back into the vault as liquid reserve.
    function earnWithdraw(
        uint256 amount
    ) external onlyOwner earnEnabled nonReentrant {
        (uint256 musdOut, uint256 gain) = _withdrawEarn(amount);
        emit EarnWithdrawn(msg.sender, musdOut, gain);
    }

    /// @notice Collect Stability Pool BTC gains, take the performance fee and
    ///         add the rest to the trove as collateral (or keep it as buffer when
    ///         no loan is active). Works even while troves sit below MCR.
    function harvest() external onlyOwnerOrAgent earnEnabled nonReentrant {
        uint256 gain = stabilityPool.getDepositorCollateralGain(address(this));
        require(gain > 0, "AgentVault: nothing to harvest");

        uint256 before = address(this).balance;
        stabilityPool.withdrawFromSP(0);
        uint256 received = address(this).balance - before;

        uint256 feesBefore = totalFeesBtc;
        _bookGain(received);
        uint256 fee = totalFeesBtc - feesBefore;
        uint256 net = received - fee;
        uint256 toTrove;
        if (
            net > 0 &&
            troveManager.getTroveStatus(address(this)) == STATUS_ACTIVE
        ) {
            borrowerOps.addColl{value: net}(address(0), address(0));
            toTrove = net;
            emit CollateralAdded(address(this), net);
        }

        emit Harvested(msg.sender, received, toTrove, fee);
    }

    // ---------------------------------------------------------------------
    // Surplus recovery
    // ---------------------------------------------------------------------

    /// @notice After a redemption (or a Recovery Mode liquidation above MCR)
    ///         Mezo parks the leftover BTC in the CollSurplusPool under this
    ///         vault's address. Claim it and send it to the owner.
    function claimSurplus() external onlyOwnerOrAgent nonReentrant {
        require(
            troveManager.getTroveStatus(address(this)) != STATUS_ACTIVE,
            "AgentVault: loan active"
        );
        uint256 before = address(this).balance;
        borrowerOps.claimCollateral();
        uint256 received = address(this).balance - before;
        require(received > 0, "AgentVault: no surplus");

        totalSurplusClaimed += received;
        _sendBTC(owner, received);
        emit SurplusClaimed(msg.sender, owner, received);
    }

    // ---------------------------------------------------------------------
    // Agent actions
    // ---------------------------------------------------------------------

    /// @notice Defend the loan. The agent may spend the vault's MUSD reserve
    ///         (liquid first, then pooled), its BTC buffer and any Stability Pool
    ///         gains, but can never withdraw funds.
    function protect(
        uint256 repayAmount,
        uint256 topUpAmount
    ) external onlyAgent nonReentrant {
        require(autoProtect, "AgentVault: paused");
        require(
            troveManager.getTroveStatus(address(this)) == STATUS_ACTIVE,
            "AgentVault: loan not active"
        );

        uint256 price = priceFeed.fetchPrice();
        uint256 icrBefore = troveManager.getCurrentICR(address(this), price);

        // Never repay below Mezo's minimum net debt (BorrowerOps would revert).
        uint256 cap = maxRepay();
        if (repayAmount > cap) repayAmount = cap;

        // Repay needs plus the protect fee, all paid from the reserve.
        uint256 musdFee = (repayAmount * protectFeeBps) / BPS;
        uint256 liquid = musd.balanceOf(address(this));
        uint256 musdNeeded = repayAmount + musdFee;
        if (
            musdNeeded > liquid &&
            address(stabilityPool) != address(0) &&
            stabilityPool.getCompoundedMUSDDeposit(address(this)) > 0
        ) {
            // Unwind just what is missing. Mezo blocks pool withdrawals while
            // any trove is below MCR; then we fall back to buffer and liquid.
            try this.unwindForProtect{gas: UNWIND_GAS}(musdNeeded - liquid) {} catch {
                emit EarnUnwindFailed(musdNeeded - liquid);
            }
            liquid = musd.balanceOf(address(this));
        }
        if (musdNeeded > liquid) {
            // Scale repay down to what the reserve can cover including the fee.
            repayAmount = (liquid * BPS) / (BPS + protectFeeBps);
            musdFee = (repayAmount * protectFeeBps) / BPS;
        }
        if (repayAmount > 0) {
            borrowerOps.repayMUSD(repayAmount, address(0), address(0));
            emit DebtRepaid(address(this), repayAmount);
        }

        uint256 btcFee = (topUpAmount * protectFeeBps) / BPS;
        uint256 buffer = address(this).balance;
        if (topUpAmount + btcFee > buffer) {
            topUpAmount = (buffer * BPS) / (BPS + protectFeeBps);
            btcFee = (topUpAmount * protectFeeBps) / BPS;
        }
        if (topUpAmount > 0) {
            borrowerOps.addColl{value: topUpAmount}(address(0), address(0));
            emit CollateralAdded(address(this), topUpAmount);
        }

        if (repayAmount == 0 && topUpAmount == 0) return;

        _payFee(btcFee, musdFee);

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

    /// @notice Internal hop so protect() can try/catch a Stability Pool unwind.
    /// @dev Only callable by the vault itself.
    function unwindForProtect(uint256 amount) external {
        require(msg.sender == address(this), "AgentVault: internal");
        (uint256 musdOut, uint256 gain) = _withdrawEarn(amount);
        emit EarnWithdrawn(agent, musdOut, gain);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @dev Unchanged from v1 so older agents and dashboards keep working.
    ///      musdReserve is the liquid MUSD only; see earnInfo() for the pool.
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

    /// @notice Everything the dashboard needs about Earn, fees and limits.
    function earnInfo()
        external
        view
        returns (
            uint256 pooledMusd,
            uint256 pendingBtcGain,
            uint256 earnedBtc,
            uint256 feesBtc,
            uint256 feesMusd,
            uint256 surplusClaimed,
            uint256 repayCap,
            uint256 protectFee,
            uint256 performanceFee
        )
    {
        if (address(stabilityPool) != address(0)) {
            pooledMusd = stabilityPool.getCompoundedMUSDDeposit(address(this));
            pendingBtcGain = stabilityPool.getDepositorCollateralGain(
                address(this)
            );
        }
        earnedBtc = totalEarnedBtc;
        feesBtc = totalFeesBtc;
        feesMusd = totalFeesMusd;
        surplusClaimed = totalSurplusClaimed;
        repayCap = maxRepay();
        protectFee = protectFeeBps;
        performanceFee = performanceFeeBps;
    }

    /// @notice Largest repayment that keeps the trove at Mezo's minimum net debt.
    function maxRepay() public view returns (uint256) {
        uint256 debt = troveManager.getTroveDebt(address(this));
        uint256 floor = borrowerOps.minNetDebt() + MUSD_GAS_COMPENSATION;
        return debt > floor ? debt - floor : 0;
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

    function _withdrawEarn(
        uint256 amount
    ) internal returns (uint256 musdOut, uint256 gain) {
        uint256 musdBefore = musd.balanceOf(address(this));
        uint256 btcBefore = address(this).balance;
        stabilityPool.withdrawFromSP(amount);
        musdOut = musd.balanceOf(address(this)) - musdBefore;
        gain = address(this).balance - btcBefore;
        _bookGain(gain);
    }

    /// @dev Records a BTC gain that just landed in the vault and pays the
    ///      performance fee on it. The remainder stays as BTC buffer.
    function _bookGain(uint256 gain) internal {
        if (gain == 0) return;
        totalEarnedBtc += gain;
        uint256 fee = (gain * performanceFeeBps) / BPS;
        if (fee > 0) _payFee(fee, 0);
    }

    /// @dev Fees never block a rescue: a failed BTC send leaves the BTC in the
    ///      vault as buffer, and MUSD uses a plain transfer whose failure is ignored.
    function _payFee(uint256 btcAmount, uint256 musdAmount) internal {
        if (btcAmount == 0 && musdAmount == 0) return;
        uint256 paidBtc;
        uint256 paidMusd;
        if (btcAmount > 0) {
            (bool ok, ) = payable(feeRecipient).call{value: btcAmount, gas: 30_000}("");
            if (ok) paidBtc = btcAmount;
        }
        if (musdAmount > 0) {
            (bool ok, bytes memory data) = address(musd).call(
                abi.encodeCall(IERC20.transfer, (feeRecipient, musdAmount))
            );
            if (ok && (data.length == 0 || abi.decode(data, (bool)))) {
                paidMusd = musdAmount;
            }
        }
        if (paidBtc == 0 && paidMusd == 0) return;
        totalFeesBtc += paidBtc;
        totalFeesMusd += paidMusd;
        emit FeePaid(feeRecipient, paidBtc, paidMusd);
    }

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
