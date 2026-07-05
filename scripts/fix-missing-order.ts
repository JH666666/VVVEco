/**
 * 紧急补录脚本：修复链上有订单但 DB 未入库的情况
 *
 * 用法（在生产服务器项目目录下执行）：
 *   npx ts-node -P tsconfig.json scripts/fix-missing-order.ts
 *
 * 脚本会：
 * 1. 查链上该用户所有 order
 * 2. 查 DB 中该用户所有订单（按 walletAddress lowercase）
 * 3. 对比缺失的 chainOrderId
 * 4. 找到对应 tx hash（从链上 Staked 事件获取）
 * 5. 补录进 stake_orders 表
 */

import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { PrismaClient } from "@prisma/client";

const TARGET_WALLET = "0xa6D260B11984E08B6451fd02f890967D3Fb3C88D";
const STAKING_ADDR = (process.env.NEXT_PUBLIC_VVECO_STAKING ?? "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64") as `0x${string}`;
const RPC_URL = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });
const prisma = new PrismaClient();

const STAKING_ABI = [
  {
    name: "ordersLength",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getOrder",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "orderId", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "vvvAmountIn", type: "uint256" },
          { name: "usdValue", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "duration", type: "uint256" },
          { name: "rate", type: "uint256" },
          { name: "isCoinBased", type: "bool" },
          { name: "isWithdrawn", type: "bool" },
          { name: "claimedAmount", type: "uint256" },
        ],
      },
    ],
  },
] as const;

// Staked 事件 ABI
const STAKED_EVENT = parseAbiItem(
  "event Staked(address indexed user, uint256 orderId, uint256 vvvAmountIn, uint256 usdValue, uint256 duration, bool isCoinBased, address referrer)"
);

