'use client'

import { useState } from 'react'
import { IntakeProgress } from '@/career-intelligence/components/IntakeProgress'
import { IntakeChat } from '@/career-intelligence/components/IntakeChat'

export default function IntakePage() {
  const [phase, setPhase] = useState(1)
  const [allFacts, setAllFacts] = useState<string[]>([])

  function handleFacts(newFacts: string[]) {
    setAllFacts(prev => [...prev, ...newFacts])
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <IntakeProgress phase={phase} facts={allFacts} />
      <IntakeChat phase={phase} onPhaseChange={setPhase} onFacts={handleFacts} />
    </div>
  )
}
