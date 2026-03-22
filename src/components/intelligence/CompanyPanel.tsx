'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ExternalLink, Users, TrendingUp, Bookmark, BookmarkCheck, ChevronDown, AlertTriangle, CheckCircle, Zap, Target, MessageSquareQuote, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { PersonCard } from './PersonCard'
import { OutreachGenerator } from '@/components/outreach/OutreachGenerator'
import { PanelSkeleton } from '@/components/shared/LoadingSkeleton'
import type { Company, Person, NewsItem, SearchResult, TargetingBrief } from '@/types'

interface CompanyPanelProps {
  result: SearchResult
  onClose: () => void
  onSave: (companyId: string) => void
  saved: boolean
  /** Demo mode: skip API fetch and use pre-baked data */
  overrideIntel?: { company: Company; news: NewsItem[] }
  overridePeople?: Person[]
  overrideOutreach?: Record<string, { linkedin: string; email_subject: string; email_body: string }>
  /** Demo mode: personId → email revealed on "Find Email" click */
  overrideEmails?: Record<string, string>
  /** Auto-trigger people loading when panel opens */
  autoLoadPeople?: boolean
  /** Callback for parent to trigger people loading */
  onFindPeople?: () => void
}

interface Intelligence {
  company: Company
  news: NewsItem[]
}

