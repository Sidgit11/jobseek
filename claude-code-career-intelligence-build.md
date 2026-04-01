# Jobseek — Career Intelligence Feature Build
## Claude Code Implementation Spec

> **Objective:** Build three interconnected features that complete Jobseek's outbound loop:
> 1. **Career Intake** — conversational AI interview that deeply understands the candidate
> 2. **Digital Presence** — public profile page + PDF resume auto-generated from intake
> 3. **Engagement Intelligence** — LinkedIn comment opportunities with AI-generated stances
>
> **Build philosophy:** Establish usable, demo-able bones across all three features first. Every phase must work end-to-end before enhancing depth. No dead-end UI.

---

## Codebase Context (read this first)

**Stack:** Next.js 16 App Router, Supabase (auth + DB), Gemini Flash (`@google/generative-ai`), Tailwind CSS, Framer Motion, TypeScript

**Existing relevant files:**
```
src/
  app/
    (app)/
      onboarding/page.tsx        ← existing onboarding (will extend, not replace)
      discover/page.tsx          ← existing search page
      signals/page.tsx           ← existing signals page
      profile/page.tsx           ← existing profile page (extend this)
    (auth)/
      login/page.tsx
    api/
      signals/classify/route.ts  ← Gemini Flash classification (pattern to follow)
      signals/[id]/outreach/route.ts ← outreach generation (reads profile, extend to read CandidateModel)
      companies/search/route.ts  ← company search
  lib/
    supabase/server.ts
    supabase/client.ts
  types/index.ts                 ← add new types here
  components/
    layout/Sidebar.tsx           ← add new nav items here

Design tokens: src/app/globals.css (CSS custom properties — use var(--color-*) everywhere)
Font: Geist Sans (var(--font-geist-sans))
Lime accent: #A3E635 / var(--color-lime)
```

**Gemini pattern used throughout codebase:**
```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
const result = await model.generateContent(prompt)
const text = result.response.text()
```

---

## Database Schema — Run These Migrations First

Create file: `supabase/migrations/002_career_intelligence.sql`

```sql
-- ─────────────────────────────────────────────────
-- CANDIDATE MODEL
-- The structured understanding of a candidate,
-- built from the Career Intake conversation.
-- ─────────────────────────────────────────────────
create table if not exists candidate_models (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references profiles(id) on delete cascade not null unique,

  -- Identity
  headline            text,           -- "Senior PM · B2B SaaS · 6 yrs"
  positioning         text,           -- their "unfair advantage" one-liner
  bio_short           text,           -- 2-sentence outreach bio
  bio_long            text,           -- full about section for profile page
  location            text,

  -- Structured experience
  work_experiences    jsonb default '[]'::jsonb,
  projects            jsonb default '[]'::jsonb,
  education           jsonb default '[]'::jsonb,
  writing_links       jsonb default '[]'::jsonb,

  -- Matching signals
  skill_tags          text[] default '{}',
  domain_expertise    text[] default '{}',
  stage_fit           text[] default '{}',   -- ["series-a","series-b"]
  target_roles        text[] default '{}',
  hard_nos            text[] default '{}',
  preferred_culture   text[] default '{}',

  -- Derived outputs (auto-generated after intake)
  linkedin_headline   text,
  resume_bullets      jsonb default '[]'::jsonb,
  unique_pov          text,           -- their distinctive perspective on their domain

  -- Intake state
  intake_phase        int default 0,           -- 0=not started, 1-5=in progress, 6=complete
  completeness_score  int default 0,           -- 0-100
  conversation_id     uuid,                    -- fk to intake_conversations
  last_updated        timestamptz default now(),
  created_at          timestamptz default now()
);

alter table candidate_models enable row level security;
create policy "Users manage own model" on candidate_models
  for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────
-- INTAKE CONVERSATIONS
-- Full transcript of the career interview.
-- ─────────────────────────────────────────────────
create table if not exists intake_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade not null,
  messages    jsonb default '[]'::jsonb,  -- [{role, content, timestamp}]
  phase       int default 1,
  is_complete boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table intake_conversations enable row level security;
create policy "Users manage own conversations" on intake_conversations
  for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────
-- PUBLIC PROFILES
-- Controls the public-facing profile page.
-- ─────────────────────────────────────────────────
alter table profiles
  add column if not exists slug             text unique,
  add column if not exists is_profile_public boolean default false,
  add column if not exists profile_theme    text default 'light',
  add column if not exists custom_domain    text,
  add column if not exists twitter_url      text,
  add column if not exists github_url       text,
  add column if not exists website_url      text;

-- Auto-generate slug from name on insert
create or replace function generate_profile_slug()
returns trigger as $$
declare
  base_slug text;
  final_slug text;
  counter int := 0;
begin
  base_slug := lower(regexp_replace(coalesce(new.name, split_part(new.email, '@', 1)), '[^a-z0-9]', '-', 'g'));
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  while exists (select 1 from profiles where slug = final_slug and id != new.id) loop
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  end loop;
  new.slug := final_slug;
  return new;
end;
$$ language plpgsql;

create or replace trigger set_profile_slug
  before insert on profiles
  for each row
  when (new.slug is null)
  execute function generate_profile_slug();

-- ─────────────────────────────────────────────────
-- ENGAGEMENT OPPORTUNITIES
-- Posts from LinkedIn feed worth commenting on.
-- Populated by Chrome extension, displayed in app.
-- ─────────────────────────────────────────────────
create table if not exists engagement_opportunities (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references profiles(id) on delete cascade not null,
  post_id             text not null,                    -- LinkedIn post ID (dedup key)
  author_name         text,
  author_title        text,
  author_company      text,
  author_linkedin_url text,
  post_text           text,
  post_url            text,
  engagement_score    int default 0,                   -- 0-100
  score_reasons       text[] default '{}',             -- why it scored high
  suggested_angle     text,                            -- "Disagree with premise on X"
  generated_comment   text,                            -- populated on demand
  status              text default 'pending',          -- pending|commented|skipped
  captured_at         timestamptz default now(),
  created_at          timestamptz default now()
);

create unique index on engagement_opportunities(user_id, post_id);
alter table engagement_opportunities enable row level security;
create policy "Users manage own opportunities" on engagement_opportunities
  for all using (auth.uid() = user_id);
```

