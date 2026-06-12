'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, Plus, WalletCards, Zap } from 'lucide-react'
import {
  SIM_WALLET_INITIAL_VVV_BALANCE,
  formatSimAddress,
  getBoundReferrerStorageKey,
  useLocalWeb3Sim,
} from '@/contexts/local-web3-sim-context'
import { Button } from '@/components/ui/button'

interface SimulatorFloatingWidgetProps {
  referrerAddress?: string
  lastTxHash?: string
  isApproved?: boolean
  isApproving?: boolean
  onReferrerChange?: (address: string) => void
  onApprove?: () => void
}

export function SimulatorFloatingWidget({
  referrerAddress,
  lastTxHash,
  isApproved,
  isApproving,
  onReferrerChange,
  onApprove,
}: SimulatorFloatingWidgetProps) {
  const [expanded, setExpanded] = useState(false)
  const [localReferrerAddress, setLocalReferrerAddress] = useState('')
  const [localLastTxHash, setLocalLastTxHash] = useState('')
  const [localIsApproving, setLocalIsApproving] = useState(false)
  const {
    accounts,
    approve,
    bindReferrer,
    createAccount,
    currentAccount,
    currentAddress,
    getDefaultReferrer,
    isApproved: simIsApproved,
    referrals,
    switchAccount,
    unbindReferrer,
  } = useLocalWeb3Sim()
  const defaultReferrer = getDefaultReferrer()
  const selectedReferrer = referrerAddress ?? localReferrerAddress
  const effectiveReferrer = selectedReferrer || defaultReferrer
  const approved = isApproved ?? simIsApproved
  const approving = isApproving ?? localIsApproving
  const txHash = lastTxHash ?? localLastTxHash

  useEffect(() => {
    if (referrerAddress !== undefined || !currentAddress) return

    const storedReferrer = window.localStorage.getItem(getBoundReferrerStorageKey(currentAddress)) ?? ''
    setLocalReferrerAddress(referrals[currentAddress] ?? storedReferrer)
  }, [currentAddress, referrerAddress, referrals])

  const handleReferrerChange = (address: string) => {
    if (onReferrerChange) {
      onReferrerChange(address)
      return
    }

    setLocalReferrerAddress(address)

    if (!currentAddress) return

    if (!address) {
      window.localStorage.removeItem(getBoundReferrerStorageKey(currentAddress))
      unbindReferrer(currentAddress)
      return
    }

    window.localStorage.setItem(getBoundReferrerStorageKey(currentAddress), address)
    bindReferrer(currentAddress, address)
  }

  const handleCreateAccount = () => {
    createAccount()
    setLocalReferrerAddress('')
  }

  const handleApprove = async () => {
    if (onApprove) {
      onApprove()
      return
    }

    setLocalIsApproving(true)
    const nextTxHash = await approve()
    setLocalLastTxHash(nextTxHash)
    setLocalIsApproving(false)
  }

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[calc(100vw-2rem)] max-w-sm lg:bottom-5 lg:right-48">
      {expanded && (
        <div className="mb-3 rounded-xl border border-primary/25 bg-card/95 p-4 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Zap className="h-4 w-4 text-primary" />
                Local Web3 Simulator
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentAccount.label} · {currentAccount.shortAddress}
              </p>
              <p className="mt-1 text-xs font-medium text-chart-1">
                测试余额 {SIM_WALLET_INITIAL_VVV_BALANCE.toLocaleString()} VVV
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="收起模拟器"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-foreground">模拟钱包</label>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={handleCreateAccount}>
                  <Plus className="h-3.5 w-3.5" />
                  生成新地址
                </Button>
              </div>
              <select
                value={currentAddress}
                onChange={event => switchAccount(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground"
              >
                <option value="">选择测试地址</option>
                {accounts.map(account => (
                  <option key={account.address} value={account.address}>
                    {account.label} ({account.shortAddress})
                  </option>
                ))}
              </select>
              {currentAddress && (
                <p className="break-all rounded-md bg-secondary/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  {currentAddress}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">邀请人 / 绑定上级</label>
              <select
                value={effectiveReferrer}
                onChange={event => handleReferrerChange(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground"
                disabled={!currentAddress}
              >
                <option value="">无邀请人</option>
                {accounts
                  .filter(account => account.address !== currentAddress)
                  .map(account => (
                    <option key={account.address} value={account.address}>
                      {account.label} ({account.shortAddress})
                    </option>
                  ))}
              </select>
              {effectiveReferrer && (
                <p className="text-[11px] text-muted-foreground">
                  模拟转账 1 VVV 给 {formatSimAddress(effectiveReferrer)} 后绑定关系。
                </p>
              )}
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={handleApprove} disabled={!currentAddress || approved || approving}>
              {approved ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-chart-1" />
                  已 Approve
                </>
              ) : approving ? 'Approve 中...' : 'Approve'}
            </Button>

            {txHash && (
              <p className="truncate rounded-md bg-secondary/50 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                {txHash}
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        className="ml-auto flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xl shadow-black/20 transition-colors hover:bg-primary/90"
      >
        <WalletCards className="h-4 w-4" />
        模拟器
      </button>
    </div>
  )
}
