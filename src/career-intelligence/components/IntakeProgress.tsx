'use client'

import { motion, AnimatePresence } from 'framer-motion'

const PHASES = [
  { label: 'You + your target', desc: 'Role, strengths, what you want next' },
  { label: 'Your best work', desc: 'One killer impact story with numbers' },
  { label: 'Edge + constraints', desc: 'What makes you different + hard nos' },
]

interface IntakeProgressProps {
  phase: number
  facts: string[]
}

export function IntakeProgress({ phase, facts }: IntakeProgressProps) {
  return (
    <div
      className="hidden lg:flex w-[320px] flex-shrink-0 flex-col justify-between p-10"
      style={{ background: '#111117', borderRight: '1px solid #1E1E2A' }}
    >
      <div>
        <h1 className="text-xl font-extrabold" style={{ color: '#FAFAF8' }}>Jobseek.ai</h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest" style={{ color: '#A3E635' }}>
          Career Intelligence
        </p>

        <p className="mt-6 text-sm leading-relaxed" style={{ color: '#6B7280' }}>
          3 quick questions. ~3 minutes. This powers your outreach, resume, and public profile.
        </p>

        {/* Phase progress */}
        <div className="mt-10 space-y-4">
          {PHASES.map((p, i) => {
            const num = i + 1
            const done = num < phase
            const active = num === phase
            return (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all"
                  style={{
                    background: done ? '#A3E635' : active ? 'rgba(163,230,53,0.15)' : 'transparent',
                    border: active ? '1px solid #A3E635' : done ? 'none' : '1px solid #2A2A35',
                    color: done ? '#1A2E05' : active ? '#A3E635' : '#4B5563',
                  }}
                >
                  {done ? '✓' : num}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: active ? '#F0F0EE' : done ? '#6B7280' : '#374151' }}>
                    {p.label}
                  </p>
                  <p className="text-xs" style={{ color: '#374151' }}>{p.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Live extracted facts */}
      {facts.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#1A1A23', border: '1px solid #252530' }}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#A3E635' }}>
            ✦ I noted
          </p>
          <div className="space-y-1">
            <AnimatePresence>
              {facts.slice(-6).map((fact, i) => (
                <motion.p
                  key={`${fact}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs leading-relaxed"
                  style={{ color: '#9CA3AF' }}
                >
                  · {fact}
                </motion.p>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}

export { PHASES }
