/**
 * POST /api/people/find-email
 *
 * Finds a work email given domain + first/last name.
 * Used by the "Get Email" button in PersonCard when email wasn't auto-revealed.
 * Calls Hunter.io email-finder (free tier: 25/month).
 *
 * Body: { domain: string, firstName: string, lastName: string, personId?: string }
 * Returns: { email, score, warning? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { findEmailForPerson } from '@/services/hunter'
import { routeLogger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const log = routeLogger('POST /api/people/find-email')
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      log.warn('Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { domain, firstName, lastName, personId } = await request.json() as {
      domain: string
      firstName: string
      lastName: string
      personId?: string
    }

    log.req({ domain, firstName, lastName, personId })

    if (!domain || !firstName || !lastName) {
      return NextResponse.json({ error: 'domain, firstName and lastName are required' }, { status: 400 })
    }

    // If personId provided, check for cached email first
    if (personId) {
      const { data: person } = await supabase
        .from('people')
        .select('email')
        .eq('id', personId)
        .single()

      if (person?.email) {
        log.res(200, { source: 'db-cache', email: person.email })
        return NextResponse.json({ email: person.email, score: 100, cached: true })
      }
    }

    log.step('hunter:emailFinder', { domain, firstName, lastName })
    const result = await findEmailForPerson(domain, firstName, lastName)
    log.step('hunter:response', { email: result?.email ?? null, score: result?.score ?? 0 })

    if (!result?.email) {
      log.warn('Email not found', { domain, firstName, lastName })
      return NextResponse.json({ email: null, score: 0, message: 'Email not found by Hunter.io' })
    }

    // Cache in DB if personId was provided
    if (personId) {
      await supabase.from('people').update({ email: result.email }).eq('id', personId)
    }

    log.res(200, { email: result.email, score: result.score })
    return NextResponse.json({
      email: result.email,
      score: result.score,
      cached: false,
      warning: result.score < 80 ? 'Email confidence is moderate — verify before sending' : undefined,
    })

  } catch (err) {
    const log2 = routeLogger('POST /api/people/find-email')
    log2.err('unhandled exception', err)
    return NextResponse.json({ error: 'Email lookup failed' }, { status: 500 })
  }
}
