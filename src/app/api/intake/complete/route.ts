import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/google/client'
import { buildCompletionPrompt } from '@/career-intelligence/prompts/completion'
import { routeLogger } from '@/lib/logger'

const log = routeLogger('intake-complete')

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  log.req({ userId: user.id })

  const { data: model } = await supabase
    .from('candidate_models')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!model) {
    log.warn('no-model-found', { userId: user.id })
    return NextResponse.json({ error: 'No model found' }, { status: 404 })
  }

  log.step('gemini-start', { modelFields: Object.keys(model).filter(k => model[k] != null).length })

  const raw = await generateText(
    'You are a career profile generator. Return only valid JSON.',
    buildCompletionPrompt(model),
    { temperature: 0.5, maxTokens: 2048 }
  )

  log.step('gemini-response', { responseLength: raw.length })

  let outputs: Record<string, unknown> = {}
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) outputs = JSON.parse(jsonMatch[0])
    log.step('completion-parsed', { fieldsGenerated: Object.keys(outputs).length })
  } catch (err) {
    log.err('completion-parse-failed', err)
  }

  const { error: updateError } = await supabase.from('candidate_models')
    .update({
      ...outputs,
      intake_phase: 6,
      last_updated: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (updateError) {
    log.err('model-update-failed', updateError)
  } else {
    log.step('model-finalized', { userId: user.id })
  }

  // Update profile slug if not set
  const { data: profile } = await supabase
    .from('profiles')
    .select('slug, name')
    .eq('id', user.id)
    .single()

  if (!profile?.slug && profile?.name) {
    const slug = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    const { error: slugError } = await supabase.from('profiles')
      .update({ slug, is_profile_public: true })
      .eq('id', user.id)

    if (slugError) {
      log.warn('slug-update-failed', slugError)
    } else {
      log.step('profile-slug-set', { slug })
    }
  }

  log.res(200, { outputFields: Object.keys(outputs).length })
  return NextResponse.json({ success: true, outputs })
}
