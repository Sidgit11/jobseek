// background.js — Service Worker
// Receives raw posts from content.js, batches them, POSTs to Gemini via Next.js API.

// ── API Base URL ──
// For development: http://localhost:3000
// For production: https://your-app.vercel.app (or custom domain)
// Set via chrome.storage.local: chrome.storage.local.set({ apiBaseUrl: 'https://...' })
const DEFAULT_API_BASE = 'https://jobseek-sigma.vercel.app';

let _apiBase = DEFAULT_API_BASE;
// Load saved API base URL on startup
chrome.storage.local.get(['apiBaseUrl'], (r) => {
  if (r.apiBaseUrl) _apiBase = r.apiBaseUrl;
});

function getApiUrl(path) { return `${_apiBase}${path}`; }

// API paths (resolved dynamically via getApiUrl)
const API_PATHS = {
  classify: '/api/signals/classify',
  store: '/api/signals/store',
  enrich: '/api/signals/enrich',
  metrics: '/api/signals/metrics',
  userProfile: '/api/user/profile',
  scrapeLinkedin: '/api/user/scrape-linkedin',
  summary: '/api/signals/summary',
};
const BATCH_SIZE = 20; // max posts per Gemini call
const ENRICH_MAX_PER_CYCLE = 5; // max profiles to enrich per scan cycle
const ENRICH_TAB_TIMEOUT = 15_000; // close enrichment tab after 15s max

// ── User profile cache — fetched periodically, sent with classify requests ──
async function fetchAndCacheUserProfile() {
  try {
    const { deviceToken } = await chrome.storage.local.get(['deviceToken']);
    if (!deviceToken) return null;

    // Fetch profile using device token → user mapping
    const res = await fetch(`${getApiUrl(API_PATHS.userProfile)}?deviceToken=${deviceToken}`);
    if (!res.ok) return null;

    const { profile } = await res.json();
    if (!profile) return null;

    // Cache the relevant fields for classify requests
    const userProfile = {
      target_roles: profile.target_roles || [],
      seniority: profile.seniority || null,
      target_locations: profile.target_locations || [],
      target_industries: profile.target_industries || [],
      company_stages: profile.company_stages || [],
    };

    await chrome.storage.local.set({ userProfile, userProfileFetchedAt: Date.now() });
    console.log('[Jobseek BG] Cached user profile:', JSON.stringify(userProfile));
    return userProfile;
  } catch (err) {
    console.warn('[Jobseek BG] Failed to fetch user profile:', err.message);
    return null;
  }
}

async function getUserProfile() {
  const { userProfile, userProfileFetchedAt } = await chrome.storage.local.get(['userProfile', 'userProfileFetchedAt']);
  // Re-fetch if cache is older than 30 minutes
  if (userProfile && userProfileFetchedAt && (Date.now() - userProfileFetchedAt < 30 * 60 * 1000)) {
    return userProfile;
  }
  return await fetchAndCacheUserProfile();
}

// No in-memory state — MV3 service workers can sleep at any time, losing vars.
// content.js sends complete batches; we process immediately on receipt.

// ── Device token (generated once, persisted in storage) ────────────────────
// No OAuth needed — the token identifies this browser+extension installation.
// Share the token URL with the user so they can view their signals dashboard.

chrome.runtime.onInstalled.addListener(async () => {
  const { deviceToken } = await chrome.storage.local.get(['deviceToken']);
  if (!deviceToken) {
    const token = crypto.randomUUID();
    await chrome.storage.local.set({ deviceToken: token });
    console.log(`[Jobseek] Device token created: ${token}`);
    console.log(`[Jobseek] Signals dashboard: signals dashboard?token=${token}`);
  } else {
    console.log(`[Jobseek] Device token loaded: ${deviceToken}`);
    console.log(`[Jobseek] Signals dashboard: signals dashboard?token=${deviceToken}`);
  }

  // Clear any stale scan pipeline state AND pending alarms from previous sessions
  await chrome.storage.local.remove(['scanPipeline']);
  await chrome.alarms.clear('scan-next-step');
  console.log('[Jobseek] Cleared stale scan pipeline state + alarms on install/reload');
});

// ── Scan Metrics Storage ──
async function storeScanMetrics(scanMetrics, geminiResults) {
  try {
    const { deviceToken } = await chrome.storage.local.get(['deviceToken']);
    if (!deviceToken) return;

    const jobsDirect = geminiResults.jobPostsDirectStored || 0;
    const feedToGemini = geminiResults.feedPostsToGemini || 0;

    const payload = {
      device_token: deviceToken,
      session_id: `scan_${Date.now()}`,
      source: scanMetrics.source || 'FEED',
      posts_extracted: scanMetrics.postsExtracted || 0,
      posts_after_prefilter: scanMetrics.postsAfterPrefilter || 0,
      posts_after_dedup: scanMetrics.postsAfterDedup || 0,
      posts_sent_to_gemini: feedToGemini,
      posts_approved: geminiResults.approved || 0,
      posts_rejected: geminiResults.rejected || 0,
      job_posts_direct: jobsDirect,
      rejection_samples: geminiResults.rejectionSamples || [],
      approval_samples: geminiResults.approvalSamples || [],
    };

    console.log(`[Jobseek BG] Scan metrics: ${payload.posts_extracted} extracted → ${payload.posts_after_prefilter} prefiltered → ${payload.posts_after_dedup} deduped → ${feedToGemini} feed to Gemini (${payload.posts_approved} approved / ${payload.posts_rejected} rejected) + ${jobsDirect} jobs direct-stored`);

    await fetch(getApiUrl(API_PATHS.metrics), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(err => console.warn('[Jobseek BG] Failed to store scan metrics:', err.message));
  } catch (err) {
    console.warn('[Jobseek BG] Scan metrics error:', err.message);
  }
}

// ── External messages from the web app (onboarding, profile page) ──
// IMPORTANT: Do NOT use async in onMessageExternal — Chrome MV3 closes the
// message channel before async resolves. Use .then() and return true synchronously.
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // PING — used by the web app to verify extension is installed and working
  if (message.action === 'PING') {
    chrome.storage.local.get(['deviceToken'], (r) => {
      sendResponse({ success: true, version: chrome.runtime.getManifest().version, deviceToken: r.deviceToken || null });
    });
    return true;
  }

  if (message.action === 'SCRAPE_USER_PROFILE' && message.linkedinUrl) {
    console.log('[Jobseek BG] External request to scrape user profile:', message.linkedinUrl);
    scrapeUserLinkedInProfile(message.linkedinUrl)
      .then(profileData => {
        sendResponse({ success: true, profile: profileData });
      })
      .catch(err => {
        console.error('[Jobseek BG] User profile scrape failed:', err.message);
        sendResponse({ success: false, error: err.message });
      });
    return true; // MUST return true synchronously to keep channel open
  }
  if (message.action === 'PING') {
    sendResponse({ success: true, version: chrome.runtime.getManifest().version });
    return true;
  }
});

