"use client"

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

export default function LoginPage() {
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
      setError('Use a password with at least 8 characters.')
      return
    }
    if (signingUp && password !== confirmPassword) {
      setError('The passwords do not match.')
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
            setError('An account may already use this email. Try signing in instead.')
          } else if (message.includes('password')) {
            setError('Your password does not meet the requirements. Choose a stronger password.')
          } else if (message.includes('rate limit') || message.includes('too many')) {
            setError('Too many attempts. Wait a moment, then try again.')
          } else {
            setError('We could not create your account. Check your details and try again.')
          }
          return
        }

        if (data.session) {
          router.replace('/')
          router.refresh()
          return
        }

        setSuccess('If registration was accepted, a confirmation link is on its way. Confirm your email, then sign in here.')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) {
        const message = signInError.message.toLowerCase()
        setError(message.includes('email not confirmed')
          ? 'Confirm your email address before signing in.'
          : 'Invalid email or password. Please try again.')
        return
      }

      router.replace('/')
      router.refresh()
    } catch {
      setError('Unable to reach authentication. Check your connection and try again.')
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
        <Link className="login-brand" href="/">Team Inbox</Link>
        <h1 id="login-title">{signingUp ? 'Create your account' : 'Sign in'}</h1>
        <p className="login-description">{signingUp ? 'Create an account to access your team workspace.' : 'Use your team account to continue.'}</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
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
              Confirm password
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
            {submitting ? (signingUp ? 'Creating account...' : 'Signing in...') : (signingUp ? 'Create account' : 'Sign in')}
          </button>
        </form>
        <p className="login-mode-switch">
          {signingUp ? 'Already have an account?' : 'New to Team Inbox?'}
          <button type="button" onClick={switchMode}>{signingUp ? 'Sign in' : 'Create account'}</button>
        </p>
      </section>
    </main>
  )
}
