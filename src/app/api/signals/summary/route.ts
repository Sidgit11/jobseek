import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { generateText } from '@/lib/google/client'
import { getCorsHeaders } from '@/lib/cors'

function db() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin')) })
}

// ── POST: Generate a new scan summary ───────────────────────────────────────

interface SignalInput {
  type: string
  tier: number
  confidence: number
  author: string
  title: string
  reasoning: string
  outreach_hook: string
  preview: string
  degree?: string
  reactor?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, signals } = body as { token: string; signals: SignalInput[] }

    if (!token) {
      return NextResponse.json(
        { error: 'token is required' },
        { status: 400, headers: getCorsHeaders(req.headers.get('origin')) }
      )
    }

    if (!Array.isArray(signals) || signals.length === 0) {
      return NextResponse.json(
        { error: 'signals array is required and must not be empty' },
        { status: 400, headers: getCorsHeaders(req.headers.get('origin')) }
      )
    }

    // Build signal breakdown
    const breakdown: Record<string, number> = {}
    for (const s of signals) {
      breakdown[s.type] = (breakdown[s.type] ?? 0) + 1
    }

    // Build context for Gemini
    const signalSummaries = signals.map((s, i) => {
      const parts = [
        `${i + 1}. [${s.type}] ${s.author} — ${s.title}`,
        `   Tier ${s.tier}, ${s.confidence}% confidence`,
        `   Reasoning: ${s.reasoning}`,
        s.degree ? `   Connection: ${s.degree}` : null,
        s.reactor ? `   Via: ${s.reactor}` : null,
      ].filter(Boolean)
      return parts.join('\n')
    }).join('\n\n')

    const systemPrompt = `You are a job search coach embedded in the Jobseek platform. You write concise, actionable briefings for job seekers reviewing LinkedIn signals detected by their browser extension. Be direct and strategic — no fluff. Use plain text only (no markdown, no bullet points, no headers).`

    const userPrompt = `Here are ${signals.length} LinkedIn signals detected in the latest scan:

${signalSummaries}

Signal breakdown: ${Object.entries(breakdown).map(([type, count]) => `${count} ${type}`).join(', ')}

Write a 3-5 sentence briefing for the job seeker:
1. Summarize the most actionable opportunities they should focus on
2. Suggest which signal(s) to act on first and why
3. Highlight any patterns (e.g., "3 companies in your network are hiring engineers", "multiple funding announcements suggest a hot market")

Be specific — reference actual names and companies from the signals. Keep it to 3-5 sentences.`

    const summary = await generateText(systemPrompt, userPrompt, {
      temperature: 0.3,
      maxTokens: 1024,
    })

    // Store in Supabase
    const supabase = db()
    const { error: insertError } = await supabase
      .from('scan_summaries')
      .insert({
        device_token: token,
        summary,
        signal_count: signals.length,
        signal_breakdown: breakdown,
      })

    if (insertError) {
      console.error('[signals/summary] Supabase insert error:', insertError.message)
      // Still return the summary even if storage fails
    }

    return NextResponse.json(
      {
        summary,
        signalCount: signals.length,
        signalBreakdown: breakdown,
      },
      { headers: getCorsHeaders(req.headers.get('origin')) }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[signals/summary] Error:', message)
    return NextResponse.json({ error: message }, { status: 500, headers: getCorsHeaders(req.headers.get('origin')) })
  }
}

// ── GET: Fetch latest scan summary ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'token query param is required' },
        { status: 400, headers: getCorsHeaders(req.headers.get('origin')) }
      )
    }

    const supabase = db()

    const { data, error } = await supabase
      .from('scan_summaries')
      .select('*')
      .eq('device_token', token)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      // No summary yet — that's fine
      return NextResponse.json(
        { summary: null },
        { headers: getCorsHeaders(req.headers.get('origin')) }
      )
    }

    return NextResponse.json(
      {
        summary: data.summary,
        signalCount: data.signal_count,
        signalBreakdown: data.signal_breakdown,
        createdAt: data.created_at,
      },
      { headers: getCorsHeaders(req.headers.get('origin')) }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[signals/summary] Error:', message)
    return NextResponse.json({ error: message }, { status: 500, headers: getCorsHeaders(req.headers.get('origin')) })
  }
}
