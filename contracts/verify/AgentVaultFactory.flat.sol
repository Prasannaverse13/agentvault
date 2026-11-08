// Sources flattened with hardhat v2.29.1 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/introspection/IERC165.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/IERC165.sol)

pragma solidity >=0.4.16;

/**
 * @dev Interface of the ERC-165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[ERC].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}


// File @openzeppelin/contracts/interfaces/IERC165.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC165.sol)

pragma solidity >=0.4.16;


// File @openzeppelin/contracts/token/ERC20/IERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/IERC20.sol)

pragma solidity >=0.4.16;

/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}


// File @openzeppelin/contracts/interfaces/IERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC20.sol)

pragma solidity >=0.4.16;


// File @openzeppelin/contracts/interfaces/IERC1363.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC1363.sol)

pragma solidity >=0.6.2;


/**
 * @title IERC1363
 * @dev Interface of the ERC-1363 standard as defined in the https://eips.ethereum.org/EIPS/eip-1363[ERC-1363].
 *
 * Defines an extension interface for ERC-20 tokens that supports executing code on a recipient contract
 * after `transfer` or `transferFrom`, or code on a spender contract after `approve`, in a single transaction.
 */
interface IERC1363 is IERC20, IERC165 {
    /*
     * Note: the ERC-165 identifier for this interface is 0xb0202a11.
     * 0xb0202a11 ===
     *   bytes4(keccak256('transferAndCall(address,uint256)')) ^
     *   bytes4(keccak256('transferAndCall(address,uint256,bytes)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256,bytes)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256,bytes)'))
     */

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @param data Additional data with no specified format, sent in call to `spender`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value, bytes calldata data) external returns (bool);
}


// File @openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (token/ERC20/utils/SafeERC20.sol)

pragma solidity ^0.8.20;


