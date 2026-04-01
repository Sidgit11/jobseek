'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { EngagementCard } from './EngagementCard'
import type { EngagementOpportunity } from '@/career-intelligence/types'

export function EngagementQueue() {
  const [opportunities, setOpportunities] = useState<EngagementOpportunity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/engagement/opportunities')
      .then(r => r.json())
      .then(d => { setOpportunities(d.opportunities ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleGenerateComment(id: string): Promise<string> {
    const res = await fetch('/api/engagement/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: id }),
    })
    const { comment } = await res.json()
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, generated_comment: comment } : o))
    return comment
  }

  async function handleDismiss(id: string) {
    setOpportunities(prev => prev.filter(o => o.id !== id))
    await fetch(`/api/engagement/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'skipped' }),
    }).catch(() => { /* non-critical */ })
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-xl skeleton-shimmer" />
        ))}
      </div>
    )
  }

  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 h-12 w-12 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--color-surface-2)', border: 'var(--border-subtle)' }}>
          <span style={{ fontSize: '20px' }}>💬</span>
        </div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          No opportunities yet
        </h3>
        <p className="mt-1 text-xs max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>
          The Chrome extension captures relevant posts from your LinkedIn feed as you browse. Check back after scrolling your feed.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <AnimatePresence>
        {opportunities.map(opp => (
          <EngagementCard
            key={opp.id}
            opportunity={opp}
            onDismiss={handleDismiss}
            onGenerateComment={handleGenerateComment}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
