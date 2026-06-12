'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { SIM_VVV_USD_PRICE, useLocalWeb3Sim } from '@/contexts/local-web3-sim-context'
import { isPersonalClaimFrozen, useAdminControls } from '@/lib/admin-controls'
import { fetchStakeOrders, fetchClaimRecords, createClaimRecord } from '@/lib/api-client'
import { useClaimRewards, useWithdrawPrincipal } from '@/lib/contract-hooks'
import { useWalletAuth } from '@/contexts/wallet-auth-context'
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

function getOrderPeriodLabel(order: Pick<StakeOrder, 'period' | 'periodUnit'>) {
  return `${order.period} ${order.periodUnit === 'hour' ? '时' : '天'}`
}

function getOrderRateLabel(order: Pick<StakeOrder, 'periodUnit'>) {
  return `${order.periodUnit === 'hour' ? '时' : '日'}收益率`
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

function formatOrderDate(value: number) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function WithdrawButton({ chainOrderId, orderId, isWithdrawn, onSuccess }: { chainOrderId: number; orderId: string; isWithdrawn: boolean; onSuccess?: () => void }) {
  const withdraw = useWithdrawPrincipal()
  const { toast } = useToast()
  const [withdrawn, setWithdrawn] = useState(isWithdrawn)
  const [isPending, setIsPending] = useState(false)

  if (withdrawn) {
    return (
      <Button size="sm" variant="ghost" disabled className="gap-1">
        <CheckCircle2 className="h-4 w-4 text-chart-1" />
        已赎回
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      className="w-full h-9 sm:h-10 text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-1.5"
      disabled={isPending}
      onClick={async () => {
        setIsPending(true)
        try {
          const txHash = await withdraw(BigInt(chainOrderId))
          await fetch("/api/stake-orders", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txHash: orderId, withdrawnTx: typeof txHash === "string" ? txHash : null }),
          })
          setWithdrawn(true)
          toast({ title: "本金已赎回", description: "本金已退回钱包" })
          onSuccess?.()
        } catch (e: unknown) {
          toast({ title: "赎回失败", description: (e as Error)?.message?.slice(0, 100) ?? "交易未完成", variant: "destructive" })
        } finally {
          setIsPending(false)
        }
      }}
    >
      {isPending ? (
        <><Loader2 className="h-4 w-4 animate-spin" />赎回中...</>
      ) : (
        <><ArrowUpRight className="h-4 w-4" />赎回本金</>
      )}
    </Button>
  )
}

