# Jobseek.ai — Claude Code MVP Build Plan

> **Execution-ready guide.** Every section maps to a Claude Code session. Copy prompts directly. Build in 4 weeks.

---

## 0. Before You Write One Line of Code

### APIs to set up NOW (get keys before Week 1)

| Service | What You Need | Free Tier | Link |
|---|---|---|---|
| Anthropic | API key | $5 free credit | console.anthropic.com |
| Supabase | Project URL + anon key + service role key | Free tier | supabase.com |
| LinkedIn Developer | Client ID + Client Secret (OAuth app) | Free | linkedin.com/developers |
| Exa | API key | 1000 req/mo free | exa.ai |
| Crunchbase | API key | Basic free | data.crunchbase.com |
| Apollo.io | API key | 50 exports/mo free | apollo.io |
| Vercel | Account (deploy via CLI) | Free tier | vercel.com |

### .env.local you'll need ready

```bash
# Auth
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI & Data
ANTHROPIC_API_KEY=
EXA_API_KEY=
CRUNCHBASE_API_KEY=
APOLLO_API_KEY=

# Email (optional for MVP)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
```

---

## 1. Project Initialization

### Claude Code prompt — session 1

```
Initialize a Next.js 14 project called jobseek with these specs:
- App Router (not pages dir)
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui (install with: npx shadcn-ui@latest init)
- ESLint + Prettier
- src/ directory structure

After init, install these packages:
- @supabase/supabase-js @supabase/auth-helpers-nextjs
- next-auth
- @anthropic-ai/sdk
- pdf-parse @types/pdf-parse
- zod
- @tanstack/react-query
- lucide-react
- date-fns

Then create this folder structure:
src/
  app/
    (auth)/login/
    (app)/discover/
    (app)/pipeline/
    (app)/profile/
    api/
      auth/[...nextauth]/
      companies/search/
      companies/[id]/intelligence/
      people/[companyId]/
      outreach/generate/
      pipeline/
      user/profile/
  components/
    ui/           ← shadcn components
    layout/       ← sidebar, nav
    discovery/    ← search bar, company list, company card
    intelligence/ ← company panel, people list, person card
    outreach/     ← message editor, variants
    pipeline/     ← kanban board, status card
  lib/
    supabase/
    anthropic/
    exa/
    crunchbase/
    apollo/
    utils/
  types/
    index.ts
  hooks/
```

---

## 2. Database Schema (Supabase)

### Claude Code prompt — session 2

```
Create a Supabase migration file at supabase/migrations/001_initial_schema.sql with this exact schema:

-- Users (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users primary key,
  linkedin_id text unique,
  name text,
  headline text,
  location text,
  target_roles text[] default '{}',
  target_industries text[] default '{}',
  resume_text text,
  candidate_summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Companies
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  funding_stage text,
  last_round_date date,
  headcount integer,
  growth_signal text,
  summary text,
  source text,
  created_at timestamptz default now()
);

-- People
create table public.people (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies,
  name text not null,
  title text,
  seniority text,
  linkedin_url text,
  email text,
  outreach_priority_score integer default 0,
  created_at timestamptz default now()
);

-- Outreach Drafts
create table public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles,
  person_id uuid references public.people,
  company_id uuid references public.companies,
  type text check (type in ('linkedin', 'email')),
  body text not null,
  sent_flag boolean default false,
  created_at timestamptz default now()
);

-- Pipeline
create table public.pipeline_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles,
  company_id uuid references public.companies,
  status text check (status in ('saved', 'messaged', 'replied', 'interviewing')) default 'saved',
  updated_at timestamptz default now(),
  unique(user_id, company_id)
);

-- Search Queries (for analytics)
create table public.search_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles,
  raw_query text,
  processed_intent jsonb,
  result_count integer,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.pipeline_entries enable row level security;
alter table public.outreach_drafts enable row level security;
alter table public.search_queries enable row level security;

create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can read own pipeline" on public.pipeline_entries for all using (auth.uid() = user_id);
create policy "Users can manage own outreach" on public.outreach_drafts for all using (auth.uid() = user_id);
create policy "Users can read own queries" on public.search_queries for all using (auth.uid() = user_id);

Then create src/types/index.ts with TypeScript types matching this schema exactly.
```

