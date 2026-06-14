import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const ADMIN_SESSION_COOKIE = 'vvveco_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 8  // 8小时无操作自动退出

function getAdminAccount() {
  return process.env.ADMIN_ACCOUNT ?? 'vvv_admin'
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'YourSecurePassword123!'
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? 'vvveco-local-admin-session-secret'
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function signSession(account: string) {
  return createHmac('sha256', getSessionSecret()).update(account).digest('hex')
}

function createSessionValue(account: string) {
  return `${account}.${signSession(account)}`
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies()
  const sessionValue = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  if (!sessionValue) return false

  const [account, signature] = sessionValue.split('.')
  if (!account || !signature || account !== getAdminAccount()) return false

  return safeEqual(signature, signSession(account))
}

export async function requireAdminAuth() {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin')
  }
}

export async function createAdminSession(account: string, password: string) {
  const validAccount = safeEqual(account, getAdminAccount())
  const validPassword = safeEqual(password, getAdminPassword())

  if (!validAccount || !validPassword) {
    return false
  }

  const cookieStore = await cookies()
  // secure 只在真正部署到 HTTPS 环境时才开启（Vercel 等）
  // 本地局域网 HTTP 访问必须关闭，否则浏览器不回传 cookie 导致自动退出
  const isHttps = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https') ?? false
  cookieStore.set(ADMIN_SESSION_COOKIE, createSessionValue(account), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: isHttps,
  })

  return true
}

export async function clearAdminSession() {
  const isHttps = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https') ?? false
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: isHttps,
  })
}
