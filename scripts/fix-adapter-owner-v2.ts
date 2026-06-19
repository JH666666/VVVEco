/**
 * fix-adapter-owner-v2.ts
 *
 * 用途：修复 AerodromeAdapter V2 的 ownership 未正确转移问题。
 *
 * 运行前提：
 *   - PRIVATE_KEY = Deploy Wallet 私钥（0xf9f5C96a... 对应的私钥）
 *   - ADAPTER_ADDR = 新部署的 AerodromeAdapter V2 合约地址
 *
 * 运行命令（在本机终端）：
 *   PRIVATE_KEY=<deploy_wallet_key> ADAPTER_ADDR=<新adapter地址> npx tsx scripts/fix-adapter-owner-v2.ts
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const OWNER        = "0x31b265Fd2db6F0445B9d92306a0bf1A313B0aD3A";
const ADAPTER_ADDR = process.env.ADAPTER_ADDR ?? "";
const RPC_URL      = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";

const OWNABLE_ABI = [
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner)",
] as const;

async function main() {
  if (!ADAPTER_ADDR || !/^0x[a-fA-F0-9]{40}$/.test(ADAPTER_ADDR)) {
    console.error("❌  请设置环境变量 ADAPTER_ADDR=<新adapter合约地址>");
    process.exit(1);
  }

  const rawKey = process.env.PRIVATE_KEY ?? "";
  if (!rawKey || rawKey.length < 32) {
    console.error("❌  PRIVATE_KEY 未设置");
    process.exit(1);
  }
  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(key, provider);
  console.log(`  Signer    : ${wallet.address}`);
  console.log(`  Adapter   : ${ADAPTER_ADDR}`);
  console.log(`  Target    : ${OWNER}`);
  console.log();

  const network = await provider.getNetwork();
  if (network.chainId !== 8453n) {
    console.error(`❌  RPC chainId=${network.chainId}，期望 8453 (Base Mainnet)`);
    process.exit(1);
  }

  const adapter = new ethers.Contract(ADAPTER_ADDR, OWNABLE_ABI, wallet);

  const currentOwner = await adapter.owner() as string;
  console.log(`  Current adapter.owner() = ${currentOwner}`);

  if (currentOwner.toLowerCase() === OWNER.toLowerCase()) {
    console.log("\n✅  adapter.owner() 已经是 OWNER，无需操作。");
    return;
  }

  if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(`\n❌  当前 owner 是 ${currentOwner}`);
    console.error(`    但 signer 是 ${wallet.address}`);
    console.error("    只有当前 owner 才能调用 transferOwnership。");
    process.exit(1);
  }

  console.log("\n  正在发送 transferOwnership...");
  const tx = await (adapter as ethers.Contract & { transferOwnership: (addr: string) => Promise<ethers.ContractTransactionResponse> }).transferOwnership(OWNER);
  console.log(`  tx hash : ${tx.hash}`);

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    console.error("❌  交易失败（status != 1），请检查 tx hash");
    process.exit(1);
  }
  console.log(`  confirmed in block ${receipt.blockNumber}`);

  const newOwner = await adapter.owner() as string;
  if (newOwner.toLowerCase() !== OWNER.toLowerCase()) {
    console.error(`\n❌  验证失败: adapter.owner() = ${newOwner}`);
    process.exit(1);
  }

  console.log(`\n✅  adapter.owner() = ${newOwner}`);
  console.log("    ownership 修复完成。");
}

main().catch(e => {
  console.error("❌  失败:", e.message ?? e);
  process.exit(1);
});
