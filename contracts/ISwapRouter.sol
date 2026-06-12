// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Minimal Uniswap V2 Router interface used by Treasury and Payout.
 *         MockRouter implements this for testnet; replace with real Uniswap V2 Router on mainnet.
 */
interface ISwapRouter {
    /**
     * @notice Sell exact `amountIn` tokens for as much ETH as possible.
     * @param amountIn      Token amount to sell
     * @param amountOutMin  Minimum ETH to receive (slippage guard)
     * @param path          [tokenIn, WETH]
     * @param to            ETH recipient
     * @param deadline      Unix timestamp deadline
     */
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    /**
     * @notice Buy exactly `amountOut` tokens by sending ETH.
     *         Caller sends msg.value; unused ETH is refunded.
     * @param amountOut  Exact token amount to receive
     * @param path       [WETH, tokenOut]
     * @param to         Token recipient
     * @param deadline   Unix timestamp deadline
     */
    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    /** @notice Quote: how much output you get for `amountIn` input */
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external view returns (uint256[] memory amounts);

    /** @notice Quote: how much input you need to get `amountOut` output */
    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external view returns (uint256[] memory amounts);
}
