'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { SIM_VVV_USD_PRICE } from '@/contexts/local-web3-sim-context'
import { useRewardConfig, type PeriodUnit } from '@/lib/reward-config'
import { createStakeOrder, registerUser } from '@/lib/api-client'
import { useChainId } from 'wagmi'
import { useWalletAuth } from '@/contexts/wallet-auth-context'
import { encodeFunctionData, parseAbi, formatUnits } from 'viem'
import { useApproveVVV, useStake, useVVVBalanceData, useLatestPrice, VVV_TOKEN_ADDR, STAKING_ADDR } from '@/lib/contract-hooks'
import { useLanguage } from '@/contexts/language-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Coins,
  DollarSign,
  Clock,
  TrendingUp,
  Info,
  Shield,
  ArrowRight,
  Loader2,
} from 'lucide-react'

// 兼容 Error / viem error / wagmi error / string / null / TP Wallet 非标准错误
function getErrorMessage(error: unknown): string {
  if (error === null || error === undefined) return '交易未完成，请重试'
  if (typeof error === 'string') return error.slice(0, 150) || '交易未完成'
  if (typeof error !== 'object') return String(error).slice(0, 150)

  // 用 try 包裹所有 in / 属性访问，防止非标准对象二次崩溃
  try {
    const err = error as Record<string, unknown>

    // 用户取消
    if (err.code === 4001 || err.code === 'ACTION_REJECTED') return '用户取消了操作'
    if (typeof err.message === 'string') {
      const msg = err.message.toLowerCase()
      if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected by user')) return '用户取消了操作'
      if (msg.includes('insufficient funds') || msg.includes('余额不足')) return '余额不足，请检查 ETH gas'
      if (msg.includes('insufficient allowance') || msg.includes('allowance')) return '授权额度不足'
    }

    // viem ContractFunctionRevertedError
    if (typeof err.shortMessage === 'string') return err.shortMessage.slice(0, 150)
    // viem details
    if (typeof err.details === 'string') return err.details.slice(0, 150)
    // 普通 message
    if (typeof err.message === 'string') return err.message.slice(0, 150)
    // cause chain
    if (err.cause && typeof err.cause === 'object') return getErrorMessage(err.cause)
  } catch {
    // 万一还是崩，返回通用提示
  }
  return '交易未完成，请重试'
}

type StakeMode = 'coin' | 'fiat'

interface StakePeriod {
  duration: number
  unit: PeriodUnit
  durationDays: number
  dailyRate: number
  totalReturn: number
}

const defaultStakePeriods: StakePeriod[] = [
  { duration: 1, unit: 'day', durationDays: 1, dailyRate: 1, totalReturn: 1 },
  { duration: 2, unit: 'day', durationDays: 2, dailyRate: 1, totalReturn: 2 },
  { duration: 3, unit: 'day', durationDays: 3, dailyRate: 1, totalReturn: 3 },
  { duration: 4, unit: 'day', durationDays: 4, dailyRate: 1, totalReturn: 4 },
]

function getPeriodLabel(period: StakePeriod, t: (zh: string, en: string) => string) {
  return `${period.duration} ${period.unit === 'hour' ? t('时', 'hr') : t('天', 'd')}`
}

function sanitizeStakeAmount(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [integer = '', ...decimalParts] = cleaned.split('.')
  const decimal = decimalParts.join('')
  const normalized = decimalParts.length > 0 ? `${integer}.${decimal}` : integer

  return normalized.replace(/^0+(?=\d)/, '0')
}

