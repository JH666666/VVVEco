/**
 * seed-v2-db.ts  —  VVVEco V2 数据库完整初始化
 *
 * 用途：fresh DB 或旧 V1 DB 均可执行，幂等。
 * Run:  DATABASE_URL="file:./prisma/prod.db" npx tsx scripts/seed-v2-db.ts
 */
import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("═══════════════════ VVVEco V2 DB Seed ═══════════════════\n");

  // ── 1. RewardConfig ────────────────────────────────────────────────────────
  const reward = await prisma.rewardConfig.upsert({
    where: { id: 1 },
    update: {
      generationRates: "10,5,3",
      periodRates:     "0.7,0.8,0.9,1.0",
      periodDurations: "1,15,30,60",
      periodUnits:     "day,day,day,day",
    },
    create: {
      id: 1,
      generationRates: "10,5,3",
      periodRates:     "0.7,0.8,0.9,1.0",
      periodDurations: "1,15,30,60",
      periodUnits:     "day,day,day,day",
    },
  });
  console.log("✅  reward_config:");
  console.log(`    generationRates = ${reward.generationRates}  (gen1=10% gen2=5% gen3=3%)`);
  console.log(`    periodDurations = ${reward.periodDurations}  (1/15/30/60 days)`);
  console.log(`    periodRates     = ${reward.periodRates}  (%/day)`);

  // ── 2. ContractConfig ──────────────────────────────────────────────────────
  const contract = await prisma.contractConfig.upsert({
    where: { id: 1 },
    update: {
      stakingContract:     "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64",
      payoutContract:      "0x35FAac6Da16345A51437dE4b9a9D0571418fCA36",
      vvvToken:            "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf",
      priceRouter:         "0x00A039F168B8B444175fC3bDdc1F3CA52e79a0fD",
      projectWallet:       "0xa8c9118d6cf6164EBDC2aB99F19A9B36F599f191",
      feeWallet:           "0xb32134EA32276dD8cB7Ec689958d8cb9BaD60506",
      feePercent:          10,
      rootReferrerAddress: "0x58940A90bc63E72F7F69ad62CA5C776D696b3F5e",
    },
    create: {
      id: 1,
      stakingContract:     "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64",
      payoutContract:      "0x35FAac6Da16345A51437dE4b9a9D0571418fCA36",
      vvvToken:            "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf",
      priceRouter:         "0x00A039F168B8B444175fC3bDdc1F3CA52e79a0fD",
      projectWallet:       "0xa8c9118d6cf6164EBDC2aB99F19A9B36F599f191",
      feeWallet:           "0xb32134EA32276dD8cB7Ec689958d8cb9BaD60506",
      feePercent:          10,
      rootReferrerAddress: "0x58940A90bc63E72F7F69ad62CA5C776D696b3F5e",
    },
  });
  console.log("\n✅  contract_config:");
  console.log(`    stakingContract     = ${contract.stakingContract}`);
  console.log(`    payoutContract      = ${contract.payoutContract}`);
  console.log(`    vvvToken            = ${contract.vvvToken}`);
  console.log(`    rootReferrerAddress = ${contract.rootReferrerAddress}`);
  console.log(`    projectWallet       = ${contract.projectWallet}`);
  console.log(`    feeWallet           = ${contract.feeWallet}`);

  // ── 3. Root User (uid=100000) ──────────────────────────────────────────────
  const V2_ROOT = "0x58940a90bc63e72f7f69ad62ca5c776d696b3f5e";
  const existingRoot = await prisma.user.findFirst({ where: { uid: 100000 } });
  if (!existingRoot) {
    await prisma.user.create({
      data: { walletAddress: V2_ROOT, uid: 100000, inviteCode: "VVVROOT0", referrerAddress: null },
    });
    console.log("\n✅  root user created:", V2_ROOT);
  } else if (existingRoot.walletAddress !== V2_ROOT) {
    await prisma.user.update({ where: { uid: 100000 }, data: { walletAddress: V2_ROOT } });
    console.log(`\n✅  root user migrated: ${existingRoot.walletAddress} → ${V2_ROOT}`);
  } else {
    console.log("\n✅  root user already correct:", V2_ROOT);
  }

  console.log("\n═══════════════════ Seed Complete ════════════════════════\n");
}

main()
  .catch(e => { console.error("❌  Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect().catch(() => {}));
