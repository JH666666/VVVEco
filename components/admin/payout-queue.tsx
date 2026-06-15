'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, RefreshCw, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useFlushQueue } from '@/lib/contract-hooks'

// ── Types ──────────────────────────────────────────────────────────────────

interface QueueEvent {
  txHash: string
  blockNumber: number
  timestamp: number
  netVvv: string
  feeVvv: string
  reason: string
}

interface QueueItem {
  user: string
  netVvv: string
  feeVvv: string
  status: 'pending' | 'flushed'
  events: QueueEvent[]
}

interface QueueData {
  ethBalance: string
  ethNeeded: string
  vvvUsdPrice: string
  pendingUserCount: number
  totalNetVvv: string
  totalFeeVvv: string
  items: QueueItem[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function fmtVvv(v: string) {
  const n = parseFloat(v)
  if (isNaN(n)) return '0'
  return n.toFixed(4)
}

function fmtTs(ts: number) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
}

type EthStatus = 'ok' | 'low' | 'empty' | 'unknown'

function calcEthStatus(balance: string, needed: string): EthStatus {
  const b = parseFloat(balance)
  const n = parseFloat(needed)
  if (isNaN(b) || isNaN(n)) return 'unknown'
  if (n <= 0) return 'ok'
  if (b >= n)         return 'ok'
  if (b >= n * 0.5)  return 'low'
  return 'empty'
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub && <div className="mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function EthStatusBadge({ status }: { status: EthStatus }) {
  if (status === 'ok')      return <Badge className="bg-green-500/20 text-green-400 border-0">🟢 正常</Badge>
  if (status === 'low')     return <Badge className="bg-yellow-500/20 text-yellow-400 border-0">🟡 偏低</Badge>
  if (status === 'empty')   return <Badge className="bg-red-500/20 text-red-400 border-0">🔴 不足</Badge>
  return <Badge variant="outline">未知</Badge>
}

// ── Main component ───────────────────────────────────────────────────────────

export function PayoutQueue() {
  const { toast } = useToast()
  const flushQueue = useFlushQueue()

  const [data, setData]       = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // per-user flush loading
  const [flushingUser, setFlushingUser] = useState<string | null>(null)

  // flush-all progress
  const [flushAllProgress, setFlushAllProgress] = useState<{ current: number; total: number } | null>(null)

  // Ref-based lock to prevent duplicate MetaMask submissions across render cycles
  const flushLockRef = useRef(false)

  // expanded rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/payout-queue')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Re-read a single user's pending after flush
  const refreshUser = async (user: string) => {
    const res = await fetch('/api/admin/payout-queue')
    if (!res.ok) return
    const fresh: QueueData = await res.json()
    setData(fresh)
  }

  const handleFlush = async (user: string) => {
    if (flushLockRef.current) return
    flushLockRef.current = true
    setFlushingUser(user)
    try {
      await flushQueue(user)
      toast({ title: '出款成功', description: `已向 ${shortAddr(user)} 补发 VVV` })
      await refreshUser(user)
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? String(e)
      if (msg.includes('insufficient ETH') || msg.includes('Payout: insufficient')) {
        toast({ title: 'Payout ETH 不足', description: '请先 depositETH 后再执行 Flush', variant: 'destructive' })
      } else {
        toast({ title: 'Flush 失败', description: msg.slice(0, 120), variant: 'destructive' })
      }
    } finally {
      flushLockRef.current = false
      setFlushingUser(null)
    }
  }

  const handleFlushAll = async () => {
    if (flushLockRef.current || !data) return
    const pending = data.items.filter(i => i.status === 'pending')
    if (pending.length === 0) {
      toast({ title: '无待处理用户' })
      return
    }

    flushLockRef.current = true
    setFlushAllProgress({ current: 0, total: pending.length })
    let successCount = 0

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i]
      setFlushAllProgress({ current: i + 1, total: pending.length })
      try {
        await flushQueue(item.user)
        successCount++
      } catch (e: unknown) {
        const msg = (e as Error)?.message ?? String(e)
        toast({
          title: `Flush 失败 (${shortAddr(item.user)})`,
          description: msg.slice(0, 100),
          variant: 'destructive',
        })
        // continue to next user
      }
    }

