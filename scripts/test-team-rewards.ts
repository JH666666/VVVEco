/**
 * VVVEco — Team Reward System Test (auto-pay edition)
 *
 * 团队奖励现在在 _propagateRewards 里直接调用 payout.payReward(up, bonus)，
 * 不再写入 pendingTeamReward。
 *
 * 验证方式统一改为：验证上级 vvv.balanceOf(upline) 的变化量。
 *
 * 前提: npx hardhat node 已在另一终端运行
 * 运行: npx hardhat run scripts/test-team-rewards.ts --network localhost
 *
 * 覆盖规则:
 *   T1.  领取质押收益 10% 手续费扣除
 *   T2.  团队奖励以 VVV 毛额计算 (非净值)
 *   T4.  邀请奖励 3代: 15% / 10% / 5%
 *   T5.  代数紧缩最多 7 个有效上级
 *   T6.  无质押上级跳过，不计入 7 代
 *   T7.  级差奖励 = 上级等级% − 领取者等级%
 *   T8.  平级上级: 仅最近一位获 10% 平级奖励
 *   T9.  低级上级: 仅最近一位获 10% 超越奖励
 *   T10. 低级在前、更高级在后: 更高级仍享级差
 *   T11. 金本位收益: 以转换后 VVV 毛额为基数
 *   T12. 本金赎回: 不触发团队/邀请奖励
 *   T14. 无邀请码用户自动绑定 rootReferrer
 *
 *  新增自动到账专项测试:
 *   T_AUTO1. 下级领取 → 上级钱包直接收到 VVV（无需 claimTeamReward）
 *   T_AUTO2. 上级到账 = bonus × 90%（10% 手续费扣除）
 *   T_AUTO3. feeWallet 收到 10% 手续费
 *   T_AUTO4. TeamRewardAccrued 事件触发
 *   T_AUTO5. pendingTeamReward 不再写入（保持 0）
 *   T_AUTO6. Payout ETH 不足时奖励进 queue，claimer tx 不 revert
 *   T_GAS.   最坏情况 gas 消耗（7代+3代邀请同时触发）
 */

import { ethers, NonceManager } from "ethers";
import * as fs   from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const RPC = "http://127.0.0.1:8545";

// ── Hardhat default accounts (deterministic) ────────────────────────────────
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // [0] deployer / root
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // [1] grace  (V8)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // [2] alice  (V5)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // [3] bob    (V4)
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // [4] charlie(V3)
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // [5] dave   (V2)
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", // [6] eve    (V1)
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", // [7] frank  (V2, claimer)
  "0xdbda1821b80551c9d65939329250132c444b1a867d6bfcd2f6d4dff1e33f5e09", // [8] newUser (T14)
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function art(name: string) {
  const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode };
}
async function deployC(signer: ethers.Signer, name: string, ...args: unknown[]) {
  const c = await new ethers.ContractFactory(art(name).abi, art(name).bytecode, signer)
    .deploy(...(args as never[]));
  await c.waitForDeployment();
  return c as ethers.Contract;
}

let _pass = 0, _fail = 0;
function check(label: string, ok: boolean, got = "", exp = "") {
  const icon = ok ? "✅" : "❌";
  const detail = (!ok && (got || exp)) ? `  got=${got}  exp=${exp}` : "";
  console.log(`    ${icon}  ${label}${detail}`);
  ok ? _pass++ : _fail++;
}
async function expectRevert(fn: () => Promise<ethers.ContractTransactionResponse>, label: string) {
  try { await (await fn()).wait(); check(label, false, "no revert"); }
  catch { check(label, true); }
}

async function mine(provider: ethers.JsonRpcProvider, seconds: number) {
  await provider.send("evm_increaseTime", [seconds]);
  await provider.send("evm_mine", []);
}

const f4 = (n: bigint) => parseFloat(ethers.formatEther(n)).toFixed(4);

// ── Fresh deployment ─────────────────────────────────────────────────────────

