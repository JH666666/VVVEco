/**
 * 应用内定时扫描调度器。
 * 每分钟检查一次配置（存于 auto_scan_config 表），到点则运行团队奖励补录。
 * 配置由后台"团队奖励补录"页设置，无需外部 crontab。
 * 在服务器进程内运行（配合 pm2 常驻），补录逻辑幂等，重复运行安全。
 */
import { prisma } from "@/lib/prisma";
import { scanAndRepairAllTeamRewards } from "@/lib/missing-team-rewards";
import { scanAndRepairAll as scanAndRepairAllOrders } from "@/lib/missing-orders";

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
    const cfg = await getAutoScanConfig();
    const now = Date.now();

    // 团队奖励补录
    if (
      cfg.teamRewardEnabled &&
      now >= (cfg.teamRewardLastRunAt?.getTime() ?? 0) + cfg.teamRewardIntervalMin * 60_000
    ) {
      const res = await scanAndRepairAllTeamRewards(cfg.teamRewardBlocksBack);
      await prisma.autoScanConfig.update({
        where: { id: 1 },
        data: {
          teamRewardLastRunAt: new Date(),
          teamRewardLastResult: `补录 ${res.repaired} 笔，跳过 ${res.skipped} 笔`,
        },
      });
      console.log("[auto-scan] team-reward run:", res);
    }

    // 漏单补录
    if (
      cfg.missingOrderEnabled &&
      now >= (cfg.missingOrderLastRunAt?.getTime() ?? 0) + cfg.missingOrderIntervalMin * 60_000
    ) {
      const res = await scanAndRepairAllOrders(cfg.missingOrderBlocksBack);
      await prisma.autoScanConfig.update({
        where: { id: 1 },
        data: {
          missingOrderLastRunAt: new Date(),
          missingOrderLastResult: `补录 ${res.repaired} 笔，跳过 ${res.skipped} 笔`,
        },
      });
      console.log("[auto-scan] missing-order run:", res);
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
  // 每 60 秒检查一次是否到达设定间隔
  setInterval(() => {
    void tick();
  }, 60_000);
  console.log("[auto-scan] scheduler started (checks every 60s)");
}
