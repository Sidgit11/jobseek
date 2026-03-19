import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { routeLogger } from '@/lib/logger'

const log = routeLogger('signals/store')

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

interface IncomingSignal {
  id: string
  type: string
  tier: number
  confidence: number
  author: string
  title: string
  degree: string
  reactor: string | null
  reasoning: string
  outreachHook: string
  preview: string
  timeStr: string
  timeMinutes: number
  source: string
  postUrl?: string | null
  authorLinkedInUrl?: string | null
  reactorLinkedInUrl?: string | null
  companyName?: string | null
  detectedAt: string
}

interface StoreBody {
  token: string
  signals: IncomingSignal[]
}

// Materialize companies + jobs into dedicated tables (non-blocking)
async function materializeCompanies(token: string, rows: Array<Record<string, unknown>>) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  await fetch(`${baseUrl}/api/signals/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, signals: rows }),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body: StoreBody = await req.json()
    const { token, signals } = body

    if (!token) {
      return NextResponse.json(
        { error: 'token is required' },
        { status: 400, headers: CORS }
      )
    }

    if (!signals || signals.length === 0) {
      return NextResponse.json({ stored: 0 }, { headers: CORS })
    }

    const supabase = db()

    const rows = signals.map((s) => ({
      id: s.id,
      device_token: token,
      type: s.type,
      tier: s.tier,
      confidence: s.confidence,
      author: s.author,
      title: s.title,
      degree: s.degree,
      reactor: s.reactor ?? null,
      reasoning: s.reasoning,
      outreach_hook: s.outreachHook,
      preview: s.preview,
      time_str: s.timeStr,
      time_minutes: s.timeMinutes,
      source: s.source,
      post_url: s.postUrl ?? null,
      author_linkedin_url: s.authorLinkedInUrl ?? null,
      reactor_linkedin_url: s.reactorLinkedInUrl ?? null,
      author_company: s.companyName ?? null,
      detected_at: s.detectedAt,
      status: 'new',
    }))

    const { error } = await supabase
      .from('linkedin_signals')
      .upsert(rows, { onConflict: 'id,device_token' })

    if (error) {
      log.err('supabase-upsert', new Error(error.message))
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: CORS }
      )
    }

    log.step('stored', { count: rows.length, token: token.slice(0, 8) })

    // Fire-and-forget: materialize companies + jobs from stored signals
    materializeCompanies(token, rows).catch(err =>
      log.warn('materialize-skipped', { error: err.message })
    )

    log.res(200, { stored: rows.length })
    return NextResponse.json({ stored: rows.length }, { headers: CORS })
  } catch (err: unknown) {
    log.err('store', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}
