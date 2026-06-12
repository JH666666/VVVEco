import { About } from '@/components/marketing/about'
import { AIModels } from '@/components/marketing/ai-models'
import { DeveloperAPI } from '@/components/marketing/developer-api'
import { Footer } from '@/components/marketing/footer'
import { GlobalStats } from '@/components/marketing/global-stats'
import { Header } from '@/components/marketing/header'
import { Hero } from '@/components/marketing/hero'
import { OfficialTools } from '@/components/marketing/official-tools'
import { Pricing } from '@/components/marketing/pricing'
import { Privacy } from '@/components/marketing/privacy'
import { Staking } from '@/components/marketing/staking'
import { Team } from '@/components/marketing/team'
import { Timeline } from '@/components/marketing/timeline'
import { LanguageProvider } from '@/components/marketing/language-provider'

export default function Home() {
  return (
    <LanguageProvider>
      <main className="min-h-screen">
        <Header />
        <Hero />
        <About />
        <Staking />
        <AIModels />
        <Pricing />
        <Privacy />
        <DeveloperAPI />
        <OfficialTools />
        <Team />
        <Timeline />
        <GlobalStats />
        <Footer />
      </main>
    </LanguageProvider>
  )
}
