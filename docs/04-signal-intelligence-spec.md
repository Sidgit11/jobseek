# Network Signal Intelligence — Feature Spec
**Product:** Jobseek.ai
**Feature Name:** Signal Feed / Network Radar
**Status:** Pre-build spec
**Last updated:** 2026-03-16

---

## 1. Problem

Cold outreach works. Warm outreach works 3–5x better.

The difference between cold and warm is almost always **timing + context**. A message sent the week someone joins a new company, raises funding, posts about a hiring need, or shares a strong opinion lands in a completely different mental state than a message sent randomly.

The problem: users have no system to detect these moments. They exist in their LinkedIn network — buried in a feed full of noise — and by the time the user sees them manually, the window has often passed.

**Core JTBD:** "Tell me when and who to reach out to, and why right now."

---

## 2. ICP Fit

This feature is highest value for:

- Mid-level to senior professionals actively exploring (not desperate — selective)
- People who already believe in outreach but struggle with finding the right trigger
- Those with 200–2000 LinkedIn connections (enough signal, not overwhelming)
- Users who have defined target companies or roles in Jobseek

It is low value for: entry-level users with thin networks, users with no target clarity.

---

## 3. Current Behaviour (Without This Feature)

1. User manually scrolls LinkedIn feed daily — high noise, low signal
2. Occasionally notices someone changed jobs → thinks "I should reach out" → doesn't
3. Sees a company raised funding → has no fast path to turn that into an action
4. Receives a LinkedIn notification → reacts reactively, no strategy
5. Reaches out to people with no specific trigger → generic message → low response rate

**Time wasted per week on this manually:** 2–4 hours for an active job seeker.
**Conversion rate of random cold outreach:** ~5–10%.
**Conversion rate of trigger-based outreach:** ~25–40% (industry benchmarks from sales).

---

## 4. Signal Taxonomy

**Design principle:** Every signal must directly increase the probability of starting a hiring conversation. Generic engagement is not a signal. Job-finding context is mandatory.

The old `THOUGHT_LEADERSHIP` catch-all is replaced with 6 tightly defined signal types. Each has a **double filter** — signal keyword AND poster context — to eliminate noise.

---

### Tier 1 — Act Within 48 Hours

| Signal Type | Trigger Condition | Poster Filter | Warm Window |
|---|---|---|---|
| **`JOB_CHANGE`** | Post contains: "started a new position", "thrilled to join", "excited to announce I'm joining", "new journey begins", "is now [title] at", "joined X as" | Any connection degree | 0–30 days |
| **`HIRING_POST`** | Post contains: "we're hiring", "we are looking for a", "open role at", "join our team", "DM me if you're a [role]" | Poster title must be: Founder / Head of / Director / VP / Manager / Recruiter | 0–7 days |
| **`FUNDING_SIGNAL`** | Post contains: "raised $", "Series A/B/C/D", "seed round", "closed $Xm", "just raised", "proud to announce our funding" | Any — company announcement | 0–14 days |

### Tier 2 — Act Within 1 Week

| Signal Type | Trigger Condition | Poster Filter | Warm Window |
|---|---|---|---|
| **`DECISION_MAKER_ACTIVE`** | Post is substantive (>120 words) AND mentions: company, team, product, building, growth, or scaling | Poster title MUST include: Founder / Co-founder / CEO / CTO / CPO / VP / Head of / Director | 0–5 days |
| **`COMPANY_MILESTONE`** | Post contains: "just launched", "we hit [number]", "we're now in [X] markets", "[X] customers", "[product] is live", featured in [publication], "proud to share" | Any — milestone is the signal, not the poster | 0–7 days |
| **`WARM_PATH_OPENED`** | Your 1st-degree connection **reacted to or shared** a post by someone you don't know (2nd degree or unknown) | Reactor = 1st degree. Original poster = 2nd degree or beyond. | 0–5 days |

### What Gets Dropped

The following are **explicitly excluded** to keep the signal feed high-precision:

- Generic long posts with no hiring/company/growth keywords
- Personal posts (weekend activities, opinions on news, motivational content)
- Posts by "Following" accounts (not actual connections)
- Reshares without relevant original content
- Any post that passes only the length test — content topic is mandatory

**Target signal density:** 5–10 actionable signals per week, not 50 low-quality ones. Precision over recall.

---

### Signal Type — Outreach Message Strategy

Each signal type maps to a different message frame. The AI must use the correct frame per type:

