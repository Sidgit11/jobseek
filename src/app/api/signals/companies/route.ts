import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function db() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ── Company name normalization ──────────────────────────────────────────────

function normalizeCompanyName(raw: string): string {
  return raw
    .trim()
    .replace(/[.,]$/, '')
    .replace(/\s+(Inc|LLC|Ltd|Corp|Co|GmbH|SA|AG|PLC)\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractCompanyFromTitle(title: string | null): string | null {
  if (!title) return null
  const separators = [' · ', ' | ', ' - ', ' @ ']
  for (const sep of separators) {
    const idx = title.lastIndexOf(sep)
    if (idx !== -1) {
      const candidate = title.slice(idx + sep.length).trim()
      if (candidate.length > 1 && candidate.length < 80) {
        // Reject if the "company" part looks like a job title fragment
        // e.g. "Product Manager II - AI PM" → "AI PM" is NOT a company
        if (/\b(manager|engineer|developer|designer|analyst|director|lead|senior|junior|intern|specialist|coordinator|consultant|architect|scientist|pm|swe|sde|vp|cto|ceo|cfo)\b/i.test(candidate) && candidate.length < 20) continue
        if (looksLikePersonName(candidate)) continue
        return normalizeCompanyName(candidate)
      }
    }
  }
  const atMatch = title.match(/\bat\s+(.{2,60})$/i)
  if (atMatch) {
    const candidate = atMatch[1].trim()
    if (!looksLikePersonName(candidate)) return normalizeCompanyName(candidate)
  }
  return null
}

// Extract company name from Gemini's reasoning text
// e.g. "Author explicitly stated hiring doctors for MeraDoc" → "MeraDoc"
// e.g. "announced starting a new role at Stripe as Head of Product" → "Stripe"
function extractCompanyFromReasoning(reasoning: string | null): string | null {
  if (!reasoning) return null
  // Common patterns in Gemini's reasoning output
  const patterns = [
    // "hiring for MeraDoc", "at Stripe as Head", "joining Revolut which"
    /(?:hiring (?:for|at)|for|at|joining|joined|starting at|new role at|position at|working at|posted (?:by|about)|announced by)\s+([A-Z][A-Za-z0-9\s.&-]{1,40}?)(?:\s+as\s|\s*[,.]|\s+which|\s+indicating|\s+with|\s+is|\s+that|\s+in\s|\s+for\s)/,
    // "at Stripe" at end of string
    /(?:for|at|hiring at|hiring for)\s+([A-Z][A-Za-z0-9\s.&-]{1,40})$/,
    // Quoted company names: "Revolut", 'Stripe'
    /['"]([A-Z][A-Za-z0-9\s.&-]{1,30})['"]/,
    // "Company X is hiring", "Company X posted"
    /^([A-Z][A-Za-z0-9\s.&-]{1,30})\s+(?:is hiring|is actively hiring|posted|announced)/,
  ]
  for (const pattern of patterns) {
    const match = reasoning.match(pattern)
    if (match) {
      const candidate = match[1].trim()
      if (candidate.length > 1 && candidate.length < 60 && !looksLikePersonName(candidate)) {
        return normalizeCompanyName(candidate)
      }
    }
  }
  return null
}

// Extract company from preview body for job-source signals
// e.g. "Job: Senior Frontend Engineer at Stripe. San Francisco, CA..."
function extractCompanyFromPreview(preview: string | null): string | null {
  if (!preview) return null
  const jobMatch = preview.match(/^Job:\s+(.+?)\s+at\s+([^.]+)\./i)
  if (jobMatch) {
    const jobTitle = jobMatch[1].trim()
    const candidate = jobMatch[2].trim()
    // Reject if "company" looks like the job title repeated (extraction bug) or is too long
    if (candidate.length > 60) return null
    if (candidate.toLowerCase() === jobTitle.toLowerCase()) return null
    // Reject if candidate contains typical job title words — it's the title, not a company
    if (/\b(manager|engineer|developer|designer|analyst|director|lead|senior|junior|intern|specialist|coordinator|consultant|architect|scientist)\b/i.test(candidate)) return null
    if (!looksLikePersonName(candidate)) return normalizeCompanyName(candidate)
  }
  return null
}

function extractRoleFromTitle(title: string | null): string | null {
  if (!title) return null
  const separators = [' · ', ' | ', ' - ', ' @ ']
  let role = title
  for (const sep of separators) {
    const idx = title.indexOf(sep)
    if (idx !== -1) {
      role = title.slice(0, idx).trim()
      break
    }
  }
  const atMatch = role.match(/^(.+?)\s+at\s+/i)
  if (atMatch) role = atMatch[1].trim()
  if (role && role.length > 1 && role.length < 100) return role
  return null
}

// Extract the role being HIRED FOR from reasoning/preview text (for feed HIRING_POST signals
// where title is the poster's headline, not the job role)
function extractRoleFromReasoning(reasoning: string | null, preview: string | null): string | null {
  // Try reasoning first — Gemini often mentions the specific role
  if (reasoning) {
    const patterns = [
      /hiring (?:a |an |for (?:a |an )?)?([A-Z][A-Za-z /&-]{3,60}?)(?:\s+role|\s+position|\s*[,.]|\s+at\s|\s+in\s)/i,
      /looking for (?:a |an )?([A-Z][A-Za-z /&-]{3,60}?)(?:\s*[,.]|\s+at\s|\s+in\s)/i,
      /role(?:s)? (?:like |such as |including )?([A-Z][A-Za-z /&-]{3,60}?)(?:\s*[,.]|\s+at\s)/i,
      /(?:opening|position|vacancy) (?:for (?:a |an )?)?([A-Z][A-Za-z /&-]{3,60}?)(?:\s*[,.]|\s+at\s)/i,
    ]
    for (const p of patterns) {
      const m = reasoning.match(p)
      if (m && m[1].trim().length > 3) return m[1].trim()
    }
  }
  // Try preview — for job-source signals, title IS the role in the preview format "Job: ROLE at COMPANY"
  if (preview) {
    const jobMatch = preview.match(/^Job:\s+(.+?)(?:\s+at\s|\.)/i)
    if (jobMatch && jobMatch[1].trim().length > 3) return jobMatch[1].trim()
  }
  return null
}

// Check if a string looks like a job title rather than a company name
function looksLikeJobTitle(name: string): boolean {
  if (!name) return false
  return /\b(manager|engineer|developer|designer|analyst|director|lead|senior|junior|intern|specialist|coordinator|consultant|architect|scientist|product|head of|vp of)\b/i.test(name)
}

function parseSeniority(title: string): string | null {
  const t = title.toLowerCase()
  if (/\b(ceo|cto|cfo|coo|cpo|founder|co-founder|chief)\b/.test(t)) return 'c-level'
  if (/\b(vp|vice president)\b/.test(t)) return 'vp'
  if (/\bdirector\b/.test(t)) return 'director'
  if (/\b(head of|head)\b/.test(t)) return 'head'
  if (/\b(manager|lead|principal|staff)\b/.test(t)) return 'lead'
  if (/\bsenior\b/.test(t)) return 'senior'
  if (/\bjunior\b/.test(t)) return 'junior'
  return 'mid'
}

function parseDepartment(title: string): string | null {
  const t = title.toLowerCase()
  if (/\b(engineer|developer|software|swe|backend|frontend|fullstack|devops|sre|infra|platform|data engineer)\b/.test(t)) return 'engineering'
  if (/\b(product manager|product lead|product director|pm\b)/.test(t)) return 'product'
  if (/\b(design|ux|ui|creative)\b/.test(t)) return 'design'
  if (/\b(marketing|growth|brand|content|seo|sem)\b/.test(t)) return 'marketing'
  if (/\b(sales|account exec|business development|bd|revenue)\b/.test(t)) return 'sales'
  if (/\b(operations|ops|supply chain|logistics)\b/.test(t)) return 'operations'
  if (/\b(data scientist|ml|machine learning|ai|research)\b/.test(t)) return 'data-science'
  if (/\b(hr|people|talent|recruiting)\b/.test(t)) return 'people'
  return null
}

// ── Types ───────────────────────────────────────────────────────────────────

interface SignalRow {
  id: string
  type: string
  tier: number
  confidence: number
  author: string | null
  title: string | null
  source: string | null
  post_url: string | null
  preview: string | null
  detected_at: string
  reasoning: string | null
  outreach_hook: string | null
  enriched_company: string | null
  author_company: string | null
  author_linkedin_url: string | null
}

const JOB_SOURCES = new Set(['JOBS', 'FEED_JOBS_WIDGET', 'NOTIFICATION_JOB_ALERT'])

function isJobSignal(row: SignalRow): boolean {
  if (row.type === 'HIRING_POST') return true
  if (row.source && JOB_SOURCES.has(row.source)) return true
  return false
}

// Detect if a string looks like a person name rather than a company name.
// Person names: "Shweta V.", "Prashant Tiwari", "John Smith III"
// Company names: "Revolut", "Orange Health Labs", "Meta Platforms"
function looksLikePersonName(name: string): boolean {
  if (!name) return false
  const trimmed = name.trim()
  // Company indicators — if present, it's likely a company
  if (/\b(Inc|LLC|Ltd|Corp|Labs|Technologies|Solutions|Ventures|Capital|Health|AI|Tech|Group|Global|Digital|Systems|Studios|Media|Platform|Platforms|Software|Services|Network|Networks|Finance|Financial|Consulting|Analytics|Robotics|Therapeutics|Pharma|Bio|Energy|Motors|Foods|Brands)\b/i.test(trimmed)) return false
  // Single word with no spaces — could be company (Revolut, Meta, Stripe) — NOT a person
  if (!trimmed.includes(' ')) return false
  // Two words where both start with uppercase — classic person name pattern
  // e.g. "Prashant Tiwari", "Shweta V.", "John Smith"
  const words = trimmed.split(/\s+/)
  if (words.length === 2) {
    const [first, second] = words
    // "Shweta V." pattern
    if (/^[A-Z][a-z]+$/.test(first) && /^[A-Z]\.?$/.test(second)) return true
    // "Prashant Tiwari" pattern — two capitalized words, no company indicators
    if (/^[A-Z][a-z]+$/.test(first) && /^[A-Z][a-z]+$/.test(second)) return true
  }
  // Three words like "John Smith Jr" or "Mary Jane Watson"
  if (words.length === 3 && words.every(w => /^[A-Z][a-z]*\.?$/.test(w))) return true
  return false
}

// ── GET: Read from signal_companies + signal_jobs (with fallback) ──────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'token query param is required' },
        { status: 400, headers: CORS }
      )
    }

    const supabase = db()

    // Try reading from materialized tables first
    const { data: companies, error: compErr } = await supabase
      .from('signal_companies')
      .select('*, signal_jobs(*)')
      .eq('device_token', token)
      .neq('status', 'archived')
      .order('latest_signal_at', { ascending: false })

    if (!compErr && companies && companies.length > 0) {
      // Materialized data exists — return it
      const result = companies.map((c: Record<string, unknown>) => ({
        id: c.id,
        companyName: c.name,
        domain: c.domain,
        linkedinUrl: c.linkedin_url,
        headcount: c.headcount,
        fundingStage: c.funding_stage,
        description: c.description,
        industry: c.industry,
        location: c.location,
        companyId: c.company_id,
        roles: ((c.signal_jobs as Array<Record<string, unknown>>) || []).map((j) => j.title as string),
        signalCount: c.signal_count,
        roleCount: c.role_count,
        sources: c.sources,
        latestDetectedAt: c.latest_signal_at,
        highestConfidence: c.highest_confidence,
        status: c.status,
        signals: ((c.signal_jobs as Array<Record<string, unknown>>) || []).map((j) => ({
          id: j.id,
          type: 'HIRING_POST',
          title: j.title,
          author: j.poster_name,
          preview: null,
          post_url: j.job_url,
          detected_at: j.detected_at,
          confidence: j.confidence,
          source: j.source,
          seniority: j.seniority,
          department: j.department,
          location: j.location,
          status: j.status,
        })),
      }))

      return NextResponse.json(
        { companies: result, total: result.length, materialized: true },
        { headers: CORS }
      )
    }

    // Fallback: aggregate from linkedin_signals in-memory (pre-migration)
    console.log('[signals/companies] Falling back to in-memory aggregation')
    return fallbackAggregation(supabase, token)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[signals/companies] Error:', message)
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}

