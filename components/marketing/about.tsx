"use client"

import { Shield, Zap, Globe, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLanguage } from './language-provider'
import { formatInteger, formatUsdFull } from '@/lib/global-stats'
import { useGlobalStatsContext } from '@/contexts/global-stats-context'
import { useRewardConfig } from '@/lib/reward-config'

export function About() {
  const { t } = useLanguage()
  const { computed, isLoading } = useGlobalStatsContext()
  const { config: rewardConfig } = useRewardConfig()
  const [minStakeUsd, setMinStakeUsd] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/admin/chain-params')
      .then(r => r.ok ? r.json() : null)
      .then(d => setMinStakeUsd(d?.minStakeUsd ? Math.round(Number(d.minStakeUsd)) : 10))
      .catch(() => setMinStakeUsd(10))
  }, [])

  return (
    <section id="about" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">{t("About VVVeco", "关于 VVVeco")}</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-medium text-foreground mt-4 mb-6 text-balance">
            {t("Venice AI Ecosystem Staking Platform", "Venice AI 生态质押平台")}
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
            {t(
              "VVVeco is the decentralized staking protocol built on Venice AI ecosystem, offering flexible staking modes, generous yield returns, and team referral mechanisms.",
              "VVVeco 是基于 Venice AI 生态的去中心化质押协议，提供灵活的质押模式、丰厚的收益回报和团队裂变机制。"
            )}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
          <div>
            <h3 className="font-serif text-2xl sm:text-3xl font-medium text-foreground mb-6">
              {t("Why Choose VVVeco?", "为什么选择 VVVeco?")}
            </h3>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">{t("Flexible Staking", "灵活质押")}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t(
                      "Coin-based and Fiat-based dual modes, 7-60 day flexible periods, up to 1% daily yield, real-time earnings.",
                      "币本位与金本位双模式可选，7-60 天灵活周期，最高可达 1% 日收益率，收益实时到账。"
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">{t("Secure & Transparent", "安全透明")}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t(
                      "Built on Base chain smart contracts, all transactions on-chain verifiable, principal fully unlocked at maturity, 0 fee withdrawal.",
                      "基于 Base 链智能合约，所有交易链上可查，本金到期全额解锁，0 手续费提取。"
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">{t("Team Growth", "团队裂变")}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t(
                      `V1-V8 eight-level system, compressed 7-tier team performance calculation, plus ${rewardConfig.generationRates[0]}% / ${rewardConfig.generationRates[1]}% / ${rewardConfig.generationRates[2]}% invitation rewards for three downstream generations.`,
                      `V1-V8 八级等级体系，紧缩制 7 层内团队业绩计算，并叠加三代邀请奖励：一代 ${rewardConfig.generationRates[0]}%、二代 ${rewardConfig.generationRates[1]}%、三代 ${rewardConfig.generationRates[2]}%。`
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">{t("Ecosystem Integration", "生态联动")}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t(
                      "Deep integration with Venice AI ecosystem, official Agent, Chat, Studio tools included, full AI service experience.",
                      "深度整合 Venice AI 生态，官方 Agent、Chat、Studio 等工具一应俱全，享受完整 AI 服务。"
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-secondary/50 rounded-2xl p-8 border border-border">
            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-4">{t("VVVeco Platform Stats", "平台数据")}</div>
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground">{t("Total Staked", "全球质押金额")}</span>
                {isLoading ? <div className="h-5 w-24 rounded bg-muted animate-pulse" /> : <span className="font-medium text-foreground">{formatUsdFull(computed.displayStakedUsd)}</span>}
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground">{t("Total Claimed", "全球领取金额")}</span>
                {isLoading ? <div className="h-5 w-24 rounded bg-muted animate-pulse" /> : <span className="font-medium text-foreground">{formatUsdFull(computed.displayClaimedUsd)}</span>}
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground">{t("Staking Addresses", "全球质押地址")}</span>
                {isLoading ? <div className="h-5 w-16 rounded bg-muted animate-pulse" /> : <span className="font-medium text-foreground">{formatInteger(computed.displayStakers)}</span>}
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground">{t("Max Daily Rate", "最高日收益率")}</span>
                <span className="font-medium text-foreground">1%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("Min Stake", "最低质押门槛")}</span>
                {minStakeUsd === null ? <div className="h-5 w-12 rounded bg-muted animate-pulse" /> : <span className="font-medium text-foreground">${minStakeUsd}</span>}
              </div>
            </div>
            <Link
              href="/stake"
              className="mt-8 block w-full text-center bg-primary text-white py-3 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {t("Enter Staking Hall", "进入质押大厅")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
