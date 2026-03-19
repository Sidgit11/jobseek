import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Support lookup by device token (for Chrome extension) or by auth session
    const { searchParams } = new URL(request.url)
    const deviceToken = searchParams.get('deviceToken')

    if (deviceToken) {
      // Extension lookup — find profile by device token
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('device_token', deviceToken)
        .single()

      if (!data) return NextResponse.json({ error: 'No profile linked to this token' }, { status: 404 })
      return NextResponse.json({ profile: data })
    }

    // Normal auth-based lookup
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return NextResponse.json({ profile: data })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const allowed = ['name', 'headline', 'location', 'target_roles', 'target_industries', 'seniority', 'target_locations', 'company_stages', 'linkedin_url', 'candidate_summary', 'onboarding_completed', 'device_token']
    const update: Record<string, unknown> = {}

    for (const key of allowed) {
      if (key in body) update[key] = body[key]
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ profile: data })
  } catch (err) {
    console.error('Profile update error:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
