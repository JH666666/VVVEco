// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IPriceOracle.sol";

/**
 * @title VVVEcoStaking
 * @notice Core staking contract.  Manages orders, reward accrual, referral tree,
 *         team level system, and team / invite reward propagation.
 *         Does NOT hold user funds — all token movement is delegated to
 *         VVVTreasury (in) and VVVPayout (out).
 *
 * ── Capital flow ──────────────────────────────────────────────────────────────
 *  STAKE:   user VVV ──transferFrom──▶ Treasury ──swap──▶ ETH ──▶ projectWallet
 *  CLAIM:   Payout ETH ──swap──▶ VVV ──▶ feeWallet (10% fee) + user (net)
 *  WITHDRAW:Payout ETH ──swap──▶ VVV ──▶ user (full, no fee on principal)
 *
 * ── Coin-based vs Fiat-based ──────────────────────────────────────────────────
 *  Coin (VVV-based):
 *    - amount   = VVV staked (18 dec)
 *    - rewards  = amount × rate × elapsed / (1000 × 86400)  [VVV]
 *    - redeem   = original vvvAmountIn VVV
 *
 *  Fiat (USD-based):
 *    - amount   = USD value at stake time (18 dec)
 *    - rewards  = amount × rate × elapsed / (1000 × 86400)  [USD] → convert to VVV at current price
 *    - redeem   = usdValue × 1e18 / currentPrice  VVV  (same USD, current price)
 *
 * ── Team / Invite reward propagation ─────────────────────────────────────────
 *  Triggered on every successful personal reward claim (claimAllRewards or
 *  auto-settle on withdraw).  Principal redemption does NOT trigger propagation.
 *
 *  1. Invite rewards (3 generations, NO compression):
 *       gen1 → 10%,  gen2 → 5%,  gen3 → 3%  of claimer's VVV gross
 *
 *  2. Team rewards (up to 7 VALID generations, with tree compression):
 *       "valid" = upline has at least one active (not withdrawn, not expired) order
 *       Benchmark = claimer A's level:
 *       - B.level > A.level (any ancestor)          → differential only: (levelRates[B] − levelRates[A])% × gross
 *       - B is direct parent AND B.level ≤ A.level  → flat 10% same-level bonus
 *       - indirect ancestor AND B.level ≤ A.level   → 0
 *
 *  Both types are paid IMMEDIATELY via Payout.payPrincipal (NO fee deducted — upline receives full amount).
 *  TeamRewardAccrued event marks "reward computed and payment triggered".
 *  If Payout ETH is insufficient the reward enters the Payout queue (see
 *  VVVPayout.pendingNetForUser / flushQueue).
 *
 *  Legacy: pendingTeamReward mapping and claimTeamReward() are kept for ABI
 *  compatibility but are no longer written to by _propagateRewards.
 */

interface ITreasury {
    function receiveAndConvert(address staker, uint256 vvvAmount) external;
}

interface IPayout {
    function payReward(address user, uint256 vvvGross) external;
    function payPrincipal(address user, uint256 vvvAmount) external;
}