// Track tabs opened for user profile scraping (to avoid double-handling PROFILE_DATA)
const userProfileScrapeTabs = new Set();

async function scrapeUserLinkedInProfile(linkedinUrl) {
  return new Promise((resolve, reject) => {
    // Open LinkedIn profile as ACTIVE tab — background tabs don't fully render LinkedIn's SPA
    chrome.tabs.create({ url: linkedinUrl, active: true }, (tab) => {
      const tabId = tab.id;
      userProfileScrapeTabs.add(tabId);
      const timeout = setTimeout(() => {
        chrome.tabs.remove(tabId).catch(() => {});
        reject(new Error('Profile scrape timed out after 40s'));
      }, 40_000);

      // Wait for tab to load, then inject inline scraper
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(listener);

        // Wait 5s for LinkedIn SPA to hydrate, then inject inline scraper
        setTimeout(async () => {
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId },
              func: () => {
                // ── Inline profile scraper — 2026 LinkedIn DOM ──
                // LinkedIn removed h1, meta tags, #experience/#about IDs.
                // We use: page title for name, body text for everything else.

                function waitForBody(maxMs) {
                  return new Promise(resolve => {
                    const start = Date.now();
                    const poll = () => {
                      const len = document.body.innerText.length;
                      const sections = document.querySelectorAll('section').length;
                      // Need enough content for Experience section — typically 5000+ chars and 10+ sections
                      const ready = (len > 5000 && sections > 8) || len > 7000;
                      if (ready || Date.now() - start > maxMs) { resolve(ready); return; }
                      // Also try scrolling down to trigger lazy loading
                      if (Date.now() - start > 3000) window.scrollTo(0, 2000);
                      if (Date.now() - start > 6000) window.scrollTo(0, 4000);
                      setTimeout(poll, 500);
                    };
                    poll();
                  });
                }

                function txt(sels) {
                  for (const s of sels) {
                    try { const el = document.querySelector(s); if (el) { const t = el.textContent.trim(); if (t.length > 0) return t; } } catch {}
                  }
                  return null;
                }

                return waitForBody(15000).then(() => {
                  const bodyText = document.body.innerText || '';
                  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                  // ── Name: from page title "Siddhant Mundra | LinkedIn"
                  let name = null;
                  const titleParts = document.title.split(/\s*[|–—]\s*/);
                  if (titleParts[0] && titleParts[0].length > 1 && titleParts[0].length < 50 && !titleParts[0].includes('LinkedIn')) {
                    name = titleParts[0].trim();
                  }
                  // Also try h1 and class-based selectors
                  if (!name) name = txt(['h1.text-heading-xlarge', '.text-heading-xlarge', 'h1']);
                  if (name && (name.includes('LinkedIn') || name.length > 50)) name = null;

                  // ── Headline: first substantial line after the name in body text
                  let headline = txt(['.text-body-medium.break-words', '.text-body-medium']);
                  if (!headline && name) {
                    const nameIdx = lines.findIndex(l => l === name || l.startsWith(name));
                    if (nameIdx >= 0) {
                      // Look at lines after the name — headline is usually 1-3 lines after
                      for (let i = nameIdx + 1; i < Math.min(nameIdx + 5, lines.length); i++) {
                        const l = lines[i];
                        // Skip short noise lines and navigation items
                        if (l.length < 5 || l.length > 200) continue;
                        if (/^(Message|Connect|More|Follow|Pending|Open to)$/i.test(l)) continue;
                        if (/^\d+\s*(followers?|connections?|mutual)/i.test(l)) continue;
                        // This is likely the headline
                        headline = l;
                        break;
                      }
                    }
                  }

                  // ── Location: look for city/country patterns in body text near top
                  let location = txt(['.text-body-small.inline.t-black--light.break-words', '.text-body-small.inline.t-black--light']);
                  if (!location) {
                    // Search first 30 lines for location-like patterns
                    for (let i = 0; i < Math.min(30, lines.length); i++) {
                      const l = lines[i];
                      if (/^[A-Z][a-z]+,\s*[A-Z]/.test(l) && l.length < 60) { location = l; break; }
                      if (/(India|United States|United Kingdom|Canada|Germany|Singapore|Dubai|Remote)/i.test(l) && l.length < 80 && !l.includes('http')) { location = l; break; }
                    }
                  }

                  // ── Experience: extract ALL entries from Experience section
                  let company = null, role = null;
                  const experienceList = []; // {company, role, duration}
                  const expIdx = lines.findIndex(l => /^Experience$/i.test(l));

                  // Helper: detect noise lines
                  function isNoiseLine(l) {
                    if (!l || l.length < 3) return true;
                    if (/^(logo|img|·|Show \d|… more|…see more|see more|Show all)/i.test(l)) return true;
                    return false;
                  }
                  function isLocation(l) {
                    return /,\s*(India|Karnataka|Maharashtra|Delhi|Tamil Nadu|Telangana|Gujarat|United States|UK|Canada|Germany|Singapore|Remote|Metropolitan)/i.test(l) ||
                           /^(Bengaluru|Mumbai|Delhi|Hyderabad|Chennai|Pune|Gurugram|Noida|Bangalore|New York|San Francisco|London|Berlin)/i.test(l);
                  }
                  function isDuration(l) {
                    return /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i.test(l) ||
                           /\b\d+\s*(yr|mo|mos|year|month)/i.test(l) ||
                           /\bPresent\b/i.test(l);
                  }
                  function isEmploymentType(l) {
                    return /^(Full-time|Part-time|Contract|Freelance|Internship|Self-employed|Seasonal|Apprenticeship)$/i.test(l.trim());
                  }

                  if (expIdx >= 0) {
                    const expLines = [];
                    for (let i = expIdx + 1; i < Math.min(expIdx + 80, lines.length); i++) {
                      const l = lines[i];
                      if (/^(Education|Licenses|Skills|Languages|Recommendations|About|Activity|Projects|Interests|Volunteering|Honors|Publications|Courses|Certifications)$/i.test(l)) break;
                      if (l.length > 2 && l.length < 150) expLines.push(l);
                    }

                    // Strategy: duration lines (containing "Jan 2024 - Present · 1 yr") mark entry boundaries
                    // Walk through and collect: role (non-noise, non-location, non-duration, non-company text)
                    //                          company (text before " · Full-time/Part-time" etc)
                    //                          duration (text with month+year patterns)
                    let curRole = null, curCompany = null, curDuration = null;

                    function flushEntry() {
                      if (curRole || curCompany) {
                        experienceList.push({ company: curCompany || '', role: curRole || '', duration: curDuration || '' });
                        if (!company && curCompany) company = curCompany;
                        if (!role && curRole) role = curRole;
                      }
                      curRole = null; curCompany = null; curDuration = null;
                    }

                    for (const l of expLines) {
                      if (isNoiseLine(l)) continue;

                      if (l.includes(' · ')) {
                        const parts = l.split(' · ').map(p => p.trim());
                        // Classify: "Company · Full-time" vs "May 2025 - Present · 11 mos"
                        if (isDuration(parts[0])) {
                          curDuration = l;
                          flushEntry();
                        } else if (isEmploymentType(parts[1]) || isEmploymentType(parts[parts.length - 1])) {
                          // "Company · Full-time" or "Company · Full-time · 3 yrs"
                          curCompany = parts[0];
                        } else if (isDuration(l)) {
                          curDuration = l;
                          flushEntry();
                        } else {
                          // Could be "Company · Something" — treat first part as company
                          if (!curCompany) curCompany = parts[0];
                        }
                      } else if (isDuration(l)) {
                        curDuration = l;
                        flushEntry();
                      } else if (isLocation(l)) {
                        // Skip locations — don't confuse with company or role
                        continue;
                      } else if (isEmploymentType(l)) {
                        continue;
                      } else {
                        // Text line — could be role or company name
                        if (!curRole) curRole = l;
                        else if (!curCompany) curCompany = l;
                        // If both filled, this starts a new entry
                      }
                    }
                    flushEntry(); // last entry
                  }
                  // Fallback: parse headline for "Role at Company"
                  if (!company && !role && headline) {
                    const m = headline.match(/^(.+?)\s+at\s+(.+)$/i);
                    if (m) { role = m[1].trim(); company = m[2].trim(); }
                    else { const m2 = headline.match(/^(.+?)\s*[|·]\s*(.+)$/); if (m2) { role = m2[1].trim(); company = m2[2].trim(); } }
                  }

                  // ── About: find "About" section that appears BEFORE Experience
                  // LinkedIn's footer also has "About" — we only want the profile About section
                  let about = null;
                  const maxAboutSearch = expIdx > 0 ? expIdx : Math.min(100, lines.length);
                  let aboutIdx = -1;
                  for (let i = 0; i < maxAboutSearch; i++) {
                    if (/^About$/i.test(lines[i])) { aboutIdx = i; break; }
                  }
                  if (aboutIdx >= 0) {
                    const aboutParts = [];
                    for (let i = aboutIdx + 1; i < Math.min(aboutIdx + 15, lines.length); i++) {
                      const l = lines[i];
                      if (/^(Experience|Education|Licenses|Skills|Activity|Projects|Featured)$/i.test(l)) break;
                      if (l === '…see more' || l === 'see more') break;
                      if (l.length > 5 && !/(Accessibility|Talent Solutions|Community Guidelines|Careers|Marketing Solutions|Privacy|LinkedIn Corporation)/i.test(l)) {
                        aboutParts.push(l);
                      }
                    }
                    if (aboutParts.length > 0) about = aboutParts.join(' ').slice(0, 1000);
                  }

                  // ── Education: extract entries from Education section
                  const educationList = []; // {school, degree, years}
                  const eduIdx = lines.findIndex(l => /^Education$/i.test(l));
                  if (eduIdx >= 0) {
                    const eduLines = [];
                    for (let i = eduIdx + 1; i < Math.min(eduIdx + 40, lines.length); i++) {
                      const l = lines[i];
                      // Stop at next section — but also stop at "Licenses & certifications"
                      if (/^(Experience|Skills|Languages|Recommendations|Activity|Projects|Interests|Volunteering|Honors|Publications|Courses|Certifications)$/i.test(l)) break;
                      if (/^Licenses/i.test(l)) break;
                      if (isNoiseLine(l) || isLocation(l)) continue;
                      if (l.length > 2 && l.length < 150) eduLines.push(l);
                    }
                    let currentSchool = null, currentDegree = null, currentYears = null;
                    for (const l of eduLines) {
                      if (/\d{4}\s*[-–—]\s*(\d{4}|Present)/i.test(l)) {
                        currentYears = l;
                        if (currentSchool) {
                          educationList.push({ school: currentSchool, degree: currentDegree || '', years: currentYears });
                          currentSchool = null; currentDegree = null; currentYears = null;
                        }
                      } else if (/^(Activities|Grade|GPA)/i.test(l)) {
                        continue;
                      } else if (!currentSchool && l.length > 3 && l.length < 100 && !/^(logo|img|Show \d)/i.test(l)) {
                        currentSchool = l;
                      } else if (currentSchool && !currentDegree && l.length > 3 && l.length < 120) {
                        currentDegree = l;
                      }
                    }
                    if (currentSchool) {
                      educationList.push({ school: currentSchool, degree: currentDegree || '', years: currentYears || '' });
                    }
                  }

                  // ── Mutual connections
                  let mutualConnections = null;
                  const mcMatch = bodyText.match(/(\d+)\s+mutual\s+connection/i);
                  if (mcMatch) mutualConnections = parseInt(mcMatch[1], 10);

                  const debug = {
                    pageTitle: document.title.slice(0, 80),
                    url: window.location.href,
                    bodyLen: bodyText.length,
                    lineCount: lines.length,
                    expIdx, aboutIdx, eduIdx,
                    expCount: experienceList.length,
                    eduCount: educationList.length,
                  };

                  return { name, headline, company, role, about, location, mutualConnections, experience: experienceList, education: educationList, _debug: debug };
                });
              },
            });

            // executeScript returns array of results
            if (results && results[0] && results[0].result) {
              const profile = results[0].result;
              if (profile._debug) {
                console.log('[Jobseek BG] Profile scrape debug:', JSON.stringify(profile._debug, null, 2));
                delete profile._debug;
              }
              console.log('[Jobseek BG] User profile scraped:', JSON.stringify(profile));

              userProfileScrapeTabs.delete(tabId);
              clearTimeout(timeout);
              chrome.tabs.remove(tabId).catch(() => {});
              storeUserProfileToServer(profile, linkedinUrl);
              resolve(profile);
            } else {
              console.warn('[Jobseek BG] Profile scrape returned no results');
              userProfileScrapeTabs.delete(tabId);
              clearTimeout(timeout);
              chrome.tabs.remove(tabId).catch(() => {});
              resolve({ name: null, headline: null, company: null, role: null, about: null, location: null, mutualConnections: null });
            }
          } catch (err) {
            console.error('[Jobseek BG] Profile scrape injection failed:', err.message);
            clearTimeout(timeout);
            userProfileScrapeTabs.delete(tabId);
            chrome.tabs.remove(tabId).catch(() => {});
            reject(err);
          }
        }, 4000);
      });

    });
  });
}

