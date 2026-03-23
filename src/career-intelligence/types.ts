// ── Career Intelligence Types ─────────────────────────────────────────────────

export interface WorkExperience {
  id: string
  company: string
  title: string
  start_date: string
  end_date: string
  description: string
  highlights: string[]
  skills: string[]
}

export interface Project {
  id: string
  title: string
  description: string
  url?: string
  metrics?: string
  tags: string[]
}

export interface CandidateModel {
  id: string
  user_id: string
  headline: string | null
  positioning: string | null
  bio_short: string | null
  bio_long: string | null
  location: string | null
  work_experiences: WorkExperience[]
  projects: Project[]
  education: Array<{ school: string; degree: string; year: string }>
  writing_links: Array<{ title: string; url: string }>
  skill_tags: string[]
  domain_expertise: string[]
  stage_fit: string[]
  target_roles: string[]
  hard_nos: string[]
  preferred_culture: string[]
  linkedin_headline: string | null
  resume_bullets: Array<{ company: string; title: string; bullets: string[] }>
  unique_pov: string | null
  intake_phase: number
  completeness_score: number
  conversation_id: string | null
  last_updated: string
  created_at: string
}

export interface IntakeMessage {
  role: 'assistant' | 'user'
  content: string
  timestamp: string
  extracted_facts?: string[]
}

export interface EngagementOpportunity {
  id: string
  user_id: string
  post_id: string
  author_name: string | null
  author_title: string | null
  author_company: string | null
  author_linkedin_url: string | null
  post_text: string
  post_url: string | null
  engagement_score: number
  score_reasons: string[]
  suggested_angle: string | null
  generated_comment: string | null
  status: 'pending' | 'commented' | 'skipped'
  captured_at: string
}

/** Raw post data from Chrome extension for scoring */
export interface EngagementPostInput {
  post_id: string
  author_name: string
  author_title: string
  author_company: string
  post_text: string
  post_url: string
  reaction_count: number
  is_target_company: boolean
  hours_old: number
}

/** Scored engagement opportunity ready for DB insert */
export interface ScoredEngagement {
  user_id: string
  post_id: string
  author_name: string
  author_title: string
  author_company: string
  post_text: string
  post_url: string
  engagement_score: number
  score_reasons: string[]
  suggested_angle: null
}
