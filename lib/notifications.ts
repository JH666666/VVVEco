"use client";

import { useEffect, useMemo, useState } from "react";

export type NotificationType = "announcement" | "reward" | "alert" | "info";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  titleEn?: string;
  contentEn?: string;
  date: string;
  read: boolean;
  passive?: boolean;
  enabled?: boolean;
}

export function getLocalizedNotification(n: AppNotification, language: "zh" | "en") {
  if (language === "en") {
    return { title: n.titleEn?.trim() || n.title, content: n.contentEn?.trim() || n.content };
  }
  return { title: n.title, content: n.content };
}

export const defaultNotifications: AppNotification[] = [];

const READ_KEY = "vvveco-read-ids";

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveReadIds(ids: Set<string>) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...ids])); } catch {}
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(defaultNotifications);

  useEffect(() => {
    const fetchNotifications = () => {
      fetch("/api/notifications", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          const readIds = loadReadIds();
          setNotifications(
            (data.items ?? []).map((n: Record<string, unknown>) => ({
              ...n,
              date: typeof n.createdAt === "string" ? new Date(n.createdAt).toLocaleString("zh-CN", { hour12: false }) : "",
              read: readIds.has(String(n.id)),
              passive: true,
              enabled: n.enabled !== false,
            } as AppNotification))
          );
        })
        .catch(() => {
          try {
            const stored = localStorage.getItem("vvveco-notifications");
            if (stored) setNotifications(JSON.parse(stored));
          } catch {}
        });
    };

    fetchNotifications();
    const timer = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(timer);
  }, []);

  const enabledNotifications = useMemo(
    () => notifications.filter((n) => n.enabled !== false),
    [notifications]
  );
  const unreadCount = enabledNotifications.filter((n) => !n.read).length;

  return {
    notifications,
    enabledNotifications,
    unreadCount,
    markAsRead: (id: string) => {
      setNotifications((items) => items.map((item) => (item.id === id ? { ...item, read: true } : item)));
      const ids = loadReadIds(); ids.add(id); saveReadIds(ids);
    },
    markAllAsRead: () => {
      setNotifications((items) => {
        const ids = loadReadIds();
        items.forEach((item) => ids.add(item.id));
        saveReadIds(ids);
        return items.map((item) => ({ ...item, read: true }));
      });
    },
    addNotification: async (n: AppNotification) => {
      setNotifications((items) => [{ ...n, passive: true, enabled: true }, ...items]);
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: n.type, title: n.title, content: n.content, titleEn: n.titleEn, contentEn: n.contentEn }),
      }).catch(() => {});
    },
    deleteNotification: async (id: string) => {
      setNotifications((items) => items.filter((item) => item.id !== id));
      await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    },
    setNotificationEnabled: async (id: string, enabled: boolean) => {
      setNotifications((items) => items.map((item) => (item.id === id ? { ...item, enabled } : item)));
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      }).catch(() => {});
    },
    resetNotifications: async () => {
      setNotifications(defaultNotifications);
    },
  };
}
