---
name: product-context-jobseek
description: Canonical product context for Jobseek.ai — AI-powered outbound platform for job seekers. Use when generating PRDs, positioning, UX decisions, GTM strategy, or investor material related to Jobseek.ai.
last_updated: 2026-03-16
---

# PRODUCT CONTEXT — JOBSEEK.AI

## 1. Product Overview

Jobseek.ai is an AI-powered outbound platform for job seekers.

Core idea:
Job search should be treated like outbound sales, not passive applications.

The platform helps professionals:
- Discover relevant companies using natural language queries
- Instantly understand company context
- Identify key decision makers
- See mutual connection paths
- Send personalized LinkedIn or email outreach
- Detect warm outreach signals from their LinkedIn network (Signal Feed)

Positioning:
"Outbound engine for modern careers."

---

## 2. Problem We Are Solving

### Structural shifts in hiring

1. Job boards are saturated.
2. Application-based hiring has low signal-to-noise.
3. Many high-quality roles are filled via conversations, not postings.
4. Outreach works, but is time-intensive and fragmented.
5. Warm outreach moments (job changes, funding, hiring posts) are missed because there is no system to surface them.

Current candidate workflow is broken:
- Research across multiple tabs
- Manual LinkedIn stalking
- Email hunting
- Generic AI-generated messages
- No structured pipeline
- No signal detection — misses the right moment to reach out

There is no unified outbound workflow for job seekers.

---

## 3. Core Insight

Hiring is increasingly relationship-driven.

The highest-leverage candidates:
- Target companies early
- Reach decision makers directly
- Start conversations before roles are public
- Reach out at the right moment, with the right context

Jobseek.ai productizes this behavior.

The single biggest leverage point is timing: a message sent the week someone joins a new company or their company raises funding converts 3–5x better than a generic cold message. Signal intelligence is what makes this systematic.

---

## 4. Target ICP (Initial Focus)

Primary:
- Product Managers
- Engineers
- Designers
- Growth / GTM operators
- Mid-level to senior startup professionals

Traits:
- High agency
- Comfortable with proactive outreach
- Startup-curious or startup-native
- Value quality over volume
- 200–2000 LinkedIn connections (enough network signal)

Not targeting:
- Fresh graduates (initially)
- Mass-market job seekers
- Government job aspirants
- High-volume resume drop users

---

## 5. Core User Workflow

1. Intent-based discovery
   User enters natural language search:
   "Series B AI startups hiring product leaders"

2. Company intelligence
   AI-generated summaries:
   - Funding
   - Growth signals
   - Product focus
   - Hiring indicators

3. Key people discovery
   Identify:
   - Founders
   - Hiring managers
   - Functional leaders

4. Signal intelligence (P1 — in spec)
   Surface warm outreach moments:
   - Job changes in network
   - Funding announcements at target companies
   - Hiring posts from connections
   - Thought leadership posts worth engaging on
   Powered by: Exa (V1) → Chrome Extension (V2)

5. Relationship intelligence (P1)
   - Mutual connections
   - Warm intro paths
   - Network proximity scoring

6. Outreach execution
   - LinkedIn connect note
   - Email draft
   - Contextual personalization anchored to the signal

North Star:
Conversations started with relevant decision makers.

---

## 6. MVP Scope (Shipped)

Must have ✅:
- Natural language company search
- Ranked company list
- Company summary panel
- Key people identification (Apollo /mixed_people/organization_top_people)
- AI outreach draft generation

P1 (in progress):
- Signal Feed (network trigger-based outreach)
- Mutual connection mapping
- Outreach tracking
- Credits system
- Usage analytics

Not MVP:
- Resume optimization
- Interview prep
- ATS integrations
- Full CRM features
- Chrome Extension (V2 of Signal Feed)

---

## 7. Signal Intelligence Feature — Summary

**Feature name:** Signal Feed / Network Radar
**Spec location:** `/network-signal-intelligence-spec.md`
**Status:** Pre-build

Core concept: Surface ranked outreach triggers from the user's LinkedIn network so they know exactly when, who, and why to reach out.

Signal types (Tier 1 — act within 48h):
- Job change (connection moved to new company)
- Company raised funding
- Hiring post from connection or target company
- New senior hire at target company

