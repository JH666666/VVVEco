"use client"

import { ArrowRight, Coins, DollarSign, Clock, Users, Shield, Gift, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useLanguage } from './language-provider'
import { useRewardConfig } from '@/lib/reward-config'

function formatLevelThreshold(value: number) {
  if (value >= 1000000) return `>$${value / 1000000}M`
  if (value >= 1000) return `>$${value / 1000}K`
  return `>$${value}`
}

export function Staking() {
  const { t } = useLanguage()
  const { config: rewardConfig } = useRewardConfig()
  const [minStakeUsd] = useState<number>(100)

  const periods = rewardConfig.periodDurations.map((days, i) => {
    const rate = rewardConfig.periodRates[i]
    const unit = rewardConfig.periodUnits[i]
    const durationDays = unit === 'hour' ? days / 24 : days
    const totalPct = (durationDays * rate).toFixed(1)
    return {
      days,
      unit,
      rate: `${rate}%`,
      total: `+${totalPct}%`,
    }
  })

  const levels = [
    { level: 'V1', rate: `${rewardConfig.levelRates[0]}%`, threshold: formatLevelThreshold(rewardConfig.levelThresholds[0]) },
    { level: 'V2', rate: `${rewardConfig.levelRates[1]}%`, threshold: formatLevelThreshold(rewardConfig.levelThresholds[1]) },
    { level: 'V3', rate: `${rewardConfig.levelRates[2]}%`, threshold: formatLevelThreshold(rewardConfig.levelThresholds[2]) },
    { level: 'V4', rate: `${rewardConfig.levelRates[3]}%`, threshold: formatLevelThreshold(rewardConfig.levelThresholds[3]) },
    { level: 'V5', rate: `${rewardConfig.levelRates[4]}%`, threshold: formatLevelThreshold(rewardConfig.levelThresholds[4]) },
    { level: 'V6', rate: `${rewardConfig.levelRates[5]}%`, threshold: formatLevelThreshold(rewardConfig.levelThresholds[5]) },
    { level: 'V7', rate: `${rewardConfig.levelRates[6]}%`, threshold: formatLevelThreshold(rewardConfig.levelThresholds[6]) },
    { level: 'V8', rate: `${rewardConfig.levelRates[7]}%`, threshold: formatLevelThreshold(rewardConfig.levelThresholds[7]) },
  ]

  return (
    <section id="staking" className="py-24 px-4 bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">{t("Staking Mechanism", "质押机制")}</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-medium text-foreground mt-4 mb-6 text-balance">
            {t("VVVeco Staking", "VVVeco 质押玩法")}
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
            {t(
              "Choose your staking mode and period to start your yield journey. Earnings are generated in real-time, 10% fee on reward claims.",
              "选择质押模式和周期，开启您的收益之旅。收益实时产生，领取收益扣 10% 手续费。"
            )}
          </p>
        </div>

        {/* Two modes */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <div className="bg-card rounded-2xl p-8 border-2 border-primary relative">
            <div className="absolute -top-3 left-8 bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">
              {t("Recommended", "推荐")}
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Coins className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-serif text-2xl font-medium text-foreground mb-4">{t("Coin-Based Mode", "币本位模式")}</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              {t(
                "Earnings calculated based on VVV token quantity. Pursue compound returns from both token accumulation and price appreciation. Ideal for long-term VVV believers.",
                "以 VVV 代币数量为基数计算收益，追求币量增加 + 币价上涨的复利效应。适合看好 VVV 长期价值的用户。"
              )}
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3 text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{t("Rewards in VVV", "收益以 VVV 代币结算")}</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{t("Double gains from price rise", "享受币价上涨双重收益")}</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{t("Better compounding effect", "复投效果更佳")}</span>
              </li>
            </ul>
          </div>

          <div className="bg-card rounded-2xl p-8 border border-border">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-6">
              <DollarSign className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-serif text-2xl font-medium text-foreground mb-4">{t("Fiat-Based Mode", "金本位模式")}</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              {t(
                "USD-denominated returns with built-in downside protection. Lock in fixed USD earnings with price cushion mechanism. Ideal for conservative investors seeking stable returns.",
                "以美金价值为基数，锁定固定美金收益，自带防跌气垫保护。适合追求稳定收益的保守型用户。"
              )}
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3 text-muted-foreground">
                <Shield className="w-4 h-4 text-accent flex-shrink-0" />
                <span>{t("USD-locked rewards", "收益以 USD 价值锁定")}</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <Shield className="w-4 h-4 text-accent flex-shrink-0" />
                <span>{t("Price cushion protection", "防跌气垫保护机制")}</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <Shield className="w-4 h-4 text-accent flex-shrink-0" />
                <span>{t("Predictable stable returns", "收益稳定可预期")}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Staking periods */}
        <div className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-serif text-xl font-medium text-foreground">{t("Choose Staking Period", "选择质押周期")}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {periods.map((period) => (
              <div
                key={period.days}
                className="bg-card rounded-xl p-6 border border-border text-center hover:border-primary transition-colors"
              >
                <div className="font-serif text-4xl font-medium text-foreground">{period.days}</div>
                <div className="text-sm text-muted-foreground mb-4">{t("Days", "天")}</div>
                <div className="text-lg font-medium text-primary">{period.rate}</div>
                <div className="text-xs text-muted-foreground mb-2">{t("Daily Rate", "日收益率")}</div>
                <div className="text-sm font-medium text-accent">{period.total}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            {t(`Min $${minStakeUsd} | Principal unlocked at maturity, 0 fee withdrawal`, `最低质押 $${minStakeUsd} | 本金到期解锁，全额提取 0 手续费`)}
          </p>
        </div>

        {/* Team system */}
        <div className="bg-card rounded-2xl p-8 md:p-12 border border-border mb-16">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-serif text-xl font-medium text-foreground">{t("V1-V8 Level System", "V1-V8 等级体系")}</h3>
          </div>
          <p className="text-muted-foreground mb-8">
            {t(
              "Compressed-tier system — auto-upgrade when team performance reaches threshold, higher level means higher reward ratio. Invitation rewards are settled separately from team performance.",
              "根据层数紧缩制，团队总业绩达标自动升级，等级越高奖励比例越高。邀请奖励独立结算，不参与团队业绩考核。"
            )}
          </p>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {levels.map((item, index) => (
              <div
                key={item.level}
                className={`rounded-xl p-4 text-center ${
                  index < 4 ? 'bg-secondary' : 'bg-primary/10'
                }`}
              >
                <div className={`text-lg font-medium ${index >= 4 ? 'text-primary' : 'text-foreground'}`}>
                  {item.level}
                </div>
                <div className="text-xl font-serif font-medium text-foreground mt-1">{item.rate}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.threshold}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Invite system */}
        <div className="bg-primary rounded-2xl p-8 md:p-12 text-white">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wider">{t("Referral System", "邀请机制")}</span>
              </div>
              <h3 className="font-serif text-2xl md:text-3xl font-medium mb-4">
                {t("Share Your Invite Code, Grow Your Team", "分享邀请码，邀请好友加入")}
              </h3>
              <p className="text-white/80 leading-relaxed mb-6">
                {t(
                  `Every user has a unique invite code. Downstream claims within three generations generate invitation rewards: ${rewardConfig.generationRates[0]}% for first generation, ${rewardConfig.generationRates[1]}% for second, and ${rewardConfig.generationRates[2]}% for third.`,
                  `每位用户都有专属邀请码。三代内成员领取质押收益时，会产生邀请奖励：一代 ${rewardConfig.generationRates[0]}%，二代 ${rewardConfig.generationRates[1]}%，三代 ${rewardConfig.generationRates[2]}%。`
                )}
              </p>
              <Link
                href="/stake"
                className="inline-flex items-center gap-2 bg-white text-primary px-6 py-3 rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
              >
                {t("Start Staking", "立即开始质押")}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-xl p-6 text-center">
                <div className="text-3xl md:text-4xl font-serif font-medium">10%</div>
                <div className="text-sm text-white/70 mt-1">{t("Peer Bonus", "平级奖励")}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-6 text-center">
                <div className="text-3xl md:text-4xl font-serif font-medium">{rewardConfig.levelRates[7]}%</div>
                <div className="text-sm text-white/70 mt-1">{t("V8 Max Commission", "V8 最高返佣")}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-6 text-center">
                <div className="text-3xl md:text-4xl font-serif font-medium">{t("Tiered", "代数")}</div>
                <div className="text-sm text-white/70 mt-1">{t("Compression System", "紧缩制")}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-6 text-center">
                <div className="text-3xl md:text-4xl font-serif font-medium">{t("Rank", "等级")}</div>
                <div className="text-sm text-white/70 mt-1">{t("Cumulative System", "累加制")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
