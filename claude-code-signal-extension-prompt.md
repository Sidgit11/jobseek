# Claude Code Prompt — Jobseek LinkedIn Signal Tester Extension (v2 — Gemini Backend)

> Copy everything below the horizontal rule and paste directly into Claude Code.

---

Build a Chrome Extension (Manifest V3) called **"Jobseek Signal Tester"** and a companion Next.js API route. The extension scrapes LinkedIn posts, pre-filters noise locally, then sends surviving posts to a Jobseek backend endpoint where **Gemini Flash** classifies them into job-finding signals. Output the extension as `jobseek-signal-tester/` (unpacked, loadable in Chrome dev mode) and the API route inside the existing Next.js app at `src/app/api/signals/classify/route.ts`.

---

## ARCHITECTURE OVERVIEW

```
LinkedIn feed/notifications
  → content.js (scrape raw posts)
    → pre-filter() (kill ads, noise, short posts — runs locally, zero API cost)
      → background.js (deduplicate against seen IDs, batch 15–20 posts)
        → POST /api/signals/classify (Jobseek Next.js API)
          → Gemini Flash (classify batch → structured signals JSON)
            → chrome.storage.local (store signals)
              → popup.html (display ranked signal cards)
```

**Why two layers:**
- Pre-filter is deterministic and free — kills ~40–50% of posts (ads, birthday posts, pure social noise)
- Gemini handles everything that needs context and reasoning — nuance, intent, false positives that regex can't catch
- Batching (15–20 posts per call) keeps Gemini costs low

---

## CRITICAL: DOM LEARNINGS FROM LIVE LINKEDIN TEST

Read these before writing any extraction code. These come from a real live run on a logged-in LinkedIn feed.

**What works:**
- `document.querySelectorAll('.feed-shared-update-v2')` — stable class, selects all post containers
- `container.innerText` — the ONLY reliable approach. LinkedIn randomises child class names (e.g. `YEEuyYyaIXxtMYJCroMntvVqvwlRCochEc`). Never use `querySelector` on granular child elements — they return empty.
- `document.querySelector('main').innerText` on `/notifications/` — clean, readable

**LinkedIn innerText line structure per post:**
```
lines[0] = "Feed post number X"       ← always skip
lines[1] = "Name likes this"          ← reaction header (if present) — OR author name
lines[2+] = real author name, title, degree, time, body
```

**Reactor/author attribution (critical bug fix):**
When a connection reacts to someone else's post, line 1 is `"Jayesh Agarwal likes this"`. Naive parsing grabs the reactor as the author. Fix:
```javascript
const reactorPattern = /^(.+?)\s+(likes|shared|commented on|reposted)\s+(this|a post)/i;
const reactorMatch = lines[1]?.match(reactorPattern);
let reactor = null;
let isReactedPost = false;
let authorStartIdx = 1;
if (reactorMatch) {
  reactor = reactorMatch[1].trim();   // "Jayesh Agarwal" — your connection
  isReactedPost = true;
  authorStartIdx = 3;                 // real author is further down
}
```

**Degree extraction:** `/• (1st|2nd|3rd\+?|Following)/` on raw container text.

**Promoted post detection:** `raw.includes('Promoted')` AND no degree match → skip.

**Time parsing:** `/(\\d+)([mhd])\\s*•/` → groups give number + unit.

---

## FILE STRUCTURE

```
jobseek-signal-tester/          ← Chrome extension (unpacked)
  manifest.json
  content.js                    ← scrape + pre-filter only (NO classification logic)
  background.js                 ← dedup, batch, POST to API
  popup.html
  popup.js
  utils/
    prefilter.js                ← lightweight noise killer
    dedup.js                    ← seen ID tracking
  icons/
    icon16.png
    icon48.png
    icon128.png
  README.md

src/app/api/signals/classify/   ← Next.js API route (add to existing Jobseek app)
  route.ts
```

---

## MANIFEST.JSON

