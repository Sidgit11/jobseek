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

interface Signal {
  id: string
  device_token: string
  type: string
  tier: number
  confidence: number
  author: string
  title: string
  degree: string
  reactor: string | null
  reasoning: string
  outreach_hook: string
  preview: string
  time_str: string
  time_minutes: number
  source: string
  post_url: string | null
  detected_at: string
  status: string
  outreach_draft: string | null
  created_at: string
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'token query param is required' },
        { status: 400, headers: CORS }
      )
    }

    const supabase = db()

    const { data, error } = await supabase
      .from('linkedin_signals')
      .select('*')
      .eq('device_token', token)
      .neq('status', 'dismissed')
      .order('tier', { ascending: true })
      .order('confidence', { ascending: false })
      .order('detected_at', { ascending: false })

    if (error) {
      console.error('[signals] Supabase fetch error:', error.message)
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: CORS }
      )
    }

    const signals = (data ?? []) as Signal[]

    // Derive lastScan from the most recently detected signal
    const lastScan =
      signals.length > 0
        ? signals.reduce((latest, s) =>
            s.detected_at > latest ? s.detected_at : latest,
            signals[0].detected_at
          )
        : null

    return NextResponse.json(
      { signals, total: signals.length, lastScan },
      { headers: CORS }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[signals] Error:', message)
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}