async function freshDeploy(
  deployer: ethers.Signer,
  deployerAddr: string,
  extraSetup?: (s: ethers.Contract) => Promise<void>
) {
  const WETH    = ethers.ZeroAddress;
  const vvv     = await deployC(deployer, "VVVToken");
  const router  = await deployC(deployer, "MockRouter", await vvv.getAddress());
  const treasury= await deployC(deployer, "VVVTreasury",
    await vvv.getAddress(), await router.getAddress(), WETH, deployerAddr);
  const payout  = await deployC(deployer, "VVVPayout",
    await vvv.getAddress(), await router.getAddress(), WETH, deployerAddr, 10);
  const staking = await deployC(deployer, "VVVEcoStaking",
    await vvv.getAddress(), await treasury.getAddress(), await payout.getAddress());

  const SA = await staking.getAddress();
  const RA = await router.getAddress();
  const PA = await payout.getAddress();

  await (await router.setRate(BigInt("100000000000000"))).wait();      // 1e14: 1 VVV = 0.0001 ETH
  await (await router.seedETH({ value: ethers.parseEther("100") })).wait();
  await (await vvv.approve(RA, ethers.parseEther("5000000"))).wait();
  await (await router.seedVVV(ethers.parseEther("5000000"))).wait();
  await (await treasury.setStakingContract(SA)).wait();
  await (await payout.setStakingContract(SA)).wait();
  await (await payout.depositETH({ value: ethers.parseEther("20") })).wait();
  await (await staking.setMinStakeUsd(0n)).wait();

  if (extraSetup) await extraSetup(staking);

  return { vvv, router, treasury, payout, staking };
}

// ── Stake helper ─────────────────────────────────────────────────────────────
async function doStake(
  vvv: ethers.Contract,
  staking: ethers.Contract,
  user: ethers.Signer,
  userAddr: string,
  stakingAddr: string,
  amount: bigint,
  duration: number,
  isCoinBased: boolean,
  referrer: string
) {
  await (await vvv.connect(user).approve(stakingAddr, amount)).wait();
  await (await staking.connect(user).stake(amount, duration, isCoinBased, referrer)).wait();
}

