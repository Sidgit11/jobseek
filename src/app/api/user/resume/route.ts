import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCandidateSummary } from '@/lib/anthropic/company-summary'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('resume') as File | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Parse PDF
    let resumeText = ''
    try {
      const pdfParseModule = await import('pdf-parse')
      const pdfParse = (pdfParseModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default ?? pdfParseModule
      const parsed = await pdfParse(buffer)
      resumeText = parsed.text
    } catch (parseErr) {
      console.error('PDF parse error:', parseErr)
      return NextResponse.json({ error: 'Could not parse PDF. Please ensure it\'s a valid PDF file.' }, { status: 400 })
    }

    if (!resumeText.trim()) {
      return NextResponse.json({ error: 'PDF appears to be empty or image-based. Please use a text-based PDF.' }, { status: 400 })
    }

    // Get user's target roles/industries
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_roles, target_industries')
      .eq('id', user.id)
      .single()

    // Generate candidate summary with Claude
    const candidateSummary = await generateCandidateSummary(
      resumeText,
      profile?.target_roles ?? [],
      profile?.target_industries ?? []
    )

    // Save to DB
    await supabase
      .from('profiles')
      .update({
        resume_text: resumeText.slice(0, 50000), // Cap at 50k chars
        candidate_summary: candidateSummary,
      })
      .eq('id', user.id)

    return NextResponse.json({ summary: candidateSummary })
  } catch (err) {
    console.error('Resume upload error:', err)
    return NextResponse.json({ error: 'Failed to process resume' }, { status: 500 })
  }
}
