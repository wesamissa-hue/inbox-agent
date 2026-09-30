"use client"

import { useLanguage } from './LanguageProvider'

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="language-switcher" role="group" aria-label={t('language')}>
      <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
      <span aria-hidden="true">|</span>
      <button type="button" aria-pressed={language === 'ar'} onClick={() => setLanguage('ar')}>عربي</button>
    </div>
  )
}