'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Wrench, Clock, Save, Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AutoScanConfig {
  missingClaimEnabled: boolean
  missingClaimIntervalMin: number
  missingClaimLastRunAt: string | null
  missingClaimLastResult: string | null
}

export function MissingClaimsPanel() {
  const [blocksBack, setBlocksBack] = useState('2000')
  const [scanning, setScanning]     = useState(false)
  const [txInput, setTxInput]       = useState('')
  const [txRepairing, setTxRepairing] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const [cfg, setCfg] = useState<AutoScanConfig | null>(null)
  const [cfgEnabled, setCfgEnabled] = useState(false)
  const [cfgInterval, setCfgInterval] = useState('10')
  const [savingCfg, setSavingCfg] = useState(false)
  const [cfgMsg, setCfgMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/auto-scan-config', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AutoScanConfig | null) => {
        if (!d) return
        setCfg(d)
        setCfgEnabled(d.missingClaimEnabled)
        setCfgInterval(String(d.missingClaimIntervalMin))
      })
      .catch(() => {})
  }, [])

  const handleSaveCfg = async () => {
    setSavingCfg(true)
    setCfgMsg(null)
    try {
      const res = await fetch('/api/admin/auto-scan-config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missingClaimEnabled: cfgEnabled,
          missingClaimIntervalMin: parseInt(cfgInterval, 10) || 10,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '保存失败')
      setCfg(d)
      setCfgMsg(cfgEnabled ? `✅ 已开启：每 ${d.missingClaimIntervalMin} 分钟自动扫描领取记录` : '✅ 已关闭自动扫描')
    } catch (err: unknown) {
      setCfgMsg(err instanceof Error ? '❌ ' + err.message : '❌ 保存失败')
    } finally {
      setSavingCfg(false)
    }
  }

  const handleTxRepair = async () => {
    const h = txInput.trim()
    if (!/^0x[0-9a-fA-F]{64}$/.test(h)) {
      setError('请输入正确的领取交易哈希（0x + 64 位十六进制）')
      return
    }
    setTxRepairing(true)
    setError(null)
    setLastResult(null)
    try {
      const res = await fetch('/api/admin/missing-claims', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimTxHash: h }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '补录失败')
      setLastResult(`✅ 领取记录补录：成功 ${data.repaired ?? 0} 笔，跳过 ${data.skipped ?? 0} 笔`)
      setTxInput('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '补录失败')
    } finally {
      setTxRepairing(false)
    }
  }

  const handleScanRepair = async () => {
    setScanning(true)
    setError(null)
    setLastResult(null)
    try {
      const res = await fetch('/api/admin/missing-claims', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocksBack: parseInt(blocksBack, 10) || 2000 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '扫描失败')
      setLastResult(`✅ 扫描完成：发现 ${data.found ?? 0} 笔缺失，补录 ${data.repaired ?? 0} 笔，跳过 ${data.skipped ?? 0} 笔`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '扫描失败')
    } finally {
      setScanning(false)
    }
  }

  const busy = scanning || txRepairing

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">领取收益检测</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          扫描链上 RewardClaimed 事件，补录数据库中缺失的领取记录（让「已获收益」不依赖前端写库）
        </p>
      </div>

      {/* 自动定时扫描 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">自动定时扫描</span>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={cfgEnabled} onChange={(e) => setCfgEnabled(e.target.checked)} />
            开启自动扫描
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">扫描间隔（分钟）</span>
            <Input type="number" min={1} max={1440} className="h-9 w-24 text-sm" value={cfgInterval} onChange={(e) => setCfgInterval(e.target.value)} disabled={!cfgEnabled} />
          </div>
          <Button onClick={handleSaveCfg} disabled={savingCfg} size="sm">
            {savingCfg ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            保存
          </Button>
        </div>
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <p>· 断点续扫：开启后从合约部署块开始把历史分批扫一遍（追赶中每分钟推进一次），追平后按间隔只扫新增，永不遗漏</p>
          {cfg?.missingClaimLastRunAt && (
            <p>· 上次自动运行：{new Date(cfg.missingClaimLastRunAt).toLocaleString('zh-CN', { hour12: false })}（{cfg.missingClaimLastResult ?? '-'}）</p>
          )}
          {cfgMsg && <p className="font-medium text-foreground">{cfgMsg}</p>}
        </div>
      </div>

      {/* 按领取交易哈希补录 */}
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
        <div className="mb-1 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">按哈希补录（最快）</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          某笔领取链上到账了但「已获收益」少算时用这个：填那笔<b>领取交易</b>的哈希，服务端读链把这笔领取记录补进库。金额来自链上。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="0x... 领取交易哈希" className="h-9 flex-1 min-w-[240px] font-mono text-sm" value={txInput} onChange={(e) => setTxInput(e.target.value)} disabled={txRepairing} />
          <Button onClick={handleTxRepair} disabled={txRepairing || !txInput.trim()} size="sm">
            {txRepairing ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Wrench className="mr-1.5 h-4 w-4" />}
            {txRepairing ? '补录中...' : '按哈希补录'}
          </Button>
        </div>
      </div>

      {/* 按区块扫描并补录 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">回溯区块数</span>
          <Input type="number" min={100} max={200000} step={100} className="h-9 w-28 text-sm" value={blocksBack} onChange={(e) => setBlocksBack(e.target.value)} disabled={busy} />
          <span className="text-xs text-muted-foreground">≈{Math.round(parseInt(blocksBack || '2000', 10) * 2 / 60)} 分钟</span>
        </div>
        <Button onClick={handleScanRepair} disabled={busy} size="sm" variant="destructive">
          {scanning ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Gift className="mr-1.5 h-4 w-4" />}
          {scanning ? '扫描补录中...' : '扫描并补录该范围'}
        </Button>
      </div>

      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm">
        <p className="font-medium text-yellow-500">说明</p>
        <ul className="mt-1 space-y-0.5 text-xs text-yellow-500/80">
          <li>· 只处理单笔领取（claimOrderReward）；金额、单价均来自链上，不猜测</li>
          <li>· 幂等：同一笔领取不会重复补录</li>
          <li>· 建议开启上方「自动定时扫描」，服务端每隔几分钟自动补齐</li>
        </ul>
      </div>

      {lastResult && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400">{lastResult}</div>
      )}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">❌ {error}</div>
      )}
    </div>
  )
}
