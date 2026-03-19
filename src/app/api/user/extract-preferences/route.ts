import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/google/client'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Valid options that Gemini can pick from (must match frontend constants)
const VALID_ROLES = ['Product Manager', 'Software Engineer', 'Designer', 'Data Scientist', 'Growth', 'GTM / Sales', 'Marketing', 'Operations']
const VALID_SENIORITY = ['intern_entry', 'mid', 'senior', 'lead', 'management', 'executive']
const VALID_LOCATIONS = ['India', 'United States', 'Europe', 'United Kingdom', 'Southeast Asia', 'Remote']
const VALID_INDUSTRIES = ['AI / ML', 'Fintech', 'SaaS', 'Consumer', 'HealthTech', 'Crypto / Web3', 'Developer Tools', 'Climate Tech', 'E-Commerce']
const VALID_STAGES = ['Early Stage Startup', 'Growth Stage', 'Late Stage / Pre-IPO', 'Enterprise / Public', 'Any']

const SYSTEM_PROMPT = `You are a career analyst. Given a person's LinkedIn profile data and/or resume, extract their job search preferences.

You MUST return valid JSON with these fields:
{
  "name": "Full name",
  "target_roles": ["role1", "role2"],
  "seniority": "one of: intern_entry, mid, senior, lead, management, executive",
  "target_locations": ["location1", "location2"],
  "target_industries": ["industry1", "industry2"],
  "company_stages": ["stage1", "stage2"],
  "headline": "short professional headline"
}

RULES:
- target_roles MUST be from: ${VALID_ROLES.join(', ')}. Pick 1-3 that best match their experience. If they're a PM, pick "Product Manager". Map similar roles.
- seniority MUST be one of: ${VALID_SENIORITY.join(', ')}. Infer from years of experience and job titles:
  - 0-1 years or intern/entry titles → intern_entry
  - 2-4 years → mid
  - 5-9 years or "Senior" in title → senior
  - 10+ years or "Lead/Staff/Principal" → lead
  - "Manager/Director/Head" → management
  - "VP/C-Level/Founder" → executive
- target_locations MUST be from: ${VALID_LOCATIONS.join(', ')}. Include their current location + "Remote" if they seem open to it.
- target_industries MUST be from: ${VALID_INDUSTRIES.join(', ')}. Infer from companies they've worked at.
- company_stages MUST be from: ${VALID_STAGES.join(', ')}. Infer from the sizes of companies in their history. If mixed, include multiple.
- headline: a short 5-10 word professional headline based on their most recent role.

Return ONLY the JSON. No markdown, no explanation.`

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  try {
    const { linkedinProfile, resumeText } = await request.json()

    if (!linkedinProfile && !resumeText) {
      return NextResponse.json({ error: 'Provide linkedinProfile or resumeText' }, { status: 400, headers: CORS_HEADERS })
    }

    // Build the user prompt with all available data
    const parts: string[] = []

    if (linkedinProfile) {
      parts.push('=== LINKEDIN PROFILE ===')
      if (linkedinProfile.name) parts.push(`Name: ${linkedinProfile.name}`)
      if (linkedinProfile.headline) parts.push(`Headline: ${linkedinProfile.headline}`)
      if (linkedinProfile.company) parts.push(`Current Company: ${linkedinProfile.company}`)
      if (linkedinProfile.role) parts.push(`Current Role: ${linkedinProfile.role}`)
      if (linkedinProfile.location) parts.push(`Location: ${linkedinProfile.location}`)
      if (linkedinProfile.about) parts.push(`About: ${linkedinProfile.about}`)

      if (linkedinProfile.experience?.length > 0) {
        parts.push('Experience:')
        for (const exp of linkedinProfile.experience.slice(0, 8)) {
          const line = [exp.role, exp.company, exp.duration].filter(Boolean).join(' | ')
          if (line) parts.push(`  - ${line}`)
        }
      }

      if (linkedinProfile.education?.length > 0) {
        parts.push('Education:')
        for (const edu of linkedinProfile.education.slice(0, 3)) {
          const line = [edu.degree, edu.school, edu.years].filter(Boolean).join(' | ')
          if (line) parts.push(`  - ${line}`)
        }
      }
    }

    if (resumeText) {
      parts.push('=== RESUME ===')
      parts.push(resumeText.slice(0, 4000))
    }

    const userPrompt = `Analyze this profile and extract job search preferences:\n\n${parts.join('\n')}`

    console.log('[extract-preferences] Calling Gemini...')
    const text = await generateText(SYSTEM_PROMPT, userPrompt, { temperature: 0.3, maxTokens: 500 })

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[extract-preferences] Gemini returned non-JSON:', text.slice(0, 200))
      return NextResponse.json({ error: 'Failed to parse preferences' }, { status: 500, headers: CORS_HEADERS })
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate and filter to only valid options
    const result = {
      name: parsed.name || linkedinProfile?.name || null,
      headline: parsed.headline || linkedinProfile?.headline || null,
      target_roles: (parsed.target_roles || []).filter((r: string) => VALID_ROLES.includes(r)),
      seniority: VALID_SENIORITY.includes(parsed.seniority) ? parsed.seniority : 'mid',
      target_locations: (parsed.target_locations || []).filter((l: string) => VALID_LOCATIONS.includes(l)),
      target_industries: (parsed.target_industries || []).filter((i: string) => VALID_INDUSTRIES.includes(i)),
      company_stages: (parsed.company_stages || []).filter((s: string) => VALID_STAGES.includes(s)),
    }

    // Ensure at least 1 item in required arrays
    if (result.target_roles.length === 0) result.target_roles = ['Product Manager']
    if (result.target_locations.length === 0) result.target_locations = ['Remote']
    if (result.target_industries.length === 0) result.target_industries = ['SaaS']

    console.log('[extract-preferences] Extracted:', JSON.stringify(result))

    return NextResponse.json({ preferences: result }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[extract-preferences] Error:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to extract preferences' }, { status: 500, headers: CORS_HEADERS })
  }
}
