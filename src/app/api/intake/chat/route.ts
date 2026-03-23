import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/google/client'
import { buildRecruiterPrompt, EXTRACTION_PROMPT } from '@/career-intelligence/prompts/recruiter'
import { routeLogger } from '@/lib/logger'
import type { IntakeMessage } from '@/career-intelligence/types'

const log = routeLogger('intake-chat')

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, conversationId, phase = 1 } = await request.json()
  log.req({ userId: user.id, conversationId, phase, messageLength: message?.length })

  // Load or create conversation
  let conversation
  if (conversationId) {
    const { data } = await supabase
      .from('intake_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()
    conversation = data
  }

  if (!conversation) {
    const { data } = await supabase
      .from('intake_conversations')
      .insert({ user_id: user.id, messages: [], phase: 1 })
      .select()
      .single()
    conversation = data
    log.step('conversation-created', { id: conversation?.id })
  }

  if (!conversation) {
    log.err('conversation-create-failed')
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }

  // Load current candidate model
  const { data: model } = await supabase
    .from('candidate_models')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const partialModel = model ?? {}
  const messages: IntakeMessage[] = conversation.messages ?? []

  // Append user message
  const userMsg: IntakeMessage = { role: 'user', content: message, timestamp: new Date().toISOString() }
  messages.push(userMsg)

  // ── Parallel: AI response + extraction ──────────────────────────────────────
  const conversationHistory = messages
    .map(m => `${m.role === 'assistant' ? 'Recruiter' : 'Candidate'}: ${m.content}`)
    .join('\n')

  log.step('gemini-start', { phase, historyLength: messages.length })

  const [aiText, extractionText] = await Promise.all([
    generateText(
      buildRecruiterPrompt(phase, partialModel),
      'Conversation so far:\n' + conversationHistory,
      { temperature: 0.7, maxTokens: 512 }
    ),
    generateText(
      EXTRACTION_PROMPT,
      'Existing model:\n' + JSON.stringify(partialModel, null, 2) +
      '\n\nLatest candidate message:\n' + message +
      '\n\nFull conversation context:\n' + conversationHistory,
      { temperature: 0.2, maxTokens: 2048 }
    ),
  ])

  log.step('gemini-response', { responseLength: aiText.length, extractionLength: extractionText.length })

  let extracted: Record<string, unknown> & { extracted_facts?: string[] } = {}
  try {
    const jsonMatch = extractionText.match(/\{[\s\S]*\}/)
    if (jsonMatch) extracted = JSON.parse(jsonMatch[0])
    log.step('extraction-parsed', { fieldsExtracted: Object.keys(extracted).filter(k => extracted[k] != null).length })
  } catch (err) {
    log.warn('extraction-parse-failed', { error: err instanceof Error ? err.message : String(err) })
  }

  const extractedFacts: string[] = extracted.extracted_facts ?? []
  delete extracted.extracted_facts

  // Append AI message
  const aiMsg: IntakeMessage = {
    role: 'assistant',
    content: aiText,
    timestamp: new Date().toISOString(),
    extracted_facts: extractedFacts,
  }
  messages.push(aiMsg)

  // Persist conversation
  await supabase.from('intake_conversations')
    .update({ messages, phase, updated_at: new Date().toISOString() })
    .eq('id', conversation.id)
  log.step('conversation-persisted', { conversationId: conversation.id, messageCount: messages.length })

  // Merge extraction into candidate model
  const mergeData: Record<string, unknown> = {
    user_id: user.id,
    intake_phase: phase,
    last_updated: new Date().toISOString(),
    conversation_id: conversation.id,
  }

  const mergeFields = [
    'headline', 'positioning', 'bio_short', 'location', 'unique_pov',
    'skill_tags', 'domain_expertise', 'stage_fit', 'target_roles', 'hard_nos'
  ]
  for (const field of mergeFields) {
    if (extracted[field] !== null && extracted[field] !== undefined) {
      const val = extracted[field]
      if (Array.isArray(val) && Array.isArray((partialModel as Record<string, unknown>)[field])) {
        const existing = (partialModel as Record<string, unknown>)[field] as unknown[]
        mergeData[field] = [...new Set([...existing, ...val as unknown[]])]
      } else if (val) {
        mergeData[field] = val
      }
    }
  }

  // Work experiences: merge by company name
  if (Array.isArray(extracted.work_experiences) && extracted.work_experiences.length > 0) {
    const existing = ((partialModel as Record<string, unknown>).work_experiences as Array<{ company: string }>) ?? []
    const incoming = extracted.work_experiences as Array<{ company: string }>
    const merged = [...existing]
    for (const exp of incoming) {
      const idx = merged.findIndex(e => e.company?.toLowerCase() === exp.company?.toLowerCase())
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...exp }
      } else {
        merged.push(exp)
      }
    }
    mergeData.work_experiences = merged
  }

  const { error: upsertError } = await supabase.from('candidate_models')
    .upsert(mergeData, { onConflict: 'user_id' })

  if (upsertError) {
    log.err('model-upsert-failed', upsertError)
  } else {
    log.step('model-upserted', { userId: user.id, fieldsUpdated: Object.keys(mergeData).length })
  }

  const responsePayload = {
    message: aiText,
    conversationId: conversation.id,
    extractedFacts,
    phase,
    model: { ...partialModel, ...mergeData },
  }

  log.res(200, { conversationId: conversation.id, phase, factsCount: extractedFacts.length })
  return NextResponse.json(responsePayload)
}
