'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getLocalizedNotification, useNotifications } from '@/lib/notifications'
import { useLanguage } from '@/contexts/language-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Bell,
  Megaphone,
  Gift,
  AlertCircle,
  Info,
  ChevronRight,
  Clock,
  Check,
} from 'lucide-react'

const typeConfig = {
  announcement: {
    icon: Megaphone,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: '公告',
  },
  reward: {
    icon: Gift,
    color: 'text-chart-1',
    bgColor: 'bg-chart-1/10',
    label: '奖励',
  },
  alert: {
    icon: AlertCircle,
    color: 'text-chart-4',
    bgColor: 'bg-chart-4/10',
    label: '提醒',
  },
  info: {
    icon: Info,
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    label: '消息',
  },
}

export function Notifications() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [expandedId, setExpandedId] = useState('')
  const { enabledNotifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const { language } = useLanguage()

  const filteredNotifications = enabledNotifications.filter(n => {
    if (filter === 'unread') return !n.read
    return true
  })

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">公告通知</h1>
          <p className="text-muted-foreground mt-1">查看平台公告和个人通知消息</p>
        </div>
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            onClick={markAllAsRead}
            className="hover:bg-primary/10 hover:text-primary hover:border-primary"
          >
            <Check className="mr-2 h-4 w-4" />
            全部标为已读
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('all')}
          className={cn(
            filter === 'all' 
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'hover:bg-secondary'
          )}
        >
          全部通知
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('unread')}
          className={cn(
            filter === 'unread' 
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'hover:bg-secondary'
          )}
        >
          未读 ({unreadCount})
        </Button>
      </div>

      {/* Notification List */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <Card className="bg-card border-border shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-lg font-medium text-foreground">暂无通知</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filter === 'unread' ? '所有通知已读' : '还没有任何通知消息'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => {
            const config = typeConfig[notification.type]
            const isExpanded = expandedId === notification.id
            const localizedNotification = getLocalizedNotification(notification, language)

            return (
              <Card 
                key={notification.id}
                className={cn(
                  'bg-card border-border shadow-card transition-all cursor-pointer hover:shadow-md',
                  !notification.read && 'border-l-4 border-l-primary'
                )}
                onClick={() => {
                  setExpandedId(current => (current === notification.id ? '' : notification.id))
                  if (!notification.read) markAsRead(notification.id)
                }}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', config.bgColor)}>
                      <config.icon className={cn('h-5 w-5', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{localizedNotification.title}</h3>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', config.bgColor, config.color)}>
                          {config.label}
                        </span>
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className={cn(
                        'mt-2 text-sm text-muted-foreground whitespace-pre-line break-words leading-relaxed',
                        !isExpanded && 'line-clamp-2',
                        isExpanded && 'mt-3 rounded-md bg-muted/40 p-3',
                      )}>
                        {localizedNotification.content}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{notification.date}</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        'h-5 w-5 text-muted-foreground shrink-0 transition-transform',
                        isExpanded && 'rotate-90',
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
