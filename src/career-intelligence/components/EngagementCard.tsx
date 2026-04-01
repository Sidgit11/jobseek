'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, ChevronDown, X } from 'lucide-react'
import type { EngagementOpportunity } from '@/career-intelligence/types'

interface EngagementCardProps {
  opportunity: EngagementOpportunity
  onDismiss: (id: string) => void
  onGenerateComment: (id: string) => Promise<string>
}

export function EngagementCard({ opportunity: opp, onDismiss, onGenerateComment }: EngagementCardProps) {
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [comment, setComment] = useState(opp.generated_comment)

  async function handleGenerate() {
    if (comment) {
      setExpanded(!expanded)
      return
    }
    setGenerating(true)
    setExpanded(true)
    const result = await onGenerateComment(opp.id)
    setComment(result)
    setGenerating(false)
  }

  async function handleCopy() {
    if (!comment) return
    await navigator.clipboard.writeText(comment)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        border: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-bold rounded-full px-2 py-0.5"
                style={{
                  background: opp.engagement_score >= 80 ? 'rgba(163,230,53,0.12)' : 'var(--color-surface-2)',
                  color: opp.engagement_score >= 80 ? 'var(--color-lime-text)' : 'var(--color-text-tertiary)',
                }}
              >
                {opp.engagement_score}% match
              </span>
              {opp.score_reasons.slice(0, 1).map((r, i) => (
                <span key={i} className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  · {r}
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {opp.author_name}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {opp.author_title} · {opp.author_company}
            </p>
          </div>
          <button
            onClick={() => onDismiss(opp.id)}
            className="p-1.5 rounded-lg transition-all hover:bg-[var(--color-surface-2)] flex-shrink-0"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <X size={13} />
          </button>
        </div>

        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
          &ldquo;{opp.post_text}&rdquo;
        </p>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:brightness-105 active:scale-[0.97] disabled:opacity-60"
          style={{ background: '#A3E635', color: '#1A2E05' }}
        >
          {generating ? '···' : comment ? (
            <>{expanded ? 'Hide' : 'View'} comment <ChevronDown size={11} /></>
          ) : '✦ Generate comment'}
        </button>
        {opp.post_url && (
          <a
            href={opp.post_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:bg-[var(--color-surface-2)]"
            style={{ border: 'var(--border-default)', color: 'var(--color-text-secondary)' }}
          >
            View post ↗
          </a>
        )}
      </div>

      {/* Generated comment (expandable) */}
      <AnimatePresence>
        {expanded && comment && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-4 rounded-xl p-4"
              style={{
                background: 'var(--color-lime-subtle)',
                border: '1px solid var(--color-lime-border)',
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-lime-text)' }}>
                  ✦ Generated comment
                </p>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-all"
                  style={{ background: '#A3E635', color: '#1A2E05' }}
                >
                  {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                </button>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-lime-text)' }}>
                {comment}
              </p>
              <p className="mt-2 text-[10px]" style={{ color: '#4D7C0F' }}>
                Edit before posting. Go to the post on LinkedIn and paste this comment.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
