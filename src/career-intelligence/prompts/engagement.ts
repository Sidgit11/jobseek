/**
 * Prompts for Engagement Intelligence — generating LinkedIn comments.
 */

export function buildCommentPrompt(
  candidateModel: Record<string, unknown> | null,
  opportunity: {
    author_name: string | null
    author_title: string | null
    author_company: string | null
    post_text: string
    suggested_angle: string | null
  }
): string {
  return `You are helping a professional write a LinkedIn comment that builds their credibility and starts a conversation.

CANDIDATE BACKGROUND:
${JSON.stringify(candidateModel, null, 2)}

POST TO COMMENT ON:
Author: ${opportunity.author_name} (${opportunity.author_title} at ${opportunity.author_company})
Post: "${opportunity.post_text}"

Suggested angle: ${opportunity.suggested_angle ?? 'Take a thoughtful stance that showcases expertise'}

RULES FOR THE COMMENT:
- 3-5 sentences max. Dense, not fluffy.
- NEVER start with "Great post", "Insightful", "Fascinating", "This is so true", or any affirmation
- Take a real stance — agree with nuance, add a counter-example, or respectfully disagree
- Reference the candidate's specific background where it adds credibility (not generically)
- Add one specific data point, example, or lived experience
- End with a genuine question that invites a reply
- Sound human, not AI-generated. Avoid corporate/buzzword language.
- Do NOT use: "absolutely", "totally", "100%", "spot on", "leverage", "holistic"

Return ONLY the comment text. No labels, no quotes, no preamble.`
}
