import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scoreAndFilter } from '@/career-intelligence/scoring'
import { routeLogger } from '@/lib/logger'
import type { EngagementPostInput } from '@/career-intelligence/types'

const log = routeLogger('engagement-score')

// POST — Chrome extension submits posts for scoring
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Auth via device token (same pattern as signals/classify)
  const authHeader = request.headers.get('Authorization')
  const deviceToken = authHeader?.replace('Bearer ', '')
  if (!deviceToken) {
    log.warn('no-auth-token')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('device_token', deviceToken)
    .single()

  if (!profile) {
    log.warn('invalid-device-token')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { posts } = await request.json() as { posts: EngagementPostInput[] }
  log.req({ userId: profile.id, postsCount: posts?.length ?? 0 })

  if (!posts || posts.length === 0) {
    log.res(200, { saved: 0 })
    return NextResponse.json({ saved: 0 })
  }

  const scored = scoreAndFilter(posts, profile.id)
  log.step('scoring-complete', { input: posts.length, aboveThreshold: scored.length })

  if (scored.length > 0) {
    const { error } = await supabase
      .from('engagement_opportunities')
      .upsert(scored, { onConflict: 'user_id,post_id', ignoreDuplicates: true })

    if (error) {
      log.err('upsert-failed', error)
    } else {
      log.step('db-upserted', { count: scored.length })
    }
  }

  log.res(200, { saved: scored.length })
  return NextResponse.json({ saved: scored.length })
}
