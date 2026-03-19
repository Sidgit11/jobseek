import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractSearchIntent } from '@/lib/anthropic/intent-extraction'
import { searchCompanies } from '@/lib/exa/search'
import { enrichCompany } from '@/lib/crunchbase/enrich'
import { generateFallbackCompanies } from '@/lib/anthropic/company-discovery'
import { getDemoCompanies } from '@/lib/demo/companies'
import { routeLogger } from '@/lib/logger'
import type { Company, SearchResult, CandidateContext } from '@/types'

function scoreCompany(company: Partial<Company>, intent: { signals: string[]; fundingStages: string[] }, snippet: string, rawQuery?: string): number {
  let score = 50 // base

  // Name match bonus: if the company name contains the search query, boost strongly
  if (rawQuery) {
    const q = rawQuery.toLowerCase()
    if (company.name && company.name.toLowerCase().includes(q)) score += 30
    if (company.domain && company.domain.toLowerCase().includes(q)) score += 25
  }

  // Funding stage match
  const fs = company.funding_stage?.toLowerCase() ?? ''
  const wantedStages = intent.fundingStages.map(s => s.toLowerCase())
  if (wantedStages.some(s => fs.includes(s.replace('-', ' ').replace('_', ' ')))) score += 20

  // Recent funding
  if (company.last_round_date) {
    const months = (Date.now() - new Date(company.last_round_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
    if (months < 12) score += 15
    else if (months < 24) score += 8
  }

  // Signals
  const text = (snippet + ' ' + (company.description ?? '')).toLowerCase()
  if (intent.signals.includes('hiring') && (text.includes('hiring') || text.includes('join') || text.includes('team'))) score += 10
  if (intent.signals.includes('growth') && (text.includes('growth') || text.includes('scale') || text.includes('expanding'))) score += 8

  // Headcount signal (startups preferred)
  if (company.headcount && company.headcount < 200) score += 5

  return Math.min(score, 100)
}

export async function POST(request: NextRequest) {
  const log = routeLogger('POST /api/companies/search')
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      log.warn('Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query } = await request.json()
    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 })
    }

    log.req({ query, userId: user.id })

    // Get user profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_roles, target_industries, location, candidate_summary, name')
      .eq('id', user.id)
      .single()

    const userContext: CandidateContext = {
      name: profile?.name ?? null,
      candidateSummary: profile?.candidate_summary ?? '',
      targetRoles: profile?.target_roles ?? [],
      targetIndustries: profile?.target_industries ?? [],
      location: profile?.location ?? null,
    }

    // 1. Extract intent with Gemini
    const intent = await extractSearchIntent(query, userContext)
    log.step('gemini:intent', { industries: intent.industries, fundingStages: intent.fundingStages, keywords: intent.keywords })

    // 2. Search with Exa (or fall back to Gemini, then to hardcoded demo data)
    let exaResults = await searchCompanies(intent.keywords)
    let usingFallback = false
    log.step('exa:search', { keywords: intent.keywords, results: exaResults.length })

    if (exaResults.length === 0) {
      log.warn('exa returned 0 results — trying Gemini fallback')
      // Tier 2: Gemini-generated real companies
      const claudeResults = await generateFallbackCompanies(intent, userContext, query)
      if (claudeResults.length > 0) {
        exaResults = claudeResults
        usingFallback = true
        log.step('gemini:fallback', { results: claudeResults.length })
      } else {
        // Tier 3: hardcoded demo companies — always works, zero API calls
        exaResults = getDemoCompanies(intent.keywords, intent.industries)
        usingFallback = true
        log.warn('using hardcoded demo companies', { results: exaResults.length })
      }
    }

    // 3. Enrich top 5 with Crunchbase (cap API calls; rest get empty enrichment)
    const TOP_N_TO_ENRICH = 5
    const toEnrich = exaResults.slice(0, TOP_N_TO_ENRICH)
    const rest = exaResults.slice(TOP_N_TO_ENRICH)

    const [enrichedTop, enrichedRest] = await Promise.all([
      Promise.allSettled(
        toEnrich.map(async (r) => {
          // Skip Crunchbase if we already have fresh data in DB (48h TTL)
          const { data: cached } = await supabase
            .from('companies')
            .select('funding_stage, headcount, investors, total_funding, cb_enriched_at')
            .eq('domain', r.domain)
            .single()

          const ageHours = cached?.cb_enriched_at
            ? (Date.now() - new Date(cached.cb_enriched_at).getTime()) / 3_600_000
            : Infinity

          const crunchbaseData = ageHours < 48
            ? { funding_stage: cached!.funding_stage, headcount: cached!.headcount, investors: cached!.investors, total_funding: cached!.total_funding }
            : await enrichCompany(r.domain)

          return { ...r, crunchbase: crunchbaseData }
        })
      ),
      Promise.resolve(rest.map(r => ({ status: 'fulfilled' as const, value: { ...r, crunchbase: {} } }))),
    ])

    const enriched = [...enrichedTop, ...enrichedRest]

    // 4. Build company objects + scores
    const results: SearchResult[] = []

    for (const result of enriched) {
      if (result.status !== 'fulfilled') continue
      const r = result.value

      // Extract AI-generated metadata if present (fallback mode)
      const meta = (r as unknown as Record<string, unknown>)._meta as {
        stage?: string; headcount?: number; location?: string
        investors?: string[]; founded_year?: number
      } | undefined

      // Upsert company to DB
      const companyData: Partial<Company> = {
        name: r.name,
        domain: r.domain,
        website_url: r.url,
        source: usingFallback ? 'claude' : 'exa',
        description: r.snippet || undefined,
        funding_stage: meta?.stage ?? undefined,
        headcount: meta?.headcount ?? undefined,
        investors: meta?.investors ?? undefined,
        ...r.crunchbase,
      }

      const hasCrunchbaseData = Object.keys(r.crunchbase ?? {}).length > 0
      const { data: company, error: upsertError } = await supabase
        .from('companies')
        .upsert({
          ...companyData,
          name: r.name,
          domain: r.domain,
          ...(hasCrunchbaseData ? { cb_enriched_at: new Date().toISOString() } : {}),
        }, { onConflict: 'domain', ignoreDuplicates: false })
        .select()
        .single()

      // If Supabase upsert fails (e.g. tables not yet created), build an in-memory
      // company object so demo/fallback mode still works end-to-end.
      const resolvedCompany: Company = company ?? {
        id: `demo-${r.domain.replace(/\./g, '-')}`,
        name: r.name,
        domain: r.domain,
        website_url: r.url,
        funding_stage: meta?.stage ?? null,
        headcount: meta?.headcount ?? null,
        headcount_growth: null,
        total_funding: null,
        investors: meta?.investors ?? null,
        growth_signal: null,
        summary: null,
        why_fit: null,
        hiring_signals: null,
        red_flags: null,
        summary_updated_at: null,
        source: 'demo',
        logo_url: null,
        description: r.snippet || null,
        created_at: new Date().toISOString(),
      }
      if (upsertError) log.warn(`DB upsert failed for ${r.domain}`, upsertError.message)

      const score = scoreCompany(resolvedCompany, intent, r.snippet, query)

      results.push({
        company: resolvedCompany,
        relevance_score: score,
        exa_score: r.score ?? 0,
        match_reasons: [],
        snippet: r.snippet,
        url: r.url,
        published_date: r.published_date,
      })
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance_score - a.relevance_score)

    // Save query
    const { data: savedQuery } = await supabase
      .from('search_queries')
      .insert({
        user_id: user.id,
        raw_query: query,
        processed_intent: intent,
        result_count: results.length,
      })
      .select('id')
      .single()

    const final = results.slice(0, 15)
    log.res(200, { results: final.length, usingFallback, queryId: savedQuery?.id ?? null })
    return NextResponse.json({
      results: final,
      intent,
      query_id: savedQuery?.id ?? null,
      demo_mode: usingFallback,
    })
  } catch (err) {
    const log2 = routeLogger('POST /api/companies/search')
    log2.err('unhandled exception', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
