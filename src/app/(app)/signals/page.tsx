'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, Copy, Check, ExternalLink, Zap, Radio, ChevronDown, ChevronUp, MapPin, Users, Building2, FileText, Briefcase, Search, ArrowUpDown } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type SignalType =
  | 'JOB_CHANGE'
  | 'HIRING_POST'
  | 'FUNDING_SIGNAL'
  | 'DECISION_MAKER_ACTIVE'
  | 'COMPANY_MILESTONE'
  | 'WARM_PATH_OPENED' // deprecated — kept for backward compat with existing DB rows

type Tier = 1 | 2

interface Signal {
  id: string
  type: SignalType
  tier: Tier
  confidence: number
  detectedAt: string
  authorName: string
  authorTitle: string
  postUrl?: string        // link to the LinkedIn post itself — used for "View Post"
  authorLinkedInUrl?: string  // link to author's LinkedIn profile
  degree?: string
  reactorName?: string
  reasoning: string
  outreachHook: string
  postPreview: string
  authorCompany?: string
  authorRole?: string
  authorAbout?: string
  authorLocation?: string
  mutualConnections?: number
  enrichedAt?: string
  source?: string
}

// Map snake_case Supabase rows → camelCase Signal
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSignal(row: any): Signal {
  return {
    id: row.id,
    type: row.type as SignalType,
    tier: row.tier as Tier,
    confidence: row.confidence ?? 0,
    detectedAt: row.detected_at ?? row.detectedAt ?? new Date().toISOString(),
    authorName: row.author ?? row.authorName ?? '',
    authorTitle: row.title ?? row.authorTitle ?? '',
    postUrl: row.post_url ?? row.postUrl ?? undefined,
    authorLinkedInUrl: row.author_linkedin_url ?? row.authorLinkedInUrl ?? undefined,
    degree: row.degree,
    reactorName: row.reactor ?? row.reactorName ?? undefined,
    reasoning: row.reasoning ?? '',
    outreachHook: row.outreach_hook ?? row.outreachHook ?? '',
    postPreview: row.preview ?? row.postPreview ?? '',
    authorCompany: row.enriched_company ?? row.author_company ?? undefined,
    authorRole: row.enriched_role ?? row.author_role ?? undefined,
    authorAbout: row.enriched_about ?? row.author_about ?? undefined,
    authorLocation: row.enriched_location ?? row.author_location ?? undefined,
    mutualConnections: row.enriched_mutual_connections ?? row.mutual_connections ?? undefined,
    enrichedAt: row.enriched_at ?? undefined,
    source: row.source ?? undefined,
  }
}