const fadeInUpKeyframes = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`

function PanelOpeningLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(107,114,128,0.04)', border: '1px solid #E8E8E3' }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <MessageSquareQuote size={13} style={{ color: 'var(--color-text-tertiary)' }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Opening Line</span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all hover:bg-black/5"
          style={{ color: copied ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-sm leading-relaxed italic" style={{ color: 'var(--color-text-secondary)' }}>
        &ldquo;{text}&rdquo;
      </p>
    </div>
  )
}

export function CompanyPanel({ result, onClose, onSave, saved, overrideIntel, overridePeople, overrideOutreach, overrideEmails, autoLoadPeople, onFindPeople }: CompanyPanelProps) {
  const [intel, setIntel] = useState<Intelligence | null>(overrideIntel ?? null)
  const [loading, setLoading] = useState(!overrideIntel)
  const [people, setPeople] = useState<Person[]>([])
  const [peopleLoading, setPeopleLoading] = useState(false)
  const [showPeople, setShowPeople] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [outreachLoading, setOutreachLoading] = useState<string | null>(null)
  // Email reveal state: personId → revealed email string
  const [foundEmails, setFoundEmails] = useState<Record<string, string>>({})
  const [emailLoadingFor, setEmailLoadingFor] = useState<string | null>(null)
  const [brief, setBrief] = useState<TargetingBrief | null>(result.brief ?? null)
  const [briefLoading, setBriefLoading] = useState(false)
  const autoLoadTriggered = useRef(false)

  const company = intel?.company ?? result.company

  useEffect(() => {
    setIntel(overrideIntel ?? null)
    setLoading(!overrideIntel)
    setPeople([])
    setShowPeople(false)
    setSelectedPerson(null)
    setFoundEmails({})
    setEmailLoadingFor(null)
    setBrief(result.brief ?? null)
    setBriefLoading(false)
    autoLoadTriggered.current = false

    // Demo mode: use pre-baked data, skip API
    if (overrideIntel) return

    fetch(`/api/companies/${result.company.id}/intelligence`)
      .then(r => r.json())
      .then(data => {
        setIntel(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [result.company.id, overrideIntel])

  // Lazy-load brief when panel opens and no brief exists
  useEffect(() => {
    if (brief || briefLoading || overrideIntel) return
    // Only fetch if company has a real DB id (not demo)
    if (result.company.id.startsWith('demo-')) return
    setBriefLoading(true)
    fetch(`/api/companies/${result.company.id}/brief`)
      .then(r => r.json())
      .then(data => {
        if (data.brief) setBrief(data.brief)
      })
      .catch(() => {})
      .finally(() => setBriefLoading(false))
  }, [result.company.id, brief, briefLoading, overrideIntel])

  // Auto-load people when autoLoadPeople prop is true
  useEffect(() => {
    if (autoLoadPeople && !autoLoadTriggered.current && !loading) {
      autoLoadTriggered.current = true
      // Trigger loadPeople without toggling off
      setShowPeople(true)
      if (people.length === 0) {
        if (overridePeople) {
          setPeople(overridePeople)
        } else {
          setPeopleLoading(true)
          fetch(`/api/people/${result.company.id}`)
            .then(r => r.json())
            .then(data => {
              setPeople(data.people ?? [])
              setPeopleLoading(false)
            })
            .catch(() => setPeopleLoading(false))
        }
      }
    }
  }, [autoLoadPeople, loading, people.length, overridePeople, result.company.id])

  async function loadPeople() {
    if (showPeople) { setShowPeople(false); return }
    setShowPeople(true)
    if (people.length > 0) return

    // Demo mode: use pre-baked people instantly
    if (overridePeople) {
      setPeople(overridePeople)
      return
    }

    setPeopleLoading(true)
    const res = await fetch(`/api/people/${result.company.id}`)
    const data = await res.json()
    setPeople(data.people ?? [])
    setPeopleLoading(false)
  }

  async function handleSave() {
    onSave(result.company.id)
  }

  function handleGenerateOutreach(person: Person) {
    setSelectedPerson(person)
    setOutreachLoading(person.id)
    setTimeout(() => setOutreachLoading(null), 100)
  }

  async function handleFindEmail(person: Person) {
    if (emailLoadingFor) return
    setEmailLoadingFor(person.id)

    // Demo mode: reveal from override map after a realistic delay
    if (overrideEmails) {
      await new Promise(r => setTimeout(r, 1400))
      const email = overrideEmails[person.id]
      if (email) {
        setFoundEmails(prev => ({ ...prev, [person.id]: email }))
        toast.success(`Found email for ${person.name}`)
      } else {
        toast.error('Email not found in demo data')
      }
      setEmailLoadingFor(null)
      return
    }

    // Production: call an email enrichment API (Hunter.io / Apollo / etc.)
    try {
      const domain = result.company.domain ?? ''
      const [firstName, ...rest] = person.name.split(' ')
      const lastName = rest.join(' ')
      const res = await fetch(`/api/people/find-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, firstName, lastName }),
      })
      const data = await res.json()
      if (data.email) {
        setFoundEmails(prev => ({ ...prev, [person.id]: data.email }))
        toast.success(`Found email for ${person.name}`)
      } else {
        toast.error('Could not find email — try LinkedIn instead')
      }
    } catch {
      toast.error('Email lookup failed')
    } finally {
      setEmailLoadingFor(null)
    }
  }

  async function handleMarkSent(personId: string) {
    await fetch('/api/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: result.company.id, status: 'messaged', personId }),
    })
    toast.success('Marked as messaged in pipeline')
  }

  function handleFindPeopleClick() {
    onFindPeople?.()
    loadPeople()
  }

  const domain = company.domain ?? ''
  const logoUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null
  const peopleLoaded = people.length > 0 && showPeople

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--color-surface)' }}>
      {/* Inject keyframes */}
      <style>{fadeInUpKeyframes}</style>

      {/* Header */}
      <div
        className="flex items-start justify-between p-5 pb-4"
        style={{ borderBottom: '1px solid #E8E8E3' }}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {logoUrl && (
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
              style={{ background: 'var(--color-surface)', border: '1px solid #E8E8E3' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={company.name}
                className="h-6 w-6 object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {company.name}
              </h2>
              {company.website_url && (
                <a href={company.website_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {company.funding_stage && (
                <span className="text-xs" style={{ color: 'var(--color-lime-text)' }}>{company.funding_stage}</span>
              )}
              {company.headcount && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  <Users size={10} /> ~{company.headcount.toLocaleString()} people
                </span>
              )}
              {company.total_funding && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  <TrendingUp size={10} /> {company.total_funding}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-2 flex-shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/5"
        >
          <X size={16} style={{ color: 'var(--color-text-tertiary)' }} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <PanelSkeleton />
        ) : (
          <div className="p-5 space-y-5">
            {/* WHY NOW — Targeting Brief */}
            {brief && brief.whyNow.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: 'rgba(163,230,53,0.06)', border: '1px solid rgba(163,230,53,0.15)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap size={13} style={{ color: 'var(--color-lime)' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-lime-text)' }}>Why Now</span>
                </div>
                <ul className="space-y-1.5">
                  {brief.whyNow.map((signal, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="mt-1.5 flex-shrink-0 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-lime)' }} />
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {briefLoading && !brief && (
              <div className="rounded-xl p-4 animate-pulse" style={{ background: 'rgba(163,230,53,0.04)', border: '1px solid rgba(163,230,53,0.1)' }}>
                <div className="h-3 w-20 rounded bg-gray-200 mb-3" />
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-gray-200" />
                  <div className="h-3 w-3/4 rounded bg-gray-200" />
                </div>
              </div>
            )}

            {/* AI Summary */}
            {company.summary && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  Overview
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                  {company.summary}
                </p>
              </div>
            )}

            {/* YOUR ANGLE — from brief, or fallback to why_fit */}
            {brief?.yourAngle ? (
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.12)', borderLeft: '3px solid #38BDF8' }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Target size={13} style={{ color: '#38BDF8' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#38BDF8' }}>Your Angle</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {brief.yourAngle}
                </p>
              </div>
            ) : company.why_fit ? (
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'var(--color-lime-subtle)',
                  border: '1px solid var(--color-lime-border)',
                  borderLeft: '3px solid var(--color-lime)',
                }}
              >
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-lime-text)' }}>
                  Why This Fits You
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {company.why_fit}
                </p>
              </div>
            ) : null}

            {/* OPENING LINE — from brief */}
            {brief?.openingLine && (
              <PanelOpeningLine text={brief.openingLine} />
            )}

            {/* Key People — moved up to be right after Why This Fits You */}
            <div>
              <button
                onClick={loadPeople}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all"
                style={{
                  background: showPeople ? 'var(--color-lime-subtle)' : 'var(--color-surface)',
                  border: `1px solid ${showPeople ? 'var(--color-lime-border)' : '#E8E8E3'}`,
                  color: 'var(--color-text-primary)',
                }}
              >
                <span>Key People{people.length > 0 ? ` (${people.length})` : ''}</span>
                <ChevronDown
                  size={16}
                  style={{ color: 'var(--color-text-tertiary)', transform: showPeople ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
                />
              </button>

              {showPeople && (
                <div className="mt-3 space-y-2">
                  {peopleLoading ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: '#F0F0EC', animationDelay: `${i * 150}ms` }}>
                          <div className="h-4 w-32 rounded bg-gray-200 mb-2" />
                          <div className="h-3 w-48 rounded bg-gray-200" />
                        </div>
                      ))}
                    </div>
                  ) : people.length === 0 ? (
                    <div className="rounded-xl p-4 text-center">
                      <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No contacts found for this domain.</p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Hunter.io has limited coverage for early-stage companies. Try searching LinkedIn directly.</p>
                    </div>
                  ) : (
                    <>
                      {people.map((person, index) => (
                        <div
                          key={person.id}
                          style={{
                            animation: 'fadeInUp 0.4s ease-out both',
                            animationDelay: `${index * 100}ms`,
                          }}
                        >
                          <PersonCard
                            person={person}
                            onGenerateOutreach={handleGenerateOutreach}
                            loading={outreachLoading === person.id}
                            onFindEmail={handleFindEmail}
                            revealedEmail={foundEmails[person.id]}
                            emailLoading={emailLoadingFor === person.id}
                          />
                          {selectedPerson?.id === person.id && (
                            <div
                              className="mt-2 rounded-xl p-4"
                              style={{ background: 'var(--color-surface)', border: '1px solid #E8E8E3' }}
                            >
                              <OutreachGenerator
                                person={person}
                                company={company}
                                onMarkSent={handleMarkSent}
                                demoVariants={overrideOutreach?.[person.id]}
                                revealedEmail={foundEmails[person.id] ?? person.email ?? undefined}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Hiring Signals */}
            {company.hiring_signals && company.hiring_signals.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  Hiring Signals
                </p>
                <div className="flex flex-wrap gap-2">
                  {company.hiring_signals.map((signal, i) => (
                    <span
                      key={i}
                      className="rounded-full px-3 py-1 text-xs font-medium"
                      style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--color-success)', border: '1px solid rgba(34,197,94,0.2)' }}
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Red Flags */}
            {company.red_flags && company.red_flags.length > 0 && (
              <div
                className="rounded-xl p-3"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-warning)' }}>
                  <AlertTriangle size={10} /> Things to Consider
                </p>
                {company.red_flags.map((flag, i) => (
                  <p key={i} className="text-xs" style={{ color: '#D97706' }}>· {flag}</p>
                ))}
              </div>
            )}

            {/* Investors */}
            {company.investors && company.investors.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  Investors
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {company.investors.slice(0, 6).map((inv, i) => (
                    <span
                      key={i}
                      className="rounded-lg px-2 py-1 text-xs"
                      style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid #E8E8E3' }}
                    >
                      {inv}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent News */}
            {intel?.news && intel.news.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  Recent News
                </p>
                <div className="space-y-2">
                  {intel.news.slice(0, 3).map((item, i) => (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg p-3 transition-colors hover:bg-white/[0.02]"
                      style={{ background: 'var(--color-surface)', border: '1px solid #E8E8E3' }}
                    >
                      <p className="text-xs font-medium leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                        {item.title}
                      </p>
                      {item.snippet && (
                        <p className="mt-1 text-xs line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                          {item.snippet}
                        </p>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky CTAs */}
      <div
        className="flex flex-col gap-2 p-4"
        style={{ borderTop: '1px solid #E8E8E3', background: 'var(--color-surface)' }}
      >
        {peopleLoaded ? (
          <div
            className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
            style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--color-success)', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            <CheckCircle size={15} />
            People loaded
          </div>
        ) : (
          <button
            onClick={handleFindPeopleClick}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all"
            style={{
              background: 'var(--color-lime)',
              color: '#1A2E05',
              boxShadow: '0 0 16px var(--color-lime-subtle)',
            }}
          >
            Find People &rarr;
          </button>
        )}
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-all"
          style={{
            background: saved ? 'rgba(34,197,94,0.12)' : 'transparent',
            color: saved ? 'var(--color-success)' : 'var(--color-text-secondary)',
            border: saved ? '1px solid rgba(34,197,94,0.25)' : '1px solid #E8E8E3',
          }}
        >
          {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          {saved ? 'Saved' : 'Save to Pipeline'}
        </button>
      </div>
    </div>
  )
}
