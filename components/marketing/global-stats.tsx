"use client"

import { useLanguage } from './language-provider'

const regions = [
  { nameEn: "North America", nameZh: "北美", users: "35%", count: "17,500+", color: "bg-primary" },
  { nameEn: "Europe", nameZh: "欧洲", users: "28%", count: "14,000+", color: "bg-primary/80" },
  { nameEn: "Asia Pacific", nameZh: "亚太", users: "22%", count: "11,000+", color: "bg-primary/60" },
  { nameEn: "Latin America", nameZh: "拉美", users: "10%", count: "5,000+", color: "bg-accent" },
  { nameEn: "Others", nameZh: "其他", users: "5%", count: "2,500+", color: "bg-muted-foreground" },
]

const stats = [
  { labelEn: "Countries", labelZh: "覆盖国家", value: "120+" },
  { labelEn: "Daily Txs", labelZh: "日均交易", value: "25K+" },
  { labelEn: "Stakers", labelZh: "总质押者", value: "50K+" },
  { labelEn: "Community", labelZh: "社区成员", value: "200K+" },
]

export function GlobalStats() {
  const { t } = useLanguage()

  return (
    <section id="global" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">{t("Global Distribution", "全球分布")}</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-medium text-foreground mt-4 mb-6 text-balance">
            {t("Worldwide Community", "遍布全球的社区")}
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
            {t(
              "VVV stakers come from all over the world, together building the decentralized AI future.",
              "VVV 质押者来自世界各地，共同参与构建去中心化的 AI 未来。"
            )}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="bg-secondary/50 rounded-2xl p-8 border border-border">
            <div className="aspect-video relative flex items-center justify-center">
              <svg viewBox="0 0 400 200" className="w-full h-full">
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
                  </pattern>
                </defs>
                <rect width="400" height="200" fill="url(#grid)" />
                
                <ellipse cx="90" cy="70" rx="45" ry="35" className="fill-primary/20" />
                <circle cx="90" cy="70" r="8" className="fill-primary animate-pulse" />
                
                <ellipse cx="110" cy="140" rx="25" ry="35" className="fill-accent/20" />
                <circle cx="110" cy="140" r="5" className="fill-accent" />
                
                <ellipse cx="200" cy="60" rx="35" ry="25" className="fill-primary/15" />
                <circle cx="200" cy="60" r="7" className="fill-primary/80 animate-pulse" style={{ animationDelay: '0.5s' }} />
                
                <ellipse cx="200" cy="120" rx="30" ry="40" className="fill-muted-foreground/10" />
                <circle cx="200" cy="120" r="4" className="fill-muted-foreground" />
                
                <ellipse cx="300" cy="80" rx="55" ry="40" className="fill-primary/10" />
                <circle cx="300" cy="80" r="6" className="fill-primary/60 animate-pulse" style={{ animationDelay: '1s' }} />
                
                <ellipse cx="340" cy="150" rx="25" ry="20" className="fill-muted-foreground/10" />
                <circle cx="340" cy="150" r="4" className="fill-muted-foreground" />
              </svg>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {stats.map((stat) => (
                <div key={stat.labelEn} className="bg-card rounded-xl p-4 border border-border text-center">
                  <div className="font-serif text-2xl md:text-3xl font-medium text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{t(stat.labelEn, stat.labelZh)}</div>
                </div>
              ))}
            </div>

            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="font-medium text-foreground mb-4">{t("Staker Distribution", "质押者地区分布")}</h3>
              <div className="space-y-4">
                {regions.map((region) => (
                  <div key={region.nameEn}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-foreground">{t(region.nameEn, region.nameZh)}</span>
                      <span className="text-sm text-muted-foreground">{region.count} ({region.users})</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${region.color} rounded-full transition-all duration-1000`}
                        style={{ width: region.users }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
