import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const PAYOUT_ADDR  = "0xc9102200271245660AB1C640CEB502936BDe04E1";
const STAKING_ADDR = "0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34";
const RPC          = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const PRIVATE_KEY  = process.env.PRIVATE_KEY ?? "";

const PAYOUT_ABI = [
  "function stakingContract() view returns (address)",
  "function setStakingContract(address _staking) external",
];

async function main() {
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");

  const provider = new ethers.JsonRpcProvider(RPC);
  const signer   = new ethers.Wallet(`0x${PRIVATE_KEY.replace(/^0x/, "")}`, provider);
  console.log("Signer:", signer.address);

  const payout = new ethers.Contract(PAYOUT_ADDR, PAYOUT_ABI, signer);

  const before: string = await payout.stakingContract();
  console.log("stakingContract (before):", before);

  if (before.toLowerCase() === STAKING_ADDR.toLowerCase()) {
    console.log("Already correct, no action needed.");
    return;
  }

  console.log("Calling setStakingContract...");
  const tx = await payout.setStakingContract(STAKING_ADDR);
  console.log("Tx hash:", tx.hash);
  await tx.wait();
  console.log("Confirmed.");

  const after: string = await payout.stakingContract();
  console.log("stakingContract (after):", after);

  if (after.toLowerCase() === STAKING_ADDR.toLowerCase()) {
    console.log("✅ Fix applied successfully.");
  } else {
    console.log("❌ Unexpected value after update:", after);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
