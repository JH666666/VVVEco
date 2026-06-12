"use client"

import { useLanguage } from "./language-provider"
import Link from "next/link"
import { ArrowUpRight, Shield, Eye, Lock, Key } from "lucide-react"

const privacyTiers = [
  {
    tier: "TIER 1",
    icon: Eye,
    title: { en: "Anonymized", zh: "匿名化" },
    desc: { 
      en: "Access premier third-party models. All identifying metadata is stripped before processing.", 
      zh: "访问顶级第三方模型。所有识别元数据在处理前都会被移除。" 
    }
  },
  {
    tier: "TIER 2",
    icon: Shield,
    title: { en: "Private", zh: "私密" },
    desc: { 
      en: "Zero data retention on self-hosted open-source models. Your prompts are never stored.", 
      zh: "自托管开源模型零数据保留。您的提示永远不会被存储。" 
    }
  },
  {
    tier: "TIER 3",
    icon: Lock,
    title: { en: "TEE (Trusted Execution)", zh: "TEE（可信执行）" },
    desc: { 
      en: "Hardware-secured enclaves ensure Venice itself cannot access your computation.", 
      zh: "硬件安全飞地确保 Venice 本身无法访问您的计算。" 
    }
  },
  {
    tier: "TIER 4",
    icon: Key,
    title: { en: "End-to-End Encrypted", zh: "端到端加密" },
    desc: { 
      en: "Client-side encryption. Your prompts are encrypted before leaving your device. Only TEE decrypts.", 
      zh: "客户端加密。您的提示在离开设备前就已加密。只有 TEE 可以解密。" 
    }
  }
]

export function Privacy() {
  const { t } = useLanguage()

  return (
    <section id="privacy" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm text-primary font-medium tracking-wide uppercase mb-4 text-center">
          {t("Privacy Architecture", "隐私架构")}
        </p>
        <h2 className="font-serif text-3xl md:text-4xl text-foreground text-center mb-4 text-balance">
          {t("AI That Respects Your Privacy", "尊重您隐私的 AI")}
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
          {t(
            "While others log and analyze your prompts, Venice ensures your conversations remain yours alone.",
            "当其他人记录和分析您的提示时，Venice 确保您的对话仅属于您自己。"
          )}
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {privacyTiers.map((tier, i) => (
            <div 
              key={i}
              className="bg-card rounded-2xl p-6 border border-border hover:border-primary/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <tier.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-primary font-medium tracking-wide mb-2">{tier.tier}</p>
              <h3 className="font-serif text-lg text-foreground mb-2">
                {t(tier.title.en, tier.title.zh)}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(tier.desc.en, tier.desc.zh)}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="https://venice.ai/privacy"
            target="_blank"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
          >
            {t("Learn More About Privacy", "了解更多隐私信息")}
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
