// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockPriceFeed} from "./MockPriceFeed.sol";

contract MockTroveManager {
    struct Trove {
        uint256 coll;
        uint256 debt;
        uint8 status;
    }

    MockPriceFeed public immutable feed;
    mapping(address => Trove) public troves;

    constructor(address feed_) {
        feed = MockPriceFeed(feed_);
    }

    function setTrove(
        address borrower,
        uint256 coll,
        uint256 debt,
        uint8 status
    ) external {
        troves[borrower] = Trove(coll, debt, status);
    }

    function addColl(address borrower, uint256 amount) external {
        troves[borrower].coll += amount;
    }

    function subColl(address borrower, uint256 amount) external {
        troves[borrower].coll -= amount;
    }

    function addDebt(address borrower, uint256 amount) external {
        troves[borrower].debt += amount;
    }

    function subDebt(address borrower, uint256 amount) external {
        troves[borrower].debt -= amount;
    }

    function getTroveColl(address borrower) external view returns (uint256) {
        return troves[borrower].coll;
    }

    function getTroveDebt(address borrower) external view returns (uint256) {
        return troves[borrower].debt;
    }

    function getTroveStatus(address borrower) external view returns (uint8) {
        return troves[borrower].status;
    }

    function getCurrentICR(
        address borrower,
        uint256 price
    ) external view returns (uint256) {
        Trove memory trove = troves[borrower];
        if (trove.debt == 0) return 0;
        return (trove.coll * price) / trove.debt;
    }
}
