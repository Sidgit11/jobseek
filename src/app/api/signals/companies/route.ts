import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { routeLogger } from '@/lib/logger'
import { getCorsHeaders } from '@/lib/cors'
import {
  normalizeCompanyName,
  looksLikePersonName,
  looksLikeJobTitle,
  extractCompanyFromTitle,
  extractCompanyFromReasoning,
  extractCompanyFromPreview,
  extractRoleFromTitle,
  extractRoleFromReasoning,
  parseSeniority,
  parseDepartment,
} from '@/lib/signals/extraction'

const log = routeLogger('signals/companies')

function db() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin')) })
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

// ── GET: Read from signal_companies + signal_jobs (with fallback) ──────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'token query param is required' },
        { status: 400, headers: getCorsHeaders(req.headers.get('origin')) }
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
        { headers: getCorsHeaders(req.headers.get('origin')) }
      )
    }

    // Fallback: aggregate from linkedin_signals in-memory (pre-migration)
    log.step('fallback', { reason: 'no materialized data' })
    return fallbackAggregation(supabase, token, req.headers.get('origin'))

  } catch (err: unknown) {
    log.err('get', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: getCorsHeaders(req.headers.get('origin')) })
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
        { status: 400, headers: getCorsHeaders(req.headers.get('origin')) }
      )
    }

    const supabase = db()
    const jobSignals = signals.filter(isJobSignal)
    if (jobSignals.length === 0) {
      return NextResponse.json({ materialized: 0 }, { headers: getCorsHeaders(req.headers.get('origin')) })
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
        log.step('skip-no-company', { signalId: signal.id, author: signal.author, title: signal.title })
        continue
      }

      const companyName = normalizeCompanyName(rawCompany)
      const nameLower = companyName.toLowerCase()
      const REJECT_NAMES = new Set(['unknown company', 'unknown', 'linkedin', 'linkedin user', 'notification'])
      if (!nameLower || REJECT_NAMES.has(nameLower) || looksLikeJobTitle(companyName)) {
        log.step('skip-invalid-name', { companyName })
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
        log.err('company-upsert', new Error(compErr.message))
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
          log.err('job-upsert', new Error(jobErr.message))
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

    log.res(200, { companies: companiesUpserted, jobs: jobsUpserted })
    return NextResponse.json(
      { materialized: companiesUpserted, jobs: jobsUpserted },
      { headers: getCorsHeaders(req.headers.get('origin')) }
    )

  } catch (err: unknown) {
    log.err('post', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: getCorsHeaders(req.headers.get('origin')) })
  }
}

// ── Fallback: in-memory aggregation from linkedin_signals ───────────────────

async function fallbackAggregation(supabase: ReturnType<typeof db>, token: string, requestOrigin: string | null) {
  const { data, error } = await supabase
    .from('linkedin_signals')
    .select('*')
    .eq('device_token', token)
    .neq('status', 'dismissed')
    .order('detected_at', { ascending: false })

  if (error) {
    log.err('supabase-query', new Error(error.message))
    return NextResponse.json({ error: error.message }, { status: 500, headers: getCorsHeaders(requestOrigin) })
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
    { headers: getCorsHeaders(requestOrigin) }
  )
}
