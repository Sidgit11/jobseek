import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import type { Profile } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Proxy (src/proxy.ts) enforces auth + onboarding + intake progression.
  // Layout just fetches the profile for rendering. Defensive redirect if
  // the proxy is bypassed for any reason (e.g. local dev without matcher).
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <Sidebar profile={profile as Profile | null} />
      <main className="flex-1 overflow-y-auto pl-[220px]">
        {children}
      </main>
    </div>
  )
}
