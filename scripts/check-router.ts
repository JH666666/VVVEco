import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const p = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const ROUTER = process.env.NEXT_PUBLIC_MOCK_ROUTER!;
  const VVV    = process.env.NEXT_PUBLIC_VVV_TOKEN!;

  const router = new ethers.Contract(ROUTER, [
    "function ethPerVvv() view returns (uint256)",
  ], p);
  const vvv = new ethers.Contract(VVV, ["function balanceOf(address) view returns (uint256)"], p);

  const rate    = await router.ethPerVvv();
  const ethBal  = await p.getBalance(ROUTER);
  const vvvBal  = await vvv.balanceOf(ROUTER);

  console.log(`Router ETH:    ${ethers.formatEther(ethBal)} ETH`);
  console.log(`Router VVV:    ${ethers.formatEther(vvvBal)} VVV`);
  console.log(`ethPerVvv:     ${rate} wei/VVV (${ethers.formatEther(rate)} ETH/VVV)`);

  // 估算：$10 质押 ≈ 67 VVV，需要多少 ETH
  const vvvPer10usd = BigInt(67) * BigInt(1e18);
  const ethNeeded   = vvvPer10usd * rate / BigInt(1e18);
  console.log(`\n$10 质押耗 ETH: ${ethers.formatEther(ethNeeded)} ETH`);
  const remainStakes = ethBal / (ethNeeded > 0n ? ethNeeded : 1n);
  console.log(`剩余可质押次数: ~${remainStakes} 笔`);

  if (remainStakes < 10n) {
    console.log(`\n⚠️  ETH 不足，建议补充至少 0.01 ETH`);
  } else {
    console.log(`\n✓ ETH 充足`);
  }
}
main().catch(console.error);
