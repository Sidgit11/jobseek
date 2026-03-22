import { generateText } from '@/lib/google/client'
import { z } from 'zod'
import type { SearchIntent, CandidateContext } from '@/types'
import { routeLogger } from '@/lib/logger'

const log = routeLogger('intent')

const SearchIntentSchema = z.object({
  industries: z.array(z.string()),
  fundingStages: z.array(z.string()),
  roles: z.array(z.string()),
  geography: z.string().nullable(),
  signals: z.array(z.string()),
  companySize: z.enum(['startup', 'mid', 'enterprise', 'any']),
  keywords: z.array(z.string()),
  // Intent graph extensions
  companyName: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.5),
  sectors: z.array(z.string()).default([]),
  expandedGeo: z.array(z.string()).default([]),
  roleSignal: z.string().nullable().default(null),
  temporal: z.enum(['active_hiring', 'recently_funded', 'any']).nullable().default(null),
  implicitSignals: z.array(z.string()).default([]),
})

// ── Geo expansion map ──────────────────────────────────────────────────────────
const GEO_EXPANSION: Record<string, string[]> = {
  'india': ['india', 'bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'chennai', 'pune', 'gurgaon'],
  'us': ['united states', 'san francisco', 'new york', 'seattle', 'austin', 'boston', 'los angeles'],
  'usa': ['united states', 'san francisco', 'new york', 'seattle', 'austin', 'boston', 'los angeles'],
  'united states': ['united states', 'san francisco', 'new york', 'seattle', 'austin', 'boston', 'los angeles'],
  'europe': ['europe', 'london', 'berlin', 'amsterdam', 'paris', 'dublin', 'stockholm'],
  'uk': ['united kingdom', 'london', 'manchester', 'cambridge'],
  'united kingdom': ['united kingdom', 'london', 'manchester', 'cambridge'],
  'southeast asia': ['southeast asia', 'singapore', 'jakarta', 'bangkok', 'ho chi minh city'],
  'singapore': ['singapore'],
}

// ── Implicit signal inference rules ────────────────────────────────────────────
// These map (stage + sector) combinations to signals that can be inferred
function inferImplicitSignals(
  fundingStages: string[],
  sectors: string[],
  signals: string[],
  roleSignal: string | null,
): string[] {
  const implicit: string[] = []
  const stagesLower = fundingStages.map(s => s.toLowerCase())
  const sectorsLower = sectors.map(s => s.toLowerCase())

  // Any specific funding stage mentioned → recently_funded (they're looking for companies that just raised)
  if (stagesLower.some(s => s.includes('series') || s === 'seed' || s === 'pre-seed')) {
    implicit.push('recently_funded')
  }

  // Pre-Series C → small team
  if (stagesLower.some(s => ['seed', 'pre-seed', 'series-a', 'series a', 'series-b', 'series b'].includes(s))) {
    implicit.push('small_team')
  }

  // AI/ML + early stage → engineering-heavy, potential PM/design/GTM gaps
  if (sectorsLower.some(s => ['ai', 'ml', 'nlp', 'llm', 'deep learning'].includes(s))) {
    implicit.push('engineering_heavy')
    if (roleSignal && ['product_manager', 'designer', 'growth', 'gtm', 'marketing'].includes(roleSignal)) {
      implicit.push('role_gap')
    }
  }

  // Hiring signal → active headcount growth
  if (signals.includes('hiring')) {
    implicit.push('active_headcount_growth')
  }

  // Growth signal → scaling challenges
  if (signals.includes('growth')) {
    implicit.push('scaling_challenges')
  }

  return [...new Set(implicit)]
}

// Role-like terms that when trailing a capitalized word indicate "Company + Role" pattern
const ROLE_SUFFIXES = new Set([
  'pm', 'pms', 'engineer', 'engineers', 'engineering', 'designer', 'designers',
  'swe', 'sde', 'developer', 'developers', 'analyst', 'analysts',
  'manager', 'managers', 'director', 'directors', 'lead', 'leads',
  'sales', 'marketing', 'ops', 'operations', 'product', 'design',
  'data', 'science', 'scientist', 'scientists', 'roles', 'jobs', 'positions',
])

const DISCOVERY_TERMS = new Set([
  'hiring', 'startup', 'startups', 'series', 'seed', 'ai', 'ml',
  'nyc', 'remote', 'companies', 'company',
  'funded', 'funding', 'growth', 'saas', 'fintech', 'healthtech',
  'devtools', 'crypto', 'b2b', 'b2c', 'enterprise', 'consumer', 'climate',
  'india', 'us', 'usa', 'europe', 'uk', 'singapore', 'remote',
])

/**
 * Detect if query contains a specific company name.
 * Returns the extracted company name or null.
 *
 * Handles patterns:
 * - "Microsoft" → "Microsoft"
 * - "Microsoft PM" → "Microsoft" (strips role suffix)
 * - "Microsoft PMs" → "Microsoft"
 * - "Stripe engineering" → "Stripe"
 * - "Series B startups" → null (discovery query)
 */
function extractCompanyNameFromQuery(rawQuery: string): string | null {
  const words = rawQuery.trim().split(/\s+/)
  if (words.length === 0 || words.length > 4) return null
  if (!/^[A-Z]/.test(words[0])) return null

  // Check if any word is a discovery term → not a company lookup
  for (const w of words) {
    if (DISCOVERY_TERMS.has(w.toLowerCase())) return null
  }

  // Single word: it's a company name
  if (words.length === 1) return words[0]

  // Multi-word: check if trailing words are role terms
  // "Microsoft PM" → company="Microsoft", role="PM"
  // "Acme Corp" → company="Acme Corp" (no role suffix)
  let companyWords = [...words]
  while (companyWords.length > 1) {
    const lastWord = companyWords[companyWords.length - 1]
    if (ROLE_SUFFIXES.has(lastWord.toLowerCase())) {
      companyWords = companyWords.slice(0, -1)
    } else {
      break
    }
  }

  // If we stripped all words, something's wrong
  if (companyWords.length === 0) return null

  return companyWords.join(' ')
}

/** Expand geography string to list of cities/regions */
function expandGeo(geography: string | null): string[] {
  if (!geography) return []
  const geoLower = geography.toLowerCase().trim()
  // Check direct match
  if (GEO_EXPANSION[geoLower]) return GEO_EXPANSION[geoLower]
  // Check if geography contains a known key
  for (const [key, cities] of Object.entries(GEO_EXPANSION)) {
    if (geoLower.includes(key)) return cities
  }
  return [geoLower]
}

/** Normalize industry names to search-friendly sectors */
function industriesToSectors(industries: string[]): string[] {
  const sectorMap: Record<string, string[]> = {
    'AI / ML': ['ai', 'ml', 'artificial intelligence', 'machine learning'],
    'Fintech': ['fintech', 'financial technology', 'payments'],
    'SaaS': ['saas', 'software'],
    'Consumer': ['consumer', 'consumer tech'],
    'HealthTech': ['healthtech', 'health tech', 'digital health'],
    'Crypto / Web3': ['crypto', 'web3', 'blockchain'],
    'Developer Tools': ['devtools', 'developer tools', 'developer infrastructure'],
    'Climate Tech': ['climate tech', 'cleantech', 'sustainability'],
    'E-Commerce': ['ecommerce', 'e-commerce', 'commerce'],
  }
  const sectors: string[] = []
  for (const industry of industries) {
    const mapped = sectorMap[industry]
    if (mapped) sectors.push(...mapped.slice(0, 2)) // top 2 sector terms per industry
    else sectors.push(industry.toLowerCase().split(' / ')[0])
  }
  return [...new Set(sectors)]
}

/** Normalize a role string to a signal identifier */
function normalizeRole(roles: string[]): string | null {
  if (roles.length === 0) return null
  const role = roles[0].toLowerCase()
  if (role.includes('product') || role.includes('pm')) return 'product_manager'
  if (role.includes('engineer') || role.includes('developer')) return 'software_engineer'
  if (role.includes('design')) return 'designer'
  if (role.includes('data')) return 'data_scientist'
  if (role.includes('growth')) return 'growth'
  if (role.includes('gtm') || role.includes('sales')) return 'gtm_sales'
  if (role.includes('market')) return 'marketing'
  if (role.includes('ops') || role.includes('operations')) return 'operations'
  return role.replace(/\s+/g, '_')
}

/** Pure regex / keyword heuristic — zero API calls, always works */
function heuristicIntent(rawQuery: string, userContext: CandidateContext): SearchIntent {
  const q = rawQuery.toLowerCase()

  // For direct company name queries (e.g. "Microsoft", "Microsoft PM", "Stripe engineering")
  const detectedCompany = extractCompanyNameFromQuery(rawQuery)
  if (detectedCompany) {
    // Check if query also has a role suffix we can use
    const queryLower = rawQuery.toLowerCase()
    const roleFromQuery = [...ROLE_SUFFIXES].find(r => queryLower.includes(r))
    const roles = roleFromQuery
      ? [roleFromQuery.charAt(0).toUpperCase() + roleFromQuery.slice(1)]  // basic capitalize
      : userContext.targetRoles

    return {
      industries: userContext.targetIndustries.length ? userContext.targetIndustries : [],
      fundingStages: [],
      roles,
      geography: userContext.location,
      signals: [],
      companySize: 'any',
      keywords: [detectedCompany],
      companyName: detectedCompany,
      confidence: 0.95,
      sectors: industriesToSectors(userContext.targetIndustries),
      expandedGeo: expandGeo(userContext.location),
      roleSignal: normalizeRole(roles),
      temporal: null,
      implicitSignals: [],
    }
  }

  const stages: string[] = []
  if (q.includes('seed') || q.includes('pre-seed')) stages.push('seed')
  if (q.includes('series a') || q.includes('series-a')) stages.push('series-a')
  if (q.includes('series b') || q.includes('series-b')) stages.push('series-b')
  if (q.includes('series c') || q.includes('series-c')) stages.push('series-c')
  if (q.includes('yc') || q.includes('y combinator')) stages.push('seed', 'series-a')
  if (stages.length === 0) stages.push('seed', 'series-a', 'series-b')

  const signals: string[] = []
  if (q.includes('hir')) signals.push('hiring')
  if (q.includes('growth') || q.includes('grow') || q.includes('scal')) signals.push('growth')
  if (q.includes('fund') || q.includes('raised') || q.includes('invest')) signals.push('recent-funding')
  if (signals.length === 0) signals.push('hiring', 'growth')

  const industries = [...userContext.targetIndustries]
  const industryMap: Record<string, string> = {
    ' ai ': 'AI / ML', ' ml ': 'AI / ML', fintech: 'Fintech', saas: 'SaaS',
    'developer tools': 'Developer Tools', devtools: 'Developer Tools',
    health: 'HealthTech', crypto: 'Crypto / Web3', climate: 'Climate Tech',
    consumer: 'Consumer',
  }
  for (const [key, val] of Object.entries(industryMap)) {
    if (q.includes(key.trim()) && !industries.includes(val)) industries.push(val)
  }

  // Extract geography from query
  let geography = userContext.location
  const geoPatterns: Record<string, string> = {
    'india': 'India', 'bangalore': 'India', 'mumbai': 'India', 'delhi': 'India',
    'nyc': 'United States', 'new york': 'United States', 'sf': 'United States',
    'san francisco': 'United States', 'seattle': 'United States',
    'london': 'United Kingdom', 'europe': 'Europe', 'singapore': 'Southeast Asia',
    'remote': 'Remote',
  }
  for (const [pattern, geo] of Object.entries(geoPatterns)) {
    if (q.includes(pattern)) { geography = geo; break }
  }

  const sectors = industriesToSectors(industries.length ? industries : ['AI / ML', 'SaaS'])
  const roleSignal = normalizeRole(userContext.targetRoles)
  const temporal: SearchIntent['temporal'] = signals.includes('hiring') ? 'active_hiring'
    : signals.includes('recent-funding') ? 'recently_funded' : null

  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'are', 'from', 'have'])
  const rawWords = rawQuery.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()))
  const extras: string[] = stages.length ? [stages[0].replace('-', ' ')] : []
  if (industries[0]) extras.push(industries[0].split(' / ')[0])
  const keywords = [...new Set([...rawWords, ...extras])].slice(0, 6)

  const implicitSignals = inferImplicitSignals([...new Set(stages)], sectors, signals, roleSignal)

  return {
    industries: industries.length ? industries : ['AI / ML', 'SaaS'],
    fundingStages: [...new Set(stages)],
    roles: userContext.targetRoles,
    geography,
    signals,
    companySize: 'startup',
    keywords,
    companyName: null,
    confidence: 0.5,
    sectors,
    expandedGeo: expandGeo(geography),
    roleSignal,
    temporal,
    implicitSignals,
  }
}

