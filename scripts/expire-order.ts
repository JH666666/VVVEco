import { ethers, NonceManager } from "ethers";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const RPC = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const STAKING = process.env.NEXT_PUBLIC_VVECO_STAKING ?? "";
const rawKey = process.env.PRIVATE_KEY ?? "";
const DEPLOYER_KEY = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
const abi = JSON.parse(fs.readFileSync("artifacts/contracts/VVVEcoStaking.sol/VVVEcoStaking.json","utf8")).abi;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new NonceManager(new ethers.Wallet(DEPLOYER_KEY, provider));
  const c = new ethers.Contract(STAKING, abi, signer);
  const user = "0x7979DE0d1c1E5fA315902465eE7F2f0C0a42a907";
  const endTime = BigInt(Math.floor(Date.now() / 1000) - 60);
  for (const id of [4, 5]) {
    const tx = await c.setOrderEndTime(user, id, endTime);
    await tx.wait();
    console.log(`✓ orderId=${id} endTime=${new Date(Number(endTime)*1000).toISOString()}`);
  }
}
main().catch(console.error);
