// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ISwapRouter.sol";

/**
 * @title VVVPayout
 * @notice Holds ETH deposited by the project team.
 *         When users claim rewards, redeem principal, or receive team rewards,
 *         this contract swaps the required ETH → VVV via DEX and sends VVV to the user.
 *
 * ── Payment flow ──────────────────────────────────────────────────────────────
 *  VVVPayout holds ETH and ONLY sends ETH to the Router.
 *  The Router swaps ETH→VVV on the DEX and sends VVV DIRECTLY to the recipient.
 *  VVVPayout never holds or transfers VVV tokens.
 *
 *  1. Staking calls payReward(user, vvvGross)   — Router→user (net) + Router→feeWallet (fee)
 *  2. Staking calls payPrincipal(user, vvvNet)  — Router→user (no fee)
 *  3. Owner   calls adminPay(user, vvvNet)       — Router→user (no fee)
 *
 * ── Queue ─────────────────────────────────────────────────────────────────────
 *  If ETH is insufficient or the DEX swap fails, the payout is queued.
 *  Owner can call flushQueue(user) after depositing more ETH.
 *
 * ── Access ────────────────────────────────────────────────────────────────────
 *  Only `stakingContract` may call payReward / payPrincipal.
 *  Only `owner` may call adminPay / flushQueue / depositETH / config changes.
 */
