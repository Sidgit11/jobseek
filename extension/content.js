// content.js — Jobseek Signal Tester v2
// Sole job: scrape raw posts + pre-filter. Zero classification logic here.
// Classification happens in the Next.js API via Gemini.

// ─── Company Name Validation Helpers ────────────────────────────────────────

// Detect if a string looks like a person's name (e.g., "Aditya Sharma", "Suravi Shome")
function looksLikePersonName(str) {
  if (!str || str.length < 3) return false;
  const words = str.trim().split(/\s+/);
  // Person names: 2-3 short capitalized words, no special chars
  if (words.length < 2 || words.length > 4) return false;
  // Each word should be short and start with uppercase
  const allCapWords = words.every(w => /^[A-Z][a-z]{1,15}\.?$/.test(w));
  if (!allCapWords) return false;
  // Reject if it contains common company words
  if (/\b(Inc|Corp|Ltd|LLC|Labs|Tech|AI|Group|Software|Analytics|Media|Health|Digital)\b/i.test(str)) return false;
  return true;
}

// Detect if a string looks like a job title (e.g., "Product Manager", "Senior Engineer")
function looksLikeJobTitle(str) {
  if (!str) return false;
  const jobTitlePatterns = /\b(Manager|Engineer|Developer|Designer|Director|Lead|Head|VP|Analyst|Architect|Scientist|Specialist|Consultant|Associate|Intern|Officer|Executive|Coordinator|Administrator|President|Chief)\b/i;
  return jobTitlePatterns.test(str);
}

// ─── Feed Extraction ───────────────────────────────────────────────────────

function extractFeedPosts() {
  const containers = document.querySelectorAll('.feed-shared-update-v2');
  const posts = [];

  containers.forEach((container) => {
    const raw = container.innerText || '';
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Degree + promoted + suggested detection
    const degreeMatch = raw.match(/• (1st|2nd|3rd\+?|Following)/);
    const isPromoted = !degreeMatch && raw.includes('Promoted');
    const isSuggested = !degreeMatch && /\bSuggested\b/.test(lines[0] || '');
    const degree = degreeMatch ? degreeMatch[1] : (isSuggested ? 'suggested' : 'unknown');

    // Skip suggested posts entirely — no network relevance
    if (isSuggested) return;

    // Reactor/author attribution fix
    // When a connection reacts to someone else's post, LinkedIn shows:
    //   "Jayesh Agarwal likes this"  /  "X loves this"  /  "X celebrates this"  etc.
    // All LinkedIn reaction verbs: likes, loves, celebrates, supports, finds insightful,
    //   finds funny, shared, commented on, reposted
    const reactorPattern = /^(.+?)\s+(likes?|loves?|celebrates?|supports?|finds? (?:insightful|funny)|shared|commented on|reposted)\s+(this|a post)/i;
    let reactor = null;
    let isReactedPost = false;
    let authorStartIdx = 1;

    // Check lines[0] and lines[1] — LinkedIn sometimes puts the reactor line first
    for (let li = 0; li <= 1 && li < lines.length; li++) {
      const reactorMatch = lines[li]?.match(reactorPattern);
      if (reactorMatch) {
        reactor = reactorMatch[1].trim();
        isReactedPost = true;
        authorStartIdx = li + 2; // skip reactor line + any gap, real author is further down
        break;
      }
    }

    // Author extraction — search from authorStartIdx, skip noise lines
    let author = '';
    let authorLineIdx = -1;
    const noiseWords = /^(Feed post|Suggested|Promoted|Sponsored|\d|Follow|View|More|…$)/i;
    for (let i = authorStartIdx; i < Math.min(lines.length, authorStartIdx + 6); i++) {
      const l = lines[i];
      if (
        l.length > 1 && l.length < 80 &&
        !l.includes('•') &&
        !noiseWords.test(l) &&
        !reactorPattern.test(l)
      ) {
        author = l.trim();
        authorLineIdx = i;
        break;
      }
    }
    if (!author) return;

    // Title extraction — first line matching senior title keywords AFTER the author's name line.
    // For reacted posts ("Neelesh Soni likes this → Will Evans' post"), we must search
    // after the AUTHOR line (Will Evans), not after the reactor line — otherwise we'd
    // pick up the reactor's title (e.g. "Co-founder@Tectonic") instead of the author's.
    const titleKeywords = /\b(CEO|CTO|CPO|CFO|COO|Founder|Co-founder|Head|Director|Manager|Lead|Engineer|Designer|Product|Investor|Partner|Builder|Operator|Advisor|VP|President|Officer)\b/i;
    const titleSearchStart = authorLineIdx >= 0 ? authorLineIdx + 1 : authorStartIdx + 1;
    const titleLine = lines.find((l, i) => i >= titleSearchStart && i < titleSearchStart + 3 && l.length > 8 && l.length < 140 && l !== author && titleKeywords.test(l));
    const title = titleLine || '';

    // Time parsing
    const timeMatch = raw.match(/(\d+)([mhd])\s*•/);
    const timeStr = timeMatch ? `${timeMatch[1]}${timeMatch[2]} ago` : '';
    const timeMinutes = timeMatch
      ? (timeMatch[2] === 'm' ? parseInt(timeMatch[1])
        : timeMatch[2] === 'h' ? parseInt(timeMatch[1]) * 60
        : parseInt(timeMatch[1]) * 1440)
      : 99999;

    // Body — first substantial text block after the header section
    const bodyStart = lines.findIndex((l, i) => i > authorStartIdx + 3 && l.length > 60 && l !== title && !titleKeywords.test(l));
    const body = bodyStart >= 0
      ? lines.slice(bodyStart, bodyStart + 12).join(' ').slice(0, 1200)
      : lines.slice(authorStartIdx + 3, authorStartIdx + 14).join(' ').slice(0, 1200);

    // Post URL extraction — try multiple strategies:
    // 1. data-urn on the container itself
    // 2. data-urn on any parent element (LinkedIn sometimes nests the update inside a wrapper)
    // 3. Anchor links containing activity URNs or /posts/ slugs
    // 4. Extract activity ID from any href or attribute as last resort
    let postUrl = null;

    // Strategy 1 & 2: data-urn on container or ancestors
    let urnEl = container;
    for (let depth = 0; depth < 5 && urnEl; depth++) {
      const urn = urnEl.dataset?.urn || urnEl.getAttribute('data-urn');
      if (urn && urn.includes('activity')) {
        postUrl = 'https://www.linkedin.com/feed/update/' + urn + '/';
        break;
      }
      urnEl = urnEl.parentElement;
    }

    // Strategy 3: scan all anchors for post permalink patterns
    if (!postUrl) {
      const allAnchors = Array.from(container.querySelectorAll('a[href]'));
      for (const a of allAnchors) {
        const h = a.getAttribute('href') || '';
        if (h.includes('/feed/update/') || h.includes('/posts/')) {
          try {
            const parsed = new URL(h, 'https://www.linkedin.com');
            postUrl = parsed.origin + parsed.pathname;
          } catch { /* skip */ }
          break;
        }
      }
    }

    // Strategy 4: regex for activity ID in any anchor href
    if (!postUrl) {
      const allAnchors = Array.from(container.querySelectorAll('a[href]'));
      for (const a of allAnchors) {
        const h = a.getAttribute('href') || '';
        const actMatch = h.match(/activity[:\-](\d{19,20})/);
        if (actMatch) {
          postUrl = 'https://www.linkedin.com/feed/update/urn:li:activity:' + actMatch[1] + '/';
          break;
        }
      }
    }

    // LinkedIn profile URLs — for reacted posts, the FIRST /in/ link is the reactor,
    // the SECOND is the actual author. We need to get the right one for each.
    const allProfileAnchors = Array.from(container.querySelectorAll('a[href*="/in/"]'));
    const profileUrls = [];
    const seenProfiles = new Set();
    for (const a of allProfileAnchors) {
      const href = a.getAttribute('href') || '';
      const match = href.match(/\/in\/([^/?]+)/);
      if (match && !seenProfiles.has(match[1])) {
        seenProfiles.add(match[1]);
        profileUrls.push('https://www.linkedin.com/in/' + match[1]);
      }
    }

    let authorLinkedInUrl = null;
    let reactorLinkedInUrl = null;

    if (isReactedPost && profileUrls.length >= 2) {
      // First profile link = reactor, second = author
      reactorLinkedInUrl = profileUrls[0];
      authorLinkedInUrl = profileUrls[1];
    } else if (profileUrls.length >= 1) {
      authorLinkedInUrl = profileUrls[0];
    }

    posts.push({ author, title, degree, reactor, isReactedPost, isPromoted, body, timeStr, timeMinutes, source: 'FEED', postUrl, authorLinkedInUrl, reactorLinkedInUrl });
  });

  return posts;
}

