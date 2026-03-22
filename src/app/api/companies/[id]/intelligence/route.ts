import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCompanySummary } from '@/lib/anthropic/company-summary'
import { searchCompanyNews } from '@/lib/exa/search'
import { routeLogger } from '@/lib/logger'
import type { CandidateContext } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = routeLogger('GET /api/companies/[id]/intelligence')
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      log.warn('Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    log.req({ companyId: id, userId: user.id })

    // Detect fake demo IDs (non-UUID format like "demo-ashbyhq-com")
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    let company = null
    if (isUUID) {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        log.warn('Company not found in DB', { id, error: error?.message })
        return NextResponse.json({ error: 'Company not found' }, { status: 404 })
      }
      company = data
    } else {
      // Fake demo ID — try to find by extracted domain
      const domain = id.startsWith('demo-') ? (() => {
        const raw = id.replace(/^demo-/, '')
        const parts = raw.split('-')
        if (parts.length >= 2) {
          const tld = parts[parts.length - 1]
          const name = parts.slice(0, -1).join('-')
          return `${name}.${tld}`
        }
        return null
      })() : null

      if (domain) {
        const { data } = await supabase
          .from('companies')
          .select('*')
          .eq('domain', domain)
          .single()
        company = data
      }

      if (!company) {
        log.warn('Demo company not in DB yet — not found', { id })
        return NextResponse.json({ error: 'Company not found' }, { status: 404 })
      }
    }
    log.step('db:company', { name: company.name, domain: company.domain })

    // Check if summary is fresh (< 24h)
    const summaryAge = company.summary_updated_at
      ? (Date.now() - new Date(company.summary_updated_at).getTime()) / 1000 / 60 / 60
      : Infinity

    let news: { title: string; url: string; snippet: string; published_date: string | null }[] = []

    if (summaryAge > 24) {
      // Fetch user context
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

      // Fetch news and generate summary in parallel
      log.step('exa:news + gemini:summary', { company: company.name })
      const [newsResults, summaryResult] = await Promise.all([
        searchCompanyNews(company.name),
        generateCompanySummary(company, [], userContext),
      ])
      log.step('exa:news', { count: newsResults.length })
      log.step('gemini:summary', { summary: summaryResult.summary?.slice(0, 80) })

      news = newsResults

      // Update company with new summary
      await supabase
        .from('companies')
        .update({
          summary: summaryResult.summary,
          why_fit: summaryResult.why_fit,
          hiring_signals: summaryResult.hiring_signals,
          red_flags: summaryResult.red_flags,
          summary_updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      log.res(200, { company: company.name, newsSummary: true, newsCount: news.length })
      return NextResponse.json({
        company: {
          ...company,
          summary: summaryResult.summary,
          why_fit: summaryResult.why_fit,
          hiring_signals: summaryResult.hiring_signals,
          red_flags: summaryResult.red_flags,
        },
        news,
      })
    }

    log.res(200, { company: company.name, cached: true })
    return NextResponse.json({ company, news })
  } catch (err) {
    const log2 = routeLogger('GET /api/companies/[id]/intelligence')
    log2.err('unhandled exception', err)
    return NextResponse.json({ error: 'Failed to load intelligence' }, { status: 500 })
  }
}
