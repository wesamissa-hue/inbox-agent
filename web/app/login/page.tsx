"use client"

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import { useLanguage } from '../../components/LanguageProvider'

export default function LoginPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const signingUp = mode === 'signup'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (signingUp && password.length < 8) {
      setError(t('passwordLengthError'))
      return
    }
    if (signingUp && password !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }

    setSubmitting(true)

    try {
      if (signingUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (signUpError) {
          const message = signUpError.message.toLowerCase()
          if (message.includes('already registered') || message.includes('already exists')) {
            setError(t('accountExistsError'))
          } else if (message.includes('password')) {
            setError(t('signupPasswordError'))
          } else if (message.includes('rate limit') || message.includes('too many')) {
            setError(t('authRateLimitError'))
          } else {
            setError(t('signupError'))
          }
          return
        }

        if (data.session) {
          router.replace('/')
          router.refresh()
          return
        }

        setSuccess(t('confirmationNotice'))
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) {
        const message = signInError.message.toLowerCase()
        setError(message.includes('email not confirmed') ? t('emailUnconfirmed') : t('signinError'))
        return
      }

      router.replace('/')
      router.refresh()
    } catch {
      setError(t('authConnectionError'))
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode() {
    setMode(signingUp ? 'signin' : 'signup')
    setConfirmPassword('')
    setError(null)
    setSuccess(null)
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-top">
          <Link className="login-brand" href="/"><img className="brand-mark" src="/icon.png" alt="" width="27" height="27" />{t('brand')}</Link>
          <LanguageSwitcher />
        </div>
        <h1 id="login-title">{signingUp ? t('createAccountTitle') : t('login')}</h1>
        <p className="login-description">{signingUp ? t('signupDescription') : t('loginDescription')}</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            {t('email')}
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            {t('password')}
            <input
              type="password"
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              minLength={signingUp ? 8 : undefined}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {signingUp && (
            <label>
              {t('confirmPassword')}
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          )}
          {error && <p className="login-error" role="alert">{error}</p>}
          {success && <p className="login-success" role="status">{success}</p>}
          <button className="btn login-submit" type="submit" disabled={submitting}>
            {submitting ? (signingUp ? t('creatingAccount') : t('signingIn')) : (signingUp ? t('signup') : t('login'))}
          </button>
        </form>
        <p className="login-mode-switch">
          {signingUp ? t('alreadyAccount') : t('newToProduct')}
          <button type="button" onClick={switchMode}>{signingUp ? t('useSignin') : t('useSignup')}</button>
        </p>
      </section>
    </main>
  )
}
