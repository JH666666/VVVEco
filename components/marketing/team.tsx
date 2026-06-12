"use client"

import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from './language-provider'

const founders = [
  {
    name: "Erik Voorhees",
    roleEn: "Founder & CEO",
    roleZh: "创始人 & CEO",
    bioEn: "Crypto industry legend, entered the space in 2011. Founded SatoshiDice, early BitInstant member, ShapeShift founder. Transformed ShapeShift into a DAO in 2021, founded Venice AI in 2024.",
    bioZh: "加密行业传奇人物，2011 年入场。创立 SatoshiDice、BitInstant 早期成员、ShapeShift 创始人。2021 年将 ShapeShift 转型为 DAO，2024 年创立 Venice AI。",
    background: "ShapeShift Founder",
    twitter: "https://twitter.com/ErikVoorhees",
  },
  {
    name: "Jesse Proudman",
    roleEn: "Co-founder & CTO",
    roleZh: "联合创始人 & CTO",
    bioEn: "Serial entrepreneur and tech expert. Founded Blue Box Group (acquired by IBM), 15+ years experience in cloud computing and distributed systems.",
    bioZh: "连续创业者和技术专家。创立 Blue Box Group（后被 IBM 收购），在云计算和分布式系统领域拥有超过 15 年经验。",
    background: "Blue Box Group Founder",
    twitter: "https://twitter.com/jesseproudman",
  },
  {
    name: "Teana Baker-Taylor",
    roleEn: "Co-founder & COO",
    roleZh: "联合创始人 & COO",
    bioEn: "Senior fintech and crypto executive. Former HSBC, Circle, Binance senior positions, extensive compliance and operations management experience.",
    bioZh: "金融科技和加密行业资深高管。曾任 HSBC、Circle、Binance 高级职位，在合规和运营管理方面经验丰富。",
    background: "Ex-Circle/Binance Executive",
    twitter: "https://twitter.com/teanabakertay",
  },
]

const team = [
  { name: "Willy Ogorzaly", roleEn: "Head of Product", roleZh: "产品负责人" },
  { name: "Gabriel D. Kruse", roleEn: "Head of Growth", roleZh: "增长负责人" },
  { name: "Lorenzo E. Fränkel", roleEn: "Head of Communications", roleZh: "传播负责人" },
]

export function Team() {
  const { t } = useLanguage()

  return (
    <section id="team" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">{t("Core Team", "核心团队")}</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-medium text-foreground mt-4 mb-6 text-balance">
            {t("Led by Crypto OGs", "由加密 OG 领导")}
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
            {t(
              "Venice AI team consists of the most experienced entrepreneurs in crypto and tech industries, building the next generation of privacy AI infrastructure.",
              "Venice AI 团队由加密货币和技术行业最有经验的创业者组成，他们正在构建下一代隐私 AI 基础设施。"
            )}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {founders.map((founder) => (
            <div
              key={founder.name}
              className="bg-card rounded-2xl p-6 border border-border hover:border-primary/30 transition-colors group"
            >
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <span className="font-serif text-2xl font-medium text-primary">
                  {founder.name.charAt(0)}
                </span>
              </div>
              <div className="mb-4">
                <h3 className="font-serif text-xl font-medium text-foreground">{founder.name}</h3>
                <p className="text-primary text-sm">{t(founder.roleEn, founder.roleZh)}</p>
                <p className="text-muted-foreground text-xs mt-1">{founder.background}</p>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                {t(founder.bioEn, founder.bioZh)}
              </p>
              <Link
                href={founder.twitter}
                target="_blank"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Twitter
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>

        <div className="bg-secondary/50 rounded-2xl p-8 border border-border">
          <h3 className="font-serif text-xl font-medium text-foreground mb-6 text-center">{t("Core Members", "核心成员")}</h3>
          <div className="grid grid-cols-3 gap-6">
            {team.map((member) => (
              <div key={member.name} className="text-center">
                <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center mx-auto mb-3">
                  <span className="font-medium text-primary">{member.name.charAt(0)}</span>
                </div>
                <div className="font-medium text-foreground text-sm">{member.name}</div>
                <div className="text-muted-foreground text-xs">{t(member.roleEn, member.roleZh)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
