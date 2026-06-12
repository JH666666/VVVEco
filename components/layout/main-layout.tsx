'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/top-bar'
import { MobilePreviewToggle } from '@/components/layout/mobile-preview-toggle'
import { LocalWeb3SimProvider } from '@/contexts/local-web3-sim-context'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <LocalWeb3SimProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <TopBar />
        {/* Main content area - responsive padding for mobile header and desktop sidebar/topbar */}
        <main className="min-h-screen p-4 pt-18 lg:ml-64 lg:p-6 lg:pt-20 transition-all duration-300">
          {children}
        </main>
        <MobilePreviewToggle />
      </div>
    </LocalWeb3SimProvider>
  )
}
