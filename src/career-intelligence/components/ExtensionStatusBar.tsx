'use client'

import { useState, useEffect, useCallback } from 'react'
import { Chrome, Loader2, Play, Pause, RefreshCw } from 'lucide-react'
import { EXTENSION_STORE_URL, detectExtension, sendExtensionCommand } from '@/lib/extension/detect'
import type { ExtensionDetectResult } from '@/lib/extension/detect'

export function ExtensionStatusBar() {
  const [ext, setExt] = useState<ExtensionDetectResult>({ found: false })
  const [checking, setChecking] = useState(true)
  const [acting, setActing] = useState(false)

  const check = useCallback(async () => {
    const result = await detectExtension()
    setExt(result)
    setChecking(false)
  }, [])

  useEffect(() => {
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [check])

  async function handlePauseResume() {
    setActing(true)
    const action = ext.scanningPaused ? 'RESUME_SCAN' : 'PAUSE_SCAN'
    const ok = await sendExtensionCommand(action)
    if (ok) setExt(prev => ({ ...prev, scanningPaused: !prev.scanningPaused }))
    setActing(false)
  }

  async function handleScanNow() {
    setActing(true)
    await sendExtensionCommand('TRIGGER_SCAN_NOW')
    setActing(false)
  }

  function formatLastScan(iso: string | null | undefined): string {
    if (!iso) return 'never'
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h ago`
  }

  if (checking) return null

  if (!ext.found) {
    return (
      <div
        className="flex items-center justify-between rounded-xl px-4 py-2.5 mb-4"
        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full" style={{ background: '#EF4444' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>Extension not detected</span>
          <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>Install it to capture engagement opportunities</span>
        </div>
        <a
          href={EXTENSION_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all hover:brightness-110"
          style={{ background: 'var(--color-lime)', color: '#1A2E05' }}
        >
          <Chrome size={12} /> Install Extension
        </a>
      </div>
    )
  }

  if (ext.scanningPaused) {
    return (
      <div
        className="flex items-center justify-between rounded-xl px-4 py-2.5 mb-4"
        style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full" style={{ background: '#F59E0B' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>Extension paused</span>
          <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>v{ext.version} · Last scan: {formatLastScan(ext.lastScanTime)}</span>
        </div>
        <button
          onClick={handlePauseResume}
          disabled={acting}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all hover:brightness-110 cursor-pointer"
          style={{ background: 'var(--color-lime-subtle)', color: 'var(--color-lime-text)', border: '1px solid var(--color-lime-border)' }}
        >
          {acting ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Resume
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-2.5 mb-4"
      style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}
    >
      <div className="flex items-center gap-2.5">
        <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>Extension connected</span>
        <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>v{ext.version} · Last scan: {formatLastScan(ext.lastScanTime)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleScanNow}
          disabled={acting}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all hover:brightness-110 cursor-pointer"
          style={{ background: 'var(--color-lime-subtle)', color: 'var(--color-lime-text)', border: '1px solid var(--color-lime-border)' }}
        >
          {acting ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Scan Now
        </button>
        <button
          onClick={handlePauseResume}
          disabled={acting}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all hover:brightness-110 cursor-pointer"
          style={{ background: 'var(--color-surface)', color: 'var(--color-text-tertiary)', border: '1px solid var(--border-color-subtle)' }}
        >
          <Pause size={11} /> Pause
        </button>
      </div>
    </div>
  )
}
