/**
 * scripts/redeploy-adapter.ts
 *
 * 只重新部署 AerodromeAdapter（修复 getAmountsIn），并将 VVVPayout + VVVTreasury 的
 * router 指向新地址。不动 Staking / Payout / Treasury 合约本身。
 *
 * 前提：
 *   .env 中有 PRIVATE_KEY（owner 私钥）
 *   BASE_MAINNET_RPC 已设置
 *
 * 运行：
 *   npx tsx scripts/redeploy-adapter.ts
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

// ── Mainnet constants ─────────────────────────────────────────────────────────
const CHAIN_ID    = 8453n;
const AERO_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
const VVV_TOKEN   = "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf";
const WETH        = "0x4200000000000000000000000000000000000006";
const AERO_FACTORY= "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";
const STABLE      = false;
const OWNER       = "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3";

// Deployed Payout + Treasury (unchanged)
const PAYOUT_ADDR   = "0xc9102200271245660AB1C640CEB502936BDe04E1";
const TREASURY_ADDR = "0xA223C9e22532a7d985004fe3714AB3D873F4c3a2";

// ── Helpers ───────────────────────────────────────────────────────────────────
function art(name: string) {
  const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  if (!fs.existsSync(p)) {
    console.error(`\n❌  Artifact not found: ${p}\n    先运行: npx hardhat compile`);
    process.exit(1);
  }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi as ethers.InterfaceAbi, bytecode: j.bytecode as string };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const rawKey = process.env.PRIVATE_KEY ?? "";
  if (!rawKey || rawKey.length < 32) {
    console.error("❌  PRIVATE_KEY 未设置");
    process.exit(1);
  }
  const deployerKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  const rpc = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";

  const provider = new ethers.JsonRpcProvider(rpc);
  const _wallet  = new ethers.Wallet(deployerKey, provider);
  const signer   = new NonceManager(_wallet);
  const deployer = _wallet.address;

  console.log("══════════════════════════════════════════════");
  console.log("  Redeploy AerodromeAdapter (fix getAmountsIn)");
  console.log("══════════════════════════════════════════════");
  console.log(`  RPC      : ${rpc}`);
  console.log(`  Deployer : ${deployer}`);

  const network = await provider.getNetwork();
  if (network.chainId !== CHAIN_ID) {
    console.error(`❌  chainId=${network.chainId}，期望 8453`);
    process.exit(1);
  }
  if (deployer.toLowerCase() !== OWNER.toLowerCase()) {
    console.error(`❌  部署地址不是 owner ${OWNER}`);
    process.exit(1);
  }

  // ── 1. Deploy new AerodromeAdapter ─────────────────────────────────────────
  process.stdout.write("\n  [1/3] Deploy AerodromeAdapter ... ");
  const { abi: adapterAbi, bytecode } = art("AerodromeAdapter");
  const factory = new ethers.ContractFactory(adapterAbi, bytecode, signer);
  const adapter = await factory.deploy(AERO_ROUTER, VVV_TOKEN, WETH, AERO_FACTORY, STABLE);
  await adapter.waitForDeployment();
  const newAdapterAddr = await adapter.getAddress();
  console.log(newAdapterAddr);

  // ── 2. VVVPayout.setRouter(newAdapter) ────────────────────────────────────
  const payoutAbi = [
    "function setRouter(address _router) external",
    "function router() external view returns (address)",
    "function owner() external view returns (address)",
  ];
  const payout = new ethers.Contract(PAYOUT_ADDR, payoutAbi, signer);

  process.stdout.write("  [2/3] Payout.setRouter        ... ");
  const tx2 = await payout.setRouter(newAdapterAddr);
  await tx2.wait();
  const newPayoutRouter = await payout.router();
  const payoutOk = newPayoutRouter.toLowerCase() === newAdapterAddr.toLowerCase();
  console.log(payoutOk ? `✓  ${newPayoutRouter}` : `❌  got ${newPayoutRouter}`);

  // ── 3. VVVTreasury.setRouter(newAdapter) (if address is set) ──────────────
  if (TREASURY_ADDR !== "0x0000000000000000000000000000000000000000") {
    const treasuryAbi = [
      "function setRouter(address _router) external",
      "function router() external view returns (address)",
    ];
    const treasury = new ethers.Contract(TREASURY_ADDR, treasuryAbi, signer);
    process.stdout.write("  [3/3] Treasury.setRouter      ... ");
    const tx3 = await treasury.setRouter(newAdapterAddr);
    await tx3.wait();
    const newTreasuryRouter = await treasury.router();
    const treasuryOk = newTreasuryRouter.toLowerCase() === newAdapterAddr.toLowerCase();
    console.log(treasuryOk ? `✓  ${newTreasuryRouter}` : `❌  got ${newTreasuryRouter}`);
  } else {
    console.log("  [3/3] Treasury.setRouter      ... skipped (TREASURY_ADDR not set)");
  }

  // ── Quick sanity: simulate getAmountsIn on new adapter ────────────────────
  process.stdout.write("\n  Sanity: getAmountsIn(0.009 VVV) ... ");
  const adapterContract = new ethers.Contract(newAdapterAddr, adapterAbi, provider);
  try {
    const amounts = await adapterContract.getAmountsIn(
      ethers.parseUnits("0.009", 18),
      [WETH, VVV_TOKEN]
    );
    const ethNeeded = ethers.formatEther(amounts[0]);
    console.log(`✓  需 ${ethNeeded} ETH`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`❌  仍然 revert: ${msg.slice(0, 120)}`);
  }

  console.log("\n══════════════════════════════════════════════");
  console.log(`  ✅  完成。新 AerodromeAdapter: ${newAdapterAddr}`);
  console.log("══════════════════════════════════════════════\n");
  console.log("⚠️  下一步（若 Payout 之前已排队记录）:");
  console.log("    1. 向 Payout 充足 ETH: depositETH()");
  console.log("    2. Admin 面板 → 出款队列 → Flush All，处理历史积压");
  console.log("    3. 让用户重新尝试领取，确认 RewardPaid 事件正常触发\n");
}

main().catch(e => {
  console.error("❌  失败:", e.message ?? e);
  process.exit(1);
});
