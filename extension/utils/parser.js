// utils/parser.js
// Exported as window.classifySignal for use in content.js

const PATTERNS = {
  JOB_CHANGE: /started a new (position|role|job)|is now .{3,60} at |joined .{3,40} as|new journey begins|excited to (announce|share).{0,80}(join|role|position)|new chapter|new role at|new position at|thrilled to (join|announce)|happy to (share|announce).{0,60}(join|role)/i,
  HIRING: /we'?re? hiring|we are hiring|looking for.{3,50}(engineer|manager|designer|lead|head|director|pm\b|product manager)|open role|join our team|hiring (a |an )[\w]+|apply (now|here)|link in (bio|comments) to apply/i,
  FUNDING: /raised \$|series [abcde]\b|seed round|just closed|closed \$|million in funding|\$[\d\.]+[mk] (round|raise|seed|series|funding)|announced.{0,30}funding|secured.{0,30}funding/i,
};

window.classifySignal = function({ raw, body, title, author, reactor, degree, timeStr, timeMinutes, source }) {
  let type = null;
  let tier = 3;
  let preview = body.slice(0, 200);

  if (PATTERNS.JOB_CHANGE.test(raw)) {
    type = 'JOB_CHANGE';
    tier = 1;
  } else if (PATTERNS.HIRING.test(raw)) {
    type = 'HIRING_POST';
    tier = 1;
  } else if (PATTERNS.FUNDING.test(raw)) {
    type = 'FUNDING_SIGNAL';
    tier = 1;
  } else if (
    body.length > 150 &&
    (degree === '1st' || degree === '2nd' || degree === 'Following') &&
    timeMinutes < 4320 // within 3 days
  ) {
    type = 'THOUGHT_LEADERSHIP';
    tier = 2;
  }

  if (!type) return null;

  return {
    id: `${author}_${type}_${timeMinutes}`.replace(/\s+/g, '_').toLowerCase(),
    type,
    tier,
    author,
    reactor: reactor || null,  // 1st-degree connection who liked/shared — warm outreach context
    title,
    degree,
    preview,
    timeStr,
    timeMinutes,
    source,
    detectedAt: new Date().toISOString(),
  };
};