---

## 3. TypeScript Types

### Claude Code prompt — session 3

```
Create src/types/index.ts with full TypeScript types for the Jobseek data model:

- Profile, Company, Person, OutreachDraft, PipelineEntry, SearchQuery
- SearchResult (company with fit_score and relevance metadata)
- PersonCard (person with outreach_priority_score)
- OutreachVariants { linkedin: string; email: string }
- CompanyIntelligence { company: Company; people: Person[]; fitSummary: string; whyFit: string }
- CandidateContext (subset of Profile used as AI input)
- SearchIntent { industries: string[]; fundingStages: string[]; roles: string[]; geography: string; signals: string[] }
- PipelineStatus: 'saved' | 'messaged' | 'replied' | 'interviewing'

All types should be strict — no `any`. Export everything from this file.
```

---

## 4. Week 1 — Foundation + Auth

### Session 4: LinkedIn OAuth

```
Set up LinkedIn OAuth authentication using NextAuth.js v4:

1. Create src/app/api/auth/[...nextauth]/route.ts
   - LinkedIn provider with profile callback that extracts: id, name, email, headline, location
   - On sign in, upsert to public.profiles table via Supabase service role client
   - Session includes: user.id (Supabase UUID), user.name, user.image

2. Create src/lib/supabase/server.ts — server-side Supabase client (service role)
3. Create src/lib/supabase/client.ts — browser Supabase client (anon key)

4. Create src/app/(auth)/login/page.tsx
   - Clean login page: "Sign in with LinkedIn" button
   - Dark theme, centered card, Jobseek.ai logo/wordmark

5. Create src/middleware.ts
   - Protect all /discover, /pipeline, /profile routes
   - Redirect unauthenticated users to /login
```

### Session 5: Onboarding Flow

```
Build a 3-step onboarding flow at src/app/(app)/onboarding/page.tsx

Step 1 — Target Setup
- Multi-select for target roles: PM, Engineer, Designer, Growth, GTM, Other
- Multi-select for industries: AI/ML, Fintech, SaaS, Consumer, HealthTech, Other
- Text input for preferred geography (optional)

Step 2 — Resume Upload
- File upload (PDF only, max 5MB)
- POST to /api/user/resume which:
  a. Reads PDF with pdf-parse
  b. Stores raw text in profiles.resume_text
  c. Calls Claude to generate candidate_summary (see prompt below)
  d. Returns the generated summary for display
- Claude prompt for candidate_summary:
  "Given this resume text and target role preferences, generate a 150-word professional summary
   optimized for cold outreach. Focus on: unique skills, notable companies/projects,
   career trajectory signal. Make it specific and memorable.
   Resume: {resumeText}. Target roles: {targetRoles}. Target industries: {targetIndustries}"

Step 3 — Summary Review
- Display AI-generated candidate_summary
- Allow inline editing
- "Looks good, start searching" CTA → redirect to /discover

Track onboarding completion in profiles table (add onboarding_completed boolean column).
Skip onboarding if already completed.
```

---

## 5. Week 2 — Discovery + Intelligence

### Session 6: Claude Intent Extraction

```
Create src/lib/anthropic/intent-extraction.ts

Function: extractSearchIntent(rawQuery: string, userProfile: CandidateContext): Promise<SearchIntent>

Claude prompt (use claude-sonnet-4-5):
System: "You are a job search intelligence engine. Extract structured search parameters from a natural language query. Return ONLY valid JSON."

User: "Query: {rawQuery}
User context: {targetRoles}, based in {location}

Extract:
{
  "industries": ["list of relevant industries"],
  "fundingStages": ["seed", "series-a", etc.],
  "roles": ["hiring roles to look for"],
  "geography": "location string or null",
  "signals": ["growth", "hiring", "recent-funding", etc.],
  "companySize": "startup|mid|enterprise|any",
  "keywords": ["key search terms for Exa"]
}"

- Temperature: 0.3
- Use zod to validate the JSON response before returning
- Cache results in search_queries table
```

