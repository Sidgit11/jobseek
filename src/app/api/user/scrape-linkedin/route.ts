import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { routeLogger } from '@/lib/logger'
import { getCorsHeaders } from '@/lib/cors'

const log = routeLogger('user/scrape-linkedin')

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: getCorsHeaders(request.headers.get('origin')) })
}

// POST — receive scraped LinkedIn profile data and store on the user's profile
// Two modes:
//   1. Extension sends { linkedinUrl, scrapedProfile, deviceToken } — pre-scraped data from the browser
//   2. Web app sends { linkedinUrl } with auth — we store the URL (actual scraping done by extension)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { linkedinUrl, scrapedProfile, deviceToken } = body

    if (!linkedinUrl || typeof linkedinUrl !== 'string') {
      return NextResponse.json({ error: 'linkedinUrl is required' }, { status: 400, headers: getCorsHeaders(request.headers.get('origin')) })
    }

    // Determine which user to update
    let userId: string | null = null

    if (deviceToken) {
      // Extension path — find user by device token
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('device_token', deviceToken)
        .single()
      userId = profile?.id ?? null
    }

    if (!userId) {
      // Auth path — use logged-in user
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(request.headers.get('origin')) })
    }

    // Build the update payload
    const update: Record<string, unknown> = {
      linkedin_url: linkedinUrl,
      linkedin_scraped_at: new Date().toISOString(),
    }

    if (scrapedProfile && typeof scrapedProfile === 'object') {
      // Extension sent pre-scraped data — use it directly
      if (scrapedProfile.name) update.name = scrapedProfile.name
      if (scrapedProfile.headline) update.linkedin_headline = scrapedProfile.headline
      if (scrapedProfile.location) update.location = scrapedProfile.location

      // Use full experience list if provided, otherwise build from current role
      if (scrapedProfile.experience && Array.isArray(scrapedProfile.experience) && scrapedProfile.experience.length > 0) {
        update.linkedin_experience = scrapedProfile.experience.map((e: { company?: string; role?: string; duration?: string }) => ({
          company: e.company || '',
          title: e.role || '',
          duration: e.duration || '',
        }))
      } else if (scrapedProfile.company || scrapedProfile.role) {
        update.linkedin_experience = [{
          company: scrapedProfile.company || '',
          title: scrapedProfile.role || '',
          duration: 'Current',
        }]
      }

      // Build a candidate summary from the scraped data
      const parts: string[] = []
      if (scrapedProfile.name) parts.push(scrapedProfile.name)
      if (scrapedProfile.headline) parts.push(scrapedProfile.headline)
      if (scrapedProfile.about) parts.push(scrapedProfile.about)
      if (scrapedProfile.company && scrapedProfile.role) {
        parts.push(`Currently ${scrapedProfile.role} at ${scrapedProfile.company}`)
      }
      if (scrapedProfile.location) parts.push(`Based in ${scrapedProfile.location}`)

      // Only update candidate_summary if user doesn't already have one
      if (parts.length > 0) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('candidate_summary')
          .eq('id', userId)
          .single()
        if (!existing?.candidate_summary) {
          update.candidate_summary = parts.join(' · ')
        }
      }

      log.step('extension-data', { name: scrapedProfile.name, headline: scrapedProfile.headline, company: scrapedProfile.company, role: scrapedProfile.role })
    } else {
      log.step('url-only', { linkedinUrl })
    }

    const { error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', userId)

    if (error) {
      log.err('db-update', new Error(error.message))
      return NextResponse.json({ error: error.message }, { status: 500, headers: getCorsHeaders(request.headers.get('origin')) })
    }

    log.res(200, { scraped: !!scrapedProfile, stored: true })
    return NextResponse.json({
      scraped: !!scrapedProfile,
      stored: true,
    }, { headers: getCorsHeaders(request.headers.get('origin')) })
  } catch (err) {
    log.err('scrape', err)
    return NextResponse.json({ error: 'Failed to process profile' }, { status: 500, headers: getCorsHeaders(request.headers.get('origin')) })
  }
}