```json
{
  "manifest_version": 3,
  "name": "Jobseek Signal Tester",
  "version": "0.2.0",
  "description": "Scrapes LinkedIn posts, pre-filters noise, classifies via Gemini. Dev use only.",
  "permissions": ["storage", "alarms", "scripting"],
  "host_permissions": [
    "https://www.linkedin.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.linkedin.com/feed/*",
        "https://www.linkedin.com/notifications/*"
      ],
      "js": ["utils/prefilter.js", "utils/dedup.js", "content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## UTILS/PREFILTER.JS — Lightweight Noise Killer

Runs locally in the extension. No API cost. Goal: kill the obvious garbage before it ever reaches Gemini.

```javascript
// Returns true if the post should be KEPT and sent to Gemini
// Returns false if it should be silently discarded
window.preFilter = function(post) {

  // 1. Kill promoted / ad posts
  if (post.isPromoted) return false;

  // 2. Kill posts with zero network relevance
  //    (unknown degree AND no reactor bridge = no relationship to leverage)
  if (post.degree === 'unknown' && !post.reactor) return false;

  // 3. Kill posts beyond 2nd degree with no reactor (3rd+ connections you have
  //    no warm path to — not useful for outreach)
  if (post.degree === '3rd+' && !post.reactor) return false;

  // 4. Kill posts with too little body text (no substance to classify)
  if ((post.body || '').trim().length < 40) return false;

  // 5. Kill pure social noise — birthday wishes, anniversaries, holiday greetings
  //    These are the most common 1st-degree feed polluters
  const socialNoise = /^(happy birthday|congratulations on (your )?\d+ (year|anniversary)|work anniversary|happy new year|happy diwali|happy eid|happy holi|happy (christmas|thanksgiving|halloween)|season'?s? greetings|wishing you (a )?(happy|great|wonderful))/i;
  if (socialNoise.test((post.body || '').trim())) return false;

  // 6. Kill pure engagement bait with no hiring/business content
  //    ("Like if you agree", "Tag someone who...", "Comment YES if...")
  const engagementBait = /^(like if you|tag someone who|comment (yes|no|below) if|double tap if|share if you)/i;
  if (engagementBait.test((post.body || '').trim())) return false;

  // 7. Kill posts older than 7 days — too stale to act on
  if (post.timeMinutes > 10080) return false;

  // Passed all filters — send to Gemini
  return true;
};
```

---

## CONTENT.JS — Scraper Only

The content script's sole job: extract raw post data and apply pre-filter. Zero classification logic here.

### Feed Extraction

```javascript
function extractFeedPosts() {
  const containers = document.querySelectorAll('.feed-shared-update-v2');
  const posts = [];

  containers.forEach((container) => {
    const raw = container.innerText || '';
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Degree check
    const degreeMatch = raw.match(/• (1st|2nd|3rd\+?|Following)/);
    const isPromoted = !degreeMatch && raw.includes('Promoted');
    const degree = degreeMatch ? degreeMatch[1] : 'unknown';

    // Reactor/author attribution fix
    const reactorPattern = /^(.+?)\s+(likes|shared|commented on|reposted)\s+(this|a post)/i;
    const reactorMatch = lines[1]?.match(reactorPattern);
    let reactor = null;
    let isReactedPost = false;
    let authorStartIdx = 1;
    if (reactorMatch) {
      reactor = reactorMatch[1].trim();
      isReactedPost = true;
      authorStartIdx = 3;
    }

    // Author extraction — search from authorStartIdx
    let author = '';
    for (let i = authorStartIdx; i < Math.min(lines.length, authorStartIdx + 5); i++) {
      const l = lines[i];
      if (
        !l.startsWith('Feed post') &&
        l.length > 1 && l.length < 80 &&
        !l.includes('•') &&
        !l.match(/^\d/) &&
        !reactorPattern.test(l)
      ) {
        author = l.trim();
        break;
      }
    }
    if (!author) return;

    // Title extraction
    const titleKeywords = /\b(CEO|CTO|CPO|CFO|COO|Founder|Co-founder|Head|Director|Manager|Lead|Engineer|Designer|Product|Investor|Partner|Builder|Operator|Advisor|VP|President|Officer)\b/i;
    const titleLine = lines.find((l, i) => i > authorStartIdx + 1 && l.length > 8 && l.length < 140 && titleKeywords.test(l));
    const title = titleLine || '';

    // Time
    const timeMatch = raw.match(/(\d+)([mhd])\s*•/);
    const timeStr = timeMatch ? `${timeMatch[1]}${timeMatch[2]} ago` : '';
    const timeMinutes = timeMatch
      ? (timeMatch[2] === 'm' ? parseInt(timeMatch[1])
        : timeMatch[2] === 'h' ? parseInt(timeMatch[1]) * 60
        : parseInt(timeMatch[1]) * 1440)
      : 99999;

    // Body — first substantial text block after header section
    const bodyStart = lines.findIndex((l, i) => i > authorStartIdx + 3 && l.length > 60 && l !== title && !titleKeywords.test(l));
    const body = bodyStart >= 0
      ? lines.slice(bodyStart, bodyStart + 8).join(' ').slice(0, 600)
      : lines.slice(authorStartIdx + 3, authorStartIdx + 10).join(' ').slice(0, 600);

    posts.push({ author, title, degree, reactor, isReactedPost, isPromoted, body, timeStr, timeMinutes, source: 'FEED' });
  });

  return posts;
}
```

### Notifications Extraction

```javascript
function extractNotificationPosts() {
  const main = document.querySelector('main, [role="main"]');
  if (!main) return [];

  const text = main.innerText || '';
  const posts = [];
  const blocks = text.split(/\n(?=\d+[mhd]\n|[A-Z][a-z]+ [A-Z][a-z]+,)/);

  blocks.forEach(block => {
    if (block.length < 20) return;
    const timeMatch = block.match(/^(\d+)([mhd])/m);
    const timeMinutes = timeMatch
      ? (timeMatch[2] === 'm' ? parseInt(timeMatch[1])
        : timeMatch[2] === 'h' ? parseInt(timeMatch[1]) * 60
        : parseInt(timeMatch[1]) * 1440)
      : 99999;

    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const author = lines[0]?.replace(/,.*$/, '').trim() || 'Unknown';

    posts.push({
      author,
      title: '',
      degree: '1st', // notifications are always from your network
      reactor: null,
      isReactedPost: false,
      isPromoted: false,
      body: block.slice(0, 600),
      timeStr: timeMatch ? `${timeMatch[1]}${timeMatch[2]} ago` : '',
      timeMinutes,
      source: 'NOTIFICATIONS'
    });
  });

  return posts;
}
```

### Main Orchestration

```javascript
(async function() {
  const path = window.location.pathname;
  let rawPosts = [];

  if (path.startsWith('/feed')) {
    rawPosts = extractFeedPosts();
    console.log(`[Jobseek] Feed scraped: ${document.querySelectorAll('.feed-shared-update-v2').length} containers → ${rawPosts.length} posts extracted`);
  } else if (path.startsWith('/notifications')) {
    rawPosts = extractNotificationPosts();
    console.log(`[Jobseek] Notifications scraped: ${rawPosts.length} blocks`);
  }

  if (rawPosts.length === 0) return;

  // Step 1: Pre-filter locally (free)
  const filtered = rawPosts.filter(p => window.preFilter(p));
  console.log(`[Jobseek] Pre-filter: ${rawPosts.length} → ${filtered.length} posts (killed ${rawPosts.length - filtered.length} noise posts)`);

  // Step 2: Dedup against already-seen post IDs
  const unseen = [];
  for (const post of filtered) {
    const postId = `${post.author}_${Math.floor(post.timeMinutes / 60)}h_${post.source}`.replace(/\s+/g, '_').toLowerCase();
    post._id = postId;
    const isSeen = await window.isSeenPost(postId);
    if (!isSeen) unseen.push(post);
  }
  console.log(`[Jobseek] Dedup: ${filtered.length} → ${unseen.length} unseen posts`);

  if (unseen.length === 0) return;

  // Step 3: Send to background for batching + API call
  chrome.runtime.sendMessage({ action: 'POSTS_TO_CLASSIFY', posts: unseen });

  // Step 4: MutationObserver for dynamically loaded posts (scroll)
  if (path.startsWith('/feed')) {
    const observer = new MutationObserver(() => {
      clearTimeout(window._jobseekScanTimer);
      window._jobseekScanTimer = setTimeout(async () => {
        const freshPosts = extractFeedPosts().filter(p => window.preFilter(p));
        const freshUnseen = [];
        for (const post of freshPosts) {
          const postId = `${post.author}_${Math.floor(post.timeMinutes / 60)}h_${post.source}`.replace(/\s+/g, '_').toLowerCase();
          post._id = postId;
          if (!(await window.isSeenPost(postId))) freshUnseen.push(post);
        }
        if (freshUnseen.length > 0) {
          console.log(`[Jobseek] Scroll detected ${freshUnseen.length} new posts`);
          chrome.runtime.sendMessage({ action: 'POSTS_TO_CLASSIFY', posts: freshUnseen });
        }
      }, 2000);
    });

    const feed = document.querySelector('.scaffold-layout__main, main');
    if (feed) observer.observe(feed, { childList: true, subtree: true });
  }
})();
```

---

## UTILS/DEDUP.JS

```javascript
// Track seen POST IDs (raw posts, before classification)
// Separate from signal IDs — we track both to avoid re-scraping and re-classifying

window.isSeenPost = async function(postId) {
  return new Promise(resolve => {
    chrome.storage.local.get(['seenPostIds'], (result) => {
      const seen = result.seenPostIds || [];
      resolve(seen.includes(postId));
    });
  });
};

window.markPostsSeen = async function(postIds) {
  return new Promise(resolve => {
    chrome.storage.local.get(['seenPostIds'], (result) => {
      const seen = result.seenPostIds || [];
      const merged = [...new Set([...seen, ...postIds])].slice(-1000); // keep last 1000
      chrome.storage.local.set({ seenPostIds: merged }, resolve);
    });
  });
};
```

---

## BACKGROUND.JS — Batcher + API Caller

```javascript
const JOBSEEK_API_URL = 'http://localhost:3000/api/signals/classify'; // change to prod URL when deployed
const BATCH_SIZE = 20; // max posts per Gemini call
let pendingPosts = [];
let batchTimer = null;

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'POSTS_TO_CLASSIFY' && message.posts?.length > 0) {
    pendingPosts.push(...message.posts);

    // Debounce: wait 3s for more posts before firing API call
    // This batches rapid scroll events into one call
    clearTimeout(batchTimer);
    batchTimer = setTimeout(() => flushBatch(), 3000);
  }
});

