// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AgentVault} from "./AgentVault.sol";

/// @title AgentVaultFactory
/// @notice Deploys one isolated vault (and therefore one Mezo trove) per user.
contract AgentVaultFactory {
    address public immutable musd;
    address public immutable borrowerOps;
    address public immutable troveManager;
    address public immutable priceFeed;

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
        address priceFeed_
    ) {
        require(musd_ != address(0), "Factory: musd zero");
        require(borrowerOps_ != address(0), "Factory: ops zero");
        require(troveManager_ != address(0), "Factory: trove zero");
        require(priceFeed_ != address(0), "Factory: feed zero");
        musd = musd_;
        borrowerOps = borrowerOps_;
        troveManager = troveManager_;
        priceFeed = priceFeed_;
    }

    function createVault(
        address agent,
        uint256 triggerICR,
        uint256 targetICR
    ) external returns (address vault) {
        vault = address(
            new AgentVault(
                msg.sender,
                agent,
                musd,
                borrowerOps,
                troveManager,
                priceFeed,
                triggerICR,
                targetICR,
                true
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
