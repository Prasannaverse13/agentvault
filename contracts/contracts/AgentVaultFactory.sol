// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AgentVault} from "./AgentVault.sol";

/// @title AgentVaultFactory (v2)
/// @notice Deploys one isolated vault (and therefore one Mezo trove) per user.
///         Every vault from this factory shares the same Mezo core contracts,
///         Stability Pool and fee terms. Fees are fixed here, at deploy time,
///         and capped inside AgentVault, so nobody can raise them later.
contract AgentVaultFactory {
    string public constant VERSION = "2.0.0";

    address public immutable musd;
    address public immutable borrowerOps;
    address public immutable troveManager;
    address public immutable priceFeed;
    address public immutable stabilityPool;
    address public immutable feeRecipient;
    uint256 public immutable protectFeeBps;
    uint256 public immutable performanceFeeBps;

    mapping(address => address[]) public vaultsOf;
    address[] public allVaults;

    event VaultCreated(
        address indexed owner,
        address indexed vault,
        address indexed agent
    );

    constructor(
        address musd_,
        address borrowerOps_,
        address troveManager_,
        address priceFeed_,
        address stabilityPool_,
        address feeRecipient_,
        uint256 protectFeeBps_,
        uint256 performanceFeeBps_
    ) {
        require(musd_ != address(0), "Factory: musd zero");
        require(borrowerOps_ != address(0), "Factory: ops zero");
        require(troveManager_ != address(0), "Factory: trove zero");
        require(priceFeed_ != address(0), "Factory: feed zero");
        musd = musd_;
        borrowerOps = borrowerOps_;
        troveManager = troveManager_;
        priceFeed = priceFeed_;
        stabilityPool = stabilityPool_;
        feeRecipient = feeRecipient_;
        protectFeeBps = protectFeeBps_;
        performanceFeeBps = performanceFeeBps_;
    }

    /// @dev Signature unchanged from v1 so the dashboard and scripts keep working.
    function createVault(
        address agent,
        uint256 triggerICR,
        uint256 targetICR
    ) external returns (address vault) {
        vault = address(
            new AgentVault(
                AgentVault.Config({
                    owner: msg.sender,
                    agent: agent,
                    musd: musd,
                    borrowerOps: borrowerOps,
                    troveManager: troveManager,
                    priceFeed: priceFeed,
                    stabilityPool: stabilityPool,
                    feeRecipient: feeRecipient,
                    protectFeeBps: protectFeeBps,
                    performanceFeeBps: performanceFeeBps,
                    triggerICR: triggerICR,
                    targetICR: targetICR,
                    autoProtect: true
                })
            )
        );
        vaultsOf[msg.sender].push(vault);
        allVaults.push(vault);
        emit VaultCreated(msg.sender, vault, agent);
    }

    function getVaults(address owner) external view returns (address[] memory) {
        return vaultsOf[owner];
    }

    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }
}
