import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { routeLogger } from '@/lib/logger'

const log = routeLogger('intake-model')

// GET — fetch current user's candidate model
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  log.req({ userId: user.id })

  const { data: model, error } = await supabase
    .from('candidate_models')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error || !model) {
    log.step('no-model', { userId: user.id })
    return NextResponse.json({ model: null })
  }

  log.res(200, { intakePhase: model.intake_phase, completeness: model.completeness_score })
  return NextResponse.json({ model })
}
