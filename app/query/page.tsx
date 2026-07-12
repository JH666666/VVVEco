'use client'

import { useState } from 'react'

interface FundBlock {
  deposit: number
  withdraw: number
  net: number
  memberCount?: number
}

interface QueryResult {
  found: boolean
  address: string
  uid?: number | null
  personal?: FundBlock
  team?: FundBlock
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function StatRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  const color = strong ? (value >= 0 ? 'text-emerald-500' : 'text-red-500') : 'text-foreground'
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{formatUsd(value)}</span>
    </div>
  )
}

function ResultCard({ title, data }: { title: string; data: FundBlock }) {
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
      <StatRow label="资金差额" value={data.net} strong />
    </div>
  )
}

export default function ShareholderQueryPage() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState('')

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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">资金查询</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            输入您的钱包地址，查询个人及团队的入金 / 出金情况
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
            <ResultCard title="个人资金" data={result.personal} />
            <ResultCard title="团队资金" data={result.team} />
            <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground/70">
              出金含领取收益、团队奖励及赎回本金，按税前金额统计。团队数据统计您名下全部下级成员。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
