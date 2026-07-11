// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface IUniswapV3SwapCallback {
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external;
}

/// @dev PancakeSwap V3 forked Uniswap V3 but renamed the callback, changing its selector.
interface IPancakeV3SwapCallback {
    function pancakeV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external;
}
