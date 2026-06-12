import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const RPC = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const TEAM_TOPIC = "0xe07f61c526a4ace6d1e5cad0a84eddbf8e2733ce8383b0b2f1d76f07fb1cab49";
const TX = "0x27eab187e2eb288f1c594f9b913bd5ed217af8d2d269f9a3a6f4bb9fa41cf61e";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const receipt = await provider.getTransactionReceipt(TX);
  if (!receipt) { console.log("receipt not found"); return; }
  const teamLogs = receipt.logs.filter(l => l.topics[0]?.toLowerCase() === TEAM_TOPIC);
  console.log("TeamRewardAccrued events:", teamLogs.length);
  let total = 0n;
  teamLogs.forEach((l, i) => {
    const recipient = "0x" + l.topics[1]?.slice(-40);
    const bonus = BigInt(l.data);
    total += bonus;
    console.log(`  [${i}] ${recipient.slice(0,10)}... bonus=${ethers.formatEther(bonus)} VVV`);
  });
  console.log("total paid out:", ethers.formatEther(total), "VVV");
}
main().catch(console.error);
