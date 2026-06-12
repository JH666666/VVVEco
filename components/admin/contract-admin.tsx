'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, CheckCircle2, Coins, Copy, KeyRound, Loader2, Lock, Settings2, ShieldCheck, Unlock, Wallet } from 'lucide-react'
import { VVV_ECO_STAKING_ABI, VVV_ECO_STAKING_CONTRACT, VVV_TOKEN_ADDRESS } from '@/lib/contracts/vvv-eco'
import { formatSimAddress, readStoredSimAccounts, resolveSimInviteCode } from '@/contexts/local-web3-sim-context'
import { formatEther, parseEther } from 'viem'
import { useAccount, useChainId, useWriteContract, useBalance } from 'wagmi'
import { useAdminControls } from '@/lib/admin-controls'
import { STAKING_ADDR, useSetFreezeStatus, useSetFeePercent, useSetProjectWallet, useSetFeeWallet, useTransferOwnership, useSetMockPrice, useStakingOwnerData, useLatestPriceData } from '@/lib/contract-hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PAYOUT_ADDR = (process.env.NEXT_PUBLIC_VVECO_PAYOUT ?? '0x0000000000000000000000000000000000000000') as `0x${string}`

const PAYOUT_ABI = ['function rescueETH(uint256 amount) external'] as const

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

type OwnerActionKey = 'owner' | 'projectWallet' | 'feeWallet' | 'feePercent'

const ownerActions: Array<{
  key: OwnerActionKey
  icon: typeof KeyRound
  title: string
  subtitle: string
  description: string       // used as draftKey (internal)
  currentValueLabel: string
  label: string
  placeholder: string
  buttonLabel: string
  note?: string
}> = [
  {
    key: 'owner',
    icon: KeyRound,
    title: 'Owner 权限管理',
    subtitle: '当前拥有合约最高权限的钱包地址',
    description: 'transferOwnership(newOwner)',
    currentValueLabel: '当前权限地址',
    label: '新 Owner 地址',
    placeholder: '0x...',
    buttonLabel: '转移 Owner 权限',
  },
  {
    key: 'projectWallet',
    icon: Wallet,
    title: '收款钱包',
    subtitle: '质押 ETH 的接收地址',
    description: 'setProjectWallet(newWallet)',
    currentValueLabel: '当前收款地址',
    label: '新收款地址',
    placeholder: '0x...',
    buttonLabel: '保存收款地址',
  },
  {
    key: 'feeWallet',
    icon: Wallet,
    title: '手续费钱包',
    subtitle: '手续费收取地址',
    description: 'setFeeWallet(newFeeWallet)',
    currentValueLabel: '当前手续费地址',
    label: '新手续费地址',
    placeholder: '0x...',
    buttonLabel: '保存手续费地址',
  },
  {
    key: 'feePercent',
    icon: Settings2,
    title: '手续费比例',
    subtitle: '每笔质押收取的手续费百分比',
    description: 'setFeePercent(newFee)',
    currentValueLabel: '当前手续费比例',
    label: '新手续费比例',
    placeholder: '0',
    buttonLabel: '保存手续费比例',
  },
  {
    key: 'feePercent',
    icon: Coins,
    title: '测试价格模拟',
    subtitle: '仅用于测试网模拟 VVV 价格，正式主网不会使用此价格。',
    description: 'setMockPrice(newPrice)',
    currentValueLabel: '当前模拟价格',
    label: '新模拟价格（USD）',
    placeholder: '0.15',
    buttonLabel: '更新模拟价格',
    note: '⚠️ 仅测试网有效。修改后会影响金本位订单的收益和本金计算。',
  },
]

// Contract config from API, not localStorage
async function fetchContractConfig() {
  try {
    const res = await fetch("/api/admin/contract-config");
    if (!res.ok) throw new Error("API fail");
    return await res.json();
  } catch {
    return {
      stakingContract: VVV_ECO_STAKING_CONTRACT.address,
      payoutContract: "",
      vvvToken: VVV_TOKEN_ADDRESS,
      priceRouter: "",
      projectWallet: "",
      feeWallet: "",
      feePercent: 10,
    };
  }
}

