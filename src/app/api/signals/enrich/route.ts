import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function db() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

interface EnrichProfile {
  name: string | null
  headline: string | null
  company: string | null
  role: string | null
  about: string | null
  location: string | null
  mutualConnections: number | null
}

interface EnrichBody {
  token: string
  signalId: string
  profile: EnrichProfile
}

export async function POST(req: NextRequest) {
  try {
    const body: EnrichBody = await req.json()
    const { token, signalId, profile } = body

    if (!token) {
      return NextResponse.json(
        { error: 'token is required' },
        { status: 400, headers: CORS }
      )
    }

    if (!signalId) {
      return NextResponse.json(
        { error: 'signalId is required' },
        { status: 400, headers: CORS }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'profile is required' },
        { status: 400, headers: CORS }
      )
    }

    const supabase = db()

    const { error } = await supabase
      .from('linkedin_signals')
      .update({
        enriched_name: profile.name,
        enriched_headline: profile.headline,
        enriched_company: profile.company,
        enriched_role: profile.role,
        enriched_about: profile.about,
        enriched_location: profile.location,
        enriched_mutual_connections: profile.mutualConnections,
        enriched_at: new Date().toISOString(),
      })
      .eq('id', signalId)
      .eq('device_token', token)

    if (error) {
      console.error('[signals/enrich] Supabase update error:', error.message)
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: CORS }
      )
    }

    console.log(`[signals/enrich] Enriched signal ${signalId} for token ${token.slice(0, 8)}…`)
    return NextResponse.json({ enriched: true }, { headers: CORS })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[signals/enrich] Error:', message)
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}
