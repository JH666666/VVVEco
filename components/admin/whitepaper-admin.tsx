'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { ExternalLink, Eye, RefreshCw, Save } from 'lucide-react'

export function WhitepaperAdmin() {
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchUrl = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/config/social')
      if (res.ok) {
        const data = await res.json()
        setUrl(data.whitepaperUrl ?? '/whitepaper')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUrl() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config/social', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whitepaperUrl: url.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setUrl(data.whitepaperUrl)
        toast({ title: '保存成功', description: '白皮书链接已更新' })
      } else {
        toast({ title: '保存失败', variant: 'destructive' })
      }
    } catch {
      toast({ title: '网络错误', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const isExternal = url.startsWith('http')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">白皮书管理</h1>
        <p className="text-sm text-muted-foreground mt-1">配置前端侧边栏白皮书图标的跳转地址</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>白皮书链接</CardTitle>
              <CardDescription>
                填写 <code className="text-xs bg-secondary px-1 py-0.5 rounded">/whitepaper</code> 使用本站内置白皮书，
                或填写外部完整 URL（如 PDF、文档站）
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchUrl} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="whitepaperUrl">白皮书 URL</Label>
            <Input
              id="whitepaperUrl"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="/whitepaper 或 https://..."
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              当前类型：{isExternal ? '外部链接（新标签页打开）' : '站内页面（当前标签页打开）'}
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? '保存中...' : '保存'}
            </Button>
            <Button
              variant="outline"
              disabled={!url || loading}
              onClick={() => window.open(url, '_blank')}
              className="gap-2"
            >
              {isExternal ? <ExternalLink className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              预览
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-lg border border-border p-3 space-y-1">
            <p className="font-medium text-foreground">方式一：使用内置白皮书页</p>
            <p>URL 填写 <code className="bg-secondary px-1 rounded">/whitepaper</code>，使用本站 <code>/whitepaper</code> 页面（已内置项目文档）</p>
          </div>
          <div className="rounded-lg border border-border p-3 space-y-1">
            <p className="font-medium text-foreground">方式二：链接外部文档</p>
            <p>URL 填写完整外部地址，如 Google Doc、Notion、PDF 链接等，点击后在新标签页打开</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