---

## Phase 1 — The Bones (build in this order)

> Every item in Phase 1 must work end-to-end before moving to Phase 2.
> The goal: a full demo flow showing intake → profile → engagement queue.

### 1A. Types

Add to `src/types/index.ts`:

```ts
export interface WorkExperience {
  id: string
  company: string
  title: string
  start_date: string
  end_date: string     // "Present" or ISO date
  description: string
  highlights: string[] // quantified bullet points
  skills: string[]
}

export interface Project {
  id: string
  title: string
  description: string
  url?: string
  metrics?: string     // "3M users, $2M ARR"
  tags: string[]
}

export interface CandidateModel {
  id: string
  user_id: string
  headline: string | null
  positioning: string | null
  bio_short: string | null
  bio_long: string | null
  location: string | null
  work_experiences: WorkExperience[]
  projects: Project[]
  education: Array<{ school: string; degree: string; year: string }>
  writing_links: Array<{ title: string; url: string }>
  skill_tags: string[]
  domain_expertise: string[]
  stage_fit: string[]
  target_roles: string[]
  hard_nos: string[]
  preferred_culture: string[]
  linkedin_headline: string | null
  resume_bullets: Array<{ company: string; title: string; bullets: string[] }>
  unique_pov: string | null
  intake_phase: number
  completeness_score: number
  conversation_id: string | null
  last_updated: string
  created_at: string
}

export interface IntakeMessage {
  role: 'assistant' | 'user'
  content: string
  timestamp: string
  extracted_facts?: string[]  // shown in live extraction panel
}

export interface EngagementOpportunity {
  id: string
  user_id: string
  post_id: string
  author_name: string | null
  author_title: string | null
  author_company: string | null
  author_linkedin_url: string | null
  post_text: string
  post_url: string | null
  engagement_score: number
  score_reasons: string[]
  suggested_angle: string | null
  generated_comment: string | null
  status: 'pending' | 'commented' | 'skipped'
  captured_at: string
}
```

---

### 1B. Career Intake — Backend

**File: `src/app/api/intake/chat/route.ts`**

This is the core endpoint. Handles one conversational turn: receives message history + user message, returns next AI question + extracted facts.

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

