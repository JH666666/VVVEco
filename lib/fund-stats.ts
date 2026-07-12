/**
 * Shared fund-statistics computation for the shareholder self-query page.
 * Returns the querent's own personal + downline (15-layer) figures with
 * detail breakdowns. No platform-wide data is exposed.
 *
 * 口径说明：
 *  - 入金 = 累计质押金额 (stake_orders.usd_value)
 *  - 出金 = 领取收益 + 已支付团队奖励 + 赎回本金 (均为税前 gross 金额)
 *  - 差额 = 出金 - 入金
 *  - 团队 = 当前地址下方第 1~TEAM_STAT_LAYERS 层，地址去重、去环、排除本人
 */
import { prisma } from "@/lib/prisma";

// 资金统计的团队层数（仅影响入金/出金统计口径，不改变佣金结算层数）
export const TEAM_STAT_LAYERS = 15;

export interface WithdrawBreakdown {
  claimReward: number; // 领取收益
  teamReward: number; // 团队奖励（分享/等级/平级，已支付）
  redeemed: number; // 赎回本金
}

export interface FundBlock {
  deposit: number;
  withdraw: number;
  net: number;
  stakeActiveUsd: number; // 质押业绩 = 当前有效质押（未赎回且未到期）
  breakdown: WithdrawBreakdown;
}

export interface PersonalOrderDetail {
  id: string; // shortened tx hash
  mode: "coin" | "fiat";
  usdValue: number;
  period: number;
  periodUnit: string;
  startTime: string; // formatted YYYY-MM-DD HH:mm
  status: "进行中" | "已完成";
}

export interface TeamMemberDetail {
  address: string;
  displayAddress: string;
  level: number;
  deposit: number;
  withdraw: number;
}

export interface FundDetail {
  found: boolean;
  address: string;
  uid: number | null;
  personal: FundBlock;
  team: FundBlock & { memberCount: number };
  personalOrders: PersonalOrderDetail[];
  teamMembers: TeamMemberDetail[];
}

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * BFS downline referrals up to `maxLevel` levels.
 * visited-set dedupes addresses and prevents referral cycles / self-recount.
 */
async function collectTeam(rootAddr: string, maxLevel: number): Promise<Array<{ address: string; level: number }>> {
  const result: Array<{ address: string; level: number }> = [];
  let frontier = [rootAddr];
  const visited = new Set([rootAddr]);

  for (let level = 1; level <= maxLevel && frontier.length > 0; level++) {
    const children = await prisma.user.findMany({
      where: { referrerAddress: { in: frontier } },
      select: { walletAddress: true },
    });
    frontier = [];
    for (const child of children) {
      if (!visited.has(child.walletAddress)) {
        visited.add(child.walletAddress);
        result.push({ address: child.walletAddress, level });
        frontier.push(child.walletAddress);
      }
    }
  }
  return result;
}

/** Raw per-address fund rows for a set of wallet addresses. */
async function fetchRaw(addresses: string[]) {
  if (addresses.length === 0) {
    return { orders: [], claims: [], rewards: [] } as {
      orders: { walletAddress: string; usdValue: number; isWithdrawn: boolean; endTime: Date }[];
      claims: { walletAddress: string; amountUsd: number }[];
      rewards: { beneficiaryAddr: string; amount: number }[];
    };
  }
  const [orders, claims, rewards] = await Promise.all([
    prisma.stakeOrder.findMany({
      where: { walletAddress: { in: addresses } },
      select: { walletAddress: true, usdValue: true, isWithdrawn: true, endTime: true },
    }),
    prisma.claimRecord.findMany({
      where: { walletAddress: { in: addresses } },
      select: { walletAddress: true, amountUsd: true },
    }),
    prisma.teamReward.findMany({
      where: { beneficiaryAddr: { in: addresses }, claimed: true },
      select: { beneficiaryAddr: true, amount: true },
    }),
  ]);
  return { orders, claims, rewards };
}

