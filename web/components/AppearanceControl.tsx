"use client"

import { useEffect, useRef, useState } from 'react'
import { presets, useTheme } from './ThemeProvider'
import { useLanguage } from './LanguageProvider'

export default function AppearanceControl() {
  const { accent, userId, setAccent, resetAccent } = useTheme()
  const { direction, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }

    function positionPanel() {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger || !panel) return
      const bounds = trigger.getBoundingClientRect()
      const margin = 12
      const preferredLeft = direction === 'rtl' ? bounds.left : bounds.right - panel.offsetWidth
      const left = Math.max(margin, Math.min(preferredLeft, window.innerWidth - panel.offsetWidth - margin))
      let top = bounds.top - panel.offsetHeight - 10
      if (top < margin) top = bounds.bottom + 10
      top = Math.max(margin, Math.min(top, window.innerHeight - panel.offsetHeight - margin))
      setPosition({ top, left })
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (triggerRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return
      setOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    positionPanel()
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', positionPanel)
    window.addEventListener('scroll', positionPanel, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', positionPanel)
      window.removeEventListener('scroll', positionPanel, true)
    }
  }, [direction, open])

  return (
    <div className="appearance-control">
      <button
        ref={triggerRef}
        className="appearance-trigger"
        type="button"
        disabled={!userId}
        title={t('appearance')}
        aria-label={t('appearance')}
        aria-expanded={open}
        aria-controls="appearance-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">Aa</span>
      </button>
      {open && (
        <section
          ref={panelRef}
          className="appearance-panel"
          id="appearance-panel"
          aria-label={t('appearance')}
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
        >
          <div className="appearance-heading">
            <div><h2>{t('appearance')}</h2><p>{t('chooseAccent')}</p></div>
            <button className="appearance-close" type="button" aria-label={t('closeAppearance')} onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="accent-presets" role="group" aria-label="Preset accent colors">
            {presets.map((preset) => (
              <button
                className="accent-swatch"
                key={preset.color}
                type="button"
                disabled={!userId}
                style={{ backgroundColor: preset.color }}
                aria-label={`${t(preset.name.toLowerCase() as 'cyan' | 'violet' | 'blue' | 'mint' | 'amber')} accent`}
                aria-pressed={accent.toLowerCase() === preset.color}
                title={preset.name}
                onClick={() => setAccent(preset.color)}
              />
            ))}
          </div>
          <label className="custom-accent">
            <span>{t('customColor')}</span>
            <input type="color" value={accent} disabled={!userId} onChange={(event) => setAccent(event.target.value)} />
          </label>
          <div className="appearance-preview" aria-live="polite">
            <span>{t('preview')}</span><span className="appearance-preview-action">{t('send')}</span>
          </div>
          <button className="appearance-reset" type="button" disabled={!userId} onClick={resetAccent}>{t('resetDefault')}</button>
        </section>
      )}
    </div>
  )
}