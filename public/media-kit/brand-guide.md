# VVVEco Brand Guide v1.0

**版本**：1.0  **日期**：2026年6月  **适用范围**：所有对外传播物料

---

## 01 · 品牌概述 / Brand Overview

### 品牌定位
VVVEco 是 Venice AI 生态的**社区增长层（Community Growth Layer）**。  
我们不是另一个 DeFi 协议，也不是另一个 AI 应用——  
我们是连接**隐私 AI 基础设施**与**全球社区**的桥梁。

### 品牌使命
> 推动全球社区增长，共建 Venice AI 生态。  
> Growing the Community Behind Venice AI.

### 品牌属性
| 属性 | 描述 |
|------|------|
| **机构级** | 用数据说话，不用情绪驱动 |
| **社区驱动** | 真实参与者，不是空洞叙事 |
| **隐私优先** | Venice AI 的架构哲学贯穿品牌 |
| **链上透明** | 所有协议行为可验证 |
| **长期主义** | 生态建设，不是短期炒作 |

---

## 02 · 色彩系统 / Color System

### 主色板 / Primary Palette

| 颜色名称 | Hex | RGB | 用途 |
|----------|-----|-----|------|
| **Venice Navy** | `#143c62` | 20, 60, 98 | 主背景色、品牌主色 |
| **Venice Cream** | `#f5f1ea` | 245, 241, 234 | 主文字色、浅色背景 |
| **Venice Gold** | `#bd6700` | 189, 103, 0 | 高亮、CTA、重点强调 |

### 深色变体 / Dark Variants（用于深色背景层叠）

| 颜色名称 | Hex | 用途 |
|----------|-----|------|
| Deep Navy | `#0c1e33` | 深色背景底层 |
| Dark Navy | `#0a1526` | 更深层背景 |
| Navy Mid | `#1a3a5c` | 卡片背景 |

### 功能色 / Functional Colors

| 用途 | Hex | 说明 |
|------|-----|------|
| 文字主色 | `#f5f1ea` | 深色背景上的正文 |
| 文字次级 | `rgba(245, 241, 234, 0.6)` | 副文本、说明文字 |
| 文字弱化 | `rgba(245, 241, 234, 0.35)` | 标签、元数据 |
| 边框线条 | `rgba(245, 241, 234, 0.1)` | 分隔线、卡片边框 |
| 黄金高亮 | `#bd6700` | 强调词、按钮、数字 |
| 黄金弱化 | `rgba(189, 103, 0, 0.15)` | 背景光晕、卡片高亮 |

### 渐变使用规范 / Gradient Usage

```
英雄区标题渐变（Hero H1）：
linear-gradient(90deg, #f5f1ea, #f5f1ea 55%, #bd6700)

背景环境光渐变（Ambient）：
radial-gradient(circle at 80% 5%, rgba(189, 103, 0, 0.07), transparent 31%),
radial-gradient(circle at 15% 28%, rgba(189, 103, 0, 0.04), transparent 24%),
#0c1e33

CTA 按钮背景：
background: #bd6700
hover: #a85c00
```

### ⚠️ 色彩使用禁忌 / Color DON'Ts

- ❌ 不使用青色/Teal `#007277` 作为品牌高亮色（已弃用）
- ❌ 不使用纯黑 `#000000` 作为背景（使用 Navy 系）
- ❌ 不在浅色背景上使用 Gold 作为大面积色块
- ❌ 不混用超过 3 种主色调
- ❌ 不在深色背景上使用 Navy 文字（对比度不足）

---

## 03 · 字体系统 / Typography

### 字体栈 / Font Stack

```css
/* 标题字体 / Display & Headings */
font-family: "Cormorant Garamond", "Playfair Display", Georgia, serif;

/* 正文字体 / Body & UI */
font-family: Inter, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif;

/* 中文字体补充 / Chinese CJK */
font-family: "PingFang SC", "Noto Sans SC", "Source Han Sans SC", sans-serif;

/* 等宽字体 / Monospace */
font-family: "JetBrains Mono", "Fira Code", "SF Mono", monospace;
```

### 字级规范 / Type Scale

| 用途 | 大小 | 字重 | 示例 |
|------|------|------|------|
| 英雄标题 Hero H1 | `clamp(58px, 6.2vw, 96px)` | 530 | 推动全球社区增长 |
| 页面标题 H1 | `clamp(40px, 4vw, 64px)` | 500 | What is VVVEco? |
| 章节标题 H2 | `clamp(32px, 3vw, 48px)` | 500 | — |
| 卡片标题 H3 | `18–24px` | 600 | — |
| 正文 Body | `16px` | 400 | 行高 1.85 |
| 小字 Small | `13–14px` | 400 | 行高 1.6 |
| 标签 Label | `11–12px` | 600 | 大写 letter-spacing |
| 数字 Data | `serif, 24–48px` | 500 | 0.00% 日收益 |

### 排版原则 / Typography Rules

1. **标题用衬线（Serif），正文用无衬线（Sans-serif）**
2. **数据/数字使用 Serif 字体**，增强专业感
3. **中文标点不使用全角空格**，排版保持紧凑
4. **英文标题全大写（CAPS）仅用于 Eyebrow 标签**，不用于主标题
5. **行高**：标题 0.94–1.1，正文 1.7–1.85

---

## 04 · Logo 使用规范 / Logo Usage

### Logo 版本

| 版本 | 文件名 | 使用场景 |
|------|--------|----------|
| 深色背景版（Cream Logo） | `vvveco-logo-cream.svg` | 深色/Navy 背景 |
| 浅色背景版（Navy Logo） | `vvveco-logo-navy.svg` | 浅色/Cream 背景 |
| 主题自适应 | `themeAware` 属性 | 网页自动切换 |