### Session 7: Company Search Pipeline

```
Create the company search pipeline:

1. src/lib/exa/search.ts
   - Function: searchCompanies(intent: SearchIntent): Promise<ExaResult[]>
   - Use Exa neural search with intent.keywords joined as query
   - Filter to company domains (use category: company if Exa supports it)
   - Return: domain, title, url, snippet, published date

2. src/lib/crunchbase/enrich.ts
   - Function: enrichCompany(domain: string): Promise<Partial<Company>>
   - Crunchbase API call: GET /entities/organizations/{domain}
   - Extract: funding_stage, last_round_date, headcount, investors
   - Handle 404s gracefully (not all companies in Crunchbase)

3. src/app/api/companies/search/route.ts
   - POST handler: { query: string }
   - Pipeline: extractSearchIntent → searchCompanies(Exa) → enrichCompany(Crunchbase) per result
   - Run Crunchbase enrichment in parallel (Promise.allSettled)
   - Score each company: relevance_score = funding_recency_score + headcount_growth + keyword_match
   - Return top 15 companies sorted by relevance_score
   - Save query to search_queries table
```

### Session 8: Company Intelligence Panel

```
Create src/app/api/companies/[id]/intelligence/route.ts

GET handler — returns full intelligence for a company:

1. Fetch company base data from DB (or Crunchbase if not cached)
2. Fetch recent news via Exa: search("{companyName} news hiring product launch 2024")
3. Generate AI summary via Claude:

Prompt: "Given this company data, generate a concise intelligence brief for a job seeker.
Company: {name}, Stage: {fundingStage}, Headcount: {headcount}
Recent news: {newsSnippets}
User target role: {userTargetRole}

Return JSON:
{
  'summary': '3 sentences max. Include stage, what they build, recent momentum.',
  'whyFit': '1 sentence personalised to the user role. Be specific.',
  'hiringSignals': ['signal1', 'signal2'],
  'redFlags': [] // optional
}"

4. Cache the summary in companies.summary (TTL: 24h — check updated_at)
5. Return: company data + news snippets + AI summary + whyFit + hiringSignals

Create src/components/intelligence/CompanyPanel.tsx
- Slide-over panel (use shadcn Sheet component)
- Sections: Funding badge, Summary, Why It Fits (highlighted), Hiring Signals, Key People (loaded separately)
- Sticky "Save to Pipeline" + "Find People" CTAs
```

---

## 6. Week 3 — People + Outreach

### Session 9: Apollo People Enrichment

```
Create src/lib/apollo/people.ts

Function: getPeopleForCompany(domain: string, targetRole: string): Promise<Person[]>

Apollo API: POST https://api.apollo.io/v1/mixed_people/search
Body: {
  "q_organization_domains": [domain],
  "person_titles": ["VP Product", "Head of Engineering", "CTO", "Founder", "CEO", "Director"],
  "per_page": 10
}

Scoring function: calculateOutreachPriority(person, targetRole):
- +30 if title contains target function (PM → Product, Eng → Engineering)
- +20 if seniority is VP/Director/Head
- +20 if seniority is Founder/CEO (direct decision maker)
- +10 if email available
- +10 if LinkedIn URL available
= Max 100 score

Create src/app/api/people/[companyId]/route.ts
- GET handler
- Fetch from Apollo, score, sort by outreach_priority_score desc
- Cache results in people table (TTL: 48h)
- Return top 8 people

Create src/components/intelligence/PeopleList.tsx + PersonCard.tsx
- PersonCard shows: name, title, seniority badge, priority score bar, "Generate Outreach" button
```

### Session 10: Outreach Generation

