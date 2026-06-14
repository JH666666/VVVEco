/**
 * POST /api/admin/sync-orders
 * 将数据库中所有 stake_orders 的 amount/usdValue/dailyRate/mode/startTime/endTime
 * 与链上 getOrder() 返回的权威数据对齐。
 *
 * 匹配策略：同一 walletAddress 下，按 startTime 最接近的原则（±120s）关联。
 * 若已在允许误差内且数值已一致，则跳过该条记录。
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllChainOrders, type ChainOrder } from "@/lib/chain-read";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const MATCH_TOLERANCE_MS = 120_000; // 2 minutes

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. 获取 DB 中所有唯一地址
  const wallets = await prisma.stakeOrder.findMany({
    select: { walletAddress: true },
    distinct: ["walletAddress"],
  });

  const results: {
    wallet: string;
    total: number;
    updated: number;
    unmatched: number;
    errors: string[];
  }[] = [];

  for (const { walletAddress } of wallets) {
    const dbOrders = await prisma.stakeOrder.findMany({
      where: { walletAddress },
      orderBy: { startTime: "asc" },
    });

    let chainOrders: ChainOrder[];
    try {
      chainOrders = await getAllChainOrders(walletAddress);
    } catch (e) {
      results.push({
        wallet: walletAddress,
        total: dbOrders.length,
        updated: 0,
        unmatched: dbOrders.length,
        errors: [`chain read failed: ${e}`],
      });
      continue;
    }

    let updated = 0;
    let unmatched = 0;
    const errors: string[] = [];

    for (const dbOrder of dbOrders) {
      const dbStartMs = dbOrder.startTime.getTime();

      // 找链上 startTime 最近的订单
      let best: ChainOrder | null = null;
      let bestDiff = Infinity;
      for (const co of chainOrders) {
        const diff = Math.abs(co.startTime.getTime() - dbStartMs);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = co;
        }
      }

      if (!best || bestDiff > MATCH_TOLERANCE_MS) {
        unmatched++;
        errors.push(`no match for txHash=${dbOrder.txHash} (dbStart=${dbOrder.startTime.toISOString()})`);
        continue;
      }

      const newMode = best.isCoinBased ? "coin" : "fiat";

      // 只在有差异时更新
      const same =
        Math.abs(dbOrder.amount - best.vvvAmountIn) < 0.001 &&
        Math.abs(dbOrder.usdValue - best.usdValue) < 0.001 &&
        Math.abs(dbOrder.dailyRate - best.dailyRatePct) < 0.0001 &&
        dbOrder.mode === newMode;

      if (same) continue;

      try {
        await prisma.stakeOrder.update({
          where: { txHash: dbOrder.txHash },
          data: {
            amount: best.vvvAmountIn,
            usdValue: best.usdValue,
            dailyRate: best.dailyRatePct,
            mode: newMode,
            startTime: best.startTime,
            endTime: best.endTime,
          },
        });
        updated++;
      } catch (e) {
        errors.push(`update failed for ${dbOrder.txHash}: ${e}`);
      }
    }

    results.push({ wallet: walletAddress, total: dbOrders.length, updated, unmatched, errors });
  }

  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  const totalUnmatched = results.reduce((s, r) => s + r.unmatched, 0);

  return NextResponse.json({ ok: true, totalUpdated, totalUnmatched, details: results });
}