### 安全区 / Clear Space

Logo 四周需保留最小安全区 = Logo 高度的 **50%**

### ⚠️ Logo 禁忌 / Logo DON'Ts

- ❌ 不拉伸变形 Logo
- ❌ 不在低对比度背景上使用
- ❌ 不添加阴影或描边效果
- ❌ 不改变 Logo 色彩
- ❌ 不将 Logo 缩小到 24px 以下使用

---

## 05 · 按钮与 UI 组件 / Buttons & UI

### 主按钮 / Primary Button（橙金色）

```css
background: #bd6700;
color: #ffffff;
border-radius: 9999px; /* rounded-full */
padding: 16px 32px;
font-size: 16px;
font-weight: 500;
hover: background #a85c00;
transition: 150ms ease;
```

**文字**：简洁行动词 + 箭头图标 `→`  
**示例**：`进入质押大厅 →` / `Start Staking →`

### 次按钮 / Secondary Button（描边版）

```css
background: transparent;
border: 1px solid rgba(245, 241, 234, 0.2);
color: rgba(245, 241, 234, 0.85);
border-radius: 9999px;
padding: 16px 32px;
hover: border-color rgba(245, 241, 234, 0.35); background rgba(255,255,255,0.05);
```

**示例**：`查看白皮书` / `Read Whitepaper`

### 导航 CTA / Nav CTA

```css
background: #bd6700;
color: #ffffff;
border-radius: 9999px;
padding: 8px 20px;
font-size: 14px;
```

---

## 06 · 品牌声音 / Brand Voice

### 核心原则

| 品牌个性 | 说什么 | 不说什么 |
|----------|--------|----------|
| **精准** | "最高 1% 日收益率" | "超高收益！！！" |
| **信念感** | "我们相信隐私是架构，不是承诺" | "本项目保证安全" |
| **机构级** | "链上透明，随时可验证" | "放心，我们都是大咖" |
| **社区感** | "你的参与推动生态扩张" | "快来抢购！限时！" |
| **清醒** | "这不是收益循环，这是生态飞轮" | "轻松躺赚" |

### 语调 / Tone

- **不煽情**：没有"🚀🌙"，没有"改变世界"的过度承诺
- **有温度**：不是冷冰冰的机构公告，是有共识的社区语言
- **双语并重**：中文不是英文翻译，两个版本都是母语级创作
- **简洁有力**：每句话都能独立成立，无废话，无填充词

### 禁用词汇 / Banned Phrases

❌ 「暴富」「躺赚」「稳赚不赔」「保本」「0 风险」  
❌ 「Rug」「打新」「梭哈」「土狗」  
❌ 「革命性」「颠覆性」「改变世界」（除非有具体数据支撑）  
❌ 过多感叹号 `！！！`  
❌ 全大写表示兴奋 `THIS IS HUGE`

---

## 07 · 视觉风格 / Visual Style

### 核心视觉语言

**1. 点阵与网格（Dot Matrix & Grid）**  
背景使用细密点阵或网格，增强技术感和深度感  
```css
background: linear-gradient(rgba(245,241,234,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,241,234,0.04) 1px, transparent 1px);
background-size: 28px 28px;
```

**2. 环形轨道（Orbit Ring）**  
VVV/Venice AI 核心概念用同心圆轨道图形表达  
颜色：Cream 描边，Gold 发光点

**3. 节点网络（Node Network）**  
社区/生态用连接节点图形表达  
线条：`rgba(245,241,234,0.14)` 细线

**4. 环境光晕（Ambient Glow）**  
核心节点周围的橙金色光晕  
```css
box-shadow: 0 0 100px rgba(189, 103, 0, 0.2);
```

**5. 分层景深（Layered Depth）**  
使用多层半透明叠加创造深度感  
不使用扁平化单层设计

### 图形比例 / Aspect Ratios

| 场景 | 比例 | 尺寸 |
|------|------|------|
| Twitter Header | 3:1 | 1500×500 |
| Telegram Cover | 16:9 | 1280×720 |
| Discord Cover | 16:9 | 960×540 |
| 宣传海报竖版 | 9:16 | 1080×1920 |
| 宣传海报方版 | 1:1 | 1080×1080 |
| OG Image | 1.91:1 | 1200×628 |

---

## 08 · 社交媒体规范 / Social Media Guidelines

### Twitter / X

- **Header**：品牌宣言 + 生态标签
- **Profile Bio**：140字以内，包含 vvveco.io 链接
- **推文风格**：数据驱动，无废话，有共识
- **发帖频率**：建议每日 1–2 条（含转发）
- **图片比例**：1200×675（内嵌图）

**推荐 Bio 模板**：
```
Community Growth Layer of Venice AI
Stake VVV · Privacy AI · Built on Base
🌐 vvveco.io
```

### Telegram

- **群组名称**：VVVEco Official Community
- **欢迎语**：中英双语，简洁有力
- **置顶公告**：官网 + 质押入口 + 白皮书

### Discord

- **服务器名称**：VVVEco
- **频道结构建议**：
  - 📢 公告 / announcements
  - 📖 了解生态 / learn
  - 💰 质押讨论 / staking
  - 🌍 全球社区 / global
  - 🛠️ 开发者 / builders

---

## 09 · 风险披露提示 / Risk Disclaimer

所有对外物料底部须包含：

**中文**：
> 本内容仅供参考，不构成投资建议。加密货币投资存在风险，请在充分了解的基础上自主决策。

**English**：
> This content is for informational purposes only and does not constitute investment advice. Cryptocurrency investments involve risk. Please make informed decisions independently.

---

*VVVEco Brand Guide v1.0 · 2026年6月*  
*如有品牌使用问题，请联系官方社区频道*
