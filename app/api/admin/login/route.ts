import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_SESSION_COOKIE = 'vvveco_admin_session'
const SESSION_MAX_AGE = 60 * 30  // 30分钟无操作自动退出

function getAdminAccount() { return process.env.ADMIN_ACCOUNT ?? 'vvv_admin' }
function getAdminPassword() { return process.env.ADMIN_PASSWORD ?? 'YourSecurePassword123!' }
function getSessionSecret() { return process.env.ADMIN_SESSION_SECRET ?? 'vvveco-local-admin-session-secret' }

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

function signSession(account: string) {
  return createHmac('sha256', getSessionSecret()).update(account).digest('hex')
}

function createSessionValue(account: string) {
  return `${account}.${signSession(account)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const account  = String(body.account  ?? '').trim()
    const password = String(body.password ?? '').trim()

    if (!safeEqual(account, getAdminAccount()) || !safeEqual(password, getAdminPassword())) {
      return NextResponse.json({ error: '账号或密码错误' }, { status: 401 })
    }

    const isHttps = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https') ?? false
    const res = NextResponse.json({ ok: true })
    res.cookies.set(ADMIN_SESSION_COOKIE, createSessionValue(account), {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE,
      path: '/',
      sameSite: 'lax',
      secure: isHttps,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
