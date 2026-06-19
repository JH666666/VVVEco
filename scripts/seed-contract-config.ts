/**
 * seed-contract-config.ts  —  V2 合约配置初始化
 * Run: npx tsx scripts/seed-contract-config.ts
 */
import { prisma } from "../lib/prisma.js";

async function main() {
  const result = await prisma.contractConfig.upsert({
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
  console.log("✅  contractConfig (V2) updated:");
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