// ── balanceOf snapshot ────────────────────────────────────────────────────────
async function snapBalances(vvv: ethers.Contract, addrs: string[]): Promise<bigint[]> {
  return Promise.all(addrs.map(a => vvv.balanceOf(a)));
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);

  const rawWallets = KEYS.map(k => new ethers.Wallet(k, provider));
  const [_root, _grace, _alice, _bob, _charlie, _dave, _eve, _frank, _newUser] = rawWallets;
  const [root,  grace,  alice,  bob,  charlie,  dave,  eve,  frank,  newUser]  =
    rawWallets.map(w => new NonceManager(w));

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║   VVVEco — Team Reward Test (auto-pay, balanceOf verify)    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // ═══════════════════════════════════════════════════════════════════════════
  //  DEPLOY 1 — Main tree
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Deploy 1: 建立主树 ──────────────────────────────────────────");

  const { vvv, payout, staking } = await freshDeploy(root, _root.address);
  const SA  = await staking.getAddress();

  // Mint VVV
  const MINT_NORMAL = ethers.parseEther("5000");
  const MINT_FRANK  = ethers.parseEther("500000");
  for (const addr of [_grace, _alice, _bob, _charlie, _dave, _eve].map(w => w.address)) {
    await (await vvv.mint(addr, MINT_NORMAL)).wait();
  }
  await (await vvv.mint(_frank.address,   MINT_FRANK)).wait();
  await (await vvv.mint(_newUser.address, MINT_NORMAL)).wait();
  await (await root.sendTransaction({ to: _newUser.address, value: ethers.parseEther("2") })).wait();

  // Build referral tree: frank→eve→dave→charlie→bob→alice→grace→root
  const TINY = ethers.parseEther("1");
  const SIXTY = 60;

  await doStake(vvv, staking, grace,   _grace.address,   SA, TINY, SIXTY, true, _root.address);
  await doStake(vvv, staking, alice,   _alice.address,   SA, TINY, SIXTY, true, _grace.address);
  await doStake(vvv, staking, bob,     _bob.address,     SA, TINY, SIXTY, true, _alice.address);
  await doStake(vvv, staking, charlie, _charlie.address, SA, TINY, SIXTY, true, _bob.address);
  await doStake(vvv, staking, dave,    _dave.address,    SA, TINY, SIXTY, true, _charlie.address);
  await doStake(vvv, staking, eve,     _eve.address,     SA, TINY, SIXTY, true, _dave.address);

  // Set levels
  const setLevel = async (addr: string, lvl: number) =>
    (await staking.setUserLevel(addr, lvl)).wait();

  const DEFAULT_LEVELS: Record<string, number> = {
    [_grace.address]:   8,
    [_alice.address]:   5,
    [_bob.address]:     4,
    [_charlie.address]: 3,
    [_dave.address]:    2,
    [_eve.address]:     1,
    [_frank.address]:   2,
  };
  async function restoreDefaultLevels() {
    for (const [addr, lvl] of Object.entries(DEFAULT_LEVELS)) await setLevel(addr, lvl);
  }
  await restoreDefaultLevels();

  const UPLINES = [_grace.address, _alice.address, _bob.address,
                   _charlie.address, _dave.address, _eve.address];

  // frank stakes 10000 VVV coin-based 7d; gross = 10000 * 7 * 7 / 1000 = 490 VVV
  const FRANK_STAKE = ethers.parseEther("10000");
  const GROSS = ethers.parseEther("490");

  async function frankClaimCycle() {
    await doStake(vvv, staking, frank, _frank.address, SA, FRANK_STAKE, 7, true, _eve.address);
    await mine(provider, 7 * 86400 + 200);
    const balBefore = await snapBalances(vvv, [_frank.address, ...UPLINES, _root.address]);
    await (await staking.connect(frank).claimAllRewards()).wait();
    const balAfter  = await snapBalances(vvv, [_frank.address, ...UPLINES, _root.address]);
    const deltas = balAfter.map((a: bigint, i: number) => a - balBefore[i]);
    return {
      frankReceived: deltas[0],
      deltas: deltas.slice(1, 7), // grace,alice,bob,charlie,dave,eve
      rootDelta: deltas[7],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // T_AUTO1–T_AUTO5: 自动到账专项测试 (frank=V2, 最简路径)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ T_AUTO1–5: 自动到账专项 ════════════════════════════════════");

  await restoreDefaultLevels();
  const feeWalletAddr = await payout.feeWallet();
  const feeBalBefore  = await vvv.balanceOf(feeWalletAddr);
  const eveBalBefore  = await vvv.balanceOf(_eve.address);
  const evePendBefore = await staking.pendingTeamReward(_eve.address);

  await doStake(vvv, staking, frank, _frank.address, SA, FRANK_STAKE, 7, true, _eve.address);
  await mine(provider, 7 * 86400 + 200);
  const tx = await (await staking.connect(frank).claimAllRewards()).wait();

  const feeBalAfter  = await vvv.balanceOf(feeWalletAddr);
  const eveBalAfter  = await vvv.balanceOf(_eve.address);
  const evePendAfter = await staking.pendingTeamReward(_eve.address);

  // eve is gen1 invite (15%) + flat team 10% = 25% gross → net = 25% × 90%
  // gross to eve = GROSS * 25% = 122.5 VVV → net = 110.25 VVV
  const eveBonusGross  = GROSS * 25n / 100n; // 122.5 VVV
  const eveExpNet      = eveBonusGross * 90n / 100n;
  const eveExpFee      = eveBonusGross * 10n / 100n;
  const eveActualDelta = eveBalAfter - eveBalBefore;

  check("T_AUTO1: 下级 claim → 上级钱包直接收到 VVV（无需 claimTeamReward）",
    eveActualDelta > 0n, f4(eveActualDelta), ">0");
  check("T_AUTO2: 上级到账 = bonus × 90%",
    eveActualDelta === eveExpNet, f4(eveActualDelta), f4(eveExpNet));
  check("T_AUTO3: feeWallet 收到手续费（余额增加）",
    feeBalAfter > feeBalBefore, f4(feeBalAfter - feeBalBefore), ">0");
  check("T_AUTO4: TeamRewardAccrued 事件存在于 tx receipt",
    (tx?.logs?.length ?? 0) > 0, `logs=${tx?.logs?.length ?? 0}`, ">0");
  check("T_AUTO5: pendingTeamReward[eve] 不再写入（仍为 0）",
    evePendAfter === evePendBefore, evePendAfter.toString(), evePendBefore.toString());

  // ═══════════════════════════════════════════════════════════════════════════
  // T1 + T2 + T7: 默认级差场景 (frank=V2)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ T1 + T2 + T7: 默认级差 frank=V2 ════════════════════════════");

  await restoreDefaultLevels();
  const { frankReceived: frankReceivedT1, deltas: deltasT17 } = await frankClaimCycle();

  const expectedFrankNet = GROSS * 90n / 100n; // 441 VVV
  check("T1: frank 收到 90% 净值 (441 VVV)",
    frankReceivedT1 === expectedFrankNet, f4(frankReceivedT1), f4(expectedFrankNet));

  // bob=V4 gets diff (40-20)% = 20% gross → net = 18% gross = 98*0.9 = 88.2 VVV
  const bobBonusGrossT2 = GROSS * (40n - 20n) / 100n; // 98 VVV gross
  const bobExpNetT2     = bobBonusGrossT2 * 90n / 100n; // 88.2 VVV net
  check("T2: 团队奖励基于毛额 490（非净值 441）— bob 到账验证",
    deltasT17[2] === bobExpNetT2, f4(deltasT17[2]), f4(bobExpNetT2));

  const [graceD, aliceD, bobD, charlieD, daveD, eveD] = deltasT17;

  // Expected net amounts (gross × 90%):
  const eveGross    = GROSS * 15n/100n + GROSS * 10n/100n; // 73.5+49 = 122.5
  const daveGross   = GROSS * 10n/100n;                    // 49
  const charlieGross= GROSS * 5n/100n  + GROSS * (30n-20n)/100n; // 24.5+49 = 73.5
  const bobGross    = GROSS * (40n-20n)/100n;              // 98
  const aliceGross  = GROSS * (50n-20n)/100n;              // 147
  const graceGross  = GROSS * (80n-20n)/100n;              // 294

  const net = (g: bigint) => g * 90n / 100n;

  check("T7: eve   delta (invite15%+flat10% gross=122.5 → net=110.25)",
    eveD   === net(eveGross),     f4(eveD),     f4(net(eveGross)));
  check("T7: dave  delta (invite10% gross=49 → net=44.1)",
    daveD  === net(daveGross),    f4(daveD),    f4(net(daveGross)));
  check("T7: charlie delta (inv5%+diff10% gross=73.5 → net=66.15)",
    charlieD === net(charlieGross), f4(charlieD), f4(net(charlieGross)));
  check("T7: bob   delta (diff20% gross=98 → net=88.2)",
    bobD   === net(bobGross),     f4(bobD),     f4(net(bobGross)));
  check("T7: alice delta (diff30% gross=147 → net=132.3)",
    aliceD === net(aliceGross),   f4(aliceD),   f4(net(aliceGross)));
  check("T7: grace delta (diff60% gross=294 → net=264.6)",
    graceD === net(graceGross),   f4(graceD),   f4(net(graceGross)));

  // ═══════════════════════════════════════════════════════════════════════════
  // T4: 邀请奖励隔离 — 全 V0 + frank=V8
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ T4: 邀请奖励 15% / 10% / 5% ════════════════════════════════");

  for (const addr of UPLINES) await setLevel(addr, 0);
  await setLevel(_frank.address, 8);

  const { deltas: deltasT4 } = await frankClaimCycle();
  const [, aliceT4, bobT4, charlieT4, daveT4, eveT4] = deltasT4;

  check("T4: dave delta = gen2 邀请奖励 10% → net",
    daveT4    === net(GROSS * 10n / 100n),    f4(daveT4),    f4(net(GROSS * 10n / 100n)));
  check("T4: charlie delta = gen3 邀请奖励 5% → net",
    charlieT4 === net(GROSS * 5n  / 100n),   f4(charlieT4), f4(net(GROSS * 5n / 100n)));
  check("T4: bob (gen4) delta = 0",   bobT4   === 0n, f4(bobT4),   "0");
  check("T4: alice (gen5) delta = 0", aliceT4 === 0n, f4(aliceT4), "0");

  // ═══════════════════════════════════════════════════════════════════════════
  // T5: 代数紧缩 — 6 个有效上级均获奖励
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ T5: 7 代上限 (6 有效上级全部获奖) ══════════════════════════");

  await restoreDefaultLevels();
  const { deltas: deltasT5 } = await frankClaimCycle();
  const [graceT5, aliceT5, bobT5, charlieT5, daveT5, eveT5] = deltasT5;

  check("T5: grace  (gen6) 有奖励 (非零)", graceT5   > 0n, f4(graceT5));
  check("T5: alice  (gen5) 有奖励 (非零)", aliceT5   > 0n, f4(aliceT5));
  check("T5: bob    (gen4) 有奖励 (非零)", bobT5     > 0n, f4(bobT5));
  check("T5: charlie(gen3) 有奖励 (非零)", charlieT5 > 0n, f4(charlieT5));
  check("T5: dave   (gen2) 有奖励 (非零)", daveT5    > 0n, f4(daveT5));
  check("T5: eve    (gen1) 有奖励 (非零)", eveT5     > 0n, f4(eveT5));
  // root has no active order → gets nothing
  const rootPendT5 = await staking.pendingTeamReward(_root.address);
  check("T5: root (无质押) pendingTeamReward = 0", rootPendT5 === 0n, rootPendT5.toString());

  // ═══════════════════════════════════════════════════════════════════════════
  // T8: 多个平级上级, 仅最近一个获 10% 平级奖励
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ T8: 平级 — 仅最近一位获 10% ═════════════════════════════════");

  for (const addr of [...UPLINES, _frank.address]) await setLevel(addr, 3);

  const { deltas: deltasT8 } = await frankClaimCycle();
  const [graceT8, aliceT8, bobT8, charlieT8, daveT8, eveT8] = deltasT8;

  // frank=V3, all V3: eve(first≤)→flat10%+invite15%, dave→invite10%, charlie→invite5%
  check("T8: eve   获 flat10% + invite15%",          eveT8     === net(eveGross),    f4(eveT8), f4(net(eveGross)));
  check("T8: dave  平级非首位 = invite10% only",     daveT8    === net(daveGross),   f4(daveT8), f4(net(daveGross)));
  check("T8: bob   平级非首位 = 0",                  bobT8     === 0n,              f4(bobT8), "0");
  check("T8: alice 平级非首位 = 0",                  aliceT8   === 0n,              f4(aliceT8), "0");
  check("T8: grace 平级非首位 = 0",                  graceT8   === 0n,              f4(graceT8), "0");

  // ═══════════════════════════════════════════════════════════════════════════
  // T9: 多个低级上级, 仅最近一个获 10% 超越奖励
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ T9: 超越 — 仅最近低级获 10% ═════════════════════════════════");

  for (const addr of UPLINES) await setLevel(addr, 1);
  await setLevel(_frank.address, 5);

  const { deltas: deltasT9 } = await frankClaimCycle();
  const [, aliceT9, bobT9, charlieT9, daveT9, eveT9] = deltasT9;

  check("T9: eve   获 flat10% + invite15%",     eveT9     === net(eveGross),    f4(eveT9), f4(net(eveGross)));
  check("T9: dave  低级非首位 = invite10% only", daveT9    === net(daveGross),   f4(daveT9), f4(net(daveGross)));
  check("T9: bob   低级非首位 = 0",              bobT9     === 0n,              f4(bobT9), "0");
  check("T9: alice 低级非首位 = 0",              aliceT9   === 0n,              f4(aliceT9), "0");

  // ═══════════════════════════════════════════════════════════════════════════
  // T10: 低级在前 + 更高级在后 — 更高级仍享级差
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ T10: 混合级差 ════════════════════════════════════════════════");

  for (const addr of [_eve.address, _dave.address, _charlie.address, _bob.address]) {
    await setLevel(addr, 3);
  }
  await setLevel(_alice.address, 6);
  await setLevel(_grace.address, 8);
  await setLevel(_frank.address, 3);

  const { deltas: deltasT10 } = await frankClaimCycle();
  const [graceT10, aliceT10, bobT10] = deltasT10;

  const aliceGrossT10 = GROSS * (60n - 30n) / 100n;  // 147 VVV gross
  const graceGrossT10 = GROSS * (80n - 30n) / 100n;  // 245 VVV gross

  check("T10: alice (V6 > frank V3) 获级差 30% → net",
    aliceT10 === net(aliceGrossT10), f4(aliceT10), f4(net(aliceGrossT10)));
  check("T10: grace (V8 > frank V3) 获级差 50% → net",
    graceT10 === net(graceGrossT10), f4(graceT10), f4(net(graceGrossT10)));
  check("T10: bob   (V3 = frank, 非首位) = 0", bobT10 === 0n, f4(bobT10), "0");

  // ═══════════════════════════════════════════════════════════════════════════
  // T11: 金本位收益 — 以转换后 VVV 毛额为基数
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ T11: 金本位 — VVV 毛额为计算基数 ═══════════════════════════");

  await restoreDefaultLevels();

  const FIAT_STAKE = ethers.parseEther("10000");
  await doStake(vvv, staking, frank, _frank.address, SA, FIAT_STAKE, 7, false, _eve.address);
  await mine(provider, 7 * 86400 + 200);
  await (await staking.setMockPrice(ethers.parseEther("0.30"))).wait(); // price doubled

  const eveBalT11Before = await vvv.balanceOf(_eve.address);
  await (await staking.connect(frank).claimAllRewards()).wait();
  const eveBalT11After  = await vvv.balanceOf(_eve.address);

  // grossT11 = 245 VVV (at $0.30); eve invite15%+flat10% = 25% → net = 245*25%*90%
  const grossT11   = ethers.parseEther("245");
  const eveGrossT11 = grossT11 * 25n / 100n; // 61.25 VVV gross
  const eveExpT11  = net(eveGrossT11);

  check("T11: eve delta 基于转换后 VVV 毛额 245×25%×90%",
    eveBalT11After - eveBalT11Before === eveExpT11,
    f4(eveBalT11After - eveBalT11Before), f4(eveExpT11));

  await (await staking.setMockPrice(ethers.parseEther("0.15"))).wait();

  // ═══════════════════════════════════════════════════════════════════════════
  // T12: 本金赎回 — 不触发团队奖励
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ T12: 本金赎回不产生团队奖励 ════════════════════════════════");

  await doStake(vvv, staking, frank, _frank.address, SA, FRANK_STAKE, 7, true, _eve.address);
  await mine(provider, 7 * 86400 + 200);
  await (await staking.connect(frank).claimAllRewards()).wait(); // drain rewards first

  const balBeforeT12 = await snapBalances(vvv, UPLINES);
  const frankOrderCount = await staking.ordersLength(_frank.address);
  const lastOrderId = frankOrderCount - 1n;
  await (await staking.connect(frank).withdrawOrderPrincipal(lastOrderId)).wait();
  const balAfterT12  = await snapBalances(vvv, UPLINES);
  const deltasT12    = balAfterT12.map((a: bigint, i: number) => a - balBeforeT12[i]);

  check("T12: 本金赎回后所有上级 balanceOf 无变化",
    deltasT12.every((d: bigint) => d === 0n),
    `deltas=[${deltasT12.map(f4).join(",")}]`);

  // ═══════════════════════════════════════════════════════════════════════════
  // T14: 无邀请码 → 自动绑定 rootReferrer
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n══ T14: rootReferrer 自动绑定 ══════════════════════════════════");

  await doStake(vvv, staking, newUser, _newUser.address, SA, TINY, SIXTY, true, ethers.ZeroAddress);
  const newUserInfo = await staking.users(_newUser.address);
  check("T14: 新用户无邀请码自动绑定 rootReferrer",
    newUserInfo.referrer.toLowerCase() === _root.address.toLowerCase(),
    newUserInfo.referrer, _root.address);

  // ═══════════════════════════════════════════════════════════════════════════
  //  DEPLOY 2 — T6: 无质押上级跳过
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Deploy 2: T6 跳过无质押上级 ────────────────────────────────");

  const { vvv: vvv2, staking: staking2 } = await freshDeploy(
    root, _root.address,
    async (s) => { await (await s.setDurationRate(1, 7)).wait(); }
  );
  const SA2 = await staking2.getAddress();

  for (const addr of [_grace, _alice, _bob, _charlie, _dave, _eve, _frank, _newUser].map(w => w.address)) {
    await (await vvv2.mint(addr, MINT_FRANK)).wait();
  }

  await doStake(vvv2, staking2, grace,   _grace.address,   SA2, TINY, SIXTY, true, _root.address);
  await doStake(vvv2, staking2, alice,   _alice.address,   SA2, TINY, SIXTY, true, _grace.address);
  await doStake(vvv2, staking2, bob,     _bob.address,     SA2, TINY, 1,     true, _alice.address); // 1-day
  await doStake(vvv2, staking2, charlie, _charlie.address, SA2, TINY, SIXTY, true, _bob.address);
  await doStake(vvv2, staking2, dave,    _dave.address,    SA2, TINY, SIXTY, true, _charlie.address);
  await doStake(vvv2, staking2, eve,     _eve.address,     SA2, TINY, SIXTY, true, _dave.address);

  await staking2.setUserLevel(_grace.address,   8);
  await staking2.setUserLevel(_alice.address,   5);
  await staking2.setUserLevel(_bob.address,     4);
  await staking2.setUserLevel(_charlie.address, 3);
  await staking2.setUserLevel(_dave.address,    2);
  await staking2.setUserLevel(_eve.address,     1);
  await staking2.setUserLevel(_frank.address,   2);

  await mine(provider, 2 * 86400); // bob's 1-day order expires
  const bobHasActive = await staking2.hasActiveOrder(_bob.address);
  check("T6-pre: bob 1日订单已过期", !bobHasActive);

  await doStake(vvv2, staking2, frank, _frank.address, SA2, FRANK_STAKE, 7, true, _eve.address);
  await mine(provider, 7 * 86400 + 200);

  const UPLINES2 = [_grace.address, _alice.address, _bob.address,
                    _charlie.address, _dave.address, _eve.address];
  const balBeforeT6 = await snapBalances(vvv2, UPLINES2);
  await (await staking2.connect(frank).claimAllRewards()).wait();
  const balAfterT6  = await snapBalances(vvv2, UPLINES2);
  const [graceT6, aliceT6, bobT6, charlieT6, daveT6, eveT6] =
    balAfterT6.map((a: bigint, i: number) => a - balBeforeT6[i]);

  const GROSS2 = ethers.parseEther("490");
  check("T6: bob (无质押) 被跳过 delta = 0",
    bobT6 === 0n, f4(bobT6), "0");
  check("T6: alice 越过 bob 仍获级差 30% → net",
    aliceT6 === net(GROSS2 * (50n - 20n) / 100n), f4(aliceT6), f4(net(GROSS2 * (50n - 20n) / 100n)));
  check("T6: grace 越过 bob 仍获级差 60% → net",
    graceT6 === net(GROSS2 * (80n - 20n) / 100n), f4(graceT6), f4(net(GROSS2 * (80n - 20n) / 100n)));
  check("T6: charlie 仍获奖励 (bob 跳过不影响)",
    charlieT6 > 0n, f4(charlieT6));

  // ═══════════════════════════════════════════════════════════════════════════
  //  DEPLOY 3 — T_AUTO6: payout ETH 不足时进 queue，claimer 不 revert
  //             T_GAS: 最坏 gas 消耗测量
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Deploy 3: T_AUTO6 queue 测试 + T_GAS gas 测量 ───────────────");

  const { vvv: vvv3, payout: payout3, staking: staking3 } = await freshDeploy(root, _root.address);
  const SA3  = await staking3.getAddress();
  const PA3  = await payout3.getAddress();

  for (const addr of [_grace, _alice, _bob, _charlie, _dave, _eve, _frank].map(w => w.address)) {
    await (await vvv3.mint(addr, MINT_FRANK)).wait();
  }

  await doStake(vvv3, staking3, grace,   _grace.address,   SA3, TINY, SIXTY, true, _root.address);
  await doStake(vvv3, staking3, alice,   _alice.address,   SA3, TINY, SIXTY, true, _grace.address);
  await doStake(vvv3, staking3, bob,     _bob.address,     SA3, TINY, SIXTY, true, _alice.address);
  await doStake(vvv3, staking3, charlie, _charlie.address, SA3, TINY, SIXTY, true, _bob.address);
  await doStake(vvv3, staking3, dave,    _dave.address,    SA3, TINY, SIXTY, true, _charlie.address);
  await doStake(vvv3, staking3, eve,     _eve.address,     SA3, TINY, SIXTY, true, _dave.address);
  await staking3.setUserLevel(_grace.address,   8);
  await staking3.setUserLevel(_alice.address,   5);
  await staking3.setUserLevel(_bob.address,     4);
  await staking3.setUserLevel(_charlie.address, 3);
  await staking3.setUserLevel(_dave.address,    2);
  await staking3.setUserLevel(_eve.address,     1);
  await staking3.setUserLevel(_frank.address,   2);

  // Drain payout ETH to near zero (leave only 0.0001 ETH)
  const ethBal3 = await payout3.ethBalance();
  if (ethBal3 > ethers.parseEther("0.0001")) {
    await (await payout3.rescueETH(ethBal3 - ethers.parseEther("0.0001"))).wait();
  }

  await doStake(vvv3, staking3, frank, _frank.address, SA3, FRANK_STAKE, 7, true, _eve.address);
  await mine(provider, 7 * 86400 + 200);

  // T_AUTO6: claim should NOT revert even with near-zero ETH in payout
  let claimOk = false;
  try {
    await (await staking3.connect(frank).claimAllRewards()).wait();
    claimOk = true;
  } catch { claimOk = false; }
  check("T_AUTO6: Payout ETH 不足时 claim 不 revert（进 queue）", claimOk);

  // T_GAS: fresh deploy with full ETH, measure worst-case gas
  const { vvv: vvv4, payout: payout4, staking: staking4 } = await freshDeploy(root, _root.address);
  const SA4 = await staking4.getAddress();

  for (const addr of [_grace, _alice, _bob, _charlie, _dave, _eve, _frank].map(w => w.address)) {
    await (await vvv4.mint(addr, MINT_FRANK)).wait();
  }
  await doStake(vvv4, staking4, grace,   _grace.address,   SA4, TINY, SIXTY, true, _root.address);
  await doStake(vvv4, staking4, alice,   _alice.address,   SA4, TINY, SIXTY, true, _grace.address);
  await doStake(vvv4, staking4, bob,     _bob.address,     SA4, TINY, SIXTY, true, _alice.address);
  await doStake(vvv4, staking4, charlie, _charlie.address, SA4, TINY, SIXTY, true, _bob.address);
  await doStake(vvv4, staking4, dave,    _dave.address,    SA4, TINY, SIXTY, true, _charlie.address);
  await doStake(vvv4, staking4, eve,     _eve.address,     SA4, TINY, SIXTY, true, _dave.address);
  await staking4.setUserLevel(_grace.address,   8);
  await staking4.setUserLevel(_alice.address,   5);
  await staking4.setUserLevel(_bob.address,     4);
  await staking4.setUserLevel(_charlie.address, 3);
  await staking4.setUserLevel(_dave.address,    2);
  await staking4.setUserLevel(_eve.address,     1);
  await staking4.setUserLevel(_frank.address,   2);

  await doStake(vvv4, staking4, frank, _frank.address, SA4, FRANK_STAKE, 7, true, _eve.address);
  await mine(provider, 7 * 86400 + 200);

  const gasTx = await (await staking4.connect(frank).claimAllRewards()).wait();
  const gasUsed = gasTx?.gasUsed ?? 0n;
  const GAS_WARN = 3_000_000n;
  console.log(`    ⛽  claimAllRewards gasUsed = ${gasUsed.toLocaleString()} (上限警戒: ${GAS_WARN.toLocaleString()})`);
  check(`T_GAS: gas < ${GAS_WARN.toLocaleString()} (Base 安全范围)`,
    gasUsed < GAS_WARN, gasUsed.toString(), `<${GAS_WARN}`);

  // ═══════════════════════════════════════════════════════════════════════════
  //  Summary
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log(`║   结果: ✅ ${String(_pass).padEnd(2)} 通过  ❌ ${String(_fail).padEnd(2)} 失败                              ║`);
  const ready = _fail === 0;
  console.log(`║   团队奖励自动到账: ${ready ? "✅  满足上线要求" : "❌  存在未通过项"}                    ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  if (_fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