async function saveContractConfig(data: Record<string, unknown>) {
  await fetch("/api/admin/contract-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

function OwnerStatusBadge({ ownerAddr, ownerPending, ownerError }: {
  ownerAddr: string
  ownerPending: boolean
  ownerError: boolean
}) {
  const { address } = useAccount()

  if (!address) return null

  if (ownerPending) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 p-4">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">正在读取合约权限...</p>
      </div>
    )
  }

  if (ownerError || !ownerAddr) {
    return null
  }

  const isOwner = address.toLowerCase() === ownerAddr.toLowerCase()

  if (isOwner) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="font-medium text-emerald-200">管理员钱包已连接 (写入功能已激活)</p>
            <p className="mt-1 text-xs text-emerald-300/80">当前钱包 {address.slice(0,6)}...{address.slice(-4)} 已匹配 Owner 地址。</p>
          </div>
        </div>
        <Badge className="w-fit bg-emerald-500 text-emerald-950 hover:bg-emerald-500">✓ Owner</Badge>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-destructive">当前非 Owner 权限钱包，合约修改已被拦截！请切换钱包。</p>
          <p className="mt-1 text-xs text-destructive/80">请在钱包中切换至 Base 链并选择部署合约的 Owner 钱包。</p>
        </div>
      </div>
      <Badge variant="destructive" className="w-fit">⚠ 权限未通过</Badge>
    </div>
  )
}

const freezeTypeMeta = {
  personal: { label: '领取收益', frozenKey: 'frozenPersonalClaims' },
  team: { label: '领取团队收益', frozenKey: 'frozenTeamClaims' },
  principal: { label: '本金赎回', frozenKey: 'frozenPrincipalWithdrawals' },
} as const

function formatControlTime(value?: number) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function getUidByAddress(address: string): number {
  const accounts = readStoredSimAccounts()
  const account = accounts.find(item => item.address.toLowerCase() === address.toLowerCase())
  return account?.uid ?? 0
}


