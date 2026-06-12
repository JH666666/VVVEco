/**
 * VVVEco — 前端接入集成测试 (10 项)
 *
 * 目标：使用 deployments/localhost.json 中的已部署合约，逐项验证前端
 *       所有核心 hook 对应的合约功能是否正常。
 *
 * 运行：npx hardhat run scripts/test-integration.ts --network localhost
 *
 * 测试项：
 *   T01 stake() 创建订单
 *   T02 ordersLength / getOrder (Dashboard 显示)
 *   T03 claimAllRewards() 领取收益 + _propagateRewards 触发
 *   T04 withdrawOrderPrincipal() 到期赎回
 *   T05 pendingTeamReward 在 claimAllRewards 后有增量
 *   T06 claimTeamReward() 领取 → pendingTeamReward 清零
 *   T07 users(address).level 链上等级读取
 *   T08 accountFrozen() 冻结状态读取
 *   T09 rootReferrer 自动绑定（无邀请码场景）
 *   T10 inviteRates / levelRates ABI 兼容性验证
 */

import { ethers, NonceManager } from "ethers";
import * as fs   from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const RPC = "http://127.0.0.1:8545";

// Hardhat default accounts
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // [0] deployer/owner
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // [1] alice (referrer)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // [2] bob (claimer)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // [3] charlie
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function art(name: string) {
  const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi };
}

function at(name: string, address: string, signer: ethers.Signer) {
  return new ethers.Contract(address, art(name).abi, signer);
}

const f = (n: bigint, d = 4) => parseFloat(ethers.formatEther(n)).toFixed(d);
const fmt = (label: string) => label.padEnd(52, "·");

let _pass = 0, _fail = 0;
function check(label: string, ok: boolean, note = "") {
  const icon = ok ? "✅" : "❌";
  console.log(`  ${icon}  ${fmt(label)}${note}`);
  ok ? _pass++ : _fail++;
}