Signal sources:
- V1: Exa (news/jobs) + Apollo (people changes)
- V2: Chrome Extension (reads user's own LinkedIn feed in background)

Extension approach: User installs Jobseek Chrome extension. It reads their LinkedIn feed passively while the tab is open (including when user is on other tabs). Sends structured signals to Jobseek API. Works silently in the background — zero extra effort from user.

Monetization: Free tier gets Tier 3 signals only. Growth plan unlocks Tier 1+2 (core upgrade driver). Pro plan gets Chrome deep scan.

---

## 8. Chrome Extension — Key Facts

**Decided approach for Signal Intelligence V2.**

Architecture:
- Manifest V3 Chrome extension
- Content script: reads LinkedIn DOM
- Background service worker: processes + sends to Jobseek API
- Uses chrome.alarms for periodic scanning (every ~2 hours)

Background operation: Works when user is on other tabs. Requires LinkedIn tab to be open (pinned tab recommended). Does not require LinkedIn to be the active tab.

Requirements to publish:
- Google Developer Account ($5 one-time)
- Privacy policy at jobseek.ai/privacy
- Chrome Web Store review (1–7 days)
- No special LinkedIn approval needed

ToS risk: Low — reads only what the user sees in their own authenticated session. Not server-side scraping. User explicitly installs and consents.

---

## 9. Tech Stack

Frontend + Backend: Next.js 16 (App Router)
Database + Auth: Supabase
AI (company summaries, outreach): Google Gemini (via @google/generative-ai)
Company search: Exa
People discovery: Apollo (/mixed_people/organization_top_people — free tier)
Email enrichment: Apollo (paid tier, /people/match)
Email sending: Resend
Hosting: Vercel
Extension: Chrome Manifest V3 (planned V2)

---

## 10. API Layer — Key Decisions

Apollo free tier endpoint (only available):
- `POST /v1/mixed_people/organization_top_people` — returns top people at a company (name, title, LinkedIn URL). No emails on free tier.

Email on free tier: Not available from Apollo. Options:
- LinkedIn URL as primary outreach vector (default)
- Hunter.io free tier (25 domain searches/mo) as email fallback
- Upgrade Apollo to Basic (~$49/mo) for email enrichment at scale

Spec: `/apollo-integration-spec.md`

---

## 11. Competitive Landscape

Indirect competitors:
- LinkedIn Jobs
- Wellfound
- Traditional job boards

Tool competitors:
- Clay
- Sales Navigator
- Apollo
- Hunter
- Generic AI writing tools

Differentiation:
- Built for candidates, not sales teams
- Unified workflow: discover → signal → outreach → track
- Signal intelligence layer (warm trigger-based outreach)
- Chrome extension that works passively in background
- Context-aware personalization per signal type

---

## 12. Monetization Direction

Model: Subscription + credit-based usage

Tiers:
- Starter: search + limited outreach + Tier 3 signals only
- Growth: full outreach + Tier 1/2 signals + 20 signals/week (core upgrade driver)
- Pro: all signals + Chrome deep scan + unlimited

Credit usage:
- Company search: free
- People discovery: free (Apollo free tier)
- Email enrichment: 1 credit per verified email (Apollo paid)
- Outreach draft from signal: 1 credit per draft
- Signal detection: free — users pay to act on signals

Users are willing to pay for career leverage. Signal feed is the primary retention + upgrade hook.

---

## 13. Brand Positioning

Tone:
- Confident
- Slightly opinionated
- High-signal
- Operator-focused
- Not HR-style
- Not motivational

Core belief:
"The best opportunities don't come from applying."

Avoid:
- Buzzwords
- AI hype
- Recruiter language
- Corporate tone

---

## 14. Visual Identity

Personality:
- Minimal
- Premium
- Strategic
- YC-style SaaS

Color system:
Primary: Deep Indigo (#4F46E5)
CTA: Electric Indigo (#6366F1)
Secondary: Charcoal (#111827)
Background: Off-white (#FAFAFB)

Design principle:
Restraint = authority.

---

## 15. Success Metrics

Primary:
- Meaningful outreach initiated
- Conversations started
- Response rate (target: >20% for signal-triggered outreach)

Secondary:
- Signals generated per user per week
- Signal → Draft conversion rate
- Companies shortlisted
- People identified
- Time-to-first-message

Long-term:
- Interview conversion rate

---

## 16. Strategic Expansion Paths

Near-term:
- Signal Feed V1 (Exa + Apollo, no LinkedIn dependency)
- Chrome Extension (Signal Feed V2 — full LinkedIn feed access)
- LinkedIn OAuth (V3 — official connection graph)

Future:
- Career CRM
- Hiring-side outbound tools
- Talent intelligence layer
- Network graph reinforcement
- Marketplace layer

---

## 17. Product Philosophy

Jobseek.ai is not:
- A job board
- A resume builder
- A career coach

It is:
A structured outbound system for careers.

Every feature must answer:
"Does this increase the probability of starting a high-quality hiring conversation?"

If not, it does not belong.

---

END OF CONTEXT
