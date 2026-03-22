import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTargetingBrief } from '@/lib/anthropic/targeting-brief'
import { routeLogger } from '@/lib/logger'
import type { SearchIntent, CandidateContext } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = routeLogger('GET /api/companies/[id]/brief')
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch company
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single()

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Fetch user profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_roles, target_industries, location, candidate_summary, name, seniority, company_stages, target_locations, linkedin_experience, linkedin_headline')
      .eq('id', user.id)
      .single()

    const userContext: CandidateContext = {
      name: profile?.name ?? null,
      candidateSummary: profile?.candidate_summary ?? '',
      targetRoles: profile?.target_roles ?? [],
      targetIndustries: profile?.target_industries ?? [],
      location: profile?.location ?? null,
      seniority: profile?.seniority ?? null,
      companyStages: profile?.company_stages ?? [],
      targetLocations: profile?.target_locations ?? [],
      linkedinExperience: profile?.linkedin_experience ?? null,
      linkedinHeadline: profile?.linkedin_headline ?? null,
    }

    // Build a minimal intent for brief generation
    const intent: SearchIntent = {
      industries: profile?.target_industries ?? [],
      fundingStages: [],
      roles: profile?.target_roles ?? [],
      geography: profile?.location ?? null,
      signals: ['hiring', 'growth'],
      companySize: 'any',
      keywords: [company.name],
      companyName: company.name,
      confidence: 1.0,
      sectors: (profile?.target_industries ?? []).map((i: string) => i.toLowerCase().split(' / ')[0]),
      expandedGeo: [],
      roleSignal: null,
      temporal: null,
      implicitSignals: [],
    }

    log.req({ companyId: id, companyName: company.name })
    const brief = await generateTargetingBrief(company, intent, userContext, company.description ?? '')
    log.res(200, { whyNowCount: brief.whyNow.length })

    return NextResponse.json({ brief })
  } catch (err) {
    log.err('brief-generation', err)
    return NextResponse.json({ error: 'Failed to generate brief' }, { status: 500 })
  }
}
