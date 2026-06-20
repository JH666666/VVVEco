'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { BarChart3, Bell, ClipboardList, Clock, Globe, LogOut, Menu, Moon, ShieldCheck, Sun, UsersRound, WalletCards, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminWalletProvider, truncateAddress, useAdminWallet } from '@/contexts/admin-wallet-context'
import { Button } from '@/components/ui/button'
import { OfficialLogo } from '@/components/brand/official-logo'

interface AdminLayoutProps {
  children: ReactNode
}

const adminNavItems = [
  { title: '网站公告管理', description: '通知、红点与公告开关',        href: '/admin/web',          icon: Bell },
  { title: '合约控制管理', description: 'ABI、钱包与 owner 参数',      href: '/admin/contract',     icon: ShieldCheck },
  { title: '全球数据管理', description: '全网质押、领取与地址增长',     href: '/admin/global',       icon: BarChart3 },
  { title: '用户数据管理', description: '地址、质押、团队与收益',       href: '/admin/users',        icon: UsersRound },
  { title: '订单数据管理', description: '质押订单、领取记录、推荐关系', href: '/admin/orders',       icon: ClipboardList },
  { title: '社群配置',     description: 'Telegram / X / Discord',      href: '/admin/social',       icon: Globe },
  { title: '出款队列',     description: 'PayoutQueued 排队监控与 Flush',href: '/admin/payout-queue', icon: Clock },
]

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
        <span className={cn('rounded-md px-2 py-1 text-xs font-semibold', isCorrectChain ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
          {isCorrectChain ? 'Base' : '错误链'}
        </span>
        <button
          type="button"
          onClick={disconnectWallet}
          className="flex h-10 items-center rounded-xl bg-[#bd6700] px-4 font-mono text-sm font-semibold text-[#f5f1ea] transition-colors hover:bg-[#bd6700]/90"
        >
          {truncateAddress(address)}
        </button>
      </div>
    )
  }

  return (
    <Button
      onClick={connectWallet}
      className="h-10 rounded-xl bg-[#bd6700] px-4 text-sm font-bold text-[#f5f1ea] hover:bg-[#bd6700]/90"
    >
      <WalletCards className="h-4 w-4" />
      连接钱包
    </Button>
  )
}

function AdminShell({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem('adminTheme')
    setIsDark(stored ? stored === 'dark' : document.documentElement.classList.contains('dark'))
  }, [])

  // 移动端路由切换时收起侧边栏
  useEffect(() => {
    if (window.innerWidth < 768) setExpanded(false)
  }, [pathname])

  useEffect(() => {
    if (pathname === '/admin') return
    const ping = async () => {
      try {
        const res = await fetch('/api/admin/check-auth', { credentials: 'include' })
        if (!res.ok) window.location.href = '/admin'
      } catch { /* 网络短暂异常不强制退出 */ }
    }
    ping()
    const id = setInterval(ping, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    window.localStorage.setItem('adminTheme', next ? 'dark' : 'light')
  }

  return (
    <div className={cn(isDark && 'dark', 'min-h-screen bg-background text-foreground')}>

      {/* 遮罩：移动端半透明，桌面端透明——点击内容区均可收起 */}
      {expanded && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar overflow-hidden',
          'transition-[width] duration-300 ease-in-out',
          expanded ? 'w-64' : 'w-16',
          // 移动端未展开时隐藏
          !expanded && '-translate-x-full md:translate-x-0',
        )}
      >
        {/* 侧边栏顶部 */}
        <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border">
          {/* Logo（始终显示） */}
          <div className="flex w-16 shrink-0 items-center justify-center">
            <OfficialLogo size={40} themeAware />
          </div>
          {/* 展开后显示标题和关闭按钮 */}
          <div className={cn(
            'flex flex-1 items-center justify-between pr-3 transition-opacity duration-200',
            expanded ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}>
            <div>
              <p className="text-sm font-semibold text-sidebar-foreground whitespace-nowrap">VVVeco Admin</p>
              <p className="text-xs text-muted-foreground whitespace-nowrap">Owner console</p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden py-3">
          {adminNavItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                title={expanded ? undefined : item.title}
                className={cn(
                  'flex h-11 items-center rounded-lg mx-2 transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                )}
              >
                {/* 图标区域固定宽度 */}
                <span className="flex w-12 shrink-0 items-center justify-center">
                  <item.icon className="h-5 w-5" />
                </span>
                {/* 文字标签 */}
                <span className={cn(
                  'whitespace-nowrap text-sm font-medium transition-opacity duration-200',
                  expanded ? 'opacity-100' : 'opacity-0',
                )}>
                  {item.title}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* 退出登录 */}
        <div className="shrink-0 border-t border-sidebar-border py-3">
          <Link
            href="/admin/logout"
            title={expanded ? undefined : '退出登录'}
            className="flex h-11 items-center rounded-lg mx-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <span className="flex w-12 shrink-0 items-center justify-center">
              <LogOut className="h-4 w-4" />
            </span>
            <span className={cn(
              'whitespace-nowrap text-sm font-medium transition-opacity duration-200',
              expanded ? 'opacity-100' : 'opacity-0',
            )}>
              退出登录
            </span>
          </Link>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className={cn(
        'flex min-h-screen flex-col transition-[padding-left] duration-300 ease-in-out',
        'pl-0 md:pl-16',
      )}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          {/* 左侧：菜单按钮 */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={expanded ? '收起导航' : '展开导航'}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* 右侧：主题切换 + 钱包 */}
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
