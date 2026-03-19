import type { NewsItem } from '@/types'

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
  // Source metadata for debugging and ranking
  source: 'company_page' | 'news_extracted' | 'direct_lookup'
  funding_context?: string  // funding stage / ARR found in news pass
}

// Words that signal a result is a news headline, not a company homepage
const NEWS_VERBS = /\b(raises|raised|launches|launched|acquires|acquired|announces|announced|hires|hired|closes|closed|secures|secured|wins|won|expands|expanded|partners|partnered|releases|released|funding|round|billion|million|series [a-e]|ipo|valued)\b/i

// Detect revenue-threshold queries — Exa can't filter by ARR/revenue directly
const REVENUE_PATTERN = /(\$?\d+[km]?\+?\s*(arr|mrr|revenue|annual recurring|million|m\b))|(\d+\s*million\s*(revenue|arr|mrr))/i

// Detect geographic terms in query
const GEO_TERMS = /\b(india|bangalore|bengaluru|mumbai|delhi|hyderabad|chennai|us|usa|nyc|new york|london|singapore|europe|latam|remote)\b/i

// Funding stage terms
const FUNDING_TERMS = /\b(seed|pre-seed|series [a-f]|series a|series b|series c|growth|late stage|pre-ipo|bootstrap)\b/i

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

function isNewsDomain(domain: string): boolean {
  return Array.from(NEWS_MEDIA_DOMAINS).some(d => domain.includes(d))
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

/**
 * Classify what kind of search the user wants so we can route to the right Exa strategy.
 */
function classifyQuery(keywords: string[]): {
  isRevenue: boolean
  isHiring: boolean
  isDirect: boolean
  hasGeo: boolean
  hasFundingStage: boolean
  rawQuery: string
} {
  const rawQuery = keywords.join(' ')
  return {
    isRevenue:       REVENUE_PATTERN.test(rawQuery),
    isHiring:        /\b(hiring|jobs|roles|open positions|recruiting)\b/i.test(rawQuery),
    isDirect:        isDirectCompanyLookup(rawQuery),
    hasGeo:          GEO_TERMS.test(rawQuery),
    hasFundingStage: FUNDING_TERMS.test(rawQuery),
    rawQuery,
  }
}

function deduplicateByDomain(results: CompanySearchResult[]): CompanySearchResult[] {
  const seen = new Map<string, CompanySearchResult>()
  for (const r of results) {
    const existing = seen.get(r.domain)
    // Prefer company_page source over news_extracted; then higher score
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

/**
 * PRIMARY SEARCH: category:company — returns actual company homepages.
 * Best for: discovery queries, geographic/stage/role filters.
 * Note: date filters are NOT supported in category:company mode.
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
    if (isNewsDomain(domain)) continue

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
 * Used to find funding context (stage, investors, ARR) and extract company names.
 * Returns company domains extracted from news coverage.
 */
async function searchNewsForCompanies(
  query: string,
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
    startPublishedDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    contents: {
      summary: { query: 'company name funding stage ARR revenue investors hiring' },
    },
  })

  // Extract company domains from news articles — look for company homepage links
  // For now, extract company name from title and mark as news_extracted
  const results: CompanySearchResult[] = []
  for (const r of data.results) {
    if (!r.url || !r.title) continue
    // News articles aren't company pages — we capture context only
    // The company name is the subject of the article (before " Raises", " Hits", " Launches" etc.)
    const companyName = r.title.split(/\s+(raises|hits|reaches|surpasses|launches|acquires|closes|secures|announces)\s/i)[0]?.trim()
    if (!companyName || companyName.length > 60) continue

    // Guess domain from company name — will be enriched/corrected by Crunchbase later
    const guessedDomain = companyName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '') + '.com'

    results.push({
      name: companyName,
      domain: guessedDomain,
      url: r.url,   // points to news article, not company
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
 * Exa cannot filter by revenue threshold — treat these queries as
 * "companies that announced $X ARR milestone" and search press releases.
 */
async function searchRevenueCompanies(rawQuery: string): Promise<CompanySearchResult[]> {
  // Extract the revenue number to make the news query more specific
  const match = rawQuery.match(/(\$?\d+[km]?)\s*(arr|mrr|revenue|million|m\b)/i)
  const revenueStr = match ? match[0] : '10 million ARR'

  const newsQuery = `startup company ${revenueStr} annual recurring revenue milestone 2024 2025`
  return searchNewsForCompanies(newsQuery, 12)
}

export async function searchCompanies(keywords: string[]): Promise<CompanySearchResult[]> {
  const { isRevenue, isHiring, isDirect, hasGeo, hasFundingStage, rawQuery } = classifyQuery(keywords)

  // ── Path 1: Direct company lookup (e.g. "Razorpay", "Stripe") ──────────────
  if (isDirect) {
    const data = await exaRequest('/search', {
      query: `"${rawQuery}"`,
      numResults: 10,
      type: 'neural',
      category: 'company',
      useAutoprompt: false,
      contents: {
        summary: { query: 'company description product team funding' },
      },
    })
    return data.results
      .filter(r => r.url)
      .map(r => {
        let domain = 'unknown'
        try { domain = getApexDomain(new URL(r.url).hostname) } catch { /* skip */ }
        return {
          name: cleanCompanyName(r.title, domain),
          domain,
          url: r.url,
          snippet: r.summary ?? r.text?.slice(0, 200) ?? '',
          published_date: r.publishedDate ?? null,
          score: r.score ?? 0.5,
          source: 'direct_lookup' as const,
        }
      })
      .slice(0, 10)
  }

  // ── Path 2: Revenue-threshold query — special handling ────────────────────
  if (isRevenue) {
    const revenueResults = await searchRevenueCompanies(rawQuery)
    return revenueResults.slice(0, 15)
  }

  // ── Path 3: Discovery query — parallel company + news pass ────────────────
  // Build targeted query for company page search
  const companyPageQuery = rawQuery  // category:company mode handles context well

  // Build news query — add funding/hiring context for better article targeting
  const newsQuery = [
    rawQuery,
    hasFundingStage ? '' : '',  // funding stage is already in rawQuery if user typed it
    'funding announcement 2024 2025',
  ].filter(Boolean).join(' ')

  // Run both passes in parallel
  const [companyResults, newsResults] = await Promise.all([
    searchCompanyPages(companyPageQuery, 20),
    hasFundingStage || hasGeo ? searchNewsForCompanies(newsQuery, 12) : Promise.resolve([]),
  ])

  // Merge: company pages take precedence, news results fill gaps
  const merged = deduplicateByDomain([...companyResults, ...newsResults])

  // Re-score: company_page results get a boost, news_extracted results are ranked lower
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
