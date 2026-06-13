'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Save, RefreshCw } from 'lucide-react'

interface SocialConfig {
  telegramUrl: string
  xUrl: string
  discordUrl: string
  websiteUrl: string
  whitepaperUrl: string
  supportUrl: string
}

const FIELDS: { key: keyof SocialConfig; label: string; placeholder: string }[] = [
  { key: 'telegramUrl', label: 'Telegram URL', placeholder: 'https://t.me/...' },
  { key: 'xUrl', label: 'X (Twitter) URL', placeholder: 'https://twitter.com/...' },
  { key: 'discordUrl', label: 'Discord URL', placeholder: 'https://discord.gg/...' },
  { key: 'websiteUrl', label: '官网 URL', placeholder: 'https://...' },
  { key: 'whitepaperUrl', label: '白皮书 URL', placeholder: 'https:// 或 /whitepaper' },
  { key: 'supportUrl', label: '客服 URL', placeholder: 'https://t.me/... 或 mailto:...' },
]

export function SocialAdmin() {
  const { toast } = useToast()
  const [config, setConfig] = useState<SocialConfig>({
    telegramUrl: '',
    xUrl: '',
    discordUrl: '',
    websiteUrl: '',
    whitepaperUrl: '',
    supportUrl: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/config/social')
      if (res.ok) setConfig(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfig() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config/social', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        const updated = await res.json()
        setConfig(updated)
        toast({ title: '保存成功', description: '社群链接已更新，客户端下次请求时生效' })
      } else {
        toast({ title: '保存失败', variant: 'destructive' })
      }
    } catch {
      toast({ title: '网络错误', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">社群配置</h1>
        <p className="text-sm text-muted-foreground mt-1">修改后实时生效，无需重新部署前端</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>社群链接管理</CardTitle>
              <CardDescription>配置侧边栏底部社群图标的跳转地址</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchConfig} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                value={config[key]}
                onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                disabled={loading}
              />
            </div>
          ))}

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? '保存中...' : '保存配置'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
