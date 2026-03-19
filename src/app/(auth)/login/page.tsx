'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const IS_DEV = process.env.NODE_ENV === 'development'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [devLoading, setDevLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  // Detect error passed via query param (from failed callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err) setError(decodeURIComponent(err))
  }, [])

  // ── Dev bypass ──────────────────────────────────────────────────────────────
  async function handleDevLogin() {
    setDevLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/dev-login', { method: 'POST' })
      if (!res.ok) { setError('Dev login failed'); setDevLoading(false); return }
      const { email: devEmail, password } = await res.json()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: devEmail, password })
      if (signInError) { setError(signInError.message); setDevLoading(false); return }
      router.push('/discover')
    } catch {
      setError('Dev login error')
      setDevLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Point to the CLIENT-SIDE callback page — handles both PKCE codes
        // and hash-based tokens/errors (server routes can't read URL hashes).
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div
          className="h-[500px] w-[500px] rounded-full opacity-[0.06] blur-3xl"
          style={{ background: 'radial-gradient(circle, #A3E635 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 text-center">
          <h1
            className="text-4xl font-extrabold tracking-tight"
            style={{
              color: '#0F0F0F',
            }}
          >
            Jobseek.ai
          </h1>
          <p className="mt-2 text-sm italic" style={{ color: '#84CC16' }}>
            &ldquo;Stop applying. Start reaching out.&rdquo;
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-lg"
          style={{ background: '#ffffff', border: '1px solid #E8E8E3' }}
        >
          {sent ? (
            <div className="text-center">
              <div className="mb-4 text-4xl">📬</div>
              <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Check your inbox
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                We sent a magic link to <span style={{ color: 'var(--color-lime-text)' }}>{email}</span>.
                Click it to sign in — no password needed.
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-6 text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Sign in to Jobseek
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Enter your email and we&apos;ll send you a magic link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid #E8E8E3',
                      color: 'var(--color-text-primary)',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--color-lime)'
                      e.target.style.boxShadow = '0 0 0 2px var(--color-lime-subtle)'
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#E8E8E3'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                {error && (
                  <div
                    className="rounded-lg p-3 text-xs leading-relaxed"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}
                  >
                    {error.toLowerCase().includes('expired') || error.toLowerCase().includes('invalid')
                      ? <>⚠️ Link expired or already used — please request a new one below.</>
                      : error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: loading ? '#84CC16' : '#A3E635',
                    color: '#1A2E05',
                    boxShadow: loading ? 'none' : 'var(--shadow-lime)',
                  }}
                >
                  {loading ? 'Sending…' : 'Send magic link →'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Try Demo — always visible */}
        <div className="mt-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: '#E8E8E3' }} />
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#374151' }}>
              or
            </span>
            <div className="flex-1 h-px" style={{ background: '#E8E8E3' }} />
          </div>

          <a
            href="/demo/discover"
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all hover:opacity-90"
            style={{
              background: 'var(--color-lime-subtle)',
              border: '1px solid var(--color-lime-border)',
              color: 'var(--color-lime-text)',
            }}
          >
            ✦ Explore demo — no sign-up needed
          </a>
          <p className="mt-2 text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Real companies · AI intelligence · pre-written outreach
          </p>
        </div>

        <p className="mt-5 text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          No account needed. We&apos;ll create one on first sign in.
        </p>

        {/* Dev bypass — only visible in development */}
        {IS_DEV && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px" style={{ background: '#E8E8E3' }} />
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#374151' }}>
                Dev only
              </span>
              <div className="flex-1 h-px" style={{ background: '#E8E8E3' }} />
            </div>
            <button
              onClick={handleDevLogin}
              disabled={devLoading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: 'transparent',
                border: '1px solid #374151',
                color: 'var(--color-text-tertiary)',
              }}
            >
              {devLoading ? 'Signing in…' : '⚡ Dev Login (skip email)'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
