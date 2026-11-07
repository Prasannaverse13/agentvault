// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockMUSD} from "./MockMUSD.sol";

/// @notice Minimal model of the Mezo Stability Pool for tests:
///         deposits, BTC gains from liquidations, and the rule that blocks
///         non-zero withdrawals while any trove sits below MCR.
contract MockStabilityPool {
    MockMUSD public immutable musd;
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public gains;
    bool public underCollateralizedTroves;

    constructor(address musd_) {
        musd = MockMUSD(musd_);
    }

    function setUnderCollateralizedTroves(bool v) external {
        underCollateralizedTroves = v;
    }

    /// @notice Simulate a liquidation offset: the depositor loses MUSD and
    ///         gains the liquidated BTC sent with this call.
    function simulateLiquidation(address depositor, uint256 musdLoss) external payable {
        deposits[depositor] -= musdLoss;
        musd.burn(address(this), musdLoss);
        gains[depositor] += msg.value;
    }

    function provideToSP(uint256 amount) external {
        require(amount > 0, "SP: amount zero");
        musd.transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        _payGain(msg.sender);
    }

    function withdrawFromSP(uint256 amount) external {
        if (amount != 0) {
            require(
                !underCollateralizedTroves,
                "StabilityPool: Cannot withdraw while there are troves with ICR < MCR"
            );
        }
        require(deposits[msg.sender] > 0, "SP: no deposit");
        uint256 out = amount > deposits[msg.sender] ? deposits[msg.sender] : amount;
        deposits[msg.sender] -= out;
        if (out > 0) musd.transfer(msg.sender, out);
        _payGain(msg.sender);
    }

    function getCompoundedMUSDDeposit(address d) external view returns (uint256) {
        return deposits[d];
    }

    function getDepositorCollateralGain(address d) external view returns (uint256) {
        return gains[d];
    }

    function _payGain(address to) internal {
        uint256 g = gains[to];
        if (g == 0) return;
        gains[to] = 0;
        (bool ok, ) = payable(to).call{value: g}("");
        require(ok, "SP: btc send failed");
    }
}
