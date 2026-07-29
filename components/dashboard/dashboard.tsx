'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { SIM_VVV_USD_PRICE, useLocalWeb3Sim, type SimClaimRecord } from '@/contexts/local-web3-sim-context'
import { isPersonalClaimFrozen, isPrincipalWithdrawalFrozen, useAdminControls } from '@/lib/admin-controls'
import { fetchStakeOrders, fetchClaimRecords, createClaimRecord } from '@/lib/api-client'
import { useClaimRewards, useWithdrawPrincipal, useLatestPrice, useOrdersPendingRewards, PAYOUT_ADDR } from '@/lib/contract-hooks'
import { useWalletAuth } from '@/contexts/wallet-auth-context'
import { useLanguage } from '@/contexts/language-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Wallet,
  TrendingUp,
  Clock,
  Gift,
  ArrowUpRight,
  Coins,
  DollarSign,
  Calendar,
  CheckCircle2,
  Timer,
  Loader2,
} from 'lucide-react'

interface StakeOrder {
  id: string
  chainOrderId: number
  mode: 'coin' | 'fiat'
  amount: number
  usdValue: number
  period: number
  periodUnit?: 'day' | 'hour'
  dailyRate: number
  startDate: string
  endDate: string
  earnedReward: number
  pendingReward: number
  status: 'active' | 'completed' | 'withdrawn'
  withdrawn: boolean
}

function getOrderPeriodLabel(order: Pick<StakeOrder, 'period' | 'periodUnit'>, t: (zh: string, en: string) => string) {
  return `${order.period} ${order.periodUnit === 'hour' ? t('时', 'hr') : t('天', 'd')}`
}

function getOrderRateLabel(order: Pick<StakeOrder, 'periodUnit'>, t: (zh: string, en: string) => string) {
  return `${order.periodUnit === 'hour' ? t('时', 'Hourly') : t('日', 'Daily')} ${t('收益率', 'Rate')}`
}

// Animated number component for real-time effect
function AnimatedNumber({ value, decimals = 2, prefix = '', suffix = '' }: { 
  value: number
  decimals?: number
  prefix?: string
  suffix?: string 
}) {
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    setDisplayValue(value)
  }, [value])

  return (
    <span className="font-mono tabular-nums">
      {prefix}{displayValue.toFixed(decimals)}{suffix}
    </span>
  )
}

function formatRewardAmount(value: number) {
  if (value === 0) return '0.00'
  return value < 1 ? value.toFixed(6) : value.toFixed(2)
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

function formatOrderDate(value: number, lang = 'zh') {
  return new Date(value).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })
}

function WithdrawButton({ chainOrderId, orderId, isWithdrawn, frozen, onSuccess }: { chainOrderId: number; orderId: string; isWithdrawn: boolean; frozen?: boolean; onSuccess?: () => void }) {
  const withdraw = useWithdrawPrincipal()
  const { toast } = useToast()
  const { t } = useLanguage()
  const [withdrawn, setWithdrawn] = useState(isWithdrawn)
  const [isPending, setIsPending] = useState(false)

  if (withdrawn) {
    return (
      <Button size="sm" variant="ghost" disabled className="gap-1">
        <CheckCircle2 className="h-4 w-4 text-chart-1" />
        {t('已赎回', 'Redeemed')}
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      className="w-full h-9 sm:h-10 text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-1.5"
      disabled={isPending}
      onClick={async () => {
        if (frozen) return
        setIsPending(true)
        try {
          const txHash = await withdraw(BigInt(chainOrderId))
          await fetch("/api/stake-orders", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txHash: orderId, withdrawnTx: typeof txHash === "string" ? txHash : null }),
          })
          setWithdrawn(true)
          toast({ title: t("赎回成功", "Redeemed") })
          onSuccess?.()
        } catch (e: unknown) {
          toast({ title: t("赎回失败", "Redeem Failed"), description: (e as Error)?.message?.slice(0, 100) ?? t("交易未完成", "Transaction failed"), variant: "destructive" })
        } finally {
          setIsPending(false)
        }
      }}
    >
      {isPending ? (
        <><Loader2 className="h-4 w-4 animate-spin" />赎回中...</>
      ) : (
        <><ArrowUpRight className="h-4 w-4" />{t('赎回本金', 'Redeem')}</>
      )}
    </Button>
  )
}

