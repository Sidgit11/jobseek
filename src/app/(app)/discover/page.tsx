'use client'

import { useState, useRef, useEffect, Suspense, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CompanyCard } from '@/components/discovery/CompanyCard'
import { CompanyPanel } from '@/components/intelligence/CompanyPanel'
import { CompanyCardSkeleton } from '@/components/shared/LoadingSkeleton'
import { SearchLoader } from '@/components/discovery/SearchLoader'
import type { SearchResult } from '@/types'

// ── Session storage persistence ─────────────────────────────────────────────
const STORAGE_KEY = 'jobseek_discover_state'

interface PersistedState {
  query: string
  results: SearchResult[]
  hasSearched: boolean
  demoMode: boolean
  sortMode: string
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function savePersistedState(state: PersistedState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

const SUGGESTED_QUERIES = [
  'Series B AI startups hiring PMs in NYC',
  'YC companies in fintech, fast growing',
  'Series A SaaS tools hiring engineers',
  'AI infra startups with recent funding',
  'Consumer apps with strong growth signals',
]

type SortMode = 'fit' | 'relevance' | 'funding'

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'fit', label: 'Ranked by fit' },
  { key: 'relevance', label: 'By relevance' },
  { key: 'funding', label: 'By funding' },
]

function parseFundingToNumber(funding: string | null): number {
  if (!funding) return 0
  const match = funding.match(/([\d.]+)\s*(B|M|K)?/i)
  if (!match) return 0
  const value = parseFloat(match[1])
  const unit = (match[2] || '').toUpperCase()
  if (unit === 'B') return value * 1_000_000_000
  if (unit === 'M') return value * 1_000_000
  if (unit === 'K') return value * 1_000
  return value
}

