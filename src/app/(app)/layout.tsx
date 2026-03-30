import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import type { Profile } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  // TODO: Re-enable auth gate before merging to main
  // if (!user) redirect('/login')
  // if (!profile?.onboarding_completed) redirect('/onboarding')

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <Sidebar profile={profile as Profile | null} />
      <main className="flex-1 overflow-y-auto pl-[220px]">
        {children}
      </main>
    </div>
  )
}
