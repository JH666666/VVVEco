import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { LanguageProvider } from "@/contexts/language-context";
import { FactoryResetOnBoot } from "@/components/system/factory-reset-on-boot";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "./providers";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "VVVeco",
  description: "VVVeco - 基于 Base 链的双轨制质押平台，支持币本位与金本位收益模式",
  keywords: ["VVV", "DeFi", "Staking", "Base", "Web3", "质押"],
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    shortcut: "/icon.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "VVVeco",
    description: "VVVeco - 基于 Base 链的双轨制质押平台",
    url: "https://vvveco.io",
    siteName: "VVVeco",
    images: [{ url: "/apple-touch-icon.png", width: 512, height: 512, alt: "VVVeco" }],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edede5" },
    { media: "(prefers-color-scheme: dark)", color: "#050b12" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased overflow-x-hidden" suppressHydrationWarning>
        <Providers>
          <FactoryResetOnBoot />
          <LanguageProvider>{children}</LanguageProvider>
          <Toaster />
          {process.env.NODE_ENV === "production" && <Analytics />}
        </Providers>
      </body>
    </html>
  );
}
