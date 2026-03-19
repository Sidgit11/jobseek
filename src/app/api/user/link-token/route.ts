import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — return the user's linked device token (if any)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('profiles')
      .select('device_token')
      .eq('id', user.id)
      .single()

    return NextResponse.json({ deviceToken: data?.device_token ?? null })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch token' }, { status: 500 })
  }
}

// POST — link a device token to the logged-in user's profile
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { token } = await request.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('profiles')
      .update({ device_token: token })
      .eq('id', user.id)

    if (error) throw error

    return NextResponse.json({ linked: true, deviceToken: token })
  } catch (err) {
    console.error('Link token error:', err)
    return NextResponse.json({ error: 'Failed to link token' }, { status: 500 })
  }
}
