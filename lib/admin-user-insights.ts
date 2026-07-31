'use client'

import {
  SIM_VVV_USD_PRICE,
  formatSimAddress,
  getSimInviteCode,
  readStoredSimAccounts,
  type SimClaimRecord,
  type SimStakeMode,
  type SimStakeOrder,
  type SimTeamRewardRecord,
} from '@/contexts/local-web3-sim-context'
import { readRewardConfig } from '@/lib/reward-config'
import { getUserLevelOverride, readUserLevelOverrides } from '@/lib/user-level-overrides'

const LOCAL_WEB3_SIM_STORAGE_KEY = 'vvveco-local-web3-sim'
const DAY_MS = 24 * 60 * 60 * 1000
// 资金统计的团队层数（仅影响入金/出金统计口径，不改变佣金结算层数）
const TEAM_STAT_LAYERS = 15

interface SimStorageState {
  referrals?: Record<string, string>
  stakes?: SimStakeOrder[]
  claims?: SimClaimRecord[]
  teamRewards?: SimTeamRewardRecord[]
}

export interface UserStakeInsight {
  id: string
  mode: SimStakeMode
  amount: number
  usdValue: number
  period: number
  periodUnit?: 'day' | 'hour'
  dailyRate: number
  createdAt: string
  startsAt: string
  expiresAt: string
  claimed: number
  claimedUsd: number
  pending: number
  pendingUsd: number
  totalExpected: number
  progressPercent: number
  status: '进行中' | '已完成'
  hiddenByAdmin: boolean
}

export interface TeamUserInsight {
  address: string
  displayAddress: string
  level: number
  stakeUsd: number
  orderCount: number
}

export interface UserInsight {
  uid: number
  address: string
  displayAddress: string
  accountLabel: string
  inviteCode: string
  registeredAt: string
  registeredAtMs: number | null
  referrer: string
  referrerDisplay: string
  referrerUid?: number | null
  directCount: number
  teamCount: number
  teamStakeUsd: number
  totalStakedUsd: number
  totalRedeemedUsd: number
  totalClaimedUsd: number
  totalPendingUsd: number
  personalClaimedUsd: number
  personalPendingUsd: number
  teamClaimedUsd: number
  teamPendingUsd: number
  teamRewardUsd: number
  personalDepositUsd?: number
  personalWithdrawUsd?: number
  personalNetUsd?: number
  teamDepositUsd?: number
  teamWithdrawUsd?: number
  teamNetUsd?: number
  autoLevel?: number
  manualLevel?: number | null
  chainLevel?: number
  effectiveLevel: number
  orderCount: number
  activeOrderCount: number
  completedOrderCount: number
  orders: UserStakeInsight[]
  team: TeamUserInsight[]
}

export interface UserListInsight {
  uid: number
  address: string
  displayAddress: string
  accountLabel: string
  inviteCode: string
  registeredAt: string
  registeredAtMs: number | null
  referrerDisplay: string
  directCount: number
  teamCount: number
  totalStakedUsd: number
  activeStakedUsd: number
  totalRedeemedUsd: number
  totalClaimedUsd: number
  totalPendingUsd: number
  autoLevel?: number
  manualLevel?: number | null
  chainLevel?: number
  effectiveLevel: number
  orderCount: number
  activeOrderCount: number
}

function readSimState(): Required<Pick<SimStorageState, 'referrals' | 'stakes' | 'claims' | 'teamRewards'>> {
  if (typeof window === 'undefined') {
    return { referrals: {}, stakes: [], claims: [], teamRewards: [] }
  }

  try {
    const stored = window.localStorage.getItem(LOCAL_WEB3_SIM_STORAGE_KEY)
    const parsed = stored ? (JSON.parse(stored) as SimStorageState) : {}

    return {
      referrals: parsed.referrals ?? {},
      stakes: Array.isArray(parsed.stakes) ? parsed.stakes : [],
      claims: Array.isArray(parsed.claims) ? parsed.claims : [],
      teamRewards: Array.isArray(parsed.teamRewards) ? parsed.teamRewards : [],
    }
  } catch {
    return { referrals: {}, stakes: [], claims: [], teamRewards: [] }
  }
}

function parseOrderDate(value: string) {
  const parsed = Date.parse(value)
  if (Number.isFinite(parsed)) return parsed

  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
  if (!match) return Date.now()

  const [, year, month, day, hour, minute, second] = match
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ).getTime()
}

function rewardToUsd(mode: SimStakeMode, amount: number) {
  return mode === 'coin' ? amount * SIM_VVV_USD_PRICE : amount
}

function claimToUsd(claim: SimClaimRecord, order: SimStakeOrder) {
  if (typeof claim.amountUsd === 'number') return claim.amountUsd
  return order.mode === 'coin' ? claim.amount * (claim.priceUsd ?? SIM_VVV_USD_PRICE) : claim.amount
}

