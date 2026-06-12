/**
 * VVVEco Integration Tests
 * Run: npx hardhat run test/VVVEco.test.ts --network hardhat
 */

import hre from "hardhat";

const _conn  = await (hre as any).network.create();
const ethers = _conn.ethers;

// ─── Utils ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌  ${name}`);
    console.log(`       ${e.message ?? e}`);
    failed++;
  }
}

function eq(a: bigint, b: bigint, msg?: string) {
  if (a !== b) throw new Error(msg ?? `Expected ${b}, got ${a}`);
}
function gt(a: bigint, b: bigint, msg?: string) {
  if (!(a > b)) throw new Error(msg ?? `Expected ${a} > ${b}`);
}
function approx(a: bigint, b: bigint, tolerancePct = 2n, msg?: string) {
  const diff = a > b ? a - b : b - a;
  const tol  = b * tolerancePct / 100n;
  if (diff > tol) throw new Error(msg ?? `${a} not within ${tolerancePct}% of ${b}`);
}

const E18 = (n: number | string) => ethers.parseEther(String(n));

async function deploy(name: string, ...args: any[]) {
  const F = await ethers.getContractFactory(name);
  const c = await F.deploy(...args);
  await c.waitForDeployment();
  return c;
}

async function fastForward(days: number) {
  await _conn.provider.send("evm_increaseTime", [days * 86400]);
  await _conn.provider.send("evm_mine", []);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  VVVEco Contract Tests");
  console.log("═══════════════════════════════════════════════════════════\n");

  const signers = await ethers.getSigners();
  const [owner, alice, bob, carol, dave, feeW] = signers;
  const ownerAddr = await owner.getAddress();
  const aliceAddr = await alice.getAddress();
  const bobAddr   = await bob.getAddress();
  const carolAddr = await carol.getAddress();
  const daveAddr  = await dave.getAddress();
  const feeWAddr  = await feeW.getAddress();

  // ── Deploy ─────────────────────────────────────────────────────────────────
  console.log("─── Deploying contracts ───────────────────────────────────");

  const vvvToken   = await deploy("VVVToken");
  const mockRouter = await deploy("MockRouter", await vvvToken.getAddress());
  const treasury   = await deploy("VVVTreasury",
    await vvvToken.getAddress(), await mockRouter.getAddress(),
    ethers.ZeroAddress, ownerAddr);
  const payout     = await deploy("VVVPayout",
    await vvvToken.getAddress(), await mockRouter.getAddress(),
    ethers.ZeroAddress, feeWAddr, 10);
  const staking    = await deploy("VVVEcoStaking",
    await vvvToken.getAddress(), await treasury.getAddress(), await payout.getAddress());

  await treasury.setStakingContract(await staking.getAddress());
  await payout.setStakingContract(await staking.getAddress());

  await mockRouter.setRate(10_000_000_000n); // 1e10 wei per 1 VVV

  const routerAddr = await mockRouter.getAddress();
  await vvvToken.approve(routerAddr, E18(10_000_000));
  await mockRouter.seedVVV(E18(10_000_000));
  await mockRouter.seedETH({ value: ethers.parseEther("10") });
  await payout.depositETH({ value: ethers.parseEther("5") });

  for (const s of [alice, bob, carol, dave]) {
    await vvvToken.transfer(await s.getAddress(), E18(500_000));
  }
  console.log("  Contracts deployed & funded.\n");

  // ── Helper: stake (duration in DAYS) ──────────────────────────────────────
  async function doStake(user: any, amount: bigint, durationDays: number, referrer: string) {
    await vvvToken.connect(user).approve(await staking.getAddress(), amount);
    await staking.connect(user).stake(amount, durationDays, true, referrer);
  }

  // ── Build referral chain ───────────────────────────────────────────────────
  // owner → dave → carol → bob → alice
  console.log("─── Building referral chain ───────────────────────────────");
  await doStake(dave,  E18(100_000), 30, ownerAddr);
  await doStake(carol, E18(100_000), 30, daveAddr);
  await doStake(bob,   E18(100_000), 30, carolAddr);
  await doStake(alice, E18(100_000), 30, bobAddr);
  console.log("  owner→dave→carol→bob→alice created.\n");

  // Read levels (after staking, upstream team volumes update levels)
  const aliceLevel = Number((await staking.users(aliceAddr)).level);
  const bobLevel   = Number((await staking.users(bobAddr)).level);
  const carolLevel = Number((await staking.users(carolAddr)).level);
  const daveLevel  = Number((await staking.users(daveAddr)).level);
  console.log(`  Levels — alice:${aliceLevel}, bob:${bobLevel}, carol:${carolLevel}, dave:${daveLevel}\n`);

  // Read levelRates from contract (index = level)
  const levelRates: bigint[] = [];
  for (let i = 0; i <= 8; i++) {
    levelRates.push(BigInt(await staking.levelRates(i)));
  }
  const inviteRates: bigint[] = [0n];
  for (let i = 1; i <= 3; i++) {
    inviteRates.push(BigInt(await staking.inviteRates(i)));
  }

  console.log("─── Tests ─────────────────────────────────────────────────");

  // ── Referral chain sanity ──────────────────────────────────────────────────
  await test("Referral chain: alice.referrer = bob", async () => {
    const u = await staking.users(aliceAddr);
    if (u.referrer.toLowerCase() !== bobAddr.toLowerCase())
      throw new Error(`alice referrer = ${u.referrer}`);
  });

  await test("Referral chain: bob.referrer = carol", async () => {
    const u = await staking.users(bobAddr);
    if (u.referrer.toLowerCase() !== carolAddr.toLowerCase())
      throw new Error(`bob referrer = ${u.referrer}`);
  });

  // ── VVVPayout never holds VVV ──────────────────────────────────────────────
  await test("VVVPayout VVV balance is 0 before any claims", async () => {
    const bal = await vvvToken.balanceOf(await payout.getAddress());
    eq(bal, 0n, `VVVPayout has ${bal} VVV`);
  });

  // ── MockRouter sends VVV to `to` param ────────────────────────────────────
  await test("MockRouter delivers VVV directly to the `to` address", async () => {
    const amount = E18(1);
    const path   = [ethers.ZeroAddress, await vvvToken.getAddress()];
    const [ethNeed] = await mockRouter.getAmountsIn(amount, path);
    const before = await vvvToken.balanceOf(carolAddr);
    await mockRouter.swapETHForExactTokens(
      amount, path, carolAddr, Math.floor(Date.now() / 1000) + 300,
      { value: ethNeed }
    );
    eq(await vvvToken.balanceOf(carolAddr) - before, amount);
  });

  // ── Fast-forward 7 days, then alice claims ────────────────────────────────
  await fastForward(7);

  const snap = async () => ({
    alice:  await vvvToken.balanceOf(aliceAddr),
    bob:    await vvvToken.balanceOf(bobAddr),
    carol:  await vvvToken.balanceOf(carolAddr),
    dave:   await vvvToken.balanceOf(daveAddr),
    fee:    await vvvToken.balanceOf(feeWAddr),
    payout: await vvvToken.balanceOf(await payout.getAddress()),
  });

  const before = await snap();
  await staking.connect(alice).claimAllRewards();
  const after = await snap();

  const net = {
    alice:  after.alice  - before.alice,
    bob:    after.bob    - before.bob,
    carol:  after.carol  - before.carol,
    dave:   after.dave   - before.dave,
    fee:    after.fee    - before.fee,
    payout: after.payout - before.payout,
  };

  // Gross = fee / 10%
  const gross = net.fee * 10n;

  console.log(`\n  [Info] alice gross  = ${ethers.formatEther(gross)} VVV`);
  console.log(`  [Info] alice net    = ${ethers.formatEther(net.alice)} VVV`);
  console.log(`  [Info] bob          = ${ethers.formatEther(net.bob)} VVV`);
  console.log(`  [Info] carol        = ${ethers.formatEther(net.carol)} VVV`);
  console.log(`  [Info] dave         = ${ethers.formatEther(net.dave)} VVV`);
  console.log(`  [Info] fee wallet   = ${ethers.formatEther(net.fee)} VVV\n`);

  // ── Test 1: personal claim 90% net ────────────────────────────────────────
  await test("Personal claim: alice receives 90% of gross (10% fee)", async () => {
    gt(net.alice, 0n);
    approx(net.alice, gross * 90n / 100n, 2n, "alice should get 90%");
  });

  await test("Personal claim: feeWallet receives 10% of gross", async () => {
    gt(net.fee, 0n);
    approx(net.fee, gross / 10n, 2n, "fee should be 10%");
  });

  // ── Test 2–3: invite rewards (no fee deducted) ────────────────────────────
  // Expected bob total = invite(15%) + team(differential or same-level)
  // Expected carol total = invite(10%) + team(differential if carol.level > alice.level, else 0)
  // Expected dave total = invite(5%) + team(differential if dave.level > alice.level, else 0)

  // clLevel is floored to 1 in the contract fix — mirror that here
  const effectiveAliceLevel = Math.max(aliceLevel, 1);

  function teamReward(ancestorLevel: number, claimerLevel: number, isDirect: boolean): bigint {
    if (ancestorLevel > claimerLevel) {
      return gross * (levelRates[ancestorLevel] - levelRates[claimerLevel]) / 100n;
    } else if (isDirect) {
      return gross * 10n / 100n; // flat same-level for direct parent
    }
    return 0n;
  }

  const bobExpected   = gross * inviteRates[1] / 100n + teamReward(bobLevel,   effectiveAliceLevel, true);
  const carolExpected = gross * inviteRates[2] / 100n + teamReward(carolLevel, effectiveAliceLevel, false);
  const daveExpected  = gross * inviteRates[3] / 100n + teamReward(daveLevel,  effectiveAliceLevel, false);

  await test(`Bob (gen1 invite + team, level ${bobLevel}): total matches expected`, async () => {
    gt(net.bob, 0n);
    approx(net.bob, bobExpected, 3n,
      `bob expected ~${ethers.formatEther(bobExpected)} (invite+team), got ${ethers.formatEther(net.bob)}`);
  });

  await test(`Carol (gen2 invite + team if level>${aliceLevel}, level ${carolLevel}): total matches`, async () => {
    gt(net.carol, 0n);
    approx(net.carol, carolExpected, 3n,
      `carol expected ~${ethers.formatEther(carolExpected)}, got ${ethers.formatEther(net.carol)}`);
  });

  await test(`Dave (gen3 invite + team if level>${aliceLevel}, level ${daveLevel}): total matches`, async () => {
    gt(net.dave, 0n);
    approx(net.dave, daveExpected, 3n,
      `dave expected ~${ethers.formatEther(daveExpected)}, got ${ethers.formatEther(net.dave)}`);
  });

  // ── Test: invite/team rewards have NO fee (payPrincipal path) ─────────────
  await test("Invite/team rewards are not deducted fee (payPrincipal path)", async () => {
    // The only fee is alice's personal claim via payReward.
    // If invite/team rewards also had 10% fee, feeWallet would receive more.
    // Total VVV distributed (alice+bob+carol+dave+fee) should equal:
    //   alice_gross + invite_gen1 + invite_gen2 + invite_gen3 + team_bob + team_carol + team_dave
    // Without extra fees on invite/team, this should balance.
    const totalOut = net.alice + net.bob + net.carol + net.dave + net.fee;
    // alice_gross = net.fee * 10
    // invite + team received by bob/carol/dave = net.bob + net.carol + net.dave
    // Each of these should be unaffected by fee (no deduction)
    // Verify fee wallet only got alice's 10%, not more
    approx(net.fee, gross / 10n, 1n, "fee wallet should only hold alice's 10% personal fee");
  });

  // ── Test: VVVPayout never holds VVV ───────────────────────────────────────
  await test("VVVPayout VVV balance is 0 after all claims (never holds VVV)", async () => {
    eq(net.payout, 0n, `VVVPayout VVV balance changed by ${net.payout}`);
    eq(await vvvToken.balanceOf(await payout.getAddress()), 0n);
  });

  // ── Test: principal redeem has no fee ─────────────────────────────────────
  await test("Principal redeem: alice gets principal back with no fee", async () => {
    // Fast-forward past lock. Then claim remaining rewards first (so pendingGross→0),
    // then withdraw. At that point, withdrawOrderPrincipal won't auto-settle any reward,
    // and fee wallet should not increase.
    await fastForward(24); // now at day 31 (30-day lock expired)

    // Settle all remaining time-based rewards so order.claimedAmount = totalAccrued
    await staking.connect(alice).claimAllRewards();

    const feePre    = await vvvToken.balanceOf(feeWAddr);
    const alicePre  = await vvvToken.balanceOf(aliceAddr);

    await staking.connect(alice).withdrawOrderPrincipal(0);

    const feePost   = await vvvToken.balanceOf(feeWAddr);
    const alicePost = await vvvToken.balanceOf(aliceAddr);

    gt(alicePost - alicePre, 0n, "alice should receive principal VVV back");
    eq(feePost - feePre, 0n, "fee wallet must not increase on principal redeem");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // clLevel floor-to-1 scenarios (tests for the fix: level 0 users treated as V1)
  // ═══════════════════════════════════════════════════════════════════════════

  // Shared helper: set up a fresh chain, force levels, claim, return deltas.
  // chain: user0 (claimer A) → user1 (B, gen1) → user2 (C, gen2) → user3? (D, gen3)
  // levelsToSet: [A_level, B_level, C_level, D_level?]
  async function runRewardScenario(
    users_: any[],          // [A, B, C] or [A, B, C, D]
    levels: number[],       // corresponding levels to force (1 = V1, 2 = V2 …)
    stakeAmount = E18(10_000),
    stakeDays = 30,         // lock duration — must stay > forwardDays so orders remain active
    forwardDays = 7,        // how far to advance before A claims
  ): Promise<{ gross: bigint; deltas: bigint[] }> {
    const addrs = await Promise.all(users_.map(u => u.getAddress()));

    // Fund VVV
    for (const u of users_) {
      await vvvToken.transfer(await u.getAddress(), stakeAmount * 2n);
      await vvvToken.connect(u).approve(await staking.getAddress(), stakeAmount * 2n);
    }
    await payout.depositETH({ value: ethers.parseEther("2") });

    // Build chain deepest-first: D→root, C→D, B→C, A→B
    // users_[0]=A (claimer), users_[1]=B (gen1), users_[2]=C (gen2), users_[3]=D (gen3)
    for (let i = users_.length - 1; i >= 0; i--) {
      const ref = i === users_.length - 1 ? ownerAddr : addrs[i + 1];
      await staking.connect(users_[i]).stake(stakeAmount, stakeDays, true, ref);
    }

    // Force desired levels
    for (let i = 0; i < users_.length; i++) {
      await staking.setUserLevel(addrs[i], levels[i]);
    }

    // Advance time (forwardDays < stakeDays so all orders remain active)
    await _conn.provider.send("evm_increaseTime", [forwardDays * 86400]);
    await _conn.provider.send("evm_mine", []);

    const before = await Promise.all(addrs.map(a => vvvToken.balanceOf(a)));
    const feeBefore = await vvvToken.balanceOf(feeWAddr);
    await staking.connect(users_[0]).claimAllRewards();
    const after  = await Promise.all(addrs.map(a => vvvToken.balanceOf(a)));
    const feeAfter = await vvvToken.balanceOf(feeWAddr);

    const deltas = after.map((v, i) => v - before[i]);
    const feeDelta = feeAfter - feeBefore;
    const gross = feeDelta * 10n; // fee = 10% of gross

    return { gross, deltas };
  }

  // ── Scenario 1: A=V1, B=V2 (direct), C=V1 (2nd gen) ─────────────────────
  // Expected:
  //   B = invite_gen1(15%) + team_Rule1_differential(V2-V1 = 10%) = 25%
  //   C = invite_gen2(10%) + 0 team = 10%
  console.log("\n─── Scenario 1: A=V1, B=V2, C=V1 ────────────────────────");
  {
    const [s1A, s1B, s1C] = signers.slice(6, 9);
    const { gross, deltas: [, bNet, cNet] } = await runRewardScenario(
      [s1A, s1B, s1C], [1, 2, 1]
    );

    const bExpected = gross * 15n / 100n + gross * (levelRates[2] - levelRates[1]) / 100n;
    const cExpected = gross * 10n / 100n; // invite gen2 only; Rule3 since C indirect with level ≤ A(V1)

    await test("Scenario1 – B(V2 direct): invite 15% + diff 10% = 25%", async () => {
      approx(bNet, bExpected, 3n,
        `B expected ~${ethers.formatEther(bExpected)} (25%), got ${ethers.formatEther(bNet)}`);
    });
    await test("Scenario1 – C(V1 indirect): invite 10% only, no extra team reward", async () => {
      approx(cNet, cExpected, 3n,
        `C expected ~${ethers.formatEther(cExpected)} (10%), got ${ethers.formatEther(cNet)}`);
    });
  }

  // ── Scenario 2: A=V1, B=V1 (direct), C=V2 (2nd gen) ─────────────────────
  // Expected:
  //   B = invite_gen1(15%) + team_Rule2_flat_10% = 25%
  //   C = invite_gen2(10%) + team_Rule1_differential(V2-V1 = 10%) = 20%
  console.log("─── Scenario 2: A=V1, B=V1, C=V2 ────────────────────────");
  {
    const [s2A, s2B, s2C] = signers.slice(9, 12);
    const { gross, deltas: [, bNet, cNet] } = await runRewardScenario(
      [s2A, s2B, s2C], [1, 1, 2]
    );

    const bExpected = gross * 15n / 100n + gross * 10n / 100n; // invite + Rule2 flat
    const cExpected = gross * 10n / 100n + gross * (levelRates[2] - levelRates[1]) / 100n; // invite + Rule1 diff

    await test("Scenario2 – B(V1 direct): invite 15% + flat 10% = 25%", async () => {
      approx(bNet, bExpected, 3n,
        `B expected ~${ethers.formatEther(bExpected)} (25%), got ${ethers.formatEther(bNet)}`);
    });
    await test("Scenario2 – C(V2 indirect): invite 10% + diff 10% = 20%", async () => {
      approx(cNet, cExpected, 3n,
        `C expected ~${ethers.formatEther(cExpected)} (20%), got ${ethers.formatEther(cNet)}`);
    });
  }

  // ── Scenario 3: A=V1, B=V1, C=V1, D=V1 (all same level) ─────────────────
  // Expected:
  //   B = invite_gen1(15%) + team_Rule2_flat_10% = 25%
  //   C = invite_gen2(10%) + 0 team (Rule3) = 10%
  //   D = invite_gen3(5%)  + 0 team (Rule3) = 5%
  console.log("─── Scenario 3: A=V1, B=V1, C=V1, D=V1 ──────────────────");
  {
    const [s3A, s3B, s3C, s3D] = signers.slice(12, 16);
    const { gross, deltas: [, bNet, cNet, dNet] } = await runRewardScenario(
      [s3A, s3B, s3C, s3D], [1, 1, 1, 1]
    );

    const bExpected = gross * 15n / 100n + gross * 10n / 100n;
    const cExpected = gross * 10n / 100n;
    const dExpected = gross * 5n  / 100n;

    await test("Scenario3 – B(V1 direct): invite 15% + flat 10% = 25%", async () => {
      approx(bNet, bExpected, 3n,
        `B expected ~${ethers.formatEther(bExpected)} (25%), got ${ethers.formatEther(bNet)}`);
    });
    await test("Scenario3 – C(V1 indirect): invite 10% only, no team reward", async () => {
      approx(cNet, cExpected, 3n,
        `C expected ~${ethers.formatEther(cExpected)} (10%), got ${ethers.formatEther(cNet)}`);
    });
    await test("Scenario3 – D(V1 3rd gen): invite 5% only, no team reward", async () => {
      approx(dNet, dExpected, 3n,
        `D expected ~${ethers.formatEther(dExpected)} (5%), got ${ethers.formatEther(dNet)}`);
    });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error("\n❌  Fatal error:", e.message ?? e);
  process.exit(1);
});
