import { ethers } from "ethers";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const RPC = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const STAKING = process.env.NEXT_PUBLIC_VVECO_STAKING ?? "";
const abi = JSON.parse(fs.readFileSync("artifacts/contracts/VVVEcoStaking.sol/VVVEcoStaking.json","utf8")).abi;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const c = new ethers.Contract(STAKING, abi, provider);
  const user = "0x7979DE0d1c1E5fA315902465eE7F2f0C0a42a907";
  // Try orderId 0,1,2,3
  for (let i = 0; i < 4; i++) {
    try {
      const o = await c.userOrders(user, i);
      console.log(`orderId=${i} isCoinBased=${o.isCoinBased} endTime=${new Date(Number(o.endTime)*1000).toISOString()} withdrawn=${o.isWithdrawn}`);
    } catch { break; }
  }
}
main().catch(console.error);
