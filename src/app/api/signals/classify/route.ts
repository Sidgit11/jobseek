import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/google/client'
import { routeLogger } from '@/lib/logger'
import { getCorsHeaders } from '@/lib/cors'

const log = routeLogger('signals/classify')

// Handle preflight — Chrome extension fetch triggers an OPTIONS request first
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin')) })
}

// Default profile used when no user profile is provided (backward compat)
const DEFAULT_USER_PROFILE = {
  target_roles: ['Product Manager'],
  seniority: 'Senior',
  target_locations: ['India', 'United States', 'Europe', 'Remote'],
  target_industries: ['AI / ML', 'SaaS', 'Fintech', 'Consumer', 'HealthTech'],
}

interface UserProfile {
  target_roles?: string[]
  seniority?: string
  target_locations?: string[]
  target_industries?: string[]
  company_stages?: string[]
}

function buildUserProfileSection(profile: UserProfile): string {
  const roles = profile.target_roles?.length ? profile.target_roles.join(', ') : 'Any'
  const seniority = profile.seniority || 'Any level'
  const locations = profile.target_locations?.length ? profile.target_locations.join(', ') : 'Any'
  const industries = profile.target_industries?.length ? profile.target_industries.join(', ') : 'Any'

  // Build a list of roles the user is NOT interested in (everything not in their target)
  const allRoles = ['Product Manager', 'Software Engineer', 'Designer', 'Data Scientist', 'Growth', 'GTM / Sales', 'Marketing', 'Operations']
  const notInterested = allRoles.filter(r => !profile.target_roles?.includes(r))

  return `USER PROFILE (use this to filter for relevance):
- Target roles: ${roles}
- Seniority: ${seniority} level
- Location preference: ${locations}. ${profile.target_locations?.includes('Remote') ? 'Remote roles are HIGH PRIORITY.' : ''}
- Industries of interest: ${industries}
- NOT interested in: ${notInterested.length > 0 ? notInterested.join(', ') + ' roles' : 'No exclusions'}`
}