async function flushBatch() {
  if (pendingPosts.length === 0) return;

  // Take up to BATCH_SIZE posts, leave the rest for next flush
  const batch = pendingPosts.splice(0, BATCH_SIZE);
  const postIds = batch.map(p => p._id);

  console.log(`[Jobseek BG] Sending batch of ${batch.length} posts to classifier`);

  try {
    const response = await fetch(JOBSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: batch })
    });

    if (!response.ok) {
      console.error(`[Jobseek BG] API error: ${response.status}`);
      return;
    }

    const { signals } = await response.json();
    console.log(`[Jobseek BG] Received ${signals.length} signals from ${batch.length} posts`);

    // Mark all posts as seen (even those that produced no signal — don't re-classify)
    await markPostsSeenInStorage(postIds);

    // Store signals
    if (signals.length > 0) {
      await storeSignals(signals);
    }

    // If more posts are pending, flush next batch
    if (pendingPosts.length > 0) {
      batchTimer = setTimeout(() => flushBatch(), 1000);
    }

  } catch (err) {
    console.error('[Jobseek BG] Fetch failed:', err.message);
  }
}

async function markPostsSeenInStorage(postIds) {
  return new Promise(resolve => {
    chrome.storage.local.get(['seenPostIds'], (result) => {
      const seen = result.seenPostIds || [];
      const merged = [...new Set([...seen, ...postIds])].slice(-1000);
      chrome.storage.local.set({ seenPostIds: merged }, resolve);
    });
  });
}

