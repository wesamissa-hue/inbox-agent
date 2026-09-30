"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'

const DEFAULT_ACCENT = '#22d3ee'
const STORAGE_PREFIX = 'team-inbox:accent:'

const presets = [
  { name: 'Cyan', color: DEFAULT_ACCENT },
  { name: 'Violet', color: '#8b5cf6' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Mint', color: '#34d399' },
  { name: 'Amber', color: '#f59e0b' },
]

type ThemeContextValue = {
  accent: string
  userId: string | null
  setAccent: (color: string) => void
  resetAccent: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function validAccent(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color)
}

function accentForeground(color: string) {
  const channels = color.slice(1).match(/.{2}/g)?.map((channel) => parseInt(channel, 16) / 255) ?? [0, 0, 0]
  const luminance = channels
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0)
  return luminance > 0.19 ? '#111318' : '#ffffff'
}

function readAccent(userId: string | null) {
  if (!userId) return DEFAULT_ACCENT
  try {
    const stored = window.localStorage.getItem(STORAGE_PREFIX + userId)
    return stored && validAccent(stored) ? stored : DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [accent, setAccentState] = useState(DEFAULT_ACCENT)

  useEffect(() => {
    let active = true
    const updateUser = (nextUserId: string | null) => {
      if (!active) return
      setUserId(nextUserId)
      setAccentState(readAccent(nextUserId))
    }

    void supabase.auth.getUser().then(({ data }) => updateUser(data.user?.id ?? null))
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user.id ?? null)
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--brand', accent)
    document.documentElement.style.setProperty('--brand-foreground', accentForeground(accent))
  }, [accent])

  function setAccent(color: string) {
    if (!validAccent(color)) return
    const normalized = color.toLowerCase()
    setAccentState(normalized)
    if (!userId) return
    try {
      window.localStorage.setItem(STORAGE_PREFIX + userId, normalized)
    } catch {}
  }

  function resetAccent() {
    setAccentState(DEFAULT_ACCENT)
    if (!userId) return
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + userId)
    } catch {}
  }

  return (
    <ThemeContext.Provider value={{ accent, userId, setAccent, resetAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}

export { presets }