import { NextRequest, NextResponse } from 'next/server'

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_VVV_TOKEN || '0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf'
const GECKO = 'https://api.geckoterminal.com/api/v2'
const HEADERS = { 'Accept': 'application/json;version=20230302' }

// Cache pool address for 1 hour
let poolAddressCache: string | null = null
let poolCacheTime = 0

async function getTopPool(): Promise<string | null> {
  if (poolAddressCache && Date.now() - poolCacheTime < 3_600_000) return poolAddressCache
  try {
    const res = await fetch(`${GECKO}/networks/base/tokens/${TOKEN_ADDRESS}/pools?page=1`, { headers: HEADERS })
    if (!res.ok) return null
    const data = await res.json()
    const addr = data.data?.[0]?.attributes?.address as string | undefined
    if (addr) { poolAddressCache = addr; poolCacheTime = Date.now() }
    return addr ?? null
  } catch { return null }
}

const TF_MAP: Record<string, { timeframe: string; limit: number }> = {
  minute: { timeframe: 'minute', limit: 60 },
  hour:   { timeframe: 'hour',   limit: 48 },
  day:    { timeframe: 'day',    limit: 30 },
  week:   { timeframe: 'week',   limit: 12 },
  month:  { timeframe: 'month',  limit: 12 },
}

export async function GET(req: NextRequest) {
  const tf = req.nextUrl.searchParams.get('tf') ?? 'day'
  const { timeframe, limit } = TF_MAP[tf] ?? TF_MAP.day

  const pool = await getTopPool()
  if (!pool) return NextResponse.json({ error: 'pool not found' }, { status: 502 })

  try {
    const url = `${GECKO}/networks/base/pools/${pool}/ohlcv/${timeframe}?limit=${limit}&currency=usd&token=base`
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 60 } })
    if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: 502 })

    const data = await res.json()
    // ohlcv_list: [[timestamp, open, high, low, close, volume], ...]  (newest first → reverse to oldest first)
    const raw: [number, number, number, number, number, number][] = data.data?.attributes?.ohlcv_list ?? []
    const prices = raw.map(([ts, , , , close]) => ({ ts: ts * 1000, price: close })).reverse()

    const change24h = prices.length >= 2
      ? ((prices[prices.length - 1].price - prices[0].price) / prices[0].price) * 100
      : 0

    return NextResponse.json({ prices, change24h }, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' }
    })
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
  }
}