contract VVVPayout is Ownable, Pausable, ReentrancyGuard {

    // ─── Config ───────────────────────────────────────────────────────────────

    IERC20      public vvvToken;
    ISwapRouter public router;
    address     public weth;            // WETH address for swap path
    address     public stakingContract;

    address     public feeWallet;
    uint256     public feePercent       = 10;    // % taken from rewards (not principal)
    uint256     public maxSlippageBps   = 300;   // 3 %
    uint256     public swapDeadlineOffset = 300; // seconds

    // ─── Queue ────────────────────────────────────────────────────────────────

    /// @notice Net VVV owed to user (after fee, already deducted from gross)
    mapping(address => uint256) public pendingNetForUser;
    /// @notice Fee VVV owed to feeWallet on behalf of user
    mapping(address => uint256) public pendingFeeForUser;

    // ─── Events ───────────────────────────────────────────────────────────────

    event ETHDeposited(address indexed from, uint256 amount);
    event RewardPaid(address indexed user, uint256 netVvv, uint256 feeVvv, uint256 ethSpent);
    event PrincipalPaid(address indexed user, uint256 vvvAmount, uint256 ethSpent);
    event AdminPaid(address indexed user, uint256 vvvAmount, uint256 ethSpent);
    event PayoutQueued(address indexed user, uint256 netVvv, uint256 feeVvv, string reason);
    event QueueFlushed(address indexed user, uint256 netVvv, uint256 feeVvv, uint256 ethSpent);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _vvvToken,
        address _router,
        address _weth,
        address _feeWallet,
        uint256 _feePercent
    ) Ownable(msg.sender) {
        vvvToken   = IERC20(_vvvToken);
        router     = ISwapRouter(_router);
        weth       = _weth;
        feeWallet  = _feeWallet;
        feePercent = _feePercent;
    }

    // ─── Receive ETH ──────────────────────────────────────────────────────────

    receive() external payable {
        emit ETHDeposited(msg.sender, msg.value);
    }

    function depositETH() external payable onlyOwner {
        emit ETHDeposited(msg.sender, msg.value);
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyStaking() {
        require(msg.sender == stakingContract, "Payout: caller is not Staking");
        _;
    }

    // ─── External entry points (called by Staking) ────────────────────────────

    /**
     * @notice Pay a staking reward to `user`.
     *         `vvvGross` is the total VVV earned; fee is taken internally.
     *         Never reverts: queues if ETH or swap unavailable.
     */
    function payReward(address user, uint256 vvvGross)
        external
        onlyStaking
        whenNotPaused
        nonReentrant
    {
        require(user != address(0), "Payout: zero user");
        require(vvvGross > 0, "Payout: zero amount");

        uint256 feeVvv = vvvGross * feePercent / 100;
        uint256 netVvv = vvvGross - feeVvv;

        _tryExecute(user, netVvv, feeVvv);
    }

    /**
     * @notice Return principal to `user` (no fee).
     *         Never reverts: queues if ETH or swap unavailable.
     */
    function payPrincipal(address user, uint256 vvvAmount)
        external
        onlyStaking
        whenNotPaused
        nonReentrant
    {
        require(user != address(0), "Payout: zero user");
        require(vvvAmount > 0, "Payout: zero amount");

        _tryExecute(user, vvvAmount, 0);
    }

    /**
     * @notice Pay team reward to `user` (no fee).
     *         Called by owner after off-chain reward calculation.
     *         Never reverts: queues if ETH or swap unavailable.
     */
    function adminPay(address user, uint256 vvvNet)
        external
        onlyOwner
        nonReentrant
    {
        require(user != address(0), "Payout: zero user");
        require(vvvNet > 0, "Payout: zero amount");

        _tryExecute(user, vvvNet, 0);
    }

    /**
     * @notice Retry a queued payout for `user`.
     *         Reverts if ETH is still insufficient (so admin can fix first).
     */
    function flushQueue(address user) external onlyOwner nonReentrant {
        uint256 netVvv = pendingNetForUser[user];
        uint256 feeVvv = pendingFeeForUser[user];
        require(netVvv + feeVvv > 0, "Payout: nothing queued");

        // Clear queue before executing to prevent re-entry
        pendingNetForUser[user] = 0;
        pendingFeeForUser[user] = 0;

        uint256 ethSpent = _execute(user, netVvv, feeVvv);
        emit QueueFlushed(user, netVvv, feeVvv, ethSpent);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────
    //
    // Design: VVVPayout never holds or transfers VVV.
    //   It only sends ETH to the Router; the Router swaps ETH→VVV and sends
    //   VVV directly to the recipient (user or feeWallet).
    //   Two separate swapETHForExactTokens calls handle net amount and fee.

    /** @dev Try to execute: queues (never reverts) on failure */
    function _tryExecute(address user, uint256 netVvv, uint256 feeVvv) internal {
        if (netVvv + feeVvv == 0) return;

        address[] memory path = _ethToVvvPath();
        uint256 deadline = block.timestamp + swapDeadlineOffset;

        // Quote ETH for user's net VVV
        uint256 ethForNet;
        try router.getAmountsIn(netVvv, path) returns (uint256[] memory amts) {
            ethForNet = amts[0];
        } catch {
            _queue(user, netVvv, feeVvv, "quote failed");
            return;
        }

        // Quote ETH for fee VVV (if applicable)
        uint256 ethForFee;
        if (feeVvv > 0) {
            try router.getAmountsIn(feeVvv, path) returns (uint256[] memory amts) {
                ethForFee = amts[0];
            } catch {
                _queue(user, netVvv, feeVvv, "fee quote failed");
                return;
            }
        }

        if (address(this).balance < ethForNet + ethForFee) {
            _queue(user, netVvv, feeVvv, "insufficient ETH");
            return;
        }

        // Swap ETH → netVvv, VVV delivered directly to user by Router
        try router.swapETHForExactTokens{value: ethForNet}(
            netVvv, path, user, deadline
        ) returns (uint256[] memory netAmts) {
            // Swap ETH → feeVvv, VVV delivered directly to feeWallet by Router
            if (feeVvv > 0 && feeWallet != address(0)) {
                try router.swapETHForExactTokens{value: ethForFee}(
                    feeVvv, path, feeWallet, deadline
                ) returns (uint256[] memory) {} catch {
                    pendingFeeForUser[user] += feeVvv;
                    emit PayoutQueued(user, 0, feeVvv, "fee swap failed");
                }
            }
            emit RewardPaid(user, netVvv, feeVvv, netAmts[0] + ethForFee);
        } catch Error(string memory reason) {
            _queue(user, netVvv, feeVvv, reason);
        } catch {
            _queue(user, netVvv, feeVvv, "swap failed");
        }
    }

    /** @dev Execute payment — reverts if anything fails (used by flushQueue) */
    function _execute(address user, uint256 netVvv, uint256 feeVvv)
        internal returns (uint256 ethSpent)
    {
        address[] memory path = _ethToVvvPath();
        uint256 deadline = block.timestamp + swapDeadlineOffset;

        if (netVvv > 0) {
            uint256 ethForNet = router.getAmountsIn(netVvv, path)[0];
            require(address(this).balance >= ethForNet, "Payout: insufficient ETH");
            uint256[] memory amts = router.swapETHForExactTokens{value: ethForNet}(
                netVvv, path, user, deadline
            );
            ethSpent += amts[0];
        }

        if (feeVvv > 0 && feeWallet != address(0)) {
            uint256 ethForFee = router.getAmountsIn(feeVvv, path)[0];
            require(address(this).balance >= ethForFee, "Payout: insufficient ETH for fee");
            uint256[] memory amts = router.swapETHForExactTokens{value: ethForFee}(
                feeVvv, path, feeWallet, deadline
            );
            ethSpent += amts[0];
        }
    }

    /** @dev Add to queue */
    function _queue(address user, uint256 netVvv, uint256 feeVvv, string memory reason) internal {
        pendingNetForUser[user] += netVvv;
        if (feeVvv > 0) pendingFeeForUser[user] += feeVvv;
        emit PayoutQueued(user, netVvv, feeVvv, reason);
    }

    function _ethToVvvPath() internal view returns (address[] memory path) {
        path = new address[](2);
        path[0] = weth;
        path[1] = address(vvvToken);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /** @notice Total VVV (net + fee) queued for a user */
    function queuedFor(address user) external view returns (uint256 net, uint256 fee) {
        net = pendingNetForUser[user];
        fee = pendingFeeForUser[user];
    }

    /** @notice ETH balance held by this contract */
    function ethBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setStakingContract(address _staking)    external onlyOwner { stakingContract = _staking; }
    function setRouter(address _router)              external onlyOwner { router = ISwapRouter(_router); }
    function setWeth(address _weth)                  external onlyOwner { weth = _weth; }
    function setFeeWallet(address _wallet)           external onlyOwner { require(_wallet != address(0)); feeWallet = _wallet; }
    function setFeePercent(uint256 _pct)             external onlyOwner { require(_pct <= 20, "max 20%"); feePercent = _pct; }
    function setMaxSlippageBps(uint256 _bps)         external onlyOwner { require(_bps <= 1000); maxSlippageBps = _bps; }
    function setSwapDeadlineOffset(uint256 _secs)    external onlyOwner { swapDeadlineOffset = _secs; }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Emergency ────────────────────────────────────────────────────────────

    function rescueETH(uint256 amount) external onlyOwner {
        (bool ok, ) = payable(owner()).call{value: amount}("");
        require(ok, "Payout: ETH rescue failed");
    }

    function rescueToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}
