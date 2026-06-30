"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Menu, X } from "lucide-react"
import { useLanguage, LanguageSwitcher } from "./language-provider"
import { OfficialLogo } from "@/components/brand/official-logo"

type HeaderNavItem = {
  en: string
  zh: string
  href: string
}

const homeNavItems: HeaderNavItem[] = [
  { en: "About", zh: "关于", href: "#about" },
  { en: "Staking", zh: "质押玩法", href: "#staking" },
  { en: "AI Models", zh: "AI 模型", href: "#models" },
  { en: "Pricing", zh: "订阅", href: "#pricing" },
  { en: "Tools", zh: "官方工具", href: "#tools" },
  { en: "Team", zh: "团队", href: "#team" },
  { en: "Explore VVVeco Ecosystem", zh: "了解 VVVeco 生态", href: "/ecosystem" },
]

export function Header({
  navItems = homeNavItems,
}: {
  navItems?: HeaderNavItem[]
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { t } = useLanguage()

  return (
    <header
      className="fixed top-4 inset-x-0 z-50 mx-auto w-[calc(100%-2rem)] max-w-5xl"
      style={{ position: "fixed", top: "1rem", left: 0, right: 0, margin: "0 auto", width: "calc(100% - 2rem)", maxWidth: "64rem", zIndex: 50 }}
    >
      <nav
        className="flex h-[62px] items-center justify-between gap-2 px-4 bg-card/90 backdrop-blur-md rounded-full border border-border shadow-sm"
        style={{ display: "flex", height: "62px", alignItems: "center", justifyContent: "space-between" }}
      >
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-2"
          onClick={() => setMobileMenuOpen(false)}
          aria-label={t("VVVeco home", "返回 VVVeco 首页")}
        >
          <OfficialLogo size={36} themeAware />
          <span className="font-serif text-base sm:text-lg font-semibold text-foreground">VVVeco</span>
        </Link>

        <div className="hidden xl:flex min-w-0 items-center gap-5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t(item.en, item.zh)}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <Link
            href="/stake"
            className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap bg-primary text-primary-foreground px-3 sm:px-5 rounded-full text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <span className="hidden min-[360px]:inline">{t("Enter Staking", "进入质押大厅")}</span>
            <span className="min-[360px]:hidden">{t("Stake", "质押")}</span>
            <ArrowRight className="hidden sm:block h-3.5 w-3.5" />
          </Link>

          <button
            className="xl:hidden inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-secondary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? t("Close menu", "关闭菜单") : t("Open menu", "打开菜单")}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="xl:hidden mt-2 bg-card/95 backdrop-blur-md rounded-2xl border border-border shadow-lg p-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-center pb-2 md:hidden">
              <LanguageSwitcher />
            </div>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-4 py-3 text-foreground hover:bg-secondary rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t(item.en, item.zh)}
              </Link>
            ))}
            <hr className="border-border my-2" />
            <Link
              href="/stake"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-full text-sm font-medium text-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("Enter Staking", "进入质押大厅")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
