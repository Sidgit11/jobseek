# Jobseek Signal Tester v2 — Gemini-Powered

LinkedIn scraper + Gemini Flash classifier. Local test build only.

## Setup (2 steps)

### 1. Start Jobseek locally
```bash
cd /path/to/jobseek
npm run dev   # runs on http://localhost:3000
```
Make sure `GOOGLE_AI_API_KEY` is set in `.env.local`.

### 2. Load the extension
1. Go to `chrome://extensions`
2. Enable **Developer mode** (toggle, top right)
3. Click **"Load unpacked"** → select the `extension/` folder inside the jobseek project
4. Pin the extension to your toolbar

## How to Test

1. Go to `linkedin.com/feed/` (logged in)
2. Scroll slowly through 10–15 posts
3. Watch the console (DevTools → Console on the LinkedIn tab):
   - `[Jobseek] Feed scraped: 18 containers → 15 posts extracted`
   - `[Jobseek] Pre-filter: 15 → 9 posts (killed 6 noise posts)`
   - `[Jobseek] Dedup: 9 → 9 unseen posts`
   - `[Jobseek BG] Sending batch of 9 posts to classifier`
   - `[Jobseek BG] Received 3 signals from 9 posts`
4. Click the extension icon — signal cards appear with Gemini's reasoning + outreach hook
5. Also visit `linkedin.com/notifications/` for job change signals from your network

## What to Validate

**Signal quality:**
- [ ] Signals are genuinely job-relevant (not random posts)
- [ ] Each card shows Gemini's one-line reasoning (why it fired)
- [ ] Each card shows a natural outreach opener
- [ ] Confidence score (0–100) reflects actual signal strength
- [ ] WARM_PATH_OPENED cards show `via [reactor name]` (who bridged the connection)

**Pre-filter working:**
- [ ] Promoted posts never appear
- [ ] Birthday/anniversary posts never appear
- [ ] Console shows `killed X noise posts` on every scan

**System:**
- [ ] Dedup works — same posts don't re-appear after refresh
- [ ] Badge count on extension icon updates
- [ ] Dismiss removes a signal from the list
- [ ] Clear all resets everything
- [ ] MutationObserver fires on scroll (new posts detected as you scroll down)

## Cost Sanity Check

Open DevTools → Network tab, filter for `/api/signals/classify`. Each call should:
- Send 15–20 posts
- Return in < 3 seconds
- Cost < $0.001 per scan (Gemini Flash pricing)

## Checking Raw Storage

In DevTools console on any LinkedIn page:
```javascript
chrome.storage.local.get(null, console.log)
```
Shows all stored signals and seen post IDs.

To fully reset:
```javascript
chrome.storage.local.clear()
```

## Architecture

```
LinkedIn feed/notifications
  → content.js (scrape raw posts via .feed-shared-update-v2 + innerText)
    → prefilter.js (kill ads, noise, short posts — free, local)
      → dedup.js (skip already-seen post IDs)
        → background.js (batch 20 posts, POST to API after 3s debounce)
          → /api/signals/classify (Next.js route)
            → Gemini Flash (classify → structured signals JSON)
              → chrome.storage.local (store signals)
                → popup.html (display ranked signal cards)
```

## Known LinkedIn DOM Notes

- `.feed-shared-update-v2` is a stable class — use it to select post containers
- LinkedIn randomises child class names — always use `container.innerText`, never child querySelector
- Notifications: `document.querySelector('main').innerText` is clean and reliable
- When a connection likes/shares someone else's post, line 1 is `"Name likes this"` — parser detects this and skips to the real author; the reactor is saved as warm context