async function main() {
  const walletLower = TARGET_WALLET.toLowerCase();
  console.log("=".repeat(60));
  console.log("目标钱包:", TARGET_WALLET);
  console.log("Staking合约:", STAKING_ADDR);
  console.log("RPC:", RPC_URL);
  console.log("=".repeat(60));

  // ── Step 1: 查链上 ordersLength ─────────────────────────────
  console.log("\n[1] 查链上 ordersLength...");
  const chainLen = await client.readContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "ordersLength",
    args: [TARGET_WALLET as `0x${string}`],
  });
  const ordersCount = Number(chainLen);
  console.log("    链上订单数量:", ordersCount);

  if (ordersCount === 0) {
    console.log("    ⚠️  链上该用户没有任何订单，请确认钱包地址是否正确。");
    return;
  }

  // ── Step 2: 读取所有链上订单详情 ─────────────────────────────
  console.log("\n[2] 读取链上所有订单...");
  const chainOrders = [];
  for (let i = 0; i < ordersCount; i++) {
    const d = await client.readContract({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: "getOrder",
      args: [TARGET_WALLET as `0x${string}`, BigInt(i)],
    });
    const order = {
      orderId: i,
      vvvAmountIn: Number(d.vvvAmountIn) / 1e18,
      usdValue: Number(d.usdValue) / 1e18,
      startTime: new Date(Number(d.startTime) * 1000),
      endTime: new Date(Number(d.endTime) * 1000),
      duration: Number(d.duration),
      dailyRatePct: Number(d.rate) / 10,
      isCoinBased: d.isCoinBased,
      isWithdrawn: d.isWithdrawn,
      claimedAmount: Number(d.claimedAmount) / 1e18,
    };
    console.log(`    orderId=${i} | ${order.isCoinBased ? "coin" : "fiat"} | ${order.usdValue.toFixed(2)} USD | start=${order.startTime.toISOString()} | withdrawn=${order.isWithdrawn}`);
    chainOrders.push(order);
  }

  // ── Step 3: 查 DB 中该用户订单 ─────────────────────────────
  console.log("\n[3] 查 DB 中该用户订单...");
  const dbOrders = await prisma.stakeOrder.findMany({
    where: { walletAddress: walletLower },
    orderBy: { startTime: "asc" },
    select: { txHash: true, startTime: true, usdValue: true, mode: true },
  });
  console.log(`    DB 中找到 ${dbOrders.length} 笔订单`);
  dbOrders.forEach((o, i) => {
    console.log(`    db[${i}] txHash=${o.txHash} | ${o.mode} | ${o.usdValue.toFixed(2)} USD | start=${o.startTime.toISOString()}`);
  });

  // ── Step 4: 对比差异 ─────────────────────────────────────
  console.log("\n[4] 对比差异（按 startTime 匹配）...");

  // 用链上 startTime 和 DB startTime 匹配（允许 ±60s 误差）
  const missingOrders = chainOrders.filter(co => {
    const matched = dbOrders.some(db =>
      Math.abs(db.startTime.getTime() - co.startTime.getTime()) < 60_000
    );
    return !matched;
  });

  if (missingOrders.length === 0) {
    console.log("    ✅ 链上与 DB 订单数量一致，无需补录。");
    return;
  }

  console.log(`    ❌ 发现 ${missingOrders.length} 笔链上有但 DB 缺失的订单:`);
  missingOrders.forEach(o => {
    console.log(`    orderId=${o.orderId} | ${o.isCoinBased ? "coin" : "fiat"} | ${o.usdValue.toFixed(2)} USD`);
  });

  // ── Step 5: 通过 getLogs 找 Staked 事件的 txHash ─────────
  console.log("\n[5] 从链上事件日志找缺失订单的 txHash...");
  const currentBlock = await client.getBlockNumber();

  // 搜索最近 50000 个块（约 1.7 天）
  const fromBlock = currentBlock - 50000n > 0n ? currentBlock - 50000n : 0n;
  console.log(`    搜索区块范围: ${fromBlock} → ${currentBlock}`);

  const logs = await client.getLogs({
    address: STAKING_ADDR,
    event: STAKED_EVENT,
    args: { user: TARGET_WALLET as `0x${string}` },
    fromBlock,
    toBlock: currentBlock,
  });

  console.log(`    找到 ${logs.length} 条 Staked 事件`);
  logs.forEach(l => {
    console.log(`    txHash=${l.transactionHash} | orderId=${l.args.orderId} | block=${l.blockNumber}`);
  });

  // ── Step 6: 确保 User 存在 ─────────────────────────────────
  console.log("\n[6] 确认用户记录...");
  let user = await prisma.user.findUnique({ where: { walletAddress: walletLower } });
  if (!user) {
    console.log("    用户不存在，先创建...");
    const maxUid = await prisma.user.aggregate({ _max: { uid: true } });
    const newUid = (maxUid._max.uid ?? 0) + 1;
    user = await prisma.user.create({
      data: { walletAddress: walletLower, uid: newUid },
    });
    console.log("    已创建用户 uid:", newUid);
  } else {
    console.log("    用户已存在 uid:", user.uid);
  }

  // ── Step 7: 补录缺失订单 ──────────────────────────────────
  console.log("\n[7] 补录缺失订单到 DB...");

  for (const missing of missingOrders) {
    // 从事件日志中找对应 orderId 的 txHash
    const matchedLog = logs.find(l => Number(l.args.orderId) === missing.orderId);

    if (!matchedLog?.transactionHash) {
      console.log(`    ⚠️  orderId=${missing.orderId} 未找到对应 txHash（事件日志超出搜索范围？）`);
      console.log(`       请手动查找该笔 tx 并用下方 SQL 补录。`);
      console.log(`       链上数据：vvvAmountIn=${missing.vvvAmountIn} usdValue=${missing.usdValue} start=${missing.startTime.toISOString()}`);
      continue;
    }

    const txHash = matchedLog.transactionHash;
    console.log(`    补录 orderId=${missing.orderId} txHash=${txHash} ...`);

    try {
      await prisma.stakeOrder.upsert({
        where: { txHash },
        update: {
          amount: missing.vvvAmountIn,
          usdValue: missing.usdValue,
          dailyRate: missing.dailyRatePct,
          mode: missing.isCoinBased ? "coin" : "fiat",
          period: missing.duration,
          startTime: missing.startTime,
          endTime: missing.endTime,
          isWithdrawn: missing.isWithdrawn,
        },
        create: {
          txHash,
          walletAddress: walletLower,
          mode: missing.isCoinBased ? "coin" : "fiat",
          amount: missing.vvvAmountIn,
          usdValue: missing.usdValue,
          period: missing.duration,
          periodUnit: "day",
          dailyRate: missing.dailyRatePct,
          startTime: missing.startTime,
          endTime: missing.endTime,
          isWithdrawn: missing.isWithdrawn,
        },
      });
      console.log(`    ✅ orderId=${missing.orderId} txHash=${txHash} 补录成功`);
    } catch (e) {
      console.error(`    ❌ 补录失败:`, e);
    }
  }

  // ── Step 8: 验证补录结果 ──────────────────────────────────
  console.log("\n[8] 验证补录结果...");
  const finalOrders = await prisma.stakeOrder.findMany({
    where: { walletAddress: walletLower },
    orderBy: { startTime: "asc" },
    select: { txHash: true, startTime: true, usdValue: true, mode: true, isWithdrawn: true },
  });
  console.log(`    DB 现有 ${finalOrders.length} 笔订单（链上 ${ordersCount} 笔）`);
  finalOrders.forEach((o, i) => {
    console.log(`    [${i}] ${o.txHash.slice(0, 12)}... | ${o.mode} | $${o.usdValue.toFixed(2)} | start=${o.startTime.toISOString()} | withdrawn=${o.isWithdrawn}`);
  });

  if (finalOrders.length === ordersCount) {
    console.log("\n✅ 补录完成！用户前端和后台现在应该可以看到订单。");
  } else {
    console.log(`\n⚠️  仍有差异：DB ${finalOrders.length} vs 链上 ${ordersCount}，请人工排查剩余差距。`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("脚本出错:", e);
  await prisma.$disconnect();
  process.exit(1);
});
