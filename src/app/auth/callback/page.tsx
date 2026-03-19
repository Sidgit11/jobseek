'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Client-side auth callback handler.
 *
 * Supabase magic links redirect here with either:
 *   - ?code=<pkce_code>            — PKCE flow (newer Supabase)
 *   - #access_token=<jwt>&...      — Implicit flow (older / hash-based)
 *   - #error=access_denied&...     — Error from Supabase
 *
 * Because hash params never reach the server, this MUST be a client page.
 * The Supabase JS SDK automatically detects and processes both flows.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const supabase = createClient()

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search)
      const hash = window.location.hash

      // Parse hash params (implicit flow / error case)
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
      const hashError = hashParams.get('error')
      const hashErrorCode = hashParams.get('error_code')
      const hashErrorDesc = hashParams.get('error_description')

      // If Supabase sent an error in the hash, redirect to login with info
      if (hashError) {
        const msg = hashErrorDesc
          ? decodeURIComponent(hashErrorDesc.replace(/\+/g, ' '))
          : hashErrorCode ?? hashError
        router.replace(`/login?error=${encodeURIComponent(msg)}`)
        return
      }

      const code = params.get('code')

      if (code) {
        // PKCE code exchange — code verifier lives in sessionStorage
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          router.replace(`/login?error=${encodeURIComponent(error.message)}`)
          return
        }
        if (data.user) {
          await resolveAndRedirect(data.user.id, data.user.email, supabase, router)
          return
        }
      }

      // Implicit flow: SDK auto-detects #access_token in the URL
      // Call getSession() which will process the hash automatically
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        router.replace('/login?error=Unable+to+sign+in.+Please+try+again.')
        return
      }

      await resolveAndRedirect(session.user.id, session.user.email, supabase, router)
    }

    handleCallback()
  }, [router])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Spinner */}
      <div
        className="h-10 w-10 animate-spin rounded-full"
        style={{ border: '3px solid #E8E8E3', borderTopColor: 'var(--color-lime)' }}
      />
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Signing you in…
      </p>
    </div>
  )
}

async function resolveAndRedirect(
  userId: string,
  email: string | undefined,
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>
) {
  // Check / create profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, onboarding_completed')
    .eq('id', userId)
    .single()

  if (!profile) {
    await supabase.from('profiles').insert({
      id: userId,
      email: email ?? null,
      onboarding_completed: false,
    })
    router.replace('/onboarding')
    return
  }

  router.replace(profile.onboarding_completed ? '/discover' : '/onboarding')
}