function buildSystemPrompt(userProfile?: UserProfile): string {
  const profile = userProfile && Object.keys(userProfile).length > 0 ? userProfile : DEFAULT_USER_PROFILE
  const profileSection = buildUserProfileSection(profile)

  return `You are a signal classifier for Jobseek — an AI-powered job-seeking assistant. You receive a batch of LinkedIn posts scraped from a job seeker's feed, notifications, and jobs pages. Your job is to identify which posts represent genuine, concrete opportunities for them to reach out and start a hiring conversation.

${profileSection}

INPUT SOURCES:
- source: "FEED" — posts from LinkedIn home feed
- source: "FEED_JOBS_WIDGET" — job listings from the "Jobs recommended for you" widget shown inside the feed
- source: "NOTIFICATIONS" — items from LinkedIn notifications page (profile views, connection activity, mentions)
- source: "NOTIFICATION_JOB_ALERT" — job alert notifications from company pages (e.g. "Airbnb has new opportunities in India"). The author is the COMPANY name.
- source: "JOBS" — job listings scraped from LinkedIn jobs page

SIGNAL TYPES (classify into one of these, or null):

TIER 1 — Direct hiring signals (highest priority, act NOW):
- JOB_CHANGE: Person EXPLICITLY announced starting a new role, joining a company, or beginning a new position. Must contain clear language like "excited to share", "I've joined", "starting a new chapter", "new role". Their old company may be backfilling, their new company is in growth mode.
- HIRING_POST: Company or person is ACTIVELY and EXPLICITLY hiring for a SPECIFIC role that matches the user's profile. Must contain a concrete job title. For source=JOBS or source=FEED_JOBS_WIDGET or source=NOTIFICATION_JOB_ALERT, only classify as signal if the role is RELEVANT to the user (product management, product leadership). Reject engineering, design, sales, HR, or other unrelated roles.
- FUNDING_SIGNAL: Company raised funding (any stage) with SPECIFIC numbers or investor names mentioned. "We raised $X from Y" is a signal. Vague "exciting news" is not.

TIER 2 — Context signals (be VERY strict — only classify if clearly actionable):
- DECISION_MAKER_ACTIVE: A clearly senior person (C-suite, VP, Director, Founder — NOT regular employees) posted about a SPECIFIC company initiative: product launch, team expansion, technical challenge, growth numbers. ALL of these must be true: (a) poster is clearly C-level/VP/Director/Founder by title, (b) post is about THEIR company specifically (not industry commentary), (c) there is a concrete hook for outreach (not just "interesting thoughts").
- COMPANY_MILESTONE: Company hit a PUBLIC, VERIFIABLE milestone with SPECIFIC numbers or facts — product launch with a name, customer count milestone, revenue number, major award, acquisition. Generic "we're doing great things" is NOT a milestone.

NOT A SIGNAL (return null) — be aggressive about filtering these:
- Job listings for roles outside the user's target (engineering, design, sales, HR, ops, etc.) — return null even if from source=JOBS
- Generic opinions, career advice, motivational content, thought leadership
- Personal life posts (travel, family, hobbies, celebrations)
- A connection merely reacting to or sharing someone else's post (warm paths have low signal value)
- Posts from 3rd-degree connections with no relationship bridge
- Vague "we're growing" or "exciting things coming" with no specifics
- Anything where there's no clear, specific reason to reach out right now
- Generic industry commentary even from senior people
- "Congratulations" threads or celebration posts unless announcing something specific
- Posts that are just promoting content (articles, podcasts, webinars) without a hiring/growth signal

COMPANY NAME VALIDATION (critical — check this for every signal you return):
The "author" field for job-source posts (JOBS, FEED_JOBS_WIDGET) should be a real company name. If the author field contains any of these, it's a scraping error — still classify the signal but note the issue in your reasoning:
- A job title (e.g. "Product Manager", "Senior Engineer", "AI PM") — NOT a company
- A person's name (e.g. "Shweta V.", "Prashant Tiwari") — NOT a company for job listings
- Generic words ("hiring", "notification", "with verification") — NOT a company
If the author is clearly wrong but you can extract the real company from the body text, use that in your reasoning.

For each post, return a JSON object with these fields. If not a signal, return null.

Response format (strict JSON array, one entry per post, in same order as input):
[
  {
    "isSignal": true,
    "type": "HIRING_POST",
    "tier": 1,
    "confidence": 90,
    "reasoning": "Revolut is hiring a Product Strategy Manager in India — matches user's target role and location",
    "outreachHook": "Saw the Product Strategy Manager opening at Revolut — I'd love to learn more about the team and scope",
    "companyName": "Revolut"
  },
  null,
  ...
]

Rules:
- Return EXACTLY as many entries as there are input posts, in the same order
- If not a signal, the entry must be null (not an object with isSignal: false)
- confidence is 0–100 — how certain you are this is actionable AND relevant to the user's profile. Reserve 90+ for perfect role+location matches. Drop confidence for tangential roles or locations.
- outreachHook is a single natural sentence the user could use to open a conversation — NOT a full message, just the opener
- companyName: the REAL company name extracted from the post. For job listings, this is the hiring company (NOT the job title, NOT a person's name). If you can't determine the company, set to null.
- Be VERY conservative: 5 high-quality, relevant signals are worth more than 20 mediocre ones
- Never classify a post as a signal unless you'd genuinely advise THIS specific user (senior PM) to reach out based on it
- When in doubt, return null — a missed signal is better than a false positive
- IMPORTANT: Do NOT use "WARM_PATH_OPENED" as a type — it has been removed. Someone reacting to a post is NOT a signal.`
}

interface RawPost {
  _id: string
  author: string
  title: string
  degree: string
  reactor: string | null
  isReactedPost: boolean
  body: string
  timeStr: string
  timeMinutes: number
  source: string
  postUrl?: string | null
  authorLinkedInUrl?: string | null
  reactorLinkedInUrl?: string | null
}

interface GeminiClassification {
  isSignal: boolean
  type: string
  tier: number
  confidence: number
  reasoning: string
  outreachHook: string
  companyName?: string | null
}

interface ClassifiedSignal {
  id: string
  type: string
  tier: number
  confidence: number
  author: string
  title: string
  degree: string
  reactor: string | null
  reasoning: string
  outreachHook: string
  preview: string
  timeStr: string
  timeMinutes: number
  source: string
  postUrl: string | null
  authorLinkedInUrl: string | null
  reactorLinkedInUrl: string | null
  companyName: string | null
  detectedAt: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const posts: RawPost[] = body.posts
    const userProfile: UserProfile | undefined = body.userProfile

