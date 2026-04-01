/**
 * Hunter.io Domain Search
 * GET /v2/domain-search?domain={domain}&limit=10&api_key={key}
 *
 * Free tier: 25 requests/month
 * Returns: real people at a company with name, title, email (confidence-scored), LinkedIn
 * No credits consumed — this is the discovery call.
 */

import { MOCK_DOMAIN_SEARCH, isMockMode } from './mock'
import type { HunterDomainSearchResponse, HunterEmailEntry } from './types'

const HUNTER_BASE = 'https://api.hunter.io/v2'
const MIN_CONFIDENCE = 70  // only surface emails above this threshold

// Seniority keywords → priority score for sorting
const SENIORITY_SCORE: Record<string, number> = {
  executive: 100,
  senior: 80,
  intermediate: 60,
  junior: 40,
}

function priorityScore(entry: HunterEmailEntry, targetRoles: string[]): number {
  let score = SENIORITY_SCORE[entry.seniority ?? ''] ?? 50
  const pos = (entry.position ?? '').toLowerCase()

  // Boost for C-level / founder / head-of
  if (pos.includes('ceo') || pos.includes('cto') || pos.includes('cpo') || pos.includes('founder')) score += 20
  if (pos.includes('vp') || pos.includes('vice president') || pos.includes('head of')) score += 15
  if (pos.includes('director')) score += 10

  // Boost if title aligns with user's target roles
  const roleMatch = targetRoles.map(r => r.toLowerCase()).some(role => {
    if (role.includes('product')) return pos.includes('product')
    if (role.includes('engineer')) return pos.includes('engineer') || pos.includes('engineering')
    if (role.includes('design')) return pos.includes('design')
    if (role.includes('growth') || role.includes('gtm')) return pos.includes('growth') || pos.includes('marketing')
    return pos.includes(role)
  })
  if (roleMatch) score += 15

  // Boost for high-confidence emails
  score += Math.floor(entry.confidence / 20)

  return Math.min(score, 100)
}

export async function searchPeopleByDomain(
  domain: string,
  targetRoles: string[] = [],
  limit = 10
): Promise<Array<HunterEmailEntry & { priority_score: number }>> {
  if (isMockMode()) {
    await new Promise(r => setTimeout(r, 400))
    return MOCK_DOMAIN_SEARCH.data.emails
      .map(e => ({ ...e, priority_score: priorityScore(e, targetRoles) }))
      .sort((a, b) => b.priority_score - a.priority_score)
  }

  const apiKey = process.env.HUNTER_API_KEY!
  const url = new URL(`${HUNTER_BASE}/domain-search`)
  url.searchParams.set('domain', domain)
  url.searchParams.set('limit', String(Math.min(limit, 10)))
  url.searchParams.set('api_key', apiKey)

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error(`[hunter:domainSearch] ${res.status}:`, body)
      return []
    }

    const data: HunterDomainSearchResponse = await res.json()

    return (data.data?.emails ?? [])
      .filter(e => e.confidence >= MIN_CONFIDENCE)
      .map(e => ({ ...e, priority_score: priorityScore(e, targetRoles) }))
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, 8)
  } catch (err) {
    console.error('[hunter:domainSearch] fetch error:', err)
    return []
  }
}
