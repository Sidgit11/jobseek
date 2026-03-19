export function CompanyCardSkeleton() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--color-surface)', border: '1px solid #1E1E2E' }}
    >
      <div className="flex items-start gap-3">
        <div className="skeleton h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="skeleton h-4 w-32 mb-2 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="mt-3 skeleton h-2 w-full rounded" />
      <div className="mt-4 flex gap-2">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
    </div>
  )
}

export function PanelSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="skeleton h-5 w-40 rounded mb-2" />
        <div className="skeleton h-3 w-full rounded mb-1" />
        <div className="skeleton h-3 w-3/4 rounded" />
      </div>
      <div>
        <div className="skeleton h-4 w-24 rounded mb-3" />
        <div className="skeleton h-3 w-full rounded mb-1" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-6 w-20 rounded-full" />
        <div className="skeleton h-6 w-24 rounded-full" />
      </div>
      <div>
        <div className="skeleton h-4 w-24 rounded mb-3" />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-12 w-full rounded-xl mb-2" />
        ))}
      </div>
    </div>
  )
}