| Signal Type | Message Frame | What to Avoid |
|---|---|---|
| `JOB_CHANGE` | Congratulate the move, reference what's interesting about their new company, soft ask for a chat | "I'm looking for a job, can we talk?" |
| `HIRING_POST` | Reference the specific role, anchor your most relevant experience in one line, ask for 20 min | Cover letter in disguise |
| `FUNDING_SIGNAL` | Acknowledge the milestone, connect it to what you're excited to build in that space | Generic "congrats on the raise" |
| `DECISION_MAKER_ACTIVE` | Engage with a specific point from their post first, then transition to intro — earn permission | Compliment → ask = transactional |
| `COMPANY_MILESTONE` | Lead with the specific milestone (not generic congrats), connect your background to their trajectory | "Amazing achievement!" with no substance |
| `WARM_PATH_OPENED` | Reference your mutual (the reactor), ask for a soft intro — make it feel like a referral | "I noticed we both know X" (too formal) |

---

## 5. Data Model

### Entities

```
User
  ├── target_roles[]         // PM, Engineer, Designer etc.
  ├── target_companies[]     // specific companies or criteria
  ├── target_seniority[]     // director, vp, founder etc.
  └── network_connected: bool  // LinkedIn OAuth connected?

NetworkConnection
  ├── id
  ├── user_id (FK → User)
  ├── linkedin_id
  ├── name
  ├── current_title
  ├── current_company
  ├── linkedin_url
  ├── last_synced_at
  └── degree: 1 | 2          // 1st or 2nd degree

Signal
  ├── id
  ├── user_id (FK → User)
  ├── person_id (FK → NetworkConnection or Apollo person)
  ├── company_id (optional FK → Company)
  ├── signal_type: enum      // JOB_CHANGE | FUNDING | HIRING_POST | etc.
  ├── signal_tier: 1 | 2 | 3
  ├── source: enum           // LINKEDIN | EXA | APOLLO | CRUNCHBASE | TWITTER
  ├── raw_content            // the post text, article title, etc.
  ├── detected_at
  ├── expires_at             // warm window end date
  ├── relevance_score        // 0–100, AI-computed
  └── status: NEW | ACTIONED | DISMISSED | EXPIRED

OutreachDraft
  ├── id
  ├── signal_id (FK → Signal)
  ├── user_id
  ├── channel: LINKEDIN | EMAIL
  ├── draft_text
  ├── generated_at
  └── sent: bool
```

### Key Relationships

- One User → many Signals (filtered to their network + targets)
- One Signal → one OutreachDraft (generated on demand or auto)
- Signal expires when `detected_at + warm_window > now`
- Relevance score factors: target company match + connection degree + signal tier + user's stated intent

---

## 6. Signal Detection — Data Sources Per Signal Type

| Signal Type | Primary Source | Secondary Source | Notes |
|---|---|---|---|
| Job Change | LinkedIn OAuth (connections endpoint) | Apollo job change flag | LinkedIn gives 1st degree changes; Apollo fills gaps |
| Funding | Exa (already integrated) | Crunchbase / Harmonic | Exa news search with "Series A/B/C" filters |
| Hiring Post | LinkedIn (Chrome agent or feed) | Exa company job postings | Most reliable via Chrome agent on feed |
| Thought Leadership Post | LinkedIn (Chrome agent) | Twitter/X API | Post content needed for personalisation |
| Job Posting Appeared | Exa job search | LinkedIn Jobs API (limited) | Exa is good here |
| Mutual Connection Activated | LinkedIn OAuth | — | Requires connection graph |
| Company Milestone | Exa news search | Crunchbase | Already partially in Jobseek |

### Source Reliability Matrix

| Source | Signal Quality | ToS Risk | Setup Cost |
|---|---|---|---|
| LinkedIn OAuth (official) | High for job changes, connection list | None | Medium (OAuth flow) |
| Exa (news + jobs) | High for funding, milestones, postings | None | Low (already integrated) |
| Apollo | Medium for job changes | None | Low (already integrated) |
| Harmonic MCP | High for company growth signals | None | Low (MCP connector) |
| LinkedIn Chrome Agent | High for posts/feed | Medium (ToS grey area) | Low (already available) |
| Twitter/X API | High for founder activity | None | Medium (separate API key) |

---

## 7. User Flow

