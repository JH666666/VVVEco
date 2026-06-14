// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAerodromeRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapETHForExactTokens(
        uint256 amountOut,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, Route[] calldata routes)
        external view returns (uint256[] memory amounts);

    function getAmountsIn(uint256 amountOut, Route[] calldata routes)
        external view returns (uint256[] memory amounts);

    function weth() external view returns (address);
}
