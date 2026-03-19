import { generateText } from '@/lib/google/client'
import type { Person, Company, CandidateContext, OutreachVariants } from '@/types'

export async function generateOutreach(
  person: Person,
  company: Company,
  userContext: CandidateContext
): Promise<OutreachVariants> {
  const companySummary = company.summary ?? company.description ?? `${company.name}, a ${company.funding_stage ?? 'venture-backed'} company`
  const hiringSignal = company.hiring_signals?.[0] ?? company.growth_signal ?? 'recently funded'

  // Run both in parallel
  const [linkedinText, emailText] = await Promise.all([
    generateText(
      `You write LinkedIn connection notes for job seekers reaching out to hiring managers. You are concise, specific, and human.`,
      `Write a LinkedIn connection request note.

Candidate: ${userContext.candidateSummary.slice(0, 300)}
Recipient: ${person.name}, ${person.title ?? 'leader'} at ${company.name}
Company context: ${companySummary}
Recent signal: ${hiringSignal}

STRICT RULES:
- Under 280 characters STRICTLY (this is critical)
- Include ONE specific company detail — not generic praise
- Do NOT open with "I came across your profile" or "I hope this finds you well"
- Conversational, not salesy
- End with a soft question or observation, not a hard ask
- Do NOT include any hashtags

Output ONLY the message. No explanation, no quotes.`,
      { temperature: 0.7, maxTokens: 150 }
    ).catch(() => `Hi ${person.name}, I noticed ${company.name}'s recent growth and would love to connect.`),

    generateText(
      `You write cold emails from job seekers to hiring managers. Every email must feel personally researched, not templated.`,
      `Write a cold email from a job seeker to a hiring manager.

Candidate: ${userContext.candidateSummary.slice(0, 400)}
Candidate name: ${userContext.name ?? 'the candidate'}
Recipient: ${person.name}, ${person.title ?? 'leader'} at ${company.name}
Company: ${companySummary}
Recent signal: ${hiringSignal}
Company stage: ${company.funding_stage ?? 'venture-backed'}

STRICT RULES:
- 150-200 words total
- First sentence MUST reference something specific about the company (their product, funding, recent news, or growth stage)
- Sentence 2: candidate's strongest relevant credential
- Clear ask: 20-min conversation to explore fit
- Do NOT use: "I hope this finds you well", "I am writing to express my interest", "I came across your company"
- Sign off as ${userContext.name ?? 'the candidate'}
- Subject line should be specific and intriguing (not "Exploring opportunities")

Output format (no markdown, no extra text):
Subject: [subject line here]

[email body here]`,
      { temperature: 0.7, maxTokens: 400 }
    ).catch(() => `Subject: Exploring fit at ${company.name}\n\nHi ${person.name},\n\nI'd love to connect about opportunities at ${company.name}.\n\nBest,\n${userContext.name ?? 'The candidate'}`),
  ])

  // Parse subject from email text
  const lines = emailText.split('\n')
  const subjectLine = lines.find(l => l.startsWith('Subject:'))
  const subject = subjectLine ? subjectLine.replace('Subject:', '').trim() : `Exploring fit at ${company.name}`
  const bodyStart = subjectLine ? lines.indexOf(subjectLine) + 1 : 0
  const emailBody = lines.slice(bodyStart).join('\n').trim()

  return {
    linkedin: linkedinText.slice(0, 300), // Hard cap
    email: {
      subject,
      body: emailBody,
    },
  }
}