```
[Setup — one time]
User defines targets:
  "I'm a PM looking at Series A–C AI startups,
   interested in companies like Notion, Linear, Cursor"
  ↓
User connects LinkedIn (OAuth) → imports 1st degree connections
  ↓
System cross-references connections against target companies
  ↓
Signal monitoring begins (background, scheduled)

---

[Daily / On-demand]
User opens Jobseek → "Signal Feed" tab
  ↓
Ranked list of signals:
  🔴 HIGH: "Rohan Verma (your 1st connection) just joined Cursor as Head of Product"
      → [Draft Outreach] [Dismiss]
  🟡 MED:  "Linear raised $35M Series B — you know 2 people there"
      → [Draft Outreach] [View Connections] [Dismiss]
  🟢 LOW:  "Priya Singh posted about async-first culture"
      → [Draft Outreach] [Dismiss]
  ↓
User clicks "Draft Outreach"
  → AI generates message using:
     - Signal context (what happened)
     - Person's profile (title, background)
     - User's background (from resume/profile)
     - Mutual context (shared connection, shared interest)
  ↓
User reviews, edits, sends (LinkedIn or email)
  ↓
Signal marked as ACTIONED → moves to pipeline
```

---

## 8. AI Personalisation Layer

Each signal type maps to a **message strategy** — the AI uses this to generate the draft.

| Signal Type | Message Strategy | What Not to Do |
|---|---|---|
| Job Change | Congratulate the move, reference what attracted you to their new company, soft ask for a chat | "I'm looking for a job, can we talk?" |
| Funding | Acknowledge the milestone, connect it to what you're excited to build in that space | Generic "congrats on the raise" |
| Hiring Post | Direct — reference the role/need, anchor your relevant experience, ask for 20 min | Cover letter in disguise |
| Thought Leadership Post | Engage with a specific point from their post first, THEN transition to intro | Compliment → ask = transactional |
| Mutual Connection | Name-drop the mutual, make it feel like a referral, not a cold message | "I noticed we both know X" (too formal) |

The message must:
- Be under 150 words for LinkedIn
- Mention the specific signal (not generic)
- Have one clear CTA
- Sound like the user wrote it, not an AI

---

## 9. Relevance Scoring

Each signal gets a score (0–100) based on:

```
relevance_score =
  signal_tier_weight (Tier 1: 40pts, Tier 2: 25pts, Tier 3: 10pts)
  + target_company_match (exact match: 30pts, similar: 15pts, none: 0pts)
  + connection_degree (1st: 20pts, 2nd with mutual: 10pts, cold: 0pts)
  + recency_bonus (within 24h: 10pts, within 72h: 5pts, older: 0pts)
```

Signals below 30 are not shown. Signals above 70 get a "🔴 Act Now" badge.

This keeps the feed high signal. If everything is urgent, nothing is.

---

## 10. Implementation Approaches

Three viable approaches, meaningfully different in build cost and accuracy:

### Approach A — Exa + Apollo Only (No LinkedIn Access)
Use only already-integrated data sources. No LinkedIn OAuth, no Chrome agent.

- Signals covered: Funding, Hiring posts (from job boards), Milestones, Job postings
- Missing: Job changes for specific connections, feed posts, mutual connection data
- Build effort: Low — ~2–3 days of Claude Code work
- Data quality: Medium — misses the most personal/warm signals
- ToS risk: Zero

**Best for:** Shipping fast. Validates whether users engage with a signal feed at all before building LinkedIn access.

---

### Approach B — LinkedIn OAuth + Exa + Apollo
User connects LinkedIn via OAuth. Jobseek gets their connections list + job change notifications.

