import { generateText } from '@/lib/google/client'
import { z } from 'zod'
import type { Company, NewsItem, CandidateContext } from '@/types'

const CompanySummarySchema = z.object({
  summary: z.string(),
  whyFit: z.string(),
  hiringSignals: z.array(z.string()),
  redFlags: z.array(z.string()),
})

export async function generateCompanySummary(
  company: Company,
  news: NewsItem[],
  userContext: CandidateContext
): Promise<{ summary: string; why_fit: string; hiring_signals: string[]; red_flags: string[] }> {
  const newsText = news
    .slice(0, 5)
    .map(n => `- ${n.title}: ${n.snippet}`)
    .join('\n')

  const text = await generateText(
    `You are a career intelligence analyst helping a job seeker evaluate companies.
Return ONLY valid JSON — no markdown, no explanation.`,
    `Generate a company intelligence brief for this job seeker.

Company: ${company.name}
Stage: ${company.funding_stage ?? 'Unknown'}
Headcount: ${company.headcount ?? 'Unknown'}
Total Funding: ${company.total_funding ?? 'Unknown'}
Description: ${company.description ?? 'No description'}

Recent news:
${newsText || 'No recent news available.'}

Job seeker profile:
Target roles: ${userContext.targetRoles.join(', ')}
Target industries: ${userContext.targetIndustries.join(', ')}
Background: ${userContext.candidateSummary.slice(0, 300)}

Return JSON:
{
  "summary": "3 sentences max. Include: what they build, company stage, recent momentum or notable signal.",
  "whyFit": "1-2 sentences. Explain specifically why this company is interesting for someone targeting ${userContext.targetRoles.join('/')} roles. Be concrete — mention the stage, a specific signal, or a product angle.",
  "hiringSignals": ["2-4 signals indicating they might be hiring or growing — be specific"],
  "redFlags": ["0-2 genuine concerns if any — leave empty array if none"]
}`,
    { temperature: 0.5, maxTokens: 600 }
  )

  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = CompanySummarySchema.parse(JSON.parse(cleaned))
    return {
      summary: parsed.summary,
      why_fit: parsed.whyFit,
      hiring_signals: parsed.hiringSignals,
      red_flags: parsed.redFlags,
    }
  } catch {
    return {
      summary: `${company.name} is a ${company.funding_stage ?? 'venture-backed'} company.`,
      why_fit: `This company aligns with your interest in ${userContext.targetRoles[0] ?? 'relevant'} roles.`,
      hiring_signals: ['Recently funded', 'Growing team'],
      red_flags: [],
    }
  }
}

export async function generateCandidateSummary(
  resumeText: string,
  targetRoles: string[],
  targetIndustries: string[]
): Promise<string> {
  return generateText(
    `You are an expert career coach writing a professional summary for outbound job outreach. Be specific, human, and memorable.`,
    `Generate a 150-word professional summary optimized for cold outreach to hiring managers.

Requirements:
- Focus on: unique skills, notable companies/projects, career trajectory signal
- Be specific and memorable — avoid corporate clichés
- Tone: confident but human, not salesy
- Must be usable as a first-person intro in a cold email or LinkedIn note

Resume:
${resumeText.slice(0, 3000)}

Target roles: ${targetRoles.join(', ')}
Target industries: ${targetIndustries.join(', ')}

Output ONLY the summary text. No intro, no explanation, no quotes.`,
    { temperature: 0.6, maxTokens: 400 }
  )
}