```
Create src/lib/anthropic/outreach.ts

Function: generateOutreach(person: Person, company: Company, userProfile: CandidateContext): Promise<OutreachVariants>

Two Claude calls (run in parallel via Promise.all):

LINKEDIN PROMPT (temp 0.7, max 280 chars):
"You are writing a LinkedIn connection note for a job seeker reaching out to a potential hiring manager.

Candidate: {candidateSummary}
Target: {personName}, {personTitle} at {companyName}
Company context: {companySummary}
Recent signal: {hiringSignal}

Rules:
- Under 280 characters STRICTLY
- MUST include one specific company detail (not generic)
- No 'I came across your profile' openers
- Conversational, not salesy
- End with a soft ask, not a hard pitch

Output ONLY the message text. No explanation."

EMAIL PROMPT (temp 0.7, 150-200 words):
"Write a cold email from a job seeker to a potential hiring manager.

Candidate: {candidateSummary}
Target: {personName}, {personTitle} at {companyName}
Company context: {companySummary}. Recent: {newsSnippet}

Rules:
- Subject line + body
- 150-200 words STRICTLY
- First line MUST reference something specific about the company (not generic)
- Candidate's strongest relevant credential in sentence 2
- Clear ask: 20-min call to explore fit
- No 'I hope this finds you well'
- No 'I am writing to express my interest'
- Sign off as {candidateName}

Output format:
Subject: [subject line]

[email body]"

Create src/app/api/outreach/generate/route.ts
- POST: { personId, companyId }
- Fetch all context, call generateOutreach
- Save both variants as OutreachDraft records
- Return variants

Create src/components/outreach/OutreachGenerator.tsx
- Two tabs: LinkedIn | Email
- Editable textarea for each variant
- "Copy" button (clipboard API) + "Regenerate" button
- Character count for LinkedIn (warn if > 280)
- "Mark as Sent" button → updates pipeline status
```

---

## 7. Week 4 — Pipeline + Polish

### Session 11: Pipeline Board

```
Create src/app/(app)/pipeline/page.tsx

Kanban board with 4 columns:
- Saved (grey)
- Messaged (blue)
- Replied (amber)
- Interviewing (green)

Each card shows: company name, last activity date, person messaged (if any), days since status change

Create src/app/api/pipeline/route.ts
- GET: returns all pipeline entries for current user, joined with company data
- POST: { companyId, status } → upsert pipeline entry
- PATCH: { entryId, status } → update status

Drag-to-move between columns (use @dnd-kit/core — install it):
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

On card move → PATCH /api/pipeline with new status
```

### Session 12: Discovery UI — Final Assembly

```
Build the complete Discovery page at src/app/(app)/discover/page.tsx

Layout:
- Left sidebar (fixed): nav links (Discover, Pipeline, Profile)
- Main area (flex-1): SearchBar + CompanyList
- Right panel (slide-over): CompanyPanel (opens on card click)

SearchBar component:
- Large text input with placeholder "Try: Series B AI startups hiring PMs in NYC"
- Suggested queries as pills below (clickable):
  "YC companies in fintech" | "Series A SaaS, fast-growing" | "AI infra startups hiring PMs"
- On submit → POST /api/companies/search → update CompanyList

CompanyList component:
- Loading skeleton (3 cards) while fetching
- Each CompanyCard: logo (from domain via clearbit.com/favicon), name, stage badge, headcount, fit_score bar, "Quick save" icon
- Relevance score shown as subtle bar, not a number
- Click → open CompanyPanel slide-over

Empty state: "What kind of company are you excited about? Describe it like you're telling a friend."

Error state: "Search is taking longer than expected. Results may be partial."
```

### Session 13: Polish Pass

```
Final polish pass across the whole app:

1. Loading states: every async operation needs a skeleton or spinner
   - Use Suspense boundaries where possible
   - Add shimmer skeletons for: CompanyList, PeopleList, CompanyPanel

2. Error boundaries: wrap CompanyPanel, PeopleList, OutreachGenerator in error boundaries
   - Friendly error messages, not raw errors

3. Empty states with CTA:
   - No pipeline items → "Save your first company from Discover →"
   - No people found → "Try searching for a slightly larger company"
   - Outreach draft empty → "Select a person to generate outreach"

4. Toast notifications (use shadcn Toast):
   - "Copied to clipboard ✓"
   - "Saved to pipeline ✓"
   - "Status updated ✓"

5. Mobile responsiveness:
   - Sidebar collapses to bottom nav on mobile
   - CompanyPanel becomes full-screen sheet on mobile
   - Pipeline board scrolls horizontally on mobile

6. Add rate limiting to outreach generation:
   - Max 10 outreach drafts per user per day (check count in DB before generating)
   - Show remaining count in UI
```

