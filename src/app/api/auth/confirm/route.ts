import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function resolveRedirect(
  userId: string,
  email: string | undefined,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
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
    return '/onboarding'
  }

  return profile.onboarding_completed ? '/discover' : '/onboarding'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  // PKCE flow — used by default in newer Supabase versions
  const code = searchParams.get('code')

  // OTP token_hash flow — used by older versions / explicit OTP
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const supabase = await createClient()

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const dest = await resolveRedirect(data.user.id, data.user.email, supabase)
      return NextResponse.redirect(new URL(dest, origin))
    }
    console.error('[auth/confirm] PKCE error:', error?.message)
  }

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error && data.user) {
      const dest = await resolveRedirect(data.user.id, data.user.email, supabase)
      return NextResponse.redirect(new URL(dest, origin))
    }
    console.error('[auth/confirm] OTP error:', error?.message)
  }

  return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
}
