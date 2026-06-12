import { prisma } from "../lib/prisma.js";

async function main() {
  const result = await prisma.contractConfig.upsert({
    where: { id: 1 },
    update: {
      stakingContract:     "0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34",
      payoutContract:      "0xc9102200271245660AB1C640CEB502936BDe04E1",
      vvvToken:            "0x058811Fb2E8824214aBF13C3515e59ae921F32b8",
      priceRouter:         "0xF354f1c63Dc284d0D70e8c72F563Ffa5c7Bf0fB8",
      projectWallet:       "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3",
      feeWallet:           "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3",
      feePercent:          10,
      rootReferrerAddress: "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3",
    },
    create: {
      id: 1,
      stakingContract:     "0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34",
      payoutContract:      "0xc9102200271245660AB1C640CEB502936BDe04E1",
      vvvToken:            "0x058811Fb2E8824214aBF13C3515e59ae921F32b8",
      priceRouter:         "0xF354f1c63Dc284d0D70e8c72F563Ffa5c7Bf0fB8",
      projectWallet:       "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3",
      feeWallet:           "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3",
      feePercent:          10,
      rootReferrerAddress: "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3",
    },
  });
  console.log("✅ contractConfig updated:");
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