function DiscoverPageInner() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('company') || searchParams.get('query') || ''

  // Restore from sessionStorage on mount
  const persisted = useRef(loadPersistedState())
  const [query, setQuery] = useState(initialQuery || persisted.current?.query || '')
  const [results, setResults] = useState<SearchResult[]>(persisted.current?.results ?? [])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(persisted.current?.hasSearched ?? false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [savedCompanies, setSavedCompanies] = useState<Set<string>>(new Set())
  const [demoMode, setDemoMode] = useState(persisted.current?.demoMode ?? false)
  const [sortMode, setSortMode] = useState<SortMode>((persisted.current?.sortMode as SortMode) ?? 'fit')
  const [findPeopleOnOpen, setFindPeopleOnOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasAutoSearched = useRef(false)

  // Persist state to sessionStorage whenever results/query change
  const persistState = useCallback(() => {
    savePersistedState({ query, results, hasSearched, demoMode, sortMode })
  }, [query, results, hasSearched, demoMode, sortMode])

  useEffect(() => {
    persistState()
  }, [persistState])

  // Auto-search when arriving with URL params (?company=Microsoft or ?query=...)
  useEffect(() => {
    if (hasAutoSearched.current) return
    if (initialQuery) {
      hasAutoSearched.current = true
      handleSearch(initialQuery)
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortedResults = useMemo(() => {
    const sorted = [...results]
    switch (sortMode) {
      case 'fit':
        sorted.sort((a, b) => b.fit_score - a.fit_score)
        break
      case 'relevance':
        sorted.sort((a, b) => b.relevance_score - a.relevance_score)
        break
      case 'funding':
        sorted.sort((a, b) => parseFundingToNumber(b.company.total_funding) - parseFundingToNumber(a.company.total_funding))
        break
    }
    return sorted
  }, [results, sortMode])

  async function handleSearch(q: string = query) {
    if (!q.trim()) return
    setSearching(true)
    setHasSearched(true)
    setSelectedResult(null)
    setDemoMode(false)

    const res = await fetch('/api/companies/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Search failed')
      setSearching(false)
      return
    }

    setResults(data.results ?? [])
    setDemoMode(data.demo_mode === true)
    setSearching(false)
  }

  async function handleSave(companyId: string) {
    const res = await fetch('/api/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, status: 'saved' }),
    })

    if (res.ok) {
      setSavedCompanies(prev => new Set([...prev, companyId]))
      toast.success('Saved to pipeline')
    } else {
      toast.error('Failed to save')
    }
  }

  function handleSuggestedQuery(q: string) {
    setQuery(q)
    // Just prefill — let the user edit and submit manually
    inputRef.current?.focus()
  }

  function handleFindPeople(result: SearchResult) {
    setSelectedResult(result)
    setFindPeopleOnOpen(true)
  }

  const activeSortLabel = SORT_OPTIONS.find(o => o.key === sortMode)!.label.toLowerCase()

  return (
    <div className="flex h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Center: Search + Results */}
      <div
        className="flex flex-col"
        style={{
          width: selectedResult ? '420px' : '100%',
          minWidth: selectedResult ? '380px' : undefined,
          borderRight: selectedResult ? '1px solid #E8E8E3' : undefined,
          transition: 'width 0.2s ease',
          flexShrink: 0,
        }}
      >
        {/* Search bar */}
        <div className="p-6 pb-4">
          <div
            className="relative flex items-center rounded-2xl"
            style={{ background: 'var(--color-surface)', border: '1px solid #E8E8E3' }}
          >
            <div className="pl-4">
              {searching ? (
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-lime)' }} />
              ) : (
                <Search size={18} style={{ color: 'var(--color-text-tertiary)' }} />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder='Try: "Series B AI startups hiring PMs"'
              className="flex-1 bg-transparent px-3 py-4 text-sm outline-none placeholder:text-[#4B5563]"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <button
              onClick={() => handleSearch()}
              disabled={!query.trim() || searching}
              className="mr-2 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-30"
              style={{ background: 'var(--color-lime)', color: '#1A2E05' }}
            >
              <Sparkles size={14} />
              Search
            </button>
          </div>

          {/* Suggested queries */}
          {!hasSearched && (
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTED_QUERIES.map(q => (
                <button
                  key={q}
                  onClick={() => handleSuggestedQuery(q)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid #E8E8E3',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: 'var(--color-lime-subtle)', border: '1px solid var(--color-lime-border)' }}
              >
                <Sparkles size={28} style={{ color: 'var(--color-lime)' }} />
              </div>
              <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Find your next company
              </h2>
              <p className="max-w-sm text-sm leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                Describe the kind of company you&apos;re excited about — stage, industry, location, vibe. Claude will find them.
              </p>
            </div>
          ) : searching ? (
            <div className="space-y-3">
              <SearchLoader active={searching} />
              {[1, 2].map(i => <CompanyCardSkeleton key={i} />)}
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>No results found</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Try different keywords or broaden your search
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {sortedResults.length} companies found · {activeSortLabel}
                </p>
                {demoMode && (
                  <a
                    href="https://exa.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#FCD34D' }}
                    title="Add an Exa API key for real-time company search"
                  >
                    ✦ AI demo · Add Exa for live data →
                  </a>
                )}
              </div>

              {/* Sort controls */}
              <div className="mb-3 flex gap-1.5">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSortMode(opt.key)}
                    className="rounded-full px-3 py-1 text-[11px] font-medium transition-all"
                    style={{
                      background: sortMode === opt.key ? 'var(--color-text-primary)' : 'var(--color-surface)',
                      color: sortMode === opt.key ? 'var(--color-surface)' : 'var(--color-text-secondary)',
                      border: `1px solid ${sortMode === opt.key ? 'var(--color-text-primary)' : '#E8E8E3'}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {sortedResults.map(result => (
                  <CompanyCard
                    key={result.company.id}
                    result={result}
                    active={selectedResult?.company.id === result.company.id}
                    onSelect={() => setSelectedResult(result)}
                    onSave={() => handleSave(result.company.id)}
                    onFindPeople={() => handleFindPeople(result)}
                    saved={savedCompanies.has(result.company.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Company Intelligence Panel */}
      {selectedResult && (
        <div className="flex-1 overflow-hidden">
          <CompanyPanel
            result={selectedResult}
            onClose={() => { setSelectedResult(null); setFindPeopleOnOpen(false) }}
            onSave={handleSave}
            saved={savedCompanies.has(selectedResult.company.id)}
            autoLoadPeople={findPeopleOnOpen}
          />
        </div>
      )}
    </div>
  )
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center" style={{ background: 'var(--color-bg)' }}><Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-lime)' }} /></div>}>
      <DiscoverPageInner />
    </Suspense>
  )
}
