# VVVEco Media Kit v1.0

**品牌**：VVVEco — Community Growth Layer of Venice AI  
**版本**：1.0 · 2026年6月  
**色系**：Venice Navy `#143c62` · Cream `#f5f1ea` · Gold `#bd6700`

---

## 文件索引 / File Index

### 📝 文案 & 策略

| 文件 | 内容 |
|------|------|
| [poster-copy.md](./poster-copy.md) | 10张官网级宣传海报文案（中英双语） |
| [video-scripts.md](./video-scripts.md) | 3个宣传视频完整分镜脚本 |
| [brand-guide.md](./brand-guide.md) | 品牌规范手册（色彩·字体·Logo·声音·视觉） |

### 🎨 视觉资产

| 文件 | 尺寸 | 用途 |
|------|------|------|
| [assets/twitter-header-1500x500.svg](./assets/twitter-header-1500x500.svg) | 1500×500 | Twitter / X 个人主页 Header |
| [assets/telegram-cover-1280x720.svg](./assets/telegram-cover-1280x720.svg) | 1280×720 | Telegram 群组封面图 |
| [assets/discord-cover-960x540.svg](./assets/discord-cover-960x540.svg) | 960×540 | Discord 服务器 Banner |
| [assets/social-banner-1200x628.svg](./assets/social-banner-1200x628.svg) | 1200×628 | 社交媒体通用 Banner / OG Image |

---

## 快速使用指南

### SVG → PNG 导出

```bash
# 使用 Inkscape CLI（推荐）
inkscape --export-type=png --export-dpi=144 assets/twitter-header-1500x500.svg

# 使用 rsvg-convert
rsvg-convert -w 1500 -h 500 assets/twitter-header-1500x500.svg -o twitter-header.png

# 使用 Chrome/Figma 打开 SVG 后截图导出
```

### 各平台上传规格

| 平台 | 文件 | 格式要求 |
|------|------|----------|
| Twitter Header | twitter-header-1500x500 | PNG/JPG，≤5MB |
| Telegram Group | telegram-cover-1280x720 | JPG/PNG，≤10MB |
| Discord Banner | discord-cover-960x540 | PNG/JPG/GIF |
| Open Graph | social-banner-1200x628 | JPG/PNG，<8MB |

---

## 品牌色速查

```
Venice Navy   #143c62   深色主背景
Deep Navy     #0c1e33   更深背景层
Cream         #f5f1ea   主文字 / 浅色背景
Gold          #bd6700   高亮 / CTA / 强调
Gold Hover    #a85c00   按钮 hover 态
Muted Text    rgba(245,241,234,0.6)   副文本
Border        rgba(245,241,234,0.1)   分隔线
```

---

*VVVEco · vvveco.io · Built on Base · Powered by VVV · Driven by Community*