async function storeSignals(newSignals) {
  return new Promise(resolve => {
    chrome.storage.local.get(['signals'], (result) => {
      const existing = result.signals || [];
      const existingIds = new Set(existing.map(s => s.id));
      const fresh = newSignals.filter(s => !existingIds.has(s.id));

      if (fresh.length === 0) return resolve();

      const updated = [...fresh, ...existing].slice(0, 100);
      chrome.storage.local.set({ signals: updated }, () => {
        chrome.action.setBadgeText({ text: String(updated.filter(s => s.status !== 'dismissed').length || '') });
        chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });
        console.log(`[Jobseek BG] Stored ${fresh.length} new signals. Total: ${updated.length}`);
        resolve();
      });
    });
  });
}

// Periodic scan alarm
chrome.alarms.create('periodic-scan', { delayInMinutes: 1, periodInMinutes: 90 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'periodic-scan') {
    chrome.tabs.query({ url: 'https://www.linkedin.com/feed/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['utils/prefilter.js', 'utils/dedup.js', 'content.js']
        });
      });
    });
  }
});
```

---

## NEXT.JS API ROUTE — `src/app/api/signals/classify/route.ts`

This is the only part that runs in the Jobseek Next.js app. Add this file.

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Use Flash for speed + cost efficiency — classification doesn't need Pro
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const SYSTEM_PROMPT = `You are a signal classifier for Jobseek — an AI-powered job-seeking assistant. You receive a batch of LinkedIn posts scraped from a job seeker's feed. Your job is to identify which posts represent genuine opportunities for them to reach out and start a hiring conversation.

