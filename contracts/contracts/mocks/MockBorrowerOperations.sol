// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockMUSD} from "./MockMUSD.sol";
import {MockTroveManager} from "./MockTroveManager.sol";

contract MockBorrowerOperations {
    MockMUSD public immutable musd;
    MockTroveManager public immutable troveManager;
    uint256 public minNetDebt = 50e18;
    uint256 public borrowingFeeBps;

    constructor(address musd_, address troveManager_) {
        musd = MockMUSD(musd_);
        troveManager = MockTroveManager(troveManager_);
    }

    function setBorrowingFeeBps(uint256 bps) external {
        borrowingFeeBps = bps;
    }

    function getBorrowingFee(uint256 debt) public view returns (uint256) {
        return (debt * borrowingFeeBps) / 10_000;
    }

    function openTrove(
        uint256 debt,
        address,
        address
    ) external payable {
        require(debt >= minNetDebt, "mock: debt too low");
        require(msg.value > 0, "mock: no coll");
        uint8 status = troveManager.getTroveStatus(msg.sender);
        require(status != 1, "mock: active");
        troveManager.setTrove(
            msg.sender,
            msg.value,
            debt + getBorrowingFee(debt),
            1
        );
        musd.mint(msg.sender, debt);
    }

    function addColl(address, address) external payable {
        troveManager.addColl(msg.sender, msg.value);
    }

    function withdrawColl(uint256 amount, address, address) external {
        troveManager.subColl(msg.sender, amount);
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "mock: btc send failed");
    }

    function withdrawMUSD(uint256 amount, address, address) external {
        troveManager.addDebt(msg.sender, amount);
        musd.mint(msg.sender, amount);
    }

    function repayMUSD(uint256 amount, address, address) external {
        musd.burn(msg.sender, amount);
        troveManager.subDebt(msg.sender, amount);
    }

    function closeTrove() external {
        uint256 coll = troveManager.getTroveColl(msg.sender);
        uint256 debt = troveManager.getTroveDebt(msg.sender);
        if (debt > 0) musd.burn(msg.sender, debt);
        troveManager.setTrove(msg.sender, 0, 0, 2);
        (bool ok, ) = payable(msg.sender).call{value: coll}("");
        require(ok, "mock: btc send failed");
    }

    receive() external payable {}
}