- Signals covered: Everything in Approach A + Job Changes + Mutual Connections
- Missing: Feed posts (LinkedIn OAuth doesn't expose feed)
- Build effort: Medium — LinkedIn OAuth flow + connections sync (~1 week)
- Data quality: High for relationship-based signals
- ToS risk: Zero (official API)
- Blocker: `r_network` scope requires LinkedIn Partner Program approval — not guaranteed

---

### Approach C — Chrome Extension + Exa + Apollo ✅ Decided

User installs the Jobseek Chrome extension. The extension runs inside their own browser session on LinkedIn — reading feed posts, job changes, hiring signals — and pushes structured data to Jobseek's API in the background.

- Signals covered: Everything — feed posts, job changes, hiring posts, mutual connections, engagement
- Missing: Nothing
- Build effort: Medium (~2–3 weeks)
- Data quality: Highest — reads exactly what the user sees
- ToS risk: Low-Medium — runs in user's own authenticated session; not server-side scraping
- Background operation: ✅ Works when user is on other tabs, as long as LinkedIn tab is open

**This is the chosen path for V2. See Section 16 for full architecture.**

---

### Build Sequence

| Phase | Approach | Why |
|---|---|---|
| V1 (now) | A — Exa + Apollo only | Ship fast, validate signal feed engagement, zero risk |
| V2 (post-validation) | C — Chrome Extension | Full LinkedIn signal coverage, scalable, user-controlled |
| V3 (future) | B — LinkedIn OAuth | Complement extension with official connection graph if partner approval obtained |

---

## 11. Monetization

This feature is a **retention and upgrade driver** — not a free feature.

| Tier | Signal Access | Volume | Price Signal |
|---|---|---|---|
| Free | Tier 3 signals only (ambient, low urgency) | 3/week | — |
| Growth | Tier 1 + 2 signals | 20/week | Core reason to upgrade |
| Pro | All signals + Chrome deep scan | Unlimited | Power user feature |

Credit implication: Each "Draft Outreach from Signal" consumes 1 credit. Signal detection itself is free — you pay to act on it. This aligns incentives correctly: more signals → more drafts → more credit usage.

---

## 12. Metrics to Track

| Metric | What It Tells You |
|---|---|
| Signals generated per user per week | Data quality / source effectiveness |
| Signal → Draft conversion rate | Is the signal relevant enough to act on? |
| Draft → Sent rate | Is the draft quality good enough? |
| Sent → Reply rate | North star — does signal-based outreach work? |
| Time from signal detection to action | Are users acting in the warm window? |

Target in first 90 days: **Signal → Reply rate > 20%** (vs. ~8% baseline cold outreach). If not, signal quality or message quality is the problem.

---

## 13. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| LinkedIn OAuth partner approval delay | High | Start with Approach A; LinkedIn OAuth as async P2 |
| Chrome agent triggers LinkedIn security | Medium | Never run as background scheduler; manual trigger only |
| Low connection quality (thin networks) | Medium | Set minimum threshold (200+ connections) to unlock feature |
| Signal fatigue (too many, low relevance) | High | Strict relevance scoring; show max 5 signals/day on Growth |
| Users don't act in warm window | Medium | Push notifications + "This signal expires in 48h" urgency |

---

## 14. Open Questions

1. **LinkedIn OAuth scope:** Does `r_network` require partner approval? Need to test with a real app credential.
2. **Exa for job change signals:** Can Exa reliably surface "{person name} joins {company}" news? Test against 10 real cases.
3. **Signal deduplication:** If a funding round appears via Exa AND via a connection's post, how do we merge into one signal?
4. **User-defined watchlist vs. inferred targets:** Do we auto-detect target companies from their Jobseek pipeline, or make them explicit? Both has merit.
5. **Notification strategy:** In-app only vs. email digest vs. push? Email digest ("Your weekly signal report") may have better engagement than real-time.

---

## 16. Chrome Extension — Architecture & Design

### How It Works

A Chrome extension has two independent parts running simultaneously:

**Content Script** — injected into the `linkedin.com` tab. Reads the DOM: feed posts, job change notifications, hiring signals, profile data. Runs inside the user's authenticated LinkedIn session — it sees exactly what they see.

**Background Service Worker** — runs independently, not tied to any tab. Receives data from the content script, processes it, calls the Jobseek API, manages state and scheduling.

```
LinkedIn Tab (open, any position)
  └── Content Script
        ├── Reads feed posts, job changes, hiring signals
        ├── Extracts structured data (person, signal type, raw content)
        └── Sends to Background Service Worker via chrome.runtime.sendMessage()

Background Service Worker (always running while Chrome is open)
  ├── Receives structured signal data
  ├── Deduplicates against already-seen signals
  ├── POSTs to Jobseek API → /api/signals/ingest
  └── Optionally: triggers periodic re-scan via chrome.alarms API

Jobseek API
  ├── Stores signal in Supabase
  ├── Runs relevance scoring
  └── Makes it available in the Signal Feed UI
```

---

### Background Operation — The Key Question

**Does it work when the user is on a different tab?**

Yes — with one condition. The LinkedIn tab must be open somewhere in Chrome (pinned, backgrounded, minimised — doesn't matter). It does not need to be the active tab.

| Scenario | Works? |
|---|---|
| LinkedIn tab open, user on Gmail | ✅ Yes |
| LinkedIn tab open, Chrome minimised | ✅ Yes |
| LinkedIn tab pinned, user on 5 other tabs | ✅ Yes |
| Computer sleeping | ⚠️ Paused — resumes on wake |
| LinkedIn tab closed | ❌ No |
| LinkedIn not open at all | ❌ No |

**Onboarding UX implication:** Prompt users to pin their LinkedIn tab during setup.

> *"Pin your LinkedIn tab so Jobseek never misses a signal. Right-click the tab → Pin. It takes 2 seconds and stays out of your way."*

Pinned tabs are persistent, tiny, and survive accidental browser restores.

---

### Proactive Scanning via Alarms

Beyond passive reading, the extension can actively trigger LinkedIn feed refreshes on a schedule using `chrome.alarms`:

```
chrome.alarms.create('scan-linkedin', { periodInMinutes: 120 })
// Every 2 hours: wake up service worker → send message to content script → scroll + extract → push to API
```

This means even if the user opened LinkedIn at 9am, pinned it, and never looked again — the extension quietly scans at 11am, 1pm, 3pm. Signals stay fresh without any user action.

---

### Data Flow

```
1. User installs Jobseek extension → authenticates with their Jobseek account
   (extension stores Jobseek JWT in chrome.storage.local — never exposed to page)

2. User opens LinkedIn (logged in as themselves)
   → Content script fires on linkedin.com/*

3. Content script reads:
   - Feed posts (text, author, timestamp, reaction counts)
   - "X started a new position at Y" notifications
   - "X is hiring" posts
   - Job postings from companies in user's watchlist

4. Structured payload sent to Background Service Worker:
   {
     type: "JOB_CHANGE" | "HIRING_POST" | "FEED_POST" | ...,
     person: { name, linkedinUrl, title, company },
     rawContent: "...",
     detectedAt: ISO timestamp,
     sourceUrl: current LinkedIn page URL
   }

5. Background Service Worker:
   - Checks chrome.storage for duplicate (same person + same signal type within 7 days)
   - If new: POST to https://jobseek.ai/api/signals/ingest with Jobseek JWT
   - Updates local seen-signals cache

6. Jobseek backend:
   - Runs relevance scoring against user's target companies/roles
   - Stores in Supabase signals table
   - Available in Signal Feed on next page load
```

---

### Manifest V3 Structure

```json
{
  "manifest_version": 3,
  "name": "Jobseek — Network Signal Radar",
  "version": "1.0.0",
  "description": "Surfaces hiring signals from your LinkedIn network so you know exactly when and who to reach out to.",
  "permissions": [
    "storage",
    "alarms",
    "scripting"
  ],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://jobseek.ai/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icons/icon48.png"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

### Extension File Structure

```
jobseek-extension/
  manifest.json
  background.js          ← Service Worker: API calls, dedup, alarms
  content.js             ← Reads LinkedIn DOM, extracts signals
  popup.html             ← Small UI: connection status, signal count, settings
  popup.js
  icons/
    icon16.png
    icon48.png
    icon128.png
  utils/
    signalParser.js      ← Classifies raw DOM content into signal types
    deduplicator.js      ← Prevents sending same signal twice
    auth.js              ← Manages Jobseek JWT in chrome.storage
```

---

## 17. Chrome Extension — Requirements Checklist

Everything you need before building and publishing the extension.

### Accounts to Create

| What | Where | Cost | Notes |
|---|---|---|---|
| Google Developer Account | [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole) | **$5 one-time** | Required to publish to Chrome Web Store |
| Google account | Already have one | Free | Used to register as developer |
| Jobseek domain (already live) | — | — | Privacy policy must be hosted here |

**Total cost to publish: $5.**

---

### Legal & Policy Requirements

These are mandatory for Chrome Web Store approval. Cannot skip.

**1. Privacy Policy (Required)**
A publicly accessible URL explaining:
- What data the extension collects (LinkedIn post content, signal data)
- Where it's stored (Jobseek's servers via Supabase)
- How long it's retained
- That it's never sold to third parties
- User's right to delete their data

Host it at: `https://jobseek.ai/privacy`

**2. Permissions Justification**
Chrome Web Store requires a written explanation for each permission. For Jobseek:

| Permission | Justification to Submit |
|---|---|
| `host_permissions: linkedin.com` | "To read the user's LinkedIn feed and detect career-relevant signals on their behalf" |
| `storage` | "To cache seen signals locally and avoid duplicate API calls" |
| `alarms` | "To schedule periodic feed scans while the LinkedIn tab is open" |
| `scripting` | "To inject the content script that reads LinkedIn page content" |

Vague justifications = rejection. Be specific.

**3. Single Purpose Declaration**
Extensions must have a single, clear purpose. Ours: "Surface career outreach signals from the user's LinkedIn network." Do not mention anything else in the Store listing.

---

### Chrome Web Store Review Process

| Stage | Timeline | What Happens |
|---|---|---|
| Initial submission | Day 0 | Upload .zip of extension + fill Store listing |
| Automated review | ~Hours | Google scans for malware, policy violations |
| Manual review | 1–7 days | Human reviewer checks permissions, privacy policy, description |
| Approval / Rejection | Day 1–7 | Approval = live on Store. Rejection = reason given, can resubmit |
| Updates | 1–3 days | Each new version goes through review again |

**Common rejection reasons to avoid:**
- Privacy policy URL is broken or incomplete
- Permission justification is vague ("we need this to work")
- Extension description doesn't match actual functionality
- Extension requests more permissions than it needs (only request what you use)

---

### LinkedIn ToS — Honest Assessment

LinkedIn's ToS (Section 8.2) prohibits scraping. However, this extension operates in a legally distinct way:

| Scraping (prohibited) | Jobseek Extension (different) |
|---|---|
| Server makes requests to LinkedIn without user | User's own browser makes requests, as the user |
| No user session involved | Fully authenticated user session |
| Extracts data at scale, programmatically | Reads only what's visible to the logged-in user |
| No user consent | User explicitly installs and activates the extension |

**Legal precedent:** The hiQ vs. LinkedIn case (9th Circuit, 2022) established that reading publicly accessible data does not violate the Computer Fraud and Abuse Act. A user's own feed viewed in their own browser is even more defensible than public data.

**Real risk:** LinkedIn can technically detect extension patterns and flag accounts — not via legal action, but via automated detection. Mitigations:
- Never simulate clicks or automate actions (only read, never write)
- Respect natural timing — don't fire requests faster than a human would scroll
- No bulk extraction — extract only what's visible on screen
- Add jitter to alarm intervals (e.g., 90–150 min randomly, not exactly 120 min)

**Risk level: Low** for passive reading. Medium if the extension starts automating LinkedIn actions (sending messages, clicking buttons). Never build the latter.

---

### What Users Need

| Requirement | Mandatory | Notes |
|---|---|---|
| Chrome browser (desktop) | ✅ Yes | Extension is Chrome-only; no Firefox/Safari in V1 |
| Active LinkedIn account | ✅ Yes | Free account works; Premium not required |
| LinkedIn tab open in Chrome | ✅ Yes | Tab must stay open; pinning recommended |
| Jobseek account (logged in) | ✅ Yes | Extension authenticates against Jobseek |
| 200+ LinkedIn connections | Recommended | Thin networks = thin signals |
| Windows / Mac (desktop) | ✅ Yes | Chrome extensions don't run on mobile Chrome |

---

### Build Prerequisites (Technical)

Before Claude Code starts building the extension:

- [ ] Jobseek is deployed and live (Vercel URL working)
- [ ] `/api/signals/ingest` endpoint exists in Jobseek backend (or is built alongside)
- [ ] `signals` table exists in Supabase schema
- [ ] Jobseek auth returns a JWT that the extension can store and use
- [ ] Privacy policy page exists at `jobseek.ai/privacy`
- [ ] Google Developer Account registered ($5 paid)
- [ ] Extension icons designed (16x16, 48x48, 128x128 — can use Jobseek logo)

---

## 18. Suggested Next Steps

1. **Build V1 first (Approach A)** — Exa + Apollo signal detection, no extension dependency. Ship Signal Feed to beta users with 5 signal types. Validate that users act on signals before building the extension.
2. **Measure Signal → Reply rate** after 2 weeks. Target: >20%. That number justifies the extension build.
3. **Register Google Developer Account** ($5) and draft Privacy Policy — parallelise with V1 build so there's no blocker when extension is ready.
4. **Build the extension (V2)** — content script + background service worker + `/api/signals/ingest` endpoint. ~2–3 weeks with Claude Code.
5. **Submit to Chrome Web Store** — write clear permission justifications, link privacy policy, submit for review (1–7 days).
6. **Onboarding integration** — add "Install Extension" as a step in Jobseek onboarding flow, with tab pinning prompt.

---

*The extension is the right long-term architecture. It turns passive LinkedIn browsing into active signal generation — zero extra effort from the user. Build V1 first to de-risk the signal concept. Then ship the extension as the step-change upgrade.*
