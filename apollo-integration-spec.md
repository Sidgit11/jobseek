# Apollo API Integration Spec — Jobseek.ai
**Status:** Implementation-ready
**Scope:** Wire up Apollo people discovery for target companies
**API Key:** To be injected via env var (`APOLLO_API_KEY`)
**Last updated:** 2026-03-16

---

## ⚠️ Free Tier Reality — One Endpoint

Only **one endpoint** is confirmed available on Apollo's free plan relevant to Jobseek:

```
POST /v1/mixed_people/organization_top_people
```

This endpoint takes a company identifier and returns the top people at that organization — names, titles, LinkedIn URLs. **No emails.** Everything else (enrichment, bulk match, people search with filters) is paywalled.

---

## 1. What This Does for Jobseek

| Jobseek Step | Apollo Free Endpoint | Output |
|---|---|---|
| Key People Discovery | `POST /v1/mixed_people/organization_top_people` | Names, titles, LinkedIn URLs of senior people at a company |
| Email retrieval | ❌ Not available on free tier | See Section 6 for workarounds |

LinkedIn URL becomes the **primary outreach vector** on free tier. Email is a paid upgrade path.

---

## 2. Environment Setup

```bash
# .env
APOLLO_API_KEY=your_key_here
APOLLO_BASE_URL=https://api.apollo.io/v1
```

```ts
// src/config/apollo.ts
export const APOLLO_CONFIG = {
  apiKey: process.env.APOLLO_API_KEY!,
  baseUrl: process.env.APOLLO_BASE_URL ?? "https://api.apollo.io/v1",
};
```

All requests use:

```ts
{
  "Content-Type": "application/json",
  "Cache-Control": "no-cache",
  "x-api-key": APOLLO_CONFIG.apiKey,
}
```

---

## 3. The Endpoint: `POST /v1/mixed_people/organization_top_people`

**Purpose:** Given a company (by name or domain), return the most prominent/senior people at that org.

**Does NOT consume credits.** Call freely on every company panel open.

**Does NOT return emails.** `email` field will be null or absent — do not render an email field in the UI from this response.

### Request Shape

> ⚠️ Apollo's public docs don't have a dedicated reference page for this endpoint. The parameters below are inferred from Apollo's standard patterns + the endpoint name. **Verify these against the live API when the key is available** and adjust accordingly.

```ts
// src/services/apollo/organizationTopPeople.ts

interface ApolloTopPeopleParams {
  organizationId?: string;      // Apollo's internal org ID (most reliable)
  domain?: string;              // e.g. "notion.so" — preferred over name
  organizationName?: string;    // fallback if domain not known
  page?: number;                // default: 1
  perPage?: number;             // default: 10
}

async function getOrganizationTopPeople(params: ApolloTopPeopleParams) {
  const res = await fetch(
    `${APOLLO_CONFIG.baseUrl}/mixed_people/organization_top_people`,
    {
      method: "POST",
      headers: apolloHeaders(),
      body: JSON.stringify({
        organization_id: params.organizationId,
        domain: params.domain,
        q_organization_name: params.organizationName,
        page: params.page ?? 1,
        per_page: params.perPage ?? 10,
      }),
    }
  );

  if (!res.ok) throw new ApolloError(res.status, await res.text());
  return res.json();
}
```

### Response — Expected Shape

> Same caveat: inferred from Apollo's standard person object. Log the raw response on first real call and reconcile.

```ts
interface ApolloPersonStub {
  id: string;              // Store this — useful if you upgrade to paid enrichment later
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  linkedin_url: string;    // PRIMARY CTA — "Connect on LinkedIn"
  seniority: string;       // "founder" | "c_suite" | "vp" | "director" | "manager"
  city?: string;
  country?: string;
  email: null;             // Always null on free tier — never render this field
  organization: {
    id: string;
    name: string;
    website_url: string;
    primary_domain: string;
  };
}

interface TopPeopleResponse {
  people: ApolloPersonStub[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}
```

### What to Render in the Jobseek People Card

| Field | Source | Notes |
|---|---|---|
| Name | `name` | — |
| Title | `title` | — |
| Seniority badge | `seniority` | Map to readable label: "C-Suite", "VP", etc. |
| LinkedIn button | `linkedin_url` | Primary CTA — open in new tab |
| Email button | — | Show as locked/upgrade prompt on free tier |
| Apollo ID | `id` | Store in DB — needed for future paid enrichment without re-fetching |

---

## 4. Integration Map

```
User selects a company → Company Detail Panel opens
         ↓
[Key People Section]
  → POST /v1/mixed_people/organization_top_people
      with: domain (preferred) or organizationName
  → Render: people cards with Name | Title | Seniority | LinkedIn CTA
  → "Get Email" shows locked state → upgrade prompt
         ↓
User clicks "Connect on LinkedIn"
  → Opens linkedin_url in new tab
  → Outreach draft (LinkedIn connect note) triggered
         ↓
[Outreach Drafting — unchanged]
```

---

## 5. Service Layer Structure

```
src/
  services/
    apollo/
      index.ts                    ← re-exports
      client.ts                   ← apolloPost(), apolloHeaders(), ApolloError
      organizationTopPeople.ts    ← getOrganizationTopPeople()
      types.ts                    ← ApolloPersonStub, TopPeopleResponse
      mock.ts                     ← fixture data for NODE_ENV=development
```

### `client.ts`

