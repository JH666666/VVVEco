/**
 * 应用内定时扫描调度器。
 * 每分钟检查一次配置（存于 auto_scan_config 表），到点则运行团队奖励补录。
 * 配置由后台"团队奖励补录"页设置，无需外部 crontab。
 * 在服务器进程内运行（配合 pm2 常驻），补录逻辑幂等，重复运行安全。
 */
import { prisma } from "@/lib/prisma";
import { scanAndRepairForwardTeamRewards, dedupeTeamRewardsInDb } from "@/lib/missing-team-rewards";
import { scanAndRepairForwardOrders } from "@/lib/missing-orders";
import { scanAndRepairForwardClaims, ensureAutoScanClaimColumns } from "@/lib/missing-claims";

// 断点续扫每次最多前进的区块数（限制单轮 RPC 负载，历史会分多轮扫完）
const MAX_STEP = 100_000;

let started = false;
let running = false;

export async function getAutoScanConfig() {
  return prisma.autoScanConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await ensureAutoScanClaimColumns(); // 自愈 missing_claim_* 列，避免读配置时报列不存在
    const cfg = await getAutoScanConfig();
    const now = Date.now();

    // 团队奖励补录（断点续扫）
    // 追赶历史阶段每分钟连续推进；追平后按设定间隔只扫新增。
    const trCatchingUp =
      cfg.teamRewardLastBlock == null || (cfg.teamRewardLastResult?.includes("追赶历史中") ?? false);
    if (
      cfg.teamRewardEnabled &&
      (trCatchingUp || now >= (cfg.teamRewardLastRunAt?.getTime() ?? 0) + cfg.teamRewardIntervalMin * 60_000)
    ) {
      const res = await scanAndRepairForwardTeamRewards(cfg.teamRewardLastBlock, MAX_STEP);
      await prisma.autoScanConfig.update({
        where: { id: 1 },
        data: {
          teamRewardLastRunAt: new Date(),
          teamRewardLastBlock: res.toBlock,
          teamRewardLastResult: `补录 ${res.repaired}，跳过 ${res.skipped}｜已扫至 ${res.toBlock}/${res.latest}${res.caughtUp ? "（已追平）" : "（追赶历史中）"}`,
        },
      });
      console.log("[auto-scan] team-reward:", res);
    }

    // 漏单补录（断点续扫）
    const moCatchingUp =
      cfg.missingOrderLastBlock == null || (cfg.missingOrderLastResult?.includes("追赶历史中") ?? false);
    if (
      cfg.missingOrderEnabled &&
      (moCatchingUp || now >= (cfg.missingOrderLastRunAt?.getTime() ?? 0) + cfg.missingOrderIntervalMin * 60_000)
    ) {
      const res = await scanAndRepairForwardOrders(cfg.missingOrderLastBlock, MAX_STEP);
      await prisma.autoScanConfig.update({
        where: { id: 1 },
        data: {
          missingOrderLastRunAt: new Date(),
          missingOrderLastBlock: res.toBlock,
          missingOrderLastResult: `补录 ${res.repaired}，跳过 ${res.skipped}｜已扫至 ${res.toBlock}/${res.latest}${res.caughtUp ? "（已追平）" : "（追赶历史中）"}`,
        },
      });
      console.log("[auto-scan] missing-order:", res);
    }

    // 领取记录补录（独立断点续扫）
    const mcCatchingUp =
      cfg.missingClaimLastBlock == null || (cfg.missingClaimLastResult?.includes("追赶历史中") ?? false);
    if (
      cfg.missingClaimEnabled &&
      (mcCatchingUp || now >= (cfg.missingClaimLastRunAt?.getTime() ?? 0) + cfg.missingClaimIntervalMin * 60_000)
    ) {
      const res = await scanAndRepairForwardClaims(cfg.missingClaimLastBlock, MAX_STEP);
      await prisma.autoScanConfig.update({
        where: { id: 1 },
        data: {
          missingClaimLastRunAt: new Date(),
          missingClaimLastBlock: res.toBlock,
          missingClaimLastResult: `补录 ${res.repaired}，跳过 ${res.skipped}｜已扫至 ${res.toBlock}/${res.latest}${res.caughtUp ? "（已追平）" : "（追赶历史中）"}`,
        },
      });
      console.log("[auto-scan] missing-claim:", res);
    }
  } catch (e) {
    console.error("[auto-scan] tick error:", e);
  } finally {
    running = false;
  }
}

export function startAutoScan() {
  if (started) return;
  started = true;
  // 启动时自动清理团队奖励重复行（历史浏览器+服务端重复写），让数据库/出金统计口径正确。
  // 纯 DB 操作、幂等；清理后后续启动无重复可删。
  void dedupeTeamRewardsInDb()
    .then((r) => { if (r.removed > 0) console.log("[auto-scan] team-reward dedupe:", r); })
    .catch((e) => console.error("[auto-scan] team-reward dedupe failed:", e));
  // 每 60 秒检查一次是否到达设定间隔
  setInterval(() => {
    void tick();
  }, 60_000);
  console.log("[auto-scan] scheduler started (checks every 60s)");
}
