"use client"

import { ArrowRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from './language-provider'
import { formatInteger, formatUsdCompact, useGlobalStats } from '@/lib/global-stats'

export function Hero() {
  const { t } = useLanguage()
  const { computed } = useGlobalStats()
  const contractAddress = "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf"

  const copyAddress = () => {
    navigator.clipboard.writeText(contractAddress)
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-24 pb-16 px-4 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          {t("Base Chain Native Token", "Base 链原生代币")}
        </div>

        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium text-foreground leading-tight mb-6 text-balance">
          {t("Stake VVV", "质押 VVV")}
          <br />
          <span className="text-primary">{t("Start Your Yield Journey", "开启收益之旅")}</span>
        </h1>

        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 text-pretty leading-relaxed">
          {t(
            "VVVeco is the decentralized staking platform of Venice AI ecosystem. Choose your staking mode and period, enjoy up to 1% daily yield, build your team matrix, unlock V8 level 80% commission.",
            "VVVeco 是 Venice AI 生态的去中心化质押平台。选择质押模式和周期，享受高达 1% 日收益率，建立你的团队矩阵，解锁 V8 等级 80% 返佣。"
          )}
        </p>

        <div className="flex items-center justify-center gap-2 mb-10">
          <button
            onClick={copyAddress}
            className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <span className="font-mono text-xs sm:text-sm">
              {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
            </span>
            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">{t("Copy", "复制")}</span>
          </button>
          <Link
            href={`https://basescan.org/token/${contractAddress}`}
            target="_blank"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="View on BaseScan"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/stake"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-full text-base font-medium hover:bg-primary/90 transition-colors"
          >
            {t("Start Staking", "立即质押")}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="https://venice.ai"
            target="_blank"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-secondary text-foreground px-8 py-4 rounded-full text-base font-medium hover:bg-secondary/80 transition-colors"
          >
            {t("Visit Venice.ai", "访问官网")}
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-8 sm:gap-16 md:gap-20 mt-16 pt-12 border-t border-border max-w-3xl mx-auto">
          <div className="text-center">
            <div className="font-serif text-xl sm:text-2xl md:text-3xl font-medium text-foreground whitespace-nowrap">{formatUsdCompact(computed.displayStakedUsd)}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1">{t("Total Staked", "全球质押金额")}</div>
          </div>
          <div className="text-center">
            <div className="font-serif text-xl sm:text-2xl md:text-3xl font-medium text-foreground whitespace-nowrap">{formatUsdCompact(computed.displayClaimedUsd)}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1">{t("Claimed", "全球领取金额")}</div>
          </div>
          <div className="text-center">
            <div className="font-serif text-xl sm:text-2xl md:text-3xl font-medium text-foreground whitespace-nowrap">{formatInteger(computed.displayStakers)}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1">{t("Stakers", "全球质押地址")}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