async function storeUserProfileToServer(profile, linkedinUrl) {
  try {
    const { deviceToken } = await chrome.storage.local.get(['deviceToken']);
    if (!deviceToken) return;

    await fetch(getApiUrl(API_PATHS.scrapeLinkedin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkedinUrl,
        scrapedProfile: profile,
        deviceToken,
      }),
    });
    console.log('[Jobseek BG] User profile stored to server');
  } catch (err) {
    console.warn('[Jobseek BG] Failed to store user profile:', err.message);
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'POSTS_TO_CLASSIFY' && message.posts?.length > 0) {
    // Process immediately — no debounce, no in-memory queue
    flushBatch(message.posts, message.scanMetrics);
  }
  if (message.action === 'SCAN_METRICS' && message.metrics) {
    // Metrics-only message (no posts to classify, e.g. empty scan)
    storeScanMetrics(message.metrics, { approved: 0, rejected: 0, rejectionSamples: [], approvalSamples: [] });
  }
  if (message.action === 'TRIGGER_SCAN_NOW') {
    console.log('[Jobseek BG] Immediate scan triggered — user resumed');
    runScan();
  }
  if (message.action === 'PROFILE_DATA') {
    // Profile scraper completed — store the data for the enrichment handler
    // Skip if this is a user's own profile scrape (handled by scrapeUserLinkedInProfile listener)
    const profilePath = message.profileUrl || '';
    const isUserProfileScrape = profilePath && userProfileScrapeTabs.has(sender.tab?.id);
    if (!isUserProfileScrape) {
      console.log('[Jobseek BG] Profile data received:', message.profileUrl);
      handleProfileData(message.profile, message.profileUrl, sender.tab?.id);
    }
  }
  if (message.action === 'NOTIFICATION_POSTS_TO_OPEN' && message.postUrls?.length > 0) {
    // Notification agent: open linked posts to evaluate their full content
    console.log(`[Jobseek BG] Opening ${message.postUrls.length} notification-linked posts for evaluation`);
    openNotificationPosts(message.postUrls);
  }
});

