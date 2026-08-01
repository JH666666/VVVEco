/**
 * 出金核对加成系数（仅内部股东核对用）。
 * 后台可调一个全局百分比 withdraw_markup_pct：例如设 5 表示资金报表里
 * 出金的三项（领取收益、团队奖励、赎回本金）各放大 5%，累计出金随之 ×1.05。
 * 用途：真实资金沉淀 ≠ 累计入金 − 累计出金（有运营提前支出、币价波动沉淀差），
 * 用一个保守系数让核对口径更贴近真实。仅影响展示统计，不改链上/领取记录本身。
 *
 * 存储用原始 SQL + 自愈建表：pm2 实际库里若无此表则 CREATE TABLE IF NOT EXISTS，
 * 避免 CLI 迁移写到别的 DB 文件导致表缺失。
 */
import { prisma } from "@/lib/prisma";

let ensured: Promise<void> | null = null;
export function ensureFundAdjustTable(): Promise<void> {
  if (ensured) return ensured;
  ensured = (async () => {
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "fund_adjust_config" (
          "id" INTEGER NOT NULL PRIMARY KEY,
          "withdraw_markup_pct" REAL NOT NULL DEFAULT 0,
          "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
      );
    } catch (e) {
      console.warn("[fund-adjust] ensure table failed:", e instanceof Error ? e.message : String(e));
    }
  })();
  return ensured;
}

/** 读取出金加成百分比（如 5 表示 +5%）。任何异常回退 0（不加成）。 */
export async function getWithdrawMarkupPct(): Promise<number> {
  try {
    await ensureFundAdjustTable();
    const rows = await prisma.$queryRawUnsafe<Array<{ withdraw_markup_pct: number }>>(
      `SELECT withdraw_markup_pct FROM "fund_adjust_config" WHERE id = 1`
    );
    const pct = rows?.[0]?.withdraw_markup_pct;
    return typeof pct === "number" && Number.isFinite(pct) ? pct : 0;
  } catch {
    return 0;
  }
}

/** 设置出金加成百分比（限制 0~1000）。返回落库后的值。 */
export async function setWithdrawMarkupPct(pct: number): Promise<number> {
  await ensureFundAdjustTable();
  const clamped = Math.max(0, Math.min(1000, Number(pct) || 0));
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fund_adjust_config" ("id", "withdraw_markup_pct", "updated_at")
     VALUES (1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT("id") DO UPDATE SET "withdraw_markup_pct" = ?, "updated_at" = CURRENT_TIMESTAMP`,
    clamped,
    clamped
  );
  return clamped;
}
