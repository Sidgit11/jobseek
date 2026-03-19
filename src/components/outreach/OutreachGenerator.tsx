'use client'

import { useState } from 'react'
import { Copy, RefreshCw, Check, Linkedin, Mail, AlertCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { Person, Company } from '@/types'

interface OutreachData {
  linkedin: string
  email_subject: string
  email_body: string
  draft_ids: { linkedin: string; email: string }
}

interface OutreachGeneratorProps {
  person: Person
  company: Company
  onMarkSent: (personId: string) => void
  /** Demo mode: skip API, show these messages after a brief fake-loading delay */
  demoVariants?: { linkedin: string; email_subject: string; email_body: string }
  /** Revealed email address — enables "Send Email" button on the email tab */
  revealedEmail?: string
}

const MAX_LINKEDIN_CHARS = 300

type SendState = 'idle' | 'sending' | 'sent'

export function OutreachGenerator({ person, company, onMarkSent, demoVariants, revealedEmail }: OutreachGeneratorProps) {
  const [activeTab, setActiveTab] = useState<'linkedin' | 'email'>('linkedin')
  const [outreach, setOutreach] = useState<OutreachData | null>(null)
  const [linkedinText, setLinkedinText] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [sendState, setSendState] = useState<SendState>('idle')

  async function generate() {
    setGenerating(true)
    setError(null)

    // Demo mode: skip API, use pre-written variants after a realistic delay
    if (demoVariants) {
      await new Promise(r => setTimeout(r, 1600))
      const data: OutreachData = {
        linkedin: demoVariants.linkedin,
        email_subject: demoVariants.email_subject,
        email_body: demoVariants.email_body,
        draft_ids: { linkedin: 'demo', email: 'demo' },
      }
      setOutreach(data)
      setLinkedinText(data.linkedin)
      setEmailSubject(data.email_subject)
      setEmailBody(data.email_body)
      setGenerating(false)
      return
    }

    const res = await fetch('/api/outreach/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: person.id, companyId: company.id }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to generate outreach')
      setGenerating(false)
      return
    }

    setOutreach(data)
    setLinkedinText(data.linkedin)
    setEmailSubject(data.email_subject)
    setEmailBody(data.email_body)
    setGenerating(false)
  }

  async function copyToClipboard() {
    const text = activeTab === 'linkedin'
      ? linkedinText
      : `Subject: ${emailSubject}\n\n${emailBody}`

    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSendEmail() {
    if (!revealedEmail || sendState !== 'idle') return
    setSendState('sending')

    try {
      const res = await fetch('/api/outreach/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: revealedEmail,
          subject: emailSubject,
          body: emailBody,
          fromName: 'Jordan from Jobseek',
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Send failed')

      setSendState('sent')
      onMarkSent(person.id)

      if (data.demo) {
        toast.success(`Email "sent" to ${revealedEmail} ✓`, {
          description: 'Demo mode — not actually delivered',
        })
      } else {
        toast.success(`Email sent to ${revealedEmail} ✓`)
      }
    } catch (err) {
      setSendState('idle')
      toast.error('Failed to send email')
      console.error(err)
    }
  }

  const linkedinChars = linkedinText.length
  const linkedinOver = linkedinChars > MAX_LINKEDIN_CHARS

  if (!outreach && !generating) {
    return (
      <div className="py-4 text-center">
        <button
          onClick={generate}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
          style={{
            background: 'var(--color-lime-subtle)',
            color: 'var(--color-lime-text)',
            border: '1px solid var(--color-lime-border)',
          }}
        >
          Generate outreach for {person.name}
        </button>
        {error && (
          <p className="mt-3 flex items-center justify-center gap-1 text-xs" style={{ color: 'var(--color-error)' }}>
            <AlertCircle size={12} /> {error}
          </p>
        )}
      </div>
    )
  }

  if (generating) {
    return (
      <div className="py-6 text-center">
        <div className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--color-lime-text)' }}>
          <RefreshCw size={16} className="animate-spin" />
          Claude is crafting your messages…
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Analyzing {company.name} and personalizing for {person.name}
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex rounded-xl p-1" style={{ background: 'var(--color-surface)' }}>
        {(['linkedin', 'email'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all"
            style={{
              background: activeTab === tab ? '#E8E8E3' : 'transparent',
              color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            }}
          >
            {tab === 'linkedin' ? <Linkedin size={12} /> : <Mail size={12} />}
            {tab === 'linkedin' ? 'LinkedIn Note' : 'Cold Email'}
            {tab === 'email' && revealedEmail && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--color-success)' }}
              >
                email ready
              </span>
            )}
          </button>
        ))}
      </div>

      {/* LinkedIn tab */}
      {activeTab === 'linkedin' && (
        <div>
          <textarea
            value={linkedinText}
            onChange={e => setLinkedinText(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-xl px-4 py-3 text-sm leading-relaxed outline-none"
            style={{
              background: 'var(--color-surface)',
              border: `1px solid ${linkedinOver ? 'var(--color-error)' : '#E8E8E3'}`,
              color: 'var(--color-text-primary)',
            }}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span
              className="text-xs"
              style={{ color: linkedinOver ? 'var(--color-error)' : 'var(--color-text-tertiary)' }}
            >
              {linkedinChars}/{MAX_LINKEDIN_CHARS} chars
              {linkedinOver && ' — over limit!'}
            </span>
          </div>
        </div>
      )}

      {/* Email tab */}
      {activeTab === 'email' && (
        <div className="space-y-3">
          {/* Recipient badge when email is available */}
          {revealedEmail && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <Mail size={11} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>To:</span>
              <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>{revealedEmail}</span>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Subject</label>
            <input
              value={emailSubject}
              onChange={e => setEmailSubject(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: 'var(--color-surface)', border: '1px solid #E8E8E3', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Body</label>
            <textarea
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              rows={8}
              className="w-full resize-none rounded-xl px-4 py-3 text-sm leading-relaxed outline-none"
              style={{ background: 'var(--color-surface)', border: '1px solid #E8E8E3', color: 'var(--color-text-primary)' }}
            />
            <p className="mt-1 text-right text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {emailBody.split(/\s+/).filter(Boolean).length} words
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 space-y-2">
        {/* Send Email — full-width primary when on email tab with email found */}
        {activeTab === 'email' && revealedEmail && sendState !== 'sent' && (
          <button
            onClick={handleSendEmail}
            disabled={sendState === 'sending'}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-70"
            style={{
              background: sendState === 'sending'
                ? 'rgba(34,197,94,0.15)'
                : 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
              color: sendState === 'sending' ? 'var(--color-success)' : '#fff',
              boxShadow: sendState === 'idle' ? '0 0 16px rgba(34,197,94,0.3)' : 'none',
            }}
          >
            {sendState === 'sending' ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send size={14} />
                Send to {revealedEmail}
              </>
            )}
          </button>
        )}

        {/* Sent confirmation */}
        {sendState === 'sent' && (
          <div
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
            style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--color-success)', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            <Check size={14} />
            Sent to {revealedEmail}
          </div>
        )}

        {/* Secondary actions row */}
        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all"
            style={{
              background: copied ? 'rgba(34,197,94,0.15)' : 'var(--color-lime)',
              color: copied ? 'var(--color-success)' : '#1A2E05',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>

          <button
            onClick={generate}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
            style={{ background: '#E8E8E3', color: 'var(--color-text-secondary)' }}
          >
            <RefreshCw size={14} />
            Regenerate
          </button>

          <button
            onClick={() => onMarkSent(person.id)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
            style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--color-success)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            Sent ✓
          </button>
        </div>
      </div>
    </div>
  )
}
