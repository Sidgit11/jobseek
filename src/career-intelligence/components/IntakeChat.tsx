'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, CheckCircle, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { IntakeMessage } from '@/career-intelligence/types'
import { PHASES } from './IntakeProgress'

const OPENING_MESSAGE: IntakeMessage = {
  role: 'assistant',
  content: "Hey — I'm going to ask you a few questions so Jobseek can actually understand you, not just your job titles. This takes about 10 minutes and replaces every form we'd otherwise make you fill. Ready? Let's start: tell me in a sentence or two — what do you do, and what are you looking for next?",
  timestamp: new Date().toISOString(),
  extracted_facts: [],
}

interface IntakeChatProps {
  phase: number
  onPhaseChange: (phase: number) => void
  onFacts: (facts: string[]) => void
}

export function IntakeChat({ phase, onPhaseChange, onFacts }: IntakeChatProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<IntakeMessage[]>([OPENING_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    // Optimistic update
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    }])

    try {
      const res = await fetch('/api/intake/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, conversationId, phase }),
      })
      const data = await res.json()

      setConversationId(data.conversationId)
      if (data.extractedFacts?.length > 0) {
        onFacts(data.extractedFacts)
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        extracted_facts: data.extractedFacts ?? [],
      }])

      // Auto-advance phase based on message count
      const userMessages = messages.filter(m => m.role === 'user').length + 1
      if (userMessages >= 4 && phase === 1) onPhaseChange(2)
      else if (userMessages >= 8 && phase === 2) onPhaseChange(3)
      else if (userMessages >= 11 && phase === 3) onPhaseChange(4)
      else if (userMessages >= 13 && phase === 4) onPhaseChange(5)
      else if (userMessages >= 15 && phase === 5) setIsComplete(true)

    } catch (err) {
      console.error('Intake chat error:', err)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function handleComplete() {
    setLoading(true)
    await fetch('/api/intake/complete', { method: 'POST' })
    router.push('/profile?intake=complete')
  }

  return (
    <div className="flex flex-1 flex-col" style={{ maxHeight: '100vh' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-8 py-5"
        style={{ borderBottom: 'var(--border-subtle)', background: 'var(--color-surface)' }}
      >
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Career Interview
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Phase {phase} of {PHASES.length} · {Math.round((phase / PHASES.length) * 100)}% complete
          </p>
        </div>
        <div
          className="h-1.5 w-32 rounded-full overflow-hidden"
          style={{ background: 'var(--color-surface-3)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: '#A3E635' }}
            animate={{ width: `${(phase / PHASES.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[680px] rounded-2xl px-5 py-3.5 text-sm leading-relaxed"
                style={msg.role === 'assistant' ? {
                  background: 'var(--color-surface)',
                  border: 'var(--border-subtle)',
                  color: 'var(--color-text-primary)',
                  boxShadow: 'var(--shadow-xs)',
                  borderRadius: '4px 16px 16px 16px',
                } : {
                  background: '#A3E635',
                  color: '#1A2E05',
                  borderRadius: '16px 4px 16px 16px',
                }}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div
              className="flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm"
              style={{ background: 'var(--color-surface)', border: 'var(--border-subtle)', color: 'var(--color-text-tertiary)' }}
            >
              <span className="animate-pulse">···</span>
            </div>
          </motion.div>
        )}

        {/* Complete state */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center py-4"
          >
            <div
              className="rounded-2xl p-6 text-center"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-lime-border)', maxWidth: '420px' }}
            >
              <CheckCircle size={28} style={{ color: '#A3E635', margin: '0 auto 12px' }} />
              <h3 className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Your career model is ready
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                Jobseek now understands your background deeply. Your profile, resume, and outreach will all use this.
              </p>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all hover:brightness-105 active:scale-[0.97] disabled:opacity-60"
                style={{ background: '#A3E635', color: '#1A2E05' }}
              >
                See your profile <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!isComplete && (
        <div
          className="px-8 py-5"
          style={{ borderTop: 'var(--border-subtle)', background: 'var(--color-surface)' }}
        >
          <div className="flex items-center gap-3 max-w-[720px]">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Tell me about your work..."
              className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: 'var(--color-bg)',
                border: 'var(--border-default)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#A3E635'
                e.target.style.boxShadow = '0 0 0 3px rgba(163,230,53,0.2)'
              }}
              onBlur={e => {
                e.target.style.removeProperty('border-color')
                e.target.style.boxShadow = 'none'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-all hover:brightness-105 active:scale-[0.97] disabled:opacity-40"
              style={{ background: '#A3E635', color: '#1A2E05' }}
            >
              <Send size={15} />
            </button>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            Press Enter to send · Your answers build your profile, resume, and outreach templates
          </p>
        </div>
      )}
    </div>
  )
}
