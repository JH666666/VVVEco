"use client";

import Link from "next/link";
import { Bell, Home } from "lucide-react";
import { useNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { WalletButton } from "@/components/layout/wallet-button";

export function TopBar() {
  const { unreadCount } = useNotifications();

  return (
    <>
      <header className="fixed top-0 right-0 left-64 z-40 hidden lg:flex h-14 items-center justify-end border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground" title="官网首页">
            <Link href="/" aria-label="官网首页">
              <Home className="h-4 w-4" />
            </Link>
          </Button>

          <ThemeToggle />

          <Button asChild variant="ghost" size="icon" className="relative h-10 w-10">
            <Link href="/notifications" aria-label="公告通知">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground ring-2 ring-background">
                  {unreadCount}
                </span>
              )}
            </Link>
          </Button>

          <WalletButton />
        </div>
      </header>
    </>
  );
}