// ─────────────────────────────────────────────────────────────────────────────
// RECRUITER SYSTEM PROMPT
// This prompt is the product. Spend time getting it right.
// ─────────────────────────────────────────────────────────────────────────────
function buildRecruiterPrompt(phase: number, partialModel: Record<string, unknown>): string {
  return `You are a sharp, senior talent partner at a top-tier VC firm. Your job is to deeply understand a candidate in a natural 10-minute conversation — not fill a form.

PHASE STRUCTURE (you are currently in Phase ${phase}):
Phase 1 — Orientation: understand who they are and what they want next
Phase 2 — Best Work: extract 2 specific impact stories with metrics
Phase 3 — The How: understand their working style and unique POV
Phase 4 — Constraints: what they will NOT do (as important as what they want)
Phase 5 — The Hook: help them articulate their unfair advantage

RULES (follow these strictly):
- Ask EXACTLY ONE question per turn. Never ask two questions.
- Never ask generic form-like questions ("What are your key skills?", "List your experiences")
- When you get a vague answer, probe for specifics BEFORE moving on
- Required probes for work stories (fire when missing):
  * No metric mentioned → "What number moved? Even a rough estimate."
  * No before/after → "What was it like before you got involved?"
  * No specific contribution → "What was specifically your work vs the team's?"
  * No scale → "How many users or customers did this affect?"
- Move to next phase only when you have enough signal from the current one
- Keep your questions short and conversational. Max 2 sentences.
- NEVER start with affirmations like "Great!", "Awesome!", "That's interesting!"
- Respond warmly but directly. You're a smart colleague, not a chatbot.
- In Phase 5, offer a draft positioning statement based on everything heard

CURRENT CANDIDATE DATA (what you've learned so far):
${JSON.stringify(partialModel, null, 2)}

OUTPUT FORMAT: Respond with ONLY the next question or statement. No preamble, no labels.`
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTION PROMPT
// Silent background call — extracts structured data from conversation
// ─────────────────────────────────────────────────────────────────────────────
const EXTRACTION_PROMPT = `You are a data extraction engine. Extract structured candidate information from the conversation fragment below.

Return ONLY valid JSON matching this exact schema. Merge with existing data — enrich, don't overwrite.
If a field cannot be determined, use null or empty array.

Schema:
{
  "headline": "string | null — e.g. 'Senior PM · B2B SaaS · 6 yrs'",
  "positioning": "string | null — their unfair advantage one-liner",
  "bio_short": "string | null — 2-sentence outreach bio",
  "location": "string | null",
  "work_experiences": [{
    "id": "uuid-style string",
    "company": "string",
    "title": "string",
    "start_date": "string",
    "end_date": "string",
    "description": "string",
    "highlights": ["quantified bullet strings"],
    "skills": ["string"]
  }],
  "projects": [{
    "id": "string",
    "title": "string",
    "description": "string",
    "metrics": "string | null",
    "tags": ["string"]
  }],
  "skill_tags": ["string"],
  "domain_expertise": ["string"],
  "stage_fit": ["seed|series-a|series-b|series-c|growth|enterprise"],
  "target_roles": ["string"],
  "hard_nos": ["string"],
  "unique_pov": "string | null",
  "extracted_facts": ["short human-readable strings for live panel display — max 3, only NEW facts from THIS message"]
}`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, conversationId, phase = 1 } = await request.json()

  // Load or create conversation
  let conversation
  if (conversationId) {
    const { data } = await supabase
      .from('intake_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()
    conversation = data
  }

  if (!conversation) {
    const { data } = await supabase
      .from('intake_conversations')
      .insert({ user_id: user.id, messages: [], phase: 1 })
      .select()
      .single()
    conversation = data
  }

  // Load current candidate model
  const { data: model } = await supabase
    .from('candidate_models')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const partialModel = model ?? {}
  const messages: IntakeMessage[] = conversation.messages ?? []

  // Append user message
  const userMsg: IntakeMessage = { role: 'user', content: message, timestamp: new Date().toISOString() }
  messages.push(userMsg)

  // ── Parallel: AI response + extraction ──────────────────────────────────────
  const conversationHistory = messages
    .map(m => `${m.role === 'assistant' ? 'Recruiter' : 'Candidate'}: ${m.content}`)
    .join('\n')

  const [aiResponse, extractionResult] = await Promise.all([
    // Call 1: Next question (streamed in frontend, but simplify to non-streaming for now)
    genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      .generateContent(buildRecruiterPrompt(phase, partialModel) + '\n\nConversation so far:\n' + conversationHistory),

    // Call 2: Extract structured data from latest message
    genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      .generateContent(
        EXTRACTION_PROMPT + '\n\nExisting model:\n' + JSON.stringify(partialModel, null, 2) +
        '\n\nLatest candidate message:\n' + message +
        '\n\nFull conversation context:\n' + conversationHistory
      )
  ])

  const aiText = aiResponse.response.text().trim()
  let extracted: Record<string, unknown> & { extracted_facts?: string[] } = {}
  try {
    const raw = extractionResult.response.text()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) extracted = JSON.parse(jsonMatch[0])
  } catch { /* extraction failed silently — non-critical */ }

  const extractedFacts: string[] = extracted.extracted_facts ?? []
  delete extracted.extracted_facts

  // Append AI message
  const aiMsg: IntakeMessage = {
    role: 'assistant',
    content: aiText,
    timestamp: new Date().toISOString(),
    extracted_facts: extractedFacts,
  }
  messages.push(aiMsg)

  // Persist conversation
  await supabase.from('intake_conversations')
    .update({ messages, phase, updated_at: new Date().toISOString() })
    .eq('id', conversation.id)

  // Merge extraction into candidate model
  const mergeData: Record<string, unknown> = {
    user_id: user.id,
    intake_phase: phase,
    last_updated: new Date().toISOString(),
    conversation_id: conversation.id,
  }

  // Only overwrite fields that have new data
  const mergeFields = [
    'headline', 'positioning', 'bio_short', 'location', 'unique_pov',
    'skill_tags', 'domain_expertise', 'stage_fit', 'target_roles', 'hard_nos'
  ]
  for (const field of mergeFields) {
    if (extracted[field] !== null && extracted[field] !== undefined) {
      const val = extracted[field]
      // For arrays, merge not replace
      if (Array.isArray(val) && Array.isArray(partialModel[field as keyof typeof partialModel])) {
        const existing = partialModel[field as keyof typeof partialModel] as unknown[]
        mergeData[field] = [...new Set([...existing, ...val as unknown[]])]
      } else if (val) {
        mergeData[field] = val
      }
    }
  }

  // Work experiences: merge by company name
  if (Array.isArray(extracted.work_experiences) && extracted.work_experiences.length > 0) {
    const existing = (partialModel.work_experiences as unknown[] ?? []) as Array<{ company: string }>
    const incoming = extracted.work_experiences as Array<{ company: string }>
    const merged = [...existing]
    for (const exp of incoming) {
      const idx = merged.findIndex(e => e.company?.toLowerCase() === exp.company?.toLowerCase())
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...exp }
      } else {
        merged.push(exp)
      }
    }
    mergeData.work_experiences = merged
  }

  await supabase.from('candidate_models')
    .upsert(mergeData, { onConflict: 'user_id' })

  return NextResponse.json({
    message: aiText,
    conversationId: conversation.id,
    extractedFacts,
    phase,
    model: { ...partialModel, ...mergeData },
  })
}
```

---

**File: `src/app/api/intake/complete/route.ts`**

Called when conversation ends. Generates final derived outputs (linkedin headline, resume bullets, bio).

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: model } = await supabase
    .from('candidate_models')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!model) return NextResponse.json({ error: 'No model found' }, { status: 404 })

  const prompt = `Based on this candidate's profile, generate the following outputs.
