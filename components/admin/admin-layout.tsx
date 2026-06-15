'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { BarChart3, Bell, ClipboardList, DatabaseZap, Globe, LogOut, Menu, Moon, ShieldCheck, Sun, UsersRound, WalletCards, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminWalletProvider, truncateAddress, useAdminWallet } from '@/contexts/admin-wallet-context'
import { resetAllDevelopmentData } from '@/lib/dev-reset'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface AdminLayoutProps {
  children: ReactNode
}

const adminNavItems = [
  {
    title: '网站公告管理',
    description: '通知、红点与公告开关',
    href: '/admin/web',
    icon: Bell,
  },
  {
    title: '合约控制管理',
    description: 'ABI、钱包与 owner 参数',
    href: '/admin/contract',
    icon: ShieldCheck,
  },
  {
    title: '全球数据管理',
    description: '全网质押、领取与地址增长',
    href: '/admin/global',
    icon: BarChart3,
  },
  {
    title: '用户数据管理',
    description: '地址、质押、团队与收益',
    href: '/admin/users',
    icon: UsersRound,
  },
  {
    title: '订单数据管理',
    description: '质押订单、领取记录、推荐关系',
    href: '/admin/orders',
    icon: ClipboardList,
  },
  {
    title: '社群配置',
    description: 'Telegram / X / Discord / 官网链接',
    href: '/admin/social',
    icon: Globe,
  },
]

const isDevelopment = process.env.NODE_ENV === 'development'

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminWalletProvider>
      <AdminShell>{children}</AdminShell>
    </AdminWalletProvider>
  )
}

const BASE_MAINNET_ID = 8453

function parseChainId(id: string): number {
  if (!id) return -1
  return id.startsWith('0x') ? parseInt(id, 16) : Number(id)
}

function AdminWalletButton() {
  const { address, chainId, connectWallet, disconnectWallet, isConnected } = useAdminWallet()

  if (isConnected) {
    const isCorrectChain = parseChainId(chainId) === BASE_MAINNET_ID
    return (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded-md px-2 py-1 text-xs font-semibold',
            isCorrectChain
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400',
          )}
        >
          {isCorrectChain ? 'Base' : '错误链'}
        </span>
        <button
          type="button"
          onClick={disconnectWallet}
          className="flex h-10 items-center rounded-xl bg-[#ff6a00] px-4 font-mono text-sm font-semibold text-black transition-colors hover:bg-[#ff7a1a]"
        >
          {truncateAddress(address)}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Button
        onClick={connectWallet}
        className="h-10 rounded-xl bg-[#ff6a00] px-4 text-base font-bold text-black hover:bg-[#ff7a1a] sm:h-11 sm:px-5 sm:text-lg"
      >
        <WalletCards className="h-5 w-5" />
        连接钱包
      </Button>
    </div>
  )
}

function AdminShell({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const { toast } = useToast()
  const [isDark, setIsDark] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem('adminTheme')
    setIsDark(stored ? stored === 'dark' : document.documentElement.classList.contains('dark'))
  }, [])

  // 路由切换时自动关闭侧边栏
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // 每5分钟 ping 一次，保持 session 存活；失败则跳转登录页
  useEffect(() => {
    const ping = async () => {
      try {
        const res = await fetch('/api/admin/check-auth', { credentials: 'include' })
        if (!res.ok) window.location.href = '/admin'
      } catch {
        // 网络短暂异常，不强制退出
      }
    }
    ping()
    const id = setInterval(ping, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const toggleTheme = () => {
    const nextIsDark = !isDark
    setIsDark(nextIsDark)
    window.localStorage.setItem('adminTheme', nextIsDark ? 'dark' : 'light')
  }

  const handleResetDevelopmentData = () => {
    resetAllDevelopmentData()
    toast({
      title: '测试数据已清空',
      description: '公告、未读计数、质押记录、团队统计、邀请关系和本地缓存已重置。',
    })
  }

  return (
    <div className={cn(isDark && 'dark', 'min-h-screen bg-background text-foreground')}>
      {/* 遮罩层 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 抽拉式侧边栏 */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-3">
            <Image src="/staking-logo.png" alt="VVVeco Logo" width={36} height={36} className="rounded-lg" />
            <div>
              <p className="text-sm font-semibold text-sidebar-foreground">VVVeco Admin</p>
              <p className="text-xs text-muted-foreground">Owner console</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {adminNavItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                  isActive
                    ? 'border-primary/40 bg-primary/15 text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:bg-sidebar-accent hover:text-foreground',
                )}
              >
                <item.icon className={cn('mt-0.5 h-5 w-5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-4 space-y-2">
          {isDevelopment && (
            <button
              type="button"
              onClick={handleResetDevelopmentData}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <DatabaseZap className="h-4 w-4" />
              清空测试数据
            </button>
          )}
          <Link
            href="/admin/logout"
            className="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </Link>
        </div>
      </aside>

      {/* 主内容区（始终全宽） */}
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="打开导航"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <AdminWalletButton />
          </div>
        </header>

        <main className="flex-1 bg-background px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
