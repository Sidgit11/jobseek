// utils/profile-scraper.js — LinkedIn profile enrichment scraper
// Injected programmatically by background.js into /in/* profile pages.
// Extracts structured profile data and sends it back via chrome.runtime.sendMessage.

(function () {
  'use strict';

  // ── Wait for LinkedIn SPA content to render ──────────────────────────────
  // LinkedIn is a heavy SPA — the DOM may not have profile content immediately.
  // We poll for key elements up to 8 seconds before extracting.
  function waitForProfile(maxWaitMs = 8000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        // Check for the presence of any profile content
        const hasName = document.querySelector('h1') && document.querySelector('h1').textContent.trim().length > 1;
        const hasBody = document.body.innerText.length > 500;

        if (hasName && hasBody) {
          resolve(true);
          return;
        }
        if (Date.now() - start > maxWaitMs) {
          console.log('[Jobseek ProfileScraper] Timeout waiting for profile render, proceeding with what we have');
          resolve(false);
          return;
        }
        setTimeout(check, 500);
      };
      check();
    });
  }

  // ── Utility: try multiple selectors, return first match's textContent ────
  function textFrom(selectors, root = document) {
    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) {
          const text = (el.textContent || '').trim();
          if (text.length > 0) return text;
        }
      } catch { /* selector may be invalid, skip */ }
    }
    return null;
  }

  // ── Extract full name ───────────────────────────────────────────────────
  function extractName() {
    // Strategy 1: LinkedIn's class-based selectors
    const name = textFrom([
      'h1.text-heading-xlarge',
      '.text-heading-xlarge',
      '.pv-top-card--list li:first-child',
      '.pv-text-details__left-panel h1',
    ]);
    if (name) return name;

    // Strategy 2: First h1 on profile pages
    const h1 = document.querySelector('h1');
    if (h1) {
      const text = h1.textContent.trim();
      if (text.length > 1 && text.length < 60 && !text.includes('LinkedIn')) return text;
    }

    // Strategy 3: og:title meta tag
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const content = ogTitle.getAttribute('content') || '';
      // Format: "FirstName LastName - Title | LinkedIn"
      const parts = content.split(' - ');
      if (parts.length >= 1) {
        const name = parts[0].trim();
        if (name.length > 1 && !name.includes('LinkedIn')) return name;
      }
    }

    // Strategy 4: title tag
    const title = document.title;
    if (title) {
      const parts = title.split(' - ');
      if (parts.length >= 1) {
        const name = parts[0].trim();
        if (name.length > 1 && name.length < 50 && !name.includes('LinkedIn')) return name;
      }
    }

    return null;
  }

  // ── Extract headline ────────────────────────────────────────────────────
  function extractHeadline() {
    const headline = textFrom([
      '.text-body-medium.break-words',
      '.text-body-medium',
      '.pv-top-card--list-bullet + .text-body-medium',
      '.pv-text-details__left-panel .text-body-medium',
    ]);
    if (headline) return headline;

    // Fallback: og:title or page title often has "Name - Headline | LinkedIn"
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const content = ogTitle.getAttribute('content') || '';
      const parts = content.split(' - ');
      if (parts.length >= 2) {
        return parts[1].replace(/\s*\|\s*LinkedIn.*$/, '').trim();
      }
    }

    // Fallback: meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      const content = metaDesc.getAttribute('content') || '';
      // Format: "Name · Headline · Location · Experience..."
      const parts = content.split(' · ');
      if (parts.length >= 2) return parts[1].trim();
    }

    return null;
  }

  // ── Extract location ────────────────────────────────────────────────────
  function extractLocation() {
    const loc = textFrom([
      '.text-body-small.inline.t-black--light.break-words',
      '.text-body-small.inline.t-black--light',
      '.pv-top-card--list-bullet .text-body-small',
      '.pv-text-details__left-panel .text-body-small.t-black--light',
    ]);
    if (loc) return loc;

    // Fallback: meta description often includes location
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      const content = metaDesc.getAttribute('content') || '';
      const parts = content.split(' · ');
      // Location is usually the 3rd part
      if (parts.length >= 3) {
        const candidate = parts[2].trim();
        // Heuristic: location strings are usually short and contain commas or country names
        if (candidate.length < 60 && !candidate.startsWith('Experience')) return candidate;
      }
    }

    return null;
  }

  // ── Extract about section ───────────────────────────────────────────────
  function extractAbout() {
    // Strategy 1: LinkedIn's standard about section structure
    const aboutSpan = textFrom([
      '#about ~ .display-flex .pv-shared-text-with-see-more span[aria-hidden="true"]',
      '#about ~ .display-flex .inline-show-more-text span[aria-hidden="true"]',
      '#about ~ div .pv-shared-text-with-see-more span.visually-hidden',
    ]);
    if (aboutSpan) return aboutSpan.slice(0, 1000);

    // Strategy 2: find the section that contains "About" heading
    const sections = document.querySelectorAll('section');
    for (const section of sections) {
      const heading = section.querySelector('#about, [id="about"]');
      if (heading) {
        const span = section.querySelector('span[aria-hidden="true"]') ||
                     section.querySelector('.pv-shared-text-with-see-more span') ||
                     section.querySelector('.inline-show-more-text span');
        if (span) return (span.textContent || '').trim().slice(0, 1000);
      }
    }

    // Strategy 3: look for "About" text in section headings
    for (const section of sections) {
      const h2 = section.querySelector('h2, .pvs-header__title');
      if (h2 && /^\s*About\s*$/i.test(h2.textContent || '')) {
        const contentEl = section.querySelector('div > span') ||
                          section.querySelector('.display-flex span');
        if (contentEl) return (contentEl.textContent || '').trim().slice(0, 1000);
      }
    }

    // Strategy 4: meta description as last resort
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      const content = metaDesc.getAttribute('content') || '';
      if (content.length > 50) return content.slice(0, 500);
    }

    return null;
  }

  // ── Extract current company + role from Experience section ──────────────
  function extractExperience() {
    let company = null;
    let role = null;

    // Strategy 1: structured experience section
    const expSection = document.querySelector('#experience')?.closest('section') ||
                       document.querySelector('[id="experience"]')?.closest('section');

    if (expSection) {
      const firstEntry = expSection.querySelector('.pvs-list__paged-list-wrapper li') ||
                         expSection.querySelector('ul li');
      if (firstEntry) {
        const spans = firstEntry.querySelectorAll('span[aria-hidden="true"]');
        if (spans.length >= 1) {
          const firstText = (spans[0].textContent || '').trim();
          const nestedList = firstEntry.querySelector('ul');
          if (nestedList) {
            company = firstText;
            const nestedSpan = nestedList.querySelector('span[aria-hidden="true"]');
            if (nestedSpan) role = (nestedSpan.textContent || '').trim();
          } else {
            role = firstText;
            if (spans.length >= 2) {
              company = (spans[1].textContent || '').trim();
              company = company.replace(/\s*[·•]\s*(Full-time|Part-time|Contract|Freelance|Internship|Self-employed).*$/i, '').trim();
            }
          }
        }
      }
    }

    // Strategy 2: fallback to headline parsing
    if (!company && !role) {
      const headline = extractHeadline();
      if (headline) {
        const atMatch = headline.match(/^(.+?)\s+at\s+(.+)$/i);
        if (atMatch) {
          role = atMatch[1].trim();
          company = atMatch[2].trim();
        } else {
          const pipeMatch = headline.match(/^(.+?)\s*[|·]\s*(.+)$/);
          if (pipeMatch) {
            role = pipeMatch[1].trim();
            company = pipeMatch[2].trim();
          }
        }
      }
    }

    // Strategy 3: og:title fallback
    if (!company && !role) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        const content = ogTitle.getAttribute('content') || '';
        const parts = content.split(' - ');
        if (parts.length >= 2) {
          const titlePart = parts[1].replace(/\s*\|\s*LinkedIn.*$/, '').trim();
          const atMatch = titlePart.match(/^(.+?)\s+at\s+(.+)$/i);
          if (atMatch) {
            role = atMatch[1].trim();
            company = atMatch[2].trim();
          }
        }
      }
    }

    return { company, role };
  }

  // ── Extract mutual connections count ────────────────────────────────────
  function extractMutualConnections() {
    const body = document.body.innerText || '';
    const match = body.match(/(\d+)\s+mutual\s+connection/i);
    if (match) return parseInt(match[1], 10);

    const connectionsText = textFrom([
      '.pv-top-card--list-bullet li:last-child a',
      'a[href*="shared-connections"]',
    ]);
    if (connectionsText) {
      const numMatch = connectionsText.match(/(\d+)/);
      if (numMatch) return parseInt(numMatch[1], 10);
    }

    return null;
  }

  // ── Main extraction ─────────────────────────────────────────────────────
  function scrapeProfile() {
    const name = extractName();
    const headline = extractHeadline();
    const { company, role } = extractExperience();
    const about = extractAbout();
    const location = extractLocation();
    const mutualConnections = extractMutualConnections();

    // Debug info — helps diagnose why fields are null
    const debug = {
      pageTitle: document.title || '(empty)',
      url: window.location.href,
      h1Count: document.querySelectorAll('h1').length,
      h1Text: document.querySelector('h1')?.textContent?.trim()?.slice(0, 80) || '(no h1)',
      metaOgTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.slice(0, 80) || '(no og:title)',
      metaDesc: document.querySelector('meta[name="description"]')?.getAttribute('content')?.slice(0, 120) || '(no description)',
      bodyLength: document.body?.innerText?.length || 0,
      sectionCount: document.querySelectorAll('section').length,
      hasExperienceId: !!document.querySelector('#experience'),
      hasAboutId: !!document.querySelector('#about'),
    };

    return {
      name,
      headline,
      company,
      role,
      about,
      location,
      mutualConnections,
      scrapedAt: new Date().toISOString(),
      _debug: debug,
    };
  }

  // ── Execute with wait ─────────────────────────────────────────────────
  async function run() {
    try {
      console.log('[Jobseek ProfileScraper] Waiting for profile to render...');
      await waitForProfile(8000);

      const profile = scrapeProfile();
      const profileUrl = window.location.pathname;

      // Log what we got for debugging
      const filled = Object.entries(profile).filter(([k, v]) => v !== null && k !== 'scrapedAt').length;
      console.log(`[Jobseek ProfileScraper] Extracted ${filled}/7 fields:`, JSON.stringify(profile, null, 2));

      chrome.runtime.sendMessage({
        action: 'PROFILE_DATA',
        profile,
        profileUrl,
      });
    } catch (err) {
      console.error('[Jobseek ProfileScraper] Extraction failed:', err);
      chrome.runtime.sendMessage({
        action: 'PROFILE_DATA',
        profile: { error: err.message, scrapedAt: new Date().toISOString() },
        profileUrl: window.location.pathname,
      });
    }
  }

  run();
})();
