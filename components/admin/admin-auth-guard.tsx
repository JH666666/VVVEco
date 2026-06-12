'use client'

import { useEffect, useState, type ReactNode } from 'react'

export function AdminAuthGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'fail'>('checking')

  useEffect(() => {
    fetch('/api/admin/check-auth', { credentials: 'include' })
      .then(r => setStatus(r.ok ? 'ok' : 'fail'))
      .catch(() => setStatus('fail'))
  }, [])

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">验证登录状态...</div>
      </div>
    )
  }

  if (status === 'fail') {
    if (typeof window !== 'undefined') window.location.href = '/admin'
    return null
  }

  return <>{children}</>
}
