import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractSearchIntent } from '@/lib/anthropic/intent-extraction'
import { searchCompanies } from '@/lib/exa/search'
import { enrichCompany } from '@/lib/crunchbase/enrich'
import { generateFallbackCompanies } from '@/lib/anthropic/company-discovery'
import { getDemoCompanies } from '@/lib/demo/companies'
import { generateTargetingBrief } from '@/lib/anthropic/targeting-brief'
import { probeCompanyATS, guessDomain } from '@/lib/ats/probe'
import { routeLogger } from '@/lib/logger'
import type { Company, SearchResult, SearchIntent, CandidateContext, ATSResult } from '@/types'
import type { CompanySearchResult } from '@/lib/exa/search'

function daysSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
}

function scoreCompany(
  company: Partial<Company>,
  intent: SearchIntent,
  snippet: string,
  rawQuery?: string,
  atsData?: ATSResult | null,
): number {
  let score = 50 // base

  // Name match bonus
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

  // ── Intent graph bonuses ──────────────────────────────────────────────────────
  if (intent.implicitSignals.includes('small_team') && company.headcount && company.headcount < 100) score += 10
  if (intent.implicitSignals.includes('recently_funded') && company.last_round_date) {
    const months = (Date.now() - new Date(company.last_round_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
    if (months < 6) score += 12
  }
  if (intent.sectors.length > 0) {
    const sectorMatches = intent.sectors.filter(s => text.includes(s)).length
    score += Math.min(sectorMatches * 5, 15)
  }
  if (intent.expandedGeo.length > 0) {
    if (intent.expandedGeo.some(g => text.includes(g))) score += 10
  }

  // ── ATS hiring signal bonuses ─────────────────────────────────────────────────
  if (atsData) {
    if (atsData.total_open_roles > 0) score += 15
    if (atsData.matched_roles.length > 0) score += 20
    if (atsData.total_open_roles >= 5) score += 10 // hiring surge
    const recentRoles = atsData.open_roles.filter(r =>
      r.posted_date && daysSince(r.posted_date) < 14
    )
    if (recentRoles.length > 0) score += 8
  }

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
    log.step('intent', {
      companyName: intent.companyName, confidence: intent.confidence,
      keywords: intent.keywords, sectors: intent.sectors,
      implicitSignals: intent.implicitSignals,
    })

    // ═══════════════════════════════════════════════════════════════════════════
    // PATH A: Direct company lookup (confidence > 0.9 + companyName set)
    // Skip Exa entirely — go straight to Crunchbase + ATS
    // ═══════════════════════════════════════════════════════════════════════════
    if (intent.companyName && intent.confidence > 0.9) {
      log.step('fast-path', { companyName: intent.companyName })
      const domain = guessDomain(intent.companyName)

      // Crunchbase + ATS in parallel
      const [crunchbaseData, atsData] = await Promise.all([
        enrichCompany(domain),
        probeCompanyATS(domain, userContext.targetRoles),
      ])

      const companyData: Partial<Company> = {
        name: intent.companyName,
        domain,
        website_url: `https://${domain}`,
        source: 'direct_lookup',
        ...crunchbaseData,
      }

      // Upsert to DB
      const hasCrunchbaseData = Object.keys(crunchbaseData ?? {}).length > 0
      const { data: company } = await supabase
        .from('companies')
        .upsert({
          ...companyData,
          name: intent.companyName,
          domain,
          ...(hasCrunchbaseData ? { cb_enriched_at: new Date().toISOString() } : {}),
        }, { onConflict: 'domain', ignoreDuplicates: false })
        .select()
        .single()

      const resolvedCompany: Company = company ?? {
        id: `direct-${domain.replace(/\./g, '-')}`,
        name: intent.companyName,
        domain,
        website_url: `https://${domain}`,
        funding_stage: null, headcount: null, headcount_growth: null,
        total_funding: null, investors: null, growth_signal: null,
        summary: null, why_fit: null, hiring_signals: null, red_flags: null,
        summary_updated_at: null, source: 'direct_lookup',
        logo_url: null, description: null,
        created_at: new Date().toISOString(),
        ...crunchbaseData,
      }

      const relevanceScore = scoreCompany(resolvedCompany, intent, '', query, atsData)

      // Generate targeting brief
      let brief = undefined
      try {
        brief = await generateTargetingBrief(
          resolvedCompany, intent, userContext,
          resolvedCompany.description ?? '', atsData
        )
      } catch {}

      const result: SearchResult = {
        company: resolvedCompany,
        relevance_score: relevanceScore,
        exa_score: 1.0,
        match_reasons: [],
        snippet: resolvedCompany.description,
        url: `https://${domain}`,
        published_date: null,
        brief,
        ats: atsData ?? undefined,
      }

      // Save query
      const { data: savedQuery } = await supabase
        .from('search_queries')
        .insert({ user_id: user.id, raw_query: query, processed_intent: intent, result_count: 1 })
        .select('id').single()

      log.res(200, { path: 'direct', companyName: intent.companyName, atsFound: !!atsData, queryId: savedQuery?.id })
      return NextResponse.json({
        results: [result],
        intent,
        query_id: savedQuery?.id ?? null,
        demo_mode: false,
      })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PATH B: Discovery query — Exa + Crunchbase + ATS
    // ═══════════════════════════════════════════════════════════════════════════

    // 2. Search with Exa
    let exaResults: CompanySearchResult[] = await searchCompanies(intent)
    let usingFallback = false
    log.step('exa:search', { keywords: intent.keywords, results: exaResults.length })

    if (exaResults.length === 0) {
      log.warn('exa returned 0 results — trying Gemini fallback')
      const claudeResults = await generateFallbackCompanies(intent, userContext, query)
      if (claudeResults.length > 0) {
        exaResults = claudeResults
        usingFallback = true
        log.step('gemini:fallback', { results: claudeResults.length })
      } else {
        exaResults = getDemoCompanies(intent.keywords, intent.industries)
        usingFallback = true
        log.warn('using demo companies', { results: exaResults.length })
      }
    }

    // 3. Enrich top 5 with Crunchbase
    const TOP_N_TO_ENRICH = 5
    const toEnrich = exaResults.slice(0, TOP_N_TO_ENRICH)
    const rest = exaResults.slice(TOP_N_TO_ENRICH)

    const [enrichedTop, enrichedRest] = await Promise.all([
      Promise.allSettled(
        toEnrich.map(async (r) => {
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

    // 4. ATS probing for top 10 (parallel, free, no API key)
    const TOP_N_ATS = 10
    const atsMap = new Map<string, ATSResult>()
    const atsPromises = enriched.slice(0, TOP_N_ATS).map(async (result) => {
      if (result.status !== 'fulfilled') return
      const domain = result.value.domain
      try {
        const ats = await probeCompanyATS(domain, userContext.targetRoles)
        if (ats) atsMap.set(domain, ats)
      } catch {}
    })
    await Promise.allSettled(atsPromises)
    log.step('ats:probe', { probed: Math.min(enriched.length, TOP_N_ATS), found: atsMap.size })

    // 5. Build company objects + scores
    const results: SearchResult[] = []

    for (const result of enriched) {
      if (result.status !== 'fulfilled') continue
      const r = result.value

      const meta = (r as unknown as Record<string, unknown>)._meta as {
        stage?: string; headcount?: number; location?: string
        investors?: string[]; founded_year?: number
      } | undefined

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

      const resolvedCompany: Company = company ?? {
        id: `demo-${r.domain.replace(/\./g, '-')}`,
        name: r.name, domain: r.domain, website_url: r.url,
        funding_stage: meta?.stage ?? null, headcount: meta?.headcount ?? null,
        headcount_growth: null, total_funding: null, investors: meta?.investors ?? null,
        growth_signal: null, summary: null, why_fit: null, hiring_signals: null,
        red_flags: null, summary_updated_at: null, source: 'demo',
        logo_url: null, description: r.snippet || null,
        created_at: new Date().toISOString(),
      }
      if (upsertError) log.warn(`DB upsert failed for ${r.domain}`, upsertError.message)

      const atsData = atsMap.get(r.domain) ?? null
      const score = scoreCompany(resolvedCompany, intent, r.snippet, query, atsData)

      results.push({
        company: resolvedCompany,
        relevance_score: score,
        exa_score: r.score ?? 0,
        match_reasons: [],
        snippet: r.snippet,
        url: r.url,
        published_date: r.published_date,
        ats: atsData ?? undefined,
      })
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance_score - a.relevance_score)

    // Company name filter
    if (intent.companyName && intent.confidence >= 0.7) {
      const targetName = intent.companyName.toLowerCase()
      const filtered = results.filter(r => {
        const name = r.company.name.toLowerCase()
        const domain = (r.company.domain ?? '').toLowerCase()
        return name.includes(targetName) || targetName.includes(name) || domain.includes(targetName.replace(/\s+/g, ''))
      })
      if (filtered.length > 0) {
        const nonMatching = results.filter(r => !filtered.includes(r))
        results.length = 0
        results.push(...filtered, ...nonMatching)
        log.step('company-filter', { companyName: intent.companyName, matched: filtered.length })
      }
    }

    // 6. Generate targeting briefs for top 5 (with ATS data)
    const TOP_N_BRIEFS = 5
    const briefResults = await Promise.allSettled(
      results.slice(0, TOP_N_BRIEFS).map(r =>
        generateTargetingBrief(r.company, intent, userContext, r.snippet ?? '', r.ats ?? null)
      )
    )
    for (let i = 0; i < briefResults.length; i++) {
      if (briefResults[i].status === 'fulfilled') {
        results[i].brief = (briefResults[i] as PromiseFulfilledResult<typeof results[0]['brief']>).value
      }
    }
    log.step('briefs', { count: briefResults.filter(b => b.status === 'fulfilled').length })

    // Save query
    const { data: savedQuery } = await supabase
      .from('search_queries')
      .insert({ user_id: user.id, raw_query: query, processed_intent: intent, result_count: results.length })
      .select('id').single()

    const final = results.slice(0, 15)
    log.res(200, { path: 'discovery', results: final.length, usingFallback, atsFound: atsMap.size, queryId: savedQuery?.id })
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
