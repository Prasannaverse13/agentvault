// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IMezoPriceFeed {
    function fetchPrice() external view returns (uint256);
}

interface IMezoBorrowerOperations {
    function openTrove(
        uint256 _debtAmount,
        address _upperHint,
        address _lowerHint
    ) external payable;

    function addColl(address _upperHint, address _lowerHint) external payable;

    function withdrawColl(
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external;

    function withdrawMUSD(
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external;

    function repayMUSD(
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external;

    function closeTrove() external;

    /// @notice Claim BTC left in the CollSurplusPool after a redemption, or after
    ///         a Recovery Mode liquidation of a trove with ICR above MCR.
    function claimCollateral() external;

    function minNetDebt() external view returns (uint256);
}

interface IMezoTroveManager {
    function getTroveColl(address _borrower) external view returns (uint256);

    function getTroveDebt(address _borrower) external view returns (uint256);

    function getCurrentICR(
        address _borrower,
        uint256 _price
    ) external view returns (uint256);

    function getTroveStatus(address _borrower) external view returns (uint8);
}

/// @notice Mezo MUSD Stability Pool (Liquity style). Depositors absorb liquidated
///         debt and receive the liquidated BTC collateral at a discount.
interface IMezoStabilityPool {
    function provideToSP(uint256 _amount) external;

    /// @dev Reverts with an amount above zero while any trove sits below MCR.
    ///      Withdrawing zero only collects the BTC gain and always works.
    function withdrawFromSP(uint256 _amount) external;

    function getCompoundedMUSDDeposit(
        address _depositor
    ) external view returns (uint256);

    function getDepositorCollateralGain(
        address _depositor
    ) external view returns (uint256);
}

interface IMezoMUSD {
    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}
