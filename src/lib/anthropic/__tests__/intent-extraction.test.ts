import { describe, test, expect, beforeAll } from 'vitest'

// We test the pure functions by importing them indirectly through
// the module. Since extractSearchIntent requires Gemini, we test
// the heuristic path and exported helper logic.

// ── Import internal functions via re-export or direct test ───────────────────
// The heuristic function isn't exported, so we test its behavior through
// extractSearchIntent which falls back to heuristic when Gemini env vars
// are missing (GOOGLE_AI_API_KEY not set in test env).

// For unit-testable functions, we'll test the geo expansion and role
// normalization logic by simulating the heuristic path.

// Since the module uses @/lib/google/client which requires API key,
// and we're testing pure logic, let's import and test the functions
// that ARE exported or test behavior via the heuristic fallback.

describe('intent extraction heuristic behavior', () => {
  // Mock the module to avoid Gemini calls
  let extractSearchIntent: typeof import('../intent-extraction').extractSearchIntent

  beforeAll(async () => {
    // Delete env var so Gemini fails and heuristic is used
    const original = process.env.GOOGLE_AI_API_KEY
    delete process.env.GOOGLE_AI_API_KEY
    const mod = await import('../intent-extraction')
    extractSearchIntent = mod.extractSearchIntent
    // Restore (may still be undefined in test)
    if (original) process.env.GOOGLE_AI_API_KEY = original
  })

  const baseContext = {
    name: 'Test User',
    candidateSummary: 'PM with 5 years experience',
    targetRoles: ['Product Manager'],
    targetIndustries: ['AI / ML', 'SaaS'],
    location: 'India',
  }

  test('direct company name query sets companyName and high confidence', async () => {
    const intent = await extractSearchIntent('Microsoft', baseContext)
    expect(intent.companyName).toBe('Microsoft')
    expect(intent.confidence).toBeGreaterThanOrEqual(0.9)
    expect(intent.keywords).toContain('Microsoft')
  })

  test('direct company name query preserves user roles', async () => {
    const intent = await extractSearchIntent('Stripe', baseContext)
    expect(intent.roles).toEqual(['Product Manager'])
  })

  test('discovery query has null companyName', async () => {
    const intent = await extractSearchIntent('Series B AI startups hiring PMs', baseContext)
    expect(intent.companyName).toBeNull()
  })

  test('discovery query detects funding stages', async () => {
    const intent = await extractSearchIntent('Series B startups in India', baseContext)
    expect(intent.fundingStages).toContain('series-b')
  })

  test('discovery query detects seed stage', async () => {
    const intent = await extractSearchIntent('seed funded AI companies', baseContext)
    expect(intent.fundingStages).toContain('seed')
  })

  test('discovery query detects YC as seed/series-a', async () => {
    const intent = await extractSearchIntent('YC companies building devtools', baseContext)
    expect(intent.fundingStages).toContain('seed')
    expect(intent.fundingStages).toContain('series-a')
  })

  test('hiring keyword sets hiring signal', async () => {
    const intent = await extractSearchIntent('startups hiring engineers', baseContext)
    expect(intent.signals).toContain('hiring')
  })

  test('growth keyword sets growth signal', async () => {
    const intent = await extractSearchIntent('fast growing AI companies', baseContext)
    expect(intent.signals).toContain('growth')
  })

  test('funding keyword sets recent-funding signal', async () => {
    const intent = await extractSearchIntent('recently funded startups', baseContext)
    expect(intent.signals).toContain('recent-funding')
  })

  test('detects AI / ML industry from query', async () => {
    const intent = await extractSearchIntent('AI startups Series A', {
      ...baseContext,
      targetIndustries: [],
    })
    expect(intent.industries).toContain('AI / ML')
  })

  test('detects fintech industry', async () => {
    const intent = await extractSearchIntent('fintech companies hiring', {
      ...baseContext,
      targetIndustries: [],
    })
    expect(intent.industries).toContain('Fintech')
  })

  test('sectors are derived from industries', async () => {
    const intent = await extractSearchIntent('AI startups hiring PMs', baseContext)
    expect(intent.sectors.length).toBeGreaterThan(0)
    expect(intent.sectors.some(s => s === 'ai' || s === 'ml')).toBe(true)
  })

  test('expandedGeo is populated for India', async () => {
    const intent = await extractSearchIntent('startups in India', baseContext)
    expect(intent.expandedGeo).toContain('bangalore')
    expect(intent.expandedGeo).toContain('mumbai')
  })

  test('implicit signals include recently_funded for series stage', async () => {
    const intent = await extractSearchIntent('Series B startups', baseContext)
    expect(intent.implicitSignals).toContain('recently_funded')
  })

  test('implicit signals include small_team for early stage', async () => {
    const intent = await extractSearchIntent('seed stage startups', baseContext)
    expect(intent.implicitSignals).toContain('small_team')
  })

  test('implicit signals include engineering_heavy for AI', async () => {
    const intent = await extractSearchIntent('AI companies hiring PMs', baseContext)
    expect(intent.implicitSignals).toContain('engineering_heavy')
  })

  test('roleSignal is set from user target roles', async () => {
    const intent = await extractSearchIntent('startups hiring', baseContext)
    expect(intent.roleSignal).toBe('product_manager')
  })

  test('temporal is active_hiring for hiring queries', async () => {
    const intent = await extractSearchIntent('startups hiring engineers', baseContext)
    expect(intent.temporal).toBe('active_hiring')
  })

  test('keywords are extracted from query words', async () => {
    const intent = await extractSearchIntent('Series B AI startups India', baseContext)
    expect(intent.keywords.length).toBeGreaterThan(0)
    expect(intent.keywords.some(k => k.toLowerCase().includes('series'))).toBe(true)
  })

  test('multi-word company name is detected', async () => {
    const intent = await extractSearchIntent('Acme Corp', baseContext)
    expect(intent.companyName).toBe('Acme Corp')
    expect(intent.confidence).toBeGreaterThanOrEqual(0.9)
  })

  test('Open AI not detected as company (AI is a filter term in heuristic)', async () => {
    // "AI" is in the filter terms list, so heuristic treats "Open AI" as discovery
    const intent = await extractSearchIntent('Open AI', baseContext)
    expect(intent.companyName).toBeNull()
  })

  test('filter words prevent false company name detection', async () => {
    const intent = await extractSearchIntent('hiring startups', baseContext)
    expect(intent.companyName).toBeNull()
  })

  // ── Company + Role pattern tests ────────────────────────────────────────────

  test('"Microsoft PM" extracts companyName as "Microsoft" (strips role suffix)', async () => {
    const intent = await extractSearchIntent('Microsoft PM', baseContext)
    expect(intent.companyName).toBe('Microsoft')
    expect(intent.confidence).toBeGreaterThanOrEqual(0.9)
  })

  test('"Microsoft PMs" extracts companyName as "Microsoft"', async () => {
    const intent = await extractSearchIntent('Microsoft PMs', baseContext)
    expect(intent.companyName).toBe('Microsoft')
  })

  test('"Stripe engineering" extracts companyName as "Stripe"', async () => {
    const intent = await extractSearchIntent('Stripe engineering', baseContext)
    expect(intent.companyName).toBe('Stripe')
  })

  test('"Google designer" extracts companyName as "Google"', async () => {
    const intent = await extractSearchIntent('Google designer', baseContext)
    expect(intent.companyName).toBe('Google')
  })

  test('"Razorpay" alone is detected as company', async () => {
    const intent = await extractSearchIntent('Razorpay', baseContext)
    expect(intent.companyName).toBe('Razorpay')
    expect(intent.confidence).toBeGreaterThanOrEqual(0.9)
  })

  test('"Series B AI startups" is NOT detected as company', async () => {
    const intent = await extractSearchIntent('Series B AI startups', baseContext)
    expect(intent.companyName).toBeNull()
  })

  // ── Lowercase company name tests ──────────────────────────────────────────

  test('"microsoft PMs" (lowercase) extracts companyName as "Microsoft"', async () => {
    const intent = await extractSearchIntent('microsoft PMs', baseContext)
    expect(intent.companyName).toBe('Microsoft')
    expect(intent.confidence).toBeGreaterThanOrEqual(0.9)
  })

  test('"stripe" (lowercase) is detected as company', async () => {
    const intent = await extractSearchIntent('stripe', baseContext)
    expect(intent.companyName).toBe('Stripe')
  })

  test('"razorpay engineering" (lowercase) extracts "Razorpay"', async () => {
    const intent = await extractSearchIntent('razorpay engineering', baseContext)
    expect(intent.companyName).toBe('Razorpay')
  })
})
