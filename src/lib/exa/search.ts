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
}

// Words that signal a result is a news headline, not a company homepage
const NEWS_VERBS = /\b(raises|raised|launches|launched|acquires|acquired|announces|announced|hires|hired|closes|closed|secures|secured|wins|won|expands|expanded|partners|partnered|releases|released|funding|round|billion|million|series [a-e]|ipo|valued)\b/i

/** Extract apex domain: app.stripe.com → stripe.com, www.openai.com → openai.com */
function getApexDomain(hostname: string): string {
  const h = hostname.replace(/^www\./, '')
  const parts = h.split('.')
  // Handle two-part TLDs like co.uk, com.au, co.in
  const twoPartTLDs = new Set(['co.uk', 'co.in', 'com.au', 'co.nz', 'org.uk', 'net.au'])
  if (parts.length >= 3 && twoPartTLDs.has(parts.slice(-2).join('.'))) {
    return parts.slice(-3).join('.')
  }
  // Standard: return last 2 parts (stripe.com, perplexity.ai, etc.)
  return parts.slice(-2).join('.')
}

function domainToName(domain: string): string {
  const base = domain.replace(/\.(com|io|ai|co|net|org|app|dev|tech|co\.uk)$/, '')
  return base.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function cleanCompanyName(title: string, domain: string): string {
  // Split on all common separators, with or without surrounding spaces
  const segments = title
    .split(/\s*[|·]\s*|\s+[-–—]\s+|\s*:\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  // Score each segment: lower word count + no news verbs = better brand name
  const scored = segments
    .filter(s => !NEWS_VERBS.test(s))
    .map(s => ({ s, words: s.split(/\s+/).length }))
    .sort((a, b) => a.words - b.words) // shortest first = most likely brand name

  // Pick shortest non-headline segment if it's ≤ 4 words
  if (scored.length > 0 && scored[0].words <= 4) {
    return scored[0].s
  }

  // Entire title is a news headline — derive from domain
  return domainToName(domain)
}

export async function searchCompanies(keywords: string[]): Promise<CompanySearchResult[]> {
  const query = keywords.join(' ') + ' company startup'

  const data = await exaRequest('/search', {
    query,
    numResults: 25, // fetch more to allow for dedup
    type: 'neural',
    useAutoprompt: true,
    excludeDomains: [
      'linkedin.com', 'twitter.com', 'facebook.com', 'instagram.com',
      'techcrunch.com', 'crunchbase.com', 'forbes.com', 'bloomberg.com',
      'wsj.com', 'nytimes.com', 'theverge.com', 'wired.com', 'venturebeat.com',
    ],
    contents: {
      summary: { query: 'company description funding team product' },
    },
  })

  // Deduplicate by domain — keep highest-scored result per domain
  const seen = new Map<string, CompanySearchResult>()

  for (const r of data.results) {
    if (!r.url || r.url.includes('linkedin') || r.url.includes('twitter')) continue

    let url: URL
    try { url = new URL(r.url) } catch { continue }

    const domain = getApexDomain(url.hostname)

    // Skip news/media domains that slipped through
    if (/^(techcrunch|forbes|bloomberg|wired|wsj|theverge|venturebeat|inc\.|businessinsider)/.test(domain)) continue

    const entry: CompanySearchResult = {
      name: cleanCompanyName(r.title, domain),
      domain,
      url: r.url,
      snippet: r.summary ?? r.highlights?.[0] ?? r.text?.slice(0, 200) ?? '',
      published_date: r.publishedDate ?? null,
      score: r.score ?? 0.5,
    }

    const existing = seen.get(domain)
    if (!existing || entry.score > existing.score) {
      seen.set(domain, entry)
    }
  }

  return Array.from(seen.values())
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
