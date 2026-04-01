/**
 * Prompt for finalizing the candidate model after intake is complete.
 * Generates: linkedin_headline, bio_short, bio_long, resume_bullets, completeness_score
 */

export function buildCompletionPrompt(model: Record<string, unknown>): string {
  return `Based on this candidate's profile, generate the following outputs.
Return ONLY valid JSON.

Candidate profile:
${JSON.stringify(model, null, 2)}

Generate:
{
  "linkedin_headline": "Optimised LinkedIn headline — max 220 chars, keyword-rich, specific",
  "bio_short": "2-sentence bio for outreach messages — personal, specific, not generic",
  "bio_long": "4-5 sentence about section for personal website — professional but human",
  "resume_bullets": [
    {
      "company": "string",
      "title": "string",
      "bullets": [
        "Quantified impact bullet — verb + what + metric (e.g. 'Rebuilt activation flow, reducing time-to-first-value 73% (11d→3d) across 50K monthly signups')",
        "Second bullet",
        "Third bullet"
      ]
    }
  ],
  "completeness_score": "integer 0-100 based on how complete the profile is"
}`
}