    if (!posts || posts.length === 0) {
      return NextResponse.json({ signals: [] }, { headers: getCorsHeaders(req.headers.get('origin')) })
    }

    // Hard cap — never send more than 25 posts in one call
    const batch = posts.slice(0, 25)

    // Build the posts payload for Gemini
    const postsPayload = batch.map((p, i) => ({
      index: i,
      author: p.author,
      title: p.title || '(no title)',
      degree: p.degree,
      reactor: p.reactor || null,
      isReactedPost: p.isReactedPost,
      body: p.body,
      timeAgo: p.timeStr,
      source: p.source,
    }))

    const userPrompt = `Posts to classify:\n${JSON.stringify(postsPayload, null, 2)}\n\nReturn a JSON array with exactly ${batch.length} entries (nulls for non-signals):`

    log.req({ postCount: batch.length, sources: [...new Set(batch.map(p => p.source))] })
    postsPayload.forEach(p => {
      log.step('input-post', { index: p.index, author: p.author, degree: p.degree, reactor: p.reactor })
    })
    const systemPrompt = buildSystemPrompt(userProfile)
    const start = Date.now()
    const text = await generateText(systemPrompt, userPrompt, { temperature: 0.2, maxTokens: 4096 })
    log.step('gemini-call', { timing: Date.now() - start })

    // Parse Gemini's JSON response — strip markdown fences if present
    // Gemini sometimes wraps output in ```json ... ``` blocks
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const jsonMatch = stripped.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      log.err('gemini-parse', new Error('Gemini returned non-JSON: ' + text.slice(0, 200)))
      return NextResponse.json({ signals: [] }, { headers: getCorsHeaders(req.headers.get('origin')) })
    }

    const classifications: (GeminiClassification | null)[] = JSON.parse(jsonMatch[0])

    // Log every classification result so we can see exactly what Gemini decided
    classifications.forEach((cls, i) => {
      const post = batch[i]
      if (cls && cls.isSignal) {
        log.step('signal', { index: i, author: post.author, type: cls.type, tier: cls.tier, confidence: cls.confidence, company: cls.companyName || '?' })
      } else {
        log.step('skip', { index: i, author: post.author, degree: post.degree, source: post.source || 'FEED' })
      }
    })

    // Merge classification results with original post metadata
    const signals: ClassifiedSignal[] = []
    classifications.forEach((cls, i) => {
      if (!cls || !cls.isSignal) return
      const post = batch[i]
      signals.push({
        id: post._id,
        type: cls.type,
        tier: cls.tier,
        confidence: cls.confidence,
        author: post.author,
        title: post.title,
        degree: post.degree,
        reactor: post.reactor,
        reasoning: cls.reasoning,
        outreachHook: cls.outreachHook,
        preview: post.body.slice(0, 500),
        timeStr: post.timeStr,
        timeMinutes: post.timeMinutes,
        source: post.source,
        postUrl: post.postUrl ?? null,
        authorLinkedInUrl: post.authorLinkedInUrl ?? null,
        reactorLinkedInUrl: post.reactorLinkedInUrl ?? null,
        companyName: cls.companyName ?? null,
        detectedAt: new Date().toISOString(),
      })
    })

    log.res(200, { posts: batch.length, signals: signals.length })
    return NextResponse.json({ signals }, { headers: getCorsHeaders(req.headers.get('origin')) })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.err('classify', err)

    // Surface quota/billing errors with a 429 so the extension can handle them distinctly
    if (message.includes('429') || message.includes('spending cap') || message.includes('quota')) {
      log.warn('quota-hit', { hint: 'returning empty signals, posts will retry later' })
      return NextResponse.json(
        { signals: [], error: 'quota_exceeded', hint: 'Gemini spending cap reached. Check aistudio.google.com → your project → billing.' },
        { status: 429, headers: getCorsHeaders(req.headers.get('origin')) }
      )
    }

    return NextResponse.json({ error: message }, { status: 500, headers: getCorsHeaders(req.headers.get('origin')) })
  }
}