SIGNAL TYPES (classify into one of these, or null):

TIER 1 — Direct hiring signals (highest priority):
- JOB_CHANGE: Person explicitly announced starting a new role, joining a company, or beginning a new position. They just landed somewhere — their old company may be hiring to backfill, or their new company is in growth mode.
- HIRING_POST: Company or person is actively and explicitly hiring for a specific role. Must be a real job post, not vague "join our journey" fluff.
- FUNDING_SIGNAL: Company raised funding (any stage). Headcount expansion is very likely. Strong outreach hook.

TIER 2 — Warm context signals (engage before reaching out):
- DECISION_MAKER_ACTIVE: A senior person (C-suite, VP, Director, Founder) posted substantively about their company, team, product, or growth. This is a warm moment to engage. Only classify this if: (a) the poster is clearly senior AND (b) the post is about their company — not a generic opinion or motivational post.
- COMPANY_MILESTONE: Company hit a public, verifiable milestone — product launch, customer count, revenue milestone, award, press feature. This is a congratulation hook.
- WARM_PATH_OPENED: A 1st-degree connection reacted to or shared a post from someone outside the user's direct network. The connection is the bridge — note who they are and why the original post matters.

NOT A SIGNAL (return null):
- Generic opinions, career advice, motivational content
- Personal life posts (travel, family, hobbies)
- Posts from 3rd-degree connections with no relationship bridge
- Vague "we're growing" or "exciting things coming" with no specifics
- Anything where there's no clear reason to reach out right now

For each post, return a JSON object. If not a signal, return null for that post.

Response format (strict JSON array, one entry per post, in same order as input):
[
  {
    "isSignal": true,
    "type": "JOB_CHANGE",
    "tier": 1,
    "confidence": 85,
    "reasoning": "Author announced starting a new role at Stripe as Head of Product",
    "outreachHook": "Congrats on the new role at Stripe — would love to connect as you build out the team"
  },
  null,
  ...
]

Rules:
- Return EXACTLY as many entries as there are input posts, in the same order
- If not a signal, the entry must be null (not an object with isSignal: false)
- confidence is 0–100 — how certain you are this is actionable
- outreachHook is a single natural sentence the user could use to open a conversation — NOT a full message, just the opener
- Be conservative: 10 high-quality signals beat 50 mediocre ones
- Never classify a post as a signal unless you'd genuinely advise the job seeker to reach out based on it`;

interface RawPost {
  _id: string;
  author: string;
  title: string;
  degree: string;
  reactor: string | null;
  isReactedPost: boolean;
  body: string;
  timeStr: string;
  timeMinutes: number;
  source: string;
}

