'use client'

import { Bookmark, BookmarkCheck, ArrowRight } from 'lucide-react'
import type { SearchResult } from '@/types'

interface CompanyCardProps {
  result: SearchResult
  active: boolean
  onSelect: () => void
  onSave: () => void
  onFindPeople?: () => void
  saved: boolean
}

function FundingBadge({ stage }: { stage: string | null }) {
  if (!stage) return null
  const colors: Record<string, { bg: string; color: string }> = {
    'Pre-Seed': { bg: 'rgba(107,114,128,0.15)', color: 'var(--color-text-tertiary)' },
    'Seed': { bg: 'rgba(34,197,94,0.15)', color: 'var(--color-success)' },
    'Series A': { bg: 'var(--color-lime-subtle)', color: 'var(--color-lime-text)' },
    'Series B': { bg: 'rgba(14,165,233,0.15)', color: '#38BDF8' },
    'Series C': { bg: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)' },
    'Series D+': { bg: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)' },
    'Growth': { bg: 'rgba(239,68,68,0.15)', color: 'var(--color-error)' },
    'Public': { bg: 'rgba(239,68,68,0.2)', color: 'var(--color-error)' },
  }
  const c = colors[stage] ?? { bg: 'rgba(107,114,128,0.15)', color: 'var(--color-text-tertiary)' }
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ background: c.bg, color: c.color }}
    >
      {stage}
    </span>
  )
}

function RaisedBadge({ amount }: { amount: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: 'rgba(107,114,128,0.1)', color: 'var(--color-text-secondary)' }}
    >
      Raised {amount}
    </span>
  )
}

function InvestorPills({ investors }: { investors: string[] }) {
  const display = investors.slice(0, 3)
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {display.map(name => (
        <span
          key={name}
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: 'rgba(107,114,128,0.08)', color: 'var(--color-text-tertiary)' }}
        >
          {name}
        </span>
      ))}
    </div>
  )
}

function RelevanceBar({ score }: { score: number }) {
  const label = score > 75 ? 'Strong fit' : score > 50 ? 'Good fit' : 'Possible fit'
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: '#E8E8E3' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${score}%`,
            background: score > 75 ? 'var(--color-success)' : score > 50 ? 'var(--color-lime)' : 'var(--color-warning)',
          }}
        />
      </div>
      <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>
        {score} · {label}
      </span>
    </div>
  )
}

function truncateToSentence(text: string, maxLen: number): string {
  const dotIdx = text.indexOf('.')
  const firstSentence = dotIdx !== -1 && dotIdx < maxLen ? text.slice(0, dotIdx + 1) : text
  if (firstSentence.length <= maxLen) return firstSentence
  return firstSentence.slice(0, maxLen).trimEnd() + '...'
}

export function CompanyCard({ result, active, onSelect, onSave, onFindPeople, saved }: CompanyCardProps) {
  const { company, relevance_score, snippet } = result
  const domain = company.domain ?? ''
  const logoUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null
  const description = snippet ? truncateToSentence(snippet, 100) : null

  return (
    <div
      onClick={onSelect}
      className="group cursor-pointer rounded-2xl p-5 transition-all"
      style={{
        background: active ? 'var(--color-lime-subtle)' : 'var(--color-surface)',
        border: `1px solid ${active ? 'var(--color-lime-border)' : '#E8E8E3'}`,
        boxShadow: active ? '0 0 0 1px var(--color-lime-border)' : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Logo */}
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{ background: 'var(--color-surface)', border: '1px solid #E8E8E3' }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={company.name}
              className="h-6 w-6 object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <span className="text-sm font-bold" style={{ color: 'var(--color-lime)' }}>
              {company.name.charAt(0)}
            </span>
          )}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {company.name}
            </h3>
            <FundingBadge stage={company.funding_stage} />
            {company.total_funding && <RaisedBadge amount={company.total_funding} />}
          </div>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed line-clamp-1" style={{ color: 'var(--color-text-tertiary)' }}>
              {description}
            </p>
          )}
          {company.investors && company.investors.length > 0 && (
            <InvestorPills investors={company.investors} />
          )}
        </div>

        {/* Bookmark (save) button */}
        <button
          onClick={e => { e.stopPropagation(); onSave() }}
          className="flex-shrink-0 rounded-lg p-1.5 transition-all hover:bg-black/5"
          title={saved ? 'Saved to pipeline' : 'Save to pipeline'}
        >
          {saved ? (
            <BookmarkCheck size={16} style={{ color: 'var(--color-success)' }} />
          ) : (
            <Bookmark size={16} style={{ color: 'var(--color-text-tertiary)' }} className="group-hover:text-[#6B7280]" />
          )}
        </button>
      </div>

      <RelevanceBar score={relevance_score} />

      {/* Find People CTA */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={e => { e.stopPropagation(); onFindPeople?.() }}
          className="flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: 'var(--color-lime)', color: '#1A2E05' }}
        >
          Find People
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}
