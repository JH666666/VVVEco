'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { SIM_ROOT_WALLET_ADDRESS, SIM_VVV_USD_PRICE, formatSimAddress, getSimInviteCode, useLocalWeb3Sim } from '@/contexts/local-web3-sim-context'
import { useAdminControls } from '@/lib/admin-controls'
import { useWalletAuth } from '@/contexts/wallet-auth-context'
import { useRewardConfig } from '@/lib/reward-config'
import { getUserLevelOverride, useUserLevelOverrides } from '@/lib/user-level-overrides'
import { fetchTeamRewards } from '@/lib/api-client'
import { useLanguage } from '@/contexts/language-context'
import { useUserOnChainInfo } from '@/lib/contract-hooks'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  Users,
  TrendingUp,
  Copy,
  Check,
  Pencil,
  ChevronDown,
  ChevronRight,
  Star,
  Crown,
  Gem,
  Medal,
  Award,
  Shield,
  User,
} from 'lucide-react'

interface TeamMember {
  id: string
  address: string
  fullAddress: string
  level: number
  stakeAmount: number
  contribution: number
  joinDate: string
  children?: TeamMember[]
}

function formatLevelThreshold(value: number) {
  if (value >= 1000000) return `≥$${value / 1000000}M`
  if (value >= 1000) return `≥$${value / 1000}K`
  return `≥$${value}`
}

