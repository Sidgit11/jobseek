'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, Upload, RefreshCw, Linkedin, MapPin, Briefcase, GraduationCap, ExternalLink, ArrowRight, Copy, Check, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile, CandidateModel } from '@/types'

const TARGET_ROLES = ['Product Manager', 'Software Engineer', 'Designer', 'Data Scientist', 'Growth', 'GTM / Sales', 'Marketing', 'Operations', 'Other']
const TARGET_INDUSTRIES = ['AI / ML', 'Fintech', 'SaaS', 'Consumer', 'HealthTech', 'Crypto / Web3', 'Developer Tools', 'Climate Tech', 'E-Commerce', 'Other']
const TARGET_LOCATIONS = ['India', 'United States', 'Europe', 'United Kingdom', 'Southeast Asia', 'Remote']
const COMPANY_STAGES = ['Early Stage Startup', 'Growth Stage', 'Late Stage / Pre-IPO', 'Enterprise / Public', 'Any']
const SENIORITY_OPTIONS = [
  { id: 'intern_entry', label: 'Intern / Entry Level' },
  { id: 'mid', label: 'Mid Level (2-5 yrs)' },
  { id: 'senior', label: 'Senior IC (5-10 yrs)' },
  { id: 'lead', label: 'Lead / Staff / Principal' },
  { id: 'management', label: 'Manager / Director' },
  { id: 'executive', label: 'VP / C-Level / Founder' },
]