// ─── Notifications Extraction ──────────────────────────────────────────────

function extractNotificationPosts() {
  const posts = [];

  // Strategy 1: DOM-based extraction using notification card elements
  // LinkedIn changes class names frequently — use a broad set of selectors
  const cards = document.querySelectorAll(
    '.nt-card, .notification-card, [data-urn*="notification"], ' +
    '.artdeco-list__item, .nt-card__content, ' +
    'section.mn-nt-list li, div[class*="notification"] > div[class*="card"], ' +
    // Modern LinkedIn notification selectors
    '[role="article"], [role="listitem"], ' +
    'li[class*="notification"], li[class*="Notification"], ' +
    '.artdeco-card, [data-view-name*="notification"], ' +
    // Ultra-broad: any list item inside main content area
    'main li, [role="main"] li, .scaffold-layout__main li'
  );

  if (cards.length > 0) {
    console.log(`[Jobseek] Found ${cards.length} notification card elements via DOM`);
    // Filter out tiny/empty cards and cards that are just containers for other matched cards
    const filteredCards = Array.from(cards).filter(card => {
      const text = (card.innerText || '').trim();
      return text.length >= 15 && text.length < 2000; // skip too-short and too-long (wrapper) elements
    });
    console.log(`[Jobseek] After filtering: ${filteredCards.length} notification cards with usable text`);
    filteredCards.forEach(card => {
      const cardText = (card.innerText || '').trim();
      if (cardText.length < 15) return;

      // Extract author: look for bold/strong text, profile links, or structured name elements
      let author = 'Unknown';
      const boldEl = card.querySelector('strong, .nt-card__text--bold, .t-bold, [class*="text--bold"]');
      if (boldEl) {
        author = boldEl.textContent.trim().replace(/,.*$/, '');
      } else {
        // Try profile link text
        const profileLink = card.querySelector('a[href*="/in/"]');
        if (profileLink) {
          author = profileLink.textContent.trim().replace(/,.*$/, '');
        }
      }

      // Skip if author looks like a timestamp or noise
      if (/^\d+[mhd]$/.test(author) || author.length < 2) {
        // Fallback: parse text lines, skip timestamps
        const lines = cardText.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (/^\d+[mhd]$/.test(line)) continue;  // skip "38m", "1h"
          if (/^(Notification|Settings|Mark|Delete)/i.test(line)) continue;
          if (line.length >= 3 && line.length <= 80 && /[a-zA-Z]/.test(line)) {
            author = line.replace(/,.*$/, '').trim();
            break;
          }
        }
      }

      // Extract timestamp
      let timeMinutes = 99999;
      let timeStr = '';
      const timeEl = card.querySelector('time, .nt-card__time-ago, [class*="time-ago"], [class*="time-badge"]');
      if (timeEl) {
        const tText = (timeEl.textContent || timeEl.getAttribute('datetime') || '').trim();
        const tMatch = tText.match(/(\d+)\s*([mhd])/);
        if (tMatch) {
          timeMinutes = tMatch[2] === 'm' ? parseInt(tMatch[1])
            : tMatch[2] === 'h' ? parseInt(tMatch[1]) * 60
            : parseInt(tMatch[1]) * 1440;
          timeStr = `${tMatch[1]}${tMatch[2]} ago`;
        }
      }
      if (!timeStr) {
        // Fallback: find timestamp in text
        const tMatch = cardText.match(/(\d+)\s*([mhd])\b/);
        if (tMatch) {
          timeMinutes = tMatch[2] === 'm' ? parseInt(tMatch[1])
            : tMatch[2] === 'h' ? parseInt(tMatch[1]) * 60
            : parseInt(tMatch[1]) * 1440;
          timeStr = `${tMatch[1]}${tMatch[2]} ago`;
        }
      }

      // Extract author LinkedIn URL from profile links
      let authorLinkedInUrl = null;
      const profLink = card.querySelector('a[href*="/in/"]');
      if (profLink) {
        try { authorLinkedInUrl = new URL(profLink.href, 'https://www.linkedin.com').href; } catch {}
      }

      // Extract post URL if notification links to a post
      let postUrl = null;
      const postLink = card.querySelector('a[href*="/feed/update/"], a[href*="activity"], a[href*="/posts/"]');
      if (postLink) {
        try { postUrl = new URL(postLink.href, 'https://www.linkedin.com').href; } catch {}
      }
      // Also check the card itself if it's an anchor
      if (!postUrl && card.tagName === 'A') {
        const href = card.getAttribute('href') || '';
        if (href.includes('/feed/update/') || href.includes('/posts/') || href.includes('activity')) {
          try { postUrl = new URL(href, 'https://www.linkedin.com').href; } catch {}
        }
      }

      // Clean body: remove the author name and timestamp from the beginning
      const body = cardText.replace(/^\d+[mhd]\s*/, '').slice(0, 1200);

      if (author === 'Unknown' || /^\d+[mhd]$/.test(author)) return; // skip if still no name

      // Detect if this is a company/jobs notification (e.g. "airbnb: new opportunity in India")
      // vs a person notification (e.g. "John Smith posted about...")
      // Company job notifications often contain keywords about jobs/opportunities and
      // the author is a company page, not a person
      const isJobNotification = /\b(new (?:job|role|opportunity|opening|position)|hiring|is looking for|are hiring|job alert|new opportunities)\b/i.test(body);
      const companyProfileLink = card.querySelector('a[href*="/company/"]');

      // If a /company/ link exists, use that for the author (more reliable than bold text)
      let notificationAuthor = author;
      let notificationAuthorUrl = authorLinkedInUrl;
      if (companyProfileLink) {
        const companyText = (companyProfileLink.textContent || '').trim();
        if (companyText.length > 1) notificationAuthor = companyText;
        try { notificationAuthorUrl = new URL(companyProfileLink.href, 'https://www.linkedin.com').href; } catch {}
      }

      posts.push({
        author: notificationAuthor,
        title: '',
        degree: '1st',
        reactor: null,
        isReactedPost: false,
        isPromoted: false,
        body,
        timeStr,
        timeMinutes,
        source: isJobNotification ? 'NOTIFICATION_JOB_ALERT' : 'NOTIFICATIONS',
        postUrl,
        authorLinkedInUrl: notificationAuthorUrl,
      });
    });
  }

  // Strategy 2: Fallback to text-based extraction if DOM selectors found nothing
  if (posts.length === 0) {
    const main = document.querySelector('main, [role="main"]');
    if (!main) return [];

    console.log('[Jobseek] Notification DOM selectors found nothing — falling back to text parsing');
    const text = main.innerText || '';
    const blocks = text.split(/\n(?=\d+[mhd]\n|[A-Z][a-z]+ [A-Z][a-z]+,)/);

    blocks.forEach(block => {
      if (block.length < 20) return;

      const timeMatch = block.match(/(\d+)([mhd])/m);
      const timeMinutes = timeMatch
        ? (timeMatch[2] === 'm' ? parseInt(timeMatch[1])
          : timeMatch[2] === 'h' ? parseInt(timeMatch[1]) * 60
          : parseInt(timeMatch[1]) * 1440)
        : 99999;

      // Find the first line that looks like a name (skip timestamps and noise)
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      let author = 'Unknown';
      for (const line of lines) {
        if (/^\d+[mhd]$/.test(line)) continue;  // skip "38m", "1h", "2d"
        if (/^(Notification|Settings|Mark|Delete|ago$)/i.test(line)) continue;
        if (line.length >= 3 && line.length <= 80 && /[a-zA-Z]/.test(line)) {
          author = line.replace(/,.*$/, '').trim();
          break;
        }
      }

      if (author === 'Unknown' || /^\d+[mhd]$/.test(author)) return;

      posts.push({
        author,
        title: '',
        degree: '1st',
        reactor: null,
        isReactedPost: false,
        isPromoted: false,
        body: block.slice(0, 1200),
        timeStr: timeMatch ? `${timeMatch[1]}${timeMatch[2]} ago` : '',
        timeMinutes,
        source: 'NOTIFICATIONS',
      });
    });
  }

  return posts;
}