async function mine(provider: ethers.JsonRpcProvider, seconds: number) {
  await provider.send("evm_increaseTime", [seconds]);
  await provider.send("evm_mine", []);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║       VVVEco 前端接入集成测试 — localhost 部署合约          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const provider  = new ethers.JsonRpcProvider(RPC);
  const deployer  = new NonceManager(new ethers.Wallet(KEYS[0], provider));
  const alice     = new NonceManager(new ethers.Wallet(KEYS[1], provider));
  const bob       = new NonceManager(new ethers.Wallet(KEYS[2], provider));
  const charlie   = new NonceManager(new ethers.Wallet(KEYS[3], provider));

  const deployerAddr  = await deployer.getAddress();
  const aliceAddr     = await alice.getAddress();
  const bobAddr       = await bob.getAddress();
  const charlieAddr   = await charlie.getAddress();

  // Load deployment
  const dep = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/localhost.json"), "utf8")
  );
  const { VVVToken: tokenAddr, VVVEcoStaking: stakingAddr,
          VVVPayout: payoutAddr, MockRouter: routerAddr } = dep.contracts;

  console.log("合约地址:");
  console.log("  VVVToken:      ", tokenAddr);
  console.log("  VVVEcoStaking: ", stakingAddr);
  console.log("  VVVPayout:     ", payoutAddr);
  console.log("  MockRouter:    ", routerAddr);
  console.log();

  const staking = at("VVVEcoStaking", stakingAddr, deployer);
  const token   = at("VVVToken",      tokenAddr,   deployer);
  const payout  = at("VVVPayout",     payoutAddr,  deployer);

  // Contract-connected as alice / bob / charlie
  const stakingAlice   = staking.connect(alice)   as ethers.Contract;
  const stakingBob     = staking.connect(bob)      as ethers.Contract;
  const stakingCharlie = staking.connect(charlie)  as ethers.Contract;
  const tokenAlice     = token.connect(alice)      as ethers.Contract;
  const tokenBob       = token.connect(bob)        as ethers.Contract;
  const tokenCharlie   = token.connect(charlie)    as ethers.Contract;

  // ── SETUP ──────────────────────────────────────────────────────────────────
  console.log("=== 初始化 ===");

  // Disable min stake USD for easy testing
  await (await staking.setMinStakeUsd(0)).wait();

  // Mint VVV to alice, bob, charlie
  const MINT = ethers.parseEther("50000");
  await (await token.mint(aliceAddr, MINT)).wait();
  await (await token.mint(bobAddr, MINT)).wait();
  await (await token.mint(charlieAddr, MINT)).wait();
  console.log("  mint 50k VVV → alice, bob, charlie ✓");

  // Ensure Payout has ETH
  const payoutBal = await provider.getBalance(payoutAddr);
  if (payoutBal < ethers.parseEther("1")) {
    await (await deployer.sendTransaction({ to: payoutAddr, value: ethers.parseEther("5") })).wait();
    console.log("  fund Payout 5 ETH ✓");
  }

  // Ensure Router has VVV for redemptions
  const routerVvv = await (token as ethers.Contract).balanceOf(routerAddr);
  if (routerVvv < ethers.parseEther("100000")) {
    await (await token.mint(routerAddr, ethers.parseEther("1000000"))).wait();
    console.log("  fund Router 1M VVV ✓");
  }

  // Set alice as bob's referrer (alice stakes first to register)
  const STAKE_AMOUNT = ethers.parseEther("10000");
  const DURATION_30D = 30;    // days (contract takes days, not seconds)
  const DURATION_7D  = 7;     // days
  const ROOT = await staking.rootReferrer() as string;

  // Alice registers with rootReferrer
  await (await tokenAlice.approve(stakingAddr, STAKE_AMOUNT)).wait();
  await (await stakingAlice.stake(STAKE_AMOUNT, DURATION_30D, false, ROOT)).wait();
  console.log("  alice stakes → referrer=rootReferrer ✓");

  // Bob registers with alice as referrer
  await (await tokenBob.approve(stakingAddr, STAKE_AMOUNT)).wait();
  await (await stakingBob.stake(STAKE_AMOUNT, DURATION_30D, false, aliceAddr)).wait();
  console.log("  bob stakes → referrer=alice ✓");
  console.log();

  // ════════════════════════════════════════════════════════════════════════
  // T01 — stake() 创建订单
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== T01 stake() 创建订单 ===");
  const charlieApprove = ethers.parseEther("5000");
  await (await tokenCharlie.approve(stakingAddr, charlieApprove)).wait();
  const txStake = await (await stakingCharlie.stake(
    charlieApprove, DURATION_7D, false, bobAddr
  )).wait();
  check("T01 stake tx confirmed", txStake!.status === 1,
    `gas=${txStake!.gasUsed}`);

  const len = await staking.ordersLength(charlieAddr) as bigint;
  check("T01 ordersLength > 0 (charlie)", len > 0n, `length=${len}`);
  console.log();

  // ════════════════════════════════════════════════════════════════════════
  // T02 — getOrder (Dashboard 数据源)
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== T02 getOrder (Dashboard 数据源) ===");
  // Charlie's first order is from setup stake; last is the 5000 VVV one
  const charlieLen = Number(await staking.ordersLength(charlieAddr));
  const lastOrder = await staking.getOrder(charlieAddr, charlieLen - 1) as {
    vvvAmountIn: bigint; usdValue: bigint; startTime: bigint; endTime: bigint;
    duration: bigint; rate: bigint; isCoinBased: boolean; isWithdrawn: boolean;
    claimedAmount: bigint
  };
  check("T02 getOrder returns 9-field struct",
    lastOrder.vvvAmountIn !== undefined && lastOrder.usdValue !== undefined,
    `vvvIn=${f(lastOrder.vvvAmountIn)} duration=${lastOrder.duration / 86400n}d`);
  check("T02 isWithdrawn=false initially", !lastOrder.isWithdrawn);
  check("T02 getAllPendingRewards returns bigint",
    typeof (await staking.getAllPendingRewards(charlieAddr)) === "bigint");
  console.log();

  // ════════════════════════════════════════════════════════════════════════
  // T03 — claimAllRewards() + _propagateRewards 触发
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== T03 claimAllRewards() + pendingTeamReward 增量 ===");
  // Advance 7 days so charlie's order matures
  await mine(provider, 7 * 86400 + 300);

  const pendingBefore = await staking.pendingTeamReward(bobAddr) as bigint;
  const pendingAliceBefore = await staking.pendingTeamReward(aliceAddr) as bigint;

  // Charlie claims personal rewards → _propagateRewards fires
  const txClaim = await (await stakingCharlie.claimAllRewards()).wait();
  check("T03 claimAllRewards tx confirmed", txClaim!.status === 1,
    `gas=${txClaim!.gasUsed}`);

  const pendingBobAfter   = await staking.pendingTeamReward(bobAddr)   as bigint;
  const pendingAliceAfter = await staking.pendingTeamReward(aliceAddr) as bigint;
  check("T03 bob.pendingTeamReward increased after charlie claims",
    pendingBobAfter > pendingBefore,
    `before=${f(pendingBefore)} after=${f(pendingBobAfter)}`);
  check("T03 alice.pendingTeamReward increased (gen2 invite)",
    pendingAliceAfter > pendingAliceBefore,
    `before=${f(pendingAliceBefore)} after=${f(pendingAliceAfter)}`);
  console.log();

  // ════════════════════════════════════════════════════════════════════════
  // T04 — withdrawOrderPrincipal() 到期赎回
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== T04 withdrawOrderPrincipal() 到期赎回 ===");
  // Charlie's 7d order (index charlieLen-1) is already past endTime
  const charlieVvvBefore = await token.balanceOf(charlieAddr) as bigint;
  const txWithdraw = await (await stakingCharlie.withdrawOrderPrincipal(charlieLen - 1)).wait();
  check("T04 withdrawOrderPrincipal tx confirmed", txWithdraw!.status === 1,
    `gas=${txWithdraw!.gasUsed}`);

  const orderAfter = await staking.getOrder(charlieAddr, charlieLen - 1) as { isWithdrawn: boolean };
  check("T04 isWithdrawn=true after withdraw", orderAfter.isWithdrawn);
  // Principal was VVV-based: user should receive VVV back
  const charlieVvvAfter = await token.balanceOf(charlieAddr) as bigint;
  check("T04 charlie VVV balance increased after withdraw",
    charlieVvvAfter > charlieVvvBefore,
    `delta=+${f(charlieVvvAfter - charlieVvvBefore)} VVV`);
  console.log();

  // ════════════════════════════════════════════════════════════════════════
  // T05 — pendingTeamReward 显示 (Team 页面数据源)
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== T05 pendingTeamReward 显示 ===");
  const bobPending  = await staking.pendingTeamReward(bobAddr)   as bigint;
  const alicePending = await staking.pendingTeamReward(aliceAddr) as bigint;
  check("T05 bob pendingTeamReward > 0", bobPending > 0n,   `${f(bobPending)} VVV`);
  check("T05 alice pendingTeamReward > 0", alicePending > 0n, `${f(alicePending)} VVV`);
  console.log();

  // ════════════════════════════════════════════════════════════════════════
  // T06 — claimTeamReward() 领取 → pendingTeamReward 清零
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== T06 claimTeamReward() 领取 → 清零 ===");
  const stakingBobClaim = staking.connect(bob) as ethers.Contract;
  const bobVvvBefore = await token.balanceOf(bobAddr) as bigint;
  const txClaimTeam = await (await stakingBobClaim.claimTeamReward()).wait();
  check("T06 claimTeamReward tx confirmed", txClaimTeam!.status === 1,
    `gas=${txClaimTeam!.gasUsed}`);

  const bobPendingAfter = await staking.pendingTeamReward(bobAddr) as bigint;
  check("T06 pendingTeamReward cleared to 0 after claim", bobPendingAfter === 0n,
    `remaining=${f(bobPendingAfter)}`);

  const bobVvvAfter = await token.balanceOf(bobAddr) as bigint;
  // VVV payout: gross * 90% (10% fee)
  const expectedNet = bobPending * 90n / 100n;
  const actualGain = bobVvvAfter - bobVvvBefore;
  // Accept within 1% tolerance (router conversion rounding)
  const diff = actualGain > expectedNet ? actualGain - expectedNet : expectedNet - actualGain;
  check("T06 bob VVV received ≈ gross×90% (net after fee)",
    diff * 100n / (expectedNet || 1n) < 2n,
    `gross=${f(bobPending)} net≈${f(expectedNet)} got=${f(actualGain)}`);
  console.log();

  // ════════════════════════════════════════════════════════════════════════
  // T07 — users(address).level 链上等级读取
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== T07 users(address).level 链上等级 ===");
  const aliceInfo   = await staking.users(aliceAddr)   as { level: bigint };
  const bobInfo     = await staking.users(bobAddr)     as { level: bigint };
  const unknownInfo = await staking.users(ethers.ZeroAddress.replace("0x0", "0x1")) as { level: bigint };
  check("T07 users(alice).level is a number", typeof aliceInfo.level !== "undefined",
    `level=${aliceInfo.level}`);
  check("T07 users(bob).level readable", typeof bobInfo.level !== "undefined",
    `level=${bobInfo.level}`);
  check("T07 users(unknown).level=0 for fresh address", unknownInfo.level === 0n,
    `level=${unknownInfo.level}`);
  // Verify ABI tuple shape: referrer + teamVolume7 + level + rewardClaimed
  const fullAlice = await staking.users(aliceAddr) as {
    referrer: string; teamVolume7: bigint; level: bigint; rewardClaimed: bigint
  };
  check("T07 users() returns 4-field tuple (ABI match)",
    typeof fullAlice.referrer === "string" &&
    typeof fullAlice.teamVolume7 === "bigint" &&
    typeof fullAlice.level !== "undefined" &&
    typeof fullAlice.rewardClaimed === "bigint",
    `referrer=${fullAlice.referrer.slice(0,10)}…`);
  console.log();

  // ════════════════════════════════════════════════════════════════════════
  // T08 — accountFrozen() 冻结状态读取
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== T08 accountFrozen() 冻结状态 ===");
  const frozenAlice = await staking.accountFrozen(aliceAddr) as boolean;
  check("T08 accountFrozen(alice) = false (normal user)", frozenAlice === false);

  // Freeze charlie, check, then unfreeze
  await (await staking.setFreezeStatus(charlieAddr, true)).wait();
  const frozenCharlie = await staking.accountFrozen(charlieAddr) as boolean;
  check("T08 accountFrozen(charlie) = true after setFreezeStatus(true)", frozenCharlie === true);

  await (await staking.setFreezeStatus(charlieAddr, false)).wait();
  const unfrozenCharlie = await staking.accountFrozen(charlieAddr) as boolean;
  check("T08 accountFrozen(charlie) = false after unfreeze", unfrozenCharlie === false);
  console.log();

  // ════════════════════════════════════════════════════════════════════════
  // T09 — rootReferrer 自动绑定（无邀请码）
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== T09 rootReferrer 自动绑定 ===");
  const rootAddr = await staking.rootReferrer() as string;
  check("T09 rootReferrer set (non-zero)", rootAddr !== ethers.ZeroAddress, rootAddr);
  check("T09 rootReferrer == deployer", rootAddr.toLowerCase() === deployerAddr.toLowerCase());

  // Verify alice's referrer was recorded as rootReferrer
  const aliceReferrer = fullAlice.referrer;
  check("T09 alice.referrer = rootReferrer (staked with ROOT)",
    aliceReferrer.toLowerCase() === rootAddr.toLowerCase(),
    `ref=${aliceReferrer.slice(0,10)}…`);
  console.log();

  // ════════════════════════════════════════════════════════════════════════
  // T10 — ABI 兼容性：inviteRates / levelRates / hasActiveOrder
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== T10 ABI 兼容性验证 ===");
  const inv1 = await staking.inviteRates(1) as bigint;
  const inv2 = await staking.inviteRates(2) as bigint;
  const inv3 = await staking.inviteRates(3) as bigint;
  check("T10 inviteRates(1)=15", inv1 === 15n, `got=${inv1}`);
  check("T10 inviteRates(2)=10", inv2 === 10n, `got=${inv2}`);
  check("T10 inviteRates(3)=5",  inv3 === 5n,  `got=${inv3}`);

  const lr1 = await staking.levelRates(1) as bigint;
  const lr8 = await staking.levelRates(8) as bigint;
  check("T10 levelRates(1)=10",  lr1 === 10n, `got=${lr1}`);
  check("T10 levelRates(8)=80",  lr8 === 80n, `got=${lr8}`);

  const hasActive = await staking.hasActiveOrder(aliceAddr) as boolean;
  check("T10 hasActiveOrder(alice) = true (has 30d stake)", hasActive === true);

  // Also test the frontend ABI constant against real function sig
  const fragment = (staking.interface as ethers.Interface).getFunction("claimTeamReward");
  check("T10 ABI has claimTeamReward()", fragment !== null);
  const fragUsers = (staking.interface as ethers.Interface).getFunction("users");
  check("T10 ABI has users(address) tuple", fragUsers !== null);
  console.log();

  // ════════════════════════════════════════════════════════════════════════
  // BONUS — Frontend env var check
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== ENV CHECK ===");
  const envPath = path.join(__dirname, "../.env.local");
  const envContent = fs.readFileSync(envPath, "utf8");
  const hasToken   = envContent.includes("NEXT_PUBLIC_VVV_TOKEN");
  const hasStaking = envContent.includes("NEXT_PUBLIC_VVECO_STAKING");

  if (!hasToken || !hasStaking) {
    console.log("\n⚠️  .env.local 缺少合约地址配置！前端将使用 0x000...000，链上读写全部失败。");
    console.log("   请在 .env.local 添加：");
    console.log(`   NEXT_PUBLIC_VVV_TOKEN=${tokenAddr}`);
    console.log(`   NEXT_PUBLIC_VVECO_STAKING=${stakingAddr}`);
    console.log();
  }
  check("ENV NEXT_PUBLIC_VVV_TOKEN set", hasToken,
    hasToken ? "" : `← 缺少！应设为 ${tokenAddr}`);
  check("ENV NEXT_PUBLIC_VVECO_STAKING set", hasStaking,
    hasStaking ? "" : `← 缺少！应设为 ${stakingAddr}`);

  // ── Summary ──────────────────────────────────────────────────────────────
  const total = _pass + _fail;
  console.log("═".repeat(65));
  console.log(`\n  结果：${_pass}/${total} 通过  ${_fail > 0 ? `❌ ${_fail} 失败` : "全部通过 ✅"}\n`);

  if (_fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