function ChipSelect({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? selected.filter(v => v !== opt) : [...selected, opt])}
            className="cursor-pointer rounded-xl px-3.5 py-1.5 text-sm font-medium transition-all hover:brightness-110"
            style={{
              background: active ? 'var(--color-lime-subtle)' : 'var(--color-surface)',
              color: active ? 'var(--color-lime-text)' : 'var(--color-text-secondary)',
              border: active ? '1px solid var(--color-lime-border)' : '1px solid #D4D4CC',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  // Editable fields
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [seniority, setSeniority] = useState('')
  const [targetRoles, setTargetRoles] = useState<string[]>([])
  const [targetIndustries, setTargetIndustries] = useState<string[]>([])
  const [targetLocations, setTargetLocations] = useState<string[]>([])
  const [companyStages, setCompanyStages] = useState<string[]>([])
  const [candidateSummary, setCandidateSummary] = useState('')
  const [candidateModel, setCandidateModel] = useState<CandidateModel | null>(null)
  const [slugCopied, setSlugCopied] = useState(false)

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(data => {
        const p = data.profile
        setProfile(p)
        setName(p?.name ?? '')
        setLocation(p?.location ?? '')
        setLinkedinUrl(p?.linkedin_url ?? '')
        setSeniority(p?.seniority ?? '')
        setTargetRoles(p?.target_roles ?? [])
        setTargetIndustries(p?.target_industries ?? [])
        setTargetLocations(p?.target_locations ?? [])
        setCompanyStages(p?.company_stages ?? [])
        setCandidateSummary(p?.candidate_summary ?? '')
        setLoading(false)
      })
    // Fetch candidate model
    fetch('/api/intake/model')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.model) setCandidateModel(data.model) })
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, location: location || null, linkedin_url: linkedinUrl || null,
        seniority: seniority || null, target_roles: targetRoles, target_industries: targetIndustries,
        target_locations: targetLocations, company_stages: companyStages, candidate_summary: candidateSummary,
      }),
    })
    if (res.ok) toast.success('Profile saved')
    else toast.error('Failed to save')
    setSaving(false)
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setRegenerating(true)
    const formData = new FormData()
    formData.append('resume', file)
    const res = await fetch('/api/user/resume', { method: 'POST', body: formData })
    const data = await res.json()
    if (res.ok) { setCandidateSummary(data.summary); toast.success('Summary regenerated from resume') }
    else toast.error(data.error ?? 'Failed to process resume')
    setRegenerating(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-lime)' }} />
      </div>
    )
  }

  const experience = profile?.linkedin_experience as Array<{ company: string; title: string; duration: string }> | null
  const seniorityLabel = SENIORITY_OPTIONS.find(o => o.id === seniority)?.label || seniority

  return (
    <div className="min-h-screen px-8 py-8" style={{ background: 'var(--color-bg)' }}>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Profile</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{profile?.email}</p>
          </div>
          {linkedinUrl && (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:brightness-110"
              style={{ background: '#0A66C2', color: '#fff' }}
            >
              <Linkedin size={12} /> LinkedIn <ExternalLink size={10} />
            </a>
          )}
        </div>

        <div className="space-y-5">

          {/* ── Career Intelligence CTA / Summary ── */}
          {candidateModel && candidateModel.intake_phase >= 6 ? (
            <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-lime-border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} style={{ color: '#A3E635' }} />
                <h2 className="text-xs font-semibold" style={{ color: 'var(--color-lime-text)', letterSpacing: '0.06em' }}>
                  Career Model — Complete
                </h2>
                <span className="ml-auto text-[10px] font-medium rounded-full px-2 py-0.5"
                  style={{ background: 'var(--color-lime-subtle)', color: 'var(--color-lime-text)' }}>
                  {candidateModel.completeness_score}% complete
                </span>
              </div>
              {candidateModel.headline && (
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  {candidateModel.headline}
                </p>
              )}
              {candidateModel.positioning && (
                <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {candidateModel.positioning}
                </p>
              )}
              <div className="flex items-center gap-2">
                {profile?.slug && (
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/p/${profile.slug}`
                      navigator.clipboard.writeText(url)
                      setSlugCopied(true)
                      setTimeout(() => setSlugCopied(false), 2000)
                      toast.success('Profile link copied')
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:brightness-105"
                    style={{ background: '#A3E635', color: '#1A2E05' }}
                  >
                    {slugCopied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy public link</>}
                  </button>
                )}
                {profile?.slug && (
                  <a
                    href={`/p/${profile.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:bg-[var(--color-surface-2)]"
                    style={{ border: 'var(--border-default)', color: 'var(--color-text-secondary)' }}
                  >
                    View profile ↗
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-lime-border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} style={{ color: '#A3E635' }} />
                <h2 className="text-xs font-semibold" style={{ color: 'var(--color-lime-text)', letterSpacing: '0.06em' }}>
                  Career Intelligence
                </h2>
              </div>
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Build your career model
              </h3>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                A 10-minute conversation that powers your outreach, resume, and public presence. Replaces every form.
              </p>
              <a
                href="/intake"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:brightness-105 active:scale-[0.97]"
                style={{ background: '#A3E635', color: '#1A2E05' }}
              >
                Start Career Interview <ArrowRight size={12} />
              </a>
            </div>
          )}

          {/* ── LinkedIn Profile Card ── */}
          {(profile?.linkedin_headline || experience) && (
            <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid #D4D4CC' }}>
              <div className="flex items-center gap-2 mb-4">
                <Linkedin size={14} style={{ color: '#0A66C2' }} />
                <h2 className="text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                  From LinkedIn
                </h2>
                {profile?.linkedin_scraped_at && (
                  <span className="ml-auto text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    Scraped {new Date(profile.linkedin_scraped_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {profile?.linkedin_headline && (
                <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  {profile.linkedin_headline}
                </p>
              )}

              {/* Experience */}
              {experience && experience.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Briefcase size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Experience</span>
                  </div>
                  <div className="space-y-2 ml-4">
                    {experience.filter(e => e.title || e.company).slice(0, 5).map((exp, i) => (
                      <div key={i} className="flex items-baseline gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: i === 0 ? 'var(--color-lime)' : '#D4D4CC' }} />
                        <div>
                          <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {exp.title || exp.company}
                          </p>
                          {exp.title && exp.company && (
                            <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{exp.company}</p>
                          )}
                          {exp.duration && (
                            <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{exp.duration}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Location */}
              {profile?.location && (
                <div className="flex items-center gap-1.5 mt-2">
                  <MapPin size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{profile.location}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Basic Info ── */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid #D4D4CC' }}>
            <h2 className="mb-4 text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
              Basic Info
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Name</label>
                <input value={name} onChange={e => setName(e.target.value)} className="input-base" placeholder="Your name" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} className="input-base" placeholder="e.g. Bengaluru" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>LinkedIn URL</label>
                <input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} className="input-base" placeholder="https://linkedin.com/in/..." />
              </div>
            </div>
          </div>

          {/* ── Target Preferences ── */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid #D4D4CC' }}>
            <h2 className="mb-4 text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
              Job Preferences
            </h2>

            <div className="space-y-5">
              {/* Seniority */}
              <div>
                <label className="mb-2 block text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Seniority Level</label>
                <div className="flex flex-wrap gap-2">
                  {SENIORITY_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSeniority(opt.id)}
                      className="cursor-pointer rounded-xl px-3.5 py-1.5 text-sm font-medium transition-all hover:brightness-110"
                      style={{
                        background: seniority === opt.id ? 'var(--color-lime-subtle)' : 'var(--color-surface)',
                        color: seniority === opt.id ? 'var(--color-lime-text)' : 'var(--color-text-secondary)',
                        border: seniority === opt.id ? '1px solid var(--color-lime-border)' : '1px solid #D4D4CC',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Roles */}
              <div>
                <label className="mb-2 block text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Target Roles</label>
                <ChipSelect options={TARGET_ROLES} selected={targetRoles} onChange={setTargetRoles} />
              </div>

              {/* Location Preferences */}
              <div>
                <label className="mb-2 block text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Location Preferences</label>
                <ChipSelect options={TARGET_LOCATIONS} selected={targetLocations} onChange={setTargetLocations} />
              </div>

              {/* Industries */}
              <div>
                <label className="mb-2 block text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Industries</label>
                <ChipSelect options={TARGET_INDUSTRIES} selected={targetIndustries} onChange={setTargetIndustries} />
              </div>

              {/* Company Stage */}
              <div>
                <label className="mb-2 block text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Company Stage</label>
                <ChipSelect options={COMPANY_STAGES} selected={companyStages} onChange={setCompanyStages} />
              </div>
            </div>
          </div>

          {/* ── Outreach Summary ── */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid #D4D4CC' }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                Outreach Summary
              </h2>
              <label
                className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all hover:opacity-80"
                style={{ background: '#EDEDEA', color: 'var(--color-text-secondary)' }}
              >
                {regenerating ? <><RefreshCw size={10} className="animate-spin" /> Regenerating…</> : <><Upload size={10} /> Re-upload resume</>}
                <input type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} disabled={regenerating} />
              </label>
            </div>
            <textarea
              value={candidateSummary}
              onChange={e => setCandidateSummary(e.target.value)}
              rows={5}
              placeholder="Your outreach summary powers every message we generate. Include: your unique skills, notable companies/projects, and what makes you stand out."
              className="input-base resize-none leading-relaxed"
            />
            <p className="mt-1 text-[10px] text-right" style={{ color: 'var(--color-text-tertiary)' }}>{candidateSummary.length} chars</p>
          </div>

          {/* ── Save Button ── */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full py-3.5 text-sm"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save changes</>}
          </button>
        </div>
      </div>
    </div>
  )
}
