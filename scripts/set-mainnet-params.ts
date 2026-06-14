import { ethers, NonceManager } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const RPC          = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const STAKING_ADDR = process.env.NEXT_PUBLIC_VVECO_STAKING ?? "";
const rawKey       = process.env.PRIVATE_KEY ?? "";
const DEPLOYER_KEY = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

function art(name: string) {
  const p = path.join("/Users/jianghu/VVVEco-cursor/VVV_Eco_Project/artifacts/contracts", `${name}.sol/${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  if (!STAKING_ADDR) throw new Error("NEXT_PUBLIC_VVECO_STAKING not set");
  if (!rawKey || rawKey === "your_private_key_here") throw new Error("PRIVATE_KEY not set");

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet   = new ethers.Wallet(DEPLOYER_KEY, provider);
  const signer   = new NonceManager(wallet);
  const staking  = new ethers.Contract(STAKING_ADDR, art("VVVEcoStaking").abi, signer);

  console.log(`Staking: ${STAKING_ADDR}`);
  console.log(`Owner:   ${wallet.address}\n`);

  // 1. 最低质押 $10
  console.log("1. setMinStakeUsd(10 ether) ...");
  await (await staking.setMinStakeUsd(ethers.parseEther("10"))).wait();
  console.log("   ✓ minStakeUsd = 10 USD\n");

  // 2. 清除旧周期 7/15/30/60
  for (const d of [7, 15, 30, 60]) {
    console.log(`2. setDurationRate(${d}, 0) ...`);
    await (await staking.setDurationRate(d, 0)).wait();
    console.log(`   ✓ duration ${d} cleared`);
  }
  console.log();

  // 3. 设置新周期 1/2/3/4 天，rate=10 (per-mille → 1%/day)
  for (const d of [1, 2, 3, 4]) {
    console.log(`3. setDurationRate(${d}, 10) ...`);
    await (await staking.setDurationRate(d, 10)).wait();
    console.log(`   ✓ duration ${d} = 1%/day`);
  }
  console.log();

  // 验证
  console.log("=== Verify ===");
  const minUsd = await staking.minStakeUsd();
  console.log(`minStakeUsd: ${ethers.formatEther(minUsd)} USD`);
  for (const d of [1, 2, 3, 4, 7, 15, 30, 60]) {
    const r = await staking.durationRates(d);
    console.log(`durationRates[${d}]: ${r}`);
  }

  console.log("\n✅ 参数更新完成");
}

main().catch(e => { console.error("❌", e.message ?? e); process.exit(1); });
