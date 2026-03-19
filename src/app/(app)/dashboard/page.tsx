'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Radio, Search, Kanban, Building2, Zap, TrendingUp, Briefcase, ArrowRight, BarChart3 } from 'lucide-react'

const C = {
  bg: 'var(--color-bg)',
  card: 'var(--color-surface)',
  border: '#E8E8E3',
  accent: 'var(--color-lime)',
  accentGlow: 'var(--color-lime-subtle)',
  accentSoft: 'var(--color-lime-text)',
  green: 'var(--color-success)',
  amber: 'var(--color-warning)',
  muted: 'var(--color-text-tertiary)',
  text: 'var(--color-text-primary)',
  textDim: 'var(--color-text-secondary)',
}

interface DashboardStats {
  signalCount: number
  companyCount: number
  recentSignals: Array<{
    id: string
    type: string
    author: string
    title: string
    reasoning: string
    detected_at: string
    source: string
  }>
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface ScanMetric {
  id: string
  session_id: string
  source: string
  posts_extracted: number
  posts_after_prefilter: number
  posts_after_dedup: number
  posts_sent_to_gemini: number
  posts_approved: number
  posts_rejected: number
  job_posts_direct: number
  rejection_samples: Array<{ author: string; bodyPreview: string }>
  approval_samples: Array<{ author: string; type: string; company: string; confidence: number }>
  created_at: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [deviceToken, setDeviceToken] = useState<string | null>(null)
  const [scanMetrics, setScanMetrics] = useState<ScanMetric[]>([])
  const [metricsLoading, setMetricsLoading] = useState(true)

  useEffect(() => {
    // Get linked device token
    fetch('/api/user/link-token')
      .then(res => res.json())
      .then(data => {
        if (data.deviceToken) {
          setDeviceToken(data.deviceToken)
          // Fetch stats using the token
          return Promise.all([
            fetch(`/api/signals?token=${encodeURIComponent(data.deviceToken)}`).then(r => r.json()),
            fetch(`/api/signals/companies?token=${encodeURIComponent(data.deviceToken)}`).then(r => r.json()),
          ])
        }
        return null
      })
      .then(results => {
        if (results) {
          const [signalData, companyData] = results
          const signals = Array.isArray(signalData.signals) ? signalData.signals : []
          const companies = Array.isArray(companyData.companies) ? companyData.companies : []
          setStats({
            signalCount: signals.length,
            companyCount: companies.length,
            recentSignals: signals.slice(0, 5),
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Fetch scan metrics
    fetch('/api/user/link-token')
      .then(res => res.json())
      .then(data => {
        if (data.deviceToken) {
          return fetch(`/api/signals/metrics?token=${encodeURIComponent(data.deviceToken)}&limit=10`).then(r => r.json())
        }
        return null
      })
      .then(data => {
        if (data?.metrics) setScanMetrics(data.metrics)
      })
      .catch(() => {})
      .finally(() => setMetricsLoading(false))
  }, [])

  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>
            Welcome back
          </h1>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>
            Your career outbound command center
          </p>
        </div>

        {/* Stats cards */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div
            className="rounded-2xl p-5"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: C.accentGlow, border: '1px solid var(--color-lime-subtle)' }}
              >
                <Radio size={18} style={{ color: C.accentSoft }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: C.text }}>
                  {loading ? '—' : stats?.signalCount ?? 0}
                </p>
                <p className="text-xs" style={{ color: C.muted }}>Signals Detected</p>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <Building2 size={18} style={{ color: C.green }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: C.text }}>
                  {loading ? '—' : stats?.companyCount ?? 0}
                </p>
                <p className="text-xs" style={{ color: C.muted }}>Companies Hiring</p>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <TrendingUp size={18} style={{ color: C.amber }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: C.text }}>
                  {loading ? '—' : (deviceToken ? 'Active' : 'Setup')}
                </p>
                <p className="text-xs" style={{ color: C.muted }}>
                  {deviceToken ? 'Extension Connected' : 'Connect Extension'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          {[
            { href: '/discover', icon: Search, label: 'Search Companies', desc: 'Find companies that match your profile', color: C.accentSoft },
            { href: '/signals', icon: Briefcase, label: 'View Signals', desc: 'Browse detected hiring signals', color: C.green },
            { href: '/pipeline', icon: Kanban, label: 'Manage Pipeline', desc: 'Track your outreach progress', color: C.amber },
          ].map(({ href, icon: Icon, label, desc, color }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl p-5 transition-all hover:scale-[1.02]"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <Icon size={20} style={{ color }} className="mb-3" />
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: C.text }}>
                {label}
                <ArrowRight size={12} className="opacity-0 transition-opacity group-hover:opacity-100" style={{ color }} />
              </h3>
              <p className="mt-1 text-xs" style={{ color: C.muted }}>{desc}</p>
            </Link>
          ))}
        </div>

        {/* Recent activity */}
        <div
          className="rounded-2xl p-5"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: C.text }}>Recent Activity</h2>
            <Link
              href="/signals"
              className="text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: C.accentSoft }}
            >
              View all &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />
              ))}
            </div>
          ) : !stats?.recentSignals.length ? (
            <div className="py-8 text-center">
              <Zap size={20} style={{ color: C.muted }} className="mx-auto mb-2" />
              <p className="text-xs" style={{ color: C.muted }}>
                {deviceToken
                  ? 'No signals yet — the extension scans your LinkedIn feed automatically'
                  : 'Connect the Chrome extension to start detecting signals'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentSignals.map(signal => (
                <div
                  key={signal.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--color-surface)' }}
                >
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: signal.type === 'HIRING_POST' ? 'rgba(34,197,94,0.1)' : C.accentGlow,
                      border: `1px solid ${signal.type === 'HIRING_POST' ? 'rgba(34,197,94,0.2)' : 'var(--color-lime-subtle)'}`,
                    }}
                  >
                    {signal.type === 'HIRING_POST' ? (
                      <Briefcase size={12} style={{ color: C.green }} />
                    ) : (
                      <Radio size={12} style={{ color: C.accentSoft }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium" style={{ color: C.text }}>
                      {signal.author || signal.title}
                    </p>
                    <p className="truncate text-[10px]" style={{ color: C.muted }}>
                      {signal.reasoning?.slice(0, 80)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-[10px]" style={{ color: C.muted }}>
                    {timeAgo(signal.detected_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scan Pipeline Metrics */}
        <div className="mt-6 rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} style={{ color: C.accentSoft }} />
              <h2 className="text-sm font-semibold" style={{ color: C.text }}>Scan Pipeline Metrics</h2>
            </div>
            <span className="text-[10px]" style={{ color: C.muted }}>Last {scanMetrics.length} scans</span>
          </div>

          {metricsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--color-surface)' }} />)}
            </div>
          ) : scanMetrics.length === 0 ? (
            <p className="py-4 text-center text-xs" style={{ color: C.muted }}>
              No scan data yet — metrics will appear after the extension runs a scan
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                <thead>
                  <tr style={{ color: C.muted }}>
                    <th className="text-left font-semibold px-2 py-1">Session</th>
                    <th className="text-left font-semibold px-2 py-1">Source</th>
                    <th className="text-right font-semibold px-2 py-1">Extracted</th>
                    <th className="text-right font-semibold px-2 py-1">Prefiltered</th>
                    <th className="text-right font-semibold px-2 py-1">Deduped</th>
                    <th className="text-right font-semibold px-2 py-1">To Gemini</th>
                    <th className="text-right font-semibold px-2 py-1">Approved</th>
                    <th className="text-right font-semibold px-2 py-1">Rejected</th>
                    <th className="text-right font-semibold px-2 py-1">Jobs (direct)</th>
                    <th className="text-left font-semibold px-2 py-1">Top Rejections</th>
                  </tr>
                </thead>
                <tbody>
                  {scanMetrics.map(m => (
                    <tr key={m.id} className="rounded-lg" style={{ background: 'var(--color-surface)' }}>
                      <td className="px-2 py-2 rounded-l-lg" style={{ color: C.text }}>
                        {new Date(m.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-2 py-2">
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium" style={{
                          background: m.source === 'FEED' ? C.accentGlow : 'rgba(34,197,94,0.1)',
                          color: m.source === 'FEED' ? C.accentSoft : C.green,
                        }}>
                          {m.source}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right font-mono" style={{ color: C.text }}>{m.posts_extracted}</td>
                      <td className="px-2 py-2 text-right font-mono" style={{ color: m.posts_after_prefilter < m.posts_extracted ? C.amber : C.text }}>
                        {m.posts_after_prefilter}
                        {m.posts_extracted > 0 && <span style={{ color: C.muted }}> ({Math.round(m.posts_after_prefilter / m.posts_extracted * 100)}%)</span>}
                      </td>
                      <td className="px-2 py-2 text-right font-mono" style={{ color: C.text }}>{m.posts_after_dedup}</td>
                      <td className="px-2 py-2 text-right font-mono" style={{ color: C.text }}>{m.posts_sent_to_gemini}</td>
                      <td className="px-2 py-2 text-right font-mono font-semibold" style={{ color: C.green }}>{m.posts_approved}</td>
                      <td className="px-2 py-2 text-right font-mono" style={{ color: m.posts_rejected > 0 ? C.amber : C.muted }}>{m.posts_rejected}</td>
                      <td className="px-2 py-2 text-right font-mono" style={{ color: (m.job_posts_direct || 0) > 0 ? '#3B82F6' : C.muted }}>{m.job_posts_direct || 0}</td>
                      <td className="px-2 py-2 rounded-r-lg max-w-[200px]" style={{ color: C.muted }}>
                        {m.rejection_samples?.slice(0, 3).map((r, i) => (
                          <span key={i} className="block truncate text-[10px]">{r.author}</span>
                        )) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
