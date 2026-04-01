/**
 * Dev-only endpoint — creates / ensures a test user exists and returns
 * credentials so the login page can do signInWithPassword instantly,
 * bypassing the magic-link / PKCE flow entirely.
 *
 * Only works when NODE_ENV === 'development'.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DEV_EMAIL = process.env.DEV_LOGIN_EMAIL || 'dev@jobseek.local'
const DEV_PASSWORD = process.env.DEV_LOGIN_PASSWORD

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  if (!DEV_PASSWORD) {
    return NextResponse.json({ error: 'DEV_LOGIN_PASSWORD not configured' }, { status: 500 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Create the test user (no-op if already exists)
  await supabaseAdmin.auth.admin.createUser({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    email_confirm: true,
  })

  // Also ensure there's a profile row
  const { data: users } = await supabaseAdmin.auth.admin.listUsers()
  const user = users?.users.find(u => u.email === DEV_EMAIL)

  if (user) {
    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        email: DEV_EMAIL,
        name: 'Dev User',
        onboarding_completed: true, // skip onboarding in dev
        target_roles: ['Product Manager', 'Software Engineer'],
        target_industries: ['AI / ML', 'SaaS'],
        candidate_summary: 'Experienced PM / SWE looking for high-growth AI startups. Strong track record shipping 0-to-1 products. Seeking Series A-C companies.',
      }, { onConflict: 'id', ignoreDuplicates: false })
  }

  return NextResponse.json({ email: DEV_EMAIL, password: DEV_PASSWORD })
}
