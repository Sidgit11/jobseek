import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/google/client'
import { buildCommentPrompt } from '@/career-intelligence/prompts/engagement'
import { routeLogger } from '@/lib/logger'

const log = routeLogger('engagement-opportunities')

// GET — fetch pending engagement opportunities for current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  log.req({ userId: user.id, action: 'list' })

  const { data, error } = await supabase
    .from('engagement_opportunities')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('engagement_score', { ascending: false })
    .limit(20)

  if (error) {
    log.err('fetch-failed', error)
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
  }

  log.res(200, { count: data?.length ?? 0 })
  return NextResponse.json({ opportunities: data ?? [] })
}

// POST — generate AI comment for a specific opportunity
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { opportunityId } = await request.json()
  log.req({ userId: user.id, action: 'generate-comment', opportunityId })

  const { data: opp } = await supabase
    .from('engagement_opportunities')
    .select('*')
    .eq('id', opportunityId)
    .eq('user_id', user.id)
    .single()

  if (!opp) {
    log.warn('opportunity-not-found', { opportunityId })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: model } = await supabase
    .from('candidate_models')
    .select('positioning, domain_expertise, unique_pov, skill_tags, bio_short')
    .eq('user_id', user.id)
    .single()

  log.step('gemini-start', { hasModel: !!model, postLength: opp.post_text?.length })

  const comment = await generateText(
    'You are a LinkedIn comment ghostwriter. Return only the comment text.',
    buildCommentPrompt(model, {
      author_name: opp.author_name,
      author_title: opp.author_title,
      author_company: opp.author_company,
      post_text: opp.post_text,
      suggested_angle: opp.suggested_angle,
    }),
    { temperature: 0.7, maxTokens: 512 }
  )

  log.step('comment-generated', { commentLength: comment.length })

  const { error: updateError } = await supabase
    .from('engagement_opportunities')
    .update({ generated_comment: comment })
    .eq('id', opportunityId)

  if (updateError) {
    log.err('comment-save-failed', updateError)
  }

  log.res(200, { opportunityId, commentLength: comment.length })
  return NextResponse.json({ comment })
}
