'use client'

import { EngagementQueue } from '@/career-intelligence/components/EngagementQueue'

export default function EngagePage() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '32px 36px' }}>
      <div className="mb-8">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Warm-Up Queue
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Comment on these posts before reaching out — it makes cold outreach warm.
        </p>
      </div>

      <EngagementQueue />
    </div>
  )
}
