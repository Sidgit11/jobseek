'use client'

import { useState } from 'react'
import { Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { CompanyCard } from '@/components/discovery/CompanyCard'
import { CompanyPanel } from '@/components/intelligence/CompanyPanel'
import { DEMO_RESULTS, DEMO_PEOPLE, DEMO_OUTREACH, DEMO_NEWS, DEMO_EMAILS } from '@/lib/demo/data'
import type { SearchResult } from '@/types'

const SUGGESTED_QUERIES = [
  'Series B AI startups hiring PMs in San Francisco',
  'YC-backed developer tools with recent funding',
  'Enterprise AI companies Series C+',
  'Voice AI startups early stage',
]

export default function DemoDiscoverPage() {
  const [query, setQuery] = useState('Series B AI startups hiring product managers in SF')
  const [results, setResults] = useState<SearchResult[]>(DEMO_RESULTS)
  const [hasSearched, setHasSearched] = useState(true)
  const [searching, setSearching] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [savedCompanies, setSavedCompanies] = useState<Set<string>>(new Set())

  function handleSearch(q: string = query) {
    if (!q.trim()) return
    setSearching(true)
    setHasSearched(true)
    setSelectedResult(null)
    // Simulate brief search animation, then show demo results
    setTimeout(() => {
      setResults(DEMO_RESULTS)
      setSearching(false)
    }, 900)
  }

  function handleSuggestedQuery(q: string) {
    setQuery(q)
    handleSearch(q)
  }

  function handleSave(companyId: string) {
    setSavedCompanies(prev => new Set([...prev, companyId]))
    toast.success('Saved to pipeline ✓')
  }

  const selectedCompanyId = selectedResult?.company.id

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
                <div className="h-[18px] w-[18px] animate-spin rounded-full" style={{ border: '2px solid #E8E8E3', borderTopColor: 'var(--color-lime)' }} />
              ) : (
                <Search size={18} style={{ color: 'var(--color-text-tertiary)' }} />
              )}
            </div>
            <input
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
                  style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid #E8E8E3' }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {searching ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-28 animate-pulse rounded-2xl" style={{ background: 'var(--color-surface)' }} />
              ))}
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {results.length} companies found · ranked by fit
                </p>
                <span
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ background: 'var(--color-lime-subtle)', border: '1px solid var(--color-lime-border)', color: 'var(--color-lime-text)' }}
                >
                  ✦ Demo data
                </span>
              </div>
              <div className="space-y-3">
                {results.map(result => (
                  <CompanyCard
                    key={result.company.id}
                    result={result}
                    active={selectedResult?.company.id === result.company.id}
                    onSelect={() => setSelectedResult(result)}
                    onSave={() => handleSave(result.company.id)}
                    saved={savedCompanies.has(result.company.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Company Intelligence Panel (with demo overrides) */}
      {selectedResult && selectedCompanyId && (
        <div className="flex-1 overflow-hidden">
          <CompanyPanel
            result={selectedResult}
            onClose={() => setSelectedResult(null)}
            onSave={handleSave}
            saved={savedCompanies.has(selectedCompanyId)}
            overrideIntel={{
              company: selectedResult.company,
              news: DEMO_NEWS[selectedCompanyId] ?? [],
            }}
            overridePeople={DEMO_PEOPLE[selectedCompanyId] ?? []}
            overrideOutreach={DEMO_OUTREACH}
            overrideEmails={DEMO_EMAILS}
          />
        </div>
      )}
    </div>
  )
}
