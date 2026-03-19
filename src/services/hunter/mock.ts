import type { HunterDomainSearchResponse, HunterEmailFinderResponse } from './types'

export const MOCK_DOMAIN_SEARCH: HunterDomainSearchResponse = {
  data: {
    domain: 'example.com',
    organization: 'Example Corp',
    emails: [
      {
        value: 'sarah.chen@example.com',
        type: 'personal',
        confidence: 94,
        first_name: 'Sarah',
        last_name: 'Chen',
        position: 'VP of Product',
        seniority: 'senior',
        department: 'management',
        linkedin: 'https://linkedin.com/in/sarahchen',
        twitter: null,
        phone_number: null,
      },
      {
        value: 'marcus.williams@example.com',
        type: 'personal',
        confidence: 88,
        first_name: 'Marcus',
        last_name: 'Williams',
        position: 'Head of Engineering',
        seniority: 'senior',
        department: 'engineering',
        linkedin: 'https://linkedin.com/in/marcuswilliams',
        twitter: null,
        phone_number: null,
      },
      {
        value: 'alex.rivera@example.com',
        type: 'personal',
        confidence: 91,
        first_name: 'Alex',
        last_name: 'Rivera',
        position: 'CEO & Co-Founder',
        seniority: 'executive',
        department: 'executive',
        linkedin: 'https://linkedin.com/in/alexrivera',
        twitter: null,
        phone_number: null,
      },
    ],
    meta: { results: 3, limit: 10, offset: 0, params: {} },
  },
  meta: { params: {} },
}

export const MOCK_EMAIL_FINDER: HunterEmailFinderResponse = {
  data: {
    first_name: 'Sarah',
    last_name: 'Chen',
    email: 'sarah.chen@example.com',
    score: 94,
    domain: 'example.com',
    position: 'VP of Product',
    company: 'Example Corp',
    linkedin_url: 'https://linkedin.com/in/sarahchen',
    twitter: null,
    sources: [],
  },
  meta: { params: {} },
}

export function isMockMode(): boolean {
  // Only use mock when key is genuinely absent — don't block real calls in dev
  return !process.env.HUNTER_API_KEY
}
