import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULTS = {
  telegramUrl: 'https://t.me/vvveco',
  xUrl: 'https://twitter.com/vvveco',
  discordUrl: 'https://discord.gg/vvveco',
  websiteUrl: 'https://vvveco.com',
  whitepaperUrl: '/whitepaper',
  supportUrl: 'https://t.me/vvveco_support',
}

async function getOrCreate() {
  let config = await prisma.socialConfig.findFirst({ where: { id: 1 } })
  if (!config) {
    config = await prisma.socialConfig.create({ data: { id: 1 } })
  }
  return config
}

// GET /api/config/social — public, no auth
export async function GET() {
  try {
    const config = await getOrCreate()
    return NextResponse.json({
      telegramUrl: config.telegramUrl || DEFAULTS.telegramUrl,
      xUrl: config.xUrl || DEFAULTS.xUrl,
      discordUrl: config.discordUrl || DEFAULTS.discordUrl,
      websiteUrl: config.websiteUrl || DEFAULTS.websiteUrl,
      whitepaperUrl: config.whitepaperUrl || DEFAULTS.whitepaperUrl,
      supportUrl: config.supportUrl || DEFAULTS.supportUrl,
    })
  } catch {
    return NextResponse.json(DEFAULTS)
  }
}

// PUT /api/config/social — admin only
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const data: Record<string, string> = {}
    if (typeof body.telegramUrl === 'string') data.telegramUrl = body.telegramUrl.trim()
    if (typeof body.xUrl === 'string') data.xUrl = body.xUrl.trim()
    if (typeof body.discordUrl === 'string') data.discordUrl = body.discordUrl.trim()
    if (typeof body.websiteUrl === 'string') data.websiteUrl = body.websiteUrl.trim()
    if (typeof body.whitepaperUrl === 'string') data.whitepaperUrl = body.whitepaperUrl.trim()
    if (typeof body.supportUrl === 'string') data.supportUrl = body.supportUrl.trim()

    const config = await prisma.socialConfig.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...DEFAULTS, ...data },
    })

    return NextResponse.json({
      telegramUrl: config.telegramUrl,
      xUrl: config.xUrl,
      discordUrl: config.discordUrl,
      websiteUrl: config.websiteUrl,
      whitepaperUrl: config.whitepaperUrl,
      supportUrl: config.supportUrl,
    })
  } catch {
    return NextResponse.json({ error: 'update failed' }, { status: 500 })
  }
}
