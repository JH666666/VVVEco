'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, Wrench, Clock, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AutoScanConfig {
  missingOrderEnabled: boolean
  missingOrderIntervalMin: number
  missingOrderBlocksBack: number
  missingOrderLastRunAt: string | null
  missingOrderLastResult: string | null
}

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

  // 按地址补录（扫描该地址全历史，不受区块窗口/时间限制）
  const [walletInput, setWalletInput]   = useState('')
  const [walletRepairing, setWalletRepairing] = useState(false)

  // 按交易哈希补录（最快，直接读回执，一次 RPC 调用）
  const [txInput, setTxInput]           = useState('')
  const [txRepairing, setTxRepairing]   = useState(false)

  // 定时扫描配置
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
        setCfgEnabled(d.missingOrderEnabled)
        setCfgInterval(String(d.missingOrderIntervalMin))
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
          missingOrderEnabled: cfgEnabled,
          missingOrderIntervalMin: parseInt(cfgInterval, 10) || 10,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '保存失败')
      setCfg(d)
      setCfgMsg(cfgEnabled ? `✅ 已开启：每 ${d.missingOrderIntervalMin} 分钟自动扫描` : '✅ 已关闭自动扫描')
    } catch (err: unknown) {
      setCfgMsg(err instanceof Error ? '❌ ' + err.message : '❌ 保存失败')
    } finally {
      setSavingCfg(false)
    }
  }

  const handleTxRepair = async () => {
    const h = txInput.trim()
    if (!/^0x[0-9a-fA-F]{64}$/.test(h)) {
      setError('请输入正确的交易哈希（0x + 64 位十六进制）')
      return
    }
    setTxRepairing(true)
    setError(null)
    setLastResult(null)
    try {
      const res = await fetch('/api/admin/missing-orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: h }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '补录失败')
      const o = data.order
      setLastResult(
        o
          ? `✅ 已补录：${shortAddr(o.walletAddress)} OrderID ${o.orderId}，${o.mode === 'coin' ? o.amount.toFixed(2) + ' VVV' : '$' + o.usdValue.toFixed(2)}，${o.period}天`
          : `✅ 已补录 ${shortTx(h)}`
      )
      setTxInput('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '补录失败')
    } finally {
      setTxRepairing(false)
    }
  }

  const handleWalletRepair = async () => {
    const w = walletInput.trim()
    if (!/^0x[0-9a-fA-F]{40}$/.test(w)) {
      setError('请输入正确的钱包地址（0x + 40 位十六进制）')
      return
    }
    setWalletRepairing(true)
    setError(null)
    setLastResult(null)
    try {
      const res = await fetch('/api/admin/missing-orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: w }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '补录失败')
      if ((data.found ?? 0) === 0) {
        setLastResult(`✅ 该地址链上订单与数据库一致，无漏单（已扫描全历史）`)
      } else {
        setLastResult(`✅ 该地址补录完成：发现 ${data.found} 笔，成功 ${data.repaired} 笔，跳过 ${data.skipped} 笔`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '补录失败')
    } finally {
      setWalletRepairing(false)
    }
  }

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

  const busy = scanning || repairing || !!repairingTx || walletRepairing

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">质押订单检测</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          扫描链上 Staked 事件，找出数据库中缺失的质押订单并自动补录
        </p>
      </div>

      {/* 定时扫描配置 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">自动定时扫描</span>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={cfgEnabled}
              onChange={(e) => setCfgEnabled(e.target.checked)}
            />
            开启自动扫描
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">扫描间隔（分钟）</span>
            <Input
              type="number"
              min={1}
              max={1440}
              className="h-9 w-24 text-sm"
              value={cfgInterval}
              onChange={(e) => setCfgInterval(e.target.value)}
              disabled={!cfgEnabled}
            />
          </div>
          <Button onClick={handleSaveCfg} disabled={savingCfg} size="sm">
            {savingCfg ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            保存
          </Button>
        </div>
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <p>· 断点续扫：开启后从合约部署块开始把历史分批扫一遍（追赶中每分钟推进一次），追平后按间隔只扫新增，永不遗漏</p>
          {cfg?.missingOrderLastRunAt && (
            <p>· 上次自动运行：{new Date(cfg.missingOrderLastRunAt).toLocaleString('zh-CN', { hour12: false })}（{cfg.missingOrderLastResult ?? '-'}）</p>
          )}
          {cfgMsg && <p className="font-medium text-foreground">{cfgMsg}</p>}
        </div>
      </div>

      {/* 按交易哈希补录（最快） */}
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
        <div className="mb-1 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">按交易哈希补录（最快）</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          有质押交易哈希时用这个：直接读链上回执，一次调用即可补录，秒级完成，不用扫描。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="0x... 质押交易哈希"
            className="h-9 flex-1 min-w-[240px] font-mono text-sm"
            value={txInput}
            onChange={(e) => setTxInput(e.target.value)}
            disabled={txRepairing}
          />
          <Button onClick={handleTxRepair} disabled={txRepairing || !txInput.trim()} size="sm">
            {txRepairing
              ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
              : <Wrench className="mr-1.5 h-4 w-4" />}
            {txRepairing ? '补录中...' : '按哈希补录'}
          </Button>
        </div>
      </div>

      {/* 按地址补录（推荐用于单个丢失订单） */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="mb-1 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">按地址补录</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          输入用户钱包地址，扫描该地址的全部链上质押（不受回溯区块数/时间限制），自动补录数据库中缺失的订单。单个丢失订单用这个最准。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="0x... 用户钱包地址"
            className="h-9 flex-1 min-w-[240px] font-mono text-sm"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            disabled={walletRepairing}
          />
          <Button onClick={handleWalletRepair} disabled={walletRepairing || !walletInput.trim()} size="sm">
            {walletRepairing
              ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
              : <Wrench className="mr-1.5 h-4 w-4" />}
            {walletRepairing ? '扫描补录中...' : '扫描并补录该地址'}
          </Button>
        </div>
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
          <li>· 自动定时扫描已内置（上方"自动定时扫描"卡片开启即可），无需再配服务器 crontab</li>
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
