'use client'

import { useState } from 'react'
import { ExternalLink, Mail, Zap, Search, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { Person } from '@/types'

interface PersonCardProps {
  person: Person
  onGenerateOutreach: (person: Person) => void
  loading: boolean
  /** Called when user clicks "Find Email" — caller handles the async lookup */
  onFindEmail?: (person: Person) => void
  /** The revealed email address (set by parent after lookup) */
  revealedEmail?: string
  /** Whether email lookup is in progress */
  emailLoading?: boolean
}

function PriorityBar({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--color-success)' : score >= 40 ? 'var(--color-lime)' : 'var(--color-warning)'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 rounded-full overflow-hidden" style={{ background: '#E8E8E3' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-medium" style={{ color }}>
        {score >= 70 ? 'High priority' : score >= 40 ? 'Good match' : 'Consider'}
      </span>
    </div>
  )
}

export function PersonCard({
  person,
  onGenerateOutreach,
  loading,
  onFindEmail,
  revealedEmail,
  emailLoading = false,
}: PersonCardProps) {
  const [copied, setCopied] = useState(false)

  // Use revealed email (from Find Email) or person's pre-existing email
  const displayEmail = revealedEmail ?? person.email ?? null

  async function copyEmail() {
    if (!displayEmail) return
    await navigator.clipboard.writeText(displayEmail)
    setCopied(true)
    toast.success('Email copied')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{ background: 'var(--color-surface)', border: '1px solid #E8E8E3' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {person.name}
            </span>
            {person.seniority && person.seniority !== 'Unknown' && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'var(--color-lime-subtle)', color: 'var(--color-lime-text)' }}
              >
                {person.seniority}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {person.title ?? 'Unknown role'}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <PriorityBar score={person.outreach_priority_score} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex gap-1">
            {person.linkedin_url && (
              <a
                href={person.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/5"
                title="View LinkedIn"
              >
                <ExternalLink size={12} style={{ color: 'var(--color-text-tertiary)' }} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Email reveal area */}
      {displayEmail ? (
        // Email found — show as a badge with copy button
        <div
          className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          <Mail size={12} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
          <span className="flex-1 truncate text-xs font-medium" style={{ color: 'var(--color-success)' }}>
            {displayEmail}
          </span>
          <button
            onClick={copyEmail}
            className="flex-shrink-0 rounded p-0.5 transition-colors hover:bg-white/5"
            title="Copy email"
          >
            {copied
              ? <Check size={11} style={{ color: 'var(--color-success)' }} />
              : <Copy size={11} style={{ color: 'var(--color-text-tertiary)' }} />
            }
          </button>
        </div>
      ) : onFindEmail ? (
        // Email not found — show "Find Email" button
        <button
          onClick={() => onFindEmail(person)}
          disabled={emailLoading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all disabled:opacity-60"
          style={{
            background: emailLoading ? 'rgba(34,197,94,0.05)' : 'transparent',
            color: emailLoading ? 'var(--color-text-tertiary)' : 'var(--color-text-tertiary)',
            border: `1px dashed ${emailLoading ? '#D4D4CC' : '#E8E8E3'}`,
          }}
        >
          {emailLoading ? (
            <>
              <div
                className="h-3 w-3 animate-spin rounded-full"
                style={{ border: '1.5px solid #E8E8E3', borderTopColor: 'var(--color-success)' }}
              />
              <span style={{ color: 'var(--color-text-tertiary)' }}>Finding email…</span>
            </>
          ) : (
            <>
              <Search size={11} style={{ color: 'var(--color-text-tertiary)' }} />
              Find Email
            </>
          )}
        </button>
      ) : null}

      {/* Generate outreach */}
      <button
        onClick={() => onGenerateOutreach(person)}
        disabled={loading}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all disabled:opacity-50"
        style={{
          background: 'var(--color-lime-subtle)',
          color: 'var(--color-lime-text)',
          border: '1px solid var(--color-lime-border)',
        }}
      >
        <Zap size={12} />
        {loading ? 'Generating…' : 'Generate Outreach'}
      </button>
    </div>
  )
}