contract VVVEcoStaking is Ownable, Pausable, ReentrancyGuard {

    // ─────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────

    struct Order {
        uint256 vvvAmountIn;    // original VVV staked (for coin-based redemption)
        uint256 usdValue;       // USD value at stake time  (18 dec, for fiat-based)
        uint256 startTime;
        uint256 endTime;        // startTime + duration × 86400
        uint256 duration;       // days
        uint256 rate;           // per-mille: 7 → 0.7 %/day
        bool    isCoinBased;
        bool    isWithdrawn;    // principal returned
        uint256 claimedAmount;  // coin: VVV paid out; fiat: USD accounted (18 dec)
    }

    struct UserInfo {
        address referrer;
        uint256 teamVolume7;   // cumulative USD staked by 7-level downstream (18 dec)
        uint8   level;         // 1–8  (0 = not yet qualified)
        uint256 rewardClaimed; // lifetime VVV gross claimed (18 dec, informational)
    }

    // ─────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────

    IERC20    public vvvToken;
    ITreasury public treasury;
    IPayout   public payout;

    /// @notice Users without an invite code are auto-bound to this address.
    ///         The root itself has no parent (referrer = address(0)).
    address public rootReferrer;

    uint256 public minStakeUsd = 100 ether;    // $100 (18 dec)

    // ── Price oracle ──────────────────────────────────────────────────────────
    IAeroPool      public pricePool;    // Aerodrome vAMM VVV/WETH  (token0=WETH, token1=VVV)
    IChainlinkFeed public ethUsdFeed;   // Chainlink ETH/USD (8 dec)
    uint256        public maxPriceAge = 3600; // max Chainlink staleness in seconds

    mapping(address => UserInfo)  public users;
    mapping(address => Order[])   public userOrders;
    mapping(address => address[]) public directSubs;
    mapping(address => bool)      public accountFrozen;
    mapping(uint256 => uint256)   public durationRates; // days → per-mille rate

    /// @notice Accumulated invite + team differential rewards (VVV gross, before fee).
    ///         Claimed via claimTeamReward().
    mapping(address => uint256) public pendingTeamReward;

    // Level thresholds (USD, 18 dec).  Index = level (1–8).
    uint256[9] public levelThresholds = [
        0,
        0,               // V1 ≥ $0
        10_000  ether,   // V2 ≥ $10K
        20_000  ether,   // V3 ≥ $20K
        30_000  ether,   // V4 ≥ $30K
        50_000  ether,   // V5 ≥ $50K
        100_000 ether,   // V6 ≥ $100K
        150_000 ether,   // V7 ≥ $150K
        200_000 ether    // V8 ≥ $200K
    ];

    /// @notice Team reward rates per-cent (÷100).  Index = level (1–8).
    ///         V1=3%, V2=4%, V3=5%, V4=6%, V5=7%, V6=8%, V7=9%, V8=10%
    uint256[9] public levelRates = [0, 3, 4, 5, 6, 7, 8, 9, 10];

    /// @notice Invite reward rates per-cent (÷100) for generations 1-3.
    ///         inviteRates[1]=10%, [2]=5%, [3]=3%
    uint256[4] public inviteRates = [0, 10, 5, 3];

    // ─────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────

    event Staked(
        address indexed user,
        uint256 orderId,
        uint256 vvvAmountIn,
        uint256 usdValue,
        uint256 duration,
        bool    isCoinBased,
        address referrer
    );
    event RewardClaimed(address indexed user, uint256 vvvGross);
    event PrincipalWithdrawn(address indexed user, uint256 orderId, uint256 vvvAmount);
    event FrozenStatusChanged(address indexed target, bool frozen);
    event DurationRateUpdated(uint256 duration, uint256 rate);
    event LevelThresholdUpdated(uint8 level, uint256 threshold);
    event LevelRateUpdated(uint8 level, uint256 rate);

    /// @dev Emitted when an upline earns a team or invite reward.
    event TeamRewardAccrued(address indexed recipient, address indexed claimer, uint256 bonus);
    /// @dev Emitted when a user claims their accumulated team rewards.
    event TeamRewardClaimed(address indexed user, uint256 vvvGross);
    /// @dev Emitted when the root referrer address is updated.
    event RootReferrerSet(address indexed root);

    // ─────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────

    modifier whenAccountNotFrozen() {
        require(!accountFrozen[msg.sender], "Account frozen");
        _;
    }

    // ─────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────

    constructor(
        address _vvvToken,
        address _treasury,
        address _payout,
        address _pricePool,
        address _ethUsdFeed
    ) Ownable(msg.sender) {
        vvvToken     = IERC20(_vvvToken);
        treasury     = ITreasury(_treasury);
        payout       = IPayout(_payout);
        rootReferrer = msg.sender; // deployer is root by default
        pricePool    = IAeroPool(_pricePool);
        ethUsdFeed   = IChainlinkFeed(_ethUsdFeed);

        durationRates[1]  = 7;   // 0.7 %/day  (1-day period)
        durationRates[15] = 8;   // 0.8 %/day
        durationRates[30] = 9;   // 0.9 %/day
        durationRates[60] = 10;  // 1.0 %/day
    }

    // ─────────────────────────────────────────
    //  CORE: Stake
    // ─────────────────────────────────────────

    /**
     * @notice Stake VVV tokens.
     *         1. Validates amount and duration.
     *         2. Binds referrer (first stake only); users without a valid referrer
     *            are auto-bound to rootReferrer.
     *         3. Transfers VVV directly to Treasury, then calls Treasury.receiveAndConvert.
     *         4. Records on-chain Order.
     *         5. Updates 7-level upstream team volume and levels.
     *
     * @param vvvAmount    VVV amount (18 dec)
     * @param duration     Staking period in days (must have a configured rate)
     * @param isCoinBased  true = VVV-based rewards; false = USD-based rewards
     * @param referrer     Referral address (address(0) → auto-bind to rootReferrer)
     */
    function stake(
        uint256 vvvAmount,
        uint256 duration,
        bool    isCoinBased,
        address referrer
    ) external whenNotPaused whenAccountNotFrozen nonReentrant {
        require(vvvAmount > 0, "Staking: zero amount");

        uint256 price    = getLatestPrice();
        uint256 usdValue = vvvAmount * price / 1 ether;
        require(usdValue >= minStakeUsd, "Staking: below minimum stake");

        uint256 rate = durationRates[duration];
        require(rate > 0, "Staking: unsupported duration");

        // ── Bind referrer (once per user) ────────────────────────────────────
        address _root = rootReferrer != address(0) ? rootReferrer : owner();
        UserInfo storage u = users[msg.sender];
        if (u.referrer == address(0) && msg.sender != _root) {
            address ref = (referrer != address(0) && referrer != msg.sender)
                ? referrer
                : _root;
            u.referrer = ref;
            directSubs[ref].push(msg.sender);
        }

        // ── Transfer VVV from user → Treasury, then swap ──────────────────────
        require(
            vvvToken.transferFrom(msg.sender, address(treasury), vvvAmount),
            "Staking: VVV transfer failed"
        );
        treasury.receiveAndConvert(msg.sender, vvvAmount);

        // ── Record on-chain order ─────────────────────────────────────────────
        uint256 orderId = userOrders[msg.sender].length;

        userOrders[msg.sender].push(Order({
            vvvAmountIn:   vvvAmount,
            usdValue:      usdValue,
            startTime:     block.timestamp,
            endTime:       block.timestamp + duration * 86400,
            duration:      duration,
            rate:          rate,
            isCoinBased:   isCoinBased,
            isWithdrawn:   false,
            claimedAmount: 0
        }));

        // ── Update 7-level upstream team volume ───────────────────────────────
        address up = u.referrer;
        for (uint256 i = 0; i < 7; i++) {
            if (up == address(0)) break;
            users[up].teamVolume7 += usdValue;
            _updateLevel(up);
            up = users[up].referrer;
        }

        emit Staked(msg.sender, orderId, vvvAmount, usdValue, duration, isCoinBased, u.referrer);
    }

    // ─────────────────────────────────────────
    //  CORE: Claim All Personal Rewards
    // ─────────────────────────────────────────

    /**
     * @notice Claim all accrued personal staking rewards.
     *         After paying the user, propagates invite + team differential rewards
     *         to upstream referrers (accumulated in pendingTeamReward).
     */
    function claimAllRewards() external whenNotPaused whenAccountNotFrozen nonReentrant {
        uint256 price    = getLatestPrice();
        uint256 totalVvv = 0;

        Order[] storage orders = userOrders[msg.sender];
        for (uint256 i = 0; i < orders.length; i++) {
            Order storage order = orders[i];
            if (order.isWithdrawn) continue;

            uint256 elapsed = block.timestamp - order.startTime;
            uint256 fullDur = order.endTime - order.startTime;
            if (elapsed > fullDur) elapsed = fullDur;

            if (order.isCoinBased) {
                uint256 accruedVvv = order.vvvAmountIn * order.rate * elapsed / (1000 * 86400);
                if (accruedVvv > order.claimedAmount) {
                    uint256 pending     = accruedVvv - order.claimedAmount;
                    order.claimedAmount = accruedVvv;
                    totalVvv           += pending;
                }
            } else {
                uint256 accruedUsd = order.usdValue * order.rate * elapsed / (1000 * 86400);
                if (accruedUsd > order.claimedAmount) {
                    uint256 pendingUsd  = accruedUsd - order.claimedAmount;
                    order.claimedAmount = accruedUsd;
                    if (price > 0) totalVvv += pendingUsd * 1 ether / price;
                }
            }
        }

        require(totalVvv > 0, "Staking: no rewards to claim");

        users[msg.sender].rewardClaimed += totalVvv;
        payout.payReward(msg.sender, totalVvv);

        // ── Propagate invite + team rewards to uplines ────────────────────────
        _propagateRewards(msg.sender, totalVvv);

        emit RewardClaimed(msg.sender, totalVvv);
    }

    // ─────────────────────────────────────────
    //  CORE: Claim Single Order Reward
    // ─────────────────────────────────────────

    /**
     * @notice Claim accrued rewards for a single order only.
     *         Other orders are not affected.
     *         Propagates invite + team differential rewards based on this order's payout.
     */
    function claimOrderReward(uint256 orderId)
        external
        whenNotPaused
        whenAccountNotFrozen
        nonReentrant
    {
        require(orderId < userOrders[msg.sender].length, "Staking: order not found");
        Order storage order = userOrders[msg.sender][orderId];
        require(!order.isWithdrawn, "Staking: order withdrawn");

        uint256 price    = getLatestPrice();
        uint256 pendingVvv = 0;

        uint256 elapsed = block.timestamp - order.startTime;
        uint256 fullDur = order.endTime - order.startTime;
        if (elapsed > fullDur) elapsed = fullDur;

        if (order.isCoinBased) {
            uint256 accruedVvv = order.vvvAmountIn * order.rate * elapsed / (1000 * 86400);
            if (accruedVvv > order.claimedAmount) {
                pendingVvv          = accruedVvv - order.claimedAmount;
                order.claimedAmount = accruedVvv;
            }
        } else {
            uint256 accruedUsd = order.usdValue * order.rate * elapsed / (1000 * 86400);
            if (accruedUsd > order.claimedAmount) {
                uint256 pendingUsd  = accruedUsd - order.claimedAmount;
                order.claimedAmount = accruedUsd;
                if (price > 0) pendingVvv = pendingUsd * 1 ether / price;
            }
        }

        require(pendingVvv > 0, "Staking: no rewards to claim");

        users[msg.sender].rewardClaimed += pendingVvv;
        payout.payReward(msg.sender, pendingVvv);

        _propagateRewards(msg.sender, pendingVvv);

        emit RewardClaimed(msg.sender, pendingVvv);
    }

    // ─────────────────────────────────────────
    //  CORE: Withdraw Principal
    // ─────────────────────────────────────────

    /**
     * @notice Redeem staked principal after order expiry.
     *
     *  Coin-based: returns the original vvvAmountIn VVV.
     *  Fiat-based: returns usdValue worth of VVV at the current price.
     *
     *  Auto-settles any remaining unclaimed rewards (propagates to uplines).
     *  Principal redemption does NOT trigger team/invite reward propagation.
     */
    function withdrawOrderPrincipal(uint256 orderId)
        external
        whenNotPaused
        whenAccountNotFrozen
        nonReentrant
    {
        require(orderId < userOrders[msg.sender].length, "Staking: order not found");
        Order storage order = userOrders[msg.sender][orderId];
        require(!order.isWithdrawn,               "Staking: already withdrawn");
        require(block.timestamp >= order.endTime, "Staking: order not expired");

        order.isWithdrawn = true;

        uint256 price   = getLatestPrice();
        uint256 fullDur = order.endTime - order.startTime;

        // ── Reject if unclaimed rewards remain (must claim first) ────────────
        if (order.isCoinBased) {
            uint256 totalVvv = order.vvvAmountIn * order.rate * fullDur / (1000 * 86400);
            require(totalVvv <= order.claimedAmount, "Staking: claim rewards first");
        } else {
            uint256 totalUsd = order.usdValue * order.rate * fullDur / (1000 * 86400);
            require(totalUsd <= order.claimedAmount, "Staking: claim rewards first");
        }

        // ── Deduct this order's USD from upstream teamVolume7 and re-evaluate levels
        address up = users[msg.sender].referrer;
        for (uint256 i = 0; i < 7; i++) {
            if (up == address(0)) break;
            if (users[up].teamVolume7 >= order.usdValue)
                users[up].teamVolume7 -= order.usdValue;
            else
                users[up].teamVolume7 = 0;
            _updateLevel(up);
            up = users[up].referrer;
        }

        // ── Return principal (no fee, no propagation) ─────────────────────────
        uint256 returnVvv;
        if (order.isCoinBased) {
            returnVvv = order.vvvAmountIn;
        } else {
            require(price > 0, "Staking: price unavailable");
            returnVvv = order.usdValue * 1 ether / price;
        }

        payout.payPrincipal(msg.sender, returnVvv);

        emit PrincipalWithdrawn(msg.sender, orderId, returnVvv);
    }

    // ─────────────────────────────────────────
    //  CORE: Claim Team Reward
    // ─────────────────────────────────────────

    /**
     * @notice Claim all accumulated team + invite rewards.
     *         Calls Payout.payReward which deducts 10% fee and swaps ETH→VVV.
     */
    function claimTeamReward()
        external
        whenNotPaused
        whenAccountNotFrozen
        nonReentrant
    {
        uint256 amount = pendingTeamReward[msg.sender];
        require(amount > 0, "Staking: no team reward");
        pendingTeamReward[msg.sender] = 0;
        payout.payReward(msg.sender, amount);
        emit TeamRewardClaimed(msg.sender, amount);
    }

    // ─────────────────────────────────────────
    //  Internal: Reward Propagation
    // ─────────────────────────────────────────

    /**
     * @dev Propagate invite rewards (3 gens, no compression) and team differential
     *      rewards (7 valid gens, with compression) when claimer claims `vvvGross`.
     *
     *  Rewards are paid IMMEDIATELY via payout.payReward (10% fee deducted inside
     *  VVVPayout).  If Payout ETH is insufficient the reward is queued in VVVPayout
     *  and will be flushed by the owner — the claimer's tx is never blocked.
     *
     *  TeamRewardAccrued is emitted BEFORE the payReward call so it reliably marks
     *  "this reward has been triggered" regardless of queue state.
     *
     *  Invite (per-cent, ÷100):
     *    gen1 = 10%,  gen2 = 5%,  gen3 = 3%
     *
     *  Team differential (per-cent, ÷100 via levelRates[]):
     *    upLevel > clLevel  → (levelRates[upLevel] – levelRates[clLevel])% × gross
     *    upLevel ≤ clLevel  → first such upline: 10% flat; subsequent: 0
     *
     *  "Valid" upline = has at least one active (not withdrawn AND not expired) order.
     */
    function _propagateRewards(address claimer, uint256 vvvGross) internal {
        if (vvvGross == 0) return;

        // ── 1. Invite rewards: walk 3 direct generations (no compression) ─────
        //    No fee deducted — payPrincipal is used so upline receives full amount.
        address up = users[claimer].referrer;
        for (uint256 gen = 1; gen <= 3 && up != address(0); gen++) {
            uint256 bonus = vvvGross * inviteRates[gen] / 100;
            if (bonus > 0) {
                emit TeamRewardAccrued(up, claimer, bonus);
                payout.payPrincipal(up, bonus);
            }
            up = users[up].referrer;
        }

        // ── 2. Team rewards ──────────────────────────────────────────────────
        //
        // Benchmark = claimer A's level.  Walk up to 7 valid (active-order) ancestors.
        //
        //   Rule 1 — B.level > A.level (any ancestor):
        //             differential only = (levelRates[B] − levelRates[A])% × gross
        //             No additional flat bonus, even for the direct parent.
        //
        //   Rule 2 — B is A's DIRECT parent AND B.level ≤ A.level:
        //             flat 10% same-level bonus.
        //
        //   Rule 3 — Indirect ancestor AND B.level ≤ A.level: 0.
        //
        // Tree compression: uplines without an active order are skipped and do NOT
        // count toward the 7-generation limit.

        uint8   clLevel      = users[claimer].level < 1 ? 1 : users[claimer].level;
        address directParent = users[claimer].referrer;
        uint256 validFound   = 0;

        up = directParent;
        while (up != address(0) && validFound < 7) {
            if (!_hasActiveOrder(up)) {
                up = users[up].referrer;
                continue;
            }
            validFound++;

            uint8   upLevel = users[up].level;
            uint256 bonus   = 0;

            if (upLevel > clLevel) {
                // Rule 1: differential — spread between upline and claimer rates
                bonus = vvvGross * (levelRates[upLevel] - levelRates[clLevel]) / 100;
            } else if (up == directParent) {
                // Rule 2: direct parent with level ≤ A gets flat 10%
                bonus = vvvGross * 10 / 100;
            }
            // Rule 3: indirect ancestor with level ≤ A → bonus remains 0

            if (bonus > 0) {
                emit TeamRewardAccrued(up, claimer, bonus);
                payout.payPrincipal(up, bonus); // no fee on team rewards
            }

            up = users[up].referrer;
        }
    }

    /**
     * @dev Returns true if `user` has at least one order that is neither
     *      withdrawn nor past its endTime.
     */
    function _hasActiveOrder(address user) internal view returns (bool) {
        Order[] storage orders = userOrders[user];
        for (uint256 i = 0; i < orders.length; i++) {
            if (!orders[i].isWithdrawn && block.timestamp < orders[i].endTime) {
                return true;
            }
        }
        return false;
    }

    // ─────────────────────────────────────────
    //  View: Orders & Rewards
    // ─────────────────────────────────────────

    function ordersLength(address user) external view returns (uint256) {
        return userOrders[user].length;
    }

    function getOrder(address user, uint256 orderId) external view returns (Order memory) {
        require(orderId < userOrders[user].length, "Staking: order not found");
        return userOrders[user][orderId];
    }

    /** @notice Returns true if user has an active (non-withdrawn, non-expired) order. */
    function hasActiveOrder(address user) external view returns (bool) {
        return _hasActiveOrder(user);
    }

    /** @notice Pending VVV reward for a single order (gross, before fee) */
    function getPendingReward(address user, uint256 orderId)
        public view returns (uint256 pendingVvv)
    {
        if (orderId >= userOrders[user].length) return 0;
        Order storage order = userOrders[user][orderId];
        if (order.isWithdrawn) return 0;

        uint256 elapsed = block.timestamp - order.startTime;
        uint256 fullDur = order.endTime - order.startTime;
        if (elapsed > fullDur) elapsed = fullDur;
        uint256 price = getLatestPrice();

        if (order.isCoinBased) {
            uint256 accrued = order.vvvAmountIn * order.rate * elapsed / (1000 * 86400);
            if (accrued > order.claimedAmount) pendingVvv = accrued - order.claimedAmount;
        } else {
            if (price == 0) return 0;
            uint256 accrued = order.usdValue * order.rate * elapsed / (1000 * 86400);
            if (accrued > order.claimedAmount)
                pendingVvv = (accrued - order.claimedAmount) * 1 ether / price;
        }
    }

    /** @notice Total pending personal VVV (gross) across all orders */
    function getAllPendingRewards(address user) external view returns (uint256 total) {
        uint256 len = userOrders[user].length;
        for (uint256 i = 0; i < len; i++) {
            total += getPendingReward(user, i);
        }
    }

    /**
     * @notice Returns VVV/USD price in 18 decimals.
     *         Formula: (WETH_reserve / VVV_reserve) × ETH/USD
     *         Pool: token0=WETH (r0), token1=VVV (r1)
     */
    function getLatestPrice() public view returns (uint256) {
        (uint256 r0, uint256 r1, ) = pricePool.getReserves();
        require(r0 > 0 && r1 > 0, "Price: pool empty");

        (, int256 ethUsd, , uint256 updatedAt, ) = ethUsdFeed.latestRoundData();
        require(ethUsd > 0, "Price: invalid ETH/USD");
        require(block.timestamp - updatedAt <= maxPriceAge, "Price: Chainlink stale");

        // r0 (WETH, 18 dec) * ethUsd (8 dec) * 1e10 / r1 (VVV, 18 dec) → 18 dec
        return r0 * uint256(ethUsd) * 1e10 / r1;
    }

    // ─────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────

    function _updateLevel(address user) internal {
        uint8 newLevel = 0;
        for (uint8 j = 8; j >= 1; j--) {
            if (users[user].teamVolume7 >= levelThresholds[j]) {
                newLevel = j;
                break;
            }
            if (j == 1) break;
        }
        users[user].level = newLevel;
    }

    // ─────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────

    /** @notice Set the root referrer address (users without invite code bind here). */
    function setRootReferrer(address _root) external onlyOwner {
        require(_root != address(0), "Staking: zero root");
        rootReferrer = _root;
        emit RootReferrerSet(_root);
    }

    /**
     * @notice Manually set a user's level (owner-only, useful for testing /
     *         emergency corrections).
     */
    function setUserLevel(address user, uint8 level) external onlyOwner {
        require(level <= 8, "Staking: invalid level");
        users[user].level = level;
    }

    /** @notice Update invite reward rate for a generation (1–3). */
    function setInviteRate(uint256 gen, uint256 rate) external onlyOwner {
        require(gen >= 1 && gen <= 3, "Staking: invalid gen");
        require(rate <= 100, "Staking: rate too high");
        inviteRates[gen] = rate;
    }

    function setTreasury(address _t) external onlyOwner {
        treasury = ITreasury(_t);
    }

    function setPayout(address _p) external onlyOwner {
        payout = IPayout(_p);
    }

    function setPricePool(address _pool) external onlyOwner {
        require(_pool != address(0), "Staking: zero address");
        pricePool = IAeroPool(_pool);
    }

    function setEthUsdFeed(address _feed) external onlyOwner {
        require(_feed != address(0), "Staking: zero address");
        ethUsdFeed = IChainlinkFeed(_feed);
    }

    function setMaxPriceAge(uint256 _secs) external onlyOwner {
        maxPriceAge = _secs;
    }

    function setMinStakeUsd(uint256 _min) external onlyOwner {
        minStakeUsd = _min;
    }

    function setDurationRate(uint256 _duration, uint256 _rate) external onlyOwner {
        durationRates[_duration] = _rate;
        emit DurationRateUpdated(_duration, _rate);
    }

    function setFreezeStatus(address target, bool frozen) external onlyOwner {
        accountFrozen[target] = frozen;
        emit FrozenStatusChanged(target, frozen);
    }

    function setLevelThreshold(uint8 level, uint256 threshold) external onlyOwner {
        require(level >= 1 && level <= 8, "Invalid level");
        levelThresholds[level] = threshold;
        emit LevelThresholdUpdated(level, threshold);
    }

    function setLevelRate(uint8 level, uint256 rate) external onlyOwner {
        require(level >= 1 && level <= 8, "Invalid level");
        levelRates[level] = rate;
        emit LevelRateUpdated(level, rate);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
