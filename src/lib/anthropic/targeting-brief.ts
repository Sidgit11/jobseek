import { generateText } from '@/lib/google/client'
import type { Company, SearchIntent, CandidateContext, TargetingBrief, ATSResult } from '@/types'

export async function generateTargetingBrief(
  company: Company,
  intent: SearchIntent,
  userContext: CandidateContext,
  snippet: string,
  atsData?: ATSResult | null,
): Promise<TargetingBrief> {
  const implicitContext = intent.implicitSignals.length > 0
    ? `Implicit signals: ${intent.implicitSignals.join(', ')}`
    : ''

  // Build ATS context section if we have real job board data
  let atsContext = ''
  if (atsData && atsData.total_open_roles > 0) {
    const roleSummary = atsData.matched_roles.length > 0
      ? atsData.matched_roles.slice(0, 5).map(r => {
          const posted = r.posted_date ? `, posted ${new Date(r.posted_date).toLocaleDateString()}` : ''
          return `  - ${r.title}${r.department ? ` (${r.department})` : ''}${posted}`
        }).join('\n')
      : atsData.open_roles.slice(0, 5).map(r => `  - ${r.title}`).join('\n')

    atsContext = `
OPEN ROLES (from their ${atsData.ats} job board — real-time data):
${roleSummary}
Total open positions: ${atsData.total_open_roles}
Matched to seeker's target roles: ${atsData.matched_roles.length}
USE THIS DATA — it's the strongest "why now" signal. Reference specific role titles and posting dates.`
  }

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
${atsContext}

Return JSON:
{
  "whyNow": [
    "2-3 SHORT time-sensitive reasons to reach out NOW (each under 15 words). Be specific — mention funding dates, hiring velocity, team gaps, market timing, or SPECIFIC open roles from the ATS data. Don't be generic."
  ],
  "yourAngle": "1-2 sentences. How the seeker's SPECIFIC background maps to this company's current needs. If there are matched open roles, reference them directly. Don't be generic — use specifics from both profiles.",
  "openingLine": "A cold email opener (1-2 sentences, under 40 words). Must reference a SPECIFIC company signal (funding, hire, launch, or a specific open role). Must feel personal, not templated. End with a soft ask."
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
        ...(atsData?.matched_roles.length ? [`They have ${atsData.matched_roles.length} open ${userContext.targetRoles[0] ?? ''} roles right now`] : []),
      ],
      yourAngle: `Your background in ${userContext.targetRoles[0] ?? 'relevant roles'} aligns with their current stage and growth trajectory.`,
      openingLine: `Came across ${company.name} and was impressed by what you're building — would love to chat about how I might contribute.`,
    }
  }
}
