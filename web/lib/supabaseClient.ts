import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // Helpful nudge during setup instead of a cryptic runtime crash.
  console.warn('Missing Supabase env vars. Did you copy .env.local.example to .env.local?')
}

export const supabase = createBrowserClient(url, anonKey)
