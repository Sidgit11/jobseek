/**
 * Mock fixtures for Apollo organization search.
 * Used in dev to avoid hitting the live API.
 */
import type { ApolloOrganization } from './types'

export const MOCK_ORGANIZATION: ApolloOrganization = {
  id: 'mock-apollo-org-001',
  name: 'Example Corp',
  website_url: 'https://example.com',
  blog_url: null,
  linkedin_url: 'https://linkedin.com/company/example-corp',
  twitter_url: 'https://twitter.com/example',
  primary_domain: 'example.com',
  primary_phone: null,
  founded_year: 2020,
  publicly_traded_symbol: null,
  publicly_traded_exchange: null,
  logo_url: null,
  industry: 'information technology & services',
  estimated_num_employees: 120,
  city: 'San Francisco',
  state: 'California',
  country: 'United States',
  street_address: '123 Main St',
  postal_code: '94105',
  organization_revenue_printed: '10M',
  organization_revenue: 10000000,
  industries: ['information technology & services'],
  keywords: ['saas', 'ai', 'machine learning'],
  sic_codes: ['7372'],
  naics_codes: ['511210'],
}

export function isMockMode(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.APOLLO_API_KEY
}
