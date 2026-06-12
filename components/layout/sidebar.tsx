'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/language-context'
import { useNotifications } from '@/lib/notifications'
import { WalletButton } from '@/components/layout/wallet-button'
import {
  Coins,
  LayoutDashboard,
  Users,
  Globe,
  Wallet,
  Bell,
  ChevronLeft,
  ChevronRight,
  Home,
  Send,
  FileText,
  Menu,
  X,
  Moon,
  Sun,
  Bot,
  MessageCircle,
  Palette,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface SidebarProps {
  className?: string
}

const menuItems = [
  {
    title: '质押大厅',
    titleEn: 'Staking Hub',
    href: '/stake',
    icon: Coins,
  },
  {
    title: '资产看板',
    titleEn: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: '我的团队',
    titleEn: 'Team Matrix',
    href: '/team',
    icon: Users,
  },
]

const externalLinks = [
  {
    title: '官方Agent',
    titleEn: 'Official Agent',
    href: 'https://venice.ai/chat/agent',
    icon: Bot,
  },
  {
    title: '官方Chat',
    titleEn: 'Official Chat',
    href: 'https://venice.ai/chat/classic',
    icon: MessageCircle,
  },
  {
    title: '官方Studio',
    titleEn: 'Official Studio',
    href: 'https://venice.ai/studio/image',
    icon: Palette,
  },
]

const socialLinks = [
  { icon: Send, href: 'https://t.me/vvveco', label: 'Telegram' },
  { icon: 'X', href: 'https://twitter.com/vvveco', label: 'X' },
  { icon: 'Discord', href: 'https://discord.gg/vvveco', label: 'Discord' },
  { icon: FileText, href: '/whitepaper', label: 'Whitepaper' },
]

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const { language, setLanguage } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showReferralDialog, setShowReferralDialog] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [isDark, setIsDark] = useState(false)
  const { unreadCount } = useNotifications()
  const { toast } = useToast()

  const handleConfirmBind = () => {
    if (!referralCode.trim()) {
      toast({
        title: "绑定失败",
        description: "请输入正确的邀请码",
        variant: "destructive",
      })
      return
    }
    // In production, call /api/invite/bind with the real wallet + referral code
    fetch("/api/invite/bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childAddress: "user_wallet", parentCode: referralCode, method: "code_input" }),
    }).catch(() => {})
    toast({ title: "绑定成功", description: "邀请关系已绑定成功" })
    window.setTimeout(() => setShowReferralDialog(false), 700)
  }

  const handleSkip = () => {
    setShowReferralDialog(false)
  }

  // Theme toggle function
  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    if (newIsDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // Initialize theme on mount
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = stored === 'dark' || (!stored && prefersDark)
    setIsDark(shouldBeDark)
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <>
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Image
            src="/staking-logo.png"
            alt="VVVeco Logo"
            width={30}
            height={30}
            className="shrink-0 rounded-lg"
          />
          <span className="text-sm font-bold text-foreground tracking-wide">VVVeco</span>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
            <Link href="/" aria-label="官网首页">
              <Home className="h-4 w-4" />
            </Link>
          </Button>

          <Button asChild variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground">
            <Link href="/notifications" aria-label="公告通知">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-medium text-destructive-foreground ring-2 ring-sidebar">
                  {unreadCount}
                </span>
              )}
            </Link>
          </Button>

          <WalletButton size="sm" />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
          // Desktop styles
          'hidden lg:flex',
          collapsed ? 'lg:w-20' : 'lg:w-64',
          className
        )}
      >
        {/* Logo */}
        <div className="flex h-18 items-center justify-between border-b border-sidebar-border px-4 bg-sidebar-accent/30">
          <div className="flex items-center gap-3">
            <Image
              src="/staking-logo.png"
              alt="VVVeco Logo"
              width={44}
              height={44}
              className="rounded-lg"
            />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-xl font-bold text-foreground">VVVeco</span>
                <span className="text-xs text-muted-foreground">Base Network</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary-foreground')} />
                {!collapsed && (
                  <span className="flex-1">{language === 'zh' ? item.title : item.titleEn}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* External Links */}
        <div className="px-3 py-2 border-t border-sidebar-border">
          {!collapsed && (
            <p className="text-xs text-muted-foreground mb-2 px-3">官方工具</p>
          )}
          {externalLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className="flex-1">{language === 'zh' ? item.title : item.titleEn}</span>
              )}
            </a>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="border-t border-sidebar-border p-3 space-y-3">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground"
          >
            {isDark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
            <span>{isDark ? '浅色模式' : '深色模式'}</span>
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
              collapsed && 'justify-center px-2'
            )}
          >
            <Globe className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <span className="flex items-center gap-1.5">
                <span className={language === 'zh' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>中</span>
                <span className="text-muted-foreground/50">/</span>
                <span className={language === 'en' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>EN</span>
              </span>
            )}
          </button>

          {/* Social Links */}
          <div className={cn('flex gap-2', collapsed ? 'flex-col items-center' : 'justify-start')}>
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
              >
                {link.icon === 'X' ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                ) : link.icon === 'Discord' ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                ) : (
                  <link.icon className="h-4 w-4" />
                )}
              </a>
            ))}
          </div>

        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed top-14 left-0 z-50 h-[calc(100vh-3.5rem)] w-72 flex flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary-foreground')} />
                <span className="flex-1">{language === 'zh' ? item.title : item.titleEn}</span>
              </Link>
            )
          })}

          {/* External Links */}
          <div className="pt-2 mt-2 border-t border-sidebar-border">
            <p className="text-xs text-muted-foreground mb-2 px-3">官方工具</p>
            {externalLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all"
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{language === 'zh' ? item.title : item.titleEn}</span>
              </a>
            ))}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-sidebar-border p-3 space-y-3">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground"
          >
            {isDark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
            <span>{isDark ? '浅色模式' : '深色模式'}</span>
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all"
          >
            <Globe className="h-5 w-5 shrink-0" />
            <span className="flex items-center gap-1.5">
              <span className={language === 'zh' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>中</span>
              <span className="text-muted-foreground/50">/</span>
              <span className={language === 'en' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>EN</span>
            </span>
          </button>

          {/* Social Links */}
          <div className="flex gap-2 justify-start">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
              >
                {link.icon === 'X' ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                ) : link.icon === 'Discord' ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                ) : (
                  <link.icon className="h-4 w-4" />
                )}
              </a>
            ))}
          </div>

        </div>
      </aside>

      {/* Referral Code Dialog */}
      <Dialog open={showReferralDialog} onOpenChange={setShowReferralDialog}>
        <DialogContent className="w-[min(92vw,670px)] border-border bg-card px-8 py-9 shadow-2xl sm:max-w-[670px]">
          <DialogHeader className="gap-3 text-left">
            <DialogTitle className="text-2xl font-semibold leading-none text-foreground">绑定邀请码</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              请输入邀请人的邀请码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-7 pt-7">
            <Input
              type="text"
              placeholder="输入8位邀请码"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.trim())}
              className="h-20 rounded-xl border-2 border-primary bg-input text-center text-lg font-mono text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-14 rounded-lg border-border bg-card text-base font-semibold hover:bg-secondary"
                onClick={handleSkip}
              >
                跳过
              </Button>
              <Button
                className="h-14 rounded-lg bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
                onClick={handleConfirmBind}
              >
                确认绑定
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wallet connected via RainbowKit — no mock dialogs needed */}
    </>
  )
}
