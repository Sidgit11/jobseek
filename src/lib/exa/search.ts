import type { NewsItem, SearchIntent } from '@/types'

interface ExaSearchResult {
  id: string
  title: string
  url: string
  publishedDate?: string
  author?: string
  score?: number
  text?: string
  highlights?: string[]
  summary?: string
}

interface ExaResponse {
  results: ExaSearchResult[]
}

async function exaRequest(endpoint: string, body: Record<string, unknown>): Promise<ExaResponse> {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) {
    return { results: [] }
  }

  const res = await fetch(`https://api.exa.ai${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.error(`Exa API error: ${res.status} ${res.statusText}`)
    return { results: [] }
  }

  return res.json()
}

export interface CompanySearchResult {
  name: string
  domain: string
  url: string
  snippet: string
  published_date: string | null
  score: number
  source: 'company_page' | 'news_extracted' | 'direct_lookup'
  funding_context?: string
}

// Words that signal a result is a news headline, not a company homepage
const NEWS_VERBS = /\b(raises|raised|launches|launched|acquires|acquired|announces|announced|hires|hired|closes|closed|secures|secured|wins|won|expands|expanded|partners|partnered|releases|released|funding|round|billion|million|series [a-e]|ipo|valued)\b/i

// Detect revenue-threshold queries
const REVENUE_PATTERN = /(\$?\d+[km]?\+?\s*(arr|mrr|revenue|annual recurring|million|m\b))|(\d+\s*million\s*(revenue|arr|mrr))/i

/** Extract apex domain: app.stripe.com → stripe.com */
function getApexDomain(hostname: string): string {
  const h = hostname.replace(/^www\./, '')
  const parts = h.split('.')
  const twoPartTLDs = new Set(['co.uk', 'co.in', 'com.au', 'co.nz', 'org.uk', 'net.au'])
  if (parts.length >= 3 && twoPartTLDs.has(parts.slice(-2).join('.'))) {
    return parts.slice(-3).join('.')
  }
  return parts.slice(-2).join('.')
}

function domainToName(domain: string): string {
  const base = domain.replace(/\.(com|io|ai|co|net|org|app|dev|tech|co\.uk|in)$/, '')
  return base.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function cleanCompanyName(title: string, domain: string): string {
  const segments = title
    .split(/\s*[|·]\s*|\s+[-–—]\s+|\s*:\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  const scored = segments
    .filter(s => !NEWS_VERBS.test(s))
    .map(s => ({ s, words: s.split(/\s+/).length }))
    .sort((a, b) => a.words - b.words)

  if (scored.length > 0 && scored[0].words <= 4) {
    return scored[0].s
  }

  return domainToName(domain)
}

const NEWS_MEDIA_DOMAINS = new Set([
  'techcrunch', 'forbes', 'bloomberg', 'wired', 'wsj', 'theverge',
  'venturebeat', 'businessinsider', 'inc42', 'yourstory', 'vccircle',
  'economic times', 'moneycontrol', 'cnbc', 'reuters', 'ft',
])

// Domains that should never appear as company results
const BLOCKED_DOMAINS = new Set([
  // Social / content platforms
  'linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'youtube.com', 'reddit.com', 'medium.com', 'wikipedia.org', 'github.com',
  // Job boards & data aggregators
  'glassdoor.com', 'indeed.com', 'crunchbase.com', 'pitchbook.com',
  'wellfound.com', 'angellist.com', 'tracxn.com',
  'levels.fyi', 'teamblind.com', 'comparably.com',
  // Too generic
  'google.com', 'apple.com', 'amazon.com',
  // Recruiting / hiring / job platforms
  'hired.com', 'toptal.com', 'triplebyte.com', 'turing.com',
  'upwork.com', 'fiverr.com', 'gun.io', 'remoteok.com',
  'weworkremotely.com', 'builtin.com', 'dice.com',
  'ziprecruiter.com', 'monster.com', 'careerbuilder.com',
  // ATS platforms (we probe these separately, don't want them as results)
  'lever.co', 'greenhouse.io', 'ashbyhq.com', 'workable.com', 'recruitee.com',
])

// Patterns that indicate a company is a recruiting/staffing/talent platform
export const RECRUITING_PATTERNS = /\b(recruiting|staffing|talent acquisition|job board|hiring platform|recruitment agency|headhunting|career platform|talent sourcing|applicant tracking|HR tech|HR SaaS|human resources software|recruiting software|talent management|candidate sourcing)\b/i

function isBlockedDomain(domain: string): boolean {
  return BLOCKED_DOMAINS.has(domain) || Array.from(NEWS_MEDIA_DOMAINS).some(d => domain.includes(d))
}

/** Direct company lookups like "Stripe", "Razorpay" vs discovery queries */
function isDirectCompanyLookup(query: string): boolean {
  const words = query.trim().split(/\s+/)
  if (words.length === 0 || words.length > 3) return false
  if (!/^[A-Z]/.test(words[0])) return false
  const discoveryTerms = new Set([
    'hiring', 'startup', 'startups', 'series', 'seed', 'ai', 'ml',
    'nyc', 'remote', 'engineer', 'engineers', 'engineering',
    'companies', 'company', 'funded', 'funding', 'growth',
    'saas', 'fintech', 'healthtech', 'devtools', 'crypto',
    'b2b', 'b2c', 'enterprise', 'consumer', 'climate',
  ])
  for (const w of words) {
    if (discoveryTerms.has(w.toLowerCase())) return false
  }
  return true
}

function deduplicateByDomain(results: CompanySearchResult[]): CompanySearchResult[] {
  const seen = new Map<string, CompanySearchResult>()
  for (const r of results) {
    const existing = seen.get(r.domain)
    if (!existing) {
      seen.set(r.domain, r)
    } else if (r.source === 'company_page' && existing.source !== 'company_page') {
      seen.set(r.domain, r)
    } else if (r.source === existing.source && r.score > existing.score) {
      seen.set(r.domain, r)
    }
  }
  return Array.from(seen.values())
}

// Words that describe user intent, not company characteristics.
// These pollute the Exa query and cause it to return companies ABOUT hiring/recruiting
// instead of companies that ARE hiring.
const QUERY_NOISE_WORDS = new Set([
  // Action words (what the user wants, not what the company is)
  'hiring', 'looking', 'seeking', 'searching', 'jobs', 'roles', 'openings',
  'positions', 'team', 'work', 'join', 'apply',
  // Role words (handled separately via roleSignal — don't leak into Exa query)
  'engineer', 'engineers', 'engineering', 'pm', 'pms', 'designer', 'designers',
  'developer', 'developers', 'manager', 'managers', 'analyst', 'analysts',
  'marketer', 'marketers', 'marketing',
  // Meta words (Exa category:company already filters for companies)
  'startups', 'startup', 'companies', 'company', 'firms', 'firm',
  'product',
])

/**
 * Build a rich query string from intent fields for company page search.
 * CRITICAL: Strip user-intent words (hiring, engineers, startups) that cause
 * Exa to return recruiting platforms instead of actual companies.
 */
export function buildCompanyQuery(intent: SearchIntent): string {
  // Start with keywords but strip noise words
  const parts: string[] = intent.keywords.filter(k =>
    !QUERY_NOISE_WORDS.has(k.toLowerCase())
  )

  // Add top sectors if not already in keywords
  for (const sector of intent.sectors.slice(0, 2)) {
    if (!parts.some(p => p.toLowerCase().includes(sector))) {
      parts.push(sector)
    }
  }

  // Add expanded geo terms (top 3 cities) if not already present
  for (const geo of intent.expandedGeo.slice(0, 3)) {
    if (!parts.some(p => p.toLowerCase().includes(geo))) {
      parts.push(geo)
    }
  }

  // Add funding stage if present (this IS a company attribute)
  for (const stage of intent.fundingStages) {
    const readable = stage.replace(/-/g, ' ')
    if (!parts.some(p => p.toLowerCase().includes(readable))) {
      parts.push(readable)
    }
  }

  // If we stripped everything meaningful, add "technology company" as a base
  if (parts.length === 0) {
    parts.push('technology company')
  }

  return parts.join(' ')
}

/**
 * Build a news query string enhanced by implicit signals.
 */
function buildNewsQuery(intent: SearchIntent): string {
  // Strip noise words from keywords for news query too
  const parts: string[] = intent.keywords.filter(k =>
    !QUERY_NOISE_WORDS.has(k.toLowerCase())
  )

  // Add sectors for news context
  for (const sector of intent.sectors.slice(0, 2)) {
    if (!parts.some(p => p.toLowerCase().includes(sector))) {
      parts.push(sector)
    }
  }

  if (intent.implicitSignals.includes('recently_funded')) {
    parts.push('raised funding round 2025 2026')
  } else {
    parts.push('funding announcement 2024 2025')
  }

  if (intent.temporal === 'active_hiring') {
    parts.push('hiring expanding team')
  }

  return parts.join(' ')
}

/**
 * Determine date range for news search based on temporal signal.
 */
function getNewsDateRange(intent: SearchIntent): string {
  const now = Date.now()
  if (intent.temporal === 'recently_funded' || intent.implicitSignals.includes('recently_funded')) {
    // Tighter window: 6 months for recently funded
    return new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }
  // Default: 12 months
  return new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

/**
 * PRIMARY SEARCH: category:company — returns actual company homepages.
 */
async function searchCompanyPages(query: string, numResults = 20): Promise<CompanySearchResult[]> {
  const data = await exaRequest('/search', {
    query,
    numResults,
    type: 'neural',
    category: 'company',
    useAutoprompt: true,
    contents: {
      summary: { query: 'company description funding stage product hiring team size location' },
    },
  })

  const results: CompanySearchResult[] = []
  for (const r of data.results) {
    if (!r.url) continue
    let url: URL
    try { url = new URL(r.url) } catch { continue }
    const domain = getApexDomain(url.hostname)
    if (isBlockedDomain(domain)) continue

    results.push({
      name: cleanCompanyName(r.title, domain),
      domain,
      url: r.url,
      snippet: r.summary ?? r.highlights?.[0] ?? r.text?.slice(0, 200) ?? '',
      published_date: r.publishedDate ?? null,
      score: r.score ?? 0.5,
      source: 'company_page',
    })
  }
  return results
}

/**
 * NEWS CONTEXT PASS: neural search on tech/startup news domains.
 */
async function searchNewsForCompanies(
  query: string,
  startDate: string,
  numResults = 15
): Promise<CompanySearchResult[]> {
  const newsDomains = [
    'techcrunch.com', 'venturebeat.com', 'inc42.com', 'yourstory.com',
    'vccircle.com', 'businesswire.com', 'prnewswire.com',
    'bloomberg.com', 'forbes.com',
  ]

  const data = await exaRequest('/search', {
    query,
    numResults,
    type: 'neural',
    useAutoprompt: true,
    includeDomains: newsDomains,
    startPublishedDate: startDate,
    contents: {
      summary: { query: 'company name funding stage ARR revenue investors hiring' },
    },
  })

  const results: CompanySearchResult[] = []
  for (const r of data.results) {
    if (!r.url || !r.title) continue
    const companyName = r.title.split(/\s+(raises|hits|reaches|surpasses|launches|acquires|closes|secures|announces)\s/i)[0]?.trim()
    if (!companyName || companyName.length > 60) continue

    const guessedDomain = companyName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '') + '.com'

    results.push({
      name: companyName,
      domain: guessedDomain,
      url: r.url,
      snippet: r.summary ?? r.text?.slice(0, 200) ?? '',
      published_date: r.publishedDate ?? null,
      score: r.score ?? 0.3,
      source: 'news_extracted',
      funding_context: r.summary?.slice(0, 150),
    })
  }
  return results
}

/**
 * REVENUE QUERY STRATEGY:
 * Exa cannot filter by revenue threshold — search press releases for ARR milestones.
 */
async function searchRevenueCompanies(rawQuery: string): Promise<CompanySearchResult[]> {
  const match = rawQuery.match(/(\$?\d+[km]?)\s*(arr|mrr|revenue|million|m\b)/i)
  const revenueStr = match ? match[0] : '10 million ARR'

  const newsQuery = `startup company ${revenueStr} annual recurring revenue milestone 2024 2025`
  const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return searchNewsForCompanies(newsQuery, startDate, 12)
}

/**
 * Main search entry point — accepts full SearchIntent for richer query construction.
 */
export async function searchCompanies(intent: SearchIntent): Promise<CompanySearchResult[]> {
  const rawQuery = intent.keywords.join(' ')
  const isDirect = isDirectCompanyLookup(rawQuery)
  const isRevenue = REVENUE_PATTERN.test(rawQuery)

  // ── Path 1: Direct company lookup ─────────────────────────────────────────────
  if (isDirect) {
    const queryLower = rawQuery.toLowerCase().replace(/\s+/g, '')
    const domainGuesses = [
      `${queryLower}.com`, `${queryLower}.io`, `${queryLower}.ai`,
      `${queryLower}.co`, `${queryLower}.app`,
    ]

    const data = await exaRequest('/search', {
      query: `${rawQuery} official website company`,
      numResults: 10,
      type: 'neural',
      useAutoprompt: false,
      contents: {
        summary: { query: 'company description product team funding headquarters' },
      },
    })

    const results: CompanySearchResult[] = []
    let foundExactMatch = false

    for (const r of data.results) {
      if (!r.url) continue
      let domain = 'unknown'
      try { domain = getApexDomain(new URL(r.url).hostname) } catch { continue }

      const name = cleanCompanyName(r.title, domain)
      const nameMatch = name.toLowerCase().includes(queryLower) || domain.includes(queryLower)

      if (nameMatch && !foundExactMatch) {
        foundExactMatch = true
        results.unshift({
          name: rawQuery,
          domain,
          url: r.url,
          snippet: r.summary ?? r.text?.slice(0, 200) ?? '',
          published_date: r.publishedDate ?? null,
          score: 1.0,
          source: 'direct_lookup',
        })
      } else if (!isBlockedDomain(domain)) {
        results.push({
          name,
          domain,
          url: r.url,
          snippet: r.summary ?? r.text?.slice(0, 200) ?? '',
          published_date: r.publishedDate ?? null,
          score: r.score ?? 0.3,
          source: 'company_page',
        })
      }
    }

    if (!foundExactMatch) {
      results.unshift({
        name: rawQuery,
        domain: domainGuesses[0],
        url: `https://${domainGuesses[0]}`,
        snippet: `${rawQuery} — search for more details about this company.`,
        published_date: null,
        score: 1.0,
        source: 'direct_lookup',
      })
    }

    return deduplicateByDomain(results).slice(0, 10)
  }

  // ── Path 2: Revenue-threshold query ───────────────────────────────────────────
  if (isRevenue) {
    const revenueResults = await searchRevenueCompanies(rawQuery)
    return revenueResults.slice(0, 15)
  }

  // ── Path 3: Discovery query — use intent graph for richer queries ─────────────
  const companyPageQuery = buildCompanyQuery(intent)
  const newsQuery = buildNewsQuery(intent)
  const newsStartDate = getNewsDateRange(intent)

  // Determine if news pass should run:
  // - Always for recently_funded implicit signal
  // - Always for explicit funding stage or geo queries
  const shouldRunNews = intent.implicitSignals.includes('recently_funded')
    || intent.fundingStages.length > 0
    || intent.expandedGeo.length > 0
    || intent.signals.includes('recent-funding')

  const [companyResults, newsResults] = await Promise.all([
    searchCompanyPages(companyPageQuery, 20),
    shouldRunNews ? searchNewsForCompanies(newsQuery, newsStartDate, 12) : Promise.resolve([]),
  ])

  // Merge: company pages take precedence, news results fill gaps
  const merged = deduplicateByDomain([...companyResults, ...newsResults])

  // Re-score: company_page results get a boost
  const rescored = merged.map(r => ({
    ...r,
    score: r.source === 'company_page' ? r.score + 0.3 : r.score,
  }))

  return rescored
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
}

export async function searchCompanyNews(companyName: string): Promise<NewsItem[]> {
  const data = await exaRequest('/search', {
    query: `${companyName} news hiring product launch funding 2024 2025`,
    numResults: 5,
    type: 'neural',
    startPublishedDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    contents: {
      summary: { query: 'company news update announcement' },
    },
  })

  return data.results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.summary ?? r.highlights?.[0] ?? r.text?.slice(0, 200) ?? '',
    published_date: r.publishedDate ?? null,
  }))
}
