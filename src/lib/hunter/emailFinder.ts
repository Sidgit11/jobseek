/**
 * Hunter.io Email Finder
 * GET /v2/email-finder?domain={domain}&first_name={name}&last_name={name}&api_key={key}
 *
 * Free tier: included in 25/month quota
 * Used as fallback when a person wasn't found in domain search.
 * Returns single email with confidence score.
 */

import { MOCK_EMAIL_FINDER, isMockMode } from './mock'
import type { HunterEmailFinderResponse } from './types'

const HUNTER_BASE = 'https://api.hunter.io/v2'
const MIN_CONFIDENCE = 70

export async function findEmailForPerson(
  domain: string,
  firstName: string,
  lastName: string
): Promise<{ email: string; score: number } | null> {
  if (isMockMode()) {
    await new Promise(r => setTimeout(r, 1000))
    const m = MOCK_EMAIL_FINDER.data
    if (m.email && m.score >= MIN_CONFIDENCE) {
      return { email: m.email, score: m.score }
    }
    return null
  }

  const apiKey = process.env.HUNTER_API_KEY!
  const url = new URL(`${HUNTER_BASE}/email-finder`)
  url.searchParams.set('domain', domain)
  url.searchParams.set('first_name', firstName)
  url.searchParams.set('last_name', lastName)
  url.searchParams.set('api_key', apiKey)

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error(`[hunter:emailFinder] ${res.status}:`, body)
      return null
    }

    const data: HunterEmailFinderResponse = await res.json()
    const { email, score } = data.data ?? {}

    if (!email || (score ?? 0) < MIN_CONFIDENCE) return null
    return { email, score: score ?? 0 }
  } catch (err) {
    console.error('[hunter:emailFinder] fetch error:', err)
    return null
  }
}
