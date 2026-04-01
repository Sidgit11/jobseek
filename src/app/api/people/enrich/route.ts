/**
 * POST /api/people/enrich
 *
 * Finds a work email for a person when it wasn't returned by domain search.
 * Uses Hunter.io email-finder (free tier: 25/month quota).
 * Gated behind explicit "Get Email" user action — never auto-fired.
 *
 * Body: { personId: string }
 * Returns: { email, score, cached }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { findEmailForPerson } from '@/lib/hunter'
import { routeLogger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const log = routeLogger('POST /api/people/enrich')
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      log.warn('Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { personId } = await request.json() as { personId: string }
    log.req({ personId, userId: user.id })

    if (!personId) {
      return NextResponse.json({ error: 'personId is required' }, { status: 400 })
    }

    // Fetch person + company domain from DB
    const { data: person } = await supabase
      .from('people')
      .select('id, name, email, company_id, companies(domain)')
      .eq('id', personId)
      .single()

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    // Already have a cached email — return for free
    if (person.email) {
      return NextResponse.json({ email: person.email, score: 100, cached: true })
    }

    const companyDomain = (person.companies as unknown as { domain: string | null } | null)?.domain
    if (!companyDomain) {
      return NextResponse.json({ email: null, score: 0, message: 'No company domain available' })
    }

    // Split name for Hunter lookup
    const parts = (person.name as string).trim().split(' ')
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ')

    if (!firstName || !lastName) {
      return NextResponse.json({ email: null, score: 0, message: 'Need full name for email lookup' })
    }

    log.step('hunter:emailFinder', { domain: companyDomain, firstName, lastName })
    const result = await findEmailForPerson(companyDomain, firstName, lastName)
    log.step('hunter:response', { email: result?.email ?? null, score: result?.score ?? 0 })

    if (!result?.email) {
      log.warn('Email not found', { domain: companyDomain, firstName, lastName })
      return NextResponse.json({ email: null, score: 0, message: 'Email not found' })
    }

    // Cache in DB so future requests are free
    await supabase.from('people').update({ email: result.email }).eq('id', personId)

    log.res(200, { email: result.email, score: result.score })
    return NextResponse.json({
      email: result.email,
      score: result.score,
      cached: false,
      warning: result.score < 80 ? 'Email confidence is moderate — verify before sending' : undefined,
    })

  } catch (err) {
    const log2 = routeLogger('POST /api/people/enrich')
    log2.err('unhandled exception', err)
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }
}
