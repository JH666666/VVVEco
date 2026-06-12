// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockRouter
 * @notice Testnet-only fixed-rate VVV ↔ ETH swap simulator.
 *         Implements the ISwapRouter interface; swap semantics match Uniswap V2 Router.
 *
 * Rate:  ethPerVvv  — how many wei you get/pay per 1 VVV (18-decimal)
 *        default = 1e14  →  1 VVV = 0.0001 ETH  (assumes VVV=$0.15, ETH=$1500)
 *
 * Seeding: admin must deposit ETH and VVV so the router can fulfill both directions.
 *   • ETH:  call seedETH{ value: x }()
 *   • VVV:  transfer VVV to this address, then call seedVVV(amount)
 *           (or just transfer — router checks own balance on each swap)
 *
 * Failure injection: set injectFailure = true to simulate swap reverts in tests.
 */
contract MockRouter is Ownable, ReentrancyGuard {

    IERC20  public vvvToken;
    uint256 public ethPerVvv = 1e14;   // wei per VVV (18 dec)
    bool    public injectFailure;       // test: force revert on swaps

    event RateUpdated(uint256 newRate);
    event SeededETH(uint256 amount);
    event SeededVVV(uint256 amount);

    constructor(address _vvvToken) Ownable(msg.sender) {
        vvvToken = IERC20(_vvvToken);
    }

    receive() external payable {}

    // ─── Admin ────────────────────────────────────────────────────────────────

    /** @notice Set VVV/ETH rate. e.g. 1e14 = 0.0001 ETH per VVV */
    function setRate(uint256 _ethPerVvv) external onlyOwner {
        require(_ethPerVvv > 0, "Rate must be > 0");
        ethPerVvv = _ethPerVvv;
        emit RateUpdated(_ethPerVvv);
    }

    function setInjectFailure(bool _fail) external onlyOwner {
        injectFailure = _fail;
    }

    function seedETH() external payable onlyOwner {
        emit SeededETH(msg.value);
    }

    /** @notice Pull VVV from owner into router reserves */
    function seedVVV(uint256 amount) external onlyOwner {
        require(vvvToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit SeededVVV(amount);
    }

    // ─── Quote helpers ────────────────────────────────────────────────────────

    /** @notice ETH out for `vvvIn` VVV in */
    function _ethOut(uint256 vvvIn) internal view returns (uint256) {
        return vvvIn * ethPerVvv / 1e18;
    }

    /** @notice ETH in needed to receive `vvvOut` VVV */
    function _ethIn(uint256 vvvOut) internal view returns (uint256) {
        return vvvOut * ethPerVvv / 1e18;
    }

    // ─── ISwapRouter ─────────────────────────────────────────────────────────

    /**
     * @notice Sell exact VVV for ETH.
     *         Path: [VVV, WETH] — path content is ignored in mock.
     */
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata /*path*/,
        address to,
        uint256 /*deadline*/
    ) external nonReentrant returns (uint256[] memory amounts) {
        require(!injectFailure, "MockRouter: injected failure");
        require(amountIn > 0, "amountIn must be > 0");

        uint256 ethOut = _ethOut(amountIn);
        require(ethOut >= amountOutMin, "MockRouter: insufficient output amount");
        require(address(this).balance >= ethOut, "MockRouter: insufficient ETH reserve");

        // Pull VVV from caller
        require(vvvToken.transferFrom(msg.sender, address(this), amountIn), "VVV transfer failed");

        // Send ETH to recipient
        (bool ok, ) = payable(to).call{value: ethOut}("");
        require(ok, "MockRouter: ETH transfer failed");

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = ethOut;
    }

    /**
     * @notice Buy exact VVV with ETH.
     *         Caller sends ETH; exact ethNeeded is consumed, excess is refunded.
     *         Path: [WETH, VVV] — path content is ignored in mock.
     */
    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata /*path*/,
        address to,
        uint256 /*deadline*/
    ) external payable nonReentrant returns (uint256[] memory amounts) {
        require(!injectFailure, "MockRouter: injected failure");
        require(amountOut > 0, "amountOut must be > 0");

        uint256 ethNeeded = _ethIn(amountOut);
        require(msg.value >= ethNeeded, "MockRouter: insufficient ETH sent");
        require(vvvToken.balanceOf(address(this)) >= amountOut, "MockRouter: insufficient VVV reserve");

        // Transfer VVV to recipient
        require(vvvToken.transfer(to, amountOut), "MockRouter: VVV transfer failed");

        // Refund excess ETH to caller
        uint256 excess = msg.value - ethNeeded;
        if (excess > 0) {
            (bool ok, ) = payable(msg.sender).call{value: excess}("");
            require(ok, "MockRouter: ETH refund failed");
        }

        amounts = new uint256[](2);
        amounts[0] = ethNeeded;
        amounts[1] = amountOut;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata /*path*/)
        external view returns (uint256[] memory amounts)
    {
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = _ethOut(amountIn);
    }

    function getAmountsIn(uint256 amountOut, address[] calldata /*path*/)
        external view returns (uint256[] memory amounts)
    {
        amounts = new uint256[](2);
        amounts[0] = _ethIn(amountOut);
        amounts[1] = amountOut;
    }

    // ─── Emergency ────────────────────────────────────────────────────────────

    function rescueETH(uint256 amount) external onlyOwner {
        (bool ok, ) = payable(owner()).call{value: amount}("");
        require(ok, "ETH rescue failed");
    }

    function rescueToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}
