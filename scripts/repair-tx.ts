/**
 * 针对单笔 tx 的精确补录工具
 * 用法：npx ts-node -P tsconfig.json scripts/repair-tx.ts
 *
 * 脚本会：
 * 1. 读 tx receipt，解码 Staked 事件，得到真实 orderId
 * 2. 调用 getOrder(wallet, orderId) 获取链上权威数据
 * 3. 查 DB 确认是否缺失
 * 4. 打印精确 SQL（不执行，让你确认后手动运行）
 */

import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { createPublicClient, http, decodeEventLog, parseAbi } from "viem";
import { base } from "viem/chains";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// ── 目标参数（只修改这两行）─────────────────────────────────────────
const TARGET_TX   = "0x2583f2adcb17a65616d8b44c92ea43ef418672550ac2c6cd8600e0616a7ed229" as `0x${string}`;
const TARGET_WALLET = "0xa6D260B11984E08B6451fd02f890967D3Fb3C88D";
// ───────────────────────────────────────────────────────────────────

const STAKING_ADDR = (
  process.env.NEXT_PUBLIC_VVECO_STAKING ?? "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64"
) as `0x${string}`;

const RPC_URL = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";
const DB_URL  = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });
const prisma  = new PrismaClient({
  adapter: new PrismaLibSql({ url: DB_URL }),
});

const STAKING_ABI = parseAbi([
  "event Staked(address indexed user, uint256 orderId, uint256 vvvAmountIn, uint256 usdValue, uint256 duration, bool isCoinBased, address referrer)",
  "function getOrder(address user, uint256 orderId) view returns ((uint256 vvvAmountIn, uint256 usdValue, uint256 startTime, uint256 endTime, uint256 duration, uint256 rate, bool isCoinBased, bool isWithdrawn, uint256 claimedAmount))",
  "function ordersLength(address user) view returns (uint256)",
]);

function toISOTimestamp(d: Date): string {
  return d.toISOString(); // "2025-07-05T12:34:56.000Z" — LibSQL text-sorts ISO format correctly
}

