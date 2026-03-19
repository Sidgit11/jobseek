'use client'

import { Bookmark, BookmarkCheck } from 'lucide-react'
import type { SearchResult } from '@/types'

interface CompanyCardProps {
  result: SearchResult
  active: boolean
  onSelect: () => void
  onSave: () => void
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

function RelevanceBar({ score }: { score: number }) {
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
      <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
        {score > 75 ? 'Strong fit' : score > 50 ? 'Good fit' : 'Possible fit'}
      </span>
    </div>
  )
}

export function CompanyCard({ result, active, onSelect, onSave, saved }: CompanyCardProps) {
  const { company, relevance_score, snippet } = result
  const domain = company.domain ?? ''
  const logoUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null

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
          </div>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            {company.headcount && (
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                ~{company.headcount.toLocaleString()} people
              </span>
            )}
            {company.total_funding && (
              <>
                <span style={{ color: '#E8E8E3' }}>·</span>
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {company.total_funding} raised
                </span>
              </>
            )}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={e => { e.stopPropagation(); onSave() }}
          className="flex-shrink-0 rounded-lg p-1.5 transition-all hover:bg-white/5"
          title={saved ? 'Saved to pipeline' : 'Save to pipeline'}
        >
          {saved ? (
            <BookmarkCheck size={16} style={{ color: 'var(--color-success)' }} />
          ) : (
            <Bookmark size={16} style={{ color: 'var(--color-text-tertiary)' }} className="group-hover:text-[#6B7280]" />
          )}
        </button>
      </div>

      {/* Snippet */}
      {snippet && (
        <p
          className="mt-2.5 text-xs leading-relaxed line-clamp-2"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {snippet}
        </p>
      )}

      <RelevanceBar score={relevance_score} />
    </div>
  )
}
