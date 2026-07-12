'use client'

import { useState } from 'react'

interface WithdrawBreakdown {
  claimReward: number
  teamReward: number
  redeemed: number
}
interface FundBlock {
  deposit: number
  withdraw: number
  net: number
  stakeActiveUsd: number
  breakdown: WithdrawBreakdown
  memberCount?: number
}
interface PersonalOrder {
  id: string
  mode: 'coin' | 'fiat'
  usdValue: number
  period: number
  periodUnit: string
  startTime: string
  status: '进行中' | '已完成'
}
interface TeamMember {
  address: string
  displayAddress: string
  level: number
  deposit: number
  withdraw: number
}
interface QueryResult {
  found: boolean
  address: string
  uid?: number | null
  personal?: FundBlock
  team?: FundBlock
  personalOrders?: PersonalOrder[]
  teamMembers?: TeamMember[]
}

function usd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function StatRow({ label, value, strong, sub }: { label: string; value: number; strong?: boolean; sub?: boolean }) {
  const color = strong ? (value >= 0 ? 'text-emerald-500' : 'text-red-500') : 'text-foreground'
  return (
    <div className={`flex items-center justify-between ${sub ? 'py-1' : 'py-2 border-b border-border/60 last:border-0'}`}>
      <span className={`${sub ? 'pl-3 text-xs text-muted-foreground/80' : 'text-sm text-muted-foreground'}`}>{label}</span>
      <span className={`tabular-nums ${sub ? 'text-xs text-muted-foreground' : 'text-sm font-semibold'} ${sub ? '' : color}`}>{usd(value)}</span>
    </div>
  )
}

function FundCard({ title, data }: { title: string; data: FundBlock }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {typeof data.memberCount === 'number' && (
          <span className="text-xs text-muted-foreground">团队 {data.memberCount} 人</span>
        )}
      </div>
      <StatRow label="累计入金" value={data.deposit} />
      <StatRow label="累计出金" value={data.withdraw} />
      {/* 出金构成拆分 */}
      <StatRow label="· 领取收益" value={data.breakdown.claimReward} sub />
      <StatRow label="· 团队奖励" value={data.breakdown.teamReward} sub />
      <StatRow label="· 赎回本金" value={data.breakdown.redeemed} sub />
      <StatRow label="质押业绩（有效）" value={data.stakeActiveUsd} />
    </div>
  )
}

export default function ShareholderQueryPage() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState('')
  const [teamPage, setTeamPage] = useState(1)
  const [teamPageSize, setTeamPageSize] = useState(20)

  const isValid = /^0x[a-fA-F0-9]{40}$/.test(address.trim())

  const handleQuery = async () => {
    const addr = address.trim()
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setError('请输入正确的钱包地址（0x 开头，42 位）')
      setResult(null)
      return
    }
    setError('')
    setLoading(true)
    setResult(null)
    setTeamPage(1)
    try {
      const res = await fetch(`/api/shareholder/${encodeURIComponent(addr)}`)
      const data = await res.json()
      if (!res.ok) {
        setError('查询失败，请稍后重试')
      } else {
        setResult(data as QueryResult)
      }
    } catch {
      setError('网络异常，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">业绩查询</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            输入您的钱包地址，查询个人及团队的入金 / 出金 / 质押业绩
          </p>
        </div>

        {/* Query box */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-foreground">钱包地址</label>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuery() }}
            placeholder="0x..."
            className="w-full rounded-xl border border-border bg-background px-3 py-3 font-mono text-sm text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={handleQuery}
            disabled={loading || !isValid}
            className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {loading ? '查询中...' : '查询'}
          </button>
          {error && <p className="mt-3 text-center text-sm text-red-500">{error}</p>}
        </div>

        {/* Result */}
        {result && !result.found && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
            未查询到该地址的记录，请确认地址是否正确。
          </div>
        )}

        {result && result.found && result.personal && result.team && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
              <p className="font-mono text-xs break-all text-muted-foreground">{result.address}</p>
              {result.uid ? (
                <p className="mt-1 text-xs text-muted-foreground">UID {result.uid}</p>
              ) : null}
            </div>

            <FundCard title="个人资金" data={result.personal} />
            <FundCard title="团队资金" data={result.team} />

            {/* 个人质押订单明细 */}
            {result.personalOrders && result.personalOrders.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="mb-3 text-base font-semibold text-foreground">个人质押订单明细</h2>
                <div className="space-y-2">
                  {result.personalOrders.map((o) => (
                    <div key={o.id} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{usd(o.usdValue)}</span>
                        <span className={o.status === '进行中' ? 'text-emerald-500' : 'text-muted-foreground'}>{o.status}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-muted-foreground">
                        <span>{o.mode === 'coin' ? '币本位' : '金本位'} · {o.period}{o.periodUnit === 'hour' ? '时' : '天'}</span>
                        <span>{o.startTime}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 团队成员明细（分页） */}
            {result.teamMembers && result.teamMembers.length > 0 && (() => {
              const members = result.teamMembers
              const totalPages = Math.max(1, Math.ceil(members.length / teamPageSize))
              const page = Math.min(teamPage, totalPages)
              const start = (page - 1) * teamPageSize
              const pageItems = members.slice(start, start + teamPageSize)
              return (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-foreground">团队成员明细</h2>
                    <span className="text-xs text-muted-foreground">共 {members.length} 人</span>
                  </div>
                  {members.length > 20 && (
                    <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>每页</span>
                      {[20, 50, 100].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => { setTeamPageSize(n); setTeamPage(1) }}
                          className={`rounded-md border px-2 py-0.5 font-medium transition-colors ${teamPageSize === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {pageItems.map((m) => (
                      <div key={m.address} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-foreground">{m.displayAddress}</span>
                          <span className="text-muted-foreground">第 {m.level} 层</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-muted-foreground">
                          <span>入金 {usd(m.deposit)}</span>
                          <span>出金 {usd(m.withdraw)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setTeamPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40"
                      >
                        上一页
                      </button>
                      <span className="text-xs text-muted-foreground">{page} / {totalPages} 页</span>
                      <button
                        type="button"
                        onClick={() => setTeamPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40"
                      >
                        下一页
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}

            <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground/70">
              出金含领取收益、团队奖励及赎回本金，按税前金额统计（团队奖励以 VVV 发放，按当前 VVV 价格换算成 USD）。质押业绩指当前有效质押（未赎回且未到期）。团队数据统计您名下全部下级成员。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
