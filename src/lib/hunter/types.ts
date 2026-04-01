export interface HunterEmailEntry {
  value: string           // email address
  type: 'personal' | 'generic'
  confidence: number      // 0-100 — only use >= 70
  first_name: string | null
  last_name: string | null
  position: string | null // job title
  seniority: string | null
  department: string | null
  linkedin: string | null
  twitter: string | null
  phone_number: string | null
}

export interface HunterDomainSearchResponse {
  data: {
    domain: string
    organization: string | null
    emails: HunterEmailEntry[]
    meta: {
      results: number
      limit: number
      offset: number
      params: Record<string, unknown>
    }
  }
  meta: {
    params: Record<string, unknown>
  }
}

export interface HunterEmailFinderResponse {
  data: {
    first_name: string
    last_name: string
    email: string | null
    score: number          // confidence 0-100
    domain: string
    position: string | null
    company: string | null
    linkedin_url: string | null
    twitter: string | null
    sources: Array<{ domain: string; uri: string; extracted_on: string }>
  }
  meta: {
    params: Record<string, unknown>
  }
}
