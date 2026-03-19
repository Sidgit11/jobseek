'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import type { PipelineEntry, PipelineStatus } from '@/types'

const COLUMNS: { status: PipelineStatus; label: string; color: string; dim: string }[] = [
  { status: 'saved', label: 'Saved', color: 'var(--color-text-tertiary)', dim: 'rgba(107,114,128,0.1)' },
  { status: 'messaged', label: 'Messaged', color: 'var(--color-lime)', dim: 'rgba(108,99,255,0.1)' },
  { status: 'replied', label: 'Replied', color: 'var(--color-warning)', dim: 'rgba(245,158,11,0.1)' },
  { status: 'interviewing', label: 'Interviewing', color: 'var(--color-success)', dim: 'rgba(34,197,94,0.1)' },
]

function PipelineCard({ entry, dragging = false }: { entry: PipelineEntry; dragging?: boolean }) {
  const company = entry.company
  const domain = company?.domain ?? ''
  const logoUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null

  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{
        background: dragging ? '#E8E8E3' : 'var(--color-surface)',
        border: '1px solid #E8E8E3',
        opacity: dragging ? 0.9 : 1,
        cursor: 'grab',
      }}
    >
      <div className="flex items-start gap-3">
        {logoUrl && (
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
            style={{ background: 'var(--color-surface)', border: '1px solid #E8E8E3' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={company?.name ?? ''}
              className="h-5 w-5 object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {company?.name ?? 'Unknown Company'}
          </p>
          {company?.funding_stage && (
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{company.funding_stage}</p>
          )}
        </div>
        {company?.website_url && (
          <a
            href={company.website_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex-shrink-0"
          >
            <ExternalLink size={12} style={{ color: 'var(--color-text-tertiary)' }} />
          </a>
        )}
      </div>

      {entry.person && (
        <p className="mt-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          → {entry.person.name}
          {entry.person.title && `, ${entry.person.title}`}
        </p>
      )}

      <p className="mt-2 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
        {formatDistanceToNow(new Date(entry.updated_at), { addSuffix: true })}
      </p>
    </div>
  )
}

function DraggableCard({ entry }: { entry: PipelineEntry }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.id,
    data: { entry },
  })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.3 : 1 }}>
      <div className="flex items-center gap-1 mb-1">
        <GripVertical size={12} style={{ color: '#374151' }} className="flex-shrink-0" />
        <div className="flex-1">
          <PipelineCard entry={entry} />
        </div>
      </div>
    </div>
  )
}

function DroppableColumn({
  column,
  entries,
  isOver,
}: {
  column: typeof COLUMNS[0]
  entries: PipelineEntry[]
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: column.status })

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col rounded-2xl"
      style={{
        background: isOver ? column.dim : 'var(--color-surface)',
        border: `1px solid ${isOver ? column.color + '44' : '#E8E8E3'}`,
        minWidth: 260,
        flex: '1 1 0',
        minHeight: 200,
        transition: 'all 0.15s',
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #E8E8E3' }}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: column.color }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{column.label}</span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ background: `${column.color}22`, color: column.color }}
        >
          {entries.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 p-3">
        {entries.length === 0 ? (
          <div
            className="flex h-20 items-center justify-center rounded-xl text-xs"
            style={{ color: '#374151', border: `2px dashed ${column.color}22` }}
          >
            Drop here
          </div>
        ) : (
          entries.map(entry => (
            <DraggableCard key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  )
}

export default function PipelinePage() {
  const [entries, setEntries] = useState<PipelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeEntry, setActiveEntry] = useState<PipelineEntry | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => {
    fetch('/api/pipeline')
      .then(r => r.json())
      .then(data => {
        setEntries(data.entries ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function getColumnEntries(status: PipelineStatus) {
    return entries.filter(e => e.status === status)
  }

  function handleDragStart(event: DragStartEvent) {
    const entry = entries.find(e => e.id === event.active.id)
    setActiveEntry(entry ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveEntry(null)
    setOverColumn(null)

    if (!over) return

    const entryId = active.id as string
    const newStatus = over.id as PipelineStatus

    const entry = entries.find(e => e.id === entryId)
    if (!entry || entry.status === newStatus) return

    // Optimistic update
    setEntries(prev =>
      prev.map(e => e.id === entryId ? { ...e, status: newStatus, updated_at: new Date().toISOString() } : e)
    )

    const res = await fetch('/api/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId, status: newStatus }),
    })

    if (!res.ok) {
      // Revert
      setEntries(prev =>
        prev.map(e => e.id === entryId ? { ...e, status: entry.status } : e)
      )
      toast.error('Failed to update status')
    } else {
      toast.success(`Moved to ${newStatus}`)
    }
  }

  function handleDragOver(event: DragOverEvent) {
    setOverColumn(event.over?.id?.toString() ?? null)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading pipeline…</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="px-6 py-5" style={{ borderBottom: '1px solid #E8E8E3' }}>
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Pipeline</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          Track your outbound job search — drag to update status.
        </p>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Your pipeline is empty</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Save companies from <a href="/discover" className="underline" style={{ color: 'var(--color-lime-text)' }}>Discover</a> to start tracking.
              </p>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
          >
            <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
              {COLUMNS.map(col => (
                <DroppableColumn
                  key={col.status}
                  column={col}
                  entries={getColumnEntries(col.status)}
                  isOver={overColumn === col.status}
                />
              ))}
            </div>

            <DragOverlay>
              {activeEntry && <PipelineCard entry={activeEntry} dragging />}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  )
}
