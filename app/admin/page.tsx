'use client'

import { useState } from 'react'
import { LockKeyhole, Moon, Sun, UserRound } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OfficialLogo } from '@/components/brand/official-logo'

export default function AdminLoginPage() {
  const [account, setAccount]   = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(false)
  const [loading, setLoading]   = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(false)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password }),
        credentials: 'include',
      })
      if (res.ok) {
        window.location.href = '/admin/web'
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 bg-background text-foreground">
      <div className="w-full max-w-md rounded-xl p-6 shadow-2xl bg-card border border-border">
        <div className="mb-8 flex items-center gap-3">
          <OfficialLogo size={44} themeAware />
          <div>
            <h1 className="text-xl font-semibold text-foreground">VVVeco Admin</h1>
            <p className="text-sm text-muted-foreground">Secure owner access</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="account">Admin Account</Label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="account"
                name="account"
                autoComplete="username"
                className="h-11 pl-10"
                placeholder="vvv_admin"
                value={account}
                onChange={e => setAccount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Secret Password</Label>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="h-11 pl-10"
                placeholder="Enter secret password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              管理员账号或密码不正确。
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={loading}
              className="h-11 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? '登录中...' : '登录管理后台'}
            </Button>
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
              aria-label="切换主题"
            >
              {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