// Job-source posts bypass Gemini — they're already job listings, no classification needed.
// LinkedIn's recommended jobs algorithm already filtered for relevance.
const JOB_SOURCES = new Set(['JOBS', 'FEED_JOBS_WIDGET', 'NOTIFICATION_JOB_ALERT']);

async function flushBatch(posts, scanMetrics) {
  if (!posts || posts.length === 0) return;

  // Split: job-source posts go directly to storage, feed posts go to Gemini
  const jobPosts = posts.filter(p => p.degree === 'job' || JOB_SOURCES.has(p.source));
  const feedPosts = posts.filter(p => p.degree !== 'job' && !JOB_SOURCES.has(p.source));

  // Direct-store job listings (no Gemini needed)
  if (jobPosts.length > 0) {
    console.log(`[Jobseek BG] Direct-storing ${jobPosts.length} job listings (bypassing Gemini)`);
    await directStoreJobs(jobPosts);
  }

  // Classify feed posts through Gemini and collect metrics
  let totalApproved = 0, totalRejected = 0;
  const rejectionSamples = [];
  const approvalSamples = [];

  if (feedPosts.length > 0) {
    for (let i = 0; i < feedPosts.length; i += BATCH_SIZE) {
      const batch = feedPosts.slice(i, i + BATCH_SIZE);
      const postIds = batch.map(p => p._id);
      const result = await processBatch(batch, postIds);
      if (result) {
        totalApproved += result.approved;
        totalRejected += result.rejected;
        rejectionSamples.push(...result.rejectionSamples);
        approvalSamples.push(...result.approvalSamples);
      }
    }
  }

  // Store scan metrics if we have them
  if (scanMetrics) {
    storeScanMetrics(scanMetrics, {
      approved: totalApproved,
      rejected: totalRejected,
      rejectionSamples: rejectionSamples.slice(0, 5),
      approvalSamples: approvalSamples.slice(0, 5),
      jobPostsDirectStored: jobPosts.length,
      feedPostsToGemini: feedPosts.length,
    });
  }
}

// Validate company name — reject person names and job titles
function isValidCompanyName(name) {
  if (!name || name === 'Unknown Company') return false;
  // Reject obvious job titles
  if (/\b(Manager|Engineer|Developer|Designer|Director|Lead|Head|VP|Analyst|Architect|Scientist|Specialist|Intern|Officer|Coordinator|President|Chief)\b/i.test(name)) return false;
  // Reject "with verification" suffix leftovers
  if (/with verification$/i.test(name)) return false;
  // Reject if it looks like a person name (2-3 short capitalized words, no company markers)
  const words = name.trim().split(/\s+/);
  if (words.length >= 2 && words.length <= 3) {
    const allPersonWords = words.every(w => /^[A-Z][a-z]{1,15}\.?$/.test(w));
    if (allPersonWords && !/\b(Inc|Corp|Ltd|LLC|Labs|Tech|AI|Group|Software|Analytics|Media|Health|Digital|Studio|Cloud|Systems)\b/i.test(name)) {
      return false;
    }
  }
  return name.length >= 2;
}

