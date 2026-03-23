import { generateText } from '@/lib/google/client'
import type { Company, SearchIntent, CandidateContext, TargetingBrief, ATSResult } from '@/types'

// ── Data-driven fallback (no LLM needed) ─────────────────────────────────────

function buildDataDrivenFallback(
  company: Company,
  intent: SearchIntent,
  userContext: CandidateContext,
  atsData?: ATSResult | null,
): TargetingBrief {
  // WHY NOW: only include data-backed signals
  const whyNow: string[] = []

  if (company.last_round_date && company.total_funding) {
    const months = Math.floor((Date.now() - new Date(company.last_round_date).getTime()) / (1000 * 60 * 60 * 24 * 30))
    if (months < 18) {
      whyNow.push(`Raised ${company.total_funding} (${company.funding_stage ?? 'unknown stage'}) ${months} months ago`)
    }
  } else if (company.funding_stage && company.total_funding) {
    whyNow.push(`${company.funding_stage} company — raised ${company.total_funding} total`)
  }

  // Priority 1: Role matching the SEARCH QUERY (what user searched for)
  if (intent.roleSignal && atsData) {
    const searchRole = intent.roleSignal.replace(/_/g, ' ').toLowerCase()
    const searchRoleMatch = atsData.open_roles.find(r =>
      r.title.toLowerCase().includes(searchRole)
    )
    if (searchRoleMatch) {
      const daysAgo = searchRoleMatch.posted_date
        ? Math.floor((Date.now() - new Date(searchRoleMatch.posted_date).getTime()) / (1000 * 60 * 60 * 24))
        : null
      whyNow.push(`Hiring "${searchRoleMatch.title}"${daysAgo !== null && daysAgo < 60 ? ` (posted ${daysAgo}d ago)` : ''} on ${atsData.ats}`)
    }
  }

  // Priority 2: Role matching USER PROFILE target roles
  if (atsData && atsData.matched_roles.length > 0) {
    // Don't duplicate if we already added a search-role match
    const alreadyHasRoleSignal = whyNow.some(w => w.includes('Hiring "'))
    if (!alreadyHasRoleSignal) {
      const topRole = atsData.matched_roles[0]
      const daysAgo = topRole.posted_date
        ? Math.floor((Date.now() - new Date(topRole.posted_date).getTime()) / (1000 * 60 * 60 * 24))
        : null
      whyNow.push(`Hiring "${topRole.title}"${daysAgo !== null && daysAgo < 60 ? ` (posted ${daysAgo}d ago)` : ''} on ${atsData.ats}`)
    }
  } else if (atsData && atsData.total_open_roles > 0) {
    whyNow.push(`${atsData.total_open_roles} open role${atsData.total_open_roles !== 1 ? 's' : ''} on their ${atsData.ats} board`)
  }

  if (company.headcount && company.headcount < 200) {
    whyNow.push(`Team size: ~${company.headcount} — early enough to make impact`)
  }

  if (whyNow.length === 0) {
    whyNow.push('Limited public data — worth a closer look if the mission resonates')
  }

  // YOUR ANGLE: cascade through personalization strategies
  let yourAngle = ''
  const companyDesc = (company.description ?? '').toLowerCase()

  // 1. Industry overlap from user profile
  if (!yourAngle && userContext.targetIndustries.length > 0) {
    for (const ind of userContext.targetIndustries) {
      const terms = ind.toLowerCase().split(/\s*[\/,]\s*/)
      if (terms.some(t => t.length > 2 && companyDesc.includes(t))) {
        yourAngle = `Your experience in ${ind} directly maps to ${company.name}'s domain.`
        break
      }
    }
  }

  // 2. LinkedIn experience company/domain overlap
  if (!yourAngle && userContext.linkedinExperience && userContext.linkedinExperience.length > 0) {
    for (const exp of userContext.linkedinExperience) {
      const expCompanyLower = exp.company.toLowerCase()
      if (companyDesc.includes(expCompanyLower) || companyDesc.split(/\s+/).some(word =>
        word.length > 4 && expCompanyLower.includes(word)
      )) {
        yourAngle = `Your experience as ${exp.title} at ${exp.company} maps directly to ${company.name}'s domain.`
        break
      }
    }
  }

  // 3. Seniority + stage match
  if (!yourAngle && userContext.seniority && company.funding_stage) {
    const seniorityLabel = userContext.seniority === 'executive' ? 'executive-level'
      : userContext.seniority === 'management' ? 'management-level'
      : userContext.seniority === 'lead' ? 'lead-level'
      : userContext.seniority === 'senior' ? 'senior'
      : ''
    if (seniorityLabel) {
      if (company.headcount && company.headcount < 100) {
        yourAngle = `As a ${seniorityLabel} ${userContext.targetRoles[0] ?? 'professional'}, you'd be joining a ${company.headcount}-person team at a critical growth stage.`
      } else {
        yourAngle = `As a ${seniorityLabel} ${userContext.targetRoles[0] ?? 'professional'}, you'd bring experience to a ${company.funding_stage} company building its leadership bench.`
      }
    }
  }

  // 4. Stage preference fit
  if (!yourAngle && userContext.companyStages.length > 0 && company.funding_stage) {
    const stageMatch = userContext.companyStages.some(s =>
      company.funding_stage?.toLowerCase().includes(s.toLowerCase().replace('stage', '').trim())
    )
    if (stageMatch) {
      yourAngle = `${company.name} is at ${company.funding_stage} — one of your preferred company stages. Your ${userContext.targetRoles[0] ?? 'professional'} background fits their growth phase.`
    }
  }

  // 5. Location match
  if (!yourAngle && userContext.targetLocations.length > 0) {
    const locMatch = userContext.targetLocations.find(loc => companyDesc.includes(loc.toLowerCase()))
    if (locMatch) {
      yourAngle = `${company.name} is based in ${locMatch}, matching your location preference. Your ${userContext.targetRoles[0] ?? 'professional'} background could be a strong fit.`
    }
  }

  // 6. Generic fallback with LinkedIn headline if available
  if (!yourAngle) {
    if (userContext.linkedinHeadline) {
      yourAngle = `Your background as "${userContext.linkedinHeadline}" could add value as ${company.name} scales.`
    } else {
      yourAngle = `Your ${userContext.targetRoles[0] ?? 'professional'} background could add value as ${company.name} scales.`
    }
  }

  // OPENING LINE: reference most specific data point
  let openingLine = ''

  // Best: reference a search-role matched ATS role
  if (intent.roleSignal && atsData) {
    const searchRole = intent.roleSignal.replace(/_/g, ' ').toLowerCase()
    const match = atsData.open_roles.find(r => r.title.toLowerCase().includes(searchRole))
    if (match) {
      openingLine = `Noticed ${company.name} is looking for a ${match.title} — would love to discuss how my background fits.`
    }
  }

  // Next: reference a profile-matched ATS role
  if (!openingLine && atsData?.matched_roles.length) {
    openingLine = `Noticed ${company.name} is looking for a ${atsData.matched_roles[0].title} — would love to discuss how my background fits.`
  }

  // Next: reference funding
  if (!openingLine && company.last_round_date && company.funding_stage) {
    openingLine = `Congrats on the ${company.funding_stage} round — would love to chat about how I could contribute as ${company.name} grows.`
  }

  // Last resort
  if (!openingLine) {
    openingLine = `${company.name} caught my eye — would love to learn more about where the team is headed.`
  }

  return { whyNow: whyNow.slice(0, 3), yourAngle, openingLine }
}

