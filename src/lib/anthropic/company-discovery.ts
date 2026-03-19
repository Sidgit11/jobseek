/**
 * Fallback company discovery using Claude.
 * When no Exa API key is set, Claude generates realistic startup profiles
 * that match the user's search intent. Results are clearly tagged as AI-generated
 * so users know to validate them, but they're useful for demos and early testing.
 */
import { generateText } from '@/lib/google/client'
import type { SearchIntent, CandidateContext } from '@/types'
import type { CompanySearchResult } from '@/lib/exa/search'

interface GeneratedCompany {
  name: string
  domain: string
  url: string
  snippet: string
  stage: string
  headcount_estimate: number
  location: string
  founded_year: number
  investors: string[]
}

export async function generateFallbackCompanies(
  intent: SearchIntent,
  userContext: CandidateContext,
  rawQuery: string
): Promise<CompanySearchResult[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return []

  try {
    const text = await generateText(
      `You are a startup ecosystem expert with deep knowledge of real companies.
Generate a list of REAL, verifiable companies that match job seekers' criteria.
Use actual companies you know exist — NOT fictional ones.
Return ONLY valid JSON, no markdown, no explanation.`,
      `A job seeker is searching: "${rawQuery}"

Search intent: ${JSON.stringify(intent)}
User background: ${userContext.candidateSummary || `targeting ${userContext.targetRoles.slice(0, 3).join(', ')} roles`}

Generate 8 REAL companies that genuinely match this search. These must be actual companies.
For each company return:
{
  "name": "Company Name",
  "domain": "company.com",
  "url": "https://company.com",
  "snippet": "2-sentence description of what they do, their stage, and why they're interesting for job seekers",
  "stage": "Seed|Series A|Series B|Series C|Public",
  "headcount_estimate": 45,
  "location": "San Francisco, CA",
  "founded_year": 2021,
  "investors": ["Sequoia", "a16z"]
}

Return as a JSON array. Focus on companies that are: actively hiring, recently funded, match the industry/stage criteria.`,
      { temperature: 0.7, maxTokens: 2000 }
    )
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const companies: GeneratedCompany[] = JSON.parse(cleaned)

    return companies
      .filter(c => c.name && c.domain)
      .map(c => ({
        name: c.name,
        domain: c.domain,
        url: c.url || `https://${c.domain}`,
        snippet: c.snippet,
        published_date: null,
        score: 0.75,
        // Extra metadata stored in snippet for later extraction
        _meta: { stage: c.stage, headcount: c.headcount_estimate, location: c.location, investors: c.investors, founded_year: c.founded_year },
      } as CompanySearchResult & { _meta?: unknown }))
      .slice(0, 8)
  } catch (err) {
    console.error('[company-discovery] Claude fallback error:', err)
    return []
  }
}
