/**
 * 资金报表查询白名单（仅内部股东核对用）。
 * 只有管理员在后台加入白名单的地址，才能在 /query 查询系统里查到数据；
 * 其余地址一律拒绝。白名单为空 = 谁都查不到（需管理员先添加）。
 *
 * 存储用原始 SQL + 自愈建表：pm2 实际库里若无此表则 CREATE TABLE IF NOT EXISTS，
 * 避免 CLI 迁移写到别的 DB 文件导致表缺失。
 */
import { prisma } from "@/lib/prisma";

let ensured: Promise<void> | null = null;
export function ensureQueryWhitelistTable(): Promise<void> {
  if (ensured) return ensured;
  ensured = (async () => {
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "query_whitelist" (
          "address" TEXT NOT NULL PRIMARY KEY,
          "note" TEXT,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
      );
    } catch (e) {
      console.warn("[query-whitelist] ensure table failed:", e instanceof Error ? e.message : String(e));
    }
  })();
  return ensured;
}

export interface QueryWhitelistItem {
  address: string;
  note: string | null;
  createdAt: string | null;
}

export async function listQueryWhitelist(): Promise<QueryWhitelistItem[]> {
  await ensureQueryWhitelistTable();
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ address: string; note: string | null; created_at: string | null }>>(
      `SELECT address, note, created_at FROM "query_whitelist" ORDER BY created_at DESC`
    );
    return rows.map((r) => ({ address: r.address, note: r.note ?? null, createdAt: r.created_at ?? null }));
  } catch {
    return [];
  }
}

export async function addToQueryWhitelist(address: string, note = ""): Promise<void> {
  await ensureQueryWhitelistTable();
  const addr = address.trim().toLowerCase();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "query_whitelist" ("address", "note", "created_at")
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT("address") DO UPDATE SET "note" = ?`,
    addr,
    note,
    note
  );
}

export async function removeFromQueryWhitelist(address: string): Promise<void> {
  await ensureQueryWhitelistTable();
  const addr = address.trim().toLowerCase();
  await prisma.$executeRawUnsafe(`DELETE FROM "query_whitelist" WHERE "address" = ?`, addr);
}

export async function isAddressWhitelisted(address: string): Promise<boolean> {
  await ensureQueryWhitelistTable();
  const addr = address.trim().toLowerCase();
  if (!addr) return false;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ one: number }>>(
      `SELECT 1 as one FROM "query_whitelist" WHERE "address" = ? LIMIT 1`,
      addr
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}
