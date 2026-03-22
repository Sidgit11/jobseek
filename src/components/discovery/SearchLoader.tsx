'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, Loader2 } from 'lucide-react'

interface SearchLoaderProps {
  active: boolean
  onComplete?: () => void
}

const STEPS = [
  'Understanding your query',
  'Extracting search intent',
  'Searching company databases',
  'Enriching with funding data',
  'Checking job boards for open roles',
  'Scoring & ranking results',
  'Generating targeting briefs',
]

/** Random delay between 3-5 seconds per step */
function randomStepDelay(): number {
  return 3000 + Math.random() * 2000
}

export function SearchLoader({ active, onComplete }: SearchLoaderProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [completed, setCompleted] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active) {
      // Results arrived — complete all steps instantly
      if (currentStep > 0) {
        setCurrentStep(STEPS.length)
        setCompleted(true)
        setTimeout(() => onComplete?.(), 400)
      }
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    // Start stepping
    setCurrentStep(0)
    setCompleted(false)

    // Advance step 0 immediately, then schedule next steps with random delays
    let step = 0
    let cancelled = false

    function scheduleNext() {
      if (cancelled) return
      timerRef.current = setTimeout(() => {
        step++
        if (step >= STEPS.length || cancelled) return
        setCurrentStep(step)
        scheduleNext()
      }, randomStepDelay())
    }
    scheduleNext()

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!active && !completed && currentStep === 0) return null

  return (
    <div
      className="rounded-2xl p-6 transition-all"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid #E8E8E3',
        opacity: completed ? 0 : 1,
        transform: completed ? 'translateY(-8px)' : 'translateY(0)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-lime)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Searching for companies...
        </span>
      </div>

      <div className="space-y-2">
        {STEPS.map((step, i) => {
          const isDone = i < currentStep || (completed && i <= currentStep)
          const isCurrent = i === currentStep && !completed && active
          const isFuture = i > currentStep && !completed

          return (
            <div
              key={i}
              className="flex items-center gap-2.5 transition-all"
              style={{
                opacity: isFuture ? 0.35 : 1,
                transform: isCurrent ? 'translateX(2px)' : 'translateX(0)',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Icon */}
              <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {isDone ? (
                  <Check size={13} style={{ color: 'var(--color-success)' }} />
                ) : isCurrent ? (
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: 'var(--color-lime)' }}
                  />
                ) : (
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#D4D4CC' }}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className="text-xs"
                style={{
                  color: isDone
                    ? 'var(--color-success)'
                    : isCurrent
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-tertiary)',
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {step}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