export async function extractSearchIntent(
  rawQuery: string,
  userContext: CandidateContext
): Promise<SearchIntent> {
  const start = Date.now()
  log.step('extract:start', { query: rawQuery, userRoles: userContext.targetRoles })

  // Try Gemini first; fall back to heuristic on ANY error
  try {
    const text = await generateText(
      `You are a job search intelligence engine. Extract a structured intent graph from a natural language company search query.
Return ONLY valid JSON — no markdown, no explanation, no code blocks.`,
      `Query: "${rawQuery}"
User context: targeting ${userContext.targetRoles.join(', ')} roles in ${userContext.targetIndustries.join(', ')}${userContext.location ? `, based in ${userContext.location}` : ''}.

Extract a JSON object with these exact fields:
{
  "industries": ["relevant industries"],
  "fundingStages": ["seed", "series-a", "series-b", etc.],
  "roles": ["hiring roles to look for"],
  "geography": "location string or null",
  "signals": ["growth", "hiring", "recent-funding", "product-launch"],
  "companySize": "startup|mid|enterprise|any",
  "keywords": ["3-6 search terms for finding these companies"],
  "companyName": "specific company name if mentioned (e.g. 'Microsoft', 'Stripe') or null if no specific company",
  "confidence": 0.0-1.0,
  "sectors": ["normalized sector terms like ai, ml, fintech, saas — lowercase"],
  "expandedGeo": ["expanded city/region list — e.g. India → india, bangalore, mumbai, delhi, hyderabad"],
  "roleSignal": "normalized role like product_manager, software_engineer, or null",
  "temporal": "active_hiring|recently_funded|any|null — what timing signal matters",
  "implicitSignals": ["signals INFERRED from context, not explicitly stated"]
}

COMPANY NAME EXTRACTION:
- If the user mentions a specific company by name, set "companyName" to that exact name.
- "Microsoft PM" → companyName: "Microsoft". "Stripe engineering" → companyName: "Stripe"
- Discovery queries like "Series B AI startups" → companyName: null
- "companies like Notion" → companyName: "Notion" (they want similar companies, but Notion is the reference)

CONFIDENCE SCORE (0.0 to 1.0):
- How confident you are in the OVERALL intent extraction.
- 0.9-1.0: Very clear query, unambiguous ("Microsoft PM roles" = clearly about Microsoft)
- 0.7-0.8: Mostly clear but some ambiguity ("AI startups hiring PMs in India")
- 0.4-0.6: Vague query, had to guess ("good companies to work at")
- The confidence is especially important for companyName — if you're unsure whether a word is a company name or a general term, lower the confidence.

IMPLICIT SIGNALS — derive from combinations:
- Specific funding stage → "recently_funded"
- Pre-Series C stage → "small_team" (headcount 20-100)
- AI/ML sector + non-engineering role → "role_gap"
- AI/ML sector → "engineering_heavy"
- Hiring signal → "active_headcount_growth"
- Growth signal → "scaling_challenges"

Examples:

Query: "Microsoft PM"
{
  "industries": ["SaaS"],
  "fundingStages": [],
  "roles": ["Product Manager"],
  "geography": null,
  "signals": [],
  "companySize": "enterprise",
  "keywords": ["Microsoft", "product manager"],
  "companyName": "Microsoft",
  "confidence": 0.95,
  "sectors": ["saas", "software", "ai"],
  "expandedGeo": [],
  "roleSignal": "product_manager",
  "temporal": null,
  "implicitSignals": []
}

Query: "Series B AI startups India hiring PMs"
{
  "industries": ["AI / ML"],
  "fundingStages": ["series-b"],
  "roles": ["Product Manager"],
  "geography": "India",
  "signals": ["hiring"],
  "companySize": "startup",
  "keywords": ["series B", "AI", "startup", "hiring", "product manager", "India"],
  "companyName": null,
  "confidence": 0.85,
  "sectors": ["ai", "ml", "artificial intelligence"],
  "expandedGeo": ["india", "bangalore", "mumbai", "delhi", "hyderabad"],
  "roleSignal": "product_manager",
  "temporal": "active_hiring",
  "implicitSignals": ["recently_funded", "small_team", "engineering_heavy", "role_gap", "active_headcount_growth"]
}

Query: "YC companies building developer tools"
{
  "industries": ["Developer Tools"],
  "fundingStages": ["seed", "series-a"],
  "roles": ["Software Engineer"],
  "geography": null,
  "signals": ["growth", "recent-funding"],
  "companySize": "startup",
  "keywords": ["Y Combinator", "YC", "developer tools", "devtools"],
  "companyName": null,
  "confidence": 0.8,
  "sectors": ["devtools", "developer tools", "developer infrastructure"],
  "expandedGeo": [],
  "roleSignal": "software_engineer",
  "temporal": "recently_funded",
  "implicitSignals": ["recently_funded", "small_team", "engineering_heavy"]
}`,
      { temperature: 0.3, maxTokens: 800 }
    )
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const validated = SearchIntentSchema.parse(parsed)

    // Post-process: ensure expandedGeo is populated even if Gemini didn't expand
    if (validated.expandedGeo.length === 0 && validated.geography) {
      validated.expandedGeo = expandGeo(validated.geography)
    }

    // Post-process: ensure implicit signals are populated
    if (validated.implicitSignals.length === 0) {
      validated.implicitSignals = inferImplicitSignals(
        validated.fundingStages, validated.sectors, validated.signals, validated.roleSignal
      )
    }

    // Post-process: ensure sectors are populated
    if (validated.sectors.length === 0 && validated.industries.length > 0) {
      validated.sectors = industriesToSectors(validated.industries)
    }

    // Post-process: ensure roleSignal is populated
    if (!validated.roleSignal && validated.roles.length > 0) {
      validated.roleSignal = normalizeRole(validated.roles)
    }

    // Post-process: SAFETY NET — if Gemini missed company name but heuristic would catch it, override
    if (!validated.companyName || validated.confidence < 0.7) {
      const heuristicCompany = extractCompanyNameFromQuery(rawQuery)
      if (heuristicCompany) {
        log.step('extract:company-override', {
          geminiCompanyName: validated.companyName,
          geminiConfidence: validated.confidence,
          heuristicCompanyName: heuristicCompany,
        })
        validated.companyName = heuristicCompany
        validated.confidence = Math.max(validated.confidence, 0.95)
        // Also ensure keywords include the company name
        if (!validated.keywords.some(k => k.toLowerCase() === heuristicCompany.toLowerCase())) {
          validated.keywords.unshift(heuristicCompany)
        }
      }
    }

    log.step('extract:gemini', {
      ms: Date.now() - start,
      companyName: validated.companyName, confidence: validated.confidence,
      keywords: validated.keywords, sectors: validated.sectors,
      implicitSignals: validated.implicitSignals,
    })
    return validated
  } catch (err) {
    log.warn('extract:fallback-to-heuristic', { query: rawQuery, error: err instanceof Error ? err.message : 'unknown', ms: Date.now() - start })
    const fallback = heuristicIntent(rawQuery, userContext)
    log.step('extract:heuristic', {
      companyName: fallback.companyName, confidence: fallback.confidence,
      keywords: fallback.keywords, implicitSignals: fallback.implicitSignals,
    })
    return fallback
  }
}
