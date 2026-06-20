"use client"

import type { ReactNode } from 'react'
import { useLanguage as useGlobalLanguage } from '@/contexts/language-context'

type Language = 'en' | 'zh'

export function LanguageProvider({ children }: { children: ReactNode }) {
  return children
}

export function useLanguage() {
  const { language, setLanguage } = useGlobalLanguage()

  return {
    lang: language,
    setLang: (lang: Language) => setLanguage(lang),
    t: (en: string, zh: string) => language === 'en' ? en : zh,
  }
}

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage()

  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1">
      <button
        onClick={() => setLang('en')}
        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
          lang === 'en' 
            ? 'bg-primary text-white' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang('zh')}
        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
          lang === 'zh' 
            ? 'bg-primary text-white' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        中文
      </button>
    </div>
  )
}
