'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle2, Loader2, ArrowLeft, Zap, Sparkles, Chrome, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react'
import { EXTENSION_STORE_URL, detectExtension, pingExtension } from '@/lib/extension/detect'

const TARGET_ROLES = ['Product Manager', 'Software Engineer', 'Designer', 'Data Scientist', 'Growth', 'GTM / Sales', 'Marketing', 'Operations', 'Other']
const TARGET_LOCATIONS = ['India', 'United States', 'Europe', 'United Kingdom', 'Southeast Asia', 'Remote']
const TARGET_INDUSTRIES = ['AI / ML', 'Fintech', 'SaaS', 'Consumer', 'HealthTech', 'Crypto / Web3', 'Developer Tools', 'Climate Tech', 'E-Commerce', 'Other']
const COMPANY_STAGES = ['Early Stage Startup', 'Growth Stage', 'Late Stage / Pre-IPO', 'Enterprise / Public', 'Any']

const SENIORITY_OPTIONS = [
  { id: 'intern_entry', label: 'Intern / Entry Level', desc: 'Fresher, internships, analyst roles' },
  { id: 'mid', label: 'Mid Level (2-5 yrs)', desc: 'IC roles at any company' },
  { id: 'senior', label: 'Senior IC (5-10 yrs)', desc: 'Senior PM, Sr. Engineer, etc.' },
  { id: 'lead', label: 'Lead / Staff / Principal', desc: 'Team leads, staff engineers, principal PMs' },
  { id: 'management', label: 'Manager / Director', desc: 'People management, department heads' },
  { id: 'executive', label: 'VP / C-Level / Founder', desc: 'Executive leadership roles' },
]

const TOTAL_STEPS = 4

type ScrapedProfile = {
  name?: string; headline?: string; company?: string; role?: string;
  about?: string; location?: string;
  experience?: Array<{ company: string; role: string; duration: string }>;
  education?: Array<{ school: string; degree: string; years: string }>;
}

type ExtensionStatus = 'checking' | 'not_found' | 'found' | 'error'

function MultiSelectChips({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt)
        return (
          <button key={opt} type="button"
            onClick={() => onChange(active ? selected.filter(v => v !== opt) : [...selected, opt])}
            className="cursor-pointer rounded-[var(--radius-md)] px-4 py-2 text-[13px] font-medium transition-all hover:brightness-110 active:scale-[0.97]"
            style={{
              background: active ? 'var(--color-lime-subtle)' : 'var(--color-surface)',
              color: active ? 'var(--color-lime-text)' : 'var(--color-text-secondary)',
              border: `1px solid ${active ? 'var(--color-lime-border)' : '#D4D4CC'}`,
            }}
          >{opt}</button>
        )
      })}
    </div>
  )
}

function SenioritySelector({ selected, onChange }: { selected: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {SENIORITY_OPTIONS.map(opt => {
        const active = selected === opt.id
        return (
          <button key={opt.id} type="button" onClick={() => onChange(opt.id)}
            className="cursor-pointer rounded-[var(--radius-md)] px-3 py-2.5 text-left transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: active ? 'var(--color-lime-subtle)' : 'var(--color-surface)',
              border: `1px solid ${active ? 'var(--color-lime-border)' : '#D4D4CC'}`,
            }}
          >
            <div className="text-sm font-medium" style={{ color: active ? 'var(--color-lime-text)' : 'var(--color-text-primary)' }}>{opt.label}</div>
            <div className="text-[10px] mt-0.5" style={{ color: active ? 'var(--color-lime-text)' : 'var(--color-text-tertiary)' }}>{opt.desc}</div>
          </button>
        )
      })}
    </div>
  )
}