export function Dashboard() {
  const { toast } = useToast()
  const { claimReward, claims, stakes } = useLocalWeb3Sim()
  const { signedAddress } = useWalletAuth()
  const currentAddress = signedAddress ?? ""
  const { controls } = useAdminControls()
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'withdrawn'>('active')
  const [now, setNow] = useState(Date.now())
  const [claimingOrderIds, setClaimingOrderIds] = useState<Set<string>>(new Set())
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

  const refreshData = () => {
    if (!currentAddress) return
    fetchStakeOrders(currentAddress).then(setApiStakes)
    fetchClaimRecords(currentAddress).then(setApiClaims)
  }

  const handleClaimReward = async (order: StakeOrder) => {
    if (personalClaimFrozen) {
      toast({ title: "领取失败", description: "当前钱包领取收益功能已被冻结", variant: "destructive" })
      return
    }
    if (order.pendingReward <= 0) {
      toast({ title: "领取失败", description: "当前暂无可领取收益", variant: "destructive" })
      return
    }
    const TEAM_REWARD_TOPIC = "0xe07f61c526a4ace6d1e5cad0a84eddbf8e2733ce8383b0b2f1d76f07fb1cab49"
    setClaimingOrderIds(prev => new Set(prev).add(order.id))
    try {
      const { txHash: tx, logs } = await realClaim(BigInt(order.chainOrderId))
      const nowMs = Date.now()
      const nowStr = new Date(nowMs).toLocaleString("zh-CN", { hour12: false })
      await createClaimRecord({
        id: tx,
        orderId: order.id,
        account: currentAddress,
        amount: order.pendingReward,
        amountVvv: order.mode === 'coin' ? order.pendingReward : order.pendingReward / SIM_VVV_USD_PRICE,
        amountUsd: order.mode === 'fiat' ? order.pendingReward : order.pendingReward * SIM_VVV_USD_PRICE,
        priceUsd: SIM_VVV_USD_PRICE,
        createdAt: nowStr,
        createdAtMs: nowMs,
      })
      // 解析 TeamRewardAccrued 事件，写入上级团队奖励记录
      const teamLogs = logs.filter(l => l.topics[0]?.toLowerCase() === TEAM_REWARD_TOPIC)
      await Promise.allSettled(teamLogs.map(l => {
        const recipient = ("0x" + l.topics[1]?.slice(-40)) as string
        const bonus = l.data && l.data !== "0x" ? Number(BigInt(l.data)) / 1e18 : 0
        if (!recipient || bonus <= 0) return Promise.resolve()
        return fetch("/api/team-rewards", {
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
      }))
      claimReward(order.id, order.pendingReward)
      refreshData()
      toast({ title: "领取成功", description: "收益已领取成功" })
    } catch (e: unknown) {
      toast({
        title: "领取失败",
        description: (e as Error)?.message?.slice(0, 100) ?? "交易未完成",
        variant: "destructive",
      })
    } finally {
      setClaimingOrderIds(prev => { const s = new Set(prev); s.delete(order.id); return s })
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
      const claimedReward = mergedClaims
        .filter(claim => claim.orderId === order.id)
        .reduce((sum, claim) => sum + claim.amount, 0)
      const pendingReward = Math.max(0, accruedReward - claimedReward)

      const isExpired = now >= endMs
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
        startDate: formatOrderDate(safeStartMs),
        endDate: formatOrderDate(endMs),
        earnedReward: claimedReward,
        pendingReward,
        withdrawn,
        status: withdrawn ? ('withdrawn' as const) : (isExpired && pendingReward <= 0) ? ('completed' as const) : ('active' as const),
      }
    })
    .reverse()

  const totalStaked = currentOrders.filter(o => o.status !== 'withdrawn').reduce((sum, o) => sum + o.usdValue, 0)
  const activeOrders = currentOrders.filter(o => o.status === 'active')
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
    return order.status === filter
  })

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">资产看板</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">实时追踪您的质押收益和订单状态</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {/* 质押金额 */}
        <Card className="bg-card border-border shadow-card overflow-hidden relative">
          <CardContent className="p-3 sm:p-6 relative">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">质押金额</p>
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
                <p className="text-xs sm:text-sm text-muted-foreground truncate">赎回金额</p>
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
                <p className="text-xs sm:text-sm text-muted-foreground truncate">累计领取收益</p>
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
                <p className="text-xs sm:text-sm text-muted-foreground truncate">进行中订单</p>
                <p className="text-lg sm:text-2xl font-semibold text-foreground mt-1">{activeOrders.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">笔质押</p>
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
            <CardTitle className="text-base sm:text-lg">我的质押订单</CardTitle>
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
                  {status === 'all' ? '全部' : status === 'active' ? '进行中' : status === 'completed' ? '可赎回' : '已赎回'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="space-y-3 sm:space-y-4">
            {filteredOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                暂无质押订单
              </div>
            ) : filteredOrders.map((order) => (
              <div
                key={order.id}
                className={cn(
                  'rounded-xl border p-4 sm:p-5 transition-all',
                  order.status === 'active' 
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
                          {order.mode === 'coin' ? '币本位' : '金本位'}
                        </span>
                        <span className={cn(
                          "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium",
                          order.status === "active" ? "bg-chart-1/15 text-chart-1"
                            : order.status === "withdrawn" ? "bg-muted text-muted-foreground"
                            : "bg-accent/15 text-accent"
                        )}>
                          {order.status === "active" ? "进行中" : order.status === "withdrawn" ? "已赎回" : "可赎回"}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        {getOrderPeriodLabel(order)} · {getOrderRateLabel(order)} {order.dailyRate}%
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
                      <p className="text-[10px] sm:text-xs text-muted-foreground">开始日期</p>
                      <p className="font-mono text-xs text-foreground sm:text-sm">{order.startDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">结束日期</p>
                      <p className="font-mono text-xs text-foreground sm:text-sm">{order.endDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-chart-1 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">已获收益</p>
                      <p className="text-xs sm:text-sm font-medium text-chart-1">
                        +{formatRewardAmount(order.earnedReward)} {order.mode === 'coin' ? 'VVV' : 'USD'}
                      </p>
                    </div>
                  </div>
                  {order.status === 'active' && order.pendingReward > 0 && (
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">待领取收益</p>
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

                {order.status === 'active' && (
                  <div className="mt-3 sm:mt-4">
                    <Button
                      size="sm"
                      className="w-full h-9 sm:h-10 text-xs sm:text-sm bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-md gap-1.5"
                      onClick={() => handleClaimReward(order)}
                      disabled={order.pendingReward <= 0 || personalClaimFrozen || claimingOrderIds.has(order.id)}
                    >
                      {claimingOrderIds.has(order.id) ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />领取中...</>
                      ) : (
                        <><Gift className="h-4 w-4" />领取收益</>
                      )}
                    </Button>
                  </div>
                )}

                {order.status === 'completed' && (
                  <div className="mt-3 sm:mt-4">
                    <WithdrawButton chainOrderId={order.chainOrderId} orderId={order.id} isWithdrawn={false} onSuccess={refreshData} />
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