Return ONLY valid JSON.

Candidate profile:
${JSON.stringify(model, null, 2)}

Generate:
{
  "linkedin_headline": "Optimised LinkedIn headline — max 220 chars, keyword-rich, specific",
  "bio_short": "2-sentence bio for outreach messages — personal, specific, not generic",
  "bio_long": "4-5 sentence about section for personal website — professional but human",
  "resume_bullets": [
    {
      "company": "string",
      "title": "string",
      "bullets": [
        "Quantified impact bullet — verb + what + metric (e.g. 'Rebuilt activation flow, reducing time-to-first-value 73% (11d→3d) across 50K monthly signups')",
        "Second bullet",
        "Third bullet"
      ]
    }
  ],
  "completeness_score": "integer 0-100 based on how complete the profile is"
}`

  const result = await genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    .generateContent(prompt)

  let outputs: Record<string, unknown> = {}
  try {
    const raw = result.response.text()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) outputs = JSON.parse(jsonMatch[0])
  } catch { /* non-critical */ }

  await supabase.from('candidate_models')
    .update({
      ...outputs,
      intake_phase: 6,
      last_updated: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  // Update profile slug if not set
  const { data: profile } = await supabase
    .from('profiles')
    .select('slug, name')
    .eq('id', user.id)
    .single()

  if (!profile?.slug && profile?.name) {
    const slug = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    await supabase.from('profiles')
      .update({ slug, is_profile_public: true })
      .eq('id', user.id)
  }

  return NextResponse.json({ success: true, outputs })
}
```

---

### 1C. Career Intake — UI

**File: `src/app/(app)/intake/page.tsx`**

```tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Mic, CheckCircle, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Phase labels for the left progress panel
const PHASES = [
  { label: 'Who you are', desc: 'Role + what you want next' },
  { label: 'Your best work', desc: 'Impact stories with metrics' },
  { label: 'How you work', desc: 'Style + unique POV' },
  { label: 'Your constraints', desc: 'What you will not do' },
  { label: 'Your edge', desc: 'Your unfair advantage' },
]

// Opening message — Jobseek speaks first
const OPENING_MESSAGE = {
  role: 'assistant' as const,
  content: "Hey — I'm going to ask you a few questions so Jobseek can actually understand you, not just your job titles. This takes about 10 minutes and replaces every form we'd otherwise make you fill. Ready? Let's start: tell me in a sentence or two — what do you do, and what are you looking for next?",
  timestamp: new Date().toISOString(),
  extracted_facts: [],
}

export default function IntakePage() {
  const router = useRouter()
  const [messages, setMessages] = useState([OPENING_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState(1)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [allFacts, setAllFacts] = useState<string[]>([])
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
        setAllFacts(prev => [...prev, ...data.extractedFacts])
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        extracted_facts: data.extractedFacts ?? [],
      }])

      // Auto-advance phase based on message count (rough heuristic — refine later)
      const userMessages = messages.filter(m => m.role === 'user').length + 1
      if (userMessages >= 4 && phase === 1) setPhase(2)
      else if (userMessages >= 8 && phase === 2) setPhase(3)
      else if (userMessages >= 11 && phase === 3) setPhase(4)
      else if (userMessages >= 13 && phase === 4) setPhase(5)
      else if (userMessages >= 15 && phase === 5) setIsComplete(true)

    } catch (err) {
      console.error(err)
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
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* ── Left: Brand + Progress Panel ────────────────────────────── */}
      <div
        className="hidden lg:flex w-[320px] flex-shrink-0 flex-col justify-between p-10"
        style={{ background: '#111117', borderRight: '1px solid #1E1E2A' }}
      >
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: '#FAFAF8' }}>Jobseek.ai</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest" style={{ color: '#A3E635' }}>
            Career Intelligence
          </p>

          <p className="mt-6 text-sm leading-relaxed" style={{ color: '#6B7280' }}>
            We&apos;re building your career intelligence model. Everything Jobseek does — outreach, matching, presence — runs on what you share here.
          </p>

          {/* Phase progress */}
          <div className="mt-10 space-y-4">
            {PHASES.map((p, i) => {
              const num = i + 1
              const done = num < phase
              const active = num === phase
              return (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all"
                    style={{
                      background: done ? '#A3E635' : active ? 'rgba(163,230,53,0.15)' : 'transparent',
                      border: active ? '1px solid #A3E635' : done ? 'none' : '1px solid #2A2A35',
                      color: done ? '#1A2E05' : active ? '#A3E635' : '#4B5563',
                    }}
                  >
                    {done ? '✓' : num}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: active ? '#F0F0EE' : done ? '#6B7280' : '#374151' }}>
                      {p.label}
                    </p>
                    <p className="text-xs" style={{ color: '#374151' }}>{p.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Live extracted facts */}
        {allFacts.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: '#1A1A23', border: '1px solid #252530' }}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#A3E635' }}>
              ✦ I noted
            </p>
            <div className="space-y-1">
              <AnimatePresence>
                {allFacts.slice(-6).map((fact, i) => (
                  <motion.p
                    key={`${fact}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs leading-relaxed"
                    style={{ color: '#9CA3AF' }}
                  >
                    · {fact}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Conversation ──────────────────────────────────────── */}
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
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all hover:brightness-105 active:scale-[0.97]"
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
    </div>
  )
}
```

---

### 1D. Public Profile Page

**File: `src/app/p/[slug]/page.tsx`**

This is the public-facing profile. No auth required — anyone with the link can view it.

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ExternalLink, MapPin, Linkedin, Twitter, Github } from 'lucide-react'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, slug')
    .eq('slug', params.slug)
    .eq('is_profile_public', true)
    .single()

  if (!profile) return { title: 'Profile not found' }
  return {
    title: `${profile.name} — Jobseek Profile`,
    description: `View ${profile.name}'s professional profile on Jobseek.ai`,
  }
}

