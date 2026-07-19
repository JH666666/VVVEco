'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface MissingTeamReward {
  txHash: string
  logIndex: number
  claimTxHash: string
  beneficiaryAddr: string
  sourceAddr: string
  amount: number
  blockNumber: number
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}
function shortTx(tx: string) {
  if (!tx || tx.length < 16) return tx
  return tx.slice(0, 10) + '...' + tx.slice(-6)
}

export function MissingTeamRewardsPanel() {
  const [blocksBack, setBlocksBack] = useState('2000')
  const [scanning, setScanning] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [repairingTx, setRepairingTx] = useState<string | null>(null)
  const [rows, setRows] = useState<MissingTeamReward[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const handleScan = async () => {
    setScanning(true)
    setError(null)
    setRows(null)
    setLastResult(null)
    try {
      const res = await fetch(`/api/admin/missing-team-rewards?blocksBack=${blocksBack}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '扫描失败')
      setRows(data.missing ?? [])
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
      const res = await fetch('/api/admin/missing-team-rewards', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '补录失败')
      setRows((prev) => (prev ? prev.filter((r) => r.txHash !== txHash) : prev))
      setLastResult(`✅ 已补录 ${shortTx(txHash)}：成功 ${data.repaired} 笔，跳过 ${data.skipped} 笔`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '补录失败')
    } finally {
      setRepairingTx(null)
    }
  }

  const handleRepairAll = async () => {
    if (!rows || rows.length === 0) return
    setRepairing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/missing-team-rewards', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocksBack: parseInt(blocksBack, 10) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '补录失败')
      setLastResult(`✅ 全部补录完成：成功 ${data.repaired} 笔，跳过 ${data.skipped} 笔`)
      setRows([])
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
        <h1 className="text-2xl font-semibold">团队奖励补录</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          扫描链上 TeamRewardAccrued 事件，找出数据库缺失的团队奖励并补录（修复贡献奖励不显示、出金偏小）
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">回溯区块数</span>
          <Input
            type="number"
            min={100}
            max={50000}
            step={100}
            className="h-9 w-28 text-sm"
            value={blocksBack}
            onChange={(e) => setBlocksBack(e.target.value)}
            disabled={busy}
          />
          <span className="text-xs text-muted-foreground">≈{Math.round(parseInt(blocksBack || '2000', 10) * 2 / 60)} 分钟</span>
        </div>

        <Button
          onClick={handleScan}
          disabled={busy}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {scanning ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-1.5 h-4 w-4" />}
          {scanning ? '扫描中...' : '开始扫描'}
        </Button>

        {rows && rows.length > 0 && (
          <Button onClick={handleRepairAll} disabled={busy} size="sm" variant="destructive">
            {repairing ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Wrench className="mr-1.5 h-4 w-4" />}
            {repairing ? '补录中...' : `全部补录（${rows.length} 笔）`}
          </Button>
        )}
      </div>

      {/* Tips */}
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm">
        <p className="font-medium text-yellow-500">说明</p>
        <ul className="mt-1 space-y-0.5 text-xs text-yellow-500/80">
          <li>· 团队奖励由下级领取时写库，写库失败会导致上级贡献奖励不显示、出金偏小</li>
          <li>· 金额、上下级均来自链上事件，不猜测</li>
          <li>· 补录需要能定位下级的质押订单；若下级订单本身也漏了，请先在“漏单检测”补订单</li>
          <li>· 服务器可设定定时任务每 10 分钟自动扫描补录：</li>
          <li className="pl-4 font-mono break-all">*/10 * * * * curl -sX POST http://localhost:3000/api/admin/missing-team-rewards -H &quot;Authorization: Bearer $CRON_SECRET&quot; -H &quot;Content-Type: application/json&quot; -d &apos;{'{}'}&apos;</li>
        </ul>
      </div>

      {lastResult && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400">
          {lastResult}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          ❌ {error}
        </div>
      )}

      {rows !== null && (
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">
            {rows.length === 0 ? '✅ 未发现缺失，数据库与链上一致' : `发现 ${rows.length} 笔缺失`}
          </p>

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['TxHash', '上级(收奖)', '下级(触发)', '奖励(VVV)', '区块', '操作'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.claimTxHash} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs" title={r.txHash}>{shortTx(r.txHash)}</td>
                      <td className="px-3 py-2 font-mono text-xs" title={r.beneficiaryAddr}>{shortAddr(r.beneficiaryAddr)}</td>
                      <td className="px-3 py-2 font-mono text-xs" title={r.sourceAddr}>{shortAddr(r.sourceAddr)}</td>
                      <td className="px-3 py-2">{r.amount.toFixed(6)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.blockNumber}</td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={repairingTx === r.txHash || repairing}
                          onClick={() => handleRepairOne(r.txHash)}
                        >
                          {repairingTx === r.txHash ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Wrench className="mr-1 h-3 w-3" />}
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
