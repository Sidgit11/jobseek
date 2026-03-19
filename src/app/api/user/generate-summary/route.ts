import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/google/client'
import { routeLogger } from '@/lib/logger'

const log = routeLogger('user/generate-summary')

const SYSTEM_PROMPT = `You are an expert career coach writing a professional summary for outbound job outreach.

Write a 80-120 word professional summary (500-800 characters) that would make a hiring manager or recruiter want to respond to a cold message. The summary MUST be at least 80 words and at most 120 words. The summary should:

1. Open with a strong identity statement (who they are + their superpower)
2. Highlight 2-3 specific accomplishments or notable companies
3. Show career trajectory and momentum
4. End with what they're looking for next

Style guide:
- Be specific, not generic. "Scaled a 0→1 product to 2M users" > "experienced product leader"
- Use active voice and concrete numbers when available
- Sound human and confident, not corporate or robotic
- Don't use buzzwords like "passionate", "results-driven", "detail-oriented"
- Don't start with "I am" or "I'm"
- Write in third person initially, then first person for the "looking for" part

Output ONLY the summary text. No intro, no explanation, no quotes.`

export async function POST(request: NextRequest) {
  try {
    const { linkedinProfile, resumeText, preferences } = await request.json()

    const parts: string[] = []

    // LinkedIn data
    if (linkedinProfile) {
      parts.push('=== LINKEDIN PROFILE ===')
      if (linkedinProfile.name) parts.push(`Name: ${linkedinProfile.name}`)
      if (linkedinProfile.headline) parts.push(`Headline: ${linkedinProfile.headline}`)
      if (linkedinProfile.company) parts.push(`Current: ${linkedinProfile.role || ''} at ${linkedinProfile.company}`)
      if (linkedinProfile.location) parts.push(`Location: ${linkedinProfile.location}`)
      if (linkedinProfile.about) parts.push(`About: ${linkedinProfile.about.slice(0, 500)}`)

      if (linkedinProfile.experience?.length > 0) {
        parts.push('Experience:')
        for (const exp of linkedinProfile.experience.slice(0, 6)) {
          const line = [exp.role || exp.title, exp.company, exp.duration].filter(Boolean).join(' | ')
          if (line) parts.push(`  - ${line}`)
        }
      }

      if (linkedinProfile.education?.length > 0) {
        parts.push('Education:')
        for (const edu of linkedinProfile.education.slice(0, 2)) {
          parts.push(`  - ${[edu.degree, edu.school].filter(Boolean).join(' from ')}`)
        }
      }
    }

    // Resume text
    if (resumeText) {
      parts.push('=== RESUME TEXT ===')
      parts.push(resumeText.slice(0, 3000))
    }

    // User preferences
    if (preferences) {
      parts.push('=== JOB SEARCH PREFERENCES ===')
      if (preferences.target_roles?.length) parts.push(`Target roles: ${preferences.target_roles.join(', ')}`)
      if (preferences.seniority) parts.push(`Seniority: ${preferences.seniority}`)
      if (preferences.target_locations?.length) parts.push(`Locations: ${preferences.target_locations.join(', ')}`)
      if (preferences.target_industries?.length) parts.push(`Industries: ${preferences.target_industries.join(', ')}`)
      if (preferences.company_stages?.length) parts.push(`Company stages: ${preferences.company_stages.join(', ')}`)
    }

    if (parts.length === 0) {
      return NextResponse.json({ error: 'No profile data provided' }, { status: 400 })
    }

    const userPrompt = `Write a professional outreach summary for this person:\n\n${parts.join('\n')}`

    log.req({ hasLinkedin: !!linkedinProfile, hasResume: !!resumeText, hasPreferences: !!preferences, inputChars: userPrompt.length })
    const start = Date.now()
    const summary = await generateText(SYSTEM_PROMPT, userPrompt, { temperature: 0.6, maxTokens: 2000 })
    const wordCount = summary.split(/\s+/).length
    log.step('gemini-call', { timing: Date.now() - start, chars: summary.length, words: wordCount })
    if (wordCount < 50) log.warn('short-summary', { words: wordCount, summary: summary.slice(0, 100) })

    log.res(200, { chars: summary.length, words: wordCount })
    return NextResponse.json({ summary })
  } catch (err) {
    log.err('generate', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
