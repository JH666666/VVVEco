"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { useLanguage, LanguageSwitcher } from "./language-provider"
import { OfficialLogo } from "@/components/brand/official-logo"

const navItems = [
  { en: "About", zh: "关于", href: "#about" },
  { en: "Staking", zh: "质押玩法", href: "#staking" },
  { en: "AI Models", zh: "AI 模型", href: "#models" },
  { en: "Pricing", zh: "订阅", href: "#pricing" },
  { en: "Tools", zh: "官方工具", href: "#tools" },
  { en: "Team", zh: "团队", href: "#team" },
  { en: "Explore VVVEco Ecosystem", zh: "了解 VVVEco 生态", href: "/ecosystem" },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { t } = useLanguage()

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl">
      <nav className="flex items-center justify-between px-4 py-3 bg-card/90 backdrop-blur-md rounded-full border border-border shadow-sm">
        <Link href="/" className="flex items-center gap-2">
          <OfficialLogo size={36} themeAware />
          <span className="font-serif text-lg font-semibold text-foreground">VVVEco</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t(item.en, item.zh)}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            href="/stake"
            className="bg-primary text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {t("Enter Staking", "进入质押大厅")}
          </Link>
        </div>

        <button
          className="md:hidden p-2 -mr-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5 text-foreground" />
          ) : (
            <Menu className="w-5 h-5 text-foreground" />
          )}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden mt-2 bg-card/95 backdrop-blur-md rounded-2xl border border-border shadow-lg p-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-center pb-2">
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
              className="bg-primary text-white px-5 py-3 rounded-full text-sm font-medium text-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("Enter Staking", "进入质押大厅")}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