// ─── Jobs Page Extraction ─────────────────────────────────────────────────

function extractJobPosts() {
  // LinkedIn jobs page renders cards in various list containers
  const jobCards = document.querySelectorAll(
    '.jobs-search-results__list-item, .scaffold-layout__list-item, .job-card-container, ' +
    '.jobs-search-results-list li, .jobs-search-results__list li, ' +
    // Broader selectors for LinkedIn's varying job card structures
    '[data-job-id], .job-card-list__entity-lockup, .jobs-search-two-pane__job-card-container, ' +
    '.scaffold-layout__list-container li'
  );
  const posts = [];

  console.log(`[Jobseek] extractJobPosts: found ${jobCards.length} job card elements`);

  jobCards.forEach(card => {
    const raw = card.innerText || '';
    if (raw.length < 30) return;

    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Job title — try the main job link text first, fall back to first meaningful line
    let jobTitle = '';
    const titleLink = card.querySelector('a[href*="/jobs/view/"], a[href*="/jobs/collections/"]');
    if (titleLink) {
      jobTitle = (titleLink.textContent || '').trim();
    }
    if (!jobTitle || jobTitle.length < 3) {
      jobTitle = lines[0] || '';
    }
    if (jobTitle.length < 3 || jobTitle.length > 150) return;

    // Company name — try multiple strategies in order of reliability:
    // 1. /company/ link text (most reliable)
    // 2. Company logo alt text (LinkedIn sets alt="CompanyName" on job card logos)
    // 3. aria-label on the card (often contains "at CompanyName")
    // 4. Text parsing from card lines
    let company = '';
    const companyLink = card.querySelector('a[href*="/company/"]');
    if (companyLink) {
      company = (companyLink.textContent || '').trim();
    }
    // Strategy 2: Company logo img alt attribute
    if (!company) {
      const logo = card.querySelector('img[alt]');
      if (logo) {
        const alt = (logo.getAttribute('alt') || '').trim();
        // LinkedIn logo alt is usually "CompanyName logo" or just "CompanyName"
        if (alt && alt.length > 1 && alt.length < 60 && !/^(LinkedIn|Photo|Avatar)/i.test(alt)) {
          company = alt.replace(/\s*logo$/i, '').trim();
        }
      }
    }
    // Strategy 3: aria-label containing "at CompanyName"
    if (!company) {
      // Check the job link or card for aria-label like "Product Manager at Stripe, Bengaluru"
      const ariaEl = card.querySelector('[aria-label]') || titleLink;
      if (ariaEl) {
        const aria = ariaEl.getAttribute('aria-label') || '';
        const atMatch = aria.match(/\bat\s+([^,]+)/i);
        if (atMatch && atMatch[1].trim().length > 1) {
          company = atMatch[1].trim();
        }
      }
    }
    // Strategy 4: Text parsing from card lines
    if (!company) {
      const noisePatterns = /^(Easy Apply|Promoted|Actively|Be an early|\d+ applicant|\d+ connection|Viewed|Applied|Saved|new|ago|with verification|Closed|Reposted|Actively recruiting)/i;
      for (let i = 1; i < Math.min(lines.length, 5); i++) {
        const line = lines[i];
        if (line === jobTitle) continue;
        // Strip "with verification" suffix that LinkedIn adds to some company names
        const cleaned = line.replace(/\s+with verification$/i, '').trim();
        if (!cleaned || cleaned === jobTitle) continue;
        if (cleaned.includes(',') && /\b(India|Remote|Hybrid|Karnataka|Maharashtra|Delhi|Mumbai|Bengaluru|California|New York)\b/i.test(cleaned)) continue;
        if (noisePatterns.test(cleaned)) continue;
        if (/^\d+\s*(hour|day|week|month)s?\s*ago/i.test(cleaned)) continue;
        if (/^\d+[mhd]\b/.test(cleaned)) continue;
        if (cleaned.length >= 2 && cleaned.length <= 80) {
          company = cleaned;
          break;
        }
      }
    }

    // Location — line containing city/state or remote/hybrid
    const location = lines.find((l, i) => i >= 1 && l !== jobTitle && l !== company && (l.includes(',') || /remote|hybrid|on-?site/i.test(l))) || '';

    // Time posted — look for "X days ago", "X hours ago" etc.
    const timeMatch = raw.match(/(\d+)\s*(hour|day|week|month)s?\s*ago/i);
    let timeMinutes = 99999;
    let timeStr = '';
    if (timeMatch) {
      const num = parseInt(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      timeMinutes = unit === 'hour' ? num * 60
        : unit === 'day' ? num * 1440
        : unit === 'week' ? num * 10080
        : num * 43200;
      timeStr = `${num} ${unit}${num > 1 ? 's' : ''} ago`;
    }

    // Job URL — keep full URL with query params (currentJobId needed for direct links)
    let postUrl = null;
    const jobLink = card.querySelector('a[href*="/jobs/view/"], a[href*="/jobs/collections/"]');
    if (jobLink) {
      try {
        const parsed = new URL(jobLink.href, 'https://www.linkedin.com');
        postUrl = parsed.href;  // full URL including query params
      } catch { /* skip */ }
    }

    // Company LinkedIn URL (companyLink already found above)
    let authorLinkedInUrl = null;
    if (companyLink) {
      const href = companyLink.getAttribute('href') || '';
      const match = href.match(/\/company\/[^/?]+/);
      if (match) authorLinkedInUrl = 'https://www.linkedin.com' + match[0];
    }

    // Skip if company name still looks like the job title (extraction failed)
    if (company && company === jobTitle) company = '';

    const body = `Job: ${jobTitle}${company ? ' at ' + company : ''}. ${location}. ${lines.slice(3).join(' ').slice(0, 400)}`;

    posts.push({
      author: company,
      title: jobTitle,
      degree: 'job',
      reactor: null,
      isReactedPost: false,
      isPromoted: false,
      body,
      timeStr,
      timeMinutes,
      source: 'JOBS',
      postUrl,
      authorLinkedInUrl,
    });
  });

  return posts;
}

// ─── Recommended Jobs Widget Extraction (Feed) ───────────────────────────

function extractRecommendedJobs() {
  const posts = [];

  // Strategy 1: Find the widget by heading text ("Jobs recommended for you", etc.)
  // LinkedIn renders these as sections with a recognizable heading and job cards inside.
  const allHeadings = document.querySelectorAll('h2, h3, span, div');
  let widgetContainers = [];

  for (const el of allHeadings) {
    const text = (el.textContent || '').trim();
    if (/jobs?\s+recommended\s+for\s+you/i.test(text) ||
        /recommended.*jobs/i.test(text) ||
        /jobs?\s+picked\s+for\s+you/i.test(text)) {
      // Walk up to find the widget wrapper (typically 2-5 levels up)
      let wrapper = el;
      for (let i = 0; i < 6; i++) {
        if (!wrapper.parentElement) break;
        wrapper = wrapper.parentElement;
        // Stop when we hit something that looks like a feed-level container
        if (wrapper.classList.contains('feed-shared-update-v2') ||
            wrapper.tagName === 'SECTION' ||
            wrapper.tagName === 'MAIN' ||
            (wrapper.offsetHeight && wrapper.offsetHeight > 300)) {
          break;
        }
      }
      if (wrapper && wrapper !== document.body) {
        widgetContainers.push(wrapper);
      }
    }
  }

  // Strategy 2: Direct class-based selectors for known LinkedIn widget containers
  const classSelectors = [
    '.jobs-home-upsell',
    '.feed-shared-jobs',
    '.feed-shared-jobs-module',
    '[data-urn*="jobPosting"]',
    '.jobs-upsell-card',
    '.feed-job-card',
  ];
  for (const sel of classSelectors) {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) {
      widgetContainers.push(...els);
    }
  }

  // Deduplicate containers
  widgetContainers = [...new Set(widgetContainers)];

  if (widgetContainers.length === 0) return posts;

  console.log(`[Jobseek] Found ${widgetContainers.length} recommended jobs widget container(s)`);

  for (const container of widgetContainers) {
    // Find individual job cards within the widget
    // Strategy A: look for anchor links to /jobs/view/ or /jobs/collections/ — each is a job card
    const jobLinks = container.querySelectorAll('a[href*="/jobs/view/"], a[href*="/jobs/collections/"]');

    if (jobLinks.length > 0) {
      for (const link of jobLinks) {
        // The card is usually the link itself or a nearby ancestor
        let card = link;
        for (let i = 0; i < 4; i++) {
          if (!card.parentElement || card.parentElement === container) break;
          card = card.parentElement;
        }

        const raw = (card.innerText || '').trim();
        if (raw.length < 15) continue;

        const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Job title — clean link text: strip newlines, "with verification" badge
        const rawLinkText = (link.textContent || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        const jobTitle = (rawLinkText.replace(/\s*with verification$/i, '').trim()).length > 3
          ? rawLinkText.replace(/\s*with verification$/i, '').trim()
          : (lines[0] || '').replace(/\s*with verification$/i, '').trim();
        if (jobTitle.length < 3) continue;

        // Company name — look for a company link or the line after the title
        let company = '';
        const companyLink = card.querySelector('a[href*="/company/"]');
        if (companyLink) {
          company = (companyLink.textContent || '').trim();
        }
        if (!company) {
          // Company is often the line right after the job title
          const titleIdx = lines.indexOf(jobTitle);
          if (titleIdx >= 0 && titleIdx + 1 < lines.length) {
            company = lines[titleIdx + 1];
          } else if (lines.length > 1) {
            company = lines[1];
          }
        }

        // Location — line containing city/state patterns or remote/hybrid
        const location = lines.find(l =>
          l !== jobTitle && l !== company &&
          (l.includes(',') || /remote|hybrid|on-?site/i.test(l) ||
           /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(l))
        ) || '';

        // Job URL — keep full URL with query params for direct job links
        let postUrl = null;
        try {
          const parsed = new URL(link.getAttribute('href'), 'https://www.linkedin.com');
          postUrl = parsed.href;
        } catch { /* skip */ }

        // Company LinkedIn URL
        let authorLinkedInUrl = null;
        if (companyLink) {
          const href = companyLink.getAttribute('href') || '';
          const match = href.match(/\/company\/[^/?]+/);
          if (match) authorLinkedInUrl = 'https://www.linkedin.com' + match[0];
        }

        const body = `Job: ${jobTitle} at ${company}. ${location}. ${lines.filter(l => l !== jobTitle && l !== company && l !== location).join(' ').slice(0, 400)}`;

        posts.push({
          author: company || 'Unknown Company',
          title: jobTitle,
          degree: 'job',
          reactor: null,
          isReactedPost: false,
          isPromoted: false,
          body,
          timeStr: '',
          timeMinutes: 99999,
          source: 'FEED_JOBS_WIDGET',
          postUrl,
          authorLinkedInUrl,
        });
      }
      continue; // processed this container via job links
    }

    // Strategy B: No job links found — parse by text structure
    // Split the container text into blocks that look like individual job cards
    const raw = (container.innerText || '').trim();
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Skip the heading line(s)
    let startIdx = 0;
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      if (/jobs?\s+recommended|recommended.*jobs|jobs?\s+picked/i.test(lines[i])) {
        startIdx = i + 1;
      }
    }

    // Heuristic: each job card typically has 2-5 lines (title, company, location, metadata)
    // Look for patterns where a short line (title) is followed by another short line (company)
    let i = startIdx;
    while (i < lines.length - 1) {
      const potentialTitle = lines[i];
      const potentialCompany = lines[i + 1] || '';

      // Skip noise lines
      if (potentialTitle.length < 3 || potentialTitle.length > 150 ||
          /^(See all|View|Show|Dismiss|Apply|Save)/i.test(potentialTitle)) {
        i++;
        continue;
      }

      const location = (lines[i + 2] && (lines[i + 2].includes(',') || /remote|hybrid|on-?site/i.test(lines[i + 2])))
        ? lines[i + 2] : '';

      const body = `Job: ${potentialTitle} at ${potentialCompany}. ${location}.`;

      posts.push({
        author: potentialCompany || 'Unknown Company',
        title: potentialTitle,
        degree: 'job',
        reactor: null,
        isReactedPost: false,
        isPromoted: false,
        body,
        timeStr: '',
        timeMinutes: 99999,
        source: 'FEED_JOBS_WIDGET',
        postUrl: null,
        authorLinkedInUrl: null,
      });

      // Skip past this card's lines
      i += location ? 3 : 2;
      // Also skip any trailing metadata lines (e.g. "Easy Apply", "Promoted", timestamps)
      while (i < lines.length && /^(Easy Apply|Promoted|Actively recruiting|\d+ applicant)/i.test(lines[i])) {
        i++;
      }
    }
  }

  return posts;
}

