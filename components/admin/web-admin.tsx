'use client'

import { useState } from 'react'
import { Bell, Eye, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useNotifications, type NotificationType } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

export function WebAdmin() {
  const { notifications, enabledNotifications, unreadCount, addNotification, deleteNotification, setNotificationEnabled, resetNotifications } = useNotifications()
  const [type, setType] = useState<NotificationType>('announcement')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [contentEn, setContentEn] = useState('')

  const publishPassive = () => {
    if (!title.trim() || !content.trim() || !titleEn.trim() || !contentEn.trim()) return

    addNotification({
      id: crypto.randomUUID(),
      type,
      title: title.trim(),
      content: content.trim(),
      titleEn: titleEn.trim(),
      contentEn: contentEn.trim(),
      date: new Date().toLocaleString('zh-CN', { hour12: false }),
      read: false,
      passive: true,
      enabled: true,
    })
    setTitle('')
    setContent('')
    setTitleEn('')
    setContentEn('')
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">网站公告管理台</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            管理公告内容和被动红点通知，不弹窗、不打断用户。
          </p>
        </div>
        <Button variant="outline" onClick={resetNotifications}>
          <RotateCcw className="mr-2 h-4 w-4" />
          重置通知
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-primary" />
              未读数量状态
            </CardTitle>
            <CardDescription>未读数量直接来自当前启用公告数据。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <span className="text-sm text-muted-foreground">Unread count</span>
              <Badge>{unreadCount}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <span className="text-sm text-muted-foreground">导航预览</span>
              <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground ring-2 ring-card">
                    {unreadCount}
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-primary" />
              发布被动通知
            </CardTitle>
            <CardDescription>发布后只点亮通知铃红点，用户进入通知页后自行阅读。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={type} onValueChange={value => setType(value as NotificationType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">公告</SelectItem>
                    <SelectItem value="reward">奖励</SelectItem>
                    <SelectItem value="alert">提醒</SelectItem>
                    <SelectItem value="info">消息</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>中文标题</Label>
                <Input value={title} onChange={event => setTitle(event.target.value)} placeholder="例如：系统升级公告" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>中文内容</Label>
              <Textarea value={content} onChange={event => setContent(event.target.value)} placeholder="输入中文通知内容" />
            </div>
            <div className="space-y-2">
              <Label>英文标题</Label>
              <Input value={titleEn} onChange={event => setTitleEn(event.target.value)} placeholder="Example: System Upgrade Notice" />
            </div>
            <div className="space-y-2">
              <Label>英文内容</Label>
              <Textarea value={contentEn} onChange={event => setContentEn(event.target.value)} placeholder="Enter notification content in English" />
            </div>
            <Button
              onClick={publishPassive}
              disabled={!title.trim() || !content.trim() || !titleEn.trim() || !contentEn.trim()}
            >
              <Bell className="mr-2 h-4 w-4" />
              发布并点亮红点
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            已发布公告列表
          </CardTitle>
          <CardDescription>当前启用中的公告。删除后会从用户端通知列表移除，并同步减少未读数量。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {enabledNotifications.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              暂无已发布公告
            </div>
          ) : (
            enabledNotifications.map(notification => (
              <div
                key={notification.id}
                className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{notification.title}</p>
                    <Badge variant="secondary">{notification.type}</Badge>
                    {!notification.read && (
                      <Badge variant="destructive">未读</Badge>
                    )}
                  </div>
                  {notification.titleEn && (
                    <p className="mt-1 text-sm text-muted-foreground">{notification.titleEn}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>发布时间：{notification.date}</span>
                    <span>类型：{notification.type}</span>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteNotification(notification.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Eye className="h-5 w-5 text-primary" />
            通知开关
          </CardTitle>
          <CardDescription>关闭后该条通知不会参与红点计数，也不会展示在通知页。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.map(notification => (
            <div key={notification.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{notification.title}</p>
                  <Badge variant="secondary">{notification.type}</Badge>
                  {!notification.read && <span className="h-2 w-2 rounded-full bg-destructive" />}
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{notification.content}</p>
                {notification.contentEn && (
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{notification.contentEn}</p>
                )}
              </div>
              <Switch
                checked={notification.enabled !== false}
                onCheckedChange={checked => setNotificationEnabled(notification.id, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
