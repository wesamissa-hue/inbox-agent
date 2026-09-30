"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { translate, type Language, type TranslationKey } from '../lib/translations'

const LANGUAGE_STORAGE_PREFIX = 'ideeps-gpt:language:'

type LanguageContextValue = {
  language: Language
  direction: 'ltr' | 'rtl'
  setLanguage: (language: Language) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function getStoredLanguage(userId: string | null): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_PREFIX + (userId || 'guest'))
    return stored === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    let active = true
    const updateUser = (nextUserId: string | null) => {
      if (!active) return
      setUserId(nextUserId)
      setLanguageState(getStoredLanguage(nextUserId))
    }

    void supabase.auth.getUser().then(({ data }) => updateUser(data.user?.id ?? null)).catch(() => updateUser(null))
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user.id ?? null)
    })
    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage)
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_PREFIX + (userId || 'guest'), nextLanguage)
    } catch {}
  }

  return (
    <LanguageContext.Provider value={{
      language,
      direction: language === 'ar' ? 'rtl' : 'ltr',
      setLanguage,
      t: (key) => translate(language, key),
    }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}