async function main() {
  const walletLower = TARGET_WALLET.toLowerCase();

  console.log("=".repeat(64));
  console.log("TX    :", TARGET_TX);
  console.log("Wallet:", TARGET_WALLET);
  console.log("RPC   :", RPC_URL);
  console.log("=".repeat(64));

  // ── Step 1: 读 tx receipt ──────────────────────────────────────
  console.log("\n[1] 查 tx receipt...");
  const receipt = await client.getTransactionReceipt({ hash: TARGET_TX });

  if (!receipt) {
    console.error("    ❌ tx receipt 为空，链上不存在或未确认");
    return;
  }
  console.log("    status      :", receipt.status);
  console.log("    blockNumber :", receipt.blockNumber.toString());
  console.log("    from        :", receipt.from);
  console.log("    to          :", receipt.to);
  console.log("    logs count  :", receipt.logs.length);

  if (receipt.status !== "success") {
    console.error("    ❌ tx 失败（status != success），无法补录");
    return;
  }

  if (receipt.to?.toLowerCase() !== STAKING_ADDR.toLowerCase()) {
    console.error(`    ❌ tx.to (${receipt.to}) 不是 Staking 合约 (${STAKING_ADDR})`);
    return;
  }

  if (receipt.from.toLowerCase() !== walletLower) {
    console.error(`    ❌ tx.from (${receipt.from}) 与目标钱包 (${TARGET_WALLET}) 不一致`);
    return;
  }

  // ── Step 2: 解码 Staked 事件 ────────────────────────────────────
  console.log("\n[2] 解码 Staked 事件...");
  let stakedLog: {
    orderId: bigint;
    vvvAmountIn: bigint;
    usdValue: bigint;
    duration: bigint;
    isCoinBased: boolean;
    referrer: string;
  } | null = null;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== STAKING_ADDR.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: STAKING_ABI,
        data: log.data,
        topics: log.topics,
        eventName: "Staked",
      });
      stakedLog = decoded.args as typeof stakedLog;
      break;
    } catch {
      // not this event
    }
  }

  if (!stakedLog) {
    console.error("    ❌ 在此 tx 的 logs 中未找到 Staked 事件");
    console.log("    全部 log topics:", receipt.logs.map(l => l.topics));
    return;
  }

  const chainOrderId = Number(stakedLog.orderId);
  console.log("    orderId     :", chainOrderId);
  console.log("    vvvAmountIn :", (Number(stakedLog.vvvAmountIn) / 1e18).toFixed(6), "VVV (raw:", stakedLog.vvvAmountIn.toString(), ")");
  console.log("    usdValue    :", (Number(stakedLog.usdValue) / 1e18).toFixed(6), "USD (raw:", stakedLog.usdValue.toString(), ")");
  console.log("    duration    :", stakedLog.duration.toString(), "days");
  console.log("    isCoinBased :", stakedLog.isCoinBased);
  console.log("    referrer    :", stakedLog.referrer);

  // ── Step 3: 调用 getOrder 取完整链上数据 ────────────────────────
  console.log("\n[3] 调用 getOrder(" + chainOrderId + ")...");
  const order = await client.readContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "getOrder",
    args: [TARGET_WALLET as `0x${string}`, BigInt(chainOrderId)],
  });

  const vvvAmountIn  = Number(order.vvvAmountIn) / 1e18;
  const usdValue     = Number(order.usdValue)    / 1e18;
  const duration     = Number(order.duration);        // days
  const rate         = Number(order.rate);            // permille (e.g. 9 = 0.9%/day)
  const dailyRatePct = rate / 10;                     // percent
  const isCoinBased  = order.isCoinBased;
  const isWithdrawn  = order.isWithdrawn;
  const startTime    = new Date(Number(order.startTime) * 1000);
  const endTime      = new Date(Number(order.endTime)   * 1000);
  const mode         = isCoinBased ? "coin" : "fiat";

  console.log("    vvvAmountIn :", vvvAmountIn.toFixed(6), "VVV");
  console.log("    usdValue    :", usdValue.toFixed(6), "USD");
  console.log("    duration    :", duration, "days");
  console.log("    rate        :", rate, "permille →", dailyRatePct, "%/day");
  console.log("    mode        :", mode);
  console.log("    startTime   :", startTime.toISOString());
  console.log("    endTime     :", endTime.toISOString());
  console.log("    isWithdrawn :", isWithdrawn);

  // ── Step 4: 查 DB ───────────────────────────────────────────────
  console.log("\n[4] 查 DB...");

  const existsByTx = await prisma.stakeOrder.findUnique({
    where: { txHash: TARGET_TX },
  });
  const allUserOrders = await prisma.stakeOrder.findMany({
    where: { walletAddress: walletLower },
    orderBy: { startTime: "asc" },
    select: { txHash: true, startTime: true, usdValue: true, mode: true },
  });

  console.log("    按 txHash 查:", existsByTx ? "✅ 已存在" : "❌ 不存在");
  console.log("    该用户 DB 订单数:", allUserOrders.length);
  allUserOrders.forEach((o, i) => {
    console.log(`    db[${i}] ${o.txHash.slice(0, 14)}... ${o.mode} $${o.usdValue.toFixed(2)} ${o.startTime.toISOString()}`);
  });

  if (existsByTx) {
    console.log("\n✅ txHash 已在 DB 中，无需补录。");
    return;
  }

  // ── Step 5: 确认 User 存在 ─────────────────────────────────────
  console.log("\n[5] 查 User 记录...");
  const user = await prisma.user.findUnique({
    where: { walletAddress: walletLower },
    select: { uid: true, walletAddress: true, inviteCode: true },
  });
  if (!user) {
    console.error("    ❌ DB 中不存在该用户，需要先建用户记录再补订单");
    console.log("    → 请先检查 users 表，确认是否需要 INSERT 用户");
    return;
  }
  console.log("    uid         :", user.uid);
  console.log("    walletAddress:", user.walletAddress);
  console.log("    inviteCode  :", user.inviteCode ?? "(无)");

  // ── Step 6: 生成 SQL ───────────────────────────────────────────
  console.log("\n[6] 生成补录 SQL...");

  const startSql = toISOTimestamp(startTime);
  const endSql   = toISOTimestamp(endTime);
  const nowSql   = toISOTimestamp(new Date());

  console.log("\n" + "=".repeat(64));
  console.log("① 根因：");
  console.log("   链上 tx 成功，但前端在 tx confirm 回调后未能发出");
  console.log("   POST /api/stake-orders（用户关闭页面/TP浏览器跳转）。");
  console.log("   服务器没有收到请求，DB 无记录。");
  console.log("\n② 最终 SQL（复制到生产服务器 sqlite3 prod.db 执行）：");
  console.log("-".repeat(64));

  const sql = `INSERT INTO stake_orders (
  tx_hash,
  wallet_address,
  mode,
  amount,
  usd_value,
  period,
  period_unit,
  daily_rate,
  start_time,
  end_time,
  is_withdrawn,
  withdrawn_tx,
  hidden_by_admin,
  created_at
) VALUES (
  '${TARGET_TX}',
  '${walletLower}',
  '${mode}',
  ${vvvAmountIn.toFixed(18)},
  ${usdValue.toFixed(18)},
  ${duration},
  'day',
  ${dailyRatePct.toFixed(10)},
  '${startSql}',
  '${endSql}',
  ${isWithdrawn ? 1 : 0},
  NULL,
  0,
  '${nowSql}'
);`;

  console.log(sql);
  console.log("-".repeat(64));
  console.log("\n③ 是否需要重启服务：否。");
  console.log("   SQL 执行后用户刷新前端即可看到订单，无需重启 pm2。");
  console.log("\n验证命令（执行 SQL 后运行）：");
  console.log(`  sqlite3 <your-db-path> "SELECT tx_hash, mode, amount, usd_value, start_time FROM stake_orders WHERE wallet_address='${walletLower}';"`);
  console.log("=".repeat(64));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\n❌ 脚本出错:", e);
  await prisma.$disconnect();
  process.exit(1);
});
