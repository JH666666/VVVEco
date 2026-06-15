'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAccount, useChainId, useDisconnect } from 'wagmi'
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
}

function getEth(): EthProvider | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as Record<string, unknown>).ethereum as EthProvider | undefined
}

export function AdminWalletProvider({ children }: { children: ReactNode }) {
  // 直接读 wagmi 状态，不主动向 TP 发任何请求
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount()
  const wagmiChainId = useChainId()
  const { disconnect } = useDisconnect()
  const chainOwner = useStakingOwner()

  const address = wagmiAddress ?? ''
  const chainId = wagmiChainId ? String(wagmiChainId) : ''
  const isConnected = wagmiConnected && Boolean(wagmiAddress)

  const value = useMemo<AdminWalletContextValue>(() => ({
    address,
    chainId,
    isConnected,
    isOwnerWallet: isConnected && !!address && !!chainOwner
      ? address.toLowerCase() === chainOwner.toLowerCase()
      : false,
    ownerAddress: chainOwner,
    // 只有用户点击"连接钱包"才调用，不自动触发
    connectWallet: async () => {
      const eth = getEth()
      if (!eth) {
        window.alert('未检测到钱包扩展，请先安装 MetaMask、OKX 或 TokenPocket 钱包。')
        return
      }
      try {
        await eth.request({ method: 'eth_requestAccounts' })
        // 连接成功后切换到 Base Mainnet
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
          })
        } catch (switchErr) {
          if ((switchErr as { code?: number }).code === 4902) {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org'],
              }],
            })
          }
        }
      } catch {
        // 用户拒绝或已在处理中
      }
    },
    disconnectWallet: () => disconnect(),
  }), [address, chainId, isConnected, chainOwner, disconnect])

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