interface ClassifiedSignal {
  id: string;
  type: string;
  tier: number;
  confidence: number;
  author: string;
  title: string;
  degree: string;
  reactor: string | null;
  reasoning: string;
  outreachHook: string;
  preview: string;
  timeStr: string;
  timeMinutes: number;
  source: string;
  detectedAt: string;
}

export async function POST(req: NextRequest) {
  try {
    const { posts }: { posts: RawPost[] } = await req.json();

    if (!posts || posts.length === 0) {
      return NextResponse.json({ signals: [] });
    }

    // Hard cap — never send more than 25 posts in one call
    const batch = posts.slice(0, 25);

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
    }));

    const prompt = `${SYSTEM_PROMPT}\n\nPosts to classify:\n${JSON.stringify(postsPayload, null, 2)}\n\nReturn a JSON array with exactly ${batch.length} entries (nulls for non-signals):`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse Gemini's JSON response — strip markdown fences if present
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[classify] Gemini returned non-JSON:', text.slice(0, 200));
      return NextResponse.json({ signals: [] });
    }

    const classifications: (ClassifiedSignal | null)[] = JSON.parse(jsonMatch[0]);

    // Merge classification results with original post metadata
    const signals: ClassifiedSignal[] = [];
    classifications.forEach((cls, i) => {
      if (!cls || !cls.isSignal) return;
      const post = batch[i];
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
        preview: post.body.slice(0, 280),
        timeStr: post.timeStr,
        timeMinutes: post.timeMinutes,
        source: post.source,
        detectedAt: new Date().toISOString(),
      });
    });

    console.log(`[classify] ${batch.length} posts → ${signals.length} signals`);
    return NextResponse.json({ signals });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[classify] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

---

## POPUP.HTML + POPUP.JS

