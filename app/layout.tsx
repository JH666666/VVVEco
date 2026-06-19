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
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)", sizes: "32x32", type: "image/png" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f3ed",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
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
