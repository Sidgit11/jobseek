import { generateText } from '@/lib/google/client'
import type { Company, SearchIntent, CandidateContext, TargetingBrief } from '@/types'

export async function generateTargetingBrief(
  company: Company,
  intent: SearchIntent,
  userContext: CandidateContext,
  snippet: string
): Promise<TargetingBrief> {
  const implicitContext = intent.implicitSignals.length > 0
    ? `Implicit signals: ${intent.implicitSignals.join(', ')}`
    : ''

  const text = await generateText(
    `You are a job search strategist generating targeting intelligence briefs. Be specific, actionable, and time-sensitive. Return ONLY valid JSON — no markdown, no explanation.`,
    `Generate a targeting brief for this company match.

COMPANY:
Name: ${company.name}
Stage: ${company.funding_stage ?? 'Unknown'}
Headcount: ${company.headcount ?? 'Unknown'}
Total Funding: ${company.total_funding ?? 'Unknown'}
Description: ${snippet || company.description || 'No description'}
Last Funded: ${company.last_round_date ?? 'Unknown'}
Investors: ${company.investors?.join(', ') ?? 'Unknown'}

JOB SEEKER:
Name: ${userContext.name ?? 'Job seeker'}
Background: ${userContext.candidateSummary?.slice(0, 300) || 'Not provided'}
Target roles: ${userContext.targetRoles.join(', ') || 'Not specified'}
Target industries: ${userContext.targetIndustries.join(', ') || 'Not specified'}
Location: ${userContext.location ?? 'Not specified'}

SEARCH CONTEXT:
Query sectors: ${intent.sectors.join(', ')}
${implicitContext}
Temporal: ${intent.temporal ?? 'any'}

Return JSON:
{
  "whyNow": [
    "2-3 SHORT time-sensitive reasons to reach out NOW (each under 15 words). Be specific — mention funding dates, hiring velocity, team gaps, market timing. Don't be generic."
  ],
  "yourAngle": "1-2 sentences. How the seeker's SPECIFIC background maps to this company's current needs. Reference their actual experience, the company's stage, and a concrete gap they could fill. Don't be generic — use specifics from both profiles.",
  "openingLine": "A cold email opener (1-2 sentences, under 40 words). Must reference a SPECIFIC company signal (funding, hire, launch). Must feel personal, not templated. End with a soft ask."
}`,
    { temperature: 0.6, maxTokens: 600 }
  )

  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      whyNow: Array.isArray(parsed.whyNow) ? parsed.whyNow.slice(0, 3) : [],
      yourAngle: parsed.yourAngle || '',
      openingLine: parsed.openingLine || '',
    }
  } catch {
    return {
      whyNow: [
        `${company.name} is a ${company.funding_stage ?? 'venture-backed'} company worth exploring`,
      ],
      yourAngle: `Your background in ${userContext.targetRoles[0] ?? 'relevant roles'} aligns with their current stage and growth trajectory.`,
      openingLine: `Came across ${company.name} and was impressed by what you're building — would love to chat about how I might contribute.`,
    }
  }
}
