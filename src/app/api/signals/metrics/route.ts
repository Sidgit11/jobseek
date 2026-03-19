import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { routeLogger } from '@/lib/logger'

const log = routeLogger('signals/metrics')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// POST — store scan session metrics
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.from('scan_metrics').insert({
      device_token: body.device_token,
      session_id: body.session_id,
      source: body.source || 'FEED',
      posts_extracted: body.posts_extracted || 0,
      posts_after_prefilter: body.posts_after_prefilter || 0,
      posts_after_dedup: body.posts_after_dedup || 0,
      posts_sent_to_gemini: body.posts_sent_to_gemini || 0,
      posts_approved: body.posts_approved || 0,
      posts_rejected: body.posts_rejected || 0,
      job_posts_direct: body.job_posts_direct || 0,
      rejection_samples: body.rejection_samples || [],
      approval_samples: body.approval_samples || [],
    })

    if (error) {
      log.err('db-insert', new Error(error.message))
      return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS })
    }

    log.res(200, { source: body.source || 'FEED', postsExtracted: body.posts_extracted })
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  } catch (err) {
    log.err('post', err)
    return NextResponse.json({ error: 'Failed to store metrics' }, { status: 500, headers: CORS_HEADERS })
  }
}

// GET — fetch scan metrics for a device token
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const deviceToken = searchParams.get('token')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!deviceToken) {
      return NextResponse.json({ error: 'token param required' }, { status: 400, headers: CORS_HEADERS })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase
      .from('scan_metrics')
      .select('*')
      .eq('device_token', deviceToken)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS })
    }

    return NextResponse.json({ metrics: data }, { headers: CORS_HEADERS })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500, headers: CORS_HEADERS })
  }
}
