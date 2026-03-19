/**
 * Apollo API types — only for endpoints confirmed available on free plan.
 * ✅ organizations/search  — company metadata enrichment
 * ❌ mixed_people/*        — all paywalled on free plan
 * ❌ people/match          — paywalled
 */

// ── Organization Search (free) ────────────────────────────────────────────────

export interface ApolloOrganization {
  id: string
  name: string
  website_url: string | null
  blog_url: string | null
  linkedin_url: string | null
  twitter_url: string | null
  primary_domain: string | null
  primary_phone: { number: string; sanitized_number: string } | null
  founded_year: number | null
  publicly_traded_symbol: string | null
  publicly_traded_exchange: string | null
  logo_url: string | null
  industry: string | null
  estimated_num_employees: number | null
  city: string | null
  state: string | null
  country: string | null
  street_address: string | null
  postal_code: string | null
  organization_revenue_printed: string | null
  organization_revenue: number | null
  industries: string[]
  keywords: string[]
  sic_codes: string[]
  naics_codes: string[]
}