// Convert job-source posts directly to signals without Gemini classification
async function directStoreJobs(jobPosts) {
  const signals = jobPosts.map(post => {
    // Clean all text: strip newlines, collapse whitespace, remove "with verification" badge
    const cleanText = (s) => (s || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/\s*with verification$/i, '').trim();
    const rawCompany = cleanText(post.author);
    const company = isValidCompanyName(rawCompany) ? rawCompany : null;
    const cleanTitle = cleanText(post.title);

    return {
      id: post._id,
      type: 'HIRING_POST',
      tier: 1,
      confidence: 85,
      author: company || 'Unknown Company',
      title: cleanTitle,
      degree: post.degree || 'job',
      reactor: null,
      reasoning: company
        ? `Direct job listing from LinkedIn: ${cleanTitle} at ${company}`
        : `Direct job listing from LinkedIn: ${cleanTitle} (company unknown — needs extraction from job detail page)`,
      outreachHook: cleanTitle && company
        ? `Saw the ${cleanTitle} opening at ${company} — would love to learn more about the role and team.`
        : 'Noticed this opening and would love to learn more about the role.',
      preview: cleanText((post.body || '').slice(0, 500)),
      timeStr: post.timeStr || '',
      timeMinutes: post.timeMinutes || 99999,
      source: post.source || 'FEED_JOBS_WIDGET',
      postUrl: post.postUrl || null,
      authorLinkedInUrl: post.authorLinkedInUrl || null,
      companyName: company,
      detectedAt: new Date().toISOString(),
    };
  });

  // Mark posts as seen
  const postIds = jobPosts.map(p => p._id);
  await markPostsSeenInStorage(postIds);

  // Log each job
  signals.forEach(s => {
    console.log(`[Jobseek BG]   [JOB] "${s.title}" at "${s.companyName}" — ${s.postUrl || 'no URL'}`);
  });

  // Store + push to backend
  await storeSignals(signals);
  await pushSignalsToBackend(signals);
}

async function processBatch(batch, postIds) {

  console.log(`[Jobseek BG] Sending batch of ${batch.length} posts to classifier`);

  try {
    // Include user profile for personalized classification
    const userProfile = await getUserProfile();
    const requestBody = { posts: batch };
    if (userProfile) requestBody.userProfile = userProfile;

    const response = await fetch(getApiUrl(API_PATHS.classify), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 429) {
      // Gemini spending cap hit — don't mark posts seen so they retry when quota resets
      const body = await response.json().catch(() => ({}));
      console.warn('[Jobseek BG] Gemini quota exceeded:', body.hint || 'Check aistudio.google.com billing.');
      return;
    }

    if (!response.ok) {
      console.error(`[Jobseek BG] API error: ${response.status} ${response.statusText}`);
      return;
    }

    const { signals } = await response.json();
    const approved = signals.length;
    const rejected = batch.length - approved;
    console.log(`[Jobseek BG] Received ${approved} signals from ${batch.length} posts (${rejected} rejected)`);

    // Build metrics samples
    const approvalSamples = signals.map(s => ({
      author: s.author, type: s.type, company: s.companyName || s.author, confidence: s.confidence
    }));
    // For rejections, we know which posts got no signal — they're the ones not in signals
    const signalIds = new Set(signals.map(s => s.id));
    const rejectionSamples = batch.filter(p => !signalIds.has(p._id)).map(p => ({
      author: p.author, bodyPreview: (p.body || '').slice(0, 80)
    }));

    // Mark all posts as seen — even those that produced no signal (don't re-classify)
    await markPostsSeenInStorage(postIds);

    // Store signals locally (for popup badge) + push to Jobseek backend
    if (signals.length > 0) {
      await storeSignals(signals);
      await pushSignalsToBackend(signals);
      await queueProfilesForEnrichment(signals);
    }

    return { approved, rejected, approvalSamples, rejectionSamples };

  } catch (err) {
    console.error('[Jobseek BG] Fetch failed:', err.message);
    return null;
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

      const updated = [...fresh, ...existing].slice(0, 100); // max 100 stored
      chrome.storage.local.set({ signals: updated }, () => {
        const activeCount = updated.filter(s => s.status !== 'dismissed').length;
        chrome.action.setBadgeText({ text: activeCount > 0 ? String(activeCount) : '' });
        chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });
        console.log(`[Jobseek BG] Stored ${fresh.length} new signals. Total: ${updated.length}`);
        resolve();
      });
    });
  });
}