### popup.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Jobseek Signals</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FAFAFB; width: 400px; max-height: 600px; overflow-y: auto; }

    .header {
      background: #4F46E5; color: white; padding: 14px 16px;
      display: flex; justify-content: space-between; align-items: center;
      position: sticky; top: 0; z-index: 10;
    }
    .header h1 { font-size: 15px; font-weight: 600; letter-spacing: -0.3px; }
    .count { background: rgba(255,255,255,0.2); border-radius: 20px; padding: 2px 8px; font-size: 12px; }
    .clear-btn { background: none; border: 1px solid rgba(255,255,255,0.4); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; }
    .clear-btn:hover { background: rgba(255,255,255,0.1); }

    .empty { padding: 40px 20px; text-align: center; color: #6B7280; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .empty .icon { font-size: 32px; }
    .empty p { font-size: 13px; line-height: 1.5; }
    .empty .hint { font-size: 11px; color: #9CA3AF; }

    .signal-card { background: white; margin: 8px 8px 0; border-radius: 10px; border: 1px solid #E5E7EB; padding: 12px 14px; cursor: pointer; transition: box-shadow 0.15s; }
    .signal-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .signal-card:last-child { margin-bottom: 8px; }

    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .signal-badge { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.4px; }
    /* Tier 1 */
    .badge-JOB_CHANGE { background: #FEE2E2; color: #DC2626; }
    .badge-HIRING_POST { background: #FEF3C7; color: #D97706; }
    .badge-FUNDING_SIGNAL { background: #D1FAE5; color: #059669; }
    /* Tier 2 */
    .badge-DECISION_MAKER_ACTIVE { background: #DBEAFE; color: #1D4ED8; }
    .badge-COMPANY_MILESTONE { background: #EDE9FE; color: #7C3AED; }
    .badge-WARM_PATH_OPENED { background: #FEF3C7; color: #B45309; }

    .card-meta { font-size: 11px; color: #9CA3AF; }
    .card-author { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 2px; }
    .card-title { font-size: 11px; color: #6B7280; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-reasoning { font-size: 11px; color: #6B7280; font-style: italic; margin-bottom: 6px; line-height: 1.4; }
    .card-hook { font-size: 12px; color: #4F46E5; background: #EEF2FF; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; line-height: 1.4; }
    .card-preview { font-size: 12px; color: #374151; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .degree-badge { display: inline-block; font-size: 10px; background: #F3F4F6; color: #6B7280; padding: 1px 5px; border-radius: 4px; margin-left: 4px; }
    .confidence { font-size: 10px; color: #9CA3AF; }

    .card-actions { display: flex; gap: 6px; margin-top: 10px; }
    .btn-primary { flex: 1; background: #4F46E5; color: white; border: none; padding: 7px 12px; border-radius: 7px; font-size: 12px; font-weight: 500; cursor: pointer; }
    .btn-primary:hover { background: #4338CA; }
    .btn-secondary { background: none; border: 1px solid #E5E7EB; color: #6B7280; padding: 7px 12px; border-radius: 7px; font-size: 12px; cursor: pointer; }
    .btn-secondary:hover { background: #F9FAFB; }

    .tier-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 4px; }
    .tier-1 { background: #DC2626; }
    .tier-2 { background: #D97706; }

    .scan-status { padding: 8px 16px; font-size: 11px; color: #9CA3AF; text-align: center; border-top: 1px solid #F3F4F6; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚡ Jobseek Signals</h1>
    <div style="display:flex;gap:8px;align-items:center">
      <span class="count" id="count">0</span>
      <button class="clear-btn" id="clearBtn">Clear all</button>
    </div>
  </div>
  <div id="content"></div>
  <div class="scan-status" id="scanStatus">Open LinkedIn to start scanning</div>
  <script src="popup.js"></script>
</body>
</html>
```

### popup.js

```javascript
const TYPE_LABELS = {
  JOB_CHANGE:            '🔴 Job Change',
  HIRING_POST:           '🟡 Hiring',
  FUNDING_SIGNAL:        '🟢 Funding',
  DECISION_MAKER_ACTIVE: '🔵 Decision Maker',
  COMPANY_MILESTONE:     '🟣 Milestone',
  WARM_PATH_OPENED:      '🟠 Warm Path',
};

function renderSignals(signals) {
  const content = document.getElementById('content');
  const countEl = document.getElementById('count');
  const active = signals.filter(s => s.status !== 'dismissed');
  countEl.textContent = active.length;

  if (active.length === 0) {
    content.innerHTML = `
      <div class="empty">
        <div class="icon">📡</div>
        <p>No signals yet.</p>
        <p class="hint">Open LinkedIn and scroll your feed.<br>Signals appear here automatically.</p>
      </div>`;
    return;
  }

  // Sort: tier 1 first, then by confidence desc, then recency
  const sorted = [...active].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return (a.timeMinutes || 0) - (b.timeMinutes || 0);
  });

  content.innerHTML = sorted.map(s => `
    <div class="signal-card" data-id="${s.id}">
      <div class="card-header">
        <span class="signal-badge badge-${s.type}">${TYPE_LABELS[s.type] || s.type}</span>
        <span class="card-meta">
          <span class="tier-dot tier-${s.tier}"></span>${s.timeStr || 'recently'}
          <span class="confidence"> · ${s.confidence || 0}% conf</span>
        </span>
      </div>
      <div class="card-author">
        ${s.author}
        ${s.degree && s.degree !== 'unknown' ? `<span class="degree-badge">${s.degree}</span>` : ''}
        ${s.reactor ? `<span class="degree-badge">via ${s.reactor}</span>` : ''}
      </div>
      ${s.title ? `<div class="card-title">${s.title}</div>` : ''}
      ${s.reasoning ? `<div class="card-reasoning">${s.reasoning}</div>` : ''}
      ${s.outreachHook ? `<div class="card-hook">💬 "${s.outreachHook}"</div>` : ''}
      <div class="card-preview">${s.preview || ''}</div>
      <div class="card-actions">
        <button class="btn-primary draft-btn" data-id="${s.id}">Draft Outreach</button>
        <button class="btn-secondary dismiss-btn" data-id="${s.id}">Dismiss</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.dismiss-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      chrome.storage.local.get(['signals'], (result) => {
        const updated = (result.signals || []).map(s => s.id === id ? { ...s, status: 'dismissed' } : s);
        chrome.storage.local.set({ signals: updated }, () => renderSignals(updated));
      });
    });
  });

  document.querySelectorAll('.draft-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const signal = active.find(s => s.id === id);
      if (signal) {
        console.log('[Jobseek] Draft outreach for signal:', JSON.stringify(signal, null, 2));
        alert(`Outreach opener:\n\n"${signal.outreachHook}"\n\nPerson: ${signal.author}\nTitle: ${signal.title}\nSignal: ${signal.type}\nReasoning: ${signal.reasoning}`);
      }
    });
  });
}

chrome.storage.local.get(['signals'], (result) => {
  const signals = result.signals || [];
  renderSignals(signals);
  if (signals.length > 0) {
    const last = new Date(signals[0].detectedAt);
    document.getElementById('scanStatus').textContent =
      `Last scan: ${last.toLocaleTimeString()} · ${signals.length} total`;
  }
});

document.getElementById('clearBtn').addEventListener('click', () => {
  chrome.storage.local.set({ signals: [], seenSignalIds: [], seenPostIds: [] }, () => {
    renderSignals([]);
    document.getElementById('scanStatus').textContent = 'Cleared. Open LinkedIn to rescan.';
  });
});
```

---

## ICONS

Generate three PNG files (`icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`) — solid indigo `#4F46E5` square with white "J". Use a Node.js script with the `canvas` package, or create 1x1 placeholders if canvas isn't available.

---

## README.md

```markdown
# Jobseek Signal Tester v2 — Gemini-Powered

LinkedIn scraper + Gemini Flash classifier. Local test build only.

## Setup (2 steps)

### 1. Start Jobseek locally
```bash
cd /path/to/jobseek
npm run dev   # runs on http://localhost:3000
```
Make sure `GEMINI_API_KEY` is set in `.env.local`.

### 2. Load the extension
1. Go to `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" → select this `jobseek-signal-tester/` folder
4. Pin the extension

## How to Test

1. Go to `linkedin.com/feed/` (logged in)
2. Scroll slowly through 10–15 posts
3. Watch the console: `[Jobseek] Pre-filter: 18 → 9 posts (killed 9 noise posts)`
4. After 3–5 seconds: `[Jobseek BG] Sending batch of 9 posts to classifier`
5. Click the extension icon — signal cards appear with Gemini's reasoning + outreach hook

## What to Validate

**Signal quality:**
- [ ] Signals are genuinely job-relevant (not random posts)
- [ ] Each card shows Gemini's one-line reasoning (why it fired)
- [ ] Each card shows a natural outreach opener
- [ ] Confidence score reflects actual signal strength
- [ ] WARM_PATH_OPENED cards show the reactor (who bridged the connection)

**Pre-filter working:**
- [ ] Promoted posts never appear
- [ ] Birthday/anniversary posts never appear
- [ ] Console shows `killed X noise posts` on every scan

**System:**
- [ ] Dedup works — same posts don't re-appear after refresh
- [ ] Badge count updates
- [ ] Dismiss works
- [ ] MutationObserver fires on scroll (check console logs)

## Cost Sanity Check

Open DevTools → Network tab, filter for `/api/signals/classify`. Each call should send 15–20 posts and return in < 3s. Gemini Flash at this batch size costs < $0.001 per scan.

## Checking Storage

In DevTools console on any LinkedIn page:
`chrome.storage.local.get(null, console.log)`

To reset fully:
`chrome.storage.local.clear()`
```

---

## VALIDATION CHECKLIST FOR CLAUDE CODE

After building, verify before handing back:

- [ ] Extension loads in Chrome without errors in `chrome://extensions`
- [ ] No console errors on LinkedIn feed page
- [ ] Pre-filter fires and logs noise kill count to console
- [ ] API route exists at `src/app/api/signals/classify/route.ts` and compiles with no TypeScript errors
- [ ] Background service worker successfully POSTs to local API (check Network tab)
- [ ] At least one signal card appears in popup after scrolling feed
- [ ] Signal card shows: author, title, degree, reasoning, outreach hook, confidence
- [ ] Null responses from Gemini (non-signals) are correctly ignored
- [ ] Dedup works — scrolling same posts twice doesn't re-classify them
- [ ] Badge count updates correctly
- [ ] Dismiss and Clear all work
- [ ] MutationObserver fires on scroll
```
