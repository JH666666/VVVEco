"use client"

import { useLanguage } from './language-provider'

const milestones = [
  {
    dateEn: "May 2024",
    dateZh: "2024 年 5 月",
    titleEn: "Venice.ai Launch",
    titleZh: "Venice.ai 上线",
    descEn: "Platform officially launched, providing privacy-first AI inference services for text, image, and code generation.",
    descZh: "平台正式发布，提供隐私优先的 AI 推理服务，支持文本、图像、代码生成。",
    status: "completed",
  },
  {
    dateEn: "Jan 2025",
    dateZh: "2025 年 1 月",
    titleEn: "VVV Token Launch",
    titleZh: "VVV 代币发布",
    descEn: "VVV native token launched on Base chain, enabling staking features and token economics.",
    descZh: "在 Base 链上发布 VVV 原生代币，开启质押功能和代币经济体系。",
    status: "completed",
  },
  {
    dateEn: "Q1 2025",
    dateZh: "2025 年 Q1",
    titleEn: "Mobile Apps",
    titleZh: "移动应用上线",
    descEn: "iOS and Android apps released, allowing users to access privacy AI services anytime, anywhere.",
    descZh: "iOS 和 Android 应用发布，用户可随时随地访问隐私 AI 服务。",
    status: "completed",
  },
  {
    dateEn: "Q3 2025",
    dateZh: "2025 年 Q3",
    titleEn: "Global Expansion",
    titleZh: "全球扩展",
    descEn: "Expanded to 120+ countries, community grew to 200K+ members, staking volume exceeded $10M.",
    descZh: "扩展至 120+ 国家，社区成员突破 20 万，质押金额超过 1000 万美元。",
    status: "completed",
  },
  {
    dateEn: "Q4 2025",
    dateZh: "2025 年 Q4",
    titleEn: "Venice Video",
    titleZh: "Venice Video",
    descEn: "Launched video generation feature, supporting AI-generated and edited video content.",
    descZh: "推出视频生成功能，支持 AI 生成和编辑视频内容。",
    status: "current",
  },
  {
    dateEn: "2026",
    dateZh: "2026 年",
    titleEn: "Venice V2",
    titleZh: "Venice V2",
    descEn: "Next-generation platform architecture with stronger privacy protection, more model support, and lower latency.",
    descZh: "下一代平台架构，更强的隐私保护、更多模型支持、更低延迟。",
    status: "upcoming",
  },
  {
    dateEn: "Q3 2026",
    dateZh: "2026 年 Q3",
    titleEn: "VVVeco Launch",
    titleZh: "VVVeco 上线",
    descEn: "Launched VVVeco staking platform with dual modes (Coin/Fiat-based), V1-V8 team system, and referral mechanism.",
    descZh: "推出 VVVeco 质押平台，双模式（币本位/金本位）、V1-V8 团队体系、邀请裂变机制。",
    status: "upcoming",
  },
]

export function Timeline() {
  const { t } = useLanguage()

  return (
    <section id="timeline" className="py-24 px-4 bg-secondary/30">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">{t("Roadmap", "发展历程")}</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-medium text-foreground mt-4 mb-6 text-balance">
            {t("VVV Development Milestones", "VVV 发展里程碑")}
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
            {t(
              "From platform launch in 2024 to the future V2 architecture, Venice AI is rapidly growing into a leading privacy AI infrastructure.",
              "从 2024 年平台上线到未来的 V2 架构，Venice AI 正在快速成长为领先的隐私 AI 基础设施。"
            )}
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-px" />

          <div className="space-y-8">
            {milestones.map((milestone, index) => (
              <div
                key={milestone.titleEn}
                className={`relative flex items-start gap-6 ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                <div className={`flex-1 ml-12 md:ml-0 ${index % 2 === 0 ? 'md:text-right md:pr-12' : 'md:pl-12'}`}>
                  <div
                    className={`bg-card rounded-xl p-6 border ${
                      milestone.status === 'current'
                        ? 'border-primary'
                        : milestone.status === 'upcoming'
                        ? 'border-dashed border-border'
                        : 'border-border'
                    }`}
                  >
                    <div className="text-sm text-primary font-medium mb-2">{t(milestone.dateEn, milestone.dateZh)}</div>
                    <h3 className="font-serif text-lg font-medium text-foreground mb-2">
                      {t(milestone.titleEn, milestone.titleZh)}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t(milestone.descEn, milestone.descZh)}
                    </p>
                  </div>
                </div>

                <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-card border-2 border-primary z-10">
                  {milestone.status === 'current' && (
                    <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-50" />
                  )}
                </div>

                <div className="hidden md:block flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
