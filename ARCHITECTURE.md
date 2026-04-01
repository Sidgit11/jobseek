# Architecture

This document explains the key architectural decisions in Jobseek and the reasoning behind them. If you're learning AI-led development, this is where the *why* lives.

---

## System Overview

Jobseek is a **Next.js full-stack application** with a **Chrome extension** sidecar. The core loop is:

1. **Understand the user** (intake interview → candidate model)
2. **Find opportunities** (company search + signal detection)
3. **Enable action** (outreach generation + pipeline tracking)

Every feature serves this loop. If it doesn't increase the probability of starting a hiring conversation, it doesn't ship.

---

## AI Model Strategy

### Why Two Models?

Jobseek uses **Gemini 2.5 Flash** and **Claude Sonnet** for different tasks. This isn't complexity for its own sake — each model has a clear strength:

| Task | Model | Rationale |
|------|-------|-----------|
| Signal classification | Gemini Flash | High volume (dozens of LinkedIn posts per scan). Needs to be fast and cheap. Classification is structured JSON — simpler models handle it well. |
| Intent extraction | Gemini Flash | Parsing "Series B AI startups in NYC" into structured fields is extraction, not reasoning. Speed matters for search UX. |
| Intake chat + extraction | Gemini Flash | Conversational flow with parallel field extraction. Latency-sensitive (user is waiting for a response). |
| Outreach drafts | Gemini Flash | Two parallel generations (LinkedIn + Email). Speed + cost efficiency for a feature users hit repeatedly. |
| Targeting briefs | Claude Sonnet | "Why this company + why now" requires synthesizing funding data, hiring signals, and user profile into a coherent narrative. Reasoning quality matters more than speed here. |
| Company discovery fallback | Claude Sonnet | When Exa returns no results, Claude generates candidate companies from its knowledge. Needs broad world knowledge + good judgment. |

**The principle:** Use the fastest/cheapest model that produces acceptable quality. Upgrade to a reasoning model only when the task requires synthesis or judgment.

### Prompt Architecture

Prompts are co-located with the features they serve:

```
src/career-intelligence/prompts/    # Intake + engagement prompts
src/app/api/signals/classify/       # Classification prompt (inline in route)
src/lib/anthropic/                  # Claude prompts for briefs + discovery
```

Each prompt includes:
- **Role definition** — what the model is acting as
- **Strict output schema** — JSON shape with field descriptions
- **Negative examples** — what NOT to do (critical for classification quality)
- **Grading rubric** — how to score confidence (e.g., "90+ only for perfect matches")

This structure emerged from iteration — early prompts without negative examples had ~40% false positive rates on signal classification. Adding "NOT a signal: generic opinions, congratulations threads, unrelated roles" dropped false positives to <5%.

---

## Search Pipeline

The company search is the most complex subsystem. Here's how a query flows:

```
User Query: "AI startups hiring PMs"
         │
         ▼
┌─────────────────────┐
│  Intent Extraction   │  Gemini extracts: sectors=["AI"], roles=["PM"],
│  (Gemini Flash)      │  funding_stages=[], geo=null, company_name=null
└─────────┬───────────┘
          │
          ▼
    ┌─ Company name detected (>0.9 confidence)?
    │
    ├─ YES ──▶ Fast Path: guessDomain() → Crunchbase + ATS probe → done
    │
    └─ NO ───▶ Discovery Path:
               │
               ▼
         ┌────────────┐
         │  Exa Search │  Natural language search across company pages
         └──────┬─────┘
                │
                ▼
         ┌──────────────────┐
         │ Crunchbase Enrich │  Top 5 results get funding/headcount data
         │ (parallel)        │
         └──────┬───────────┘
                │
                ▼
         ┌──────────────┐
         │  ATS Probing  │  Top 10 results probed for open roles
         │  (parallel)   │  Lever, Greenhouse, Ashby, Bamboo, etc.
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │   Scoring     │  Relevance (40%) + Fit (60%)
         └──────┬───────┘
                │
                ▼
         ┌──────────────────┐
         │ Targeting Briefs  │  Top 5 get AI-generated "why now" briefs
         │ (Claude Sonnet)   │
         └──────────────────┘
```

### Why Relevance + Fit as Separate Scores

Early versions used a single score. The problem: a company could rank high because it perfectly matched the *query* ("AI startups") but was a terrible *fit* for the user (wrong seniority level, no relevant roles open). Splitting into two scores with a 40/60 weight toward fit solved this.

- **Relevance (40%):** Does this match what the user searched for? Name match, sector match, funding stage, geography.
- **Fit (60%):** Does this match who the user is? ATS role match, industry overlap, seniority alignment, location preference.

### Fallback Chain

The search never returns empty results:
1. Exa search → results? Done.
2. No results → Claude company discovery (generates plausible companies from world knowledge)
3. Claude fails → curated demo data with clear "demo" labels

This is a UX decision: an empty search result kills user trust. A clearly-labeled fallback ("Showing AI-suggested companies — refine your search for better results") preserves the experience.

---

## Signal Detection (Chrome Extension)

### Why a Chrome Extension?

LinkedIn doesn't have a public API for feed data. The options were:
1. **Server-side scraping** — ToS violation, IP blocks, auth complexity
2. **Email digest parsing** — Delayed (daily), low signal density
3. **Chrome extension** — Reads the user's own authenticated session. No scraping servers. Manifest V3 compliant.