export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Step 0
  const [extStatus, setExtStatus] = useState<ExtensionStatus>('checking')
  const [extVersion, setExtVersion] = useState<string | null>(null)
  const [extDeviceToken, setExtDeviceToken] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  // Step 1
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeStatus, setAnalyzeStatus] = useState('')
  const [scrapedProfile, setScrapedProfile] = useState<ScrapedProfile | null>(null)
  const [resumeText, setResumeText] = useState<string | null>(null)

  // Step 2
  const [targetRoles, setTargetRoles] = useState<string[]>([])
  const [seniority, setSeniority] = useState('')
  const [targetLocations, setTargetLocations] = useState<string[]>([])
  const [targetIndustries, setTargetIndustries] = useState<string[]>([])
  const [companyStages, setCompanyStages] = useState<string[]>([])

  // Step 3
  const [summary, setSummary] = useState('')
  const [generatingSummary, setGeneratingSummary] = useState(false)

  useEffect(() => { checkExtension() }, [])

  async function checkExtension() {
    setChecking(true); setExtStatus('checking')
    const result = await detectExtension()
    if (result.found) {
      setExtStatus('found'); setExtVersion(result.version || null); setExtDeviceToken(result.deviceToken || null)
      if (result.deviceToken) {
        fetch('/api/user/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_token: result.deviceToken }) }).catch(() => {})
      }
    } else { setExtStatus('not_found') }
    setChecking(false)
  }

  async function scrapeLinkedInViaExtension(url: string): Promise<ScrapedProfile | null> {
    try {
      const chromeApi = (window as unknown as { chrome?: { runtime?: { sendMessage?: (id: string, msg: unknown, cb: (r: unknown) => void) => void } } }).chrome
      if (!chromeApi?.runtime?.sendMessage) return null
      const storedExtId = localStorage.getItem('jobseek_extension_id')
      if (!storedExtId) return null

      // Try getting profile via extension callback
      const response = await new Promise<{ success?: boolean; profile?: ScrapedProfile }>((resolve) => {
        const timer = setTimeout(() => resolve({}), 35000)
        chromeApi.runtime!.sendMessage!(storedExtId, { action: 'SCRAPE_USER_PROFILE', linkedinUrl: url }, (resp: unknown) => {
          clearTimeout(timer); resolve((resp as { success?: boolean; profile?: ScrapedProfile }) || {})
        })
      })

      if (response?.success && response?.profile?.name) return response.profile

      // Fallback: extension stored profile to server — poll until it arrives (up to 30s)
      console.log('[Onboarding] Extension callback returned no profile, polling server...')
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(r => setTimeout(r, 3000))
        try {
          const res = await fetch('/api/user/profile')
          const data = await res.json()
          console.log(`[Onboarding] Poll attempt ${attempt + 1}: linkedin_experience=${data.profile?.linkedin_experience?.length || 0}, headline=${!!data.profile?.linkedin_headline}`)
          if (data.profile?.linkedin_experience?.length > 0 || data.profile?.linkedin_headline) {
            console.log('[Onboarding] Got profile from server fallback')
            return {
              name: data.profile.name,
              headline: data.profile.linkedin_headline,
              company: data.profile.linkedin_experience?.[0]?.company || null,
              role: data.profile.linkedin_experience?.[0]?.title || null,
              location: data.profile.location,
              about: undefined,
              experience: data.profile.linkedin_experience?.map((e: { company: string; title: string; duration: string }) => ({ company: e.company, role: e.title, duration: e.duration })) || [],
              education: [],
            }
          }
        } catch {}
      }
      console.warn('[Onboarding] Profile polling timed out after 30s')

      return null
    } catch { return null }
  }

  async function handleStep1Next() {
    if (!linkedinUrl && !resumeFile) { setError('Please provide your LinkedIn URL or upload a resume'); return }
    if (linkedinUrl && !/linkedin\.com\/in\//i.test(linkedinUrl)) { setError('Please enter a valid LinkedIn profile URL'); return }
    setError(null); setAnalyzing(true)
    let profile: ScrapedProfile | null = null
    let parsedResumeText: string | null = null
    if (linkedinUrl) {
      setAnalyzeStatus('Scraping your LinkedIn profile...')
      await fetch('/api/user/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkedin_url: linkedinUrl }) })
      profile = await scrapeLinkedInViaExtension(linkedinUrl)
      setScrapedProfile(profile)
    }
    if (resumeFile) {
      setAnalyzeStatus('Reading your resume...')
      const formData = new FormData(); formData.append('resume', resumeFile)
      try { const res = await fetch('/api/user/resume', { method: 'POST', body: formData }); const data = await res.json(); if (res.ok) parsedResumeText = data.resumeText || null } catch {}
      setResumeText(parsedResumeText)
    }
    setAnalyzeStatus('Analyzing your experience...')

    // If LinkedIn scrape returned nothing, try to build a profile from server data
    if (!profile && linkedinUrl) {
      console.log('[Onboarding] Scrape returned null, fetching server profile as fallback...')
      try {
        const srvRes = await fetch('/api/user/profile')
        const srvData = await srvRes.json()
        const sp = srvData.profile
        if (sp?.linkedin_headline || sp?.linkedin_experience?.length > 0) {
          profile = {
            name: sp.name,
            headline: sp.linkedin_headline,
            company: sp.linkedin_experience?.[0]?.company || null,
            role: sp.linkedin_experience?.[0]?.title || null,
            location: sp.location,
            about: undefined,
            experience: sp.linkedin_experience?.map((e: { company: string; title: string; duration: string }) => ({ company: e.company, role: e.title, duration: e.duration })) || [],
            education: [],
          }
          setScrapedProfile(profile)
          console.log('[Onboarding] Got profile from server fallback:', { name: profile.name, headline: profile.headline })
        }
      } catch {}
    }

    console.log('[Onboarding] Calling extract-preferences with:', { hasProfile: !!profile, profileName: profile?.name, hasResume: !!parsedResumeText })
    try {
      const res = await fetch('/api/user/extract-preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkedinProfile: profile, resumeText: parsedResumeText }) })
      const data = await res.json()
      console.log('[Onboarding] extract-preferences response:', { ok: res.ok, status: res.status, hasPreferences: !!data.preferences, error: data.error })
      if (res.ok && data.preferences) {
        const p = data.preferences
        console.log('[Onboarding] Pre-filling:', { roles: p.target_roles, seniority: p.seniority, locations: p.target_locations, industries: p.target_industries })
        setTargetRoles(p.target_roles || []); setSeniority(p.seniority || 'mid'); setTargetLocations(p.target_locations || []); setTargetIndustries(p.target_industries || []); setCompanyStages(p.company_stages || [])
        if (p.name) await fetch('/api/user/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: p.name }) })
      } else {
        console.warn('[Onboarding] Preference extraction returned error:', data.error)
      }
    } catch (err) { console.error('[Onboarding] Preference extraction failed:', err) }
    setAnalyzing(false); setAnalyzeStatus(''); setStep(2)
  }

  async function handleStep2Next() {
    if (targetRoles.length === 0) { setError('Select at least one target role'); return }
    if (!seniority) { setError('Select your seniority level'); return }
    setError(null)
    await fetch('/api/user/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_roles: targetRoles, seniority, target_locations: targetLocations, target_industries: targetIndustries, company_stages: companyStages }) })
    setStep(3); setGeneratingSummary(true)
    try {
      const res = await fetch('/api/user/generate-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkedinProfile: scrapedProfile, resumeText, preferences: { target_roles: targetRoles, seniority, target_locations: targetLocations, target_industries: targetIndustries, company_stages: companyStages } }) })
      const data = await res.json()
      if (res.ok && data.summary) setSummary(data.summary)
      else console.error('[Onboarding] Summary generation failed:', data.error || res.status)
    } catch (err) { console.error('[Onboarding] Summary generation error:', err) }
    setGeneratingSummary(false)
  }

  async function handleFinish() {
    await fetch('/api/user/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_summary: summary || undefined, onboarding_completed: true }) })
    router.push('/dashboard')
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') { setResumeFile(file); setError(null) } else setError('Please drop a PDF file')
  }, [])

  const displayStep = step + 1

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Left Panel */}
      <div className="hidden lg:flex w-[25%] flex-col justify-between p-8 sticky top-0 h-screen" style={{ background: '#111117', borderRight: '1px solid #1E1E2A' }}>
        <div>
          <div className="flex items-center gap-2.5 mb-10">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: 'linear-gradient(135deg, #A3E635 0%, #84CC16 100%)' }}><Zap size={18} color="#fff" /></div>
            <span className="text-xl font-bold" style={{ color: '#FFFFFF' }}>Jobseek</span>
          </div>
          <h2 className="text-[20px] font-bold leading-[1.3] mb-3" style={{ color: '#FFFFFF' }}>Your AI-powered outbound engine for landing the right job.</h2>
          <p className="text-xs leading-relaxed" style={{ color: '#A3E635', opacity: 0.8 }}>Set up in 2 minutes. We handle the research, signals, and outreach.</p>
        </div>
        <div className="mt-8 p-4" style={{ background: '#1A1A24', border: '1px solid #2A2A3A', borderLeft: '3px solid #22C55E', borderRadius: 14 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>Funding</span>
            <span className="ml-auto text-[11px]" style={{ color: '#6B6B7B' }}>2m ago</span>
          </div>
          <p className="text-[13px] font-semibold mb-0.5" style={{ color: '#FFFFFF' }}>Priya Sundaram</p>
          <p className="text-[11px] mb-2" style={{ color: '#9B9BAB' }}>Co-founder &middot; Arcane AI</p>
          <p className="text-[12px] leading-relaxed rounded-lg px-2.5 py-1.5" style={{ color: '#A3E635', background: 'rgba(163,230,53,0.1)' }}>&ldquo;Congrats on the Series A &mdash; I&apos;d love to be part of what&apos;s next.&rdquo;</p>
        </div>
        <div className="mt-auto">
          <div className="flex gap-1.5 mb-5">
            {[0, 1, 2, 3].map(s => (<div key={s} style={{ height: 4, width: step === s ? 28 : step > s ? 16 : 8, borderRadius: 99, background: step >= s ? '#A3E635' : '#3A3A4A', transition: 'all 300ms ease' }} />))}
          </div>
          <p className="text-[12px]" style={{ color: '#6B6B7B' }}>Used by 500+ job seekers at top companies</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-14 py-12 min-h-screen overflow-y-auto">
        <div className="w-full max-w-lg mx-auto">
          <p className="text-[11px] font-semibold mb-3" style={{ color: '#65A30D', letterSpacing: '0.06em' }}>STEP {displayStep} OF {TOTAL_STEPS}</p>

          {/* ═══ Step 0: Extension ═══ */}
          {step === 0 && (<>
            <h2 className="text-[26px] font-bold mb-2" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Install the Jobseek extension</h2>
            <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>Jobseek uses a Chrome extension to scan your LinkedIn feed for hiring signals and scrape your profile. Install it to get started.</p>

            <div className="rounded-[var(--radius-lg)] p-5 mb-6" style={{ background: 'var(--color-surface)', border: `1px solid ${extStatus === 'found' ? 'var(--color-success)' : '#D4D4CC'}` }}>
              {extStatus === 'checking' && (
                <div className="flex items-center gap-3">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-lime)' }} />
                  <div><p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Checking for extension...</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Looking for the Jobseek extension in your browser</p></div>
                </div>
              )}
              {extStatus === 'found' && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--color-success-subtle)' }}><CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} /></div>
                  <div className="flex-1"><p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>Extension connected!</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>v{extVersion || '1.0'} &middot; Device: {extDeviceToken?.slice(0, 8)}...</p></div>
                </div>
              )}
              {extStatus === 'not_found' && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--color-warning-subtle)' }}><AlertCircle size={20} style={{ color: 'var(--color-warning)' }} /></div>
                    <div><p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Extension not detected</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Install from Chrome Web Store, then click &ldquo;Check again&rdquo;</p></div>
                  </div>
                  <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full rounded-[var(--radius-md)] py-3 text-sm font-semibold transition-all hover:brightness-110 cursor-pointer mb-3" style={{ background: 'var(--color-surface)', border: '1px solid #D4D4CC', color: 'var(--color-text-primary)' }}><Chrome size={16} /> Install from Chrome Web Store <ExternalLink size={12} /></a>
                  <div className="rounded-[var(--radius-md)] p-3 mt-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid #E8E8E3' }}>
                    <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Troubleshooting</p>
                    <ul className="space-y-1.5 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      <li>1. Make sure you&apos;re using <strong>Google Chrome</strong></li>
                      <li>2. After installing, <strong>refresh this page</strong> and click &ldquo;Check again&rdquo;</li>
                      <li>3. Check <code style={{ background: '#E8E8E3', padding: '1px 4px', borderRadius: 4 }}>chrome://extensions</code> &mdash; the extension should be enabled</li>
                      <li>4. For unpacked extensions, get the ID from Service Worker console (<code style={{ background: '#E8E8E3', padding: '1px 4px', borderRadius: 4 }}>chrome.runtime.id</code>) and paste below:</li>
                    </ul>
                    <div className="flex gap-2 mt-2">
                      <input type="text" placeholder="Paste extension ID here" className="input-base flex-1 text-xs" onChange={e => { const id = e.target.value.trim(); if (id.length > 20) localStorage.setItem('jobseek_extension_id', id) }} />
                      <button onClick={checkExtension} className="cursor-pointer rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium transition-all hover:brightness-110" style={{ background: 'var(--color-lime-subtle)', color: 'var(--color-lime-text)', border: '1px solid var(--color-lime-border)' }}>Check</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>)}

          {/* ═══ Step 1: LinkedIn ═══ */}
          {step === 1 && (<>
            <h2 className="text-[26px] font-bold mb-2" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Tell us about yourself</h2>
            <p className="text-sm mb-9 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>Share your LinkedIn and we&apos;ll auto-fill everything. Resume is optional but helps generate better outreach.</p>
            <div className="space-y-6">
              <div><p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>LinkedIn Profile URL</p><input type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/your-profile" className="input-base" /></div>
              <div>
                <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Resume <span>(optional)</span></p>
                <div onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} className="cursor-pointer rounded-[var(--radius-lg)] p-6 text-center transition-all hover:brightness-105" style={{ background: dragOver ? 'var(--color-lime-subtle)' : 'var(--color-surface)', border: `2px dashed ${dragOver ? 'var(--color-lime)' : resumeFile ? 'var(--color-success)' : '#D4D4CC'}` }} onClick={() => document.getElementById('resume-input')?.click()}>
                  <input id="resume-input" type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setResumeFile(f); setError(null) } }} />
                  {resumeFile ? (<div><CheckCircle2 size={24} className="mx-auto mb-1" style={{ color: 'var(--color-success)' }} /><p className="font-medium text-xs" style={{ color: 'var(--color-text-primary)' }}>{resumeFile.name}</p></div>) : (<div><Upload size={20} className="mx-auto mb-1" style={{ color: 'var(--color-text-tertiary)' }} /><p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>Drop resume or click to browse</p><p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>PDF only &middot; Max 5MB</p></div>)}
                </div>
              </div>
            </div>
          </>)}

          {/* ═══ Step 2: Preferences ═══ */}
          {step === 2 && (<>
            <h2 className="text-[26px] font-bold mb-2" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Confirm your preferences</h2>
            <p className="text-sm mb-9 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>We&apos;ve pre-filled these based on your profile. Edit anything that doesn&apos;t look right.</p>
            <div className="space-y-7">
              <div><p className="text-[11px] font-semibold mb-3" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Target Roles <span>(select all that apply)</span></p><MultiSelectChips options={TARGET_ROLES} selected={targetRoles} onChange={setTargetRoles} /></div>
              <div><p className="text-[11px] font-semibold mb-3" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>What level are you targeting?</p><SenioritySelector selected={seniority} onChange={setSeniority} /></div>
              <div><p className="text-[11px] font-semibold mb-3" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Location Preferences</p><MultiSelectChips options={TARGET_LOCATIONS} selected={targetLocations} onChange={setTargetLocations} /></div>
              <div><p className="text-[11px] font-semibold mb-3" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Industries</p><MultiSelectChips options={TARGET_INDUSTRIES} selected={targetIndustries} onChange={setTargetIndustries} /></div>
              <div><p className="text-[11px] font-semibold mb-3" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Company Stage <span>(optional)</span></p><MultiSelectChips options={COMPANY_STAGES} selected={companyStages} onChange={setCompanyStages} /></div>
            </div>
          </>)}

          {/* ═══ Step 3: Summary ═══ */}
          {step === 3 && (<>
            <h2 className="text-[26px] font-bold mb-2" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Your profile is ready</h2>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>This summary powers every outreach message. Edit it until it sounds like you.</p>
            <div className="rounded-[var(--radius-lg)] p-3 mb-4" style={{ background: 'var(--color-surface)', border: '1px solid #D4D4CC' }}>
              <div className="flex flex-wrap gap-1.5">
                {targetRoles.map(r => (<span key={r} className="rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--color-lime-subtle)', color: 'var(--color-lime-text)' }}>{r}</span>))}
                {seniority && (<span className="rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)' }}>{SENIORITY_OPTIONS.find(o => o.id === seniority)?.label || seniority}</span>)}
                {targetLocations.map(l => (<span key={l} className="rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}>{l}</span>))}
              </div>
            </div>
            {generatingSummary ? (
              <div className="flex items-center justify-center gap-3 py-16 rounded-[var(--radius-lg)]" style={{ background: 'var(--color-surface)', border: '1px solid #D4D4CC' }}><Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-lime)' }} /><span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Generating your professional summary...</span></div>
            ) : (<>
              <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={7} placeholder="Your professional summary will appear here..." className="input-base resize-none leading-relaxed" />
              <p className="mt-1 text-xs text-right" style={{ color: 'var(--color-text-tertiary)' }}>{summary.length} chars &middot; You can edit this anytime from Profile</p>
            </>)}
          </>)}

          {/* CTA */}
          <div className="mt-10 flex flex-col gap-3">
            {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
            {step === 0 ? (<>
              {extStatus === 'found' ? (
                <button onClick={() => setStep(1)} className="btn-primary w-full py-3.5 text-[15px]"><span className="flex items-center justify-center gap-2"><CheckCircle2 size={16} /> Continue to setup &rarr;</span></button>
              ) : (
                <button onClick={checkExtension} disabled={checking} className="btn-primary w-full py-3.5 text-[15px]">{checking ? (<span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Checking...</span>) : (<span className="flex items-center justify-center gap-2"><RefreshCw size={16} /> Check again</span>)}</button>
              )}
              <button onClick={() => setStep(1)} className="cursor-pointer text-center text-[12px] py-2 transition-opacity hover:opacity-70" style={{ color: 'var(--color-text-tertiary)', background: 'none', border: 'none' }}>Skip for now &mdash; I&apos;ll install it later</button>
            </>) : (<>
              <button onClick={step === 1 ? handleStep1Next : step === 2 ? handleStep2Next : handleFinish} disabled={analyzing || generatingSummary} className="btn-primary w-full py-3.5 text-[15px]">
                {analyzing ? (<span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />{analyzeStatus || 'Analyzing...'}</span>) : step === 1 ? (<span className="flex items-center justify-center gap-2"><Sparkles size={16} /> Analyze my profile</span>) : step === 2 ? 'Generate my summary \u2192' : 'Launch Jobseek \u2192'}
              </button>
              {step === 1 && <p className="text-center text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>Provide at least one &mdash; LinkedIn URL or resume</p>}
              {step > 0 && (<button onClick={() => setStep(step - 1)} className="cursor-pointer flex items-center justify-center gap-1 text-[13px] py-2 transition-opacity hover:opacity-70" style={{ color: 'var(--color-text-tertiary)', background: 'none', border: 'none' }}><ArrowLeft size={14} /> Back</button>)}
            </>)}
          </div>
        </div>
      </div>
    </div>
  )
}
