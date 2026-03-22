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

// ── RELEVANCE SCORE: How well does this company match the SEARCH QUERY? ──────
// Factors: name match, funding stage match, sector match, geo match, keyword signals
function scoreRelevance(
  company: Partial<Company>,
  intent: SearchIntent,
  snippet: string,
  rawQuery?: string,
): number {
  let score = 30 // base

  const text = (snippet + ' ' + (company.description ?? '')).toLowerCase()

  // Name match (strongest relevance signal)
  if (rawQuery) {
    const q = rawQuery.toLowerCase()
    if (company.name && company.name.toLowerCase().includes(q)) score += 35
    else if (company.domain && company.domain.toLowerCase().includes(q)) score += 25
  }

  // Funding stage match (user asked for Series B → company is Series B)
  const fs = company.funding_stage?.toLowerCase() ?? ''
  const wantedStages = intent.fundingStages.map(s => s.toLowerCase())
  if (wantedStages.length > 0 && wantedStages.some(s => fs.includes(s.replace('-', ' ').replace('_', ' ')))) score += 20

  // Sector match (user asked for AI → company is AI)
  if (intent.sectors.length > 0) {
    const sectorMatches = intent.sectors.filter(s => text.includes(s)).length
    score += Math.min(sectorMatches * 7, 20)
  }

  // Geo match (user asked for India → company is in India)
  if (intent.expandedGeo.length > 0) {
    if (intent.expandedGeo.some(g => text.includes(g))) score += 15
  }

  // Signal match (user asked for hiring → company mentions hiring)
  if (intent.signals.includes('hiring') && (text.includes('hiring') || text.includes('join') || text.includes('team'))) score += 10
  if (intent.signals.includes('growth') && (text.includes('growth') || text.includes('scale') || text.includes('expanding'))) score += 8

  // Implicit signal match
  if (intent.implicitSignals.includes('small_team') && company.headcount && company.headcount < 100) score += 5
  if (intent.implicitSignals.includes('recently_funded') && company.last_round_date) {
    const months = (Date.now() - new Date(company.last_round_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
    if (months < 6) score += 8
  }

  return Math.min(score, 100)
}

// ── FIT SCORE: How well does this company match the USER PROFILE? ────────────
// Factors: ATS role match, industry overlap, stage preference, seniority alignment,
// experience overlap, location match
function scoreFit(
  company: Partial<Company>,
  userContext: CandidateContext,
  snippet: string,
  atsData?: ATSResult | null,
): number {
  let score = 20 // base

  const text = (snippet + ' ' + (company.description ?? '')).toLowerCase()

  // ── ATS hiring signals (strongest fit indicator) ──────────────────────────────
  if (atsData) {
    if (atsData.matched_roles.length > 0) score += 25 // direct role match
    else if (atsData.total_open_roles > 0) score += 10
    if (atsData.total_open_roles >= 5) score += 5 // hiring surge
    const recentRoles = atsData.open_roles.filter(r =>
      r.posted_date && daysSince(r.posted_date) < 14
    )
    if (recentRoles.length > 0) score += 5
  }

  // ── Industry match (user targets AI/ML → company is in AI) ────────────────────
  if (userContext.targetIndustries.length > 0) {
    const industryMatches = userContext.targetIndustries.filter(ind => {
      const terms = ind.toLowerCase().split(/\s*[\/,]\s*/)
      return terms.some(t => t.length > 2 && text.includes(t))
    }).length
    score += Math.min(industryMatches * 8, 15)
  }

  // ── Company stage preference match ────────────────────────────────────────────
  if (userContext.companyStages.length > 0 && company.funding_stage) {
    const fsLower = company.funding_stage.toLowerCase()
    const stageMatch = userContext.companyStages.some(s =>
      fsLower.includes(s.toLowerCase().replace('early stage ', '').replace(' stage', '').trim())
    )
    if (stageMatch) score += 12
  }

  // ── Location match ────────────────────────────────────────────────────────────
  if (userContext.targetLocations.length > 0) {
    const locMatch = userContext.targetLocations.some(loc =>
      text.includes(loc.toLowerCase())
    )
    if (locMatch) score += 8
  }

  // ── Experience overlap (user worked at similar companies/domains) ──────────────
  if (userContext.linkedinExperience && userContext.linkedinExperience.length > 0) {
    for (const exp of userContext.linkedinExperience) {
      const expCompany = exp.company.toLowerCase()
      const expTitle = exp.title.toLowerCase()
      // Check if user's past company or domain overlaps with target
      if (text.includes(expCompany) || text.split(/\s+/).some(w => w.length > 4 && expCompany.includes(w))) {
        score += 10
        break
      }
      // Check if user's past role domain overlaps (e.g., "product" in both)
      const roleWords = expTitle.split(/\s+/).filter(w => w.length > 3)
      if (roleWords.some(w => text.includes(w))) {
        score += 5
        break
      }
    }
  }

  // ── Seniority alignment ───────────────────────────────────────────────────────
  if (userContext.seniority && company.headcount) {
    const isSenior = ['senior', 'lead', 'management', 'executive'].includes(userContext.seniority)
    const isEarlyStage = company.headcount < 100
    // Senior people + early-stage = high opportunity fit
    if (isSenior && isEarlyStage) score += 10
    // Mid-level + mid-size = good match
    if (userContext.seniority === 'mid' && company.headcount >= 50 && company.headcount <= 500) score += 5
  }

  // ── Recent funding bonus (active hiring likelihood) ───────────────────────────
  if (company.last_round_date) {
    const months = (Date.now() - new Date(company.last_round_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
    if (months < 6) score += 8
    else if (months < 12) score += 4
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

    const searchStart = Date.now()
    log.req({ query, userId: user.id })

    // Get user profile for context
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

    // 1. Extract intent with Gemini
    const intentStart = Date.now()
    const intent = await extractSearchIntent(query, userContext)
    log.step('1-intent', {
      ms: Date.now() - intentStart,
      companyName: intent.companyName, confidence: intent.confidence,
      keywords: intent.keywords, sectors: intent.sectors,
      implicitSignals: intent.implicitSignals, temporal: intent.temporal,
    })

    // ═══════════════════════════════════════════════════════════════════════════
    // PATH A: Direct company lookup (confidence > 0.9 + companyName set)
    // Skip Exa entirely — go straight to Crunchbase + ATS
    // ═══════════════════════════════════════════════════════════════════════════
    if (intent.companyName && intent.confidence > 0.9) {
      log.step('2-fast-path', { companyName: intent.companyName })
      const domain = guessDomain(intent.companyName)

      // Crunchbase + ATS in parallel
      const enrichStart = Date.now()
      const [crunchbaseData, atsData] = await Promise.all([
        enrichCompany(domain),
        probeCompanyATS(domain, userContext.targetRoles),
      ])
      log.step('3-enrich+ats', {
        ms: Date.now() - enrichStart,
        crunchbase: Object.keys(crunchbaseData ?? {}).length > 0,
        ats: atsData ? { platform: atsData.ats, jobs: atsData.total_open_roles, matched: atsData.matched_roles.length } : null,
      })

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

      const relevanceScore = scoreRelevance(resolvedCompany, intent, '', query)
      const fitScore = scoreFit(resolvedCompany, userContext, '', atsData)

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
        fit_score: fitScore,
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

      log.res(200, { path: 'direct', companyName: intent.companyName, atsFound: !!atsData, totalMs: Date.now() - searchStart, queryId: savedQuery?.id })
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
    const exaStart = Date.now()
    let exaResults: CompanySearchResult[] = await searchCompanies(intent)
    let usingFallback = false
    log.step('2-exa', { ms: Date.now() - exaStart, keywords: intent.keywords, results: exaResults.length })

    if (exaResults.length === 0) {
      log.warn('2-exa:empty', { keywords: intent.keywords })
      const fallbackStart = Date.now()
      const claudeResults = await generateFallbackCompanies(intent, userContext, query)
      if (claudeResults.length > 0) {
        exaResults = claudeResults
        usingFallback = true
        log.step('2-fallback:gemini', { ms: Date.now() - fallbackStart, results: claudeResults.length })
      } else {
        exaResults = getDemoCompanies(intent.keywords, intent.industries)
        usingFallback = true
        log.warn('2-fallback:demo', { results: exaResults.length })
      }
    }

    // 3. Enrich top 5 with Crunchbase
    const cbStart = Date.now()
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
    log.step('3-crunchbase', { ms: Date.now() - cbStart, enriched: TOP_N_TO_ENRICH, total: enriched.length })

    // 4. ATS probing for top 10 (parallel, free, no API key)
    const atsStart = Date.now()
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
    log.step('4-ats', {
      ms: Date.now() - atsStart,
      probed: Math.min(enriched.length, TOP_N_ATS),
      found: atsMap.size,
      platforms: [...atsMap.values()].map(a => `${a.slug}@${a.ats}(${a.total_open_roles}jobs/${a.matched_roles.length}matched)`),
    })

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
      const relevance = scoreRelevance(resolvedCompany, intent, r.snippet, query)
      const fit = scoreFit(resolvedCompany, userContext, r.snippet, atsData)

      results.push({
        company: resolvedCompany,
        relevance_score: relevance,
        fit_score: fit,
        exa_score: r.score ?? 0,
        match_reasons: [],
        snippet: r.snippet,
        url: r.url,
        published_date: r.published_date,
        ats: atsData ?? undefined,
      })
    }

    log.step('5-scored', {
      results: results.length,
      topScores: results.slice(0, 5).map(r => ({ name: r.company.name, relevance: r.relevance_score, fit: r.fit_score, ats: !!r.ats })),
    })

    // Sort by combined score (relevance * 0.4 + fit * 0.6) — fit matters more
    results.sort((a, b) => {
      const aCombo = a.relevance_score * 0.4 + a.fit_score * 0.6
      const bCombo = b.relevance_score * 0.4 + b.fit_score * 0.6
      return bCombo - aCombo
    })

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
    const briefStart = Date.now()
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
    log.step('6-briefs', { ms: Date.now() - briefStart, count: briefResults.filter(b => b.status === 'fulfilled').length })

    // Save query
    const { data: savedQuery } = await supabase
      .from('search_queries')
      .insert({ user_id: user.id, raw_query: query, processed_intent: intent, result_count: results.length })
      .select('id').single()

    const final = results.slice(0, 15)
    log.res(200, { path: 'discovery', results: final.length, usingFallback, atsFound: atsMap.size, totalMs: Date.now() - searchStart, queryId: savedQuery?.id })
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
