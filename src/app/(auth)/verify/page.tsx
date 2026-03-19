export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
      <div className="text-center">
        <div className="mb-4 text-4xl">✅</div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Signing you in…
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          One moment while we verify your link.
        </p>
      </div>
    </div>
  )
}
