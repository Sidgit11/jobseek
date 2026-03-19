import { generateText } from '@/lib/google/client'
import { z } from 'zod'
import type { SearchIntent, CandidateContext } from '@/types'

const SearchIntentSchema = z.object({
  industries: z.array(z.string()),
  fundingStages: z.array(z.string()),
  roles: z.array(z.string()),
  geography: z.string().nullable(),
  signals: z.array(z.string()),
  companySize: z.enum(['startup', 'mid', 'enterprise', 'any']),
  keywords: z.array(z.string()),
})

/** Detect if query is a direct company name lookup (1-2 words, no filter terms) */
function isDirectNameQuery(rawQuery: string): boolean {
  const words = rawQuery.trim().split(/\s+/)
  if (words.length === 0 || words.length > 2) return false
  if (!/^[A-Z]/.test(words[0])) return false
  const filterTerms = new Set([
    'hiring', 'startup', 'startups', 'series', 'seed', 'ai', 'ml',
    'nyc', 'remote', 'engineer', 'engineers', 'companies', 'company',
    'funded', 'funding', 'growth', 'saas', 'fintech', 'healthtech',
    'devtools', 'crypto', 'b2b', 'b2c', 'enterprise', 'consumer', 'climate',
  ])
  for (const w of words) {
    if (filterTerms.has(w.toLowerCase())) return false
  }
  return true
}

/** Pure regex / keyword heuristic — zero API calls, always works */
function heuristicIntent(rawQuery: string, userContext: CandidateContext): SearchIntent {
  const q = rawQuery.toLowerCase()

  // For direct company name queries (e.g. "Microsoft", "Stripe"), keep keywords
  // minimal and don't add default discovery filters
  if (isDirectNameQuery(rawQuery)) {
    return {
      industries: userContext.targetIndustries.length ? userContext.targetIndustries : [],
      fundingStages: [],
      roles: userContext.targetRoles,
      geography: userContext.location,
      signals: [],
      companySize: 'any',
      keywords: [rawQuery.trim()],
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

  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'are', 'from', 'have'])
  const rawWords = rawQuery.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()))
  // Always include the funding stage and core industry as usable keywords
  const extras: string[] = stages.length ? [stages[0].replace('-', ' ')] : []
  if (industries[0]) extras.push(industries[0].split(' / ')[0]) // e.g. "AI"
  const keywords = [...new Set([...rawWords, ...extras])].slice(0, 6)

  return {
    industries: industries.length ? industries : ['AI / ML', 'SaaS'],
    fundingStages: [...new Set(stages)],
    roles: userContext.targetRoles,
    geography: userContext.location,
    signals,
    companySize: 'startup',
    keywords,
  }
}

export async function extractSearchIntent(
  rawQuery: string,
  userContext: CandidateContext
): Promise<SearchIntent> {
  // Try Claude first; fall back to heuristic on ANY error (credits, network, etc.)
  try {
    const text = await generateText(
      `You are a job search intelligence engine. Extract structured search parameters from a natural language query.
Return ONLY valid JSON — no markdown, no explanation, no code blocks.`,
      `Query: "${rawQuery}"
User context: targeting ${userContext.targetRoles.join(', ')} roles in ${userContext.targetIndustries.join(', ')}${userContext.location ? `, based in ${userContext.location}` : ''}.

Extract a JSON object with these exact fields:
{
  "industries": ["list of relevant industries to search"],
  "fundingStages": ["seed", "series-a", "series-b", etc.],
  "roles": ["hiring roles to look for at target companies"],
  "geography": "location string or null",
  "signals": ["growth", "hiring", "recent-funding", "product-launch", etc.],
  "companySize": "startup|mid|enterprise|any",
  "keywords": ["3-6 specific search terms for finding these companies on the web"]
}`,
      { temperature: 0.3, maxTokens: 500 }
    )
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return SearchIntentSchema.parse(parsed)
  } catch {
    // Any failure (API credits, network, JSON parse) → heuristic fallback
    return heuristicIntent(rawQuery, userContext)
  }
}
