// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ISwapRouter.sol";

/**
 * @title VVVTreasury
 * @notice Receives VVV staked by users, immediately swaps to ETH via DEX, and forwards
 *         the ETH to the project wallet.  The Treasury never holds assets at rest —
 *         after each call to receiveAndConvert() its VVV and ETH balances should be 0.
 *
 * Only the authorized Staking contract may call receiveAndConvert().
 * When paused, receiveAndConvert() reverts, which causes the upstream stake() to revert.
 */
contract VVVTreasury is Ownable, Pausable, ReentrancyGuard {

    // ─── Config ───────────────────────────────────────────────────────────────

    IERC20      public vvvToken;
    ISwapRouter public router;
    address     public weth;            // WETH address for swap path (ignored by MockRouter)
    address     public projectWallet;   // ETH forwarded here after swap
    address     public stakingContract; // only address allowed to call receiveAndConvert()

    uint256 public maxSlippageBps    = 300;  // 3 %
    uint256 public swapDeadlineOffset = 300; // seconds added to block.timestamp for deadline

    // ─── Events ───────────────────────────────────────────────────────────────

    event Converted(address indexed staker, uint256 vvvIn, uint256 ethOut);
    event SwapFailed(address indexed staker, uint256 vvvAmount, string reason);
    event RouterUpdated(address newRouter);
    event ProjectWalletUpdated(address newWallet);
    event SlippageUpdated(uint256 newBps);
    event StakingContractUpdated(address newStaking);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _vvvToken,
        address _router,
        address _weth,
        address _projectWallet
    ) Ownable(msg.sender) {
        vvvToken      = IERC20(_vvvToken);
        router        = ISwapRouter(_router);
        weth          = _weth;
        projectWallet = _projectWallet;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyStaking() {
        require(msg.sender == stakingContract, "Treasury: caller is not Staking");
        _;
    }

    // ─── Core ─────────────────────────────────────────────────────────────────

    /**
     * @notice Called by Staking after transferring `vvvAmount` VVV to this contract.
     *         Swaps all VVV to ETH and sends ETH to projectWallet.
     *         Reverts on swap failure — which causes the upstream stake() to revert.
     *
     * @param staker     The original staker address (for events)
     * @param vvvAmount  Amount of VVV already transferred to this contract
     */
    function receiveAndConvert(address staker, uint256 vvvAmount)
        external
        onlyStaking
        whenNotPaused
        nonReentrant
    {
        require(vvvAmount > 0, "Treasury: zero amount");

        // Build path: [VVV → WETH]
        address[] memory path = new address[](2);
        path[0] = address(vvvToken);
        path[1] = weth;

        // Quote expected ETH
        uint256[] memory amountsOut = router.getAmountsOut(vvvAmount, path);
        uint256 expectedEth = amountsOut[1];
        uint256 minEth      = expectedEth * (10_000 - maxSlippageBps) / 10_000;

        // Approve router to spend VVV
        vvvToken.approve(address(router), vvvAmount);

        // Swap — ETH goes directly to projectWallet
        uint256[] memory amounts = router.swapExactTokensForETH(
            vvvAmount,
            minEth,
            path,
            projectWallet,
            block.timestamp + swapDeadlineOffset
        );

        // Clear approval (safety)
        vvvToken.approve(address(router), 0);

        emit Converted(staker, vvvAmount, amounts[1]);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setStakingContract(address _staking) external onlyOwner {
        stakingContract = _staking;
        emit StakingContractUpdated(_staking);
    }

    function setRouter(address _router) external onlyOwner {
        router = ISwapRouter(_router);
        emit RouterUpdated(_router);
    }

    function setWeth(address _weth) external onlyOwner {
        weth = _weth;
    }

    function setProjectWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "Treasury: zero address");
        projectWallet = _wallet;
        emit ProjectWalletUpdated(_wallet);
    }

    function setMaxSlippageBps(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Treasury: slippage > 10%");
        maxSlippageBps = _bps;
        emit SlippageUpdated(_bps);
    }

    function setSwapDeadlineOffset(uint256 _seconds) external onlyOwner {
        swapDeadlineOffset = _seconds;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Emergency ────────────────────────────────────────────────────────────

    /** @notice Rescue stuck tokens (should normally be zero) */
    function rescueToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    /** @notice Rescue stuck ETH (should normally be zero) */
    function rescueETH(uint256 amount) external onlyOwner {
        (bool ok, ) = payable(owner()).call{value: amount}("");
        require(ok, "Treasury: ETH rescue failed");
    }

    receive() external payable {}
}
