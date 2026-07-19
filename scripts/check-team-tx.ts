/**
 * 诊断某笔"领取收益"交易的团队奖励是否漏写数据库。
 * 用法（在服务器项目根目录）：
 *   npx tsx scripts/check-team-tx.ts <txHash>
 * 例：
 *   npx tsx scripts/check-team-tx.ts 0x57cb4aac499884e497a0e591173aa5565de01c6923d11955412fa23de6600da2
 *
 * 输出：
 *   ① 链上 TeamRewardAccrued 事件（上级 / 下级 / 金额）
 *   ② 数据库 team_rewards 是否有对应记录
 *   ③ 结论：是否漏写
 */
import * as dotenv from "dotenv";

// 必须在 prisma import 之前加载 .env，否则会回落到 dev.db（与 seed-v2-db.ts 一致）
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const TX = (process.argv[2] ?? "").trim().toLowerCase();
const STAKING = (
  process.env.NEXT_PUBLIC_VVECO_STAKING ?? "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64"
).toLowerCase();
const RPC = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";
const TEAM_REWARD_TOPIC =
  "0xe07f61c526a4ace6d1e5cad0a84eddbf8e2733ce8383b0b2f1d76f07fb1cab49";

function addrFromTopic(t: string) {
  return "0x" + t.slice(-40).toLowerCase();
}
function toVvv(dataHex: string) {
  return Number(BigInt(dataHex)) / 1e18;
}

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}

async function main() {
  if (!/^0x[a-f0-9]{64}$/.test(TX)) {
    console.error("请提供合法 txHash：npx tsx scripts/check-team-tx.ts <txHash>");
    process.exit(1);
  }

  // 动态 import，保证 PrismaClient 在 DATABASE_URL 已加载后才初始化
  const { prisma } = await import("../lib/prisma.js");

  console.log("RPC:", RPC);
  console.log("Staking:", STAKING);
  console.log("Tx:", TX);
  console.log("");

  const receipt = await rpc("eth_getTransactionReceipt", [TX]);
  if (!receipt) {
    console.error("找不到该交易回执（确认 txHash 与网络正确）");
    process.exit(1);
  }
  console.log("交易状态:", receipt.status === "0x1" ? "成功" : "失败");
  console.log("领取人(下级, from):", (receipt.from as string).toLowerCase());
  console.log("");

  const teamLogs = (receipt.logs as Array<{ address: string; topics: string[]; data: string; logIndex: string }>)
    .filter((l) => l.topics[0]?.toLowerCase() === TEAM_REWARD_TOPIC);

  console.log(`=== 链上 TeamRewardAccrued 事件：${teamLogs.length} 条 ===`);
  if (teamLogs.length === 0) {
    console.log("这笔交易没有产生团队奖励事件（可能下级没有上级，或奖励为 0）。");
  }

  // 数据库里这笔 tx 的团队奖励记录（客户端写入时 claimTxHash = txHash + "_" + logIndex）
  const dbRows = await prisma.teamReward.findMany({
    where: { claimTxHash: { startsWith: TX } },
    select: { beneficiaryAddr: true, sourceAddr: true, amount: true, claimTxHash: true },
  });

  let missing = 0;
  for (const l of teamLogs) {
    const upline = addrFromTopic(l.topics[1]);
    const downline = addrFromTopic(l.topics[2]);
    const bonus = toVvv(l.data);
    const onStaking = l.address.toLowerCase() === STAKING;
    const matched = dbRows.find(
      (r) => r.beneficiaryAddr.toLowerCase() === upline && r.sourceAddr.toLowerCase() === downline,
    );
    console.log("");
    console.log(`  上级(recipient): ${upline}`);
    console.log(`  下级(claimer)  : ${downline}`);
    console.log(`  奖励(bonus)    : ${bonus} VVV${onStaking ? "" : "  ⚠非Staking合约"}`);
    console.log(`  数据库记录     : ${matched ? "✅ 有" : "❌ 缺失（链上已发放，DB 没写）"}`);
    if (!matched) missing++;
  }

  console.log("");
  console.log("=== 数据库中该 tx 的 team_rewards 记录 ===");
  if (dbRows.length === 0) {
    console.log("（无）");
  } else {
    for (const r of dbRows) {
      console.log(`  ${r.claimTxHash}  上级=${r.beneficiaryAddr}  下级=${r.sourceAddr}  ${r.amount} VVV`);
    }
  }

  console.log("");
  console.log("=== 结论 ===");
  if (teamLogs.length === 0) {
    console.log("这笔交易本身没有团队奖励，无需补录。");
  } else if (missing === 0) {
    console.log("链上与数据库一致，没有漏写。");
  } else {
    console.log(`确认漏写：链上发放了 ${teamLogs.length} 笔团队奖励，其中 ${missing} 笔数据库缺失。`);
    console.log("→ 上级钱包已到账，但后台/前端'贡献收益'不显示，原因即此。");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("出错:", e);
  process.exit(1);
});
