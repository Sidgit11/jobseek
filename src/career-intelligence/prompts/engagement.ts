/**
 * Prompts for Engagement Intelligence — generating LinkedIn comments.
 * Comments must blend the POST CONTENT with the USER'S BACKGROUND.
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
  const hasModel = candidateModel && Object.keys(candidateModel).length > 0

  return `You are writing a LinkedIn comment that does TWO things at once:
1. Engages meaningfully with the SPECIFIC CONTENT of the post (not generic praise)
2. Weaves in the commenter's relevant experience to build credibility

POST TO COMMENT ON:
Author: ${opportunity.author_name} (${opportunity.author_title} at ${opportunity.author_company})
Post content: "${opportunity.post_text}"

${hasModel ? `COMMENTER'S BACKGROUND (use this to add credibility — pick the most relevant parts):
${JSON.stringify(candidateModel, null, 2)}` : 'COMMENTER has no detailed profile yet — write a strong comment based on the post content alone.'}

Suggested angle: ${opportunity.suggested_angle ?? 'Find a specific claim or insight in the post and respond to it with a real take'}

APPROACH:
1. First, identify the core argument or insight in the post
2. Then respond to THAT SPECIFIC POINT — not the post in general
3. Connect it to a concrete experience or observation from the commenter's background
4. The comment should feel like "someone who's been there" responding, not a stranger complimenting

RULES:
- 3-5 sentences max. Every sentence must earn its place.
- First sentence must reference something SPECIFIC from the post (a claim, number, or idea)
- NEVER start with "Great post", "Insightful", "Fascinating", "This is so true", or any affirmation
- Take a real stance — agree with nuance, add a counter-example, or respectfully disagree
- If the commenter has relevant experience, reference it naturally (e.g. "When I built X at Company, we saw the same pattern..." not "As a Senior PM with 6 years experience...")
- End with a genuine question that invites a reply — make it specific to the post's topic
- Sound human. No corporate speak. Write like you'd talk to a smart colleague at a bar.
- Do NOT use: "absolutely", "totally", "100%", "spot on", "leverage", "holistic", "resonates"

Return ONLY the comment text. No labels, no quotes, no preamble.`
}
