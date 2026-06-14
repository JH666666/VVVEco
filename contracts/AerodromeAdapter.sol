// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ISwapRouter.sol";
import "./IAerodromeRouter.sol";

/**
 * @title AerodromeAdapter
 * @notice Implements the V2-style ISwapRouter interface (address[] path) and translates
 *         calls to Aerodrome Router's Route[] struct interface.
 *
 *  Treasury calls swapExactTokensForETH  (VVV → ETH)
 *  Payout   calls swapETHForExactTokens  (ETH → VVV)
 *  Both     call getAmountsOut / getAmountsIn for quotes
 *
 *  path[] parameters from callers are ignored; routes are built from immutable config.
 */
contract AerodromeAdapter is ISwapRouter, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IAerodromeRouter public aeroRouter;
    address public vvvToken;
    address public weth;
    address public factory;
    bool    public stable;

    constructor(
        address _aeroRouter,
        address _vvvToken,
        address _weth,
        address _factory,
        bool    _stable
    ) Ownable(msg.sender) {
        aeroRouter = IAerodromeRouter(_aeroRouter);
        vvvToken   = _vvvToken;
        weth       = _weth;
        factory    = _factory;
        stable     = _stable;
    }

    receive() external payable {}

    // ─── ISwapRouter: VVV → ETH (called by Treasury) ─────────────────────────

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata, // path ignored
        address to,
        uint256 deadline
    ) external override nonReentrant returns (uint256[] memory amounts) {
        IERC20(vvvToken).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(vvvToken).forceApprove(address(aeroRouter), amountIn);

        IAerodromeRouter.Route[] memory routes = _vvvToWethRoutes();
        amounts = aeroRouter.swapExactTokensForETH(amountIn, amountOutMin, routes, to, deadline);

        IERC20(vvvToken).forceApprove(address(aeroRouter), 0);
    }

    // ─── ISwapRouter: ETH → VVV (called by Payout) ───────────────────────────

    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata, // path ignored
        address to,
        uint256 deadline
    ) external payable override nonReentrant returns (uint256[] memory amounts) {
        IAerodromeRouter.Route[] memory routes = _wethToVvvRoutes();
        amounts = aeroRouter.swapETHForExactTokens{value: msg.value}(amountOut, routes, to, deadline);

        // Refund excess ETH to caller (Payout)
        uint256 ethUsed = amounts[0];
        if (msg.value > ethUsed) {
            (bool ok, ) = payable(msg.sender).call{value: msg.value - ethUsed}("");
            require(ok, "Adapter: ETH refund failed");
        }
    }

    // ─── ISwapRouter: quotes ──────────────────────────────────────────────────

    function getAmountsOut(uint256 amountIn, address[] calldata)
        external view override returns (uint256[] memory)
    {
        return aeroRouter.getAmountsOut(amountIn, _vvvToWethRoutes());
    }

    function getAmountsIn(uint256 amountOut, address[] calldata)
        external view override returns (uint256[] memory)
    {
        return aeroRouter.getAmountsIn(amountOut, _wethToVvvRoutes());
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _vvvToWethRoutes() internal view returns (IAerodromeRouter.Route[] memory routes) {
        routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({ from: vvvToken, to: weth, stable: stable, factory: factory });
    }

    function _wethToVvvRoutes() internal view returns (IAerodromeRouter.Route[] memory routes) {
        routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({ from: weth, to: vvvToken, stable: stable, factory: factory });
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setAeroRouter(address _router) external onlyOwner { aeroRouter = IAerodromeRouter(_router); }
    function setVvvToken(address _token)    external onlyOwner { vvvToken   = _token; }
    function setWeth(address _weth)         external onlyOwner { weth       = _weth; }
    function setFactory(address _factory)   external onlyOwner { factory    = _factory; }
    function setStable(bool _stable)        external onlyOwner { stable     = _stable; }

    function rescueETH(uint256 amount) external onlyOwner {
        (bool ok, ) = payable(owner()).call{value: amount}("");
        require(ok, "Adapter: ETH rescue failed");
    }

    function rescueToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
