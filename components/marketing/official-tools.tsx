"use client"

import { useLanguage } from "./language-provider"
import Link from "next/link"
import { ArrowUpRight, MessageSquare, Image, Bot, Globe, Download, FileText } from "lucide-react"

const tools = [
  {
    icon: MessageSquare,
    title: { en: "Venice Chat", zh: "Venice 对话" },
    desc: { 
      en: "AI chat with leading models. Private, uncensored, unlimited.", 
      zh: "与顶级模型进行 AI 对话。私密、无审查、无限制。" 
    },
    href: "https://venice.ai/chat",
    cta: { en: "Start Chatting", zh: "开始对话" }
  },
  {
    icon: Image,
    title: { en: "Image Studio", zh: "图像工作室" },
    desc: { 
      en: "Generate, edit, and upscale images with AI. 1000+ images per day.", 
      zh: "使用 AI 生成、编辑和放大图像。每天 1000+ 张图片。" 
    },
    href: "https://venice.ai/image",
    cta: { en: "Create Images", zh: "创建图像" }
  },
  {
    icon: Bot,
    title: { en: "AI Agents", zh: "AI 代理" },
    desc: { 
      en: "Build and deploy custom AI agents for your specific needs.", 
      zh: "为您的特定需求构建和部署自定义 AI 代理。" 
    },
    href: "https://venice.ai/agents",
    cta: { en: "Build Agents", zh: "构建代理" }
  },
  {
    icon: Globe,
    title: { en: "Web Search", zh: "网页搜索" },
    desc: { 
      en: "AI-powered web search with real-time, accurate results.", 
      zh: "AI 驱动的网页搜索，实时、准确的结果。" 
    },
    href: "https://venice.ai/search",
    cta: { en: "Search Web", zh: "搜索网页" }
  },
  {
    icon: Download,
    title: { en: "Desktop App", zh: "桌面应用" },
    desc: { 
      en: "Native apps for macOS, Windows, and Linux. Fast, secure, offline-capable.", 
      zh: "适用于 macOS、Windows 和 Linux 的原生应用。快速、安全、支持离线。" 
    },
    href: "https://venice.ai/download",
    cta: { en: "Download", zh: "下载" }
  },
  {
    icon: FileText,
    title: { en: "API Access", zh: "API 访问" },
    desc: { 
      en: "Industry-standard API for developers. OpenAI compatible.", 
      zh: "面向开发者的行业标准 API。兼容 OpenAI。" 
    },
    href: "https://docs.venice.ai",
    cta: { en: "View Docs", zh: "查看文档" }
  }
]

export function OfficialTools() {
  const { t } = useLanguage()

  return (
    <section id="tools" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm text-primary font-medium tracking-wide uppercase mb-4 text-center">
          {t("Official Tools", "官方工具")}
        </p>
        <h2 className="font-serif text-3xl md:text-4xl text-foreground text-center mb-4 text-balance">
          {t("Venice AI Product Suite", "Venice AI 产品套件")}
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
          {t(
            "Complete suite of AI tools for every need. All private, all uncensored.",
            "满足各种需求的完整 AI 工具套件。全部私密，全部无审查。"
          )}
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, i) => (
            <Link
              key={i}
              href={tool.href}
              target="_blank"
              className="group bg-card rounded-2xl p-6 border border-border hover:border-primary/30 hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <tool.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-serif text-lg text-foreground mb-2">
                {t(tool.title.en, tool.title.zh)}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {t(tool.desc.en, tool.desc.zh)}
              </p>
              <span className="inline-flex items-center gap-1 text-sm text-primary font-medium group-hover:gap-2 transition-all">
                {t(tool.cta.en, tool.cta.zh)}
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