function getOrderDurationMs(order: Pick<SimStakeOrder, 'period' | 'periodUnit'>) {
  return order.period * (order.periodUnit === 'hour' ? 60 * 60 * 1000 : DAY_MS)
}

function redeemedToUsd(order: SimStakeOrder) {
  const record = order as SimStakeOrder & {
    redeemedUsd?: number
    withdrawn?: boolean
    principalWithdrawn?: boolean
  }

  if (typeof record.redeemedUsd === 'number') return Math.max(0, record.redeemedUsd)
  return record.withdrawn || record.principalWithdrawn ? order.usdValue : 0
}

function collectKnownAddresses(state: ReturnType<typeof readSimState>) {
  const addresses = new Set<string>()

  readStoredSimAccounts().forEach(account => addresses.add(account.address))
  state.stakes.forEach(order => addresses.add(order.account))
  Object.entries(state.referrals).forEach(([child, parent]) => {
    addresses.add(child)
    addresses.add(parent)
  })

  return Array.from(addresses)
}

function getUserUid(address: string): number {
  const accounts = readStoredSimAccounts()
  const account = accounts.find(item => item.address.toLowerCase() === address.toLowerCase())
  return account?.uid ?? 0
}

function resolveAddressByUid(uid: number): string {
  const accounts = readStoredSimAccounts()
  const account = accounts.find(item => item.uid === uid)
  return account?.address ?? ''
}

function getRegisteredInviteCode(address: string, registeredAtMs: number | null) {
  return registeredAtMs ? getSimInviteCode(address) : ''
}

function resolveUserAddress(input: string, state: ReturnType<typeof readSimState>) {
  const trimmed = input.trim()
  if (!trimmed) return ''

  // UID lookup: pure numeric input → resolve to address
  const uidInput = parseInt(trimmed, 10)
  if (/^\d+$/.test(trimmed) && Number.isFinite(uidInput) && uidInput >= 100001) {
    const addressByUid = resolveAddressByUid(uidInput)
    if (addressByUid) return addressByUid
  }

  const normalized = trimmed.toLowerCase()
  const normalizedInviteInput = trimmed.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  const knownAddress = collectKnownAddresses(state).find(address => {
    const account = readStoredSimAccounts().find(item => item.address.toLowerCase() === address.toLowerCase())
    const registeredAtMs = getRegisteredAtMs(address, state)
    const inviteCode = getRegisteredInviteCode(address, registeredAtMs).toLowerCase()

    return normalized === address.toLowerCase()
      || normalized === account?.shortAddress.toLowerCase()
      || normalizedInviteInput === account?.id.toLowerCase().replace(/[^a-z0-9]/g, '')
      || normalizedInviteInput === account?.label.toLowerCase().replace(/[^a-z0-9]/g, '')
      || (inviteCode && normalizedInviteInput === inviteCode)
  })

  if (knownAddress) return knownAddress

  const fromStake = state.stakes.find(order => order.account.toLowerCase() === normalized)?.account
  if (fromStake) return fromStake

  const fromReferralChild = Object.keys(state.referrals).find(address => address.toLowerCase() === normalized)
  if (fromReferralChild) return fromReferralChild

  const fromReferralParent = Object.values(state.referrals).find(address => address.toLowerCase() === normalized)
  if (fromReferralParent) return fromReferralParent

  return /^0x[a-f0-9]{40}$/i.test(trimmed) ? trimmed : ''
}

function getAccountLabel(address: string) {
  const account = readStoredSimAccounts().find(item => item.address.toLowerCase() === address.toLowerCase())
  return account ? `${account.label} · ${account.role}` : '外部钱包地址'
}

function formatRegisteredAt(value: number | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未注册'
}

function formatOrderDateTime(value: number) {
  return Number.isFinite(value)
    ? new Date(value).toLocaleString('zh-CN', { hour12: false })
    : '-'
}

function getRegisteredAtMs(address: string, state: ReturnType<typeof readSimState>) {
  const normalized = address.toLowerCase()
  const orderTimes = state.stakes
    .filter(order => order.account.toLowerCase() === normalized)
    .map(order => order.createdAtMs ?? parseOrderDate(order.createdAt))
  const claimTimes = state.claims
    .filter(claim => claim.account.toLowerCase() === normalized)
    .map(claim => claim.createdAtMs)
  const timestamps = [...orderTimes, ...claimTimes].filter(time => Number.isFinite(time) && time > 0)

  return timestamps.length > 0 ? Math.min(...timestamps) : null
}