interface OutreachPayload {
  bestChannel: string
  whyNow: string
  connectionRequest: string
  directMessage: string
  strategy: string
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const C = {
  bg: 'var(--color-bg)',
  card: 'var(--color-surface)',
  border: 'var(--border-color-subtle)',
  accent: 'var(--color-lime)',
  accentGlow: 'var(--color-lime-subtle)',
  accentSoft: 'var(--color-lime-text)',
  green: 'var(--color-success)',
  amber: 'var(--color-warning)',
  red: 'var(--color-error)',
  muted: 'var(--color-text-tertiary)',
  text: 'var(--color-text-primary)',
  textDim: 'var(--color-text-secondary)',
}

// ─── Signal type metadata ─────────────────────────────────────────────────────

const TYPE_META: Record<SignalType, { label: string; bg: string; color: string; emoji: string }> = {
  JOB_CHANGE: { label: 'Job Change', bg: 'rgba(163,230,53,0.12)', color: '#3F6212', emoji: '🟢' },
  HIRING_POST: { label: 'Hiring', bg: 'rgba(59,130,246,0.1)', color: '#1D4ED8', emoji: '🔵' },
  FUNDING_SIGNAL: { label: 'Funding', bg: 'rgba(245,158,11,0.1)', color: '#B45309', emoji: '🟡' },
  DECISION_MAKER_ACTIVE: { label: 'Decision Maker', bg: 'rgba(139,92,246,0.1)', color: '#6D28D9', emoji: '🟣' },
  COMPANY_MILESTONE: { label: 'Milestone', bg: 'rgba(6,182,212,0.1)', color: '#0E7490', emoji: '🔷' },
  WARM_PATH_OPENED: { label: 'Warm Path', bg: 'rgba(34,197,94,0.1)', color: '#15803D', emoji: '🟢' },
}

const SIGNAL_BORDER: Record<string, string> = {
  JOB_CHANGE: '#A3E635',
  HIRING_POST: '#3B82F6',
  FUNDING_SIGNAL: '#F59E0B',
  DECISION_MAKER_ACTIVE: '#8B5CF6',
  COMPANY_MILESTONE: '#06B6D4',
  WARM_PATH_OPENED: '#22C55E',
}

// ─── Mock signals for demo ────────────────────────────────────────────────────

const MOCK_SIGNALS: Signal[] = [
  {
    id: 'sig_001',
    type: 'HIRING_POST',
    tier: 1,
    confidence: 94,
    detectedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    authorName: 'Sarah Chen',
    authorTitle: 'VP of Engineering · Vercel',
    postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:7310000000000001',
    degree: '2nd',
    reasoning: 'Hiring post with direct "DM me your portfolio" CTA. High response probability — decision-maker is actively recruiting.',
    outreachHook: "Love the edge runtime work at Vercel — I've been shipping with it since the v2 beta. Happy to share what I've built.",
    postPreview: "We're hiring senior engineers for our edge runtime team. If you've worked on distributed systems at scale and love developer tooling, I want to talk to you. DM me your portfolio or best project...",
  },
  {
    id: 'sig_002',
    type: 'FUNDING_SIGNAL',
    tier: 1,
    confidence: 88,
    detectedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    authorName: 'Marcus Thorn',
    authorTitle: 'Co-founder & CEO · Arcane AI',
    postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:7310000000000002',
    degree: '1st',
    reactorName: 'Alex Rivera',
    reasoning: 'Company just announced Series A. Founder is personally celebrating and engaging — perfect window to reach out before inbox floods.',
    outreachHook: "Congrats on the Series A — huge milestone. I've been following Arcane's agent framework and would love to be part of what's next.",
    postPreview: "We did it. Arcane AI just closed our $18M Series A led by Sequoia. 18 months ago it was just me and a whiteboard. Today we have 40 incredible humans building the future of AI agents...",
  },
  {
    id: 'sig_003',
    type: 'JOB_CHANGE',
    tier: 2,
    confidence: 76,
    detectedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    authorName: 'Priya Nambiar',
    authorTitle: 'Head of Product · Previously Stripe',
    postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:7310000000000003',
    degree: '2nd',
    reasoning: 'Just started a new role — typically open to building their team in the first 90 days. Timing is optimal for outreach.',
    outreachHook: "Congrats on the new chapter! Stripe's infra work is legendary — excited to see what you build next.",
    postPreview: "Excited to share that I've joined Linear as Head of Product. After 4 amazing years at Stripe, I'm thrilled to join this incredible team building the future of project management...",
  },
  {
    id: 'sig_004',
    type: 'DECISION_MAKER_ACTIVE',
    tier: 1,
    confidence: 91,
    detectedAt: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
    authorName: 'David Park',
    authorTitle: 'CTO · Runway ML',
    postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:7310000000000004',
    degree: '2nd',
    reasoning: 'CTO actively commenting on AI model compression posts — signals they\'re hiring in this space. High engagement window.',
    outreachHook: "Your take on quantization tradeoffs resonated — I've been deep in this at inference scale.",
    postPreview: "Hot take: most teams are sleeping on the model efficiency gains available today. We're seeing 4x throughput improvements with quantization that was impossible 6 months ago...",
  },
]

// ─── Companies Hiring types ──────────────────────────────────────────────────

type DashboardTab = 'signals' | 'companies'

interface HiringCompany {
  companyName: string
  roles: string[]
  signalCount: number
  sources: string[]
  latestDetectedAt: string
  highestConfidence: number
  signals: Array<{
    id: string
    type: string
    title: string | null
    author: string | null
    preview: string | null
    post_url: string | null
    detected_at: string
    confidence: number
    source: string | null
  }>
}

const SOURCE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  FEED_JOBS_WIDGET: { label: 'Feed Widget', bg: 'var(--color-lime-subtle)', color: 'var(--color-lime-text)' },
  JOBS: { label: 'Jobs Page', bg: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' },
  HIRING_POST: { label: 'Hiring Post', bg: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)' },
  FEED: { label: 'Feed', bg: 'var(--color-lime-subtle)', color: 'var(--color-text-tertiary)' },
}

const MOCK_HIRING_COMPANIES: HiringCompany[] = [
  {
    companyName: 'Vercel',
    roles: ['Senior Engineer, Edge Runtime', 'Staff Frontend Engineer', 'DevRel Lead'],
    signalCount: 4,
    sources: ['HIRING_POST', 'JOBS', 'FEED_JOBS_WIDGET'],
    latestDetectedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    highestConfidence: 94,
    signals: [
      { id: 'hc_1a', type: 'HIRING_POST', title: 'VP of Engineering · Vercel', author: 'Sarah Chen', preview: "We're hiring senior engineers for our edge runtime team...", post_url: '#', detected_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(), confidence: 94, source: 'FEED' },
      { id: 'hc_1b', type: 'HIRING_POST', title: 'Senior Engineer, Edge Runtime', author: null, preview: null, post_url: null, detected_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(), confidence: 88, source: 'JOBS' },
      { id: 'hc_1c', type: 'HIRING_POST', title: 'Staff Frontend Engineer', author: null, preview: null, post_url: null, detected_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), confidence: 85, source: 'FEED_JOBS_WIDGET' },
      { id: 'hc_1d', type: 'HIRING_POST', title: 'DevRel Lead', author: null, preview: null, post_url: null, detected_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), confidence: 79, source: 'JOBS' },
    ],
  },
  {
    companyName: 'Runway ML',
    roles: ['ML Engineer, Inference', 'Senior Backend Engineer'],
    signalCount: 3,
    sources: ['HIRING_POST', 'FEED_JOBS_WIDGET'],
    latestDetectedAt: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
    highestConfidence: 91,
    signals: [
      { id: 'hc_2a', type: 'HIRING_POST', title: 'CTO · Runway ML', author: 'David Park', preview: 'Hot take: most teams are sleeping on the model efficiency gains...', post_url: '#', detected_at: new Date(Date.now() - 58 * 60 * 1000).toISOString(), confidence: 91, source: 'FEED' },
      { id: 'hc_2b', type: 'HIRING_POST', title: 'ML Engineer, Inference', author: null, preview: null, post_url: null, detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), confidence: 82, source: 'FEED_JOBS_WIDGET' },
      { id: 'hc_2c', type: 'HIRING_POST', title: 'Senior Backend Engineer', author: null, preview: null, post_url: null, detected_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), confidence: 75, source: 'FEED_JOBS_WIDGET' },
    ],
  },
  {
    companyName: 'Linear',
    roles: ['Head of Product', 'Senior Product Designer'],
    signalCount: 2,
    sources: ['JOBS', 'FEED_JOBS_WIDGET'],
    latestDetectedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    highestConfidence: 76,
    signals: [
      { id: 'hc_3a', type: 'HIRING_POST', title: 'Head of Product · Linear', author: 'Priya Nambiar', preview: "Excited to share that I've joined Linear as Head of Product...", post_url: '#', detected_at: new Date(Date.now() - 31 * 60 * 1000).toISOString(), confidence: 76, source: 'FEED' },
      { id: 'hc_3b', type: 'HIRING_POST', title: 'Senior Product Designer', author: null, preview: null, post_url: null, detected_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), confidence: 70, source: 'JOBS' },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type SignalSortBy = 'recent' | 'confidence' | 'tier'
type CompanySortBy = 'recent' | 'signals' | 'confidence'

function sortSignals(signals: Signal[], sortBy: SignalSortBy = 'recent'): Signal[] {
  return [...signals].sort((a, b) => {
    if (sortBy === 'recent') {
      const timeDiff = new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
      if (timeDiff !== 0) return timeDiff
      if (a.tier !== b.tier) return a.tier - b.tier
      return b.confidence - a.confidence
    }
    if (sortBy === 'confidence') {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    }
    // sortBy === 'tier'
    if (a.tier !== b.tier) return a.tier - b.tier
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  })
}

function sortCompanies(companies: HiringCompany[], sortBy: CompanySortBy = 'recent'): HiringCompany[] {
  return [...companies].sort((a, b) => {
    if (sortBy === 'recent') return new Date(b.latestDetectedAt).getTime() - new Date(a.latestDetectedAt).getTime()
    if (sortBy === 'signals') return b.signalCount - a.signalCount
    // confidence
    return b.highestConfidence - a.highestConfidence
  })
}

function searchSignals(signals: Signal[], query: string): Signal[] {
  if (!query.trim()) return signals
  const q = query.toLowerCase()
  return signals.filter(s =>
    s.authorName.toLowerCase().includes(q) ||
    s.authorTitle.toLowerCase().includes(q) ||
    s.postPreview.toLowerCase().includes(q) ||
    s.reasoning.toLowerCase().includes(q)
  )
}

function searchCompanies(companies: HiringCompany[], query: string): HiringCompany[] {
  if (!query.trim()) return companies
  const q = query.toLowerCase()
  return companies.filter(c =>
    c.companyName.toLowerCase().includes(q) ||
    c.roles.some(r => r.toLowerCase().includes(q))
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: SignalType }) {
  const meta = TYPE_META[type]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.emoji} {meta.label}
    </span>
  )
}

