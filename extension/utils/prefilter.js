// utils/prefilter.js
// Lightweight noise killer — runs locally, zero API cost.
// Returns true = KEEP (send to Gemini), false = DISCARD silently.

window.preFilter = function(post) {
  const tag = `[Prefilter] "${(post.author || '').slice(0, 25)}"`;

  // 1. Kill promoted / ad posts
  if (post.isPromoted) {
    console.log(`${tag} DROPPED: promoted/ad post`);
    return false;
  }

  // 2. Kill posts with zero network relevance
  //    (unknown degree AND no reactor = scraper couldn't parse the post at all, skip)
  //    Exception: JOBS source posts always pass (degree='job')
  if (post.degree === 'unknown' && !post.reactor) {
    console.log(`${tag} DROPPED: unknown degree + no reactor`);
    return false;
  }

  // 3. Keep 3rd+ degree posts — Gemini will decide if they're worth actioning.
  //    Only kill 3rd+ posts shorter than 80 chars (too thin to be a real signal).
  if (post.degree === '3rd+' && !post.reactor && (post.body || '').trim().length < 80) {
    console.log(`${tag} DROPPED: 3rd+ degree, body < 80 chars (${(post.body || '').trim().length})`);
    return false;
  }

  // 4. Kill posts with too little body text (no substance to classify)
  if ((post.body || '').trim().length < 40) {
    console.log(`${tag} DROPPED: body too short (${(post.body || '').trim().length} chars)`);
    return false;
  }

  // 5. Kill pure social noise — birthday wishes, anniversaries, holiday greetings
  const socialNoise = /^(happy birthday|congratulations on (your )?\d+ (year|anniversary)|work anniversary|happy new year|happy diwali|happy eid|happy holi|happy (christmas|thanksgiving|halloween)|season'?s? greetings|wishing you (a )?(happy|great|wonderful))/i;
  if (socialNoise.test((post.body || '').trim())) {
    console.log(`${tag} DROPPED: social noise`);
    return false;
  }

  // 6. Kill pure engagement bait
  const engagementBait = /^(like if you|tag someone who|comment (yes|no|below) if|double tap if|share if you)/i;
  if (engagementBait.test((post.body || '').trim())) {
    console.log(`${tag} DROPPED: engagement bait`);
    return false;
  }

  // 7. Kill posts older than 7 days — too stale to act on
  //    Exception: job-source posts (degree='job') don't have reliable timestamps
  if (post.degree !== 'job' && post.timeMinutes > 10080) {
    console.log(`${tag} DROPPED: too old (${post.timeMinutes} mins = ${(post.timeMinutes / 1440).toFixed(1)} days)`);
    return false;
  }

  // Passed all filters — send to Gemini
  console.log(`${tag} PASSED: degree=${post.degree}, reactor=${post.reactor || 'none'}, body=${(post.body || '').trim().length} chars, source=${post.source || 'FEED'}`);
  return true;
};
