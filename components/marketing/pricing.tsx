"use client"

import { useLanguage } from "./language-provider"
import Link from "next/link"
import { Check, ArrowUpRight } from "lucide-react"

const plans = [
  {
    name: "Pro",
    price: "18",
    popular: false,
    desc: { en: "Full access to all AI models and features", zh: "完整访问所有 AI 模型和功能" },
    features: {
      en: [
        "All AI models (Pro & Advanced)",
        "Unlimited text prompts",
        "1,000 images per day",
        "$10 in credits per month",
        "Hi-res upscaling & watermark removal",
        "Character creation",
        "API access"
      ],
      zh: [
        "所有 AI 模型（Pro 和 Advanced）",
        "无限文本提示",
        "每天 1,000 张图片",
        "每月 $10 积分",
        "高清放大和水印移除",
        "角色创建",
        "API 访问"
      ]
    },
    cta: { en: "GET PRO", zh: "获取 Pro" },
    href: "https://venice.ai/pricing"
  },
  {
    name: "Pro+",
    price: "68",
    popular: true,
    desc: { en: "Everything in Pro, plus massive credit allocation", zh: "Pro 的所有功能，外加大量积分" },
    features: {
      en: [
        "Everything in Pro",
        "$75 in credits per month",
        "10% credit bonus vs. retail",
        "2-month credit banking",
        "Video generation via credits",
        "Higher API limits"
      ],
      zh: [
        "Pro 的所有功能",
        "每月 $75 积分",
        "比零售价多 10% 积分",
        "2 个月积分累计",
        "视频生成（使用积分）",
        "更高的 API 限制"
      ]
    },
    cta: { en: "GET PRO+", zh: "获取 Pro+" },
    href: "https://venice.ai/pricing"
  },
  {
    name: "Max",
    price: "200",
    popular: false,
    desc: { en: "Maximum power for creators and enterprises", zh: "为创作者和企业提供最大能力" },
    features: {
      en: [
        "Everything in Pro+",
        "$225 in credits per month",
        "12.5% credit bonus vs. retail",
        "3-month credit banking",
        "Highest API limits",
        "Priority support"
      ],
      zh: [
        "Pro+ 的所有功能",
        "每月 $225 积分",
        "比零售价多 12.5% 积分",
        "3 个月积分累计",
        "最高 API 限制",
        "优先支持"
      ]
    },
    cta: { en: "GET MAX", zh: "获取 Max" },
    href: "https://venice.ai/pricing"
  }
]

export function Pricing() {
  const { t, lang } = useLanguage()

  return (
    <section id="pricing" className="py-24 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm text-primary font-medium tracking-wide uppercase mb-4 text-center">
          {t("Pricing", "订阅价格")}
        </p>
        <h2 className="font-serif text-3xl md:text-4xl text-foreground text-center mb-4 text-balance">
          {t("Simple Pricing. No Surprises.", "简单定价，无隐藏费用")}
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-4">
          {t(
            "Start free, upgrade when you're ready. Every tier includes uncensored models and full privacy.",
            "免费开始，准备好后再升级。每个套餐都包含无审查模型和完全隐私保护。"
          )}
        </p>
        <p className="text-sm text-accent text-center mb-12">
          {t("Save 10% on annual subscriptions", "年付订阅节省 10%")}
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <div 
              key={i}
              className={`bg-card rounded-2xl p-6 border ${
                plan.popular 
                  ? "border-primary shadow-lg relative" 
                  : "border-border"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">
                  {t("MOST POPULAR", "最受欢迎")}
                </span>
              )}
              
              <h3 className="font-serif text-xl text-foreground mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-serif font-medium text-foreground">${plan.price}</span>
                <span className="text-muted-foreground text-sm">/{t("mo", "月")}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                {t(plan.desc.en, plan.desc.zh)}
              </p>

              <Link
                href={plan.href}
                target="_blank"
                className={`block w-full text-center py-3 rounded-full font-medium text-sm transition-colors mb-6 ${
                  plan.popular
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                {t(plan.cta.en, plan.cta.zh)}
              </Link>

              <ul className="space-y-3">
                {(lang === "en" ? plan.features.en : plan.features.zh).map((feature, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="https://venice.ai"
            target="_blank"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-primary/90 transition-colors"
          >
            {t("Try Free Today", "立即免费试用")}
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