export default async function PublicProfilePage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, slug, linkedin_url, twitter_url, github_url, website_url, location')
    .eq('slug', params.slug)
    .eq('is_profile_public', true)
    .single()

  if (!profile) notFound()

  const { data: model } = await supabase
    .from('candidate_models')
    .select('*')
    .eq('user_id', profile.id)
    .single()

  const workExperiences = (model?.work_experiences ?? []) as WorkExperience[]
  const projects = (model?.projects ?? []) as Project[]

  return (
    <div style={{ background: '#F7F7F5', minHeight: '100vh' }}>
      {/* Nav */}
      <div style={{ background: '#111117', borderBottom: '1px solid #1E1E2A', padding: '16px 32px' }}>
        <a href="/" style={{ fontSize: '14px', fontWeight: 800, color: '#FAFAF8', textDecoration: 'none' }}>
          Jobseek.ai
        </a>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>

        {/* Hero */}
        <div style={{ marginBottom: '48px' }}>
          {/* Avatar initials */}
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#A3E635', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 800, color: '#1A2E05', marginBottom: '20px'
          }}>
            {(profile.name ?? 'U')[0].toUpperCase()}
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0F0F0F', margin: '0 0 6px' }}>
            {profile.name}
          </h1>

          {model?.headline && (
            <p style={{ fontSize: '16px', color: '#5A5A65', margin: '0 0 12px' }}>
              {model.headline}
            </p>
          )}

          {profile.location && (
            <p style={{ fontSize: '13px', color: '#9B9BA8', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 16px' }}>
              <MapPin size={12} /> {profile.location}
            </p>
          )}

          {/* Social links */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {profile.linkedin_url && (
              <SocialLink href={profile.linkedin_url} icon={<Linkedin size={13} />} label="LinkedIn" />
            )}
            {profile.twitter_url && (
              <SocialLink href={profile.twitter_url} icon={<Twitter size={13} />} label="Twitter" />
            )}
            {profile.github_url && (
              <SocialLink href={profile.github_url} icon={<Github size={13} />} label="GitHub" />
            )}
            {profile.website_url && (
              <SocialLink href={profile.website_url} icon={<ExternalLink size={13} />} label="Website" />
            )}
          </div>
        </div>

        {/* Positioning */}
        {model?.positioning && (
          <Section title="My Edge">
            <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#3A3A42' }}>
              {model.positioning}
            </p>
          </Section>
        )}

        {/* Bio */}
        {model?.bio_long && (
          <Section title="About">
            <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#3A3A42' }}>
              {model.bio_long}
            </p>
          </Section>
        )}

        {/* Experience */}
        {workExperiences.length > 0 && (
          <Section title="Experience">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {workExperiences.map((exp, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '15px', color: '#0F0F0F', margin: 0 }}>{exp.title}</p>
                      <p style={{ fontSize: '13px', color: '#5A5A65', margin: '2px 0 0' }}>{exp.company}</p>
                    </div>
                    <p style={{ fontSize: '12px', color: '#9B9BA8', whiteSpace: 'nowrap' }}>
                      {exp.start_date} — {exp.end_date}
                    </p>
                  </div>
                  {exp.highlights?.length > 0 && (
                    <ul style={{ margin: '10px 0 0 16px', padding: 0 }}>
                      {exp.highlights.map((h, j) => (
                        <li key={j} style={{ fontSize: '13px', color: '#3A3A42', lineHeight: '1.6', marginBottom: '4px' }}>
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <Section title="Projects">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {projects.map((p, i) => (
                <div key={i} style={{
                  background: '#fff', borderRadius: '12px', padding: '18px',
                  border: '1px solid #E8E8E3', boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}>
                  <p style={{ fontWeight: 700, fontSize: '14px', color: '#0F0F0F', margin: '0 0 6px' }}>
                    {p.url ? <a href={p.url} target="_blank" rel="noreferrer" style={{ color: '#0F0F0F', textDecoration: 'none' }}>{p.title} ↗</a> : p.title}
                  </p>
                  <p style={{ fontSize: '13px', color: '#5A5A65', lineHeight: '1.5', margin: '0 0 10px' }}>
                    {p.description}
                  </p>
                  {p.metrics && (
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#3F6212', background: 'rgba(163,230,53,0.12)', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                      {p.metrics}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Footer CTA */}
        <div style={{ marginTop: '64px', paddingTop: '24px', borderTop: '1px solid #E8E8E3', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#9B9BA8' }}>
            Built with <a href="/" style={{ color: '#84CC16', textDecoration: 'none' }}>Jobseek.ai</a>
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#9B9BA8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function SocialLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '12px', fontWeight: 600, color: '#5A5A65',
        textDecoration: 'none', padding: '5px 10px',
        background: '#fff', border: '1px solid #E8E8E3', borderRadius: '6px'
      }}
    >
      {icon} {label}
    </a>
  )
}
```

---

### 1E. Engagement Queue — API

**File: `src/app/api/engagement/opportunities/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

// GET — fetch opportunities for current user
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('engagement_opportunities')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('engagement_score', { ascending: false })
    .limit(20)

  return NextResponse.json({ opportunities: data ?? [] })
}

// POST — generate comment for an opportunity
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { opportunityId } = await request.json()

  const { data: opp } = await supabase
    .from('engagement_opportunities')
    .select('*')
    .eq('id', opportunityId)
    .eq('user_id', user.id)
    .single()

  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: model } = await supabase
    .from('candidate_models')
    .select('positioning, domain_expertise, unique_pov, skill_tags, bio_short')
    .eq('user_id', user.id)
    .single()

  const prompt = `You are helping a professional write a LinkedIn comment that builds their credibility and starts a conversation.

CANDIDATE BACKGROUND:
${JSON.stringify(model, null, 2)}

POST TO COMMENT ON:
Author: ${opp.author_name} (${opp.author_title} at ${opp.author_company})
Post: "${opp.post_text}"

Suggested angle: ${opp.suggested_angle ?? 'Take a thoughtful stance that showcases expertise'}

RULES FOR THE COMMENT:
- 3-5 sentences max. Dense, not fluffy.
- NEVER start with "Great post", "Insightful", "Fascinating", "This is so true", or any affirmation
- Take a real stance — agree with nuance, add a counter-example, or respectfully disagree
- Reference the candidate's specific background where it adds credibility (not generically)
- Add one specific data point, example, or lived experience
- End with a genuine question that invites a reply
- Sound human, not AI-generated. Avoid corporate/buzzword language.
- Do NOT use: "absolutely", "totally", "100%", "spot on", "leverage", "holistic"

Return ONLY the comment text. No labels, no quotes, no preamble.`

  const result = await genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    .generateContent(prompt)
  const comment = result.response.text().trim()

  await supabase
    .from('engagement_opportunities')
    .update({ generated_comment: comment })
    .eq('id', opportunityId)

  return NextResponse.json({ comment })
}
```

**File: `src/app/api/engagement/score/route.ts`**

Called by Chrome extension to save + score new engagement opportunities.

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Auth via device token (same pattern as signals/classify)
  const authHeader = request.headers.get('Authorization')
  const deviceToken = authHeader?.replace('Bearer ', '')
  if (!deviceToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, target_roles, target_industries')
    .eq('extension_token', deviceToken)
    .single()

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { posts } = await request.json() as {
    posts: Array<{
      post_id: string
      author_name: string
      author_title: string
      author_company: string
      post_text: string
      post_url: string
      reaction_count: number
      is_target_company: boolean
      hours_old: number
    }>
  }

  const scored = posts.map(p => {
    let score = 0
    const reasons: string[] = []

    if (p.is_target_company) { score += 40; reasons.push('Author at target company') }
    if (p.reaction_count > 500) { score += 15; reasons.push(`${p.reaction_count} reactions — high visibility`) }
    else if (p.reaction_count > 200) { score += 8 }
    if (p.hours_old < 6) { score += 15; reasons.push('Posted < 6 hours ago') }
    else if (p.hours_old < 24) { score += 8 }

    // Title signals
    const titleLower = (p.author_title ?? '').toLowerCase()
    if (/\b(vp|chief|cpo|cto|ceo|head of|director)\b/.test(titleLower)) {
      score += 25; reasons.push('Decision-maker level author')
    } else if (/\b(manager|lead|senior|principal|staff)\b/.test(titleLower)) {
      score += 10
    }

    return {
      user_id: profile.id,
      post_id: p.post_id,
      author_name: p.author_name,
      author_title: p.author_title,
      author_company: p.author_company,
      post_text: p.post_text,
      post_url: p.post_url,
      engagement_score: Math.min(score, 100),
      score_reasons: reasons,
      suggested_angle: null, // generated on-demand when user opens the card
    }
  }).filter(p => p.engagement_score >= 40) // only surface high-quality opportunities

  if (scored.length > 0) {
    await supabase
      .from('engagement_opportunities')
      .upsert(scored, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
  }

  return NextResponse.json({ saved: scored.length })
}
```

---

### 1F. Engagement Queue — UI

**File: `src/app/(app)/engage/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, ChevronDown, X } from 'lucide-react'
import type { EngagementOpportunity } from '@/types'

export default function EngagePage() {
  const [opportunities, setOpportunities] = useState<EngagementOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/engagement/opportunities')
      .then(r => r.json())
      .then(d => { setOpportunities(d.opportunities); setLoading(false) })
  }, [])

  async function generateComment(id: string) {
    setGenerating(id)
    setExpanded(id)
    const res = await fetch('/api/engagement/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: id }),
    })
    const { comment } = await res.json()
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, generated_comment: comment } : o))
    setGenerating(null)
  }

  async function dismiss(id: string) {
    setOpportunities(prev => prev.filter(o => o.id !== id))
    await fetch(`/api/engagement/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'skipped' }),
    })
  }

  async function copyComment(id: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '32px 36px' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Warm-Up Queue
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Comment on these posts before reaching out — it makes cold outreach warm.
        </p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      )}

      {!loading && opportunities.length === 0 && (
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
      )}

      <div className="space-y-3 max-w-2xl">
        <AnimatePresence>
          {opportunities.map(opp => (
            <motion.div
              key={opp.id}
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
                  <button onClick={() => dismiss(opp.id)}
                    className="p-1.5 rounded-lg transition-all hover:bg-[var(--color-surface-2)] flex-shrink-0"
                    style={{ color: 'var(--color-text-tertiary)' }}>
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
                  onClick={() => opp.generated_comment ? setExpanded(expanded === opp.id ? null : opp.id) : generateComment(opp.id)}
                  disabled={generating === opp.id}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:brightness-105 active:scale-[0.97] disabled:opacity-60"
                  style={{ background: '#A3E635', color: '#1A2E05' }}
                >
                  {generating === opp.id ? '···' : opp.generated_comment ? (
                    <>{expanded === opp.id ? 'Hide' : 'View'} comment <ChevronDown size={11} /></>
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
                {expanded === opp.id && opp.generated_comment && (
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
                          onClick={() => copyComment(opp.id, opp.generated_comment!)}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-all"
                          style={{ background: '#A3E635', color: '#1A2E05' }}
                        >
                          {copied === opp.id ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                        </button>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-lime-text)' }}>
                        {opp.generated_comment}
                      </p>
                      <p className="mt-2 text-[10px]" style={{ color: '#4D7C0F' }}>
                        Edit before posting. Go to the post on LinkedIn and paste this comment.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
```

---

### 1G. Wire Into Sidebar + Profile

**Update `src/components/layout/Sidebar.tsx`:**

Add these nav items:
```ts
const NAV_ITEMS = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/discover',   icon: Search,          label: 'Discover'  },
  { href: '/signals',    icon: Radio,           label: 'Signals'   },
  { href: '/engage',     icon: MessageSquare,   label: 'Engage'    },  // NEW
  { href: '/pipeline',   icon: Kanban,          label: 'Pipeline'  },
  { href: '/profile',    icon: User,            label: 'Profile'   },
]
```

**Update `src/app/(app)/profile/page.tsx`:**

Add to the profile page:
1. A "Career Profile" section showing `completeness_score` with a progress bar
2. If `intake_phase < 6`, show a prominent CTA card:
   ```
   ┌──────────────────────────────────────────┐
   │  ✦ Build your career model               │
   │  A 10-minute conversation that powers    │
   │  your outreach, resume, and presence.    │
   │  [Start Career Interview →]              │
   └──────────────────────────────────────────┘
   ```
3. If `intake_phase === 6`, show:
   - Their `headline` and `positioning` statement
   - A "Your public profile" link: `jobseek.ai/p/{slug}`
   - "Copy link" button
   - "Download resume PDF" button (Phase 2 — show as coming soon for now)

**Update outreach generation (`src/app/api/signals/[id]/outreach/route.ts`):**

After getting the user profile, also fetch `candidate_models` and include in the Gemini prompt:
```ts
const { data: candidateModel } = await supabase
  .from('candidate_models')
  .select('positioning, bio_short, domain_expertise, unique_pov, skill_tags')
  .eq('user_id', user.id)
  .single()

// Add to prompt:
// Candidate intelligence: ${candidateModel ? JSON.stringify(candidateModel) : 'Not yet built — use profile fields'}
```

---

## Phase 2 — Depth Enhancement

> Build after all Phase 1 bones are working end-to-end.

### 2A. PDF Resume Generation

Install: `npm install @react-pdf/renderer`

**File: `src/app/api/resume/generate/route.ts`**

- Reads `candidate_models` for the user
- Renders a React PDF template with their `work_experiences`, `resume_bullets`, `headline`, `bio_short`
- Returns PDF stream with `Content-Type: application/pdf`
- Three templates controlled by `?template=minimal|modern|technical` query param

**The minimal template structure:**
```
[Name]                                    [Location · Phone · Email]
[LinkedIn URL]                            [jobseek.ai/p/slug]

[Headline]

EXPERIENCE
[Company]                                 [Start – End]
[Title]
• [Quantified bullet from resume_bullets]
• [Bullet 2]

[Repeat for each company]

SKILLS
[skill_tags joined with · ]
```

### 2B. Voice Input

Add to the intake page input area. Use browser Web Speech API — zero cost, zero latency, works in all modern browsers.

```ts
// In IntakePage, add:
const [isListening, setIsListening] = useState(false)
const recognitionRef = useRef<SpeechRecognition | null>(null)

function toggleVoice() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    alert('Voice input not supported in this browser')
    return
  }

  if (isListening) {
    recognitionRef.current?.stop()
    setIsListening(false)
    return
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(r => r[0].transcript)
      .join('')
    setInput(transcript)
  }

  recognition.onend = () => setIsListening(false)
  recognition.start()
  recognitionRef.current = recognition
  setIsListening(true)
}
```

Replace the static mic button with this toggle. Show pulsing animation when `isListening`.

### 2C. LinkedIn Profile Optimisation

**File: `src/app/api/intake/linkedin-optimize/route.ts`**

- Reads `candidate_models` for the user
- Generates: optimised headline, optimised about section, 3 specific improvement suggestions
- Returns structured JSON
- Surface on the profile page under "LinkedIn Optimization"

### 2D. Completeness Score + Nudges

Calculate `completeness_score` as:
- Has headline: +15
- Has positioning: +20
- Has ≥1 work experience with ≥2 bullets: +25
- Has ≥1 project: +15
- Has target_roles set: +10
- Has hard_nos set: +10
- Has unique_pov: +5

Show on profile page as a progress bar. If score < 80, show specific nudges:
- "Tell me about a project you built" → CTA to continue intake
- "What are you NOT looking for?" → CTA to Phase 4

---

## Phase 3 — Polish

> Build after Phase 2 is stable.

### 3A. Follow-up Conversations

Allow users to do a follow-up intake session to add more experience:
- Button on profile: "Add more experience"
- Resumes intake at Phase 2 with context from existing model
- System prompt includes existing model so AI knows what's already been captured

### 3B. Engagement Tracking

When a user copies a comment and then marks it as posted:
- Record `commented_at` timestamp on `engagement_opportunities`
- Show "7 comments posted this week" stat on engage page
- Track which company the author was from → if user later gets outreach reply from that company, surface as correlation

### 3C. Custom Domain for Profile

- Add `custom_domain` field to profiles (already in schema)
- Set up Vercel wildcard domain: `*.profiles.jobseek.ai`
- In `next.config.js`, configure domain routing
- User sets a CNAME record pointing their domain to `cname.jobseek.ai`
- Simple settings UI in profile page

---

## Routing Summary

Add these routes to the app:

| Route | File | Auth | Notes |
|---|---|---|---|
| `/intake` | `(app)/intake/page.tsx` | Required | Career interview — no sidebar, full-screen |
| `/engage` | `(app)/engage/page.tsx` | Required | Engagement queue |
| `/p/[slug]` | `p/[slug]/page.tsx` | None | Public profile page |
| `POST /api/intake/chat` | `api/intake/chat/route.ts` | Required | Conversation turn |
| `POST /api/intake/complete` | `api/intake/complete/route.ts` | Required | Finalise model |
| `GET/POST /api/engagement/opportunities` | `api/engagement/opportunities/route.ts` | Required | Fetch + generate comment |
| `POST /api/engagement/score` | `api/engagement/score/route.ts` | Token | Chrome extension → score + save |
| `GET /api/resume/generate` | `api/resume/generate/route.ts` | Required | PDF stream (Phase 2) |

---

## Chrome Extension Updates

Add to `background.js` — after signal classification, score posts for engagement:

```js
// After classifying signals, also save high-value posts as engagement opportunities
async function submitEngagementOpportunities(posts, token) {
  const candidates = posts
    .filter(p => p.authorTitle && p.body.length > 80)
    .map(p => ({
      post_id: p.id,
      author_name: p.authorName,
      author_title: p.authorTitle,
      author_company: p.authorCompany,
      post_text: p.body.slice(0, 800),
      post_url: p.url ?? null,
      reaction_count: p.reactionCount ?? 0,
      is_target_company: false, // will be scored server-side
      hours_old: p.hoursOld ?? 24,
    }))

  if (candidates.length === 0) return

  await fetch(`${JOBSEEK_BASE_URL}/api/engagement/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ posts: candidates }),
  })
}
```

Call this in the same batch loop as signal classification.

---

## Environment Variables

No new keys required. All features use existing:
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini Flash for conversation, extraction, comment generation
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — data storage
- `NEXT_PUBLIC_APP_URL` — for profile link generation (`process.env.NEXT_PUBLIC_APP_URL + '/p/' + slug`)

---

## Demo Flow (for testing Phase 1 completion)

1. Log in → land on dashboard
2. Click "Profile" → see intake CTA → click "Start Career Interview"
3. Have a 5-message conversation with the AI interviewer
4. Observe live fact extraction on the left panel updating in real-time
5. After ~10 exchanges, complete button appears → click it
6. Redirected to profile page showing: headline, positioning, experience bullets
7. "Your public profile" link → open `jobseek.ai/p/{slug}` in new tab → see the public page
8. Go to Engage tab → see engagement opportunities captured from LinkedIn feed
9. Click "Generate comment" on one → see AI-generated comment
10. Go to Discover → run a search → outreach now uses CandidateModel context