// ─── Feed Job Links Extraction ────────────────────────────────────────────
// Catches any /jobs/view/ links on the feed page that extractRecommendedJobs()
// missed. These are always from the "Recommended Jobs" widget.
// Unlike extractRecommendedJobs() which tries to find the widget container by
// heading text (fragile), this just grabs ALL job links on the page.

function extractFeedJobLinks() {
  const posts = [];
  const allJobLinks = document.querySelectorAll('a[href*="/jobs/view/"], a[href*="/jobs/collections/"]');
  console.log(`[Jobseek] extractFeedJobLinks: found ${allJobLinks.length} job links on feed`);

  const seenUrls = new Set();
  for (const link of allJobLinks) {
    // SKIP job links inside regular feed posts (.feed-shared-update-v2) —
    // those are handled by extractFeedPosts() and go through Gemini classification.
    // We only want standalone job widget links (e.g. "Jobs recommended for you" carousel).
    if (link.closest('.feed-shared-update-v2')) continue;

    let postUrl = null;
    try {
      const parsed = new URL(link.getAttribute('href'), 'https://www.linkedin.com');
      postUrl = parsed.href;
    } catch { continue; }

    const dedupKey = new URL(postUrl).pathname;
    if (seenUrls.has(dedupKey)) continue;
    seenUrls.add(dedupKey);

    // Walk up to find the card container
    let card = link;
    for (let i = 0; i < 5; i++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      if (card.tagName === 'LI' || (card.offsetHeight && card.offsetHeight > 60)) break;
    }

    const raw = (card.innerText || '').trim();
    if (raw.length < 15) continue;
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Clean link text: remove newlines, collapse whitespace, strip "with verification" badge
    const rawLinkText = (link.textContent || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanedLinkText = rawLinkText.replace(/\s*with verification$/i, '').trim();
    const jobTitle = cleanedLinkText.length > 3 ? cleanedLinkText : (lines[0] || '').replace(/\s*with verification$/i, '').trim();
    if (jobTitle.length < 3) continue;

    // Company: ONLY from reliable sources — /company/ links, img alt, aria-label "at X"
    // DO NOT guess from arbitrary text lines — that produces garbage (person names, repeated titles)
    let company = '';
    const companyLink = card.querySelector('a[href*="/company/"]');
    if (companyLink) company = (companyLink.textContent || '').trim();
    if (!company) {
      const logo = card.querySelector('img[alt]');
      if (logo) {
        const alt = (logo.getAttribute('alt') || '').trim();
        if (alt && alt.length > 1 && alt.length < 60 && !/^(LinkedIn|Photo|Avatar)/i.test(alt)) {
          company = alt.replace(/\s*logo$/i, '').trim();
        }
      }
    }
    if (!company) {
      const ariaEl = card.querySelector('[aria-label]') || link;
      if (ariaEl) {
        const aria = ariaEl.getAttribute('aria-label') || '';
        const atMatch = aria.match(/\bat\s+([^,]+)/i);
        if (atMatch && atMatch[1].trim().length > 1) company = atMatch[1].trim();
      }
    }
    // Clean up "with verification" suffix from company names
    company = company.replace(/\s+with verification$/i, '').trim();
    // Validate: reject if company looks like a job title or person name
    if (company && looksLikeJobTitle(company)) {
      console.log(`[Jobseek] Rejected bad company name (looks like job title): "${company}"`);
      company = '';
    }
    if (company && looksLikePersonName(company)) {
      console.log(`[Jobseek] Rejected bad company name (looks like person): "${company}"`);
      company = '';
    }

    // Location
    const location = lines.find(l =>
      l !== jobTitle && l !== company &&
      (l.includes(',') || /remote|hybrid|on-?site/i.test(l))
    ) || '';

    let authorLinkedInUrl = null;
    if (companyLink) {
      const href = companyLink.getAttribute('href') || '';
      const match = href.match(/\/company\/[^/?]+/);
      if (match) authorLinkedInUrl = 'https://www.linkedin.com' + match[0];
    }

    const body = `Job: ${jobTitle}${company ? ' at ' + company : ''}. ${location}. ${lines.filter(l => l !== jobTitle && l !== company && l !== location).join(' ').slice(0, 400)}`;

    posts.push({
      author: company || 'Unknown Company',
      title: jobTitle,
      degree: 'job',
      reactor: null,
      isReactedPost: false,
      isPromoted: false,
      body,
      timeStr: '',
      timeMinutes: 99999,
      source: 'FEED_JOBS_WIDGET',
      postUrl,
      authorLinkedInUrl,
    });
  }

  return posts;
}

// ─── Link-based Job Extraction (last resort fallback) ─────────────────────
// When structured selectors fail, find all /jobs/view/ links and extract
// job info from the text surrounding each link.

function extractJobsByLinks() {
  const posts = [];
  const allJobLinks = document.querySelectorAll('a[href*="/jobs/view/"], a[href*="/jobs/collections/"]');
  console.log(`[Jobseek] extractJobsByLinks: found ${allJobLinks.length} job links`);

  const seenUrls = new Set();
  for (const link of allJobLinks) {
    let postUrl = null;
    try {
      const parsed = new URL(link.getAttribute('href'), 'https://www.linkedin.com');
      postUrl = parsed.href;  // full URL with query params
    } catch { continue; }

    // Dedup by pathname
    const dedupKey = new URL(postUrl).pathname;
    if (seenUrls.has(dedupKey)) continue;
    seenUrls.add(dedupKey);

    // Walk up to find the card container (usually 3-5 levels up)
    let card = link;
    for (let i = 0; i < 5; i++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      // Stop at LI or when the card is big enough to be a job card
      if (card.tagName === 'LI' || (card.offsetHeight && card.offsetHeight > 60)) break;
    }

    const raw = (card.innerText || '').trim();
    if (raw.length < 15) continue;
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Job title: clean link text — strip newlines, "with verification" badge
    const rawLinkText = (link.textContent || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const jobTitle = (rawLinkText.replace(/\s*with verification$/i, '').trim()).length > 3
      ? rawLinkText.replace(/\s*with verification$/i, '').trim()
      : (lines[0] || '').replace(/\s*with verification$/i, '').trim();
    if (jobTitle.length < 3) continue;

    // Company: prioritize /company/ link text (reliable)
    let company = '';
    const companyLink = card.querySelector('a[href*="/company/"]');
    if (companyLink) company = (companyLink.textContent || '').trim();
    if (!company && lines.length > 1) {
      // Find a line that's not the title, not noise
      const noisePatterns = /^(Easy Apply|Promoted|Actively|Be an early|\d+ applicant|\d+ connection|Viewed|Applied|Saved|new|ago|with verification)/i;
      const titleIdx = lines.indexOf(jobTitle);
      for (let li = (titleIdx >= 0 ? titleIdx : 0) + 1; li < Math.min(lines.length, titleIdx + 4); li++) {
        const line = lines[li];
        if (line === jobTitle) continue;
        if (noisePatterns.test(line)) continue;
        if (line.includes(',') && /\b(India|Remote|Hybrid|Karnataka|Maharashtra)\b/i.test(line)) continue;
        if (line.length >= 2 && line.length <= 80) { company = line; break; }
      }
    }

    let authorLinkedInUrl = null;
    if (companyLink) {
      const href = companyLink.getAttribute('href') || '';
      const match = href.match(/\/company\/[^/?]+/);
      if (match) authorLinkedInUrl = 'https://www.linkedin.com' + match[0];
    }

    const body = `Job: ${jobTitle} at ${company}. ${lines.slice(2).join(' ').slice(0, 400)}`;

    posts.push({
      author: company || 'Unknown Company',
      title: jobTitle,
      degree: 'job',
      reactor: null,
      isReactedPost: false,
      isPromoted: false,
      body,
      timeStr: '',
      timeMinutes: 99999,
      source: 'JOBS',
      postUrl,
      authorLinkedInUrl,
    });
  }

  return posts;
}

// ─── Stable content-based post ID ─────────────────────────────────────────
// Time-based IDs ("author_2h_FEED") break dedup because the same post becomes
// "author_3h_FEED" one hour later → re-classified. Use a djb2 hash over
// author + first 120 chars of body instead — stable across sessions.

function postHash(author, body) {
  const str = (author + ':' + (body || '').slice(0, 120)).toLowerCase().replace(/\s+/g, ' ').trim();
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // keep 32-bit
  }
  return 'p' + Math.abs(hash).toString(36);
}

// ─── Scroll helpers ────────────────────────────────────────────────────────

// Returns true if we are near the top of the page (within 500px)
function isNearTop() {
  return window.scrollY < 500;
}

// Scroll back to top and wait for LinkedIn to render fresh posts.
// LinkedIn shows new posts at the TOP — re-injecting into an existing tab
// needs to reset position first, otherwise we'd only scroll deeper into old content.
async function scrollToTopAndWait() {
  if (isNearTop()) return; // already at top, nothing to do
  console.log('[Jobseek] Scrolling to top to load fresh posts...');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Wait for LinkedIn to detect scroll-to-top and render new posts
  await new Promise(r => setTimeout(r, 3000));
}

// Check whether the user has paused scanning
async function isScanningPaused() {
  return new Promise(resolve => {
    chrome.storage.local.get(['scanningPaused'], r => resolve(!!r.scanningPaused));
  });
}

// Scroll down through the feed in steps to trigger LinkedIn's lazy-loader.
// Checks the pause flag before every step — stops immediately if paused.
// If `scrollContainer` is provided, scrolls that element instead of the window
// (needed for LinkedIn jobs page where the list is in a scrollable div).
async function autoScrollFeed(steps = 50, stepPx = 800, delayMs = 1400, scrollContainer = null) {
  const target = scrollContainer || window;
  const label = scrollContainer ? 'container' : 'window';
  console.log(`[Jobseek] Auto-scrolling ${label} (${steps} steps × ${stepPx}px)...`);
  for (let i = 0; i < steps; i++) {
    if (await isScanningPaused()) {
      console.log(`[Jobseek] Scroll aborted at step ${i} — paused by user`);
      return;
    }
    if (scrollContainer) {
      scrollContainer.scrollTop += stepPx;
    } else {
      window.scrollBy({ top: stepPx, behavior: 'smooth' });
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  // Pause at bottom — give LinkedIn time to render the last batch of posts
  await new Promise(r => setTimeout(r, 2000));
  console.log('[Jobseek] Auto-scroll complete');
}

// ─── Collect unseen posts (without sending yet) ────────────────────────────

async function collectUnseen(posts, accumulator) {
  // accumulator is a Map keyed by post._id to avoid duplicates across calls
  const prefilterDropped = [];
  const filtered = posts.filter(p => {
    const pass = window.preFilter(p);
    if (!pass) prefilterDropped.push(p.author || 'unknown');
    return pass;
  });
  let added = 0;
  let dupes = 0;
  let alreadySeen = 0;
  for (const post of filtered) {
    post._id = postHash(post.author, post.body);
    if (accumulator.has(post._id)) { dupes++; continue; }
    if (await window.isSeenPost(post._id)) { alreadySeen++; continue; }
    accumulator.set(post._id, post);
    added++;
  }
  console.log(`[Jobseek] collectUnseen: ${posts.length} extracted → ${posts.length - filtered.length} prefiltered → ${dupes} dupes → ${alreadySeen} already seen → ${added} NEW posts`);
  if (prefilterDropped.length > 0) {
    console.log(`[Jobseek] Prefilter dropped: ${prefilterDropped.join(', ')}`);
  }
  return { total: posts.length, filtered: filtered.length, added };
}

// Send a complete collected batch to background in one shot
function sendBatch(accumulator, scanMetrics) {
  const posts = Array.from(accumulator.values());
  const metrics = scanMetrics ? { ...scanMetrics, postsSentToGemini: posts.length } : null;
  if (posts.length === 0) {
    console.log(`[Jobseek] No new posts to send`);
    if (metrics) chrome.runtime.sendMessage({ action: 'SCAN_METRICS', metrics });
    return;
  }
  console.log(`[Jobseek] Sending ${posts.length} posts to background`);
  chrome.runtime.sendMessage({ action: 'POSTS_TO_CLASSIFY', posts, scanMetrics: metrics });
}

// ─── Main Orchestration ────────────────────────────────────────────────────

(async function () {
  const path = window.location.pathname;

  // ── Notifications page ──
  if (path.startsWith('/notifications')) {
    if (await isScanningPaused()) { console.log('[Jobseek] Notifications scan skipped — paused'); return; }

    // Wait for LinkedIn SPA to render notification cards
    await new Promise(r => setTimeout(r, 5000));

    // Log page state for debugging
    const mainEl = document.querySelector('main, [role="main"]');
    console.log(`[Jobseek] Notifications page URL: ${window.location.href}`);
    console.log(`[Jobseek] Notifications main element: ${mainEl?.tagName || 'NONE'}, text length: ${(mainEl?.innerText || '').length}`);

    // Light scroll to trigger lazy-loading of more notifications
    await autoScrollFeed(5, 400, 800);

    // Extract notification cards and separate: ones with post URLs (open & evaluate)
    // vs ones without (classify from notification text directly)
    const rawPosts = extractNotificationPosts();
    const withPostUrl = [];
    const withoutPostUrl = [];

    for (const post of rawPosts) {
      if (post.postUrl && (post.postUrl.includes('/feed/update/') || post.postUrl.includes('/posts/'))) {
        withPostUrl.push(post);
      } else {
        withoutPostUrl.push(post);
      }
    }

    console.log(`[Jobseek] Notifications: ${rawPosts.length} total, ${withPostUrl.length} with post URLs (will open), ${withoutPostUrl.length} direct`);

    // Send notifications WITHOUT post URLs for direct classification
    const collected = new Map();
    await collectUnseen(withoutPostUrl, collected);
    sendBatch(collected);

    // Send post URLs to background to open and evaluate the full posts
    if (withPostUrl.length > 0) {
      const postUrls = withPostUrl
        .map(p => p.postUrl)
        .filter((url, i, arr) => arr.indexOf(url) === i) // dedupe
        .slice(0, 10); // cap at 10 to avoid opening too many tabs
      console.log(`[Jobseek] Sending ${postUrls.length} notification post URLs to background for full evaluation`);
      chrome.runtime.sendMessage({ action: 'NOTIFICATION_POSTS_TO_OPEN', postUrls });
    }
    return;
  }

  // ── Jobs page (including /jobs/collections/recommended/) ──
  if (path.startsWith('/jobs')) {
    if (await isScanningPaused()) { console.log('[Jobseek] Jobs scan skipped — paused'); return; }
    const collected = new Map();
    const isRecommendedPage = path.includes('/collections/');
    const sourceTag = isRecommendedPage ? 'FEED_JOBS_WIDGET' : 'JOBS';

    console.log(`[Jobseek] Jobs page URL: ${window.location.href} (source: ${sourceTag})`);

    // Wait for LinkedIn's SPA to render job cards (heavy JS page)
    await new Promise(r => setTimeout(r, 5000));

    // Find the scrollable job list container — LinkedIn puts job cards in a scrollable div,
    // NOT the main page scroll. window.scrollBy() doesn't scroll the job list.
    const jobListContainer = document.querySelector(
      '.scaffold-layout__list-container, ' +
      '.jobs-search-results-list, ' +
      '.scaffold-layout__list, ' +
      '[class*="jobs-search-results"] ul, ' +
      '.scaffold-layout__list-detail-inner'
    );

    console.log(`[Jobseek] Jobs list container: ${jobListContainer?.tagName || 'NONE'}, ` +
      `scrollHeight: ${jobListContainer?.scrollHeight || 0}, clientHeight: ${jobListContainer?.clientHeight || 0}`);

    // Scroll the main window first to trigger lazy loading
    window.scrollBy({ top: 300, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 1000));

    // Scroll the job list container (or fall back to window)
    if (jobListContainer) {
      console.log('[Jobseek] Scrolling job list container to load more cards...');
      await autoScrollFeed(20, 400, 800, jobListContainer);
    } else {
      console.log('[Jobseek] No job list container found — scrolling window as fallback');
      await autoScrollFeed(15, 600, 1000);
    }

    // Try all extractors — primary structured, then link-based, then widget
    let rawPosts = extractJobPosts();
    console.log(`[Jobseek] Jobs primary extractor: ${rawPosts.length} listings`);

    if (rawPosts.length === 0) {
      rawPosts = extractJobsByLinks();
      console.log(`[Jobseek] Jobs link-based fallback: ${rawPosts.length} listings`);
    }

    if (rawPosts.length === 0) {
      rawPosts = extractRecommendedJobs();
      console.log(`[Jobseek] Jobs widget extractor: ${rawPosts.length} listings`);
    }

    // Override source tag — if we're on the recommended page, all jobs are FEED_JOBS_WIDGET
    if (isRecommendedPage) {
      rawPosts.forEach(p => { p.source = 'FEED_JOBS_WIDGET'; });
    }

    // Log each extracted job for debugging
    rawPosts.forEach((p, i) => {
      console.log(`[Jobseek]   job #${i}: "${p.title}" at "${p.author}" — ${p.postUrl || 'no URL'}`);
    });

    await collectUnseen(rawPosts, collected);
    console.log(`[Jobseek] Jobs scraped: ${rawPosts.length} total, ${collected.size} new`);
    sendBatch(collected);
    return;
  }

  if (!path.startsWith('/feed')) return;

  // Bail immediately if the user has paused scanning
  if (await isScanningPaused()) {
    console.log('[Jobseek] Scan skipped — paused by user');
    return;
  }

  // Accumulator: collects all unseen posts across the entire scan session.
  // Using a Map (keyed by post ID) so duplicates across scroll steps are deduplicated locally
  // before sending — avoids redundant Gemini calls.
  const collected = new Map();
  // Metrics tracking for the scan funnel
  const scanMetrics = { source: 'FEED', postsExtracted: 0, postsAfterPrefilter: 0, postsAfterDedup: 0 };
  function trackMetrics(r) {
    scanMetrics.postsExtracted += r.total;
    scanMetrics.postsAfterPrefilter += r.filtered;
    scanMetrics.postsAfterDedup += r.added;
  }

  // ── Step 1: Initial scan of whatever is currently in the DOM ──
  const initial = extractFeedPosts();
  const r1 = await collectUnseen(initial, collected);
  trackMetrics(r1);
  console.log(`[Jobseek] Initial scan: ${r1.total} posts | ${r1.filtered} passed filter | ${r1.added} new`);

  // Also grab any recommended jobs widget visible in the initial viewport
  const initialJobs = extractRecommendedJobs();
  const initialJobLinks = extractFeedJobLinks();
  const allInitialJobs = initialJobs.concat(initialJobLinks);
  if (allInitialJobs.length > 0) {
    const rj1 = await collectUnseen(allInitialJobs, collected);
    console.log(`[Jobseek] Initial feed jobs: ${allInitialJobs.length} found (widget: ${initialJobs.length}, links: ${initialJobLinks.length}) | ${rj1.added} new`);
  }

  // ── Step 2: Scroll to top so fresh posts load, then scan down ──
  await new Promise(r => setTimeout(r, 1500));
  await scrollToTopAndWait();

  // ── Step 3: Auto-scroll — collect posts as LinkedIn lazy-loads them ──
  // MutationObserver fires as new posts enter the DOM during scroll.
  // We collect into the same accumulator; no sends during scroll.
  const observer = new MutationObserver(() => {
    clearTimeout(window._jobseekScanTimer);
    window._jobseekScanTimer = setTimeout(async () => {
      const freshPosts = extractFeedPosts();
      const freshJobs = extractRecommendedJobs().concat(extractFeedJobLinks());
      const r = await collectUnseen(freshPosts.concat(freshJobs), collected);
      trackMetrics(r);
      if (r.added > 0) console.log(`[Jobseek] Scroll collected ${r.added} more new posts (total: ${collected.size})`);
    }, 1500);
  });

  const feed = document.querySelector('.scaffold-layout__main, main');
  if (feed) observer.observe(feed, { childList: true, subtree: true });

  await autoScrollFeed();

  // ── Step 4: Final collect after scroll settles, then send ONE batch ──
  await new Promise(r => setTimeout(r, 2000));
  const final = extractFeedPosts();
  const finalJobs = extractRecommendedJobs().concat(extractFeedJobLinks());
  const rFinal = await collectUnseen(final.concat(finalJobs), collected);
  trackMetrics(rFinal);
  if (finalJobs.length > 0) console.log(`[Jobseek] Final feed job links: ${finalJobs.length} found`);

  console.log(`[Jobseek] Scan complete. Funnel: ${scanMetrics.postsExtracted} extracted → ${scanMetrics.postsAfterPrefilter} after prefilter → ${scanMetrics.postsAfterDedup} after dedup → ${collected.size} to send`);
  sendBatch(collected, scanMetrics);
})();
