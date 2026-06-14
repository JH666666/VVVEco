/**
 * 一次性迁移脚本：将 stake_orders 表中的 amount/usd_value/daily_rate/mode
 * 与链上 getOrder() 数据对齐。
 *
 * 运行方式: node scripts/sync-orders-from-chain.mjs
 */

import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── 读取 .env.local ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv(path) {
  try {
    const raw = readFileSync(resolve(__dirname, "..", path), "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^"|"$/g, "");
    }
  } catch {}
}
loadEnv(".env.local");
loadEnv(".env");

const STAKING_ADDR = process.env.NEXT_PUBLIC_VVECO_STAKING ?? "0x707AeF5E4331c45F1b11aA50EB452b396cE69DD9";
const RPC_URL = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";

console.log(`Staking contract: ${STAKING_ADDR}`);
console.log(`RPC: ${RPC_URL}`);

// ── viem 客户端 ──────────────────────────────────────────────────────────────
const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

const ABI = [
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
];

async function getChainOrders(wallet) {
  const len = Number(
    await client.readContract({ address: STAKING_ADDR, abi: ABI, functionName: "ordersLength", args: [wallet] })
  );
  const orders = [];
  for (let i = 0; i < len; i++) {
    const d = await client.readContract({
      address: STAKING_ADDR, abi: ABI, functionName: "getOrder", args: [wallet, BigInt(i)],
    });
    orders.push({
      orderId: i,
      vvvAmountIn: Number(d.vvvAmountIn) / 1e18,
      usdValue: Number(d.usdValue) / 1e18,
      startTime: new Date(Number(d.startTime) * 1000),
      endTime: new Date(Number(d.endTime) * 1000),
      duration: Number(d.duration),
      dailyRatePct: Number(d.rate) / 10,
      isCoinBased: d.isCoinBased,
    });
  }
  return orders;
}

// ── 主逻辑 ───────────────────────────────────────────────────────────────────
const DB_PATH = resolve(__dirname, "../prisma/dev.db");
const db = new Database(DB_PATH);

const MATCH_TOL_MS = 120_000; // 2分钟容差

const wallets = db
  .prepare("SELECT DISTINCT wallet_address FROM stake_orders")
  .all()
  .map((r) => r.wallet_address);

console.log(`\n共 ${wallets.length} 个地址，开始同步...\n`);

let totalUpdated = 0, totalSkipped = 0, totalUnmatched = 0;

const updateStmt = db.prepare(
  "UPDATE stake_orders SET amount=?, usd_value=?, daily_rate=?, mode=?, start_time=?, end_time=? WHERE tx_hash=?"
);

for (const wallet of wallets) {
  const dbOrders = db
    .prepare("SELECT * FROM stake_orders WHERE wallet_address=? ORDER BY start_time ASC")
    .all(wallet);

  let chainOrders;
  try {
    chainOrders = await getChainOrders(wallet);
  } catch (e) {
    console.error(`  ${wallet}: 链上读取失败 →`, e.message);
    totalUnmatched += dbOrders.length;
    continue;
  }

  console.log(`  ${wallet}: DB ${dbOrders.length} 笔 | 链上 ${chainOrders.length} 笔`);

  for (const dbRow of dbOrders) {
    const dbStartMs = new Date(dbRow.start_time).getTime();
    let best = null, bestDiff = Infinity;
    for (const co of chainOrders) {
      const diff = Math.abs(co.startTime.getTime() - dbStartMs);
      if (diff < bestDiff) { bestDiff = diff; best = co; }
    }

    if (!best || bestDiff > MATCH_TOL_MS) {
      console.warn(`    ⚠ 未匹配: ${dbRow.tx_hash.slice(0, 12)}... (dbStart=${dbRow.start_time})`);
      totalUnmatched++;
      continue;
    }

    const newMode = best.isCoinBased ? "coin" : "fiat";
    const same =
      Math.abs(dbRow.amount - best.vvvAmountIn) < 0.001 &&
      Math.abs(dbRow.usd_value - best.usdValue) < 0.001 &&
      Math.abs(dbRow.daily_rate - best.dailyRatePct) < 0.0001 &&
      dbRow.mode === newMode;

    if (same) { totalSkipped++; continue; }

    updateStmt.run(
      best.vvvAmountIn,
      best.usdValue,
      best.dailyRatePct,
      newMode,
      best.startTime.toISOString(),
      best.endTime.toISOString(),
      dbRow.tx_hash
    );

    console.log(
      `    ✓ 更新: amount ${dbRow.amount}→${best.vvvAmountIn}  usdValue ${dbRow.usd_value}→${best.usdValue}  mode ${dbRow.mode}→${newMode}`
    );
    totalUpdated++;
  }
}

console.log(`\n完成: 更新 ${totalUpdated} 笔 | 已一致跳过 ${totalSkipped} 笔 | 未匹配 ${totalUnmatched} 笔`);
db.close();
