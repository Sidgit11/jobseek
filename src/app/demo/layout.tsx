'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Kanban, Sparkles } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/demo/discover', icon: Search, label: 'Discover' },
  { href: '/demo/pipeline', icon: Kanban, label: 'Pipeline' },
]

function DemoSidebar() {
  const pathname = usePathname()

  return (
    <div
      className="fixed top-0 left-0 z-40 flex h-full w-[220px] flex-col py-6"
      style={{ background: 'var(--color-surface)', borderRight: '1px solid #E8E8E3' }}
    >
      {/* Logo */}
      <div className="mb-8 px-5">
        <h1
          className="text-xl font-extrabold tracking-tight"
          style={{
            color: '#0F0F0F',
          }}
        >
          Jobseek.ai
        </h1>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
          Career Outbound
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: active ? 'var(--color-lime-subtle)' : 'transparent',
                color: active ? 'var(--color-lime-text)' : 'var(--color-text-tertiary)',
                border: active ? '1px solid var(--color-lime-subtle)' : '1px solid transparent',
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Demo CTA */}
      <div className="mx-3 mt-4 space-y-2">
        <div
          className="rounded-xl p-3"
          style={{ background: 'var(--color-lime-subtle)', border: '1px solid var(--color-lime-border)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-lime-text)' }}>
            ✦ Demo Mode
          </p>
          <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            Explore with real companies and pre-written outreach.
          </p>
          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: 'var(--color-lime)', color: '#1A2E05' }}
          >
            <Sparkles size={11} />
            Get started free
          </Link>
        </div>

        {/* Demo persona */}
        <div
          className="rounded-xl p-3"
          style={{ background: 'var(--color-surface)', border: '1px solid #E8E8E3' }}
        >
          <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>Jordan Park</p>
          <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>PM · AI/SaaS · San Francisco</p>
        </div>
      </div>
    </div>
  )
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <DemoSidebar />
      <main style={{ flex: 1, marginLeft: '220px' }}>
        {children}
      </main>
    </div>
  )
}