function toBlock(
  raw: Awaited<ReturnType<typeof fetchRaw>>,
  now: number,
): FundBlock {
  const deposit = raw.orders.reduce((s, o) => s + o.usdValue, 0);
  const redeemed = raw.orders.filter((o) => o.isWithdrawn).reduce((s, o) => s + o.usdValue, 0);
  // 质押业绩 = 当前有效质押（未赎回且未到期）
  const stakeActiveUsd = raw.orders
    .filter((o) => !o.isWithdrawn && o.endTime.getTime() > now)
    .reduce((s, o) => s + o.usdValue, 0);
  const claimReward = raw.claims.reduce((s, c) => s + c.amountUsd, 0);
  const teamReward = raw.rewards.reduce((s, r) => s + r.amount, 0);
  const withdraw = claimReward + teamReward + redeemed;
  return {
    deposit,
    withdraw,
    net: withdraw - deposit,
    stakeActiveUsd,
    breakdown: { claimReward, teamReward, redeemed },
  };
}

/** Compute personal + team fund detail for a single wallet address. */
export async function computeFundDetail(walletInput: string): Promise<FundDetail> {
  const address = walletInput.trim().toLowerCase();

  const emptyBlock: FundBlock = {
    deposit: 0,
    withdraw: 0,
    net: 0,
    stakeActiveUsd: 0,
    breakdown: { claimReward: 0, teamReward: 0, redeemed: 0 },
  };
  const empty: FundDetail = {
    found: false,
    address,
    uid: null,
    personal: emptyBlock,
    team: { ...emptyBlock, memberCount: 0 },
    personalOrders: [],
    teamMembers: [],
  };

  if (!/^0x[a-f0-9]{40}$/.test(address)) return empty;

  const user = await prisma.user.findUnique({
    where: { walletAddress: address },
    select: { walletAddress: true, uid: true },
  });
  if (!user) return empty;

  const now = Date.now();

  // ── 个人 ──
  const personalRaw = await fetchRaw([address]);
  const personal = toBlock(personalRaw, now);

  const orderRows = await prisma.stakeOrder.findMany({
    where: { walletAddress: address },
    orderBy: { startTime: "desc" },
    select: {
      txHash: true,
      mode: true,
      usdValue: true,
      period: true,
      periodUnit: true,
      startTime: true,
      endTime: true,
      isWithdrawn: true,
    },
  });
  const personalOrders: PersonalOrderDetail[] = orderRows.map((o) => ({
    id: `${o.txHash.slice(0, 8)}...${o.txHash.slice(-4)}`,
    mode: o.mode as "coin" | "fiat",
    usdValue: o.usdValue,
    period: o.period,
    periodUnit: o.periodUnit ?? "day",
    startTime: formatDate(o.startTime),
    status: !o.isWithdrawn && o.endTime.getTime() > now ? "进行中" : "已完成",
  }));

  // ── 团队 (1~15 层，去重去环排除本人) ──
  const members = await collectTeam(address, TEAM_STAT_LAYERS);
  const memberAddrs = members.map((m) => m.address);
  const teamRaw = await fetchRaw(memberAddrs);
  const team = toBlock(teamRaw, now);

  // 逐成员拆分
  const depositBy: Record<string, number> = {};
  const withdrawBy: Record<string, number> = {};
  for (const o of teamRaw.orders) {
    depositBy[o.walletAddress] = (depositBy[o.walletAddress] ?? 0) + o.usdValue;
    if (o.isWithdrawn) withdrawBy[o.walletAddress] = (withdrawBy[o.walletAddress] ?? 0) + o.usdValue;
  }
  for (const c of teamRaw.claims) {
    withdrawBy[c.walletAddress] = (withdrawBy[c.walletAddress] ?? 0) + c.amountUsd;
  }
  for (const r of teamRaw.rewards) {
    withdrawBy[r.beneficiaryAddr] = (withdrawBy[r.beneficiaryAddr] ?? 0) + r.amount;
  }

  const teamMembers: TeamMemberDetail[] = members
    .map((m) => ({
      address: m.address,
      displayAddress: shortAddr(m.address),
      level: m.level,
      deposit: depositBy[m.address] ?? 0,
      withdraw: withdrawBy[m.address] ?? 0,
    }))
    .sort((a, b) => b.deposit - a.deposit || a.level - b.level);

  return {
    found: true,
    address,
    uid: user.uid,
    personal,
    team: { ...team, memberCount: members.length },
    personalOrders,
    teamMembers,
  };
}
