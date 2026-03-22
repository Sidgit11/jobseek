import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateOutreach } from '@/lib/anthropic/outreach'
import { routeLogger } from '@/lib/logger'
import type { CandidateContext } from '@/types'

export async function POST(request: NextRequest) {
  const log = routeLogger('POST /api/outreach/generate')
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      log.warn('Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 10 outreach drafts per day
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('outreach_drafts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString())

    if ((count ?? 0) >= 20) {
      return NextResponse.json(
        { error: 'Daily limit reached. You can generate up to 20 outreach messages per day.' },
        { status: 429 }
      )
    }

    const { personId, companyId } = await request.json()

    if (!personId || !companyId) {
      return NextResponse.json({ error: 'personId and companyId required' }, { status: 400 })
    }

    log.req({ personId, companyId, userId: user.id })

    // Fetch all context
    const [personResult, companyResult, profileResult] = await Promise.all([
      supabase.from('people').select('*').eq('id', personId).single(),
      supabase.from('companies').select('*').eq('id', companyId).single(),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ])

    const person = personResult.data
    const company = companyResult.data
    const profile = profileResult.data

    if (!person || !company) {
      return NextResponse.json({ error: 'Person or company not found' }, { status: 404 })
    }

    const userContext: CandidateContext = {
      name: profile?.name ?? null,
      candidateSummary: profile?.candidate_summary ?? `A professional interested in ${profile?.target_roles?.join(', ') ?? 'relevant'} roles.`,
      targetRoles: profile?.target_roles ?? [],
      targetIndustries: profile?.target_industries ?? [],
      location: profile?.location ?? null,
      seniority: profile?.seniority ?? null,
      companyStages: profile?.company_stages ?? [],
      targetLocations: profile?.target_locations ?? [],
      linkedinExperience: profile?.linkedin_experience ?? null,
      linkedinHeadline: profile?.linkedin_headline ?? null,
    }

    log.step('db:fetched', { person: person.name, company: company.name })

    // Generate outreach via Gemini
    log.step('gemini:outreach', { person: person.name, company: company.name })
    const variants = await generateOutreach(person, company, userContext)

    // Save drafts
    const [linkedinDraft, emailDraft] = await Promise.all([
      supabase.from('outreach_drafts').insert({
        user_id: user.id,
        person_id: personId,
        company_id: companyId,
        type: 'linkedin',
        body: variants.linkedin,
      }).select('id').single(),

      supabase.from('outreach_drafts').insert({
        user_id: user.id,
        person_id: personId,
        company_id: companyId,
        type: 'email',
        subject: variants.email.subject,
        body: variants.email.body,
      }).select('id').single(),
    ])

    log.res(200, { person: person.name, linkedinLen: variants.linkedin.length, subject: variants.email.subject })
    return NextResponse.json({
      linkedin: variants.linkedin,
      email_subject: variants.email.subject,
      email_body: variants.email.body,
      draft_ids: {
        linkedin: linkedinDraft.data?.id,
        email: emailDraft.data?.id,
      },
    })
  } catch (err) {
    const log2 = routeLogger('POST /api/outreach/generate')
    log2.err('unhandled exception', err)
    return NextResponse.json({ error: 'Failed to generate outreach' }, { status: 500 })
  }
}
