'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface MissingOrder {
  txHash: string
  walletAddress: string
  orderId: number
  mode: 'coin' | 'fiat'
  amount: number
  usdValue: number
  period: number
  dailyRate: number
  startTime: string
  endTime: string
  isWithdrawn: boolean
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function shortTx(tx: string) {
  if (!tx || tx.length < 16) return tx
  return tx.slice(0, 10) + '...' + tx.slice(-6)
}

function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { hour12: false })
}

export function MissingOrdersPanel() {
  const [blocksBack, setBlocksBack]     = useState('1000')
  const [scanning, setScanning]         = useState(false)
  const [repairing, setRepairing]       = useState(false)
  const [repairingTx, setRepairingTx]   = useState<string | null>(null)
  const [orders, setOrders]             = useState<MissingOrder[] | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [lastResult, setLastResult]     = useState<string | null>(null)

  const handleScan = async () => {
    setScanning(true)
    setError(null)
    setOrders(null)
    setLastResult(null)
    try {
      const res = await fetch(`/api/admin/missing-orders?blocksBack=${blocksBack}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '扫描失败')
      setOrders(data.missing ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '扫描失败')
    } finally {
      setScanning(false)
    }
  }

  const handleRepairOne = async (txHash: string) => {
    setRepairingTx(txHash)
    setError(null)
    try {
      const res = await fetch('/api/admin/missing-orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '补录失败')
      setOrders((prev) => prev ? prev.filter((o) => o.txHash !== txHash) : prev)
      setLastResult(`✅ 已补录 ${shortTx(txHash)}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '补录失败')
    } finally {
      setRepairingTx(null)
    }
  }

  const handleRepairAll = async () => {
    if (!orders || orders.length === 0) return
    setRepairing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/missing-orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocksBack: parseInt(blocksBack, 10) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '补录失败')
      setLastResult(`✅ 全部补录完成：成功 ${data.repaired} 笔，跳过 ${data.skipped} 笔`)
      setOrders([])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '补录失败')
    } finally {
      setRepairing(false)
    }
  }

  const busy = scanning || repairing || !!repairingTx

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">漏单检测</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          扫描链上 Staked 事件，找出数据库中缺失的质押订单并自动补录
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">回溯区块数</span>
          <Input
            type="number"
            min={100}
            max={10000}
            step={100}
            className="h-9 w-28 text-sm"
            value={blocksBack}
            onChange={(e) => setBlocksBack(e.target.value)}
            disabled={busy}
          />
          <span className="text-xs text-muted-foreground">≈{Math.round(parseInt(blocksBack || '1000', 10) * 2 / 60)} 分钟</span>
        </div>

        <Button
          onClick={handleScan}
          disabled={busy}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {scanning
            ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
            : <AlertTriangle className="mr-1.5 h-4 w-4" />}
          {scanning ? '扫描中...' : '开始扫描'}
        </Button>

        {orders && orders.length > 0 && (
          <Button
            onClick={handleRepairAll}
            disabled={busy}
            size="sm"
            variant="destructive"
          >
            {repairing
              ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
              : <Wrench className="mr-1.5 h-4 w-4" />}
            {repairing ? '补录中...' : `全部补录（${orders.length} 笔）`}
          </Button>
        )}
      </div>

      {/* Tips */}
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm">
        <p className="font-medium text-yellow-500">说明</p>
        <ul className="mt-1 space-y-0.5 text-xs text-yellow-500/80">
          <li>· 默认扫描最近 1000 个区块（约 33 分钟），建议漏单后加大至 2000–5000</li>
          <li>· 所有金额、利率、期限均来自链上，不会猜测任何参数</li>
          <li>· 补录的订单会在后台"订单管理"中标注"自动补录"标记</li>
          <li>· 服务器可设定定时任务每 5 分钟自动扫描：</li>
          <li className="pl-4 font-mono">*/5 * * * * curl -sX POST http://localhost:3000/api/admin/missing-orders -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" -d '{"{}"}'</li>
        </ul>
      </div>

      {/* Result */}
      {lastResult && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400">
          {lastResult}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          ❌ {error}
        </div>
      )}

      {/* Scan results table */}
      {orders !== null && (
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">
            {orders.length === 0
              ? '✅ 未发现漏单，数据库与链上一致'
              : `发现 ${orders.length} 笔漏单`}
          </p>

          {orders.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['TxHash', '钱包', 'OrderID', '模式', '金额(VVV)', 'USD', '期限', '日化', '开始时间', '操作'].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((o) => (
                    <tr key={o.txHash} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs" title={o.txHash}>
                        {shortTx(o.txHash)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs" title={o.walletAddress}>
                        {shortAddr(o.walletAddress)}
                      </td>
                      <td className="px-3 py-2 text-xs">{o.orderId}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            o.mode === 'coin'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {o.mode === 'coin' ? '币本位' : '金本位'}
                        </span>
                      </td>
                      <td className="px-3 py-2">{o.mode === 'coin' ? o.amount.toFixed(2) : '-'}</td>
                      <td className="px-3 py-2">${o.usdValue.toFixed(2)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.period}天</td>
                      <td className="px-3 py-2">{o.dailyRate}%</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(o.startTime)}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={repairingTx === o.txHash || repairing}
                          onClick={() => handleRepairOne(o.txHash)}
                        >
                          {repairingTx === o.txHash ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wrench className="mr-1 h-3 w-3" />
                          )}
                          补录
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