function collectTeam(address: string, referrals: Record<string, string>, level = 1, maxLevel = 7): TeamUserInsight[] {
  if (level > maxLevel) return []

  return Object.entries(referrals)
    .filter(([, parent]) => parent.toLowerCase() === address.toLowerCase())
    .flatMap(([child]) => [
      {
        address: child,
        displayAddress: formatSimAddress(child),
        level,
        stakeUsd: 0,
        orderCount: 0,
      },
      ...collectTeam(child, referrals, level + 1, maxLevel),
    ])
}

function calculateLevel(teamStakeUsd: number, thresholds: number[]) {
  for (let index = thresholds.length - 1; index >= 0; index -= 1) {
    if (teamStakeUsd >= (thresholds[index] ?? 0)) return index + 1
  }

  return 1
}

export function getUserInsight(
  input: string,
  nowMs = Date.now(),
  vvvUsdPrice = SIM_VVV_USD_PRICE,
): UserInsight | null {
  const state = readSimState()
  const address = resolveUserAddress(input, state)

  if (!address) return null

  const userOrders = state.stakes.filter(order => order.account.toLowerCase() === address.toLowerCase())
  const orders = userOrders.map(order => {
    const claims = state.claims.filter(claim => claim.orderId === order.id)
    const claimed = claims.reduce((sum, claim) => sum + claim.amount, 0)
    const periodReward = order.mode === 'coin'
      ? order.amount * (order.dailyRate / 100)
      : order.usdValue * (order.dailyRate / 100)
    const startMs = order.createdAtMs ?? parseOrderDate(order.createdAt)
    const periodMs = getOrderDurationMs(order)
    const expiresAtMs = startMs + periodMs
    const unitMs = order.periodUnit === 'hour' ? 60 * 60 * 1000 : DAY_MS
    const elapsedMs = Math.max(0, nowMs - startMs)
    const totalExpected = periodReward * order.period
    const accrued = Math.min(totalExpected, periodReward * (elapsedMs / unitMs))
    const pending = Math.max(0, accrued - claimed)
    const progressPercent = Math.min(100, Math.max(0, (elapsedMs / periodMs) * 100))

    return {
      id: order.id,
      mode: order.mode,
      amount: order.amount,
      usdValue: order.usdValue,
      period: order.period,
      periodUnit: order.periodUnit ?? 'day',
      dailyRate: order.dailyRate,
      createdAt: order.createdAt,
      startsAt: formatOrderDateTime(startMs),
      expiresAt: formatOrderDateTime(expiresAtMs),
      claimed,
      claimedUsd: claims.reduce((sum, claim) => sum + claimToUsd(claim, order), 0),
      pending,
      pendingUsd: rewardToUsd(order.mode, pending),
      totalExpected,
      progressPercent,
      status: elapsedMs >= periodMs ? '已完成' as const : '进行中' as const,
      hiddenByAdmin: (order as { hiddenByAdmin?: boolean }).hiddenByAdmin ?? false,
    }
  })

  const team = collectTeam(address, state.referrals).map(member => {
    const memberOrders = state.stakes.filter(order => order.account.toLowerCase() === member.address.toLowerCase())
    return {
      ...member,
      stakeUsd: memberOrders.reduce((sum, order) => sum + order.usdValue, 0),
      orderCount: memberOrders.length,
    }
  })

  const directCount = Object.values(state.referrals)
    .filter(parent => parent.toLowerCase() === address.toLowerCase())
    .length
  const referrer = state.referrals[address] ?? ''
  const registeredAtMs = getRegisteredAtMs(address, state)
  const personalClaimedUsd = orders.reduce((sum, order) => sum + order.claimedUsd, 0)
  const personalPendingUsd = orders.reduce((sum, order) => sum + order.pendingUsd, 0)
  const userTeamRewards = state.teamRewards.filter(
    reward => reward.beneficiary.toLowerCase() === address.toLowerCase(),
  )
  // 团队奖励自动发放到上级钱包（claimed 恒为 false），记录即已支付；
  // amount 为 VVV，按传入的实时价格换算成 USD。
  const teamRewardUsd = userTeamRewards.reduce((sum, reward) => sum + reward.amount * vvvUsdPrice, 0)
  const teamClaimedUsd = teamRewardUsd // 全部视为已支付
  const teamPendingUsd = 0
  const totalClaimedUsd = personalClaimedUsd + teamClaimedUsd
  const totalPendingUsd = personalPendingUsd + teamPendingUsd
  const totalRedeemedUsd = userOrders.reduce((sum, order) => sum + redeemedToUsd(order), 0)
  const inviteCode = getRegisteredInviteCode(address, registeredAtMs)
  const teamStakeUsd = team.reduce((sum, member) => sum + member.stakeUsd, 0)
  const rewardConfig = readRewardConfig()
  const levelOverrides = readUserLevelOverrides()
  const autoLevel = calculateLevel(teamStakeUsd, rewardConfig.levelThresholds)
  const manualLevel = getUserLevelOverride(address, levelOverrides)
  const effectiveLevel = manualLevel ?? autoLevel

  // ── 个人资金统计 ──
  // 入金 = 累计质押；出金 = 领取收益 + 团队各类奖励(已支付) + 赎回本金
  const personalDepositUsd = userOrders.reduce((sum, order) => sum + order.usdValue, 0)
  const personalWithdrawUsd = personalClaimedUsd + teamClaimedUsd + totalRedeemedUsd
  const personalNetUsd = personalWithdrawUsd - personalDepositUsd

  // ── 团队资金统计 (下方第 1~TEAM_STAT_LAYERS 层，地址去重、单一父级天然去环) ──
  const teamStatMembers = collectTeam(address, state.referrals, 1, TEAM_STAT_LAYERS)
  const teamStatAddresses = new Set(teamStatMembers.map(member => member.address.toLowerCase()))
  const teamStatOrders = state.stakes.filter(order => teamStatAddresses.has(order.account.toLowerCase()))
  const teamStatOrderIds = new Set(teamStatOrders.map(order => order.id))
  const teamDepositUsd = teamStatOrders.reduce((sum, order) => sum + order.usdValue, 0)
  const teamRedeemedUsd = teamStatOrders.reduce((sum, order) => sum + redeemedToUsd(order), 0)
  const teamClaimRewardUsd = state.claims
    .filter(claim => teamStatOrderIds.has(claim.orderId))
    .reduce((sum, claim) => {
      const order = teamStatOrders.find(item => item.id === claim.orderId)
      return sum + (order ? claimToUsd(claim, order) : 0)
    }, 0)
  const teamRewardPaidUsd = state.teamRewards
    .filter(reward => teamStatAddresses.has(reward.beneficiary.toLowerCase()))
    .reduce((sum, reward) => sum + reward.amount * vvvUsdPrice, 0)
  const teamWithdrawUsd = teamClaimRewardUsd + teamRewardPaidUsd + teamRedeemedUsd
  const teamNetUsd = teamWithdrawUsd - teamDepositUsd

  return {
    uid: getUserUid(address),
    address,
    displayAddress: formatSimAddress(address),
    accountLabel: getAccountLabel(address),
    inviteCode,
    registeredAt: formatRegisteredAt(registeredAtMs),
    registeredAtMs,
    referrer,
    referrerDisplay: referrer ? formatSimAddress(referrer) : '无',
    directCount,
    teamCount: team.length,
    teamStakeUsd,
    totalStakedUsd: userOrders.reduce((sum, order) => sum + order.usdValue, 0),
    totalRedeemedUsd,
    totalClaimedUsd,
    totalPendingUsd,
    personalClaimedUsd,
    personalPendingUsd,
    teamClaimedUsd,
    teamPendingUsd,
    teamRewardUsd,
    personalDepositUsd,
    personalWithdrawUsd,
    personalNetUsd,
    teamDepositUsd,
    teamWithdrawUsd,
    teamNetUsd,
    autoLevel,
    manualLevel,
    effectiveLevel,
    orderCount: orders.length,
    activeOrderCount: orders.filter(order => order.status === '进行中').length,
    completedOrderCount: orders.filter(order => order.status === '已完成').length,
    orders,
    team,
  }
}

