import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('pipeline_entries')
      .select(`
        *,
        company:companies(*),
        person:people(id, name, title)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ entries: data })
  } catch (err) {
    console.error('Pipeline GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch pipeline' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { companyId, status = 'saved', personId } = await request.json()

    if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

    // Ensure profile row exists — created on first action so FK constraint never fires
    await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email ?? null,
      }, { onConflict: 'id', ignoreDuplicates: true })

    const { data, error } = await supabase
      .from('pipeline_entries')
      .upsert({
        user_id: user.id,
        company_id: companyId,
        status,
        person_id: personId ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,company_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ entry: data })
  } catch (err) {
    console.error('Pipeline POST error:', err)
    return NextResponse.json({ error: 'Failed to save pipeline entry' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { entryId, status } = await request.json()

    if (!entryId || !status) return NextResponse.json({ error: 'entryId and status required' }, { status: 400 })

    const { data, error } = await supabase
      .from('pipeline_entries')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', entryId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ entry: data })
  } catch (err) {
    console.error('Pipeline PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update pipeline entry' }, { status: 500 })
  }
}