export function ContractAdmin() {
  const { toast } = useToast()
  const [contractConfig, setContractConfig] = useState<Record<string, unknown>>({})
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const [freezeTarget, setFreezeTarget] = useState("")
  const [payoutAmount, setPayoutAmount] = useState("")
  const [withdrawing, setWithdrawing] = useState(false)
  // Chain reads via wagmi (uses configured transport, auto-refetches on account/chain change)
  const { owner: ownerAddr, refetch: refetchOwner, isPending: ownerPending, isError: ownerError } = useStakingOwnerData()
  const { data: payoutBalanceData, isPending: balancePending, refetch: refetchPayoutBalance } = useBalance({ address: PAYOUT_ADDR, chainId: 84532 })
  const { price: latestPriceRaw, refetch: refetchPrice } = useLatestPriceData()
  const { writeContractAsync } = useWriteContract()
  const { address: connectedAddress } = useAccount()
  const currentChainId = useChainId()
  const isBaseSepolia = currentChainId === 84532
  const transferOwnershipChain = useTransferOwnership()
  const setMockPriceChain = useSetMockPrice()
  const isOwnerWallet = !ownerPending && !ownerError && Boolean(connectedAddress && ownerAddr && connectedAddress.toLowerCase() === ownerAddr.toLowerCase())
  const editableOwnerActions = ownerActions.filter(
    a => a.description !== 'setMockPrice(newPrice)' || isBaseSepolia
  )

  useEffect(() => {
    fetchContractConfig().then(setContractConfig)
  }, [])

  // 钱包连接后重新读取 owner（连接前 wagmi 可能未初始化导致读取失败）
  useEffect(() => {
    if (connectedAddress) {
      refetchOwner()
    }
  }, [connectedAddress, refetchOwner])

  // currentValueForKey: owner & mockPrice read live from chain; others read from DB config
  const currentValueForKey = (key: OwnerActionKey, description: string): string => {
    if (key === 'owner') {
      if (ownerError) return ''
      return ownerAddr  // '' while pending → shows 加载中...
    }
    if (description === 'setMockPrice(newPrice)') {
      if (!latestPriceRaw) return ''
      const usd = Number(latestPriceRaw) / 1e18
      return `$${usd.toFixed(4)}`
    }
    return String(contractConfig[key] ?? '')
  }

  const { controls, freezePersonalClaim, freezeTeamClaim, freezePrincipalWithdrawal } = useAdminControls()
  const [periodConfig, setPeriodConfig] = useState({
    periodRates: [0.7, 0.8, 0.9, 1.0] as number[],
    periodDurations: [7, 15, 30, 60] as number[],
    periodUnits: ["day", "day", "day", "day"] as string[],
  })

  useEffect(() => {
    fetch("/api/config/reward")
      .then((r) => r.json())
      .then((data) => setPeriodConfig({
        periodRates: data.periodRates ?? periodConfig.periodRates,
        periodDurations: data.periodDurations ?? periodConfig.periodDurations,
        periodUnits: data.periodUnits ?? periodConfig.periodUnits,
      }))
      .catch(() => {})
  }, [])
  const abiFunctions = useMemo(
    () => VVV_ECO_STAKING_ABI.filter(item => item.type === 'function' && item.name),
    [],
  )
  const permissionRows = useMemo(() => {
    const addresses = Array.from(new Set([
      ...controls.controlledAddresses,
      ...controls.frozenPersonalClaims,
      ...controls.frozenTeamClaims,
      ...controls.frozenPrincipalWithdrawals,
      ...Object.keys(controls.freezeAudits),
    ]))

    return addresses.flatMap(targetAddress => {
      const audit = controls.freezeAudits[targetAddress] ?? {}

      return (Object.keys(freezeTypeMeta) as Array<keyof typeof freezeTypeMeta>)
        .map(type => {
          const meta = freezeTypeMeta[type]
          const entry = audit[type]
          const frozen = controls[meta.frozenKey].includes(targetAddress)

          if (!entry && !frozen) return null

          return {
            targetAddress,
            type,
            label: meta.label,
            frozen,
            frozenAt: entry?.frozenAt,
            unfrozenAt: entry?.unfrozenAt,
          }
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
    })
  }, [
      controls.controlledAddresses,
      controls.frozenPersonalClaims,
      controls.frozenTeamClaims,
      controls.frozenPrincipalWithdrawals,
      controls.freezeAudits,
  ])

  const copyAbi = () => {
    const text = JSON.stringify(VVV_ECO_STAKING_ABI, null, 2)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
    } else {
      fallbackCopy(text)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }
  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }

  const setFeePercentChain = useSetFeePercent()
  const setProjectWalletChain = useSetProjectWallet()
  const setFeeWalletChain = useSetFeeWallet()

  const saveContractSetting = async (key: string, draftKey: string) => {
    const value = (draftValues[draftKey] ?? "").trim()
    if (!value) {
      toast({ title: "请输入新值", variant: "destructive" })
      return
    }
    if (!connectedAddress) {
      toast({ title: "请先连接钱包", description: "链上操作需要连接 Owner 钱包", variant: "destructive" })
      return
    }
    try {
      if (draftKey === 'transferOwnership(newOwner)') {
        toast({ title: "转移 Owner 权限中...", description: "请在钱包确认" })
        await transferOwnershipChain(value as `0x${string}`)
      } else if (draftKey === 'setMockPrice(newPrice)') {
        toast({ title: "更新价格中...", description: "请在钱包确认" })
        const priceWei = BigInt(Math.round(parseFloat(value) * 1e18))
        await setMockPriceChain(priceWei)
      } else if (key === "feePercent") {
        toast({ title: "修改手续费中...", description: "请在钱包确认" })
        await setFeePercentChain(Number(value))
      } else if (key === "projectWallet") {
        toast({ title: "修改收款钱包中...", description: "请在钱包确认" })
        await setProjectWalletChain(value)
      } else if (key === "feeWallet") {
        toast({ title: "修改手续费钱包中...", description: "请在钱包确认" })
        await setFeeWalletChain(value)
      }
      await saveContractConfig({ [key]: value, feePercent: Number(contractConfig.feePercent ?? 10) })
      toast({ title: "参数已更新" })
      setDraftValues(prev => { const next = { ...prev }; delete next[draftKey]; return next })
      fetchContractConfig().then(setContractConfig)
      if (draftKey === 'transferOwnership(newOwner)') await refetchOwner()
      if (draftKey === 'setMockPrice(newPrice)') await refetchPrice()
    } catch (e: unknown) {
      toast({ title: "操作失败", description: (e as Error)?.message?.slice(0, 100) ?? "交易未完成", variant: "destructive" })
    }
  }

  const updateConfigField = (key: string, value: string) => {
    setContractConfig((c) => ({ ...c, [key]: value }))
  }

  const saveContractBindings = async () => {
    await saveContractConfig({
      stakingContract: contractConfig.stakingContract ?? "",
      payoutContract: contractConfig.payoutContract ?? "",
      vvvToken: contractConfig.vvvToken ?? "",
      priceRouter: contractConfig.priceRouter ?? "",
      projectWallet: contractConfig.projectWallet ?? "",
      feeWallet: contractConfig.feeWallet ?? "",
      feePercent: Number(contractConfig.feePercent ?? 10),
    })
    toast({ title: "合约配置已保存", description: "已写入数据库。" })
  }

  const handleRescueETH = async () => {
    const amt = payoutAmount.trim()
    if (!amt || Number(amt) <= 0) {
      toast({ title: "请输入转出金额", variant: "destructive" })
      return
    }
    if (!connectedAddress) {
      toast({ title: "请先连接钱包", description: "链上操作需要连接 Owner 钱包", variant: "destructive" })
      return
    }
    setWithdrawing(true)
    try {
      toast({ title: "转出中...", description: "请在钱包确认交易" })
      await writeContractAsync({
        address: PAYOUT_ADDR,
        abi: PAYOUT_ABI,
        functionName: "rescueETH",
        args: [parseEther(amt)],
      })
      toast({ title: "转出成功", description: `${amt} ETH 已发送至 Owner 地址` })
      setPayoutAmount("")
      refetchPayoutBalance()
    } catch (e: unknown) {
      toast({ title: "转出失败", description: (e as Error)?.message?.slice(0, 100) ?? "交易未完成", variant: "destructive" })
    } finally {
      setWithdrawing(false)
    }
  }

  const resolveFreezeTarget = () => {
    const resolved = resolveSimInviteCode(freezeTarget)
    if (resolved) return resolved

    return /^0x[a-f0-9]{40}$/i.test(freezeTarget.trim()) ? freezeTarget.trim() : ''
  }

  const setFreezeStatusChain = useSetFreezeStatus()

  const updateFreezeStatus = async (type: "personal" | "team" | "principal", frozen: boolean, targetAddress = resolveFreezeTarget()) => {
    if (!targetAddress) {
      toast({ title: "操作失败", description: "请输入正确的用户地址", variant: "destructive" })
      return
    }
    try {
      // 1. Call contract
      toast({ title: frozen ? "冻结中..." : "解冻中...", description: "请在钱包确认交易" })
      await setFreezeStatusChain(targetAddress, frozen)
      // 2. Write DB
      if (type === "personal") freezePersonalClaim(targetAddress, frozen)
      else if (type === "team") freezeTeamClaim(targetAddress, frozen)
      else freezePrincipalWithdrawal(targetAddress, frozen)
      const typeLabel = type === "personal" ? "领取收益" : type === "team" ? "领取团队收益" : "本金赎回"
      toast({ title: frozen ? "冻结成功" : "解冻成功", description: `${formatSimAddress(targetAddress)} ${typeLabel}已${frozen ? "冻结" : "解冻"}（链上+DB）` })
    } catch (e: unknown) {
      toast({ title: "操作失败", description: (e as Error)?.message?.slice(0, 100) ?? "交易未完成", variant: "destructive" })
    }
  }

  const [savingPeriod, setSavingPeriod] = useState(false)

  const updatePeriodRate = (index: number, value: string) => {
    const nextRate = Math.max(0, Number(value) || 0)
    const nextRates = [...periodConfig.periodRates]
    nextRates[index] = nextRate
    setPeriodConfig((p) => ({ ...p, periodRates: nextRates }))
  }

  const updatePeriodDuration = (index: number, value: string) => {
    const nextDuration = Math.max(1, Number(value) || 1)
    const nextDurations = [...periodConfig.periodDurations]
    nextDurations[index] = nextDuration
    setPeriodConfig((p) => ({ ...p, periodDurations: nextDurations }))
  }

  const savePeriodConfig = async () => {
    setSavingPeriod(true)
    try {
      await fetch("/api/config/reward", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodRates: periodConfig.periodRates,
          periodDurations: periodConfig.periodDurations,
          periodUnits: periodConfig.periodUnits,
        }),
      })
      toast({ title: "周期配置已保存", description: "费率和周期数值已写入数据库，即时生效。" })
    } catch {
      toast({ title: "保存失败", description: "请检查网络后重试", variant: "destructive" })
    } finally {
      setSavingPeriod(false)
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">合约控制管理台</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            绑定 VVV 质押合约 ABI，集中管理 owner 可写参数。
          </p>
        </div>
        <Button variant="outline" onClick={copyAbi}>
          <Copy className="mr-2 h-4 w-4" />
          {copied ? '已复制 ABI' : '复制 ABI'}
        </Button>
      </div>

      <OwnerStatusBadge ownerAddr={ownerAddr} ownerPending={ownerPending} ownerError={ownerError} />

      <Card className="bg-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" />
            用户操作权限冻结
          </CardTitle>
          <CardDescription>按用户地址分别冻结领取收益、领取团队收益和本金赎回功能。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>用户地址 / Account / 邀请码</Label>
            <Input
              value={freezeTarget}
              onChange={event => setFreezeTarget(event.target.value)}
              placeholder="输入用户钱包地址"
              className="max-w-xl"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <p className="mb-3 text-sm font-medium text-foreground">领取收益</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="destructive"
                  onClick={() => updateFreezeStatus('personal', true)}
                  
                >
                  <Lock className="mr-2 h-4 w-4" />
                  冻结
                </Button>
                <Button
                  variant="outline"
                  onClick={() => updateFreezeStatus('personal', false)}
                  
                  className="border-stone-300 bg-stone-100 text-stone-900 hover:bg-stone-200"
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  解冻
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <p className="mb-3 text-sm font-medium text-foreground">领取团队收益</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="destructive"
                  onClick={() => updateFreezeStatus('team', true)}
                  
                >
                  <Lock className="mr-2 h-4 w-4" />
                  冻结
                </Button>
                <Button
                  variant="outline"
                  onClick={() => updateFreezeStatus('team', false)}
                  
                  className="border-stone-300 bg-stone-100 text-stone-900 hover:bg-stone-200"
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  解冻
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <p className="mb-3 text-sm font-medium text-foreground">本金赎回</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="destructive"
                  onClick={() => updateFreezeStatus('principal', true)}
                  
                >
                  <Lock className="mr-2 h-4 w-4" />
                  冻结
                </Button>
                <Button
                  variant="outline"
                  onClick={() => updateFreezeStatus('principal', false)}
                  
                  className="border-stone-300 bg-stone-100 text-stone-900 hover:bg-stone-200"
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  解冻
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>权限操作地址列表</Label>
            {permissionRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                暂无权限操作记录
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20 text-center">UID</TableHead>
                      <TableHead>用户地址</TableHead>
                      <TableHead>冻结类型</TableHead>
                      <TableHead>当前状态</TableHead>
                      <TableHead>冻结时间</TableHead>
                      <TableHead>解冻时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permissionRows.map(row => (
                        <TableRow key={`${row.targetAddress}-${row.type}`}>
                          <TableCell className="text-center">
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">{getUidByAddress(row.targetAddress) || '-'}</span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{formatSimAddress(row.targetAddress)}</TableCell>
                          <TableCell>{row.label}</TableCell>
                          <TableCell>
                            <Badge variant={row.frozen ? 'destructive' : 'secondary'}>
                              {row.frozen ? '已冻结' : '已解冻'}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{formatControlTime(row.frozenAt)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{formatControlTime(row.unfrozenAt)}</TableCell>
                          <TableCell className="text-right">
                            {row.frozen ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateFreezeStatus(row.type, false, row.targetAddress)}
                                className="border-stone-300 bg-stone-100 text-stone-900 hover:bg-stone-200"
                              >
                                解冻
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateFreezeStatus(row.type, true, row.targetAddress)}
                              >
                                冻结
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <Card className="bg-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              合约绑定
            </CardTitle>
            <CardDescription>绑定 Staking、出款合约、VVV Token 与价格/兑换路由地址。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Staking contract</Label>
              <Input
                value={String(contractConfig.stakingContract ?? "")}
                onChange={(event) => updateConfigField("stakingContract", event.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label>Payout contract</Label>
              <Input
                value={String(contractConfig.payoutContract ?? "")}
                onChange={(event) => updateConfigField("payoutContract", event.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label>VVV token</Label>
              <Input
                value={String(contractConfig.vvvToken ?? "")}
                onChange={(event) => updateConfigField("vvvToken", event.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label>Price / swap router</Label>
              <Input
                value={String(contractConfig.priceRouter ?? "")}
                onChange={(event) => updateConfigField("priceRouter", event.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label>Network</Label>
              <Input value={`${VVV_ECO_STAKING_CONTRACT.network} (${VVV_ECO_STAKING_CONTRACT.chainId})`} readOnly />
            </div>
            <div className="space-y-2">
              <Label>ABI functions</Label>
              <Input value={`${abiFunctions.length} linked`} readOnly />
            </div>
            <div className="sm:col-span-2">
              <Button className="w-full" onClick={saveContractBindings} >
                保存合约绑定
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">周期费率</CardTitle>
            <CardDescription>合约使用千分比日收益率。修改后点击保存，无需链上确认（DB 存储）。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>周期</TableHead>
                  <TableHead>日收益</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodConfig.periodDurations.map((duration, index) => {
                  const dailyRate = periodConfig.periodRates[index]

                  return (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          step="1"
                          value={duration}
                          onChange={event => updatePeriodDuration(index, event.target.value)}
                          className="h-9 w-20"
                        />
                        <span className="text-sm text-muted-foreground">天</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.1"
                          value={dailyRate}
                          onChange={event => updatePeriodRate(index, event.target.value)}
                          className="h-9 w-24"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <Button onClick={savePeriodConfig} disabled={savingPeriod} className="w-full">
              {savingPeriod ? '保存中...' : '保存周期配置'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowUpRight className="h-5 w-5 text-primary" />
            出款合约余额管理
          </CardTitle>
          <CardDescription>VVVPayout 合约 ETH 余额查看与 Owner 提现。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-secondary/20 p-4">
              <p className="text-xs text-muted-foreground">当前 ETH 余额</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-foreground">
                {balancePending ? '加载中...' : payoutBalanceData?.value !== undefined ? Number(formatEther(payoutBalanceData.value)).toFixed(6) : '读取失败'} ETH
              </p>
              <p className="mt-1 text-xs text-muted-foreground">余额来源：VVVPayout 合约</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/20 p-4">
              <p className="text-xs text-muted-foreground">合约地址</p>
              <p className="mt-2 break-all font-mono text-xs text-foreground">{PAYOUT_ADDR}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">当前连接</span>
                <span className="font-mono text-xs">{connectedAddress ? shortAddr(connectedAddress) : '未连接'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Owner</span>
                <span className="font-mono text-xs">
                  {ownerPending ? '读取中...' : ownerError ? '读取失败' : ownerAddr ? shortAddr(ownerAddr) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">状态</span>
                <Badge
                  className={isOwnerWallet ? 'bg-emerald-500 text-white hover:bg-emerald-500' : ''}
                  variant={ownerPending ? 'secondary' : isOwnerWallet ? 'default' : 'destructive'}
                >
                  {ownerPending ? '⏳ 检查中' : isOwnerWallet ? '✅ Owner' : '❌ 非Owner'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label>转出金额 (ETH)</Label>
              <p className="text-xs text-muted-foreground">ETH 将转出至链上 Owner 地址</p>
              <Input
                type="number"
                min={0}
                step="0.001"
                value={payoutAmount}
                onChange={event => setPayoutAmount(event.target.value)}
                placeholder="0.000"
                disabled={!isOwnerWallet}
              />
            </div>
            <div className="space-y-2">
              {!isOwnerWallet && (
                <p className="text-xs text-muted-foreground">仅 Owner 可执行转出</p>
              )}
              <Button
                onClick={handleRescueETH}
                disabled={!isOwnerWallet || withdrawing}
                className="w-full md:min-w-36"
              >
                {withdrawing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />处理中...</>
                ) : (
                  <><ArrowUpRight className="mr-2 h-4 w-4" />立即转出</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {editableOwnerActions.map(action => {
          const draftKey = action.description
          const draftVal = draftValues[draftKey] ?? ''
          const currentVal = currentValueForKey(action.key, action.description)
          return (
            <Card key={action.description} className="bg-card border-border shadow-card">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <action.icon className="h-5 w-5 text-primary" />
                  {action.title}
                </CardTitle>
                <CardDescription>{action.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-secondary/20 p-3">
                  <p className="text-xs text-muted-foreground">{action.currentValueLabel}</p>
                  <p className="mt-1 break-all font-mono text-sm text-foreground">
                    {currentVal || <span className="italic text-muted-foreground">加载中...</span>}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{action.label}</Label>
                  <Input
                    value={draftVal}
                    onChange={(event) => setDraftValues(prev => ({ ...prev, [draftKey]: event.target.value }))}
                    placeholder={action.placeholder}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!draftVal.trim()}
                  onClick={() => saveContractSetting(action.key, draftKey)}
                >
                  {draftVal.trim() ? action.buttonLabel : '请输入新值'}
                </Button>
                {action.note && (
                  <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                    {action.note}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">ABI 方法索引</CardTitle>
          <CardDescription>前端和管理台共用同一份 ABI 常量。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {abiFunctions.map(item => (
            <Badge key={item.name ?? 'unknown'} variant={item.stateMutability === 'view' ? 'secondary' : 'default'}>
              {item.name}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
