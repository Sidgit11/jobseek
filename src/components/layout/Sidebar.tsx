'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Kanban, User, LogOut, Radio, LayoutDashboard, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/discover', icon: Search, label: 'Discover' },
  { href: '/signals', icon: Radio, label: 'Signals' },
  { href: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { href: '/profile', icon: User, label: 'Profile' },
]

interface SidebarProps {
  profile: Profile | null
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div
      className="fixed top-0 left-0 z-40 flex h-full w-[220px] flex-col py-6"
      style={{ background: '#EDEDEA', borderRight: '1px solid #D4D4CC' }}
    >
      {/* Logo */}
      <div className="mb-8 px-5">
        <div className="flex items-center gap-2.5 mb-1">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-[10px]"
            style={{
              background: 'linear-gradient(135deg, #A3E635 0%, #84CC16 100%)',
            }}
          >
            <Zap size={16} color="#1A2E05" />
          </div>
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ color: '#1A1A1A' }}
          >
            Jobseek
          </h1>
        </div>
        <p className="ml-[42px] text-[10px] font-medium" style={{ color: '#65A30D' }}>
          Career Outbound
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all cursor-pointer"
              style={{
                background: active ? 'rgba(163,230,53,0.18)' : 'transparent',
                color: active ? '#3F6212' : '#6B7280',
                borderLeft: active ? '2px solid #84CC16' : '2px solid transparent',
              }}
            >
              <Icon size={16} style={{ opacity: active ? 1 : 0.6 }} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div
        className="mx-3 mt-4 rounded-lg px-3 py-3"
        style={{ background: '#E2E2DD', border: '1px solid #D4D4CC' }}
      >
        <div className="flex items-center gap-2.5">
          {/* Avatar circle */}
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{
              background: '#A3E635',
              color: '#1A2E05',
            }}
          >
            {(profile?.name ?? profile?.email ?? 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-semibold" style={{ color: '#1A1A1A' }}>
              {profile?.name ?? 'My Account'}
            </p>
            {profile?.email && (
              <p className="truncate text-[10px]" style={{ color: '#6B7280' }}>
                {profile.email}
              </p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="cursor-pointer rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{ color: '#6B7280' }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
