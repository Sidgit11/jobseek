# Jobseek — AI-Powered Outbound Career Engine

> **The best opportunities don't come from applying.** They come from reaching the right person, at the right company, at the right moment — with something worth saying.

Jobseek is a full-stack AI product that transforms job search from passive applications into structured, signal-driven outreach. It finds companies that match your profile, detects warm outreach triggers from your LinkedIn network, and generates personalized messages — so you spend time on conversations, not applications.

**Built entirely with AI-assisted development using [Claude Code](https://claude.ai/code).**

---

## What It Does

### Discover Companies
Search for companies using natural language — *"Series B AI startups hiring PMs in NYC"*. Jobseek extracts your intent, searches across multiple data sources (Exa, Crunchbase, ATS job boards), scores each result on relevance + fit to your profile, and generates targeting briefs explaining *why this company* and *why now*.

### Detect Signals
A Chrome extension passively scans your LinkedIn feed and surfaces warm outreach triggers:
- **Tier 1 (act now):** Job changes, hiring posts, funding announcements
- **Tier 2 (context):** Decision-maker activity, company milestones

Each signal is AI-classified with a confidence score and an outreach hook.

### Generate Outreach
One-click personalized messages (LinkedIn + Email) anchored to real context — a specific signal, a company's recent funding round, or a hiring post from your network. No templates. Every message references something real.

### Manage Pipeline
Kanban board to track your outreach: Saved → Messaged → Replied → Interviewing. Drag-and-drop status management with company intelligence at your fingertips.

### Career Intake
A 3-phase conversational AI interview that builds a deep candidate model — your positioning, best work, differentiation, and constraints. This model powers every outreach draft and company match.

### Warm-Up Engagement
AI-suggested LinkedIn posts to comment on *before* you reach out — turning cold outreach into warm conversations.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 16 (App Router, TypeScript) | Server Components, built-in API routes, Vercel deployment |
| **Database** | Supabase (PostgreSQL + Auth + RLS) | Row-level security, real-time, generous free tier |
| **AI — Classification** | Google Gemini 2.5 Flash | Fast + cost-effective for structured extraction and classification |
| **AI — Reasoning** | Anthropic Claude (Sonnet) | Superior at complex synthesis — targeting briefs, company analysis |
| **Company Search** | Exa.ai | Understands natural language intent better than keyword search |
| **Company Data** | Crunchbase API | Funding, headcount, investors — structured company intelligence |
| **People Discovery** | Apollo.io (free tier) | Top people at a company with titles and LinkedIn URLs |
| **Email Enrichment** | Hunter.io | Domain-level email discovery |
| **Job Board Probing** | Custom ATS scraper | Free, no API key — crawls Lever, Greenhouse, Ashby, etc. |
| **State Management** | TanStack React Query | Async state with caching, deduplication, background refresh |
| **UI Components** | shadcn/ui + Tailwind CSS | Accessible, composable, no vendor lock-in |
| **Drag & Drop** | dnd-kit | Lightweight, accessible Kanban interactions |
| **Validation** | Zod | Runtime type safety at API boundaries |
| **Chrome Extension** | Manifest V3 | LinkedIn signal detection — content script + background worker |

---

## Architecture Overview

```
                                  +------------------+
                                  |  Chrome Extension |
                                  | (LinkedIn Scanner)|
                                  +--------+---------+
                                           |
                                    POST /api/signals/classify
                                           |
+------------+    Natural Language    +----v-----------+    Exa / Crunchbase    +-------------+
|            |  ──── Query ────────> |                |  ──── Enrichment ────> |             |
|   Browser  |                       |   Next.js API  |                        | External    |
|   (React)  | <──── Results ─────── |    Routes      | <──── Data ─────────── | APIs        |
|            |                       |                |                        |             |
+------------+                       +----+-----------+    Apollo / Hunter     +-------------+
                                          |
                                   Gemini / Claude
                                   (AI Processing)
                                          |
                                   +------v-------+
                                   |   Supabase   |
                                   | (PostgreSQL) |
                                   +--------------+
```

For detailed architecture decisions and rationale, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## How It Was Built

This project was built using **AI-led development** — every feature was designed, implemented, and iterated on using [Claude Code](https://claude.ai/code) as the primary development tool. Here's the workflow that was followed, step by step:

### The AI-Led Development Workflow

**Step 1: Define the Problem and Spec**
Before writing any code, each feature started with a clear spec — what to build, why, and the constraints. These specs live in [`docs/`](./docs/) and served as the source of truth.

**Step 2: Scaffold with Claude Code**
Each spec was fed to Claude Code as context. The first pass focused on getting a working skeleton — database schema, API routes, basic UI — that compiled and ran end-to-end.

**Step 3: Iterate in Conversation**
Rather than writing code manually and debugging, the workflow was conversational:
- "The search results aren't ranking correctly — fit should matter more than relevance"
- "The intake chat feels too long — reduce to 3 exchanges max"
- "Company names are being misdetected — add a heuristic safety net"

Each iteration was a focused instruction that Claude Code could act on with full codebase context.

**Step 4: Review, Test, Ship**
Every AI-generated change was reviewed before committing. The human role was **product direction, quality judgment, and architectural decisions** — the AI handled implementation velocity.

### What This Means in Practice

- **~30 days** from idea to full product with search, signals, outreach, pipeline, intake, and a Chrome extension
- **Every commit** has `Co-Authored-By: Claude` — full transparency
- **The design docs are public** in [`docs/`](./docs/) — you can see exactly what prompts and specs produced this codebase
- **The code is production-grade** — TypeScript strict mode, Zod validation, structured logging, unit tests, proper error handling

### Lessons for AI-Led Development

1. **Specs > prompts.** A well-written spec produces better code than clever prompting. Write what you want, not how to ask for it.
2. **Work in vertical slices.** Build one feature end-to-end (DB → API → UI) before starting the next. AI can hold context for a full slice but loses coherence across too many open threads.
3. **Review everything.** AI writes correct code most of the time. "Most of the time" is not good enough for production. Read every diff.
4. **Use AI for velocity, not judgment.** You decide *what* to build and *why*. AI decides *how* to implement it. Don't outsource product decisions to the model.
5. **Keep the feedback loop tight.** Short, specific instructions ("the scoring formula weights relevance too high — change to 40/60") beat long, vague ones ("make the search better").

---

## Project Structure

```
jobseek/
├── src/
│   ├── app/
│   │   ├── (app)/              # Authenticated pages
│   │   │   ├── dashboard/      # Command center + metrics
│   │   │   ├── discover/       # Company search
│   │   │   ├── signals/        # LinkedIn signal feed
│   │   │   ├── pipeline/       # Kanban board
│   │   │   ├── engage/         # Warm-up queue
│   │   │   ├── intake/         # Career intake interview
│   │   │   └── profile/        # User settings
│   │   ├── (auth)/             # Login + verification
│   │   └── api/                # API routes
│   │       ├── companies/      # Search + intelligence
│   │       ├── signals/        # Classification + storage
│   │       ├── outreach/       # Message generation
│   │       ├── intake/         # Conversational intake
│   │       ├── people/         # People discovery
│   │       ├── pipeline/       # Pipeline CRUD
│   │       ├── engagement/     # Warm-up opportunities
│   │       └── user/           # Profile + preferences
│   ├── lib/                    # Service integrations
│   │   ├── anthropic/          # Claude API (briefs, discovery)
│   │   ├── google/             # Gemini API (classification, extraction)
│   │   ├── exa/                # Company search
│   │   ├── crunchbase/         # Company enrichment
│   │   ├── apollo/             # People discovery
│   │   ├── ats/                # Job board probing
│   │   ├── supabase/           # Database client
│   │   └── logger.ts           # Structured logging
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn base components
│   │   ├── discovery/          # Search UI
│   │   ├── intelligence/       # Company panel
│   │   ├── outreach/           # Message editor
│   │   └── pipeline/           # Kanban cards
│   └── career-intelligence/    # Intake + engagement module
│       ├── components/         # IntakeChat, EngagementQueue
│       └── prompts/            # AI prompt templates
├── extension/                  # Chrome extension (Manifest V3)
│   ├── content.js              # LinkedIn DOM scraper
│   ├── background.js           # Signal sync worker
│   └── utils/                  # Parsing, dedup, prefiltering
├── supabase/
│   └── migrations/             # Schema evolution (9 migrations)
└── docs/                       # Design docs + build specs
```

---

## Setup

### Prerequisites
- Node.js 18+
- A Supabase project (free tier works)
- API keys for: Google AI (Gemini), Exa, Crunchbase, Apollo, Hunter.io

### Installation

```bash
git clone https://github.com/Sidgit11/jobseek.git
cd jobseek
npm install
```

### Environment Variables

Copy the example and fill in your keys:

```bash
cp .env.local.example .env.local
```

Required variables:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Models
GOOGLE_AI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_claude_key

# Data Sources
EXA_API_KEY=your_exa_key
CRUNCHBASE_API_KEY=your_crunchbase_key
APOLLO_API_KEY=your_apollo_key
HUNTER_API_KEY=your_hunter_key
```

### Database Setup

Run the Supabase migrations:

```bash
npx supabase db push
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## License

This project is shared for educational and portfolio purposes. See the code, learn from the approach, build your own.
