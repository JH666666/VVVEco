'use client'

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react'
import { useStakingOwner } from '@/lib/contract-hooks'

interface AdminWalletContextValue {
  address: string
  chainId: string
  isConnected: boolean
  isOwnerWallet: boolean
  ownerAddress: string
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
}

const AdminWalletContext = createContext<AdminWalletContextValue | undefined>(undefined)

export function truncateAddress(address: string) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

function getEth(): EthProvider | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as Record<string, unknown>).ethereum as EthProvider | undefined
}

export function AdminWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState('')
  const chainOwner = useStakingOwner()

  useEffect(() => {
    const eth = getEth()
    if (!eth) return

    // 恢复已连接的账户，并读取当前链 ID
    eth.request({ method: 'eth_accounts' })
      .then(res => {
        const accounts = res as string[]
        if (accounts.length > 0) setAddress(accounts[0])
      })
      .catch(() => {})

    eth.request({ method: 'eth_chainId' })
      .then(res => setChainId(String(res ?? '')))
      .catch(() => {})

    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[]
      setAddress(accounts?.[0] ?? '')
    }
    const onChain = (...args: unknown[]) => {
      setChainId(String(args[0] ?? ''))
    }

    eth.on?.('accountsChanged', onAccounts)
    eth.on?.('chainChanged', onChain)

    return () => {
      eth.removeListener?.('accountsChanged', onAccounts)
      eth.removeListener?.('chainChanged', onChain)
    }
  }, [])

  const isConnected = Boolean(address)

  const value = useMemo<AdminWalletContextValue>(() => ({
    address,
    chainId,
    isConnected,
    isOwnerWallet: isConnected && !!address && !!chainOwner
      ? address.toLowerCase() === chainOwner.toLowerCase()
      : false,
    ownerAddress: chainOwner,
    connectWallet: async () => {
      const eth = getEth()
      if (!eth) {
        window.alert('未检测到钱包扩展，请先安装 MetaMask、OKX 或 TokenPocket 钱包。')
        return
      }
      try {
        const accounts = await eth.request({ method: 'eth_requestAccounts' }) as string[]
        if (accounts?.length > 0) setAddress(accounts[0])

        // 自动切换到 Base Sepolia
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x14a34' }],
          })
        } catch (switchErr) {
          // 链不存在时尝试添加
          if ((switchErr as { code?: number }).code === 4902) {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x14a34',
                chainName: 'Base Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://sepolia.base.org'],
                blockExplorerUrls: ['https://sepolia.basescan.org'],
              }],
            })
          }
        }

        const chain = await eth.request({ method: 'eth_chainId' })
        setChainId(String(chain ?? ''))
      } catch {
        // user rejected or already pending
      }
    },
    disconnectWallet: () => setAddress(''),
  }), [address, chainId, isConnected, chainOwner])

  return (
    <AdminWalletContext.Provider value={value}>
      {children}
    </AdminWalletContext.Provider>
  )
}

export function useAdminWallet() {
  const context = useContext(AdminWalletContext)
  if (!context) throw new Error('useAdminWallet must be used within AdminWalletProvider')
  return context
}
