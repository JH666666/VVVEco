// ──── VVVEco API Client ────
// API-first with localStorage fallback

import type { SimStakeOrder, SimClaimRecord, SimTeamRewardRecord } from "@/contexts/local-web3-sim-context";

// ═══════════════════════════════════════════
// Stake Orders
// ═══════════════════════════════════════════
export async function fetchStakeOrders(walletAddress: string): Promise<SimStakeOrder[]> {
  try {
    const res = await fetch(`/api/stake-orders?wallet=${encodeURIComponent(walletAddress)}&pageSize=100`);
    if (!res.ok) throw new Error("API failed");
    const data = await res.json();
    return (data.items ?? []).map((item: Record<string, unknown>) => ({
      id: String(item.txHash ?? ""),
      account: String(item.walletAddress ?? ""),
      mode: (item.mode as "coin" | "fiat") ?? "coin",
      amount: Number(item.amount ?? 0),
      usdValue: Number(item.usdValue ?? 0),
      period: Number(item.period ?? 0),
      periodUnit: (item.periodUnit as "day" | "hour") ?? "day",
      dailyRate: Number(item.dailyRate ?? 0),
      createdAt: String(item.startTime ?? ""),
      createdAtMs: item.startTime ? new Date(String(item.startTime)).getTime() : Date.now(),
      endTime: item.endTime ? String(item.endTime) : undefined,
      txHash: String(item.txHash ?? ""),
      isWithdrawn: Boolean(item.isWithdrawn ?? false),
    }));
  } catch {
    return [];
  }
}