export function Dashboard() {
  const { toast } = useToast()
  const { t, language } = useLanguage()
  const { claimReward, claims, stakes } = useLocalWeb3Sim()
  const { signedAddress } = useWalletAuth()
  const currentAddress = signedAddress ?? ""
  const { controls } = useAdminControls()
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'withdrawn'>('active')
  const [now, setNow] = useState(Date.now())
  const [claimingOrderIds, setClaimingOrderIds] = useState<Set<string>>(new Set())
  // 领取成功后每单的"归零时刻"：从这一刻起待领取从 0 按秒重新累计（在链上读取追上前先乐观显示）
  const [claimResetAt, setClaimResetAt] = useState<Record<string, number>>({})
  const personalClaimFrozen = isPersonalClaimFrozen(currentAddress)
  const [apiStakes, setApiStakes] = useState<typeof stakes>([])
  const [apiClaims, setApiClaims] = useState<typeof claims>([])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // API fetch; clear state immediately when wallet disconnects
  useEffect(() => {
    if (!currentAddress) {
      setApiStakes([])
      setApiClaims([])
      return
    }
    fetchStakeOrders(currentAddress).then(setApiStakes)
    fetchClaimRecords(currentAddress).then(setApiClaims)
  }, [currentAddress])

  // Merge: API preferred, localStorage as fallback — empty when wallet not connected
  const mergedStakes = currentAddress ? (apiStakes.length > 0 ? apiStakes : stakes) : []
  const mergedClaims = currentAddress ? (apiClaims.length > 0 ? apiClaims : claims) : []

  const realClaim = useClaimRewards()
  const latestPrice = useLatestPrice()
  // 链上实时价格（BigInt wei → number USD）；0 时回退到编译期常量
  const vvvPriceAtClaim = latestPrice > 0n ? Number(latestPrice) / 1e18 : SIM_VVV_USD_PRICE

  // 链上权威的每单待领取（VVV）。用它替代"时间累计−数据库领取记录"，
  // 避免领取记录写库失败导致待领取卡住、赎回被挡。读取失败时回退到旧算法。
  const userOrderCount = currentAddress
    ? mergedStakes.filter(o => o.account.toLowerCase() === currentAddress.toLowerCase()).length
    : 0
  const { pendings: chainPendings, dataUpdatedAt: chainReadAt, refetch: refetchPending } = useOrdersPendingRewards(
    userOrderCount,
    (currentAddress || undefined) as `0x${string}` | undefined,
  )

  const refreshData = () => {
    if (!currentAddress) return
    fetchStakeOrders(currentAddress).then(newStakes => { if (newStakes.length > 0) setApiStakes(newStakes) })
    fetchClaimRecords(currentAddress).then(newClaims => { if (newClaims.length > 0) setApiClaims(newClaims) })
  }

  const handleClaimReward = async (order: StakeOrder) => {
    if (personalClaimFrozen) {
      toast({ title: t("领取失败", "Claim Failed"), description: t("当前钱包领取收益功能已被冻结", "Claim is frozen for this wallet"), variant: "destructive" })
      return
    }
    if (order.pendingReward <= 0) {
      toast({ title: t("暂无可领取收益", "No Pending Rewards"), description: t("当前订单收益为 0，暂不可领取", "No rewards available for this order"), variant: "destructive" })
      return
    }
    console.log('[claim] user:', currentAddress, 'orderId:', order.chainOrderId, 'pendingReward:', order.pendingReward)
    const TEAM_REWARD_TOPIC = "0xe07f61c526a4ace6d1e5cad0a84eddbf8e2733ce8383b0b2f1d76f07fb1cab49"
    const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    setClaimingOrderIds(prev => new Set(prev).add(order.id))
    const releaseSpinner = () => setClaimingOrderIds(prev => { const s = new Set(prev); s.delete(order.id); return s })
    let tx = ""
    try {
      const claimResult = await realClaim(BigInt(order.chainOrderId), order.pendingReward)
      tx = claimResult.txHash
      const logsPromise = claimResult.logsPromise
      console.log('[claim] txHash:', tx)

      // 交易已提交后做乐观更新，但保持"领取中"转圈，直到链上回执确认（弹"领取成功"）再松开。
      const nowMs  = Date.now()
      const nowStr = new Date(nowMs).toLocaleString("zh-CN", { hour12: false })
      const optimisticClaim: SimClaimRecord = {
        id: tx,
        orderId: order.id,
        account: currentAddress,
        amount: order.pendingReward,
        amountVvv: order.mode === 'coin' ? order.pendingReward : order.pendingReward / vvvPriceAtClaim,
        amountUsd: order.mode === 'fiat' ? order.pendingReward : order.pendingReward * vvvPriceAtClaim,
        priceUsd: vvvPriceAtClaim,
        createdAt: nowStr,
        createdAtMs: nowMs,
      }
      setApiClaims(prev => [...prev, optimisticClaim])
      claimReward(order.id, order.pendingReward)

      // 领取已提交后重读链上待领取让它归零。交易刚提交还没打包，立即读没意义，
      // 所以延后几次读（兜住节点同步延迟）；回执确认后后台还会再读一次。
      setTimeout(() => { refetchPending() }, 4000)
      setTimeout(() => { refetchPending() }, 12000)

      // 硬性上限：15 秒后无论回执是否到达都松开转圈（后台仍继续读链确认），绝不卡死
      const capTimer = setTimeout(() => {
        releaseSpinner()
        toast({ title: t("仍在链上确认", "Confirming on-chain"), description: t("确认后订单会自动更新；若未到账说明领取未成功", "It will update once confirmed; if nothing arrives the claim didn't go through") })
      }, 15000)

      // ── 后台：等待回执并解析事件——回执一到就松开转圈并弹"领取成功" ──
      logsPromise
        .then(async (logs) => {
          clearTimeout(capTimer)
          releaseSpinner()
          console.log('[claim] logs:', logs.length)
          // VVVPayout 合约事件 topic（按合约源码定义）
          const TOPIC_REWARD_PAID   = "0xa4b7979b77c5bef65740b7e1d7a09534eadc2803d5c1cfdae60fa28226be6da2"
          const TOPIC_PAYOUT_QUEUED = "0xcdef26d95faf8a39763982c3e5ec41373bac21e6a955e3a210ada7f9c8d6152d"
          const payoutLogs = logs.filter(l => l.address?.toLowerCase() === PAYOUT_ADDR.toLowerCase())
          const topic0s    = payoutLogs.map(l => l.topics[0]?.toLowerCase())
          const isRewardPaid = topic0s.includes(TOPIC_REWARD_PAID)
          const isQueued     = topic0s.includes(TOPIC_PAYOUT_QUEUED)

          if (!isRewardPaid && !isQueued) {
            console.warn('[claim] no payout event detected. payoutLogs:', payoutLogs.length, 'all log addrs:', logs.map(l => l.address))
            toast({
              title: t("出款事件未检测到", "Payout event not detected"),
              description: t("Staking 已记账，但未检测到出款事件，请联系客服并提供 tx: " + tx, "Staking recorded but no payout event. Contact support with tx: " + tx),
              variant: "destructive",
            })
            return
          }

          // 写库（后台，各页面已改读链上，即使写库慢/失败也不卡 UI）
          createClaimRecord({
            id: tx,
            orderId: order.id,
            account: currentAddress,
            amount: order.pendingReward,
            amountVvv: order.mode === 'coin' ? order.pendingReward : order.pendingReward / vvvPriceAtClaim,
            amountUsd: order.mode === 'fiat' ? order.pendingReward : order.pendingReward * vvvPriceAtClaim,
            priceUsd: vvvPriceAtClaim,
            createdAt: nowStr,
            createdAtMs: nowMs,
          }).then((saved) => { if (saved) refreshData() }).catch(() => {})

          // 解析 TeamRewardAccrued 事件，后台写入上级团队奖励记录
          const teamLogs = logs.filter(l => l.topics[0]?.toLowerCase() === TEAM_REWARD_TOPIC)
          teamLogs.forEach(l => {
            const recipient = ("0x" + l.topics[1]?.slice(-40)) as string
            const bonus = l.data && l.data !== "0x" ? Number(BigInt(l.data)) / 1e18 : 0
            if (!recipient || bonus <= 0) return
            fetch("/api/team-rewards", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                claimTxHash: tx + "_" + (l.logIndex ?? l.topics[1]?.slice(-8)),
                beneficiaryAddr: recipient.toLowerCase(),
                sourceAddr: currentAddress.toLowerCase(),
                sourceOrderTx: order.id,
                rewardType: "generation",
                rate: 0,
                amount: bonus,
              }),
            }).catch(() => {})
          })

          // 领取成功即刻把这单待领取归零、从 0 重新按秒累计（不等链上读取追上）
          setClaimResetAt(prev => ({ ...prev, [order.id]: Date.now() }))
          refetchPending()
          toast({ title: isRewardPaid ? t("领取成功", "Claimed") : t("领取处理中", "Processing") })
        })
        .catch((e: unknown) => {
          clearTimeout(capTimer)
          releaseSpinner()
          // 回执确认失败（如链上 revert / 超时）：回滚乐观记录并提示
          setApiClaims(prev => prev.filter(c => c.id !== tx))
          const msg = (e as Error)?.message ?? ""
          console.error('[claim] receipt error:', msg)
          toast({
            title: t("领取确认失败", "Confirmation failed"),
            description: msg.slice(0, 120) || t("请稍后在订单中核对待领取金额", "Please re-check pending amount later"),
            variant: "destructive",
          })
        })
    } catch (e: unknown) {
      // 交易提交阶段失败（用户拒绝 / 钱包未返回 hash 等）：松开转圈
      releaseSpinner()
      setApiClaims(prev => prev.filter(c => c.orderId !== order.id || c.account !== currentAddress))
      const msg = (e as Error)?.message ?? ""
      console.error('[claim] error:', msg)
      toast({
        title: t("领取失败", "Claim Failed"),
        description: msg.slice(0, 120) || t("交易未完成", "Transaction failed"),
        variant: "destructive",
      })
    }
  }
  
  // 先对用户所有订单按创建时间升序排列，位置即链上 orderId（0-indexed）
  const allUserStakesSorted = mergedStakes
    .filter(order => order.account.toLowerCase() === currentAddress.toLowerCase())
    .slice()
    .sort((a, b) => (a.createdAtMs ?? parseOrderDate(a.createdAt)) - (b.createdAtMs ?? parseOrderDate(b.createdAt)))

  const chainOrderIdMap = new Map<string, number>()
  allUserStakesSorted.forEach((order, idx) => chainOrderIdMap.set(order.id, idx))

  const currentOrders: StakeOrder[] = allUserStakesSorted
    .filter(order => !controls.hiddenOrderIds.includes(order.id))
    .map(order => {
      const periodReward = order.mode === 'coin'
        ? order.amount * (order.dailyRate / 100)
        : order.usdValue * (order.dailyRate / 100)
      const safeStartMs = order.createdAtMs ?? parseOrderDate(order.createdAt)
      const unitMs = order.periodUnit === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      const periodMs = order.period * unitMs
      const endMs = order.endTime ? new Date(order.endTime).getTime() : safeStartMs + periodMs
      const effectiveNow = Math.min(now, endMs)
      const elapsedMs = Math.max(0, effectiveNow - safeStartMs)
      const totalExpectedReward = periodReward * order.period
      const accruedReward = Math.min(totalExpectedReward, periodReward * (elapsedMs / unitMs))
      const dbClaimedReward = mergedClaims
        .filter(claim => claim.orderId === order.id)
        .reduce((sum, claim) => sum + claim.amount, 0)

      const isExpired = now >= endMs

      // 优先用链上权威待领取做基准；两次链上读取之间用时间累计平滑跳动。
      // 金本位把 VVV 按当前价换算成 USD。读取失败则回退旧算法。
      const chainOrderId = chainOrderIdMap.get(order.id) ?? 0
      const chainPendingVvv = chainPendings[chainOrderId]
      let pendingReward: number
      let claimedReward = dbClaimedReward
      // 链上口径的待领取（读取时刻基准 + 之后按秒累计）；读取失败为 null
      let chainBased: number | null = null
      if (chainPendingVvv !== undefined && chainPendingVvv >= 0n) {
        const baseVvv = Number(chainPendingVvv) / 1e18
        const basePending = order.mode === 'coin' ? baseVvv : baseVvv * vvvPriceAtClaim
        const secsSinceRead = chainReadAt ? Math.max(0, (now - chainReadAt) / 1000) : 0
        const accrualSinceRead = isExpired ? 0 : periodReward * (secsSinceRead / (unitMs / 1000))
        chainBased = Math.min(totalExpectedReward, basePending + accrualSinceRead)
      }
      // 领取成功后：从"归零时刻"起从 0 按秒累计（这就是领取后真实的待领取），
      // 并与链上值取较小者——既"立刻显示 0 并开始增长"，又不会因链上读取滞后回跳到旧的大值。
      // 链上读取一旦追上（值≈从 0 累计），两者相等，无缝衔接。
      const resetAt = claimResetAt[order.id]
      if (resetAt !== undefined) {
        const secsSinceReset = Math.max(0, (now - resetAt) / 1000)
        const optimistic = isExpired ? 0 : Math.min(totalExpectedReward, periodReward * (secsSinceReset / (unitMs / 1000)))
        pendingReward = chainBased !== null ? Math.min(optimistic, chainBased) : optimistic
      } else if (chainBased !== null) {
        pendingReward = chainBased
      } else {
        pendingReward = Math.max(0, accruedReward - dbClaimedReward)
      }
      const withdrawn = order.isWithdrawn === true

      return {
        id: order.id,
        chainOrderId: chainOrderIdMap.get(order.id) ?? 0,
        mode: order.mode,
        amount: order.amount,
        usdValue: order.usdValue,
        period: order.period,
        periodUnit: order.periodUnit ?? 'day',
        dailyRate: order.dailyRate,
        startDate: formatOrderDate(safeStartMs, language),
        endDate: formatOrderDate(endMs, language),
        earnedReward: claimedReward,
        pendingReward,
        withdrawn,
        status: withdrawn ? ('withdrawn' as const) : (isExpired && pendingReward <= 0) ? ('completed' as const) : isExpired ? ('expired' as const) : ('active' as const),
      }
    })
    .reverse()

  const totalStaked = currentOrders.filter(o => o.status !== 'withdrawn').reduce((sum, o) => sum + o.usdValue, 0)
  const activeOrders = currentOrders.filter(o => o.status === 'active' || o.status === 'expired')
  const redeemedAmount = currentOrders.filter(o => o.status === 'withdrawn').reduce((sum, o) => sum + o.usdValue, 0)
  const totalClaimedVvv = mergedClaims
    .filter(claim => claim.account.toLowerCase() === currentAddress.toLowerCase())
    .reduce((sum, claim) => {
      if (typeof claim.amountVvv === 'number') {
        return sum + claim.amountVvv
      }

      const order = mergedStakes.find(item => item.id === claim.orderId)
      if (order?.mode === 'fiat') {
        return sum + (claim.amount / (claim.priceUsd ?? SIM_VVV_USD_PRICE))
      }

      return sum + claim.amount
    }, 0)
  const totalClaimedUsd = mergedClaims
    .filter(claim => claim.account.toLowerCase() === currentAddress.toLowerCase())
    .reduce((sum, claim) => {
      if (typeof claim.amountUsd === 'number') {
        return sum + claim.amountUsd
      }

      const order = mergedStakes.find(item => item.id === claim.orderId)
      if (order?.mode === 'coin') {
        return sum + (claim.amount * (claim.priceUsd ?? SIM_VVV_USD_PRICE))
      }

      return sum + claim.amount
    }, 0)

  const filteredOrders = currentOrders.filter(order => {
    if (filter === 'all') return true
    // 进行中 = 未到期(active) + 已到期但未领收益(expired)
    if (filter === 'active') return order.status === 'active' || order.status === 'expired'
    return order.status === filter
  })

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">{t('资产看板', 'Dashboard')}</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">{t('实时追踪您的质押收益和订单状态', 'Track your staking rewards and order status in real time')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {/* 质押金额 */}
        <Card className="bg-card border-border shadow-card overflow-hidden relative">
          <CardContent className="p-3 sm:p-6 relative">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('质押金额', 'Staked')}</p>
                <p className="text-lg sm:text-2xl font-semibold text-foreground mt-1">
                  <AnimatedNumber value={totalStaked} prefix="$" />
                </p>
              </div>
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 赎回金额 */}
        <Card className="bg-card border-border shadow-card overflow-hidden relative">
          <CardContent className="p-3 sm:p-6 relative">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('赎回金额', 'Redeemed')}</p>
                <p className="text-lg sm:text-2xl font-semibold text-foreground mt-1">
                  <AnimatedNumber value={redeemedAmount} prefix="$" />
                </p>
              </div>
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-chart-4/10 shrink-0">
                <ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6 text-chart-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 累计领取金额 */}
        <Card className="bg-card border-border shadow-card overflow-hidden relative">
          <CardContent className="p-3 sm:p-6 relative">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('累计领取收益', 'Total Claimed')}</p>
                <p className="text-lg sm:text-2xl font-semibold text-chart-1 mt-1">
                  <AnimatedNumber value={totalClaimedVvv} prefix="+" suffix=" VVV" />
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                  ≈ $<AnimatedNumber value={totalClaimedUsd} decimals={2} />
                </p>
              </div>
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-chart-1/10 shrink-0">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-chart-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 进行中订单数 */}
        <Card className="bg-card border-border shadow-card overflow-hidden relative">
          <CardContent className="p-3 sm:p-6 relative">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('进行中订单', 'Active Orders')}</p>
                <p className="text-lg sm:text-2xl font-semibold text-foreground mt-1">{activeOrders.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">{t('笔质押', 'stakes')}</p>
              </div>
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-accent/10 shrink-0">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order List */}
      <Card className="bg-card border-border shadow-card">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base sm:text-lg">{t('我的质押订单', 'My Stake Orders')}</CardTitle>
            <div className="flex gap-1.5 sm:gap-2">
              {(['active', 'completed', 'withdrawn', 'all'] as const).map((status) => (
                <Button
                  key={status}
                  variant={filter === status ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter(status)}
                  className={cn(
                    'h-8 px-2.5 sm:px-3 text-xs sm:text-sm',
                    filter === status
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'hover:bg-secondary'
                  )}
                >
                  {status === 'all' ? t('全部', 'All') : status === 'active' ? t('进行中', 'Active') : status === 'completed' ? t('可赎回', 'Redeemable') : t('已赎回', 'Redeemed')}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="space-y-3 sm:space-y-4">
            {filteredOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {t('暂无质押订单', 'No stake orders yet')}
              </div>
            ) : filteredOrders.map((order) => (
              <div
                key={order.id}
                className={cn(
                  'rounded-xl border p-4 sm:p-5 transition-all',
                  (order.status === 'active' || order.status === 'expired')
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-secondary/20'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={cn(
                      'flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg shrink-0',
                      order.mode === 'coin' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
                    )}>
                      {order.mode === 'coin' 
                        ? <Coins className="h-4 w-4 sm:h-5 sm:w-5" />
                        : <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                      }
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-medium text-foreground">
                          {order.mode === 'coin' ? t('币本位', 'Coin') : t('金本位', 'Fiat')}
                        </span>
                        <span className={cn(
                          "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium",
                          order.status === "active" ? "bg-chart-1/15 text-chart-1"
                            : order.status === "withdrawn" ? "bg-muted text-muted-foreground"
                            : order.status === "expired" ? "bg-orange-500/15 text-orange-500"
                            : "bg-accent/15 text-accent"
                        )}>
                          {order.status === "active" ? t("进行中", "Active") : order.status === "withdrawn" ? t("已赎回", "Redeemed") : order.status === "expired" ? t("已到期", "Expired") : t("可赎回", "Redeemable")}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        {getOrderPeriodLabel(order, t)} · {getOrderRateLabel(order, t)} {order.dailyRate}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm sm:text-base font-semibold text-foreground">
                      {order.mode === 'coin' 
                        ? `${order.amount.toLocaleString()} VVV`
                        : `$${order.usdValue.toLocaleString()}`
                      }
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      ≈ ${order.usdValue.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border pt-3 sm:mt-4 sm:grid-cols-2 sm:gap-4 sm:pt-4">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{t('开始日期', 'Start Date')}</p>
                      <p className="font-mono text-xs text-foreground sm:text-sm">{order.startDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{t('结束日期', 'End Date')}</p>
                      <p className="font-mono text-xs text-foreground sm:text-sm">{order.endDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-chart-1 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{t('已获收益', 'Earned')}</p>
                      <p className="text-xs sm:text-sm font-medium text-chart-1">
                        +{formatRewardAmount(order.earnedReward)} {order.mode === 'coin' ? 'VVV' : 'USD'}
                      </p>
                    </div>
                  </div>
                  {(order.status === 'active' || order.status === 'expired') && order.pendingReward > 0 && (
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{t('待领取收益', 'Pending')}</p>
                        <p className="text-xs sm:text-sm font-semibold text-accent">
                          {order.mode === 'coin' 
                            ? `+${formatRewardAmount(order.pendingReward)} VVV`
                            : `+$${formatRewardAmount(order.pendingReward)}`
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {(order.status === 'active' || order.status === 'expired') && (
                  <div className="mt-3 sm:mt-4">
                    <Button
                      size="sm"
                      className="w-full h-9 sm:h-10 text-xs sm:text-sm bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-md gap-1.5"
                      onClick={() => handleClaimReward(order)}
                      disabled={order.pendingReward <= 0 || personalClaimFrozen || claimingOrderIds.has(order.id)}
                    >
                      {claimingOrderIds.has(order.id) ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />{t('领取中...', 'Claiming...')}</>
                      ) : (
                        <><Gift className="h-4 w-4" />{t('领取收益', 'Claim Rewards')}</>
                      )}
                    </Button>
                  </div>
                )}

                {order.status === 'completed' && (
                  <div className="mt-3 sm:mt-4">
                    <WithdrawButton chainOrderId={order.chainOrderId} orderId={order.id} isWithdrawn={false} frozen={isPrincipalWithdrawalFrozen(currentAddress)} onSuccess={refreshData} />
                  </div>
                )}

              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
