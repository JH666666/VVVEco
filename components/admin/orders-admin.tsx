'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface StakeOrder {
  txHash: string
  walletAddress: string
  uid: number
  mode: string
  amount: number
  usdValue: number
  period: number
  periodUnit: string
  dailyRate: number
  startTime: string
  endTime: string
  isWithdrawn: boolean
  isRepaired?: boolean
  claimedVvv: number
  claimedUsd: number
  pending: number
  status: string
  inviteCode?: string
}

interface ClaimRecord {
  txHash: string
  walletAddress: string
  orderTxHash: string
  amount: number
  amountVvv: number
  amountUsd: number
  createdAt: string
}

interface InviteRelation {
  childAddress: string
  parentAddress: string
  boundMethod: string
  createdAt: string
  childInviteCode?: string
  parentInviteCode?: string
}

type Tab = 'orders' | 'claims' | 'invites'

interface Filters {
  dateFrom: string
  dateTo: string
  minUsd: string
  maxUsd: string
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { hour12: false })
}

const PAGE_SIZE = 20

export function OrdersAdmin() {
  const [tab, setTab]         = useState<Tab>('orders')
  const [search, setSearch]   = useState('')
  const [filters, setFilters] = useState<Filters>({ dateFrom: '', dateTo: '', minUsd: '', maxUsd: '' })
  const [loading, setLoading] = useState(false)

  const [orders, setOrders]         = useState<StakeOrder[]>([])
  const [orderTotal, setOrderTotal] = useState(0)
  const [orderPage, setOrderPage]   = useState(1)

  const [claims, setClaims]         = useState<ClaimRecord[]>([])
  const [claimTotal, setClaimTotal] = useState(0)
  const [claimPage, setClaimPage]   = useState(1)

  const [invites, setInvites]           = useState<InviteRelation[]>([])
  const [inviteTotal, setInviteTotal]   = useState(0)
  const [invitePage, setInvitePage]     = useState(1)

  const fetchOrders = useCallback(async (p: number, q: string, f: Filters) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE), includeHidden: 'true' })
    if (q) params.set('q', q.trim())
    if (f.dateFrom) params.set('dateFrom', f.dateFrom)
    if (f.dateTo)   params.set('dateTo', f.dateTo)
    if (f.minUsd)   params.set('minUsd', f.minUsd)
    if (f.maxUsd)   params.set('maxUsd', f.maxUsd)
    const res  = await fetch(`/api/stake-orders?${params}`)
    const data = await res.json()
    setOrders(data.items ?? [])
    setOrderTotal(data.pagination?.total ?? 0)
  }, [])

  const fetchClaims = useCallback(async (p: number, q: string, f: Filters) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) })
    if (q) params.set('q', q.trim())
    if (f.dateFrom) params.set('dateFrom', f.dateFrom)
    if (f.dateTo)   params.set('dateTo', f.dateTo)
    if (f.minUsd)   params.set('minUsd', f.minUsd)
    if (f.maxUsd)   params.set('maxUsd', f.maxUsd)
    const res  = await fetch(`/api/claims?${params}`)
    const data = await res.json()
    setClaims(data.items ?? [])
    setClaimTotal(data.pagination?.total ?? 0)
  }, [])

  const fetchInvites = useCallback(async (p: number, q: string, f: Filters) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) })
    if (q) params.set('q', q.trim())
    if (f.dateFrom) params.set('dateFrom', f.dateFrom)
    if (f.dateTo)   params.set('dateTo', f.dateTo)
    const res  = await fetch(`/api/invite/list-all?${params}`)
    const data = await res.json()
    setInvites(data.items ?? [])
    setInviteTotal(data.pagination?.total ?? 0)
  }, [])

  const fetchAll = useCallback(async (q: string, f: Filters, op: number, cp: number, ip: number) => {
    setLoading(true)
    try {
      await Promise.all([
        fetchOrders(op, q, f),
        fetchClaims(cp, q, f),
        fetchInvites(ip, q, f),
      ])
    } finally { setLoading(false) }
  }, [fetchOrders, fetchClaims, fetchInvites])

  useEffect(() => {
    fetchAll(search, filters, orderPage, claimPage, invitePage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderPage, claimPage, invitePage])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOrderPage(1); setClaimPage(1); setInvitePage(1)
    fetchAll(search, filters, 1, 1, 1)
  }

  const handleReset = () => {
    setSearch('')
    const empty = { dateFrom: '', dateTo: '', minUsd: '', maxUsd: '' }
    setFilters(empty)
    setOrderPage(1); setClaimPage(1); setInvitePage(1)
    fetchAll('', empty, 1, 1, 1)
  }

  const curTotal = tab === 'orders' ? orderTotal : tab === 'claims' ? claimTotal : inviteTotal
  const curPage  = tab === 'orders' ? orderPage  : tab === 'claims' ? claimPage  : invitePage
  const setPage  = tab === 'orders' ? setOrderPage : tab === 'claims' ? setClaimPage : setInvitePage
  const totalPages = Math.max(1, Math.ceil(curTotal / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">订单数据管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">质押订单 · 领取记录 · 推荐绑定关系</p>
      </div>

      {/* Search + Filters — 在 tabs 上方，同时查询三个子项目 */}
      <form onSubmit={handleSearch} className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="地址 / 邀请码 / UID"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Input
          type="date"
          className="h-9 text-sm w-36"
          title="开始日期"
          value={filters.dateFrom}
          onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
        />
        <span className="text-muted-foreground text-sm">—</span>
        <Input
          type="date"
          className="h-9 text-sm w-36"
          title="结束日期"
          value={filters.dateTo}
          onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
        />
        <Input
          type="number"
          className="h-9 text-sm w-24"
          placeholder="最小USD"
          min={0}
          value={filters.minUsd}
          onChange={e => setFilters(f => ({ ...f, minUsd: e.target.value }))}
        />
        <span className="text-muted-foreground text-sm">~</span>
        <Input
          type="number"
          className="h-9 text-sm w-24"
          placeholder="最大USD"
          min={0}
          value={filters.maxUsd}
          onChange={e => setFilters(f => ({ ...f, maxUsd: e.target.value }))}
        />
        <Button type="submit" size="sm" disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90">搜索</Button>
        <Button type="button" size="sm" variant="ghost" onClick={handleReset}>重置</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => fetchAll(search, filters, orderPage, claimPage, invitePage)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </form>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {([['orders','质押订单',orderTotal], ['claims','领取记录',claimTotal], ['invites','推荐关系',inviteTotal]] as const).map(([key, label, total]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            {total > 0 && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{total}</span>}
          </button>
        ))}
      </div>

      {/* Tables */}
      <div className="overflow-x-auto rounded-lg border border-border">
        {tab === 'orders' && (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['钱包','UID','模式','金额(VVV)','USD','期限','日化','已领取','待领取','状态','开始时间','标记'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.length === 0 ? (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>
              ) : orders.map(o => (
                <tr key={o.txHash} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{shortAddr(o.walletAddress)}</td>
                  <td className="px-3 py-2 text-xs">{o.uid}</td>
                  <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${o.mode==='coin'?'bg-blue-500/10 text-blue-400':'bg-amber-500/10 text-amber-400'}`}>{o.mode==='coin'?'币本位':'金本位'}</span></td>
                  <td className="px-3 py-2">{o.mode==='coin'?o.amount.toFixed(2):'-'}</td>
                  <td className="px-3 py-2">${o.usdValue.toFixed(2)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{o.period}{o.periodUnit==='hour'?'时':'天'}</td>
                  <td className="px-3 py-2">{o.dailyRate}%</td>
                  <td className="px-3 py-2 text-green-400">{o.mode==='coin'?`${o.claimedVvv.toFixed(4)} VVV`:`$${o.claimedUsd.toFixed(2)}`}</td>
                  <td className="px-3 py-2 text-yellow-400">{o.mode==='coin'?`${o.pending.toFixed(4)} VVV`:`$${o.pending.toFixed(2)}`}</td>
                  <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${o.status==='active'?'bg-green-500/10 text-green-400':o.isWithdrawn?'bg-gray-500/10 text-gray-400':'bg-blue-500/10 text-blue-400'}`}>{o.isWithdrawn?'已赎回':o.status==='active'?'进行中':'到期'}</span></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(o.startTime)}</td>
                  <td className="px-3 py-2">{o.isRepaired && <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-orange-500/10 text-orange-400">自动补录</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'claims' && (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['钱包','VVV金额','USD金额','所属订单','领取时间'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {claims.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>
              ) : claims.map((c, i) => (
                <tr key={c.txHash || i} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{shortAddr(c.walletAddress)}</td>
                  <td className="px-3 py-2 text-green-400">{(c.amountVvv ?? c.amount).toFixed(6)} VVV</td>
                  <td className="px-3 py-2">${(c.amountUsd ?? 0).toFixed(4)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{shortAddr(c.orderTxHash)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'invites' && (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['下级地址','上级地址','绑定方式','绑定时间'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invites.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">暂无数据</td></tr>
              ) : invites.map((inv, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{shortAddr(inv.childAddress)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{shortAddr(inv.parentAddress)}</td>
                  <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${inv.boundMethod==='auto_root'?'bg-gray-500/10 text-gray-400':'bg-green-500/10 text-green-400'}`}>{inv.boundMethod==='auto_root'?'自动归根':'邀请码'}</span></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(inv.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination — 始终显示 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          共 {curTotal} 条，第 {curPage} / {totalPages} 页
        </span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled={curPage <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />上一页
          </Button>
          <Button size="sm" variant="ghost" disabled={curPage >= totalPages} onClick={() => setPage(p => p + 1)}>
            下一页<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