export async function createStakeOrder(order: SimStakeOrder): Promise<boolean> {
  try {
    const res = await fetch("/api/stake-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txHash: order.txHash,
        walletAddress: order.account,
        mode: order.mode,
        amount: order.amount,
        usdValue: order.usdValue,
        period: order.period,
        periodUnit: order.periodUnit ?? "day",
        dailyRate: order.dailyRate,
        startTime: order.createdAt,
        endTime: order.endTime,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════
// Claim Records
// ═══════════════════════════════════════════
export async function fetchClaimRecords(walletAddress: string): Promise<SimClaimRecord[]> {
  try {
    const res = await fetch(`/api/claims?wallet=${encodeURIComponent(walletAddress)}&pageSize=100`);
    if (!res.ok) throw new Error("API failed");
    const data = await res.json();
    return (data.items ?? []).map((item: Record<string, unknown>) => ({
      id: String(item.txHash ?? ""),
      orderId: String(item.orderTxHash ?? ""),
      account: String(item.walletAddress ?? ""),
      amount: Number(item.amount ?? 0),
      amountVvv: Number(item.amountVvv ?? 0),
      amountUsd: Number(item.amountUsd ?? 0),
      priceUsd: Number(item.priceAtClaim ?? 0.2),
      createdAt: String(item.createdAt ?? ""),
      createdAtMs: item.createdAt ? new Date(String(item.createdAt)).getTime() : Date.now(),
    }));
  } catch {
    return [];
  }
}

export async function createClaimRecord(claim: SimClaimRecord): Promise<boolean> {
  try {
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txHash: claim.id,
        orderTxHash: claim.orderId,
        walletAddress: claim.account,
        amount: claim.amount,
        amountVvv: claim.amountVvv ?? claim.amount,
        amountUsd: claim.amountUsd ?? claim.amount * (claim.priceUsd ?? 0.2),
        priceAtClaim: claim.priceUsd ?? 0.2,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════
// Team Rewards
// ═══════════════════════════════════════════
const mapTeamRewardItem = (item: Record<string, unknown>): SimTeamRewardRecord => {
  const source = (item.source as Record<string, unknown>) ?? {};
  const sourceOrder = (item.sourceOrder as Record<string, unknown>) ?? {};
  return {
    id: String(item.id ?? ""),
    claimId: String(item.claimTxHash ?? ""),
    type: (item.rewardType as "level" | "peer" | "generation") ?? "generation",
    generation: typeof item.generation === "number" ? item.generation : undefined,
    beneficiary: String(item.beneficiaryAddr ?? ""),
    sourceAccount: String(source.walletAddress ?? ""),
    sourceOrderId: String(sourceOrder.txHash ?? ""),
    sourceClaimAmount: 0,
    sourceClaimAmountVvv: 0,
    rate: Number(item.rate ?? 0),
    amount: Number(item.amount ?? 0),
    claimed: Boolean(item.claimed ?? false),
    createdAt: String(item.createdAt ?? ""),
    createdAtMs: item.createdAt ? new Date(String(item.createdAt)).getTime() : Date.now(),
    claimedAt: item.claimedAt ? String(item.claimedAt) : undefined,
    claimedAtMs: item.claimedAt ? new Date(String(item.claimedAt)).getTime() : undefined,
  };
};

export async function fetchTeamRewards(beneficiary: string): Promise<SimTeamRewardRecord[]> {
  // 必须翻页拉全部记录：路由把 pageSize 上限截断到 100，若某上级团队奖励 >100 条，
  // 只取最新 100 条会让"贡献奖励"算小，且每有新领取就把最旧一条挤出窗口 → 数值看起来减少。
  // 这里循环把所有页拉完，保证贡献奖励=全部记录之和，稳定不跳。
  try {
    const PAGE_SIZE = 100;
    const first = await fetch(
      `/api/team-rewards?beneficiary=${encodeURIComponent(beneficiary)}&pageSize=${PAGE_SIZE}&page=1`
    );
    if (!first.ok) throw new Error("API failed");
    const firstData = await first.json();
    const items: Record<string, unknown>[] = [...(firstData.items ?? [])];
    const totalPages: number = Math.max(1, Number(firstData.pagination?.totalPages ?? 1));

    for (let page = 2; page <= totalPages; page++) {
      const res = await fetch(
        `/api/team-rewards?beneficiary=${encodeURIComponent(beneficiary)}&pageSize=${PAGE_SIZE}&page=${page}`
      );
      if (!res.ok) break;
      const data = await res.json();
      items.push(...(data.items ?? []));
    }

    return items.map(mapTeamRewardItem);
  } catch {
    return [];
  }
}

export interface TeamRewardSummary {
  total: number; // 该上级团队奖励总额（VVV）
  pendingVvv: number;
  claimedVvv: number;
  bySource: Record<string, number>; // 每个下级地址 → 贡献奖励之和
}

// 聚合口径：数据库一次算完总额+按下级分组，前端不再拉全部明细（数据再多也不卡）。
export async function fetchTeamRewardSummary(beneficiary: string): Promise<TeamRewardSummary | null> {
  try {
    const res = await fetch(
      `/api/team-rewards?beneficiary=${encodeURIComponent(beneficiary)}&summary=1`
    );
    if (!res.ok) throw new Error("API failed");
    const data = await res.json();
    const s = data.summary as Partial<TeamRewardSummary> | undefined;
    if (!s) return null;
    const bySource: Record<string, number> = {};
    for (const [k, v] of Object.entries(s.bySource ?? {})) bySource[k.toLowerCase()] = Number(v ?? 0);
    return {
      total: Number(s.total ?? 0),
      pendingVvv: Number(s.pendingVvv ?? 0),
      claimedVvv: Number(s.claimedVvv ?? 0),
      bySource,
    };
  } catch {
    return null;
  }
}

export async function claimTeamRewardsAPI(beneficiary: string): Promise<number> {
  try {
    const res = await fetch("/api/team-rewards/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryAddr: beneficiary }),
    });
    if (!res.ok) throw new Error("API failed");
    const data = await res.json();
    return Number(data.totalVvv ?? 0);
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════
// Invite Relations
// ═══════════════════════════════════════════
export async function fetchInviteChildren(walletAddress: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`/api/invite/list?wallet=${encodeURIComponent(walletAddress)}`);
    if (!res.ok) throw new Error("API failed");
    const data = await res.json();
    const referrals: Record<string, string> = {};
    if (data.boundTo?.parentAddress) {
      referrals[walletAddress] = data.boundTo.parentAddress;
    }
    for (const child of data.children ?? []) {
      referrals[String(child.walletAddress)] = walletAddress;
    }
    return referrals;
  } catch {
    return {};
  }
}

// ═══════════════════════════════════════════
// Users
// ═══════════════════════════════════════════
export async function fetchUser(walletAddress: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(walletAddress)}`);
    if (!res.ok) throw new Error("API failed");
    return await res.json();
  } catch {
    return null;
  }
}

export async function registerUser(walletAddress: string, referrerCode?: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, referrerCode }),
    });
    if (!res.ok) throw new Error("API failed");
    return await res.json();
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════
export async function fetchNotificationsAPI(): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch("/api/notifications");
    if (!res.ok) throw new Error("API failed");
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}
