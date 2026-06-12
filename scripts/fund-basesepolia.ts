/**
 * VVVEco — Base Sepolia 注资脚本
 *
 * 从 deployments/base-sepolia.json 读取合约地址，执行：
 *   1. VVVToken.approve(MockRouter, 1_000_000 VVV)
 *   2. MockRouter.seedVVV(1_000_000 VVV)
 *   3. MockRouter.seedETH{ value: 0.05 ETH }
 *   4. VVVPayout.depositETH{ value: 0.03 ETH }
 *
 * 运行：
 *   npx tsx scripts/fund-basesepolia.ts
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

// ── 最小 ABI ──────────────────────────────────────────────────────────────────

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function mint(address to, uint256 amount)",
];

const ROUTER_ABI = [
  "function seedVVV(uint256 amount)",
  "function seedETH() payable",
];

const PAYOUT_ABI = [
  "function depositETH() payable",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const f = (n: bigint, d = 4) => parseFloat(ethers.formatEther(n)).toFixed(d);

function step(n: number, label: string) {
  console.log(`\n[${n}/4] ${label}`);
}

async function send(
  label: string,
  txPromise: Promise<ethers.ContractTransactionResponse>
) {
  process.stdout.write(`       sending ... `);
  const tx = await txPromise;
  process.stdout.write(`hash=${tx.hash.slice(0, 20)}…  confirming ... `);
  const receipt = await tx.wait();
  console.log(`✅  block #${receipt!.blockNumber}  gas=${receipt!.gasUsed}`);
  return receipt!;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VVVEco — Base Sepolia 注资");
  console.log("═══════════════════════════════════════════════════════════════");

  // ── 读部署地址 ──────────────────────────────────────────────────────────────
  const depPath = path.join(__dirname, "../deployments/base-sepolia.json");
  if (!fs.existsSync(depPath)) {
    console.error("❌  deployments/base-sepolia.json 不存在，请先运行部署脚本。");
    process.exit(1);
  }
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
  const { VVVToken: tokenAddr, MockRouter: routerAddr, VVVPayout: payoutAddr } = dep.contracts;

  console.log(`  VVVToken   : ${tokenAddr}`);
  console.log(`  MockRouter : ${routerAddr}`);
  console.log(`  VVVPayout  : ${payoutAddr}`);

  // ── 私钥与网络 ──────────────────────────────────────────────────────────────
  const rawKey = process.env.PRIVATE_KEY ?? "";
  if (!rawKey || rawKey === "your_private_key_here" || rawKey.length < 32) {
    console.error("❌  PRIVATE_KEY 未设置或仍为占位符。");
    process.exit(1);
  }
  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

  const rpc      = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
  const provider = new ethers.JsonRpcProvider(rpc);
  const network  = await provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error(`❌  chainId=${network.chainId}，期望 84532 (Base Sepolia)。`);
    process.exit(1);
  }

  const signer      = new NonceManager(new ethers.Wallet(key, provider));
  const signerAddr  = await signer.getAddress();
  const ethBal      = await provider.getBalance(signerAddr);

  console.log(`\n  Signer     : ${signerAddr}`);
  console.log(`  ETH 余额   : ${ethers.formatEther(ethBal)} ETH`);

  const totalEth = ethers.parseEther("0.08"); // 0.05 + 0.03 + gas buffer
  if (ethBal < totalEth) {
    console.error(`\n❌  ETH 余额不足。需要至少 0.08 ETH（0.05 seedETH + 0.03 depositETH + gas）。`);
    process.exit(1);
  }

  // ── 合约实例 ────────────────────────────────────────────────────────────────
  const token  = new ethers.Contract(tokenAddr,  TOKEN_ABI,  signer);
  const router = new ethers.Contract(routerAddr, ROUTER_ABI, signer);
  const payout = new ethers.Contract(payoutAddr, PAYOUT_ABI, signer);

  const VVV_AMOUNT = ethers.parseEther("1000000"); // 1,000,000 VVV
  const ETH_SEED   = ethers.parseEther("0.05");
  const ETH_PAYOUT = ethers.parseEther("0.03");

  // ── 检查 deployer 是否持有足够 VVV ─────────────────────────────────────────
  const vvvBal = await token.balanceOf(signerAddr) as bigint;
  console.log(`  VVV 余额   : ${f(vvvBal)} VVV`);

  if (vvvBal < VVV_AMOUNT) {
    // VVVToken 是可 mint 的合约，owner 可以 mint
    console.log(`\n  VVV 余额不足，尝试 mint ${ethers.formatEther(VVV_AMOUNT)} VVV ...`);
    await send("mint VVV", token.mint(signerAddr, VVV_AMOUNT));
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Step 1: approve
  // ────────────────────────────────────────────────────────────────────────────
  step(1, `VVVToken.approve(MockRouter, 1,000,000 VVV)`);
  await send("approve", token.approve(routerAddr, VVV_AMOUNT));

  // ────────────────────────────────────────────────────────────────────────────
  // Step 2: seedVVV
  // ────────────────────────────────────────────────────────────────────────────
  step(2, `MockRouter.seedVVV(1,000,000 VVV)`);
  await send("seedVVV", router.seedVVV(VVV_AMOUNT));

  // ────────────────────────────────────────────────────────────────────────────
  // Step 3: seedETH
  // ────────────────────────────────────────────────────────────────────────────
  step(3, `MockRouter.seedETH{ value: 0.05 ETH }`);
  await send("seedETH", router.seedETH({ value: ETH_SEED }));

  // ────────────────────────────────────────────────────────────────────────────
  // Step 4: depositETH (Payout)
  // ────────────────────────────────────────────────────────────────────────────
  step(4, `VVVPayout.depositETH{ value: 0.03 ETH }`);
  await send("depositETH", payout.depositETH({ value: ETH_PAYOUT }));

  // ── 注资后状态读取 ──────────────────────────────────────────────────────────
  console.log("\n─── 注资后状态 ───────────────────────────────────────────────");

  const routerEth     = await provider.getBalance(routerAddr);
  const routerVvv     = await token.balanceOf(routerAddr) as bigint;
  const payoutEth     = await provider.getBalance(payoutAddr);
  const allowance     = await token.allowance(signerAddr, routerAddr) as bigint;
  const signerEthLeft = await provider.getBalance(signerAddr);

  console.log(`  MockRouter ETH 余额  : ${ethers.formatEther(routerEth)} ETH`);
  console.log(`  MockRouter VVV 余额  : ${f(routerVvv)} VVV`);
  console.log(`  VVVPayout  ETH 余额  : ${ethers.formatEther(payoutEth)} ETH`);
  console.log(`  VVVToken allowance   : ${f(allowance)} VVV  (signer→router)`);
  console.log(`  Signer ETH 剩余      : ${ethers.formatEther(signerEthLeft)} ETH`);

  // ── 最终检查 ────────────────────────────────────────────────────────────────
  console.log("\n─── 检查结果 ─────────────────────────────────────────────────");
  const checks = [
    { label: "MockRouter ETH > 0",   ok: routerEth  > 0n },
    { label: "MockRouter VVV > 0",   ok: routerVvv  > 0n },
    { label: "VVVPayout  ETH > 0",   ok: payoutEth  > 0n },
  ];
  let allOk = true;
  for (const c of checks) {
    console.log(`  ${c.ok ? "✅" : "❌"}  ${c.label}`);
    if (!c.ok) allOk = false;
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  if (allOk) {
    console.log("  ✅  注资完成，合约已就绪，可进行 stake / claim / withdraw 测试");
  } else {
    console.log("  ⚠️  部分检查未通过，请查看上方错误");
  }
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch(e => {
  console.error("\n❌  注资失败:", e.message ?? e);
  process.exit(1);
});
