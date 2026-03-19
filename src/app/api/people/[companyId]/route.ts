import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPeopleForCompany } from '@/lib/apollo/people'
import { routeLogger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const log = routeLogger('GET /api/people/[companyId]')
  try {
    const { companyId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      log.warn('Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    log.req({ companyId, userId: user.id })

    // Check cache (48h)
    const { data: cached } = await supabase
      .from('people')
      .select('*')
      .eq('company_id', companyId)
      .gt('cached_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('outreach_priority_score', { ascending: false })
      .limit(8)

    if (cached && cached.length > 0) {
      log.res(200, { source: 'db-cache', count: cached.length })
      return NextResponse.json({ people: cached })
    }

    // Fetch company for domain
    const { data: company } = await supabase
      .from('companies')
      .select('domain, name')
      .eq('id', companyId)
      .single()

    // Fallback: extract domain from fake demo IDs like "demo-ashbyhq-com"
    const domain = company?.domain ?? (() => {
      if (companyId.startsWith('demo-')) {
        // "demo-ashbyhq-com" → "ashbyhq.com", "demo-eleven-labs-com" → "eleven-labs.com"
        const raw = companyId.replace(/^demo-/, '')
        // Last segment after final '-' may be TLD — reconstruct domain
        const parts = raw.split('-')
        if (parts.length >= 2) {
          const tld = parts[parts.length - 1]   // e.g. "com", "ai", "io"
          const name = parts.slice(0, -1).join('-') // e.g. "ashbyhq"
          return `${name}.${tld}`
        }
      }
      return null
    })()

    if (!domain) {
      log.warn('Company not found or missing domain', { companyId })
      return NextResponse.json({ people: [] })
    }

    const companyName = company?.name ?? companyId

    log.step('db:company', { name: companyName, domain })

    // Get user's target roles for scoring
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_roles')
      .eq('id', user.id)
      .single()

    const targetRoles = profile?.target_roles ?? []

    // Fetch via Hunter.io domain search
    log.step('hunter:domainSearch', { domain })
    const people = await getPeopleForCompany(domain, companyId, targetRoles)
    log.step('hunter:response', { count: people.length, names: people.slice(0, 3).map(p => p.name) })

    if (people.length === 0) {
      log.warn('No people found for domain', { domain })
      return NextResponse.json({ people: [] })
    }

    // Cache in DB
    await supabase.from('people').delete().eq('company_id', companyId)
    const { data: inserted, error: insertErr } = await supabase
      .from('people')
      .insert(people.map(p => ({ ...p, cached_at: new Date().toISOString() })))
      .select()

    if (insertErr) log.warn('DB insert failed — returning in-memory results', insertErr.message)

    log.res(200, { source: 'hunter-live', count: (inserted ?? people).length })
    return NextResponse.json({ people: inserted ?? people })
  } catch (err) {
    const log2 = routeLogger('GET /api/people/[companyId]')
    log2.err('unhandled exception', err)
    return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 })
  }
}
