import type { ATSPlatform, ATSJobPosting, ATSResult } from '@/types'

// ── Slug guessing ────────────────────────────────────────────────────────────

/** Generate slug candidates from a company domain */
export function guessSlug(domain: string): string[] {
  const clean = domain
    .replace(/^www\./, '')
    .replace(/\.(com|io|ai|co|app|net|org|dev|tech|co\.uk|in)$/, '')

  const slugs = [clean]

  // If domain has dots left (e.g., "scale" from "scale.ai"), try name-tld
  const parts = domain.replace(/^www\./, '').split('.')
  if (parts.length >= 2) {
    const nameTld = `${parts[0]}-${parts[parts.length - 1]}`
    if (nameTld !== clean && !slugs.includes(nameTld)) {
      slugs.push(nameTld) // e.g., "scale-ai"
    }
  }

  // Strip hyphens variant
  const noHyphen = clean.replace(/-/g, '')
  if (noHyphen !== clean && !slugs.includes(noHyphen)) {
    slugs.push(noHyphen)
  }

  return slugs
}

/** Guess domain from company name */
export function guessDomain(companyName: string): string {
  return companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
}

// ── ATS endpoint definitions ─────────────────────────────────────────────────

interface ATSProbe {
  ats: ATSPlatform
  buildUrl: (slug: string) => string
  extractJobs: (data: unknown) => RawJob[]
  buildApplyUrl: (slug: string, job: RawJob) => string
}

interface RawJob {
  title?: string
  name?: string
  location?: { name?: string } | string | null
  department?: string | null
  departments?: Array<{ name: string }> | null
  categories?: { team?: string; department?: string; location?: string; commitment?: string } | null
  updated_at?: string
  created_at?: string
  createdAt?: string
  publishedAt?: string
  posted_date?: string
  id?: string | number
  absolute_url?: string
  hostedUrl?: string
  applyUrl?: string
  url?: string
  workplaceType?: string
  employmentType?: string
  commitment?: string
  type?: string
}

const ATS_PROBES: ATSProbe[] = [
  {
    ats: 'greenhouse',
    buildUrl: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    extractJobs: (data) => {
      const d = data as { jobs?: RawJob[] }
      return d?.jobs ?? []
    },
    buildApplyUrl: (slug, job) => `https://boards.greenhouse.io/${slug}/jobs/${job.id}`,
  },
  {
    ats: 'lever',
    buildUrl: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json`,
    extractJobs: (data) => {
      if (Array.isArray(data)) return data as RawJob[]
      return []
    },
    buildApplyUrl: (_slug, job) => job.hostedUrl ?? job.applyUrl ?? '',
  },
  {
    ats: 'ashby',
    buildUrl: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
    extractJobs: (data) => {
      const d = data as { jobs?: RawJob[] }
      return d?.jobs ?? []
    },
    buildApplyUrl: (slug, job) => `https://jobs.ashbyhq.com/${slug}/${job.id}`,
  },
  {
    ats: 'workable',
    buildUrl: (slug) => `https://apply.workable.com/api/v1/widget/accounts/${slug}`,
    extractJobs: (data) => {
      const d = data as { jobs?: RawJob[] }
      return d?.jobs ?? []
    },
    buildApplyUrl: (slug, job) => job.url ?? `https://apply.workable.com/${slug}/j/${job.id}`,
  },
  {
    ats: 'recruitee',
    buildUrl: (slug) => `https://${slug}.recruitee.com/api/offers`,
    extractJobs: (data) => {
      const d = data as { offers?: RawJob[] }
      return d?.offers ?? []
    },
    buildApplyUrl: (slug, job) => `https://${slug}.recruitee.com/o/${job.id}`,
  },
]

// ── Job normalization ────────────────────────────────────────────────────────

