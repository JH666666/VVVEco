import { ethers, NonceManager } from "ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const p      = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const rawKey = (process.env.PRIVATE_KEY ?? "").replace(/"/g, "");
  const key    = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  const signer = new NonceManager(new ethers.Wallet(key, p));
  const ROUTER = process.env.NEXT_PUBLIC_MOCK_ROUTER!;

  const router = new ethers.Contract(ROUTER, ["function seedETH() external payable"], signer);

  const before = await p.getBalance(ROUTER);
  console.log(`补充前 Router ETH: ${ethers.formatEther(before)}`);

  const tx = await router.seedETH({ value: ethers.parseEther("0.005") });
  await tx.wait();

  const after = await p.getBalance(ROUTER);
  console.log(`补充后 Router ETH: ${ethers.formatEther(after)}`);
  console.log("✓ 完成");
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
