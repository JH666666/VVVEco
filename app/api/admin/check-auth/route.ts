import { isAdminAuthenticated } from '@/lib/admin-auth'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const ADMIN_SESSION_COOKIE = 'vvveco_admin_session'
const SESSION_MAX_AGE = 60 * 30  // 30分钟无操作自动退出

export async function GET() {
  const ok = await isAdminAuthenticated()
  const res = NextResponse.json({ authenticated: ok }, { status: ok ? 200 : 401 })

  if (ok) {
    // 滑动会话：有效请求重置30分钟计时器
    const cookieStore = await cookies()
    const sessionValue = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
    if (sessionValue) {
      const isHttps = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https') ?? false
      res.cookies.set(ADMIN_SESSION_COOKIE, sessionValue, {
        httpOnly: true,
        maxAge: SESSION_MAX_AGE,
        path: '/',
        sameSite: 'lax',
        secure: isHttps,
      })
    }
  }

  return res
}
