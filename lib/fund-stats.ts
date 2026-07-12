/**
 * Shared fund-statistics computation.
 * Returns ONLY aggregate deposit/withdraw/net figures for a wallet and its
 * downline — no member addresses, no order details, no platform-wide data.
 * Used by the admin user detail and the public shareholder self-query page.
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

export interface FundStats {
  found: boolean;
  address: string;
  uid: number | null;
  personalDepositUsd: number;
  personalWithdrawUsd: number;
  personalNetUsd: number;
  teamDepositUsd: number;
  teamWithdrawUsd: number;
  teamNetUsd: number;
  teamMemberCount: number;
}

/**
 * BFS downline referrals up to `maxLevel` levels.
 * visited-set dedupes addresses and prevents referral cycles / self-recount.
 */
async function collectTeamAddresses(rootAddr: string, maxLevel: number): Promise<string[]> {
  const result: string[] = [];
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
        result.push(child.walletAddress);
        frontier.push(child.walletAddress);
      }
    }
  }
  return result;
}

/** Aggregate gross deposit / withdraw for a set of wallet addresses. */
async function aggregateFunds(addresses: string[]): Promise<{ deposit: number; withdraw: number }> {
  if (addresses.length === 0) return { deposit: 0, withdraw: 0 };

  const [orders, claims, rewards] = await Promise.all([
    // 入金 + 赎回本金
    prisma.stakeOrder.findMany({
      where: { walletAddress: { in: addresses } },
      select: { usdValue: true, isWithdrawn: true },
    }),
    // 领取收益（税前 amountUsd，每笔独立 txHash 无重复）
    prisma.claimRecord.findMany({
      where: { walletAddress: { in: addresses } },
      select: { amountUsd: true },
    }),
    // 分享 / 等级 / 平级收益：仅统计已支付 (claimed)
    prisma.teamReward.findMany({
      where: { beneficiaryAddr: { in: addresses }, claimed: true },
      select: { amount: true },
    }),
  ]);

  const deposit = orders.reduce((s, o) => s + o.usdValue, 0);
  const redeemed = orders.filter((o) => o.isWithdrawn).reduce((s, o) => s + o.usdValue, 0);
  const claimReward = claims.reduce((s, c) => s + c.amountUsd, 0);
  const rewardPaid = rewards.reduce((s, r) => s + r.amount, 0);
  const withdraw = claimReward + rewardPaid + redeemed;

  return { deposit, withdraw };
}

/** Compute personal + team fund statistics for a single wallet address. */
export async function computeFundStats(walletInput: string): Promise<FundStats> {
  const address = walletInput.trim().toLowerCase();

  const empty: FundStats = {
    found: false,
    address,
    uid: null,
    personalDepositUsd: 0,
    personalWithdrawUsd: 0,
    personalNetUsd: 0,
    teamDepositUsd: 0,
    teamWithdrawUsd: 0,
    teamNetUsd: 0,
    teamMemberCount: 0,
  };

  if (!/^0x[a-f0-9]{40}$/.test(address)) return empty;

  const user = await prisma.user.findUnique({
    where: { walletAddress: address },
    select: { walletAddress: true, uid: true },
  });
  if (!user) return empty;

  // 个人（仅本人地址）
  const personal = await aggregateFunds([address]);

  // 团队（下方 1~15 层，去重去环排除本人）
  const teamAddresses = await collectTeamAddresses(address, TEAM_STAT_LAYERS);
  const team = await aggregateFunds(teamAddresses);

  return {
    found: true,
    address,
    uid: user.uid,
    personalDepositUsd: personal.deposit,
    personalWithdrawUsd: personal.withdraw,
    personalNetUsd: personal.withdraw - personal.deposit,
    teamDepositUsd: team.deposit,
    teamWithdrawUsd: team.withdraw,
    teamNetUsd: team.withdraw - team.deposit,
    teamMemberCount: teamAddresses.length,
  };
}