// ── Main brief generation ────────────────────────────────────────────────────

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

  // Build experience context from LinkedIn
  let experienceContext = ''
  if (userContext.linkedinExperience && userContext.linkedinExperience.length > 0) {
    const expLines = userContext.linkedinExperience.slice(0, 5).map(e =>
      `  - ${e.title} at ${e.company} (${e.duration})`
    ).join('\n')
    experienceContext = `\nPast experience:\n${expLines}`
  }

  // Build seniority + stage context
  const seniorityLine = userContext.seniority ? `Seniority: ${userContext.seniority}` : ''
  const stagePrefLine = userContext.companyStages.length > 0
    ? `Preferred company stages: ${userContext.companyStages.join(', ')}`
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
${userContext.linkedinHeadline ? `Headline: ${userContext.linkedinHeadline}` : ''}
Background: ${userContext.candidateSummary?.slice(0, 400) || 'Not provided'}
Target roles: ${userContext.targetRoles.join(', ') || 'Not specified'}
Target industries: ${userContext.targetIndustries.join(', ') || 'Not specified'}
Location: ${userContext.location ?? 'Not specified'}
${seniorityLine}
${stagePrefLine}
${experienceContext}

SEARCH CONTEXT:
Query sectors: ${intent.sectors.join(', ')}
${intent.roleSignal ? `Search role: ${intent.roleSignal.replace(/_/g, ' ')} (the user is specifically looking for this role)` : ''}
${implicitContext}
Temporal: ${intent.temporal ?? 'any'}
${atsContext}

Return JSON:
{
  "whyNow": [
    "2-3 SHORT time-sensitive reasons to reach out NOW (each under 15 words)"
  ],
  "yourAngle": "1-2 sentences personalized pitch",
  "openingLine": "Cold email opener (1-2 sentences, under 40 words)"
}

STRICT RULES:
- whyNow: ONLY data-backed signals. Use funding amount+date, specific ATS role title+posting date, headcount number, investor names. NEVER say "venture-backed company worth exploring" or "growing team" — those are useless.
- yourAngle: Cross-reference the seeker's PAST EXPERIENCE with this company. If the seeker worked at a SaaS company and this is SaaS, SAY THAT. If the seeker worked at a similar-stage company, mention it. If seniority is senior+ and company is early-stage, highlight the leadership opportunity. Be SPECIFIC — reference actual company names from their experience.
- openingLine: Reference the MOST SPECIFIC data point available. Prefer: specific ATS role title > funding event with amount > company product detail. NEVER use "impressed by what you're building" — be concrete.
- If seeker's preferred company stages match this company's stage, mention the fit.
- If there are matched ATS roles, reference them by title in all three sections.
- If a "Search role" is specified above, prioritize ATS roles matching THAT role over the seeker's profile roles in the whyNow section.`,
    { temperature: 0.6, maxTokens: 800 }
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
    return buildDataDrivenFallback(company, intent, userContext, atsData)
  }
}
