"use client"

import Link from 'next/link'
import { useLanguage } from './language-provider'
import { OfficialLogo } from '@/components/brand/official-logo'

export function Footer() {
  const { t } = useLanguage()
  const contractAddress = "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf"

  const footerLinks = {
    product: {
      titleEn: "Product",
      titleZh: "产品",
      links: [
        { nameEn: 'Venice Chat', nameZh: 'Venice Chat', href: 'https://venice.ai' },
        { nameEn: 'Image Generation', nameZh: '图像生成', href: 'https://venice.ai' },
        { nameEn: 'Video Creation', nameZh: '视频创作', href: 'https://venice.ai' },
        { nameEn: 'API Docs', nameZh: 'API 文档', href: 'https://venice.ai/docs' },
      ],
    },
    token: {
      titleEn: "Token",
      titleZh: "代币",
      links: [
        { nameEn: 'VVV Token', nameZh: 'VVV 代币', href: 'https://venice.ai/token' },
        { nameEn: 'Staking Mechanism', nameZh: '质押机制', href: '#staking' },
        { nameEn: 'Staking Guide', nameZh: '质押指南', href: '#staking' },
        { nameEn: 'Governance', nameZh: '治理', href: '#' },
      ],
    },
    resources: {
      titleEn: "Resources",
      titleZh: "资源",
      links: [
        { nameEn: 'Documentation', nameZh: '开发文档', href: 'https://venice.ai/docs' },
        { nameEn: 'FAQ', nameZh: '常见问题', href: '#' },
        { nameEn: 'Blog', nameZh: '博客', href: '#' },
        { nameEn: 'Changelog', nameZh: '更新日志', href: '#' },
      ],
    },
    community: {
      titleEn: "Community",
      titleZh: "社区",
      links: [
        { nameEn: 'Twitter', nameZh: 'Twitter', href: 'https://twitter.com/venicedotai' },
        { nameEn: 'Discord', nameZh: 'Discord', href: '#' },
        { nameEn: 'Telegram', nameZh: 'Telegram', href: '#' },
        { nameEn: 'About Us', nameZh: '关于我们', href: '#team' },
      ],
    },
  }

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <OfficialLogo size={35} themeAware />
              <span className="font-serif text-lg font-semibold text-foreground">VVVeco</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">
              {t(
                "VVVeco is the core staking protocol of Venice AI ecosystem, providing users with decentralized AI computing ownership.",
                "VVVeco 是 Venice AI 生态的核心质押协议，为用户提供去中心化的 AI 算力所有权。"
              )}
            </p>
            <div className="mt-4">
              <div className="text-xs text-muted-foreground mb-1">{t("Contract Address", "合约地址")}</div>
              <Link
                href={`https://basescan.org/token/${contractAddress}`}
                target="_blank"
                className="font-mono text-xs text-primary hover:underline"
              >
                {contractAddress.slice(0, 10)}...{contractAddress.slice(-8)}
              </Link>
            </div>
          </div>

          {Object.values(footerLinks).map((category) => (
            <div key={category.titleEn}>
              <h4 className="font-medium text-foreground text-sm">{t(category.titleEn, category.titleZh)}</h4>
              <ul className="mt-4 space-y-3">
                {category.links.map((link) => (
                  <li key={link.nameEn}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                    >
                      {t(link.nameEn, link.nameZh)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} VVVeco. {t("All rights reserved.", "保留所有权利。")}
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="https://twitter.com/venicedotai"
              target="_blank"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Twitter"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </Link>
            <Link
              href="https://venice.ai"
              target="_blank"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Venice.ai
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