---

## 8. Deployment

### Session 14: Vercel Deploy

```
Prepare for Vercel deployment:

1. Create vercel.json:
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "env": {
    "NEXTAUTH_URL": "https://your-domain.vercel.app"
  }
}

2. Add all .env.local variables to Vercel dashboard → Settings → Environment Variables

3. Run: vercel --prod

4. After deploy:
   - Update LinkedIn OAuth app redirect URI to: https://your-domain.vercel.app/api/auth/callback/linkedin
   - Update NEXTAUTH_URL env var in Vercel to your production URL
   - Test the full onboarding → discover → outreach → pipeline flow

5. Set up invite-only gating:
   - Add invite_codes table in Supabase: { code text, used boolean, used_by uuid }
   - Seed 20-30 codes manually
   - Add code check step before LinkedIn OAuth on /login page
```

---

## 9. Key Claude Code Tips for This Build

### Use these patterns in your prompts

**When stuck on an API:**
> "The Exa API is returning [error]. Here's the response: [paste]. Fix the integration in src/lib/exa/search.ts and add proper error handling."

**When debugging a Next.js Route Handler:**
> "This API route is returning a 500. Here's the error from Vercel logs: [paste]. The route is at src/app/api/companies/search/route.ts. Debug and fix."

**When the UI doesn't match the PRD:**
> "The CompanyPanel doesn't show the 'Why this fits you' section. The data is available in the intelligence API response as `whyFit`. Add it to the panel with a highlighted style — make it stand out from the rest of the content."

**Prompt engineering tip:**
> Always paste your src/types/index.ts into Claude Code when asking it to build new components — it will use your exact types and avoid mismatches.

### Critical build order (don't skip steps)
1. Schema → Types → API routes → UI (always in this order)
2. Get auth working before touching any other feature
3. Test each API integration in isolation with a simple test script before wiring to UI
4. Build copy-to-clipboard outreach BEFORE attempting LinkedIn API direct send

### Rate limits to design around
- LinkedIn API messaging: 100 messages/day per user (enforce in backend)
- Apollo API: 50 enrichments/month on free tier (cache aggressively)
- Anthropic: Monitor token usage in console weekly during beta
- Exa: 1000 requests/month on free tier (cache search results for 6h)

---

## 10. Week-by-Week Claude Code Session Map

| Week | Sessions | Key Output |
|---|---|---|
| Week 1 | 1 (Init), 2 (Schema), 3 (Types), 4 (Auth), 5 (Onboarding) | Working login + onboarding → candidate summary |
| Week 2 | 6 (Intent), 7 (Search pipeline), 8 (Intel panel) | Full discovery flow with company intelligence |
| Week 3 | 9 (People), 10 (Outreach) | Complete outreach generation |
| Week 4 | 11 (Pipeline), 12 (Discovery UI), 13 (Polish), 14 (Deploy) | Shipped, invite-only beta live |

---

## 11. Beta Launch Checklist

- [ ] LinkedIn OAuth approved and tested
- [ ] All API keys in Vercel production env
- [ ] Invite codes generated and distributed (20-50 for beta)
- [ ] Rate limiting active (outreach caps per user/day)
- [ ] Error logging via Sentry connected
- [ ] Onboarding completion funnel tracked in Supabase (use analytics events table)
- [ ] Candidate summary generation tested with 5+ real resumes
- [ ] Outreach generation quality tested: every message has a company-specific signal
- [ ] Pipeline board tested across all 4 status transitions
- [ ] Mobile layout tested (at minimum: iPhone 14 size)

---

*Jobseek.ai · Confidential · Build Plan v1.0*