export function getAllUserInsights(nowMs = Date.now()): UserListInsight[] {
  const state = readSimState()

  return collectKnownAddresses(state)
    .map(address => getUserInsight(address, nowMs))
    .filter((item): item is UserInsight => Boolean(item))
    .map(item => ({
      uid: item.uid,
      address: item.address,
      displayAddress: item.displayAddress,
      accountLabel: item.accountLabel,
      inviteCode: item.inviteCode,
      registeredAt: item.registeredAt,
      registeredAtMs: item.registeredAtMs,
      referrerDisplay: item.referrerDisplay,
      directCount: item.directCount,
      teamCount: item.teamCount,
      totalStakedUsd: item.totalStakedUsd,
      activeStakedUsd: item.totalStakedUsd, // fallback path: no per-order expiry split available
      totalRedeemedUsd: item.totalRedeemedUsd,
      totalClaimedUsd: item.totalClaimedUsd,
      totalPendingUsd: item.totalPendingUsd,
      autoLevel: item.autoLevel,
      manualLevel: item.manualLevel,
      effectiveLevel: item.effectiveLevel,
      orderCount: item.orderCount,
      activeOrderCount: item.activeOrderCount,
    }))
    .sort((a, b) => {
      if (b.totalStakedUsd !== a.totalStakedUsd) return b.totalStakedUsd - a.totalStakedUsd
      if (b.teamCount !== a.teamCount) return b.teamCount - a.teamCount
      return a.accountLabel.localeCompare(b.accountLabel)
    })
}