export function StakingHub() {
  const { toast } = useToast()
  const { t } = useLanguage()
  const { config } = useRewardConfig()
  const stakePeriods = useMemo<StakePeriod[]>(
    () => config.periodDurations.map((duration, index) => {
      const unit = config.periodUnits[index]
      const durationDays = unit === 'hour' ? duration / 24 : duration

      return {
        duration,
        unit,
        durationDays,
        dailyRate: config.periodRates[index],
        totalReturn: Number((durationDays * config.periodRates[index]).toFixed(4)),
      }
    }),
    [config.periodDurations, config.periodRates, config.periodUnits],
  )
  const [stakeMode, setStakeMode] = useState<StakeMode>('coin')
  const [selectedPeriod, setSelectedPeriod] = useState<StakePeriod>(defaultStakePeriods[1])
  const [stakeAmount, setStakeAmount] = useState('')
  const [isStaking, setIsStaking] = useState(false)
  const [minStakeUsd, setMinStakeUsd] = useState(10)
  useEffect(() => {
    fetch('/api/admin/chain-params')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.minStakeUsd) setMinStakeUsd(Number(d.minStakeUsd)) })
      .catch(() => {})
  }, [])
  useEffect(() => {
    setSelectedPeriod(current => stakePeriods.find(period => period.duration === current.duration && period.unit === current.unit) ?? stakePeriods[1])
  }, [stakePeriods])

  const { signedAddress: address } = useWalletAuth()
  const chainId = useChainId()
  const isBase = chainId === 8453
  const realApprove = useApproveVVV()
  const realStake = useStake()
  const { balance: realBalance, isPending: balancePending, isError: balanceError, refetch: refetchBalance } = useVVVBalanceData()
  const realPrice = useLatestPrice()

  const [myInviteCode, setMyInviteCode] = useState<string | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteCodeInput, setInviteCodeInput] = useState('')
  const [inviteBinding, setInviteBinding] = useState(false)
  const inviteDialogShownRef = useRef<Set<string>>(new Set())

  // 读取当前用户的链上推荐人（用于 stake 调用），连接时自动注册
  const ROOT_ADDR = (process.env.NEXT_PUBLIC_ROOT_REFERRER_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`
  const [onChainReferrer, setOnChainReferrer] = useState<`0x${string}`>(ROOT_ADDR)
  useEffect(() => {
    if (!address) {
      setOnChainReferrer(ROOT_ADDR)
      setMyInviteCode(null)
      setInviteDialogOpen(false)
      inviteDialogShownRef.current.clear()
      return
    }

    const loadUser = async () => {
      // 1. 获取用户，不存在则注册
      let userData = await fetch(`/api/users/${address}`).then(r => r.json())
      if (userData?.notFound) {
        await registerUser(address)
        userData = await fetch(`/api/users/${address}`).then(r => r.json())
      }

      // 2. 设置 referrer
      const ref = typeof userData?.referrer === 'string' ? userData.referrer.trim() : ''
      setOnChainReferrer(/^0x[a-f0-9]{40}$/i.test(ref) ? (ref as `0x${string}`) : ROOT_ADDR)

      // 3. 存邀请码
      setMyInviteCode(userData?.inviteCode ?? null)

      // 4. 已有邀请码说明首次质押已完成、绑定关系已确立，无需弹窗
      const isRoot = address.toLowerCase() === ROOT_ADDR.toLowerCase()
      const hasInviteCode = !!userData?.inviteCode
      if (!isRoot && !hasInviteCode && !inviteDialogShownRef.current.has(address.toLowerCase())) {
        const inviteData = await fetch(`/api/invite/list?wallet=${address}`).then(r => r.json())
        const needsBinding = !inviteData?.boundTo || inviteData.boundTo.boundMethod === 'auto_root'
        if (needsBinding) {
          inviteDialogShownRef.current.add(address.toLowerCase())
          setInviteDialogOpen(true)
        }
      }
    }

    loadUser().catch(() => setOnChainReferrer(ROOT_ADDR))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  const numericStakeAmount = Math.max(0, Number.parseFloat(stakeAmount || '0') || 0)
  const realPriceNum = Number(realPrice) / 1e18
  const vvvPrice = realPriceNum > 0 ? realPriceNum : 0.15
  const usdValue = stakeMode === 'coin'
    ? numericStakeAmount * vvvPrice
    : numericStakeAmount
  const vvvAmount = stakeMode === 'fiat'
    ? numericStakeAmount / vvvPrice
    : numericStakeAmount

  const estimatedDailyReward = stakeMode === 'coin'
    ? vvvAmount * (selectedPeriod.dailyRate / 100)
    : usdValue * (selectedPeriod.dailyRate / 100)
  const rewardUnitLabel = selectedPeriod.unit === 'hour' ? t('时', 'Hr') : t('日', 'Daily')
  const rewardRateLabel = selectedPeriod.unit === 'hour' ? t('时收益率', 'Hourly Rate') : t('日收益率', 'Daily Rate')

  const estimatedTotalReward = stakeMode === 'coin'
    ? vvvAmount * (selectedPeriod.totalReturn / 100)
    : usdValue * (selectedPeriod.totalReturn / 100)
  // formatUnits handles large BigInt safely without float precision loss
  const availableVvvBalance = (address && isBase && !balancePending && !balanceError)
    ? Number(formatUnits(realBalance, 18))
    : 0
  const availableUsdBalance = availableVvvBalance * vvvPrice
  const stakeDisabled = !address || !isBase || usdValue < minStakeUsd || (stakeMode === 'coin' ? numericStakeAmount > availableVvvBalance : numericStakeAmount > availableUsdBalance)


  const handleBindInvite = async () => {
    if (!address || !inviteCodeInput.trim()) return
    setInviteBinding(true)
    try {
      const res = await fetch('/api/invite/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childAddress: address, parentCode: inviteCodeInput.trim() }),
      })
      const data = await res.json()
      if (data?.parentAddress) {
        setOnChainReferrer(data.parentAddress as `0x${string}`)
        setInviteDialogOpen(false)
        setInviteCodeInput('')
        toast({ title: t('绑定成功', 'Bound Successfully') })
      } else {
        toast({ title: t('绑定失败', 'Bind Failed'), description: data?.error ?? t('邀请码无效', 'Invalid invite code'), variant: 'destructive' })
      }
    } catch {
      toast({ title: t('绑定失败', 'Bind Failed'), description: t('网络错误，请重试', 'Network error, please retry'), variant: 'destructive' })
    } finally {
      setInviteBinding(false)
    }
  }

  const handleStake = async () => {
    if (!address) {
      toast({ title: t("请先连接钱包", "Please connect wallet first"), variant: "destructive" })
      return
    }
    setIsStaking(true)
    try {
      const amountWei = BigInt(Math.floor(vvvAmount * 1e18))
      const MaxUint256 = 2n ** 256n - 1n

      // 1. 检查 allowance，不足时才 approve（首次用 MaxUint256，后续无需重复授权）
      const eth = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>).ethereum : null
      let allowance = 0n
      if (eth) {
        try {
          const calldata = encodeFunctionData({
            abi: parseAbi(['function allowance(address owner, address spender) view returns (uint256)']),
            functionName: 'allowance',
            args: [address as `0x${string}`, STAKING_ADDR],
          })
          const hex = await (eth as { request: (a: unknown) => Promise<string> }).request({
            method: 'eth_call',
            params: [{ to: VVV_TOKEN_ADDR, data: calldata }, 'latest'],
          })
          if (hex && hex !== '0x') allowance = BigInt(hex)
        } catch { /* 读取失败则视为 0，继续走 approve */ }
      }
      if (allowance < amountWei) {
        try {
          await realApprove(MaxUint256)
        } catch (e: unknown) {
          console.error('[stake] approve failed raw error:', e)
          toast({ title: t('Approve 失败', 'Approve Failed'), description: getErrorMessage(e), variant: 'destructive' })
          return
        }
      }

      // 2. Stake
      let tx: string
      try {
        tx = await realStake(amountWei, selectedPeriod.duration, stakeMode === "coin", onChainReferrer)
      } catch (e: unknown) {
        console.error('[stake] stake failed raw error:', e)
        toast({ title: t('质押失败', 'Stake Failed'), description: getErrorMessage(e), variant: 'destructive' })
        return
      }

      // 3. Sync to API
      const stakeNow = Date.now()
      const stakeEndMs = stakeNow + selectedPeriod.durationDays * 86400 * 1000
      await createStakeOrder({
        id: tx,
        txHash: tx,
        account: address,
        mode: stakeMode,
        amount: vvvAmount,
        usdValue,
        period: selectedPeriod.duration,
        periodUnit: selectedPeriod.unit,
        dailyRate: selectedPeriod.dailyRate,
        createdAt: new Date(stakeNow).toISOString(),
        createdAtMs: stakeNow,
        endTime: new Date(stakeEndMs).toISOString(),
      })
      toast({ title: t('质押成功', 'Stake Successful'), description: t('质押订单已创建', 'Stake order created') })
      refetchBalance()
      setStakeAmount("")
    } catch (e: unknown) {
      console.error('[stake] unexpected error:', e)
      toast({ title: t('质押失败', 'Stake Failed'), description: getErrorMessage(e), variant: 'destructive' })
    } finally {
      setIsStaking(false)
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* 邀请关系绑定弹窗 */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => { if (!open) setInviteDialogOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('绑定邀请关系', 'Bind Referral')}</DialogTitle>
            <DialogDescription>
              {t('输入邀请人的邀请码绑定推荐关系，或点击跳过直接进入质押', 'Enter an invite code to bind a referral, or skip to stake directly')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder={t('输入邀请码（如：AB12CD34）', 'Enter invite code (e.g. AB12CD34)')}
              value={inviteCodeInput}
              onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
              maxLength={8}
              className="uppercase text-center"
            />
            <div className="flex gap-3">
              <Button
                onClick={handleBindInvite}
                disabled={!inviteCodeInput.trim() || inviteBinding}
                className="flex-1"
              >
                {inviteBinding ? t('绑定中...', 'Binding...') : t('确认', 'Confirm')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setInviteDialogOpen(false)}
                className="flex-1"
              >
                {t('跳过', 'Skip')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">{t('质押大厅', 'Staking Hub')}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">{t('选择质押模式和周期，开启您的收益之旅', 'Choose your staking mode and period to start earning')}</p>
      </div>

      {/* VVV Token Price Chart */}
      <Card className="bg-card border-border shadow-card">
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Coins className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">VVV</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[120px] sm:max-w-none">
                  {VVV_TOKEN_ADDR.slice(0, 6)}...{VVV_TOKEN_ADDR.slice(-4)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg sm:text-xl font-semibold text-foreground">${vvvPrice.toFixed(2)}</p>
              <p className="text-xs text-chart-1">+5.23% (24h)</p>
            </div>
          </div>
          
          {/* Time Period Tabs */}
          <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
            {(t('分,时,天,周,月', 'Min,Hr,Day,Week,Month')).split(',').map((period, i) => (
              <button
                key={period}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors',
                  i === 2 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:bg-secondary'
                )}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Chart Area */}
          <div className="relative">
            {/* Chart with Y-axis on right */}
            <div className="flex">
              <div className="flex-1 relative h-[140px] sm:h-[160px]">
                {/* Horizontal grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="border-t border-dashed border-border/40 w-full" />
                  <div className="border-t border-dashed border-border/40 w-full" />
                  <div className="border-t border-dashed border-border/40 w-full" />
                  <div className="border-t border-dashed border-border/40 w-full" />
                  <div className="border-t border-border/40 w-full" />
                </div>
                
                {/* Vertical grid lines */}
                <div className="absolute inset-0 flex justify-between pointer-events-none">
                  <div className="border-l border-dashed border-border/30 h-full" />
                  <div className="border-l border-dashed border-border/30 h-full" />
                  <div className="border-l border-dashed border-border/30 h-full" />
                  <div className="border-l border-dashed border-border/30 h-full" />
                  <div className="border-l border-dashed border-border/30 h-full" />
                  <div className="border-l border-dashed border-border/30 h-full" />
                </div>

                {/* Line chart SVG */}
                <svg className="w-full h-full relative z-10" viewBox="0 0 200 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  {/* Area fill */}
                  <path
                    d="M0,60 L15,55 L25,58 L35,45 L50,50 L65,40 L80,45 L95,35 L110,42 L125,38 L140,30 L155,35 L170,25 L185,30 L200,20 L200,100 L0,100 Z"
                    fill="url(#areaGradient)"
                  />
                  {/* Line */}
                  <path
                    d="M0,60 L15,55 L25,58 L35,45 L50,50 L65,40 L80,45 L95,35 L110,42 L125,38 L140,30 L155,35 L170,25 L185,30 L200,20"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              
              {/* Y-axis labels on right */}
              <div className="flex flex-col justify-between text-[10px] text-muted-foreground pl-2 py-0">
                <span>$0.28</span>
                <span>$0.26</span>
                <span>$0.25</span>
                <span>$0.24</span>
                <span>$0.22</span>
              </div>
            </div>
            
            {/* X-axis labels */}
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground pr-8">
              <span>22</span>
              <span>23</span>
              <span>24</span>
              <span>25</span>
              <span>26</span>
              <span>27</span>
              <span>{t('今天', 'Today')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stake Mode Selection */}
        <Card className="lg:col-span-2 bg-card border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Coins className="h-5 w-5 text-primary" />
              {t('选择质押模式', 'Select Stake Mode')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('选择适合您的质押本位模式，一旦确认不可更改', 'Choose your preferred staking mode — cannot be changed after confirmation')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 sm:space-y-6">
            {/* Mode Toggle */}
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <button
                onClick={() => setStakeMode('coin')}
                className={cn(
                  'relative flex flex-col items-start gap-2 sm:gap-3 rounded-xl border-2 p-4 sm:p-5 text-left transition-all',
                  stakeMode === 'coin'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-secondary/30 hover:border-muted-foreground hover:bg-secondary/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg',
                    stakeMode === 'coin' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    <Coins className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base text-foreground">{t('币本位模式', 'Coin-Based')}</h3>
                    <p className="text-xs text-muted-foreground">Coin-Based</p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t('以 VVV 代币数量为基数计算收益，追求币量增加 + 币价上涨的复利效应', 'Rewards calculated on VVV token quantity — maximize compound gains from both token growth and price appreciation')}
                </p>
                {stakeMode === 'coin' && (
                  <div className="absolute right-3 top-3 h-3 w-3 rounded-full bg-primary" />
                )}
              </button>

              <button
                onClick={() => setStakeMode('fiat')}
                className={cn(
                  'relative flex flex-col items-start gap-2 sm:gap-3 rounded-xl border-2 p-4 sm:p-5 text-left transition-all',
                  stakeMode === 'fiat'
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-secondary/30 hover:border-muted-foreground hover:bg-secondary/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg',
                    stakeMode === 'fiat' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base text-foreground">{t('金本位模式', 'Fiat-Based')}</h3>
                    <p className="text-xs text-muted-foreground">Fiat-Based</p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t('以美金价值为基数，锁定固定美金收益，自带防跌气垫保护', 'USD-denominated rewards with built-in downside protection')}
                </p>
                {stakeMode === 'fiat' && (
                  <div className="absolute right-3 top-3 h-3 w-3 rounded-full bg-accent" />
                )}
              </button>
            </div>

            {/* Period Selection */}
            <div className="space-y-3">
              <h4 className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {t('选择质押周期', 'Select Period')}
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                {stakePeriods.map((period) => (
                  <button
                    key={`${period.duration}-${period.unit}`}
                    onClick={() => setSelectedPeriod(period)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 sm:gap-2 rounded-xl border p-3 sm:p-4 transition-all',
                      selectedPeriod.duration === period.duration && selectedPeriod.unit === period.unit
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-secondary/20 hover:border-muted-foreground hover:bg-secondary/40'
                    )}
                  >
                    <span className="text-xl sm:text-2xl font-semibold text-foreground">{period.duration}</span>
                    <span className="text-xs text-muted-foreground">{period.unit === 'hour' ? t('时', 'hr') : t('天', 'd')}</span>
                    <div className="w-full h-px bg-border" />
                    <div className="text-center">
                      <p className="text-xs sm:text-sm font-medium text-primary">{period.dailyRate}%</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{rewardRateLabel}</p>
                    </div>
                    <p className="text-xs sm:text-sm text-chart-1 font-medium">+{period.totalReturn}%</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-medium text-foreground">
                  {stakeMode === 'coin' ? t('可质押最大数量', 'Max Stakeable') : t('可质押最大金额', 'Max Stakeable')}
                </span>
                <span className="text-muted-foreground">
                  {!address
                    ? t('请连接钱包', 'Please connect wallet')
                    : !isBase
                    ? t(`请切换到 Base Sepolia（当前 chainId: ${chainId}）`, `Please switch to Base Sepolia (current chainId: ${chainId})`)
                    : balancePending
                    ? t('读取余额中...', 'Loading balance...')
                    : balanceError
                    ? t('余额读取失败，请刷新重试', 'Balance read failed, please refresh')
                    : stakeMode === 'coin'
                    ? `${availableVvvBalance.toLocaleString()} VVV ($${availableUsdBalance.toFixed(2)})`
                    : `$${availableUsdBalance.toFixed(2)} (${availableVvvBalance.toLocaleString()} VVV)`}
                </span>
              </div>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={stakeMode === 'coin' ? t('输入 VVV 数量', 'Enter VVV amount') : t('输入美金金额', 'Enter USD amount')}
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(sanitizeStakeAmount(e.target.value))}
                  onKeyDown={(e) => {
                    if (['-', '+', 'e', 'E'].includes(e.key)) {
                      e.preventDefault()
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault()
                    setStakeAmount(sanitizeStakeAmount(e.clipboardData.getData('text')))
                  }}
                  className="h-12 sm:h-14 text-base sm:text-lg bg-input border-border pr-16 sm:pr-20"
                />
                <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 sm:gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 sm:h-8 text-xs text-primary hover:text-primary hover:bg-primary/10 px-2 font-medium"
                    disabled={!address || !isBase || balancePending || balanceError || availableVvvBalance === 0}
                    onClick={() => setStakeAmount(stakeMode === 'coin' ? String(availableVvvBalance) : availableUsdBalance.toFixed(2))}
                  >
                    MAX
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">
                  {stakeMode === 'coin' 
                    ? `≈ $${usdValue.toFixed(2)} USD` 
                    : `≈ ${vvvAmount.toFixed(2)} VVV`}
                </span>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {t(`最低质押 $${minStakeUsd}`, `Min. stake $${minStakeUsd}`)}
                </span>
              </div>
            </div>

            {/* Stake Button */}
            <Button
              className="w-full h-11 sm:h-12 text-sm sm:text-base bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              disabled={stakeDisabled || isStaking}
              onClick={handleStake}
            >
              {isStaking ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{t('处理中...', 'Processing...')}</>
              ) : (
                <>{t('确认质押', 'Confirm Stake')}<ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Estimated Returns */}
        <Card className="bg-card border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="h-5 w-5 text-chart-1" />
              {t('预估收益', 'Estimated Returns')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 sm:space-y-6">
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-4 sm:p-6 border border-primary/20">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                {stakeMode === 'coin' ? t(`预计每${rewardUnitLabel}收益 (VVV)`, `Est. ${rewardUnitLabel} Reward (VVV)`) : t(`预计每${rewardUnitLabel}收益 (USD)`, `Est. ${rewardUnitLabel} Reward (USD)`)}
              </p>
              <p className="text-2xl sm:text-3xl font-semibold text-foreground font-mono">
                {stakeMode === 'coin' 
                  ? `${estimatedDailyReward.toFixed(4)} VVV`
                  : `$${estimatedDailyReward.toFixed(2)}`}
              </p>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="flex justify-between items-center py-2.5 sm:py-3 border-b border-border">
                <span className="text-xs sm:text-sm text-muted-foreground">{t('质押周期', 'Stake Period')}</span>
                <span className="text-sm font-medium text-foreground">{getPeriodLabel(selectedPeriod, t)}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 sm:py-3 border-b border-border">
                <span className="text-xs sm:text-sm text-muted-foreground">{rewardRateLabel}</span>
                <span className="text-sm font-medium text-primary">{selectedPeriod.dailyRate}%</span>
              </div>
              <div className="flex justify-between items-center py-2.5 sm:py-3 border-b border-border">
                <span className="text-xs sm:text-sm text-muted-foreground">{t('周期总收益率', 'Total Return Rate')}</span>
                <span className="text-sm font-medium text-chart-1">+{selectedPeriod.totalReturn}%</span>
              </div>
              <div className="flex justify-between items-center py-2.5 sm:py-3">
                <span className="text-xs sm:text-sm text-muted-foreground">{t('预计总收益', 'Est. Total Reward')}</span>
                <span className="text-base sm:text-lg font-semibold text-foreground">
                  {stakeMode === 'coin' 
                    ? `${estimatedTotalReward.toFixed(4)} VVV`
                    : `$${estimatedTotalReward.toFixed(2)}`}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 sm:p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-[10px] sm:text-xs text-muted-foreground space-y-1">
                  <p>{t('收益实时产生，领取扣除 10% 手续费', 'Rewards accrue in real time; 10% fee on claim')}</p>
                  <p>{t('本金到期解锁，全额提取 0 手续费', 'Principal unlocked at maturity; 0% withdrawal fee')}</p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>

    </div>
  )
}