// V1-V8 等级配置 (根据7层内团队总业绩)
const levelMeta = [
  { level: 1, name: 'V1', icon: User, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  { level: 2, name: 'V2', icon: Star, color: 'text-chart-4', bgColor: 'bg-chart-4/10' },
  { level: 3, name: 'V3', icon: Medal, color: 'text-accent', bgColor: 'bg-accent/10' },
  { level: 4, name: 'V4', icon: Award, color: 'text-chart-1', bgColor: 'bg-chart-1/10' },
  { level: 5, name: 'V5', icon: Shield, color: 'text-chart-2', bgColor: 'bg-chart-2/10' },
  { level: 6, name: 'V6', icon: Gem, color: 'text-chart-5', bgColor: 'bg-chart-5/10' },
  { level: 7, name: 'V7', icon: Crown, color: 'text-primary', bgColor: 'bg-primary/10' },
  { level: 8, name: 'V8', icon: Crown, color: 'text-chart-3', bgColor: 'bg-chart-3/10' },
]

type LevelConfigItem = (typeof levelMeta)[number] & { rate: number; threshold: string }

// Calculate level based on team stake amount
function calculateLevel(teamStake: number, thresholds: number[]): number {
  for (let index = thresholds.length - 1; index >= 0; index -= 1) {
    if (teamStake >= (thresholds[index] ?? 0)) return index + 1
  }

  return 1
}

// Calculate total team stake from tree (excluding self)
function calculateTeamStake(member: TeamMember, includeSelf = false): number {
  let total = includeSelf ? member.stakeAmount : 0
  if (member.children) {
    for (const child of member.children) {
      total += child.stakeAmount + calculateTeamStake(child, false)
    }
  }
  return total
}

function formatTeamReward(value: number) {
  if (value === 0) return '0.0000'
  return value < 1 ? value.toFixed(6) : value.toFixed(4)
}

function isActiveStakeOrder(order: { createdAtMs?: number; period: number; periodUnit?: 'day' | 'hour' }) {
  const startMs = order.createdAtMs ?? Date.now()
  const unitMs = order.periodUnit === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  return Date.now() < startMs + order.period * unitMs
}

function TeamMemberNode({ 
  member, 
  layer = 0, 
  expanded, 
  copiedAddress,
  nicknames,
  levelConfig,
  onCopyAddress,
  onNicknameChange,
  onToggle
}: { 
  member: TeamMember
  layer?: number
  expanded: Set<string>
  copiedAddress: string
  nicknames: Record<string, string>
  levelConfig: LevelConfigItem[]
  onCopyAddress: (address: string) => void
  onNicknameChange: (address: string, value: string) => void
  onToggle: (id: string) => void
}) {
  const { t } = useLanguage()
  const levelInfo = levelConfig[member.level - 1]
  const hasChildren = member.children && member.children.length > 0
  const isExpanded = expanded.has(member.id)
  const nickname = nicknames[member.fullAddress.toLowerCase()] ?? ''

  return (
    <div className="space-y-2">
      <div 
        className={cn(
          'flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border p-3 sm:p-4 transition-all',
          layer === 0 
            ? 'border-primary/30 bg-primary/5' 
            : 'border-border bg-card hover:bg-secondary/30',
          hasChildren && 'cursor-pointer'
        )}
        onClick={() => hasChildren && onToggle(member.id)}
        style={{ marginLeft: Math.min(layer * 16, layer * 24) }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {hasChildren && (
            <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center shrink-0">
              {isExpanded 
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> 
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
              }
            </div>
          )}
          {!hasChildren && <div className="w-5 sm:w-6 shrink-0" />}

          <div className={cn('flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg shrink-0', levelInfo.bgColor)}>
            <levelInfo.icon className={cn('h-4 w-4 sm:h-5 sm:w-5', levelInfo.color)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-mono text-xs sm:text-sm text-foreground">{member.address}</span>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                onClick={event => {
                  event.stopPropagation()
                  onCopyAddress(member.fullAddress)
                }}
                aria-label={t('复制地址', 'Copy address')}
              >
                {member.fullAddress === copiedAddress ? (
                  <Check className="h-3.5 w-3.5 text-chart-1" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <span className={cn('text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap', levelInfo.bgColor, levelInfo.color)}>
                V{member.level}
              </span>
              <div className="flex h-6 max-w-32 items-center gap-1 rounded-full bg-secondary/70 px-2">
                <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
                <input
                  value={nickname}
                  onChange={event => onNicknameChange(member.fullAddress, event.target.value)}
                  onClick={event => event.stopPropagation()}
                  placeholder={t('昵称', 'Nickname')}
                  className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-10 sm:pl-0">
          {layer > 0 && member.stakeAmount === 0 ? (
            <div className="text-left sm:text-right">
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t('待质押', 'Not staked')}</span>
            </div>
          ) : (
            <div className="text-left sm:text-right">
              <p className="text-sm sm:text-base font-semibold text-foreground">${member.stakeAmount.toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t('质押金额', 'Staked')}</p>
            </div>
          )}

          {layer > 0 && member.stakeAmount > 0 && (
            <div className="text-left sm:text-right">
              <p className="text-sm sm:text-base font-medium text-chart-1">+{formatTeamReward(member.contribution)} VVV</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t('贡献奖励', 'Contribution')}</p>
            </div>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-2">
          {member.children?.map(child => (
            <TeamMemberNode 
              key={child.id} 
              member={child} 
              layer={layer + 1}
              expanded={expanded}
              copiedAddress={copiedAddress}
              nicknames={nicknames}
              levelConfig={levelConfig}
              onCopyAddress={onCopyAddress}
              onNicknameChange={onNicknameChange}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function TeamMatrix() {
  const { toast } = useToast()
  const { t } = useLanguage()
  const { accounts, claimTeamRewards, referrals, stakes, teamRewards } = useLocalWeb3Sim()
  const { signedAddress } = useWalletAuth()
  const walletAddr = signedAddress ?? ""
  const { controls } = useAdminControls()
  const { config: rewardConfig } = useRewardConfig()
  const { overrides: levelOverrides } = useUserLevelOverrides()
  // 贡献奖励以数据库为准（下级领取时结算入库），不再定时读链——原 onChainTeamTotal 是未使用的死代码
  const onChainInfo = useUserOnChainInfo(signedAddress ?? undefined)
  const onChainLevel = onChainInfo?.level ?? 0
  const teamRewardList = Array.isArray(teamRewards) ? teamRewards : []
  const [apiTeamRewards, setApiTeamRewards] = useState<typeof teamRewardList>([])
  const [copied, setCopied] = useState(false)
  const [addressCopied, setAddressCopied] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set([walletAddr]))
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [apiReferrals, setApiReferrals] = useState<Record<string, string>>({})
  const [apiStakeByAccount, setApiStakeByAccount] = useState<Record<string, number>>({})
  const [apiTreeUsers, setApiTreeUsers] = useState<Array<{ walletAddress: string; inviteCode: string; createdAt: string }>>([])
  const [realInviteCode, setRealInviteCode] = useState<string | null>(null)


  useEffect(() => {
    try {
      setNicknames(JSON.parse(localStorage.getItem("vvveco-team-nicknames") ?? "{}"))
    } catch {
      setNicknames({})
    }
  }, [])

  // API fetch: team rewards; clear on disconnect
  useEffect(() => {
    if (!walletAddr) {
      setApiTeamRewards([])
      setApiReferrals({})
      setApiStakeByAccount({})
      setApiTreeUsers([])
      return
    }
    fetchTeamRewards(walletAddr).then((data) => {
      if (data.length > 0) setApiTeamRewards(data)
    })
  }, [walletAddr])

  // 拉取当前用户真实邀请码（首次质押后由服务端生成）
  useEffect(() => {
    if (!walletAddr) { setRealInviteCode(null); return }
    fetch(`/api/users/${encodeURIComponent(walletAddr)}`)
      .then(r => r.json())
      .then((data: { inviteCode?: string | null }) => {
        setRealInviteCode(data.inviteCode ?? null)
      })
      .catch(() => {})
  }, [walletAddr])

  // API fetch: team tree (referrals + stake amounts)
  useEffect(() => {
    if (!walletAddr) return
    fetch(`/api/team-tree?wallet=${encodeURIComponent(walletAddr)}`)
      .then(r => r.json())
      .then((data: { referrals?: Record<string, string>; stakeByAccount?: Record<string, number>; users?: Array<{ walletAddress: string; inviteCode: string; createdAt: string }> }) => {
        if (data.referrals && Object.keys(data.referrals).length > 0) setApiReferrals(data.referrals)
        if (data.stakeByAccount) setApiStakeByAccount(data.stakeByAccount)
        if (data.users) setApiTreeUsers(data.users)
      })
      .catch(() => {})
  }, [walletAddr])

  // Merge: API preferred, localStorage as fallback
  const mergedTeamRewards = walletAddr ? (apiTeamRewards.length > 0 ? apiTeamRewards : teamRewardList) : []

  useEffect(() => {
    setExpanded(new Set([walletAddr]))
  }, [walletAddr])

  const simStakeByAccount = accounts.reduce<Record<string, number>>((acc, account) => {
    acc[account.address.toLowerCase()] = stakes
      .filter(order => order.account.toLowerCase() === account.address.toLowerCase() && isActiveStakeOrder(order))
      .reduce((sum, order) => sum + order.usdValue, 0)
    return acc
  }, {})
  const stakeByAccount = walletAddr ? (Object.keys(apiStakeByAccount).length > 0 ? apiStakeByAccount : simStakeByAccount) : {}
  const levelConfig = levelMeta.map((level, index) => ({
    ...level,
    rate: rewardConfig.levelRates[index] ?? (index + 1) * 10,
    threshold: formatLevelThreshold(rewardConfig.levelThresholds[index] ?? 0),
  }))

  // 按"链上事件唯一身份"去重：同一条 TeamRewardAccrued 曾被浏览器(十六进制logIndex)
  // 与服务端(十进制logIndex)重复写库，这里把 claimId 的 logIndex 后缀规范化后去重，
  // 保证贡献奖励=链上真实值（无需手动对账）。
  const myTeamRewardRecords = useMemo(() => {
    const mine = mergedTeamRewards.filter(r => r.beneficiary.toLowerCase() === walletAddr.toLowerCase())
    const seen = new Set<string>()
    const out: typeof mine = []
    for (const r of mine) {
      const claimId = String((r as { claimId?: string }).claimId ?? '')
      const us = claimId.lastIndexOf('_')
      let key: string
      if (us >= 0) {
        const base = claimId.slice(0, us)
        const suf = claimId.slice(us + 1)
        const idx = /^0x[0-9a-f]+$/i.test(suf) ? String(parseInt(suf, 16))
          : /^\d+$/.test(suf) ? String(parseInt(suf, 10)) : suf
        key = `${base}_${idx}`
      } else {
        // 无 logIndex 的历史/兜底记录：用 交易|上级|下级|金额 兜底去重
        key = `${claimId}|${r.sourceAccount}|${r.amount}`
      }
      key = key.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(r)
    }
    return out
  }, [walletAddr, mergedTeamRewards])
  const pendingTeamRewards = myTeamRewardRecords
    .filter(reward => !reward.claimed)
    .reduce((sum, reward) => sum + reward.amount, 0)
  const claimedTeamRewards = myTeamRewardRecords
    .filter(reward => reward.claimed)
    .reduce((sum, reward) => sum + reward.amount, 0)
  const getRewardContribution = (address: string): number => myTeamRewardRecords
    .filter(reward => reward.sourceAccount.toLowerCase() === address.toLowerCase())
    .reduce((sum, reward) => sum + reward.amount, 0)

  const activeReferrals = walletAddr ? (Object.keys(apiReferrals).length > 0 ? apiReferrals : referrals) : {}
  const getRawChildren = (address: string) => Object.entries(activeReferrals)
    .filter(([, parent]) => parent.toLowerCase() === address.toLowerCase())
    .map(([child]) => child)

  // 显示所有已绑定的下级（含未质押），不做跳过压缩
  const getCompressedChildren = (address: string): string[] => getRawChildren(address)

  const buildTeamNode = (address: string, remainingLevels = 7): TeamMember => {
    const apiUser = apiTreeUsers.find(u => u.walletAddress === address.toLowerCase())
    const account = accounts.find(item => item.address.toLowerCase() === address.toLowerCase())
    const children = remainingLevels > 0
      ? getCompressedChildren(address).map(child => buildTeamNode(child, remainingLevels - 1))
      : []
    const directStake = stakeByAccount[address.toLowerCase()] ?? 0
    const downlineStake = children.reduce((sum, child) => sum + child.stakeAmount + calculateTeamStake(child), 0)
    const rewardContribution = getRewardContribution(address)
      + children.reduce((sum, child) => sum + child.contribution, 0)

    const manualLevel = getUserLevelOverride(address, levelOverrides)

    return {
      id: address,
      address: account?.shortAddress ?? formatSimAddress(address),
      fullAddress: address,
      level: manualLevel ?? calculateLevel(downlineStake, rewardConfig.levelThresholds),
      stakeAmount: directStake,
      contribution: rewardContribution,
      joinDate: apiUser?.createdAt ?? stakes.find(order => order.account === address)?.createdAt ?? '待质押',
      children,
    }
  }

  const teamData = buildTeamNode(walletAddr)
  const isRootWallet = walletAddr.toLowerCase() === SIM_ROOT_WALLET_ADDRESS.toLowerCase()
  const hasStaked = isRootWallet || (stakeByAccount[walletAddr.toLowerCase()] ?? 0) > 0
  // 使用服务端真实邀请码；未质押时为 null（不展示邀请码卡片）
  const inviteCode = realInviteCode ?? ''
  const totalTeamMembers = (() => {
    let count = 0
    const walk = (member: TeamMember) => {
      member.children?.forEach(child => {
        count += 1
        walk(child)
      })
    }
    walk(teamData)
    return count
  })()
  const directMembers = teamData.children?.length ?? 0
  const totalTeamStake = calculateTeamStake(teamData)
  // 优先使用链上等级（users[address].level），fallback 到本地计算
  const myLevelNumber = getUserLevelOverride(walletAddr, levelOverrides)
    ?? (onChainLevel > 0 ? onChainLevel : calculateLevel(totalTeamStake, rewardConfig.levelThresholds))
  const myLevel = levelConfig[Math.max(0, myLevelNumber - 1)]

  // 兼容 TP Wallet / Safari / Android WebView —— clipboard API 不可用时降级 execCommand
  const copyText = async (text: string): Promise<boolean> => {
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        // 权限拒绝或不支持，降级
      }
    }
    // fallback: textarea + execCommand
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }

  const handleCopy = async () => {
    const ok = await copyText(inviteCode)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: t('邀请码已复制', 'Invite code copied') })
    } else {
      toast({ title: t('复制失败，请手动复制', 'Copy failed, please copy manually'), variant: 'destructive' })
    }
  }

  const handleCopyAddress = async (address: string) => {
    const ok = await copyText(address)
    if (ok) {
      setAddressCopied(address)
      setTimeout(() => setAddressCopied(''), 1500)
    } else {
      toast({ title: t('复制失败，请手动复制', 'Copy failed, please copy manually'), variant: 'destructive' })
    }
  }

  const handleNicknameChange = (address: string, value: string) => {
    setNicknames(current => {
      const key = address.toLowerCase()
      const next = { ...current, [key]: value }

      if (!value.trim()) {
        delete next[key]
      }

      localStorage.setItem('vvveco-team-nicknames', JSON.stringify(next))
      return next
    })
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">{t('我的团队', 'My Team')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {t('查看您的团队矩阵，追踪伞下业绩', 'View your team matrix and track downline performance')}
          </p>
        </div>
        {/* My Level Card — includes team stake */}
        <Card className={cn('border shadow-card', myLevel.bgColor, 'border-primary/20')}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={cn('flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl shrink-0', myLevel.bgColor)}>
                <myLevel.icon className={cn('h-6 w-6 sm:h-7 sm:w-7', myLevel.color)} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('text-lg sm:text-xl font-bold', myLevel.color)}>{myLevel.name}</span>
                  <span className="text-xs sm:text-sm px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{myLevel.rate}%</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('等级要求', 'Req')}: <span className="font-medium text-foreground">{myLevel.threshold}</span>
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('团队质押', 'Team Stake')}: <span className="font-medium text-foreground">${totalTeamStake.toLocaleString()}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Overview — 2 cards */}
      <div className="grid grid-cols-2 gap-3 lg:gap-4">
        <Card className="bg-card border-border shadow-card">
          <CardContent className="flex items-center gap-3 p-3 sm:p-5 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('团队总人数', 'Total Members')}</p>
              <p className="text-lg sm:text-xl font-semibold text-foreground">{totalTeamMembers}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-card">
          <CardContent className="flex items-center gap-3 p-3 sm:p-5 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-chart-4/10 shrink-0">
              <Star className="h-5 w-5 sm:h-6 sm:w-6 text-chart-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{t('直推人数', 'Direct Referrals')}</p>
              <p className="text-lg sm:text-xl font-semibold text-foreground">{directMembers}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Invite Code - 只有首次质押后服务端生成邀请码才显示 */}
        {!!realInviteCode ? (
          <Card className="bg-card border-border shadow-card">
            <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">{t('我的邀请码', 'My Invite Code')}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{t('分享您的邀请码邀请好友加入', 'Share your invite code to invite friends')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
              <div className="flex gap-2">
                <Input 
                  value={inviteCode} 
                  readOnly 
                  className="bg-input border-border font-mono text-center text-base sm:text-lg font-semibold h-10 sm:h-12"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0 h-10 w-10 sm:h-12 sm:w-12 hover:bg-primary/10 hover:text-primary hover:border-primary"
                >
                  {copied ? <Check className="h-4 w-4 text-chart-1" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t(`邀请奖励一代收益的${rewardConfig.generationRates[0]}%，二代收益的${rewardConfig.generationRates[1]}%，三代收益的${rewardConfig.generationRates[2]}%，邀请越多奖励越多`, `Earn ${rewardConfig.generationRates[0]}% from gen-1, ${rewardConfig.generationRates[1]}% from gen-2, ${rewardConfig.generationRates[2]}% from gen-3 referral rewards — invite more, earn more`)}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border shadow-card">
            <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">{t('我的邀请码', 'My Invite Code')}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{t('完成首次质押后获取您的专属邀请码', 'Complete your first stake to get your invite code')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
              <div className="rounded-lg bg-secondary/30 p-4 sm:p-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">{t('您还未参与质押', 'You have not staked yet')}</p>
                <p className="text-xs text-muted-foreground">{t('完成首次质押后，系统将自动生成您的专属邀请码', 'Your invite code will be generated automatically after your first stake')}</p>
                <p className="mt-3 text-xs text-muted-foreground">{t(`邀请奖励一代收益的${rewardConfig.generationRates[0]}%，二代收益的${rewardConfig.generationRates[1]}%，三代收益的${rewardConfig.generationRates[2]}%，邀请越多奖励越多`, `Earn ${rewardConfig.generationRates[0]}% from gen-1, ${rewardConfig.generationRates[1]}% from gen-2, ${rewardConfig.generationRates[2]}% from gen-3 — invite more, earn more`)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Level Progress */}
        <Card className="lg:col-span-2 bg-card border-border shadow-card">
          <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">{t('V1-V8 等级体系', 'V1-V8 Level System')}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{t('根据层数紧缩制，团队总业绩达标自动升级，等级越高奖励比例越高', 'Compressed-tier system — auto-upgrade when team performance reaches threshold, higher level means higher reward ratio')}</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{t('* 平级奖励 10%', '* Same-level bonus 10%')}</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
              {levelConfig.map((level) => (
                <div 
                  key={level.level}
                  className={cn(
                    'flex flex-col items-center gap-1 sm:gap-1.5 rounded-xl border p-2 sm:p-3 transition-all',
                    myLevel.level === level.level 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border bg-secondary/20'
                  )}
                >
                  <div className={cn('flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg', level.bgColor)}>
                    <level.icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', level.color)} />
                  </div>
                  <span className={cn('text-[10px] sm:text-xs font-medium', level.color)}>{level.name}</span>
                  <span className="text-xs sm:text-sm font-semibold text-foreground">{level.rate}%</span>
                  <span className="text-[8px] sm:text-[10px] text-muted-foreground">{level.threshold}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Tree */}
      <Card className="bg-card border-border shadow-card">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">{t('团队矩阵', 'Team Matrix')}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">{t('可视化展示您的伞下团队结构', 'Visualize your downline team structure')}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 overflow-x-auto">
          <div className="min-w-0">
            <TeamMemberNode 
              member={teamData} 
              expanded={expanded}
              copiedAddress={addressCopied}
              nicknames={nicknames}
              onCopyAddress={handleCopyAddress}
              onNicknameChange={handleNicknameChange}
              levelConfig={levelConfig}
              onToggle={toggleExpand}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
