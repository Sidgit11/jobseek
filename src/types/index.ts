// ── ENUMS ──────────────────────────────────────────────────────────────────────

export type PipelineStatus = 'saved' | 'messaged' | 'replied' | 'interviewing'
export type OutreachType = 'linkedin' | 'email'
export type Seniority = 'Founder' | 'C-Level' | 'VP' | 'Director' | 'Head' | 'Manager' | 'Senior' | 'Mid' | 'Junior' | 'Unknown'
export type FundingStage = 'Pre-Seed' | 'Seed' | 'Series A' | 'Series B' | 'Series C' | 'Series D+' | 'Growth' | 'Public' | 'Bootstrapped' | 'Unknown'

// ── DATABASE TYPES ──────────────────────────────────────────────────────────────

export interface Company {
  id: string
  name: string
  domain: string | null
  funding_stage: string | null
  last_round_date: string | null
  headcount: number | null
  headcount_growth: string | null
  total_funding: string | null
  investors: string[] | null
  growth_signal: string | null
  summary: string | null
  why_fit: string | null
  hiring_signals: string[] | null
  red_flags: string[] | null
  summary_updated_at: string | null
  source: string | null
  logo_url: string | null
  website_url: string | null
  description: string | null
  created_at: string
}

export interface Person {
  id: string
  apollo_id?: string | null
  company_id: string
  name: string
  title: string | null
  seniority: string | null
  linkedin_url: string | null
  email: string | null
  photo_url: string | null
  outreach_priority_score: number
  cached_at: string
  created_at: string
}

export interface Profile {
  id: string
  email: string | null
  name: string | null
  headline: string | null
  location: string | null
  target_roles: string[]
  target_industries: string[]
  seniority: string | null
  target_locations: string[]
  company_stages: string[]
  linkedin_url: string | null
  linkedin_headline: string | null
  linkedin_experience: Array<{ company: string; title: string; duration: string }> | null
  linkedin_scraped_at: string | null
  resume_text: string | null
  candidate_summary: string | null
  onboarding_completed: boolean
  device_token: string | null
  email_credits: number
  created_at: string
  updated_at: string
}

export interface OutreachDraft {
  id: string
  user_id: string
  person_id: string
  company_id: string
  type: OutreachType
  subject: string | null
  body: string
  sent_flag: boolean
  sent_at: string | null
  created_at: string
}

export interface PipelineEntry {
  id: string
  user_id: string
  company_id: string
  person_id: string | null
  status: PipelineStatus
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  company?: Company
  person?: Person
}

export interface SearchQuery {
  id: string
  user_id: string
  raw_query: string
  processed_intent: SearchIntent | null
  result_count: number | null
  created_at: string
}

// ── AI / SEARCH TYPES ───────────────────────────────────────────────────────────

export interface SearchIntent {
  industries: string[]
  fundingStages: string[]
  roles: string[]
  geography: string | null
  signals: string[]
  companySize: 'startup' | 'mid' | 'enterprise' | 'any'
  keywords: string[]
  // Intent graph extensions
  companyName: string | null       // explicit company name: "Microsoft", "Stripe"
  confidence: number               // 0-1 overall intent confidence from Gemini
  sectors: string[]               // normalized from industries: ["ai", "ml", "nlp"]
  expandedGeo: string[]           // expanded from geography: ["india", "bangalore", "mumbai"]
  roleSignal: string | null       // normalized target role: "product_manager"
  temporal: 'active_hiring' | 'recently_funded' | 'any' | null
  implicitSignals: string[]       // inferred context: ["recently_funded", "small_team", "pm_gap"]
}

export type ATSPlatform = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'recruitee'

export interface ATSJobPosting {
  title: string
  location: string | null
  department: string | null
  posted_date: string | null
  url: string
  employment_type: string | null
}

export interface ATSResult {
  ats: ATSPlatform
  slug: string
  open_roles: ATSJobPosting[]
  total_open_roles: number
  matched_roles: ATSJobPosting[]
  probed_at: string
}

export interface TargetingBrief {
  whyNow: string[]        // 2-3 time-sensitive signals
  yourAngle: string        // personalized pitch based on user background
  openingLine: string      // cold outreach opener
}

export interface SearchResult {
  company: Company
  relevance_score: number    // Query relevance: how well does this company match the SEARCH QUERY
  fit_score: number          // User fit: how well does this company match the USER PROFILE
  exa_score: number
  match_reasons: string[]
  // From Exa
  snippet: string | null
  url: string | null
  published_date: string | null
  // Targeting brief (populated for top results)
  brief?: TargetingBrief
  // ATS job board data (populated when company found on an ATS)
  ats?: ATSResult
}

export interface CompanyIntelligence {
  company: Company
  people: Person[]
  news: NewsItem[]
  summary: string
  why_fit: string
  hiring_signals: string[]
  red_flags: string[]
}

export interface NewsItem {
  title: string
  url: string
  snippet: string
  published_date: string | null
}

export interface OutreachVariants {
  linkedin: string
  email: {
    subject: string
    body: string
  }
}

export interface CandidateContext {
  name: string | null
  candidateSummary: string
  targetRoles: string[]
  targetIndustries: string[]
  location: string | null
  // Richer context for personalized briefs
  seniority: string | null
  companyStages: string[]
  targetLocations: string[]
  linkedinExperience: Array<{ company: string; title: string; duration: string }> | null
  linkedinHeadline: string | null
}

// ── API REQUEST / RESPONSE TYPES ─────────────────────────────────────────────

export interface CompanySearchRequest {
  query: string
}

export interface CompanySearchResponse {
  results: SearchResult[]
  intent: SearchIntent
  query_id: string
}

export interface OutreachGenerateRequest {
  personId: string
  companyId: string
}

export interface OutreachGenerateResponse {
  linkedin: string
  email_subject: string
  email_body: string
  draft_ids: {
    linkedin: string
    email: string
  }
}

export interface PipelineUpdateRequest {
  entryId?: string
  companyId?: string
  status: PipelineStatus
  personId?: string
}

// ── UI STATE TYPES ────────────────────────────────────────────────────────────

export interface KanbanColumn {
  status: PipelineStatus
  label: string
  color: string
  entries: PipelineEntry[]
}

export interface ToastOptions {
  message: string
  type: 'success' | 'error' | 'info'
}