The extension runs passively — the user doesn't need to be on LinkedIn. Background service workers (`chrome.alarms`) trigger periodic scans.

### Signal Pipeline

```
LinkedIn DOM → Content Script (extract + prefilter) → Background Worker (dedup + batch)
    → POST /api/signals/classify (Gemini classification) → Supabase storage → Signals UI
```

**Prefiltering** happens client-side to reduce API calls:
- Remove suggested posts (not from user's network)
- Remove posts with no company context
- Remove duplicates (content hash)
- Remove posts older than 7 days

This typically reduces a batch of 50+ posts down to 10-15 that are worth classifying.

### Device Token Linking

Instead of LinkedIn OAuth (which requires a lengthy approval process), the extension uses a simple device token:
1. User copies their token from the Jobseek dashboard
2. Pastes it into the extension popup
3. Extension stores it in `chrome.storage.local`
4. All API calls include the token for user identification

Simple, no OAuth approval needed, works immediately.

---

## Database Design

### Row-Level Security (RLS)

Every table with user data has RLS policies. Users can only read/write their own data. The `service_role` key (server-side only) bypasses RLS for API routes that need cross-user access (e.g., signal ingestion from the extension).

### Schema Evolution

The database evolved through 9 migrations — each one additive, no destructive changes:

1. `001_initial_schema` — profiles, companies, people, pipeline, outreach drafts
2. `002_add_cb_enriched_at` — Crunchbase enrichment caching
3. `003_add_search_queries` — Search history tracking
4. `004_add_linkedin_signals` — Signal storage (the extension launch)
5. `005_device_token_signals` — Link signals to users via device token
6. `006_signal_store_enhancements` — Company name extraction, scan metrics
7. `007_signal_engagement` — Engagement opportunity tracking
8. `008_public_profiles` — Profile slug, social links, public visibility
9. `009_career_intelligence` — Candidate model, intake conversations, engagement queue

This is how production databases should evolve — forward-only migrations, each one small and reviewable.

---

## API Design Patterns

### Structured Logging

Every API route uses `routeLogger` — a tagged logger that includes the route name in every log line:

```typescript
const log = routeLogger('companies/search')
log.info('Starting search', { query, userId })
log.warn('Exa returned 0 results, falling back to Claude')
log.error('Crunchbase enrichment failed', { error })
```

This makes debugging production issues tractable. When something breaks, you can filter logs by route and see the full execution trace.

### Error Handling

API routes follow a consistent pattern:
1. Validate input (Zod schemas at the boundary)
2. Execute business logic with try/catch
3. Return structured errors with appropriate HTTP status codes
4. Never expose internal error details to the client

### Parallel Execution

Where possible, independent operations run in parallel:

```typescript
const [crunchbaseData, atsResults] = await Promise.all([
  enrichWithCrunchbase(company.domain),
  probeATS(company.domain)
])
```

This is critical for search latency — enriching 5 companies sequentially would take 10+ seconds. In parallel, it takes ~2 seconds.

---

## Frontend Architecture

### Server Components by Default

Next.js App Router uses Server Components as the default. Pages fetch data on the server and render HTML — no loading spinners for initial page loads. Client Components (`'use client'`) are only used where interactivity is required (search input, drag-and-drop, chat interface).

### React Query for Async State

Client-side data fetching uses TanStack React Query:
- Automatic caching and deduplication
- Background refresh (stale-while-revalidate)
- Optimistic updates (pipeline drag-and-drop updates the UI immediately, syncs in background)

### Component Organization

```
components/
├── ui/              # Primitives (Button, Input, Badge) — shadcn/ui
├── discovery/       # Feature-specific (CompanyCard, SearchLoader)
├── intelligence/    # Feature-specific (CompanyPanel, PersonCard)
└── pipeline/        # Feature-specific (KanbanCard)
```

UI primitives are generic and reusable. Feature components are specific and not shared across features. This prevents premature abstraction — a CompanyCard in Discover has different needs than a company reference in Pipeline.

---

## What I'd Do Differently

1. **Start with the candidate model.** The intake interview was built in Phase 3 but should have been Phase 1. Every other feature (search ranking, outreach quality, signal relevance) improves when the system deeply understands the user.

2. **Use a single AI provider.** Two SDKs (`@anthropic-ai/sdk` + `@google/generative-ai`) means two sets of error handling, rate limiting, and billing. In practice, Gemini Flash handles 90%+ of tasks. Claude is reserved for the cases where reasoning quality genuinely matters.

3. **Build the extension earlier.** Signals turned out to be the most compelling feature — warm outreach triggers from your own network. Building it as a Phase 2 add-on meant retrofitting the schema and API.

---

## For Learners

If you're studying this codebase to learn AI-led development:

1. **Start with the API routes** (`src/app/api/`). Each route is self-contained — you can read one file and understand the full request lifecycle.
2. **Read the prompts** (`src/career-intelligence/prompts/`, `src/app/api/signals/classify/`). The quality of AI output is 80% prompt quality. Study the negative examples and grading rubrics.
3. **Follow the data flow.** Pick a feature (e.g., company search) and trace the request from the UI component → API route → external APIs → database → back to UI.
4. **Check the design docs** in [`docs/`](./docs/). They show what the spec looked like *before* code existed — useful for understanding the gap between "what I wanted" and "what shipped."
