"use client"

import { useLanguage } from "./language-provider"
import Link from "next/link"
import { ArrowUpRight, MessageSquare, Image, Video, Music, Code, Search } from "lucide-react"

const models = [
  "Claude",
  "Google",
  "DeepSeek",
  "OpenAI",
  "Mistral",
  "Meta",
  "Qwen",
  "Grok",
  "Kimi",
  "Black Forest Labs",
  "NVIDIA",
  "ElevenLabs",
  "Runway",
  "Bytedance",
  "MiniMax",
  "GLM",
  "Gemma",
  "Kling",
  "PixVerse",
  "Vidu"
]

const capabilities = [
  {
    icon: MessageSquare,
    title: { en: "Text Generation", zh: "文本生成" },
    desc: { en: "Chat, reason, write, and build with powerful open-source language models. Uncensored and private.", zh: "使用强大的开源语言模型进行对话、推理、写作和构建。无审查、完全隐私。" },
  },
  {
    icon: Image,
    title: { en: "Image Generation", zh: "图像生成" },
    desc: { en: "Create stunning visuals with leading image models. From photorealistic to artistic styles.", zh: "使用领先的图像模型创建惊艳的视觉效果。从照片级真实到艺术风格。" },
  },
  {
    icon: Video,
    title: { en: "Video Generation", zh: "视频生成" },
    desc: { en: "Generate videos from text or images. Create content that moves and engages.", zh: "从文本或图像生成视频。创建引人入胜的动态内容。" },
  },
  {
    icon: Music,
    title: { en: "Audio & Music", zh: "音频与音乐" },
    desc: { en: "Generate music, speech, and sound effects. Voice cloning and text-to-speech available.", zh: "生成音乐、语音和音效。支持声音克隆和文本转语音。" },
  },
  {
    icon: Code,
    title: { en: "Code Assistant", zh: "代码助手" },
    desc: { en: "Write, debug, and explain code in any programming language. Build faster with AI.", zh: "使用任何编程语言编写、调试和解释代码。借助 AI 更快构建。" },
  },
  {
    icon: Search,
    title: { en: "Web Search", zh: "网页搜索" },
    desc: { en: "Search the web with AI-powered results. Get accurate, up-to-date information.", zh: "使用 AI 驱动的搜索获取网页结果。获得准确、最新的信息。" },
  }
]

export function AIModels() {
  const { t } = useLanguage()

  return (
    <section id="models" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm text-primary font-medium tracking-wide uppercase mb-4 text-center">
          Venice AI
        </p>
        <h2 className="font-serif text-3xl md:text-4xl text-foreground text-center mb-4 text-balance">
          {t("Access Leading AI Models with Privacy", "隐私优先的顶级 AI 模型")}
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
          {t(
            "Create text, image, video, code, build agents, and more using fully private or anonymized models from leading AI providers.",
            "使用来自领先 AI 提供商的完全私密或匿名模型，创建文本、图像、视频、代码、构建代理等。"
          )}
        </p>

        {/* Model Marquee - Non-clickable */}
        <div className="relative overflow-hidden mb-16">
          <div className="flex gap-8 animate-marquee">
            {[...models, ...models].map((model, i) => (
              <span 
                key={i}
                className="text-muted-foreground/60 whitespace-nowrap text-sm font-medium"
              >
                {model}
              </span>
            ))}
          </div>
        </div>

        {/* Capabilities Grid - Non-clickable Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap, i) => (
            <div 
              key={i}
              className="bg-card rounded-2xl p-6 border border-border"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <cap.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-serif text-lg text-foreground mb-2">
                {t(cap.title.en, cap.title.zh)}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(cap.desc.en, cap.desc.zh)}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            href="https://venice.ai"
            target="_blank"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
          >
            {t("Try Venice AI Free", "免费试用 Venice AI")}
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