```ts
import { APOLLO_CONFIG } from "@/config/apollo";

export class ApolloError extends Error {
  constructor(public status: number, public body: string) {
    super(`Apollo API error ${status}: ${body}`);
  }
}

export function apolloHeaders() {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "x-api-key": APOLLO_CONFIG.apiKey,
  };
}

export async function apolloPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${APOLLO_CONFIG.baseUrl}${path}`, {
    method: "POST",
    headers: apolloHeaders(),
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw new ApolloError(429, "Rate limit hit");
  if (res.status === 401) throw new ApolloError(401, "Invalid API key");
  if (res.status === 403) throw new ApolloError(403, "Endpoint not available on current plan");
  if (!res.ok) throw new ApolloError(res.status, await res.text());

  return res.json();
}
```

### `mock.ts` — Dev Mode Fixtures

Critical: use this in `NODE_ENV=development` so the team iterates on UI without hitting the live API at all.

```ts
export const MOCK_TOP_PEOPLE_RESPONSE: TopPeopleResponse = {
  people: [
    {
      id: "apollo_mock_001",
      first_name: "Jane",
      last_name: "Smith",
      name: "Jane Smith",
      title: "Head of Product",
      linkedin_url: "https://linkedin.com/in/janesmith",
      seniority: "director",
      email: null,
      organization: {
        id: "apollo_org_001",
        name: "Acme Corp",
        website_url: "https://acme.com",
        primary_domain: "acme.com",
      },
    },
    {
      id: "apollo_mock_002",
      first_name: "Alex",
      last_name: "Chen",
      name: "Alex Chen",
      title: "CTO",
      linkedin_url: "https://linkedin.com/in/alexchen",
      seniority: "c_suite",
      email: null,
      organization: {
        id: "apollo_org_001",
        name: "Acme Corp",
        website_url: "https://acme.com",
        primary_domain: "acme.com",
      },
    },
  ],
  pagination: { page: 1, per_page: 10, total_entries: 2, total_pages: 1 },
};
```

---

## 6. Email Gap — Options for Free Tier

### Option A — LinkedIn-Only Outreach (Default)
Use `linkedin_url` from the response as the sole outreach CTA. This matches Jobseek's existing LinkedIn connect note flow perfectly. Show "Get Email" as a locked feature with an upgrade prompt.

**Recommended: implement this as the baseline.**

### Option B — Pair with Hunter.io Free Tier
Hunter.io free plan: 25 domain searches/month. After Apollo returns the person's name + their company domain, call Hunter to find their work email.

```ts
// POST https://api.hunter.io/v2/email-finder
{
  domain: "acme.com",       // from Apollo person.organization.primary_domain
  first_name: "Jane",       // from Apollo person.first_name
  last_name: "Smith",       // from Apollo person.last_name
  api_key: process.env.HUNTER_API_KEY
}
// Returns: { email: "jane@acme.com", score: 94, ... }
```

Zero cost, separate API key, 25 searches/month is enough for early user testing.

### Option C — Upgrade Apollo ($49/mo Basic)
Unlocks `POST /v1/people/match` → verified work email per person (1 credit each). Spec for this in Section 8 below.

---

## 7. Error Handling

| Status | Meaning | Jobseek Action |
|---|---|---|
| `401` | Bad/missing API key | Log server-side, show generic error, alert dev |
| `403` | Endpoint not on plan | Log which endpoint was called, show upgrade prompt |
| `422` | Bad params (wrong domain format, etc.) | Log request body, show "no results found" |
| `429` | Rate limit hit | Retry after 60s with exponential backoff, max 3 retries |
| `200` empty `people: []` | Company found, no top people data | Show empty state — "No contacts found for this company" |

---

## 8. Pre-Launch Checklist

- [ ] `APOLLO_API_KEY` in `.env` — never committed to repo
- [ ] Key in hosting env secrets (Vercel / Railway / Render)
- [ ] `NODE_ENV=development` returns `MOCK_TOP_PEOPLE_RESPONSE` — zero live API calls locally
- [ ] **First real API call:** log the raw response to confirm actual field names match this spec
- [ ] `email` field never rendered in UI — always null on free tier
- [ ] `linkedin_url` is the primary CTA on every person card
- [ ] Apollo `person.id` stored in DB — ready for paid enrichment upgrade without re-fetching
- [ ] 429 handler with backoff wired into `apolloPost()` before any load testing
- [ ] "Get Email" button shows locked state with upgrade messaging (not hidden, not broken)

---

## 9. Upgrade Path — When Email is Worth Paying For

When LinkedIn-only outreach data justifies the spend (track reply rates first):

1. Upgrade Apollo to Basic (~$49/mo)
2. Add `src/services/apollo/peopleEnrich.ts`

```ts
// POST /v1/people/match — PAID ONLY
async function enrichPerson(apolloId: string): Promise<string | null> {
  const result = await apolloPost<{ person: ApolloEnrichedPerson }>(
    "/people/match",
    { id: apolloId, reveal_personal_emails: false }
  );

  const { email, email_status } = result.person ?? {};

  // Only return emails worth using
  if (!email || email_status === "unavailable") return null;
  if (email_status === "guessed") return null; // too risky for cold outreach

  return email; // "verified" or "likely" only
}
```

3. Gate behind "Get Email" button — server-side credit check before calling
4. Deduct credit only on non-null return
5. Apollo `id` already stored from free-tier calls → no re-search needed

---

*Hand to Claude Code with: "Implement per this spec. Single endpoint: POST /v1/mixed_people/organization_top_people. API key via env. Mock fixtures in dev. Do not implement /people/match — it's paywalled."*
