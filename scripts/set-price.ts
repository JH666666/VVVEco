import { ethers, NonceManager } from "ethers";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const RPC = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const STAKING = process.env.NEXT_PUBLIC_VVECO_STAKING ?? "";
const rawKey = process.env.PRIVATE_KEY ?? "";
const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
const abi = JSON.parse(fs.readFileSync("artifacts/contracts/VVVEcoStaking.sol/VVVEcoStaking.json","utf8")).abi;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new NonceManager(new ethers.Wallet(key, provider));
  const c = new ethers.Contract(STAKING, abi, signer);
  const before = await c.getLatestPrice();
  console.log("before:", ethers.formatEther(before));
  const newPrice = ethers.parseEther("0.2");
  const tx = await c.setMockPrice(newPrice);
  console.log("tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("status:", receipt.status);
  const after = await c.getLatestPrice();
  console.log("after:", ethers.formatEther(after), "USD/VVV");
}
main().catch(console.error);
