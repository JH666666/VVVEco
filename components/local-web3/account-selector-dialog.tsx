'use client'

import { Check, WalletCards } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocalWeb3Sim } from '@/contexts/local-web3-sim-context'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AccountSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AccountSelectorDialog({ open, onOpenChange }: AccountSelectorDialogProps) {
  const { accounts, currentAddress, switchAccount } = useLocalWeb3Sim()

  const handleSelect = (address: string) => {
    switchAccount(address)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-primary" />
            Local Web3 Simulator
          </DialogTitle>
          <DialogDescription>
            开发模式下无需真实钱包、Gas 或测试币。选择模拟账户后即可进行 Approve / Stake 测试。
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto py-2 pr-1 sm:grid-cols-2">
          {accounts.map(account => {
            const isActive = account.address === currentAddress
            return (
              <button
                key={account.address}
                type="button"
                onClick={() => handleSelect(account.address)}
                className={cn(
                  'rounded-lg border p-4 text-left transition-all',
                  isActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/40',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{account.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{account.role}</p>
                  </div>
                  {isActive && <Check className="h-5 w-5 text-primary" />}
                </div>
                <p className="mt-3 font-mono text-sm text-foreground">{account.shortAddress}</p>
              </button>
            )
          })}
        </div>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          关闭
        </Button>
      </DialogContent>
    </Dialog>
  )
}
