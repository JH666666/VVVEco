"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type Language = 'en' | 'zh'

interface LanguageContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: (en: string, zh: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('en')

  useEffect(() => {
    const saved = localStorage.getItem('vvveco-lang') as Language
    if (saved) setLang(saved)
  }, [])

  const handleSetLang = (newLang: Language) => {
    setLang(newLang)
    localStorage.setItem('vvveco-lang', newLang)
  }

  const t = (en: string, zh: string) => lang === 'en' ? en : zh

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
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
