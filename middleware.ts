import { NextRequest, NextResponse } from 'next/server'

const ADMIN_SESSION_COOKIE = 'vvveco_admin_session'
const SESSION_MAX_AGE = 60 * 30 // 30分钟无操作自动退出

function getAdminAccount() { return process.env.ADMIN_ACCOUNT ?? 'vvv_admin' }
function getSessionSecret() { return process.env.ADMIN_SESSION_SECRET ?? 'vvveco-local-admin-session-secret' }

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacSign(account: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(account))
  return toHex(sig)
}

function safeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function isValidSession(sessionValue: string): Promise<boolean> {
  const dotIndex = sessionValue.lastIndexOf('.')
  if (dotIndex === -1) return false
  const account = sessionValue.slice(0, dotIndex)
  const signature = sessionValue.slice(dotIndex + 1)
  if (!account || !signature || account !== getAdminAccount()) return false
  const expected = await hmacSign(account)
  return safeEqualStr(expected, signature)
}

export async function middleware(request: NextRequest) {
  const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value

  if (!sessionValue || !(await isValidSession(sessionValue))) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // 滑动会话：有效请求重置30分钟计时器
  const response = NextResponse.next()
  const isHttps = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https') ?? false
  response.cookies.set(ADMIN_SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: isHttps,
  })
  return response
}

export const config = {
  matcher: ['/admin/web', '/admin/contract', '/admin/global', '/admin/users', '/admin/orders'],
}