/**
 * @title SafeERC20
 * @dev Wrappers around ERC-20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    /**
     * @dev An operation with an ERC-20 token failed.
     */
    error SafeERC20FailedOperation(address token);

    /**
     * @dev Indicates a failed `decreaseAllowance` request.
     */
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    /**
     * @dev Transfer `value` amount of `token` from the calling contract to `to`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        if (!_safeTransfer(token, to, value, true)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Transfer `value` amount of `token` from `from` to `to`, spending the approval given by `from` to the
     * calling contract. If `token` returns no value, non-reverting calls are assumed to be successful.
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        if (!_safeTransferFrom(token, from, to, value, true)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Variant of {safeTransfer} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransfer(IERC20 token, address to, uint256 value) internal returns (bool) {
        return _safeTransfer(token, to, value, false);
    }

    /**
     * @dev Variant of {safeTransferFrom} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransferFrom(IERC20 token, address from, address to, uint256 value) internal returns (bool) {
        return _safeTransferFrom(token, from, to, value, false);
    }

    /**
     * @dev Increase the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    /**
     * @dev Decrease the calling contract's allowance toward `spender` by `requestedDecrease`. If `token` returns no
     * value, non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    /**
     * @dev Set the calling contract's allowance toward `spender` to `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful. Meant to be used with tokens that require the approval
     * to be set to zero before setting it to a non-zero value, such as USDT.
     *
     * NOTE: If the token implements ERC-7674, this function will not modify any temporary allowance. This function
     * only sets the "standard" allowance. Any temporary allowance will remain active, in addition to the value being
     * set here.
     */
    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        if (!_safeApprove(token, spender, value, false)) {
            if (!_safeApprove(token, spender, 0, true)) revert SafeERC20FailedOperation(address(token));
            if (!_safeApprove(token, spender, value, true)) revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} transferAndCall, with a fallback to the simple {ERC20} transfer if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that relies on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            safeTransfer(token, to, value);
        } else if (!token.transferAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} transferFromAndCall, with a fallback to the simple {ERC20} transferFrom if the target
     * has no code. This can be used to implement an {ERC721}-like safe transfer that relies on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferFromAndCallRelaxed(
        IERC1363 token,
        address from,
        address to,
        uint256 value,
        bytes memory data
    ) internal {
        if (to.code.length == 0) {
            safeTransferFrom(token, from, to, value);
        } else if (!token.transferFromAndCall(from, to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} approveAndCall, with a fallback to the simple {ERC20} approve if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * NOTE: When the recipient address (`to`) has no code (i.e. is an EOA), this function behaves as {forceApprove}.
     * Oppositely, when the recipient address (`to`) has code, this function only attempts to call {ERC1363-approveAndCall}
     * once without retrying, and relies on the returned value to be true.
     *
     * Reverts if the returned value is other than `true`.
     */
    function approveAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            forceApprove(token, to, value);
        } else if (!token.approveAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Imitates a Solidity `token.transfer(to, value)` call, relaxing the requirement on the return value: the
     * return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param to The recipient of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeTransfer(IERC20 token, address to, uint256 value, bool bubble) private returns (bool success) {
        bytes4 selector = IERC20.transfer.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(to, shr(96, not(0))))
            mstore(0x24, value)
            success := call(gas(), token, 0, 0x00, 0x44, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
        }
    }

    /**
     * @dev Imitates a Solidity `token.transferFrom(from, to, value)` call, relaxing the requirement on the return
     * value: the return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param from The sender of the tokens
     * @param to The recipient of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 value,
        bool bubble
    ) private returns (bool success) {
        bytes4 selector = IERC20.transferFrom.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(from, shr(96, not(0))))
            mstore(0x24, and(to, shr(96, not(0))))
            mstore(0x44, value)
            success := call(gas(), token, 0, 0x00, 0x64, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
            mstore(0x60, 0)
        }
    }

    /**
     * @dev Imitates a Solidity `token.approve(spender, value)` call, relaxing the requirement on the return value:
     * the return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param spender The spender of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeApprove(IERC20 token, address spender, uint256 value, bool bubble) private returns (bool success) {
        bytes4 selector = IERC20.approve.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(spender, shr(96, not(0))))
            mstore(0x24, value)
            success := call(gas(), token, 0, 0x00, 0x44, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
        }
    }
}


// File @openzeppelin/contracts/utils/StorageSlot.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

pragma solidity ^0.8.20;

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC-1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     // Define the slot. Alternatively, use the SlotDerivation library to derive the slot.
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * TIP: Consider using this library along with {SlotDerivation}.
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns a `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}


// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 *
 * IMPORTANT: Deprecated. This storage-based reentrancy guard will be removed and replaced
 * by the {ReentrancyGuardTransient} variant in v6.0.
 *
 * @custom:stateless
 */
abstract contract ReentrancyGuard {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    /**
     * @dev A `view` only version of {nonReentrant}. Use to block view functions
     * from being called, preventing reading from inconsistent contract state.
     *
     * CAUTION: This is a "view" modifier and does not change the reentrancy
     * status. Use it only on view functions. For payable or non-payable functions,
     * use the standard {nonReentrant} modifier instead.
     */
    modifier nonReentrantView() {
        _nonReentrantBeforeView();
        _;
    }

    function _nonReentrantBeforeView() private view {
        if (_reentrancyGuardEntered()) {
            revert ReentrancyGuardReentrantCall();
        }
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        _nonReentrantBeforeView();

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuardStorageSlot().getUint256Slot().value = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _reentrancyGuardStorageSlot().getUint256Slot().value == ENTERED;
    }

    function _reentrancyGuardStorageSlot() internal pure virtual returns (bytes32) {
        return REENTRANCY_GUARD_STORAGE;
    }
}


// File contracts/interfaces/IMezo.sol

// Original license: SPDX_License_Identifier: MIT
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


// File contracts/AgentVault.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.24;




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
            try this.unwindForProtect(musdNeeded - liquid) {} catch {
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


// File contracts/AgentVaultFactory.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.24;

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