    flushLockRef.current = false
    setFlushAllProgress(null)
    toast({ title: `Flush All 完成`, description: `成功 ${successCount}/${pending.length} 笔` })
    await fetchData()
  }

  const toggleExpand = (user: string) => {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(user) ? s.delete(user) : s.add(user)
      return s
    })
  }

  const ethStatus = data ? calcEthStatus(data.ethBalance, data.ethNeeded) : 'unknown'
  const isFlushingAll = flushAllProgress !== null
  const pendingItems = data?.items.filter(i => i.status === 'pending') ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">出款队列</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            PayoutQueued 排队记录 · 需 Owner 手动 Flush 补发 VVV
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button
            size="sm"
            onClick={handleFlushAll}
            disabled={isFlushingAll || loading || pendingItems.length === 0}
            className="gap-1.5"
          >
            {isFlushingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {flushAllProgress!.current}/{flushAllProgress!.total} 处理中…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Flush All ({pendingItems.length})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="待处理用户"
            value={data.pendingUserCount}
            sub={data.pendingUserCount > 0
              ? <span className="text-xs text-yellow-400">需要处理</span>
              : <span className="text-xs text-green-400">无排队</span>
            }
          />
          <StatCard
            label="待发 VVV"
            value={fmtVvv(data.totalNetVvv)}
          />
          <StatCard
            label="待收手续费 VVV"
            value={fmtVvv(data.totalFeeVvv)}
          />
          <StatCard
            label="Payout ETH 余额"
            value={`${parseFloat(data.ethBalance).toFixed(4)} ETH`}
            sub={<span className="text-xs text-muted-foreground">需约 {parseFloat(data.ethNeeded).toFixed(4)} ETH</span>}
          />
          <StatCard
            label="状态"
            value={<EthStatusBadge status={ethStatus} />}
            sub={
              ethStatus !== 'ok' && parseFloat(data.ethNeeded) > 0 ? (
                <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  请先 depositETH
                </div>
              ) : null
            }
          />
        </div>
      )}

      {/* ETH insufficient warning */}
      {data && (ethStatus === 'empty' || ethStatus === 'low') && parseFloat(data.ethNeeded) > 0 && (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm
          ${ethStatus === 'empty'
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'}`}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">
              {ethStatus === 'empty' ? 'Payout ETH 不足' : 'Payout ETH 偏低'}
            </span>
            <span className="ml-2 text-muted-foreground">
              当前 {parseFloat(data.ethBalance).toFixed(4)} ETH，
              补发 VVV 约需 {parseFloat(data.ethNeeded).toFixed(4)} ETH（VVV ≈ ${data.vvvUsdPrice}）。
              请先向 Payout 合约 depositETH 后再执行 Flush。
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          读取失败：{error}
        </div>
      )}

      {/* Table */}
      {data && data.items.length === 0 && !loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          <span>无出款队列记录</span>
        </div>
      )}

      {data && data.items.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              共 {data.items.length} 个用户 · {pendingItems.length} 待处理
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>用户地址</TableHead>
                  <TableHead className="text-right">待发 VVV</TableHead>
                  <TableHead className="text-right">手续费 VVV</TableHead>
                  <TableHead>最新排队时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map(item => {
                  const latestEvent = item.events[0]
                  const isExpanded  = expanded.has(item.user)
                  const isFlushing  = flushingUser === item.user

                  return (
                    <>
                      <TableRow
                        key={item.user}
                        className={item.status === 'pending' ? 'bg-yellow-500/5' : ''}
                      >
                        <TableCell className="px-2">
                          <button
                            onClick={() => toggleExpand(item.user)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded
                              ? <ChevronUp className="h-4 w-4" />
                              : <ChevronDown className="h-4 w-4" />
                            }
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          <a
                            href={`https://basescan.org/address/${item.user}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {shortAddr(item.user)}
                          </a>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtVvv(item.netVvv)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtVvv(item.feeVvv)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {latestEvent ? fmtTs(latestEvent.timestamp) : '—'}
                        </TableCell>
                        <TableCell>
                          {item.status === 'pending' ? (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-0">
                              <Clock className="h-3 w-3 mr-1" />
                              待处理
                            </Badge>
                          ) : (
                            <Badge className="bg-green-500/20 text-green-400 border-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              已处理
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFlush(item.user)}
                              disabled={isFlushing || isFlushingAll || ethStatus === 'empty'}
                              className="h-7 px-3 text-xs gap-1"
                            >
                              {isFlushing ? (
                                <><Loader2 className="h-3 w-3 animate-spin" />处理中</>
                              ) : (
                                'Flush'
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded event detail */}
                      {isExpanded && item.events.map((ev, idx) => (
                        <TableRow key={`${item.user}-ev-${idx}`} className="bg-muted/30">
                          <TableCell />
                          <TableCell colSpan={6} className="py-2 pl-6">
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                              <span>
                                Tx:{' '}
                                <a
                                  href={`https://basescan.org/tx/${ev.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono hover:underline text-foreground"
                                >
                                  {ev.txHash ? `${ev.txHash.slice(0, 10)}…` : '—'}
                                </a>
                              </span>
                              <span>Block: {ev.blockNumber}</span>
                              <span>时间: {fmtTs(ev.timestamp)}</span>
                              <span>净 VVV: {fmtVvv(ev.netVvv)}</span>
                              <span>手续费 VVV: {fmtVvv(ev.feeVvv)}</span>
                              {ev.reason && <span>原因: {ev.reason}</span>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