// ── POST: Materialize companies + jobs from signals ─────────────────────────
// Called after signals are stored — extracts companies and jobs into dedicated tables

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, signals } = body as { token: string; signals: SignalRow[] }

    if (!token || !signals?.length) {
      return NextResponse.json(
        { error: 'token and signals are required' },
        { status: 400, headers: CORS }
      )
    }

    const supabase = db()
    const jobSignals = signals.filter(isJobSignal)
    if (jobSignals.length === 0) {
      return NextResponse.json({ materialized: 0 }, { headers: CORS })
    }

    let companiesUpserted = 0
    let jobsUpserted = 0

    for (const signal of jobSignals) {
      // For JOBS/FEED_JOBS_WIDGET sources, `author` IS the company name (LinkedIn job cards use company as author).
      // For FEED/NOTIFICATIONS HIRING_POST signals, `author` is usually a PERSON posting about their company hiring.
      // Never use a person's name or job title as the company name.
      const isJobSource = signal.source != null && JOB_SOURCES.has(signal.source)

      // Build company name from multiple sources, with validation at each step
      const candidates = [
        signal.enriched_company,
        // Only trust author_company if it doesn't look like a job title
        signal.author_company && !looksLikeJobTitle(signal.author_company) ? signal.author_company : null,
        extractCompanyFromTitle(signal.title),
        extractCompanyFromPreview(signal.preview),
        extractCompanyFromReasoning(signal.reasoning),
        // Only use author as company for job-source signals (where author IS the company)
        isJobSource && signal.author && !looksLikeJobTitle(signal.author) && !looksLikePersonName(signal.author) ? signal.author : null,
        // Last resort: use author if it's clearly a company name
        signal.author && !looksLikePersonName(signal.author) && !looksLikeJobTitle(signal.author) ? signal.author : null,
      ]

      const rawCompany = candidates.find(c => c != null && c.trim().length > 1) ?? null
      if (!rawCompany) {
        console.log(`[signals/companies] Skipping signal ${signal.id} — no valid company name found (author="${signal.author}", title="${signal.title}")`)
        continue
      }

      const companyName = normalizeCompanyName(rawCompany)
      const nameLower = companyName.toLowerCase()
      const REJECT_NAMES = new Set(['unknown company', 'unknown', 'linkedin', 'linkedin user', 'notification'])
      if (!nameLower || REJECT_NAMES.has(nameLower) || looksLikeJobTitle(companyName)) {
        console.log(`[signals/companies] Skipping "${companyName}" — invalid company name (rejected/job title)`)
        continue
      }

      // Upsert signal_company
      const { data: companyRow, error: compErr } = await supabase
        .from('signal_companies')
        .upsert({
          device_token: token,
          name: companyName,
          name_lower: nameLower,
          linkedin_url: signal.author_linkedin_url,
          latest_signal_at: signal.detected_at,
          highest_confidence: signal.confidence ?? 0,
          sources: [signal.source, signal.type === 'HIRING_POST' ? 'HIRING_POST' : null].filter(Boolean),
        }, {
          onConflict: 'device_token,name_lower',
        })
        .select('id, signal_count, sources, highest_confidence')
        .single()

      if (compErr) {
        console.error('[signals/companies] Company upsert error:', compErr.message)
        continue
      }

      companiesUpserted++

      // Extract role — for job-source signals, `title` IS the job role.
      // For feed HIRING_POST signals, `title` is the poster's headline — role is in reasoning/preview.
      let role: string | null = null
      if (isJobSource) {
        // Title IS the job role for job listings (e.g. "Product Strategy Manager")
        role = signal.title && signal.title.length > 2 ? signal.title : null
      } else {
        // Feed signal: try extracting from reasoning/preview first, fall back to title parsing
        role = extractRoleFromReasoning(signal.reasoning, signal.preview) ?? extractRoleFromTitle(signal.title)
      }
      if (role) {
        const { error: jobErr } = await supabase
          .from('signal_jobs')
          .upsert({
            device_token: token,
            signal_company_id: companyRow.id,
            title: role,
            title_lower: role.toLowerCase(),
            seniority: parseSeniority(role),
            department: parseDepartment(role),
            source: signal.source ?? 'FEED',
            signal_id: signal.id,
            detected_at: signal.detected_at,
            confidence: signal.confidence ?? 0,
            poster_name: signal.author,
            poster_title: signal.title,
            poster_linkedin: signal.author_linkedin_url,
            job_url: signal.post_url,
          }, {
            onConflict: 'signal_company_id,title_lower,source',
          })

        if (jobErr) {
          console.error('[signals/companies] Job upsert error:', jobErr.message)
        } else {
          jobsUpserted++
        }
      }

      // Update aggregated stats on signal_company
      const { data: jobCount } = await supabase
        .from('signal_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('signal_company_id', companyRow.id)

      const currentSources = new Set<string>(companyRow.sources || [])
      if (signal.source) currentSources.add(signal.source)
      if (signal.type === 'HIRING_POST') currentSources.add('HIRING_POST')

      await supabase
        .from('signal_companies')
        .update({
          signal_count: (companyRow.signal_count ?? 0) + 1,
          role_count: jobCount ?? 0,
          sources: Array.from(currentSources),
          highest_confidence: Math.max(companyRow.highest_confidence ?? 0, signal.confidence ?? 0),
          latest_signal_at: signal.detected_at,
        })
        .eq('id', companyRow.id)
    }

    console.log(`[signals/companies] Materialized ${companiesUpserted} companies, ${jobsUpserted} jobs`)
    return NextResponse.json(
      { materialized: companiesUpserted, jobs: jobsUpserted },
      { headers: CORS }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[signals/companies] POST error:', message)
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}

// ── Fallback: in-memory aggregation from linkedin_signals ───────────────────

async function fallbackAggregation(supabase: ReturnType<typeof db>, token: string) {
  const { data, error } = await supabase
    .from('linkedin_signals')
    .select('*')
    .eq('device_token', token)
    .neq('status', 'dismissed')
    .order('detected_at', { ascending: false })

  if (error) {
    console.error('[signals/companies] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS })
  }

  const rows = (data ?? []) as SignalRow[]
  const jobSignals = rows.filter(isJobSignal)

  const companyMap = new Map<string, {
    raw: string; roles: Set<string>; sources: Set<string>;
    latestDetectedAt: string; highestConfidence: number; signals: SignalRow[]
  }>()

  for (const row of jobSignals) {
    const isJobSource = row.source != null && JOB_SOURCES.has(row.source)

    const candidates = [
      row.enriched_company,
      row.author_company && !looksLikeJobTitle(row.author_company) ? row.author_company : null,
      extractCompanyFromTitle(row.title),
      extractCompanyFromPreview(row.preview),
      extractCompanyFromReasoning(row.reasoning),
      isJobSource && row.author && !looksLikeJobTitle(row.author) && !looksLikePersonName(row.author) ? row.author : null,
      row.author && !looksLikePersonName(row.author) && !looksLikeJobTitle(row.author) ? row.author : null,
    ]
    const rawCompany = candidates.find(c => c != null && c.trim().length > 1) ?? null

    if (!rawCompany) continue
    const normalized = normalizeCompanyName(rawCompany)
    const REJECT_NAMES_FB = new Set(['unknown company', 'unknown', 'linkedin', 'linkedin user', 'notification'])
    if (!normalized || REJECT_NAMES_FB.has(normalized.toLowerCase()) || looksLikeJobTitle(normalized)) continue
    const key = normalized.toLowerCase()

    let entry = companyMap.get(key)
    if (!entry) {
      entry = {
        raw: normalized,
        roles: new Set<string>(),
        sources: new Set<string>(),
        latestDetectedAt: row.detected_at,
        highestConfidence: row.confidence ?? 0,
        signals: [],
      }
      companyMap.set(key, entry)
    }

    // Role extraction: for job sources, title IS the role; for feed, extract from reasoning
    const role = isJobSource
      ? (row.title && row.title.length > 2 ? row.title : null)
      : (extractRoleFromReasoning(row.reasoning, row.preview) ?? extractRoleFromTitle(row.title))
    if (role) entry.roles.add(role)
    if (row.source) entry.sources.add(row.source)
    if (row.type === 'HIRING_POST') entry.sources.add('HIRING_POST')
    if (row.detected_at > entry.latestDetectedAt) entry.latestDetectedAt = row.detected_at
    if ((row.confidence ?? 0) > entry.highestConfidence) entry.highestConfidence = row.confidence ?? 0
    entry.signals.push(row)
  }

  const companies = Array.from(companyMap.values())
    .map(e => ({
      companyName: e.raw,
      roles: Array.from(e.roles),
      signalCount: e.signals.length,
      sources: Array.from(e.sources),
      latestDetectedAt: e.latestDetectedAt,
      highestConfidence: e.highestConfidence,
      signals: e.signals,
    }))
    .sort((a, b) => b.signalCount - a.signalCount)

  return NextResponse.json(
    { companies, total: companies.length, materialized: false },
    { headers: CORS }
  )
}