function TierDot({ tier }: { tier: Tier }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{ color: tier === 1 ? C.red : C.amber }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: tier === 1 ? C.red : C.amber }}
      />
      T{tier}
    </span>
  )
}

function DegreeBadge({ degree }: { degree: string }) {
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
      style={{ background: 'var(--color-lime-subtle)', color: C.accentSoft, border: '1px solid var(--color-lime-subtle)' }}
    >
      {degree}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
      style={{
        background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.03)',
        color: copied ? C.green : C.textDim,
        border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : C.border}`,
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function OutreachPanel({ payload, onClose }: { payload: OutreachPayload; onClose: () => void }) {
  const [tab, setTab] = useState<'connection' | 'dm'>('connection')
  const activeText = tab === 'connection' ? payload.connectionRequest : payload.directMessage

  const channelColors: Record<string, { bg: string; color: string }> = {
    LinkedIn: { bg: 'rgba(29,78,216,0.15)', color: '#60A5FA' },
    Email: { bg: 'var(--color-lime-subtle)', color: C.accentSoft },
    default: { bg: 'rgba(34,197,94,0.1)', color: C.green },
  }
  const ch = channelColors[payload.bestChannel] ?? channelColors.default

  return (
    <div
      className="mt-3 rounded-xl p-4"
      style={{ background: C.bg, border: `1px solid ${C.border}` }}
    >
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider" style={{ color: C.muted }}>
            Best Channel
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{ background: ch.bg, color: ch.color }}
          >
            {payload.bestChannel}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs transition-opacity hover:opacity-60"
          style={{ color: C.muted }}
        >
          ✕ Close
        </button>
      </div>

      {/* Why now */}
      <p className="mb-3 text-xs italic leading-relaxed" style={{ color: C.textDim }}>
        {payload.whyNow}
      </p>

      {/* Tabs */}
      <div className="mb-3 flex gap-1 rounded-lg p-1" style={{ background: 'var(--color-surface)' }}>
        {(['connection', 'dm'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-md py-1.5 text-xs font-medium transition-all"
            style={{
              background: tab === t ? C.card : 'transparent',
              color: tab === t ? C.text : C.muted,
              border: tab === t ? `1px solid ${C.border}` : '1px solid transparent',
            }}
          >
            {t === 'connection' ? 'Connection Request' : 'Direct Message'}
          </button>
        ))}
      </div>

      {/* Message text */}
      <div
        className="mb-3 rounded-lg p-3 text-sm leading-relaxed"
        style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}
      >
        {activeText}
      </div>

      {/* Copy + strategy */}
      <div className="flex items-start justify-between gap-3">
        <p className="flex-1 text-xs leading-relaxed" style={{ color: C.muted }}>
          {payload.strategy}
        </p>
        <CopyButton text={activeText} />
      </div>
    </div>
  )
}

// ─── Scan summary types ──────────────────────────────────────────────────────

interface ScanSummaryData {
  summary: string
  signalCount: number
  signalBreakdown: Record<string, number>
  createdAt?: string
}

const BREAKDOWN_LABELS: Record<string, string> = {
  JOB_CHANGE: 'Job Change',
  HIRING_POST: 'Hiring',
  FUNDING_SIGNAL: 'Funding',
  DECISION_MAKER_ACTIVE: 'Decision Maker',
  COMPANY_MILESTONE: 'Milestone',
  WARM_PATH_OPENED: 'Warm Path',
}

function ScanSummaryCard({ token }: { token: string }) {
  const [data, setData] = useState<ScanSummaryData | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch(`/api/signals/summary?token=${encodeURIComponent(token)}`)
        if (res.ok) {
          const json = await res.json()
          if (json.summary) {
            setData(json as ScanSummaryData)
          }
        }
      } catch {
        // Summary is optional — silently fail
      }
      setLoaded(true)
    }
    fetchSummary()
  }, [token])

  if (!loaded || !data) return null

  return (
    <div
      className="mb-6 rounded-2xl overflow-hidden"
      style={{ background: C.card, border: `1px solid ${C.border}` }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className="flex w-full items-center justify-between px-5 py-4"
        style={{ borderBottom: collapsed ? 'none' : `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <FileText size={13} style={{ color: C.green }} />
          </div>
          <span className="text-sm font-bold" style={{ color: C.text }}>
            Scan Briefing
          </span>
          {data.createdAt && (
            <span className="text-xs" style={{ color: C.muted }}>
              {timeAgo(data.createdAt)}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown size={16} style={{ color: C.muted }} />
        ) : (
          <ChevronUp size={16} style={{ color: C.muted }} />
        )}
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="px-5 pb-4 pt-3">
          <p className="mb-3 text-sm leading-relaxed" style={{ color: C.textDim }}>
            {data.summary}
          </p>

          {/* Breakdown pills */}
          {data.signalBreakdown && Object.keys(data.signalBreakdown).length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium" style={{ color: C.muted }}>
                {data.signalCount} signal{data.signalCount !== 1 ? 's' : ''}:
              </span>
              {Object.entries(data.signalBreakdown).map(([type, count]) => {
                const meta = TYPE_META[type as SignalType]
                return (
                  <span
                    key={type}
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      background: meta ? meta.bg : 'var(--border-color-subtle)',
                      color: meta ? meta.color : C.textDim,
                    }}
                  >
                    {count} {BREAKDOWN_LABELS[type] ?? type}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-2xl p-5"
      style={{ background: C.card, border: `1px solid ${C.border}` }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="h-5 w-24 rounded-full" style={{ background: 'var(--border-color-subtle)' }} />
        <div className="h-5 w-6 rounded-full" style={{ background: 'var(--border-color-subtle)' }} />
        <div className="ml-auto h-4 w-16 rounded" style={{ background: 'var(--border-color-subtle)' }} />
      </div>
      <div className="mb-2 h-4 w-40 rounded" style={{ background: 'var(--border-color-subtle)' }} />
      <div className="mb-4 h-3 w-56 rounded" style={{ background: 'var(--border-color-subtle)' }} />
      <div className="mb-1 h-3 w-full rounded" style={{ background: 'var(--border-color-subtle)' }} />
      <div className="mb-4 h-3 w-4/5 rounded" style={{ background: 'var(--border-color-subtle)' }} />
      <div className="flex gap-2">
        <div className="h-8 w-32 rounded-xl" style={{ background: 'var(--border-color-subtle)' }} />
        <div className="h-8 w-28 rounded-xl" style={{ background: 'var(--border-color-subtle)' }} />
        <div className="h-8 w-20 rounded-xl" style={{ background: 'var(--border-color-subtle)' }} />
      </div>
    </div>
  )
}

function EnrichmentInfo({ signal }: { signal: Signal }) {
  const [aboutExpanded, setAboutExpanded] = useState(false)

  const hasCompanyRole =
    (signal.authorCompany || signal.authorRole) &&
    // Only show if different from authorTitle to avoid redundancy
    !(signal.authorTitle?.includes(signal.authorCompany ?? '__NONE__') &&
      signal.authorTitle?.includes(signal.authorRole ?? '__NONE__'))
  const hasEnrichment =
    hasCompanyRole || signal.authorLocation || signal.mutualConnections || signal.authorAbout

  if (!hasEnrichment) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      {hasCompanyRole && (
        <span className="flex items-center gap-1 text-xs" style={{ color: C.textDim }}>
          <Building2 size={11} />
          {[signal.authorRole, signal.authorCompany].filter(Boolean).join(' at ')}
        </span>
      )}
      {signal.authorLocation && (
        <span className="flex items-center gap-1 text-xs" style={{ color: C.textDim }}>
          <MapPin size={11} />
          {signal.authorLocation}
        </span>
      )}
      {signal.mutualConnections != null && signal.mutualConnections > 0 && (
        <span className="flex items-center gap-1 text-xs" style={{ color: C.textDim }}>
          <Users size={11} />
          {signal.mutualConnections} mutual connection{signal.mutualConnections !== 1 ? 's' : ''}
        </span>
      )}
      {signal.authorAbout && (
        <div className="w-full mt-1">
          <p
            className="text-xs leading-relaxed"
            style={{
              color: C.muted,
              ...(!aboutExpanded
                ? {
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                  }
                : {}),
            }}
          >
            {signal.authorAbout}
          </p>
          {signal.authorAbout.length > 120 && (
            <button
              onClick={() => setAboutExpanded(prev => !prev)}
              className="mt-0.5 text-xs font-medium"
              style={{ color: C.accentSoft }}
            >
              {aboutExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SignalCard({
  signal,
  token,
  onDismiss,
}: {
  signal: Signal
  token: string
  onDismiss: (id: string) => void
}) {
  const [outreach, setOutreach] = useState<OutreachPayload | null>(null)
  const [generating, setGenerating] = useState(false)

  async function handleGenerateOutreach() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/signals/${signal.id}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        const data = await res.json()
        setOutreach(data)
      } else {
        // Demo fallback
        setOutreach({
          bestChannel: 'LinkedIn',
          whyNow: `${signal.authorName} is in a high-engagement window — they just posted about ${TYPE_META[signal.type].label.toLowerCase()} and are actively checking LinkedIn.`,
          connectionRequest: `Hi ${signal.authorName.split(' ')[0]}, ${signal.outreachHook} Would love to connect.`,
          directMessage: `Hey ${signal.authorName.split(' ')[0]} — ${signal.outreachHook}\n\nWould love to chat for 15 minutes if you're open to it. What does your calendar look like next week?`,
          strategy: 'Lead with a specific, genuine observation before making any ask. Reference their post to show you actually read it.',
        })
      }
    } catch {
      // Demo fallback
      setOutreach({
        bestChannel: 'LinkedIn',
        whyNow: `${signal.authorName} is in a high-engagement window right now.`,
        connectionRequest: `Hi ${signal.authorName.split(' ')[0]}, ${signal.outreachHook} Would love to connect.`,
        directMessage: `Hey ${signal.authorName.split(' ')[0]} — ${signal.outreachHook}\n\nWould love to chat briefly. What does your calendar look like?`,
        strategy: 'Lead with a specific observation before making any ask.',
      })
    }
    setGenerating(false)
  }

  return (
    <div
      className="p-5 transition-all"
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${SIGNAL_BORDER[signal.type] || C.border}`,
        borderRadius: '0 var(--radius-xl) var(--radius-xl) 0',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {/* Row 1: badges + time */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TypeBadge type={signal.type} />
        <TierDot tier={signal.tier} />
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: 'rgba(34,197,94,0.1)', color: C.green, border: '1px solid rgba(34,197,94,0.2)' }}
        >
          {signal.confidence}% match
        </span>
        <span className="ml-auto text-xs" style={{ color: C.muted }}>
          {timeAgo(signal.detectedAt)}
        </span>
      </div>

      {/* Row 2: Author + degree + reactor */}
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold" style={{ color: C.text }}>
          {signal.authorName}
        </span>
        {signal.degree && <DegreeBadge degree={signal.degree} />}
        {signal.reactorName && (
          <span className="text-xs" style={{ color: C.muted }}>
            via {signal.reactorName}
          </span>
        )}
      </div>

      {/* Row 3: Title */}
      <p className="mb-1 text-xs" style={{ color: C.muted }}>
        {signal.authorTitle}
      </p>

      {/* Row 3b: Enrichment data */}
      <EnrichmentInfo signal={signal} />

      {/* Row 4: Reasoning */}
      <p className="mb-3 text-xs italic leading-relaxed" style={{ color: C.textDim }}>
        {signal.reasoning}
      </p>

      {/* Row 5: Outreach hook */}
      <div
        className="mb-3 rounded-xl px-3 py-2.5"
        style={{ background: C.accentGlow, border: '1px solid var(--color-lime-subtle)' }}
      >
        <p className="text-xs leading-relaxed" style={{ color: C.accentSoft }}>
          <span className="mr-1 font-semibold" style={{ color: C.muted }}>💬</span>
          &quot;{signal.outreachHook}&quot;
        </p>
      </div>

      {/* Row 6: Post preview */}
      <p
        className="mb-4 text-xs leading-relaxed"
        style={{
          color: C.muted,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {signal.postPreview}
      </p>

      {/* Row 7: Actions */}
      {!outreach ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGenerateOutreach}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all disabled:opacity-60 hover:opacity-90"
            style={{ background: C.accent, color: '#fff' }}
          >
            {generating ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Outreach →'
            )}
          </button>

          {signal.postUrl && (
            <a
              href={signal.postUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:opacity-80"
              style={{
                background: 'rgba(0,0,0,0.03)',
                color: C.textDim,
                border: `1px solid ${C.border}`,
              }}
            >
              <ExternalLink size={11} />
              View Post ↗
            </a>
          )}

          {signal.authorLinkedInUrl && (
            <a
              href={signal.authorLinkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:opacity-80"
              style={{
                background: 'rgba(0,0,0,0.03)',
                color: C.textDim,
                border: `1px solid ${C.border}`,
              }}
            >
              <ExternalLink size={11} />
              Profile ↗
            </a>
          )}

          <button
            onClick={() => onDismiss(signal.id)}
            className="rounded-xl px-4 py-2 text-xs font-medium transition-all hover:opacity-80"
            style={{ color: C.muted }}
          >
            Dismiss
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {signal.postUrl && (
              <a
                href={signal.postUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:opacity-80"
                style={{
                  background: 'rgba(0,0,0,0.03)',
                  color: C.textDim,
                  border: `1px solid ${C.border}`,
                }}
              >
                <ExternalLink size={11} />
                View Post ↗
              </a>
            )}
            {signal.authorLinkedInUrl && (
              <a
                href={signal.authorLinkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:opacity-80"
                style={{
                  background: 'rgba(0,0,0,0.03)',
                  color: C.textDim,
                  border: `1px solid ${C.border}`,
                }}
              >
                <ExternalLink size={11} />
                Profile ↗
              </a>
            )}
            <button
              onClick={() => onDismiss(signal.id)}
              className="rounded-xl px-4 py-2 text-xs font-medium transition-all hover:opacity-80"
              style={{ color: C.muted }}
            >
              Dismiss
            </button>
          </div>
          <OutreachPanel payload={outreach} onClose={() => setOutreach(null)} />
        </>
      )}
    </div>
  )
}

// ─── Company Hiring Card ──────────────────────────────────────────────────────

function CompanyHiringCard({ company }: { company: HiringCompany }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="p-5 transition-all"
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderLeft: '3px solid var(--color-warning)',
        borderRadius: '0 var(--radius-xl) var(--radius-xl) 0',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {/* Header: company name + stats */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: C.accentGlow, border: '1px solid var(--color-lime-subtle)' }}
          >
            <Building2 size={18} style={{ color: C.accentSoft }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate" style={{ color: C.text }}>
              {company.companyName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-xs" style={{ color: C.textDim }}>
                <Briefcase size={11} />
                {company.roles.length} role{company.roles.length !== 1 ? 's' : ''} detected
              </span>
              <span className="text-xs" style={{ color: C.muted }}>
                {timeAgo(company.latestDetectedAt)}
              </span>
            </div>
          </div>
        </div>
        <span
          className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ background: 'rgba(34,197,94,0.1)', color: C.green, border: '1px solid rgba(34,197,94,0.2)' }}
        >
          {company.signalCount} signal{company.signalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Roles list */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {company.roles.map((role, i) => (
          <span
            key={i}
            className="rounded-lg px-2.5 py-1 text-xs font-medium"
            style={{ background: 'var(--color-surface)', color: C.textDim, border: `1px solid ${C.border}` }}
          >
            {role}
          </span>
        ))}
      </div>

      {/* Source badges */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {company.sources.map(src => {
          const meta = SOURCE_LABELS[src] ?? { label: src, bg: 'var(--border-color-subtle)', color: C.muted }
          return (
            <span
              key={src}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: meta.bg, color: meta.color }}
            >
              {meta.label}
            </span>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/discover?company=${encodeURIComponent(company.companyName)}`}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: C.accent, color: '#fff' }}
        >
          <Users size={12} />
          Find People &rarr;
        </a>
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:opacity-80"
          style={{
            background: expanded ? C.accentGlow : 'rgba(0,0,0,0.03)',
            color: expanded ? C.accentSoft : C.textDim,
            border: `1px solid ${expanded ? 'var(--color-lime-subtle)' : C.border}`,
          }}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          View Signals
        </button>
      </div>

      {/* Expanded: individual signals */}
      {expanded && (
        <div className="mt-4 space-y-2">
          {company.signals.map(sig => (
            <div
              key={sig.id}
              className="rounded-xl p-3"
              style={{ background: C.bg, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold truncate" style={{ color: C.text }}>
                  {sig.title ?? sig.author ?? 'Unknown'}
                </span>
                <span className="flex-shrink-0 text-[10px]" style={{ color: C.muted }}>
                  {timeAgo(sig.detected_at)}
                </span>
              </div>
              {sig.author && sig.title && (
                <p className="text-[11px] mb-1" style={{ color: C.muted }}>
                  by {sig.author}
                </p>
              )}
              {sig.preview && (
                <p
                  className="text-xs leading-relaxed"
                  style={{
                    color: C.muted,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {sig.preview}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: 'rgba(34,197,94,0.1)', color: C.green }}
                >
                  {sig.confidence}% match
                </span>
                {sig.source && SOURCE_LABELS[sig.source] && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: SOURCE_LABELS[sig.source].bg, color: SOURCE_LABELS[sig.source].color }}
                  >
                    {SOURCE_LABELS[sig.source].label}
                  </span>
                )}
                {sig.post_url && sig.post_url !== '#' && (
                  <a
                    href={sig.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-medium transition-opacity hover:opacity-70"
                    style={{ color: C.accentSoft }}
                  >
                    <ExternalLink size={9} />
                    View
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CompaniesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: C.accentGlow, border: '1px solid var(--color-lime-subtle)' }}
      >
        <Building2 size={24} style={{ color: C.accentSoft }} />
      </div>
      <h2 className="mb-2 text-lg font-semibold" style={{ color: C.text }}>
        No hiring companies yet
      </h2>
      <p className="max-w-sm text-sm leading-relaxed" style={{ color: C.muted }}>
        As the extension detects hiring posts, job listings, and feed job widgets, companies will be grouped and shown here.
      </p>
    </div>
  )
}

// ─── Install instructions (no token) ─────────────────────────────────────────

function NoTokenView() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: C.bg }}>
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'var(--color-lime-subtle)', border: '1px solid var(--color-lime-subtle)' }}
      >
        <Zap size={28} style={{ color: C.accent }} />
      </div>

      <h1 className="mb-2 text-2xl font-bold" style={{ color: C.text }}>
        Install the Jobseek extension
      </h1>
      <p className="mb-10 text-center text-sm leading-relaxed" style={{ color: C.muted }}>
        The browser extension monitors your LinkedIn feed and surfaces the best outreach moments automatically.
      </p>

      <div
        className="w-full max-w-md space-y-3 rounded-2xl p-6"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        {[
          { step: '1', title: 'Install the Chrome extension', desc: 'Download from the Chrome Web Store or load unpacked from source.' },
          { step: '2', title: 'Log in to LinkedIn', desc: 'The extension reads your feed — it needs you to be signed in.' },
          { step: '3', title: 'Open your LinkedIn feed', desc: 'Signals are detected as you scroll. The extension scans passively in the background.' },
          { step: '4', title: 'This page populates automatically', desc: 'Your device token is embedded in the extension. Signals appear here within 2 minutes.' },
        ].map(({ step, title, desc }) => (
          <div key={step} className="flex gap-4">
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: C.accentGlow, color: C.accentSoft, border: '1px solid var(--color-lime-subtle)' }}
            >
              {step}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: C.text }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs" style={{ color: C.muted }}>
        Already installed?{' '}
        <a href="https://linkedin.com/feed" target="_blank" rel="noopener noreferrer" style={{ color: C.accentSoft }}>
          Open your LinkedIn feed →
        </a>
      </p>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 text-5xl">📡</div>
      <h2 className="mb-2 text-lg font-semibold" style={{ color: C.text }}>
        No signals yet
      </h2>
      <p className="max-w-sm text-sm leading-relaxed" style={{ color: C.muted }}>
        The extension scans your LinkedIn feed every 2 minutes. Signals appear here automatically.
      </p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function SignalsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlToken = searchParams.get('token')

  const [token, setToken] = useState<string | null>(urlToken)
  const [tokenLoading, setTokenLoading] = useState(!urlToken) // only loading if no URL token
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(false)
  const [lastScan, setLastScan] = useState<Date | null>(null)
  const [filter, setFilter] = useState<'all' | 'tier1' | 'tier2'>('all')
  const [activeTab, setActiveTab] = useState<DashboardTab>('signals')
  const [hiringCompanies, setHiringCompanies] = useState<HiringCompany[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [signalSearch, setSignalSearch] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [signalSortBy, setSignalSortBy] = useState<SignalSortBy>('recent')
  const [companySortBy, setCompanySortBy] = useState<CompanySortBy>('recent')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tokenLinked = useRef(false)

  // Token resolution: URL param → profile lookup → show connect UI
  useEffect(() => {
    if (urlToken) {
      // Token in URL — use it and link to profile (one-time)
      setToken(urlToken)
      setTokenLoading(false)
      if (!tokenLinked.current) {
        tokenLinked.current = true
        fetch('/api/user/link-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: urlToken }),
        }).then(() => {
          // Clean URL after linking (remove ?token= param)
          router.replace('/signals', { scroll: false })
        }).catch(() => {
          // Linking failed (maybe not logged in) — that's fine, URL token still works
        })
      }
    } else {
      // No URL token — try to get from user profile
      fetch('/api/user/link-token')
        .then(res => res.json())
        .then(data => {
          if (data.deviceToken) {
            setToken(data.deviceToken)
          }
        })
        .catch(() => {})
        .finally(() => setTokenLoading(false))
    }
  }, [urlToken, router])

  const fetchSignals = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/signals?token=${encodeURIComponent(token)}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.signals) && data.signals.length > 0) {
          setSignals(data.signals.map(mapSignal))
        } else {
          setSignals([])
        }
      } else {
        setSignals([])
      }
    } catch {
      setSignals([])
    }
    setLastScan(new Date())
  }, [token])

  const fetchCompanies = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/signals/companies?token=${encodeURIComponent(token)}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.companies) && data.companies.length > 0) {
          setHiringCompanies(data.companies)
        } else {
          setHiringCompanies([])
        }
      } else {
        setHiringCompanies([])
      }
    } catch {
      setHiringCompanies([])
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setCompaniesLoading(true)
    fetchSignals().finally(() => setLoading(false))
    fetchCompanies().finally(() => setCompaniesLoading(false))

    intervalRef.current = setInterval(() => {
      fetchSignals()
      fetchCompanies()
    }, 30_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [token, fetchSignals, fetchCompanies])

  function handleDismiss(id: string) {
    setSignals(prev => prev.filter(s => s.id !== id))
  }

  if (tokenLoading) return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: C.bg }}>
      <Loader2 size={24} className="animate-spin" style={{ color: C.accent }} />
    </div>
  )
  if (!token) return <NoTokenView />

  // Signals tab: only show feed posts (degree = 1st/2nd/3rd).
  // degree = 'job' means it came from jobs/recommended pages → Companies Hiring only.
  const FEED_DEGREES = new Set(['1st', '2nd', '3rd', 'first', 'second', 'third'])
  const feedSignals = signals.filter(s => !s.degree || s.degree === 'unknown' || FEED_DEGREES.has(s.degree))

  const searched = searchSignals(feedSignals, signalSearch)
  const sorted = sortSignals(searched, signalSortBy)
  const filtered = sorted.filter(s => {
    if (filter === 'tier1') return s.tier === 1
    if (filter === 'tier2') return s.tier === 2
    return true
  })

  const tier1Count = sorted.filter(s => s.tier === 1).length
  const tier2Count = sorted.filter(s => s.tier === 2).length

  const filteredCompanies = sortCompanies(searchCompanies(hiringCompanies, companySearch), companySortBy)

  const lastScanMins = lastScan ? Math.floor((Date.now() - lastScan.getTime()) / 60000) : null

  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 flex items-center gap-4 px-6 py-4"
        style={{
          background: C.card,
          borderBottom: `1px solid ${C.border}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Left: branding */}
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: C.accentGlow, border: '1px solid var(--color-lime-subtle)' }}
          >
            <Radio size={14} style={{ color: C.accentSoft }} />
          </div>
          <span className="text-sm font-bold" style={{ color: C.text }}>
            Jobseek Signals
          </span>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--color-surface)' }}>
          {([
            { key: 'signals' as DashboardTab, label: 'Signals', icon: <Radio size={12} /> },
            { key: 'companies' as DashboardTab, label: 'Companies Hiring', icon: <Building2 size={12} /> },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: activeTab === key ? C.card : 'transparent',
                color: activeTab === key ? C.text : C.muted,
                border: activeTab === key ? `1px solid ${C.border}` : '1px solid transparent',
              }}
            >
              {icon}
              {label}
              {key === 'companies' && hiringCompanies.length > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                  style={{
                    background: activeTab === key ? 'var(--color-lime-subtle)' : 'var(--border-color-subtle)',
                    color: activeTab === key ? C.accentSoft : C.textDim,
                  }}
                >
                  {hiringCompanies.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Center: stats */}
        <div className="flex flex-1 items-center justify-center">
          {lastScan && (
            <p className="text-xs" style={{ color: C.muted }}>
              {activeTab === 'signals'
                ? `${filtered.length} signal${filtered.length !== 1 ? 's' : ''}${signalSearch ? ` matching "${signalSearch}"` : ''}`
                : `${filteredCompanies.length} compan${filteredCompanies.length !== 1 ? 'ies' : 'y'}${companySearch ? ` matching "${companySearch}"` : ''}`
              }
              {lastScanMins !== null && (
                <span> · last scan {lastScanMins === 0 ? 'just now' : `${lastScanMins}m ago`}</span>
              )}
            </p>
          )}
        </div>

        {/* Right: search + filter + sort controls */}
        {activeTab === 'signals' && (
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
              <input
                type="text"
                placeholder="Search signals..."
                value={signalSearch}
                onChange={e => setSignalSearch(e.target.value)}
                className="rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none placeholder:text-[#4B5563]"
                style={{ background: 'var(--color-surface)', color: C.text, border: `1px solid ${C.border}`, width: 170 }}
              />
            </div>
            {/* Tier filter pills */}
            <div className="flex items-center gap-1">
              {(
                [
                  { key: 'all', label: 'All', count: sorted.length },
                  { key: 'tier1', label: 'T1', count: tier1Count },
                  { key: 'tier2', label: 'T2', count: tier2Count },
                ] as const
              ).map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                  style={{
                    background: filter === key ? C.accentGlow : 'transparent',
                    color: filter === key ? C.accentSoft : C.muted,
                    border: `1px solid ${filter === key ? 'var(--color-lime-subtle)' : C.border}`,
                  }}
                >
                  {label}
                  {count > 0 && (
                    <span
                      className="rounded-full px-1 py-0.5 text-[9px] font-bold leading-none"
                      style={{
                        background: filter === key ? 'var(--color-lime-subtle)' : 'var(--border-color-subtle)',
                        color: filter === key ? C.accentSoft : C.textDim,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* Sort pills */}
            <div className="flex items-center gap-1">
              <ArrowUpDown size={10} style={{ color: C.muted }} />
              {(
                [
                  { key: 'recent', label: 'Recent' },
                  { key: 'confidence', label: 'Confidence' },
                  { key: 'tier', label: 'Tier' },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSignalSortBy(key)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                  style={{
                    background: signalSortBy === key ? C.accentGlow : 'transparent',
                    color: signalSortBy === key ? C.accentSoft : C.muted,
                    border: `1px solid ${signalSortBy === key ? 'var(--color-lime-subtle)' : 'transparent'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'companies' && (
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
              <input
                type="text"
                placeholder="Search companies..."
                value={companySearch}
                onChange={e => setCompanySearch(e.target.value)}
                className="rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none placeholder:text-[#4B5563]"
                style={{ background: 'var(--color-surface)', color: C.text, border: `1px solid ${C.border}`, width: 170 }}
              />
            </div>
            {/* Sort pills */}
            <div className="flex items-center gap-1">
              <ArrowUpDown size={10} style={{ color: C.muted }} />
              {(
                [
                  { key: 'recent', label: 'Recent' },
                  { key: 'signals', label: 'Most Signals' },
                  { key: 'confidence', label: 'Confidence' },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setCompanySortBy(key)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                  style={{
                    background: companySortBy === key ? C.accentGlow : 'transparent',
                    color: companySortBy === key ? C.accentSoft : C.muted,
                    border: `1px solid ${companySortBy === key ? 'var(--color-lime-subtle)' : 'transparent'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        {activeTab === 'signals' && (
          <>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <div>
                <ScanSummaryCard token={token} />
                <div className="space-y-4">
                  {filtered.map(signal => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      token={token}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'companies' && (
          <>
            {companiesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : filteredCompanies.length === 0 ? (
              companySearch ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Search size={24} style={{ color: C.muted }} className="mb-3" />
                  <p className="text-sm" style={{ color: C.muted }}>No companies match &ldquo;{companySearch}&rdquo;</p>
                </div>
              ) : (
                <CompaniesEmptyState />
              )
            ) : (
              <div className="space-y-4">
                {filteredCompanies.map(company => (
                  <CompanyHiringCard key={company.companyName} company={company} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default function SignalsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-lime)' }} />
      </div>
    }>
      <SignalsPageContent />
    </Suspense>
  )
}
