/**
 * 只重新部署 VVVEcoStaking（保留 VVVToken/MockRouter/Treasury/Payout 不变）
 * 用途：合约升级（如新增 claimOrderReward）
 *
 * 运行：npx tsx scripts/redeploy-staking.ts
 */

import { ethers, NonceManager } from "ethers";
import * as fs   from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const RPC = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";

const VVV_TOKEN   = process.env.NEXT_PUBLIC_VVV_TOKEN   ?? "";
const TREASURY    = process.env.NEXT_PUBLIC_VVECO_TREASURY ?? "";
const PAYOUT      = process.env.NEXT_PUBLIC_VVECO_PAYOUT   ?? "";
const ROOT_ADDR   = process.env.NEXT_PUBLIC_ROOT_REFERRER_ADDRESS ?? "";

const rawKey = process.env.PRIVATE_KEY ?? "";
if (!rawKey || rawKey.length < 32) {
  console.error("❌  PRIVATE_KEY 未设置"); process.exit(1);
}
const DEPLOYER_KEY = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

function art(name: string) {
  const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VVVEcoStaking — 重新部署（保留其他合约）");
  console.log("═══════════════════════════════════════════════════════════════");

  const provider  = new ethers.JsonRpcProvider(RPC);
  const _wallet   = new ethers.Wallet(DEPLOYER_KEY, provider);
  const deployer  = new NonceManager(_wallet);
  const addr      = _wallet.address;

  const bal = await provider.getBalance(addr);
  console.log(`  Deployer : ${addr}`);
  console.log(`  ETH bal  : ${ethers.formatEther(bal)} ETH`);
  if (bal < ethers.parseEther("0.005")) {
    console.error("❌  余额不足 0.005 ETH"); process.exit(1);
  }

  const network = await provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error(`❌  chainId=${network.chainId}，期望 84532`); process.exit(1);
  }

  // ── 部署新 VVVEcoStaking ─────────────────────────────────────────────────
  console.log("\n  部署 VVVEcoStaking ...");
  const { abi, bytecode } = art("VVVEcoStaking");
  const factory   = new ethers.ContractFactory(abi, bytecode, deployer);
  const staking   = await factory.deploy(VVV_TOKEN, TREASURY, PAYOUT);
  await staking.waitForDeployment();
  const newStakingAddr = await staking.getAddress();
  console.log(`  ✓ VVVEcoStaking  : ${newStakingAddr}`);

  // ── 配置：durationRates ──────────────────────────────────────────────────
  for (const [dur, rate] of [[7, 7], [15, 8], [30, 9], [60, 10]] as const) {
    await (await (staking as ethers.Contract).setDurationRate(dur, rate)).wait();
  }
  console.log("  ✓ durationRates  : 7→7, 15→8, 30→9, 60→10");

  // ── 配置：rootReferrer ───────────────────────────────────────────────────
  if (ROOT_ADDR && ROOT_ADDR !== ethers.ZeroAddress) {
    await (await (staking as ethers.Contract).setRootReferrer(ROOT_ADDR)).wait();
    console.log(`  ✓ rootReferrer   : ${ROOT_ADDR}`);
  }

  // ── 更新 Treasury.setStakingContract ────────────────────────────────────
  const { abi: tAbi } = art("VVVTreasury");
  const treasury = new ethers.Contract(TREASURY, tAbi, deployer);
  await (await treasury.setStakingContract(newStakingAddr)).wait();
  console.log(`  ✓ Treasury.setStakingContract → ${newStakingAddr}`);

  // ── 更新 Payout.setStakingContract ──────────────────────────────────────
  const { abi: pAbi } = art("VVVPayout");
  const payout = new ethers.Contract(PAYOUT, pAbi, deployer);
  await (await payout.setStakingContract(newStakingAddr)).wait();
  console.log(`  ✓ Payout.setStakingContract  → ${newStakingAddr}`);

  // ── 输出 ─────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  ✅  重新部署完成");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`
⚠️  请将以下内容更新到 .env.local:

NEXT_PUBLIC_VVECO_STAKING=${newStakingAddr}

完成后重新 build: npm run build
`);
}

main().catch(e => {
  console.error("❌  失败:", e.message ?? e);
  process.exit(1);
});
