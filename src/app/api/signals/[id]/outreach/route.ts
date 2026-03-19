import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { generateText } from '@/lib/google/client'

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

const SYSTEM_PROMPT = `You are Jobseek's outreach strategist. You help job seekers craft perfectly personalized outreach based on real LinkedIn signals.

Given a LinkedIn signal, generate a complete outreach strategy. Return ONLY valid JSON.

APPROACH LOGIC:
- 1st degree: They're already connected → DM directly
- 2nd degree + reactor exists: Ask [reactor] for intro, OR mention them in connection note
- 2nd degree + no reactor: Send connection request with personalized note
- 3rd+ degree + reactor: Contact reactor first, ask for intro
- 3rd+ degree + no reactor: Cold connection request, be very specific

Signal type angles:
- JOB_CHANGE: They just started somewhere new → their old company may be backfilling, new company in growth mode
- HIRING_POST: They're actively hiring → express direct interest in the role
- FUNDING_SIGNAL: Company just raised → about to grow fast → timing is perfect
- DECISION_MAKER_ACTIVE: Senior person posted substantively → warm touch on their insight
- COMPANY_MILESTONE: Company hit a milestone → congratulation hook
- WARM_PATH_OPENED: Your connection bridged you → lead with the mutual

Rules:
- Reference SPECIFIC details from the post (amounts, company names, role titles, quotes)
- If reactor exists: "I noticed [reactor name] shared your post" is powerful
- Never generic openers ("I hope this message finds you well")
- The ask = a 15-min conversation, NOT a job application
- Sound like a smart professional, not a desperate job seeker

Return this exact JSON structure:
{
  "bestChannel": "Direct DM" | "Connection Request" | "Intro via [reactor name]" | "Reach [reactor name] first",
  "strategy": "2 sentences explaining exactly how to approach this person and why now is the right moment",
  "connectionNote": "≤280 chars. Warm, specific, references the post or their signal. For connection requests.",
  "directMessage": "120-160 words. Personal opener + specific reference to their post + clear ask for a 15-min call.",
  "whyNow": "One sentence: why this specific signal makes outreach timely rather than random."
}`

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
  author_linkedin_url: string | null
  detected_at: string
  status: string
  outreach_draft: string | null
}

interface OutreachResult {
  bestChannel: string
  strategy: string
  connectionNote: string
  directMessage: string
  whyNow: string
}

function buildUserPrompt(signal: Signal): string {
  return `Signal to craft outreach for:

Author: ${signal.author}
Title: ${signal.title || '(no title listed)'}
Degree of connection: ${signal.degree}
Reactor (who bridged this): ${signal.reactor ?? 'none'}
Signal type: ${signal.type}
Tier: ${signal.tier}
Confidence: ${signal.confidence}%
Reasoning: ${signal.reasoning}
Outreach hook: ${signal.outreach_hook}
Post preview: ${signal.preview}
Time posted: ${signal.time_str}
LinkedIn URL: ${signal.author_linkedin_url ?? 'not available'}

Generate the full outreach strategy as JSON.`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { token }: { token: string } = await req.json()

    if (!token) {
      return NextResponse.json(
        { error: 'token is required' },
        { status: 400, headers: CORS }
      )
    }

    const supabase = db()

    // Fetch the signal — scoped to device_token for isolation
    const { data: signalData, error: fetchError } = await supabase
      .from('linkedin_signals')
      .select('*')
      .eq('id', id)
      .eq('device_token', token)
      .single()

    if (fetchError || !signalData) {
      return NextResponse.json(
        { error: 'Signal not found' },
        { status: 404, headers: CORS }
      )
    }

    const signal = signalData as Signal

    console.log(`[signals/${id}/outreach] Generating outreach for "${signal.author}" (${signal.type})`)

    const rawText = await generateText(
      SYSTEM_PROMPT,
      buildUserPrompt(signal),
      { temperature: 0.7, maxTokens: 1500 }
    )

    // Strip markdown fences if Gemini wraps response
    const stripped = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error(`[signals/${id}/outreach] Gemini returned non-JSON:`, rawText.slice(0, 200))
      return NextResponse.json(
        { error: 'Failed to parse outreach from AI response' },
        { status: 500, headers: CORS }
      )
    }

    const outreach: OutreachResult = JSON.parse(jsonMatch[0])

    // Persist the draft and mark signal as viewed
    const { error: updateError } = await supabase
      .from('linkedin_signals')
      .update({
        outreach_draft: JSON.stringify(outreach),
        status: 'viewed',
      })
      .eq('id', id)
      .eq('device_token', token)

    if (updateError) {
      console.warn(`[signals/${id}/outreach] Failed to persist draft:`, updateError.message)
    }

    console.log(`[signals/${id}/outreach] Done — bestChannel: ${outreach.bestChannel}`)
    return NextResponse.json(outreach, { headers: CORS })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[signals/outreach] Error:`, message)

    if (message.includes('429') || message.includes('spending cap') || message.includes('quota')) {
      return NextResponse.json(
        { error: 'quota_exceeded', hint: 'Gemini spending cap reached.' },
        { status: 429, headers: CORS }
      )
    }

    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}
