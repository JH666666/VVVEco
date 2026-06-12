'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Send, Twitter, FileText, ExternalLink, MessageCircle, Users } from 'lucide-react'

const socialLinks = [
  {
    name: 'Telegram 官方群',
    description: '加入我们的官方 Telegram 社群，获取最新资讯',
    icon: Send,
    href: 'https://t.me/vvveco',
    color: 'bg-[#0088cc]',
    members: '12,500+',
  },
  {
    name: 'Twitter (X)',
    description: '关注我们的 Twitter，掌握项目动态',
    icon: Twitter,
    href: 'https://twitter.com/vvveco',
    color: 'bg-foreground',
    members: '8,200+',
  },
  {
    name: 'Discord 社区',
    description: '加入 Discord 与全球社区成员交流',
    icon: MessageCircle,
    href: 'https://discord.gg/vvveco',
    color: 'bg-[#5865F2]',
    members: '5,800+',
  },
]

const resources = [
  {
    name: '白皮书',
    description: '了解 VVVeco 的技术架构和经济模型',
    icon: FileText,
    href: '/whitepaper',
  },
  {
    name: '使用指南',
    description: '快速上手质押操作的详细教程',
    icon: FileText,
    href: '/guide',
  },
]

export function Community() {
  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">官方社群</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">加入我们的社群，获取最新资讯和支持</p>
      </div>

      {/* Social Links */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {socialLinks.map((link) => (
          <Card key={link.name} className="bg-card border-border shadow-card hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${link.color}`}>
                  <link.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">{link.name}</CardTitle>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{link.members} 成员</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-xs sm:text-sm">{link.description}</CardDescription>
              <Button
                asChild
                className="w-full"
                variant="outline"
              >
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  立即加入
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resources */}
      <Card className="bg-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">资源中心</CardTitle>
          <CardDescription className="text-xs sm:text-sm">了解更多关于 VVV Eco 的信息</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {resources.map((resource) => (
              <a
                key={resource.name}
                href={resource.href}
                className="flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <resource.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{resource.name}</h3>
                  <p className="text-xs text-muted-foreground">{resource.description}</p>
                </div>
                <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
