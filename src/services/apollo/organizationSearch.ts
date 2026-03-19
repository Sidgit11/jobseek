/**
 * Apollo Organization Search — POST /api/v1/organizations/search
 * ✅ Confirmed free on Apollo's free plan.
 *
 * Use case: enrich company cards with headcount, founded year, funding stage,
 * LinkedIn URL, and revenue data. Supplements Exa search results.
 */

import { apolloPost } from './client'
import type { ApolloOrganization } from './types'

interface OrgSearchResponse {
  organizations: ApolloOrganization[]
  pagination: { page: number; per_page: number; total_entries: number; total_pages: number }
}

export async function searchOrganization(
  nameOrDomain: string
): Promise<ApolloOrganization | null> {
  // In dev / no key: skip
  if (!process.env.APOLLO_API_KEY) return null

  try {
    const data = await apolloPost<OrgSearchResponse>('/organizations/search', {
      // Note: Apollo uses different base URL prefix for this endpoint
      q_organization_name: nameOrDomain,
      per_page: 1,
      page: 1,
    })

    return data.organizations?.[0] ?? null
  } catch (err) {
    console.error('[apollo:orgSearch] error:', err)
    return null
  }
}