function normalizeJob(ats: ATSPlatform, raw: RawJob, applyUrl: string): ATSJobPosting {
  const title = raw.title ?? raw.name ?? 'Untitled'

  let location: string | null = null
  if (typeof raw.location === 'string') location = raw.location
  else if (raw.location && typeof raw.location === 'object' && 'name' in raw.location) location = raw.location.name ?? null
  else if (raw.categories?.location) location = raw.categories.location

  let department: string | null = null
  if (raw.department) department = raw.department
  else if (raw.departments?.length) department = raw.departments[0].name
  else if (raw.categories?.team) department = raw.categories.team
  else if (raw.categories?.department) department = raw.categories.department

  const posted_date = raw.publishedAt ?? raw.created_at ?? raw.createdAt ?? raw.updated_at ?? raw.posted_date ?? null

  let employment_type: string | null = null
  if (raw.employmentType) employment_type = raw.employmentType
  else if (raw.commitment) employment_type = raw.commitment
  else if (raw.categories?.commitment) employment_type = raw.categories.commitment
  else if (raw.type) employment_type = raw.type

  void ats // used for potential ATS-specific normalization in future

  return { title, location, department, posted_date, url: applyUrl, employment_type }
}

// ── Role matching ────────────────────────────────────────────────────────────

/** Role alias map for fuzzy matching */
const ROLE_ALIASES: Record<string, string[]> = {
  'Product Manager': ['product manager', 'pm', 'product lead', 'product owner', 'product director', 'head of product', 'vp product', 'group pm', 'senior pm', 'staff pm'],
  'Software Engineer': ['software engineer', 'engineer', 'developer', 'swe', 'backend engineer', 'frontend engineer', 'full stack', 'fullstack', 'senior engineer', 'staff engineer'],
  'Designer': ['designer', 'product designer', 'ux designer', 'ui designer', 'design lead', 'head of design', 'senior designer'],
  'Data Scientist': ['data scientist', 'data analyst', 'ml engineer', 'machine learning', 'data engineer', 'analytics'],
  'Growth': ['growth', 'growth manager', 'growth lead', 'head of growth', 'growth marketing'],
  'GTM / Sales': ['sales', 'account executive', 'ae', 'sdr', 'bdr', 'revenue', 'business development', 'gtm'],
  'Marketing': ['marketing', 'content', 'brand', 'demand gen', 'marketing manager', 'head of marketing', 'cmoo'],
  'Operations': ['operations', 'ops', 'chief of staff', 'business operations', 'strategy'],
}

export function matchRoles(jobs: ATSJobPosting[], targetRoles: string[]): ATSJobPosting[] {
  if (targetRoles.length === 0) return []

  // Build a set of all matching keywords from target roles
  const matchTerms: string[] = []
  for (const role of targetRoles) {
    const aliases = ROLE_ALIASES[role]
    if (aliases) matchTerms.push(...aliases)
    else matchTerms.push(role.toLowerCase())
  }

  return jobs.filter(job => {
    const titleLower = job.title.toLowerCase()
    return matchTerms.some(term => titleLower.includes(term))
  })
}

// ── Main probe function ──────────────────────────────────────────────────────

interface ProbeResult {
  ats: ATSPlatform
  slug: string
  jobs: ATSJobPosting[]
}

async function probeSingleATS(probe: ATSProbe, slug: string): Promise<ProbeResult | null> {
  try {
    const res = await fetch(probe.buildUrl(slug), {
      signal: AbortSignal.timeout(3000),
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return null

    const data = await res.json()
    const rawJobs = probe.extractJobs(data)
    if (rawJobs.length === 0) return null

    const jobs = rawJobs.slice(0, 50).map(raw =>
      normalizeJob(probe.ats, raw, probe.buildApplyUrl(slug, raw))
    )

    return { ats: probe.ats, slug, jobs }
  } catch {
    return null
  }
}

/**
 * Probe all 5 ATS platforms for a given domain.
 * Returns the first ATS that has jobs, or null.
 */
export async function probeCompanyATS(
  domain: string | null,
  targetRoles: string[]
): Promise<ATSResult | null> {
  if (!domain) return null

  const slugCandidates = guessSlug(domain)

  // For each slug candidate, probe all 5 ATS in parallel
  for (const slug of slugCandidates) {
    const results = await Promise.allSettled(
      ATS_PROBES.map(probe => probeSingleATS(probe, slug))
    )

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        const { ats, slug: foundSlug, jobs } = r.value
        const matched = matchRoles(jobs, targetRoles)
        return {
          ats,
          slug: foundSlug,
          open_roles: jobs,
          total_open_roles: jobs.length,
          matched_roles: matched,
          probed_at: new Date().toISOString(),
        }
      }
    }
  }

  return null
}
