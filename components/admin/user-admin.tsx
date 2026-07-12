'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, Copy, Gift, Search, Users, Wallet, Network, Clock, Eye, EyeOff, Pencil } from 'lucide-react'
import { getUserInsight, type UserInsight, type UserListInsight } from '@/lib/admin-user-insights'
import { cn } from '@/lib/utils'
import { formatInteger, formatUsdFull } from '@/lib/global-stats'
import { useAdminControls } from '@/lib/admin-controls'
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

function formatReward(value: number) {
  if (value === 0) return '0.00'
  return value < 1 ? value.toFixed(6) : value.toFixed(2)
}

function modeLabel(mode: 'coin' | 'fiat') {
  return mode === 'coin' ? '币本位' : '金本位'
}

function periodLabel(period: number, unit?: 'day' | 'hour') {
  return `${period} ${unit === 'hour' ? '时' : '天'}`
}

function rateLabel(unit?: 'day' | 'hour') {
  return `${unit === 'hour' ? '时' : '日'}收益率`
}

export function UserAdmin() {
  const { toast } = useToast()
  const { controls, hideOrder } = useAdminControls()
  const [query, setQuery] = useState('')
  const [insight, setInsight] = useState<UserInsight | null>(null)
  const [users, setUsers] = useState<UserListInsight[]>([])
  const [registeredStart, setRegisteredStart] = useState('')
  const [registeredEnd, setRegisteredEnd] = useState('')
  const [minStake, setMinStake] = useState('')
  const [maxStake, setMaxStake] = useState('')
  const [searched, setSearched] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedViewAddress, setSelectedViewAddress] = useState('')
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [copiedAddress, setCopiedAddress] = useState('')
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => {
    try {
      setNicknames(JSON.parse(localStorage.getItem('vvveco-admin-user-nicknames') ?? '{}'))
    } catch {
      setNicknames({})
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (registeredStart) params.set('registeredStart', registeredStart)
      if (registeredEnd) params.set('registeredEnd', registeredEnd)
      if (minStake) params.set('minStake', minStake)
      if (maxStake) params.set('maxStake', maxStake)
      if (query.trim()) params.set('q', query.trim())

      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setUsers(data.items ?? [])
      setTotal(data.pagination?.total ?? 0)
      setTotalPages(data.pagination?.totalPages ?? 1)
    } catch {
      // Fallback: try localStorage
      const { getAllUserInsights } = await import('@/lib/admin-user-insights')
      const fallback = getAllUserInsights(Date.now())
      setUsers(fallback)
      setTotal(fallback.length)
      setTotalPages(Math.ceil(fallback.length / pageSize))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, registeredStart, registeredEnd, minStake, maxStake, query])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearch = async () => {
    setSearched(true)
    setPage(1)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(query.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setInsight(data as UserInsight)
      } else {
        setInsight(null)
      }
    } catch {
      // Fallback to localStorage
      setInsight(getUserInsight(query, Date.now()))
    }
  }

  const handleSelectUser = async (address: string) => {
    setQuery(address)
    setSearched(true)
    setSelectedViewAddress(address)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(address)}`)
      if (res.ok) {
        const data = await res.json()
        setInsight(data as UserInsight)
      } else {
        setInsight(getUserInsight(address, Date.now()))
      }
    } catch {
      setInsight(getUserInsight(address, Date.now()))
    }
  }


  const handleToggleOrderVisibility = (orderId: string, hidden: boolean) => {
    hideOrder(orderId, hidden)
    toast({
      title: hidden ? '订单已隐藏' : '订单已显示',
      description: hidden ? '用户前端将不再显示该质押订单。' : '用户前端已恢复显示该质押订单。',
    })
  }

  const resetListFilters = () => {
    setRegisteredStart('')
    setRegisteredEnd('')
    setMinStake('')
    setMaxStake('')
    setPage(1)
  }

  const handleCopyAddress = (address: string) => {
    const copy = (text: string) => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => fallback(text))
      } else {
        fallback(text)
      }
    }
    const fallback = (text: string) => {
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    copy(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(''), 1500)
  }

  const handleNicknameChange = (address: string, value: string) => {
    setNicknames(current => {
      const key = address.toLowerCase()
      const next = { ...current, [key]: value }

      if (!value.trim()) {
        delete next[key]
      }

      localStorage.setItem('vvveco-admin-user-nicknames', JSON.stringify(next))
      return next
    })
  }

  const renderAddressTools = (address: string, displayAddress: string) => {
    const nickname = nicknames[address.toLowerCase()] ?? ''

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-medium text-foreground">{displayAddress}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleCopyAddress(address)}
          >
            {copiedAddress === address ? <Check className="h-3.5 w-3.5 text-chart-1" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="flex max-w-44 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={nickname}
            onChange={event => handleNicknameChange(address, event.target.value)}
            placeholder="备注昵称"
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
    )
  }

  const filteredUsers = users
  const totalUserStaked = filteredUsers.reduce((sum, user) => sum + user.totalStakedUsd, 0)
  const totalUserClaimed = filteredUsers.reduce((sum, user) => sum + user.totalClaimedUsd, 0)
  const totalUserPending = filteredUsers.reduce((sum, user) => sum + user.totalPendingUsd, 0)
  const stakedUsers = filteredUsers.filter(user => user.orderCount > 0).length
  const displayTotalPages = totalPages
  const safePage = Math.min(page, displayTotalPages)
  const pagedUsers = users

  useEffect(() => {
    setPage(1)
  }, [registeredStart, registeredEnd, minStake, maxStake])

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">用户数据管理台</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          输入用户钱包地址、Account 编号或邀请码，查看质押、团队和收益数据。
        </p>
      </div>

      <Card className="border-border bg-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-primary" />
            用户查询
          </CardTitle>
          <CardDescription>支持 UID（如 100001）、完整钱包地址、模拟账号名称（如 Account 1）或 8 位邀请码。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label>用户地址 / Account / 邀请码</Label>
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="输入 UID / 钱包地址 / Account / 邀请码"
                onKeyDown={event => {
                  if (event.key === 'Enter') handleSearch()
                }}
              />
            </div>
            <Button onClick={handleSearch} className="sm:min-w-32">
              <Search className="mr-2 h-4 w-4" />
              查询
            </Button>
          </div>
          <div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end">
            <div className="space-y-2">
              <Label>注册开始时间</Label>
              <Input
                type="date"
                value={registeredStart}
                onChange={event => setRegisteredStart(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>注册结束时间</Label>
              <Input
                type="date"
                value={registeredEnd}
                onChange={event => setRegisteredEnd(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>最低质押金额 USD</Label>
              <Input
                type="number"
                min={0}
                value={minStake}
                onChange={event => setMinStake(event.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>最高质押金额 USD</Label>
              <Input
                type="number"
                min={0}
                value={maxStake}
                onChange={event => setMaxStake(event.target.value)}
                placeholder="不限"
              />
            </div>
            <Button variant="outline" onClick={resetListFilters}>
              重置筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              用户总数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{formatInteger(filteredUsers.length)}</p>
            <p className="mt-2 text-xs text-muted-foreground">已质押 {formatInteger(stakedUsers)}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5 text-primary" />
              用户质押总额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{formatUsdFull(totalUserStaked)}</p>
            <p className="mt-2 text-xs text-muted-foreground">来自用户列表统计</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-5 w-5 text-primary" />
              已领取收益
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{formatUsdFull(totalUserClaimed)}</p>
            <p className="mt-2 text-xs text-muted-foreground">全部用户累计</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-primary" />
              待领取收益
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{formatUsdFull(totalUserPending)}</p>
            <p className="mt-2 text-xs text-muted-foreground">实时按秒更新</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            用户列表
          </CardTitle>
          <CardDescription>展示所有模拟用户和已产生关系或订单的钱包地址。</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              暂无符合条件的用户数据
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20 text-center">UID</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead>邀请码</TableHead>
                    <TableHead>上级</TableHead>
                    <TableHead>等级</TableHead>
                    <TableHead>质押金额</TableHead>
                    <TableHead>订单</TableHead>
                    <TableHead>已领取</TableHead>
                    <TableHead>待领取</TableHead>
                    <TableHead>团队</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedUsers.map(user => (
                    <TableRow key={user.address}>
                      <TableCell className="text-center">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">{user.uid}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          {renderAddressTools(user.address, user.displayAddress)}
                          <p className="mt-1 max-w-48 truncate text-xs text-muted-foreground">{user.accountLabel}</p>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{user.registeredAt}</TableCell>
                      <TableCell className="font-mono text-xs">{user.inviteCode}</TableCell>
                      <TableCell className="font-mono text-xs">{user.referrerDisplay}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.effectiveLevel > 0 ? `V${user.effectiveLevel}` : '未达级'}</Badge>
                      </TableCell>
                      <TableCell>{formatUsdFull(user.totalStakedUsd)}</TableCell>
                      <TableCell>
                        {formatInteger(user.orderCount)}
                        {user.activeOrderCount > 0 && (
                          <Badge className="ml-2" variant="secondary">{user.activeOrderCount} 进行中</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatUsdFull(user.totalClaimedUsd)}</TableCell>
                      <TableCell>{formatUsdFull(user.totalPendingUsd)}</TableCell>
                      <TableCell>
                        {formatInteger(user.teamCount)}
                        {user.directCount > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">直推 {user.directCount}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSelectUser(user.address)}
                          className={
                            selectedViewAddress.toLowerCase() === user.address.toLowerCase()
                              ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                              : 'bg-teal-600 text-white shadow-sm hover:bg-teal-700'
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          查看
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>每页</span>
                  {[20, 50, 100].map(n => (
                    <button
                      key={n}
                      onClick={() => { setPageSize(n); setPage(1) }}
                      className={`px-2 py-0.5 rounded border text-xs font-medium transition-colors ${pageSize === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'}`}
                    >
                      {n}
                    </button>
                  ))}
                  <span>条，当前第 {safePage} / {displayTotalPages} 页，共 {formatInteger(total)} 个用户</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage(current => Math.max(1, current - 1))}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= displayTotalPages}
                    onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {searched && !insight && (
        <Card className="border-border bg-card shadow-card">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            未查询到该用户，请输入完整地址、Account 编号或邀请码。
          </CardContent>
        </Card>
      )}

      {insight && (
        <>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setInsight(null); setSearched(false); setQuery(''); setSelectedViewAddress(''); }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回用户列表
            </Button>
            <span className="text-sm text-muted-foreground">{insight.displayAddress}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border bg-card shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-5 w-5 text-primary" />
                  用户钱包
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {insight.uid > 0 && (
                  <p className="font-mono text-sm text-muted-foreground">
                    <span className="text-xs">UID </span>
                    <span className="tabular-nums font-medium text-foreground">{insight.uid}</span>
                  </p>
                )}
                {renderAddressTools(insight.address, insight.displayAddress)}
                <p className="text-xs text-muted-foreground">{insight.accountLabel}</p>
                <p className="text-xs text-muted-foreground">注册时间 {insight.registeredAt}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">邀请码 {insight.inviteCode || '-'}</Badge>
                  <Badge variant="secondary">链上等级 {insight.effectiveLevel > 0 ? `V${insight.effectiveLevel}` : '未达级'}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-5 w-5 text-primary" />
                  质押数据
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-foreground">{formatUsdFull(insight.totalStakedUsd)}</p>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p>{formatInteger(insight.orderCount)} 笔订单 · {formatInteger(insight.activeOrderCount)} 笔进行中</p>
                  <p>累计质押金额 {formatUsdFull(insight.totalStakedUsd)}</p>
                  <p>累计赎回金额 {formatUsdFull(insight.totalRedeemedUsd)}</p>
                </div>
                {insight.personalDepositUsd != null && (
                  <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
                    <p className="flex justify-between text-muted-foreground">
                      <span>个人累计入金</span>
                      <span className="font-medium text-foreground">{formatUsdFull(insight.personalDepositUsd)}</span>
                    </p>
                    <p className="flex justify-between text-muted-foreground">
                      <span>个人累计出金</span>
                      <span className="font-medium text-foreground">{formatUsdFull(insight.personalWithdrawUsd ?? 0)}</span>
                    </p>
                    <p className="flex justify-between text-muted-foreground">
                      <span>个人资金差额</span>
                      <span className={cn('font-semibold', (insight.personalNetUsd ?? 0) >= 0 ? 'text-emerald-500' : 'text-destructive')}>
                        {formatUsdFull(insight.personalNetUsd ?? 0)}
                      </span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gift className="h-5 w-5 text-primary" />
                  收益数据
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-foreground">{formatUsdFull(insight.totalClaimedUsd)}</p>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p>总待领取 {formatUsdFull(insight.totalPendingUsd)}</p>
                  <p>个人已领取 {formatUsdFull(insight.personalClaimedUsd)}</p>
                  <p>个人待领取 {formatUsdFull(insight.personalPendingUsd)}</p>
                  <p>我的团队奖励 {formatUsdFull(insight.teamRewardUsd)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5 text-primary" />
                  团队数据
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-foreground">{formatInteger(insight.teamCount)}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  直推 {formatInteger(insight.directCount)} · 团队业绩 {formatUsdFull(insight.teamStakeUsd)}
                </p>
                {insight.teamDepositUsd != null && (
                  <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
                    <p className="text-[11px] text-muted-foreground/70">团队 1~12 层统计</p>
                    <p className="flex justify-between text-muted-foreground">
                      <span>团队累计入金</span>
                      <span className="font-medium text-foreground">{formatUsdFull(insight.teamDepositUsd)}</span>
                    </p>
                    <p className="flex justify-between text-muted-foreground">
                      <span>团队累计出金</span>
                      <span className="font-medium text-foreground">{formatUsdFull(insight.teamWithdrawUsd ?? 0)}</span>
                    </p>
                    <p className="flex justify-between text-muted-foreground">
                      <span>团队资金差额</span>
                      <span className={cn('font-semibold', (insight.teamNetUsd ?? 0) >= 0 ? 'text-emerald-500' : 'text-destructive')}>
                        {formatUsdFull(insight.teamNetUsd ?? 0)}
                      </span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Network className="h-5 w-5 text-primary" />
                关系信息
              </CardTitle>
              <CardDescription>展示用户上级关系和当前邀请码。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {/* 完整地址 */}
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">完整地址</p>
                {insight.uid > 0 && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">UID</span>
                    <span className="tabular-nums font-mono text-sm text-foreground">{insight.uid}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleCopyAddress(String(insight.uid))}
                    >
                      {copiedAddress === String(insight.uid) ? <Check className="h-3 w-3 text-chart-1" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                )}
                <div className="mt-1 flex items-start gap-1">
                  <p className="break-all font-mono text-sm text-foreground">{insight.address}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleCopyAddress(insight.address)}
                  >
                    {copiedAddress === insight.address ? <Check className="h-4 w-4 text-chart-1" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* 上级钱包 */}
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">上级钱包</p>
                {insight.referrer ? (
                  <>
                    {insight.referrerUid && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">UID</span>
                        <span className="tabular-nums font-mono text-sm text-foreground">{insight.referrerUid}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleCopyAddress(String(insight.referrerUid))}
                        >
                          {copiedAddress === String(insight.referrerUid) ? <Check className="h-3 w-3 text-chart-1" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    )}
                    <div className="mt-1 flex items-start gap-1">
                      <p className="break-all font-mono text-sm text-foreground">{insight.referrer}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleCopyAddress(insight.referrer)}
                      >
                        {copiedAddress === insight.referrer ? <Check className="h-4 w-4 text-chart-1" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 px-2 text-xs"
                      onClick={() => handleSelectUser(insight.referrer)}
                    >
                      <Users className="mr-1 h-3 w-3" />
                      查看上级
                    </Button>
                  </>
                ) : (
                  <p className="mt-2 font-mono text-sm text-foreground">无</p>
                )}
              </div>

              {/* 邀请码 */}
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">邀请码</p>
                <div className="mt-2 flex items-center gap-1">
                  <p className="font-mono text-sm text-foreground">{insight.inviteCode ?? '—'}</p>
                  {insight.inviteCode && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleCopyAddress(insight.inviteCode)}
                    >
                      {copiedAddress === insight.inviteCode ? <Check className="h-3 w-3 text-chart-1" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* 注册时间 */}
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">注册时间</p>
                <p className="mt-2 text-sm text-foreground">{insight.registeredAt}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                质押订单
              </CardTitle>
              <CardDescription>该用户当前所有质押订单和收益状态。</CardDescription>
            </CardHeader>
            <CardContent>
              {insight.orders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  暂无质押订单
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>订单</TableHead>
                        <TableHead>模式</TableHead>
                        <TableHead>质押金额</TableHead>
                        <TableHead>周期</TableHead>
                        <TableHead>开始时间</TableHead>
                        <TableHead>到期时间</TableHead>
                        <TableHead>已领取</TableHead>
                        <TableHead>待领取</TableHead>
                        <TableHead>进度</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insight.orders.map(order => {
                        const isHidden = controls.hiddenOrderIds.includes(order.id)

                        return (
                          <TableRow key={order.id} className={isHidden ? 'bg-muted/40' : undefined}>
                            <TableCell className="font-mono text-xs">{order.id.slice(0, 10)}...{order.id.slice(-4)}</TableCell>
                            <TableCell>{modeLabel(order.mode)}</TableCell>
                            <TableCell>{formatUsdFull(order.usdValue)}</TableCell>
                            <TableCell>{periodLabel(order.period, order.periodUnit)} · {rateLabel(order.periodUnit)} {order.dailyRate}%</TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-xs">{order.startsAt}</TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-xs">{order.expiresAt}</TableCell>
                            <TableCell>
                              {order.mode === 'coin' ? `${formatReward(order.claimed)} VVV` : formatUsdFull(order.claimed)}
                            </TableCell>
                            <TableCell>
                              {order.mode === 'coin' ? `${formatReward(order.pending)} VVV` : formatUsdFull(order.pending)}
                            </TableCell>
                            <TableCell>{order.progressPercent.toFixed(4)}%</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={order.status === '进行中' ? 'default' : 'secondary'}>{order.status}</Badge>
                                {isHidden && <Badge variant="destructive">已隐藏</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleOrderVisibility(order.id, !isHidden)}
                                className={
                                  isHidden
                                    ? 'border-stone-300 bg-stone-100 text-stone-900 hover:bg-stone-200'
                                    : 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20'
                                }
                              >
                                {isHidden ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                                {isHidden ? '显示' : '隐藏'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                团队成员
              </CardTitle>
              <CardDescription>按 7 层关系展示伞下用户和团队业绩。</CardDescription>
            </CardHeader>
            <CardContent>
              {insight.team.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  暂无团队成员
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>层级</TableHead>
                        <TableHead>钱包</TableHead>
                        <TableHead>质押金额</TableHead>
                        <TableHead>订单数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insight.team.map(member => (
                        <TableRow key={`${member.address}-${member.level}`}>
                          <TableCell>第 {member.level} 层</TableCell>
                          <TableCell>{renderAddressTools(member.address, member.displayAddress)}</TableCell>
                          <TableCell>{formatUsdFull(member.stakeUsd)}</TableCell>
                          <TableCell>{formatInteger(member.orderCount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
