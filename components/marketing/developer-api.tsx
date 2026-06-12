"use client"

import { useLanguage } from "./language-provider"
import Link from "next/link"
import { ArrowUpRight, Code, FileCode, BookOpen, Zap } from "lucide-react"

export function DeveloperAPI() {
  const { t } = useLanguage()

  return (
    <section id="api" className="py-24 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm text-primary font-medium tracking-wide uppercase mb-4 text-center">
          {t("Developer API", "开发者 API")}
        </p>
        <h2 className="font-serif text-3xl md:text-4xl text-foreground text-center mb-4 text-balance">
          {t("One API for Everything", "一个 API，满足所有需求")}
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
          {t(
            "Text, images, video, music, speech, embeddings, and web tools through a single industry-standard API. One key. Zero data retention.",
            "文本、图像、视频、音乐、语音、嵌入和网页工具，通过单一行业标准 API 访问。一个密钥，零数据保留。"
          )}
        </p>

        {/* Code Example */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="bg-[#1e293b] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <FileCode className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/60">chat.ts</span>
              <div className="ml-auto flex gap-2">
                <button className="px-3 py-1 text-xs bg-primary/20 text-primary rounded-full">Text</button>
                <button className="px-3 py-1 text-xs bg-white/10 text-white/60 rounded-full hover:bg-white/20 transition-colors">Image</button>
                <button className="px-3 py-1 text-xs bg-white/10 text-white/60 rounded-full hover:bg-white/20 transition-colors">Video</button>
                <button className="px-3 py-1 text-xs bg-white/10 text-white/60 rounded-full hover:bg-white/20 transition-colors">Music</button>
              </div>
            </div>
            <pre className="p-6 text-sm text-white/90 overflow-x-auto">
              <code>{`import Venice from "venice-ai";

const venice = new Venice({ apiKey: "your-api-key" });

const response = await venice.chat.completions.create({
  model: "llama-3.3-70b",
  messages: [
    { role: "user", content: "Hello, Venice!" }
  ],
  stream: true
});

for await (const chunk of response) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}`}</code>
            </pre>
          </div>
        </div>

        {/* API Features */}
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Code className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-medium text-foreground mb-1">{t("OpenAI Compatible", "兼容 OpenAI")}</h3>
            <p className="text-sm text-muted-foreground">{t("Drop-in replacement", "即插即用替换")}</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-medium text-foreground mb-1">{t("Fast & Reliable", "快速可靠")}</h3>
            <p className="text-sm text-muted-foreground">{t("99.9% uptime SLA", "99.9% 正常运行时间")}</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-medium text-foreground mb-1">{t("Full Documentation", "完整文档")}</h3>
            <p className="text-sm text-muted-foreground">{t("Guides & examples", "指南和示例")}</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <FileCode className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-medium text-foreground mb-1">{t("SDKs Available", "提供 SDK")}</h3>
            <p className="text-sm text-muted-foreground">{t("Python, JS, Go", "Python、JS、Go")}</p>
          </div>
        </div>

        <div className="text-center mt-12">
          <Link
            href="https://docs.venice.ai"
            target="_blank"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-primary/90 transition-colors"
          >
            {t("Explore API Docs", "探索 API 文档")}
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