async function pushSignalsToBackend(signals) {
  try {
    const { deviceToken } = await chrome.storage.local.get(['deviceToken']);
    if (!deviceToken) {
      console.warn('[Jobseek BG] No device token yet — signals not pushed to backend');
      return;
    }

    const response = await fetch(getApiUrl(API_PATHS.store), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: deviceToken, signals }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[Jobseek BG] Backend store failed: ${response.status} ${text}`);
      return;
    }

    const { stored } = await response.json();
    console.log(`[Jobseek BG] Pushed ${stored} signals to Jobseek backend`);
    console.log(`[Jobseek BG] View at: signals dashboard?token=${deviceToken}`);
  } catch (err) {
    console.warn('[Jobseek BG] Backend push skipped (backend offline?):', err.message);
  }
}

// ── Profile Enrichment Queue ──────────────────────────────────────────────
// After signals are classified, queue their authors' LinkedIn profiles for
// enrichment. The queue lives in chrome.storage.local so it survives
// service worker restarts.

async function queueProfilesForEnrichment(signals) {
  const { enrichQueue = [] } = await chrome.storage.local.get(['enrichQueue']);
  const existingUrls = new Set(enrichQueue.map(item => item.profileUrl));

  let added = 0;
  for (const signal of signals) {
    const url = signal.authorLinkedInUrl;
    if (!url || existingUrls.has(url)) continue;

    enrichQueue.push({
      signalId: signal.id,
      profileUrl: url,
      status: 'pending',   // pending | processing | done | failed
      addedAt: new Date().toISOString(),
      attempts: 0,
    });
    existingUrls.add(url);
    added++;
  }

  if (added > 0) {
    // Keep queue bounded — drop oldest done/failed items first
    const active = enrichQueue.filter(i => i.status === 'pending' || i.status === 'processing');
    const inactive = enrichQueue.filter(i => i.status === 'done' || i.status === 'failed');
    const trimmed = [...active, ...inactive.slice(-50)];
    await chrome.storage.local.set({ enrichQueue: trimmed });
    console.log(`[Jobseek BG] Queued ${added} profiles for enrichment (total pending: ${active.length})`);
  }
}

// Called when profile-scraper.js sends back PROFILE_DATA
// In-memory map to track which enrichment tab corresponds to which signal
// (lost on worker restart — the alarm handler re-checks the queue)
const _enrichTabMap = new Map(); // tabId -> { signalId, profileUrl }

async function handleProfileData(profile, profileUrl, tabId) {
  // Find the queue item for this profile URL
  const { enrichQueue = [] } = await chrome.storage.local.get(['enrichQueue']);
  const item = enrichQueue.find(
    i => profileUrl && i.profileUrl.includes(profileUrl.replace(/\/$/, ''))
  );

  if (!item) {
    console.warn('[Jobseek BG] Profile data received but no matching queue item for:', profileUrl);
    // Still close the tab if it was opened by us
    if (tabId) chrome.tabs.remove(tabId).catch(() => {});
    return;
  }

  // Close the enrichment tab
  if (tabId) {
    chrome.tabs.remove(tabId).catch(() => {});
    console.log(`[Jobseek BG] Closed enrichment tab ${tabId}`);
  }

  // Skip sending if profile extraction completely failed
  if (profile.error && !profile.name) {
    item.status = 'failed';
    item.lastError = profile.error;
    await chrome.storage.local.set({ enrichQueue });
    console.warn('[Jobseek BG] Profile scrape failed:', profile.error);
    return;
  }

  // POST enrichment data to backend
  try {
    const { deviceToken } = await chrome.storage.local.get(['deviceToken']);
    if (!deviceToken) {
      console.warn('[Jobseek BG] No device token — cannot push enrichment');
      return;
    }

    const response = await fetch(getApiUrl(API_PATHS.enrich), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: deviceToken,
        signalId: item.signalId,
        profile: {
          name: profile.name,
          headline: profile.headline,
          company: profile.company,
          role: profile.role,
          about: profile.about,
          location: profile.location,
          mutualConnections: profile.mutualConnections,
        },
      }),
    });

    if (response.ok) {
      item.status = 'done';
      item.enrichedAt = new Date().toISOString();
      console.log(`[Jobseek BG] Enriched signal ${item.signalId} with profile data`);
    } else {
      const text = await response.text().catch(() => '');
      item.status = 'failed';
      item.lastError = `API ${response.status}: ${text}`;
      console.error('[Jobseek BG] Enrich API error:', response.status, text);
    }
  } catch (err) {
    item.status = 'failed';
    item.lastError = err.message;
    console.warn('[Jobseek BG] Enrich push failed:', err.message);
  }

  await chrome.storage.local.set({ enrichQueue });
}

// ── Enrichment alarm — processes one profile every 12 seconds ─────────────

chrome.alarms.create('enrich-next-profile', { delayInMinutes: 0.5, periodInMinutes: 0.2 }); // ~12 seconds

async function processNextEnrichment() {
  const { enrichQueue = [], scanningPaused } = await chrome.storage.local.get(['enrichQueue', 'scanningPaused']);
  if (scanningPaused) return;

  // Count how many we've enriched this cycle (last 10 minutes)
  const recentCutoff = Date.now() - 10 * 60 * 1000;
  const recentlyDone = enrichQueue.filter(
    i => i.status === 'done' && i.enrichedAt && new Date(i.enrichedAt).getTime() > recentCutoff
  ).length;
  if (recentlyDone >= ENRICH_MAX_PER_CYCLE) return;

  // Find next pending item
  const item = enrichQueue.find(i => i.status === 'pending');
  if (!item) return;

  // Mark as processing to prevent duplicate work
  item.status = 'processing';
  item.attempts = (item.attempts || 0) + 1;
  await chrome.storage.local.set({ enrichQueue });

  // If too many attempts, mark as failed
  if (item.attempts > 3) {
    item.status = 'failed';
    item.lastError = 'Max attempts exceeded';
    await chrome.storage.local.set({ enrichQueue });
    return;
  }

  console.log(`[Jobseek BG] Enriching profile: ${item.profileUrl} (attempt ${item.attempts})`);

  try {
    // Open profile in a background tab
    const tab = await chrome.tabs.create({
      url: item.profileUrl,
      active: false,
    });

    // Set a hard timeout — close tab and reset item if it takes too long
    const timeoutId = setTimeout(async () => {
      console.warn(`[Jobseek BG] Enrichment tab ${tab.id} timed out — closing`);
      chrome.tabs.remove(tab.id).catch(() => {});

      // Reset to pending so it can be retried
      const { enrichQueue: q = [] } = await chrome.storage.local.get(['enrichQueue']);
      const qi = q.find(i => i.signalId === item.signalId);
      if (qi && qi.status === 'processing') {
        qi.status = 'pending';
        await chrome.storage.local.set({ enrichQueue: q });
      }
    }, ENRICH_TAB_TIMEOUT);

    // Wait for tab to load, then inject the profile scraper
    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId !== tab.id || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timeoutId);

      // Small delay to let LinkedIn's JS render profile sections
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['utils/profile-scraper.js'],
        }).catch(err => {
          console.error('[Jobseek BG] Failed to inject profile scraper:', err.message);
          chrome.tabs.remove(tab.id).catch(() => {});
        });
      }, 2000);

      // Safety timeout — if PROFILE_DATA never comes, close tab after remaining time
      setTimeout(() => {
        chrome.tabs.remove(tab.id).catch(() => {});
      }, ENRICH_TAB_TIMEOUT - 2000);
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
  } catch (err) {
    console.error('[Jobseek BG] Failed to open enrichment tab:', err.message);
    item.status = 'pending'; // retry on next tick
    await chrome.storage.local.set({ enrichQueue });
  }
}

// ── Notification Agent — open linked posts for full evaluation ─────────────
// When notifications link to actual posts (e.g. "X posted about..."), we open
// each post URL in a background tab, inject content.js to extract the full
// feed post, and classify THAT instead of the notification snippet.

const NOTIFICATION_POST_TIMEOUT = 20_000; // 20s per post tab
const NOTIFICATION_POST_MAX_CONCURRENT = 3;

async function openNotificationPosts(postUrls) {
  // Process in small batches to avoid overwhelming the browser
  for (let i = 0; i < postUrls.length; i += NOTIFICATION_POST_MAX_CONCURRENT) {
    const batch = postUrls.slice(i, i + NOTIFICATION_POST_MAX_CONCURRENT);
    await Promise.all(batch.map(url => openAndEvaluatePost(url)));
    // Small gap between batches
    if (i + NOTIFICATION_POST_MAX_CONCURRENT < postUrls.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function openAndEvaluatePost(postUrl) {
  return new Promise(async (resolve) => {
    try {
      const tab = await chrome.tabs.create({ url: postUrl, active: false });
      console.log(`[Jobseek BG] Opened notification post tab ${tab.id}: ${postUrl}`);

      let resolved = false;
      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        chrome.tabs.remove(tab.id).catch(() => {});
        resolve();
      };

      // Hard timeout — close tab no matter what
      const hardTimeout = setTimeout(() => {
        console.warn(`[Jobseek BG] Notification post tab ${tab.id} timed out — closing`);
        cleanup();
      }, NOTIFICATION_POST_TIMEOUT);

      // Wait for page load, then inject content.js to extract the post
      const onUpdated = (updatedTabId, info) => {
        if (updatedTabId !== tab.id || info.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);

        // Small delay for LinkedIn JS to render the post
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['utils/prefilter.js', 'utils/dedup.js', 'content.js'],
          }).then(() => {
            console.log(`[Jobseek BG] Injected content.js into notification post tab ${tab.id}`);
            // Give content.js time to extract and send posts, then close
            setTimeout(() => {
              clearTimeout(hardTimeout);
              cleanup();
            }, 8000);
          }).catch(err => {
            console.error(`[Jobseek BG] Failed to inject into notification post tab:`, err.message);
            clearTimeout(hardTimeout);
            cleanup();
          });
        }, 2500);
      };

      chrome.tabs.onUpdated.addListener(onUpdated);

      // Fallback: if onUpdated never fires 'complete' (SPA navigation), inject after 8s
      setTimeout(() => {
        if (resolved) return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        console.log(`[Jobseek BG] Notification post tab ${tab.id} — fallback injection (no 'complete' event)`);
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['utils/prefilter.js', 'utils/dedup.js', 'content.js'],
        }).then(() => {
          setTimeout(() => {
            clearTimeout(hardTimeout);
            cleanup();
          }, 8000);
        }).catch(() => {
          clearTimeout(hardTimeout);
          cleanup();
        });
      }, 8000);

    } catch (err) {
      console.error('[Jobseek BG] Failed to open notification post:', err.message);
      resolve();
    }
  });
}

// ── Periodic background scan ───────────────────────────────────────────────
// Fires every 30 minutes. If LinkedIn is already open in any tab, re-injects
// the content script to pick up new posts. If not, silently opens a LinkedIn
// feed tab, lets it scan + auto-scroll, then closes it after 45 seconds.

chrome.alarms.create('periodic-scan', { delayInMinutes: 1, periodInMinutes: 2 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'enrich-next-profile') {
    processNextEnrichment();
    return;
  }

  if (alarm.name === 'scan-next-step') {
    // Advance the multi-page scan pipeline to the next step
    chrome.storage.local.get(['scanPipeline'], async ({ scanPipeline }) => {
      if (!scanPipeline) return;
      scanPipeline.stepIndex = (scanPipeline.stepIndex ?? 0) + 1;
      await chrome.storage.local.set({ scanPipeline });
      executeScanStep();
    });
    return;
  }

  if (alarm.name !== 'periodic-scan') return;

  // Respect user pause — check before every scan
  chrome.storage.local.get(['scanningPaused'], ({ scanningPaused }) => {
    if (scanningPaused) {
      console.log('[Jobseek BG] Scan skipped — paused by user');
      return;
    }
    runScan();
  });
});

// ── Multi-page scan pipeline ─────────────────────────────────────────────
// Visits feed → notifications → jobs sequentially.
// Uses alarms for step sequencing so it survives service worker restarts.
// Scan state is persisted in chrome.storage.local.

const SCAN_PAGES = [
  { url: 'https://www.linkedin.com/feed/', label: 'feed', waitMs: 90_000 },
  // Step 2: Open the full "Recommended Jobs" page — this is the expanded version of the
  // "Jobs recommended for you" widget on the feed. Has 25+ job cards with full details.
  { url: 'https://www.linkedin.com/jobs/collections/recommended/', label: 'jobs', waitMs: 45_000 },
];

async function runScan() {
  // Check if a scan pipeline is already running — don't start a second one
  const { scanPipeline } = await chrome.storage.local.get(['scanPipeline']);
  if (scanPipeline) {
    // Safety: if pipeline is older than 5 minutes, it's stale — force cleanup
    const pipelineAge = scanPipeline.startedAt
      ? Date.now() - new Date(scanPipeline.startedAt).getTime()
      : Infinity;
    if (pipelineAge > 5 * 60 * 1000) {
      console.warn('[Jobseek BG] Stale scan pipeline detected (age: ' + Math.round(pipelineAge / 1000) + 's) — cleaning up');
      await cleanupScanPipeline(scanPipeline, true);
    } else {
      console.log('[Jobseek BG] Scan pipeline already in progress — skipping');
      return;
    }
  }

  // Get our scan tab ID so we can exclude it from the query
  const allLinkedInTabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });

  // Find a user's feed tab (not one we opened for scanning)
  const userFeedTab = allLinkedInTabs.find(t => t.url?.includes('/feed'));

  if (userFeedTab) {
    // User has LinkedIn feed open — re-inject into it for feed scan
    console.log(`[Jobseek BG] Re-injecting into existing LinkedIn feed tab ${userFeedTab.id}`);
    chrome.scripting.executeScript({
      target: { tabId: userFeedTab.id },
      files: ['utils/prefilter.js', 'utils/dedup.js', 'content.js'],
    }).catch(err => {
      console.error('[Jobseek BG] Failed to inject into user feed tab:', err.message);
    });
    // ALSO scan notifications + jobs in a SEPARATE background tab (skip feed since user's tab handles it)
    console.log('[Jobseek BG] Starting notifications + jobs scan in background tab');
    startScanPipeline(1); // start from step 1 (notifications), skip feed
  } else {
    // No LinkedIn tab open — full multi-page silent scan
    console.log('[Jobseek BG] Starting multi-page silent scan: feed → notifications → jobs');
    startScanPipeline(0); // start from step 0 (feed)
  }
}

async function startScanPipeline(startStep = 0) {
  // Reset scan pipeline state
  await chrome.storage.local.set({
    scanPipeline: {
      stepIndex: startStep,
      scanTabId: null,
      startedAt: new Date().toISOString(),
    }
  });
  executeScanStep();
}

async function executeScanStep() {
  const { scanPipeline, scanningPaused } = await chrome.storage.local.get(['scanPipeline', 'scanningPaused']);
  if (scanningPaused) {
    console.log('[Jobseek BG] Scan pipeline paused by user — stopping');
    cleanupScanPipeline(scanPipeline, true);
    return;
  }
  if (!scanPipeline) return;

  const { stepIndex } = scanPipeline;
  let { scanTabId: existingTabId } = scanPipeline;

  // All pages done — cleanup and trigger summary
  if (stepIndex >= SCAN_PAGES.length) {
    console.log('[Jobseek BG] Multi-page scan complete — all pages scanned');
    cleanupScanPipeline(scanPipeline);
    triggerScanSummary();
    return;
  }

  const page = SCAN_PAGES[stepIndex];
  console.log(`[Jobseek BG] Scan step ${stepIndex + 1}/${SCAN_PAGES.length}: ${page.label}`);

  try {
    let tabId;

    // If we have an existing tab from a previous step, navigate it
    if (existingTabId) {
      try {
        await chrome.tabs.update(existingTabId, { url: page.url });
        tabId = existingTabId;
      } catch {
        // Tab was closed or invalid — create a new one
        console.log(`[Jobseek BG] Previous scan tab ${existingTabId} gone — creating new tab`);
        const tab = await chrome.tabs.create({ url: page.url, active: false });
        tabId = tab.id;
        scanPipeline.scanTabId = tabId;
        await chrome.storage.local.set({ scanPipeline });
      }
    } else {
      // No existing tab — create one
      const tab = await chrome.tabs.create({ url: page.url, active: false });
      tabId = tab.id;
      scanPipeline.scanTabId = tabId;
      await chrome.storage.local.set({ scanPipeline });
    }

    // Wait for page load, then inject content script
    let injected = false;

    const injectScanner = () => {
      if (injected) return;
      injected = true;
      console.log(`[Jobseek BG] ${page.label} tab ready — injecting scanner`);
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['utils/prefilter.js', 'utils/dedup.js', 'content.js'],
      }).catch(err => {
        console.error(`[Jobseek BG] Failed to inject into ${page.label}:`, err.message);
      });
    };

    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId !== tabId || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      injectScanner();
    };

    chrome.tabs.onUpdated.addListener(onUpdated);

    // Fallback: if onUpdated never fires 'complete' (LinkedIn SPA navigation),
    // inject after 10 seconds anyway. This handles cases where LinkedIn's
    // client-side router navigates without triggering a full page load.
    setTimeout(() => {
      if (!injected) {
        console.log(`[Jobseek BG] ${page.label} — fallback injection (no 'complete' event after 10s)`);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        injectScanner();
      }
    }, 10_000);

    // Schedule the next step via alarm (survives service worker restarts)
    const delayMinutes = page.waitMs / 60_000;
    chrome.alarms.create('scan-next-step', { delayInMinutes: delayMinutes });

  } catch (err) {
    console.error(`[Jobseek BG] Scan step ${page.label} failed:`, err.message);
    // Try to advance to next step anyway
    scanPipeline.stepIndex = stepIndex + 1;
    await chrome.storage.local.set({ scanPipeline });
    chrome.alarms.create('scan-next-step', { delayInMinutes: 0.1 });
  }
}

async function cleanupScanPipeline(pipeline, immediate = false) {
  // Clear any pending scan-next-step alarm
  await chrome.alarms.clear('scan-next-step');
  await chrome.storage.local.remove(['scanPipeline']);

  if (pipeline?.scanTabId) {
    if (immediate) {
      chrome.tabs.remove(pipeline.scanTabId).catch(() => {});
      console.log('[Jobseek BG] Closed silent scan tab (immediate)');
    } else {
      // Grace period: content.js may still be extracting + sending posts
      // Wait 10s before closing to let it finish
      const tabId = pipeline.scanTabId;
      console.log(`[Jobseek BG] Scan complete — closing tab ${tabId} in 10s (grace period)`);
      setTimeout(() => {
        chrome.tabs.remove(tabId).catch(() => {});
        console.log('[Jobseek BG] Closed silent scan tab after grace period');
      }, 10_000);
    }
  }
}

async function triggerScanSummary() {
  try {
    const { deviceToken } = await chrome.storage.local.get(['deviceToken']);
    if (!deviceToken) return;

    // Fetch recent signals to include in summary
    const { signals = [] } = await chrome.storage.local.get(['signals']);
    // Only summarize signals from last 30 minutes (this scan cycle)
    const recentCutoff = Date.now() - 30 * 60 * 1000;
    const recentSignals = signals.filter(s =>
      s.detectedAt && new Date(s.detectedAt).getTime() > recentCutoff
    );

    if (recentSignals.length === 0) {
      console.log('[Jobseek BG] No recent signals to summarize');
      return;
    }

    console.log(`[Jobseek BG] Generating scan summary for ${recentSignals.length} recent signals`);
    const SUMMARY_URL = getApiUrl(API_PATHS.summary);
    const res = await fetch(SUMMARY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: deviceToken, signals: recentSignals }),
    });

    if (res.ok) {
      console.log('[Jobseek BG] Scan summary generated successfully');
    } else {
      console.warn('[Jobseek BG] Scan summary generation failed:', res.status);
    }
  } catch (err) {
    console.warn('[Jobseek BG] Scan summary skipped:', err.message);
  }
}
