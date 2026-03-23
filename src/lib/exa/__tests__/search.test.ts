import { describe, it, expect } from 'vitest'
import { buildCompanyQuery, RECRUITING_PATTERNS } from '../search'
import type { SearchIntent } from '@/types'

function makeIntent(overrides: Partial<SearchIntent> = {}): SearchIntent {
  return {
    keywords: [],
    fundingStages: [],
    sectors: [],
    signals: [],
    industries: [],
    roles: [],
    geography: null,
    companySize: 'any',
    companyName: null,
    confidence: 0.5,
    temporal: null,
    roleSignal: null,
    expandedGeo: [],
    implicitSignals: [],
    ...overrides,
  }
}

describe('buildCompanyQuery', () => {
  it('strips hiring/role/meta noise words from keywords', () => {
    const intent = makeIntent({
      keywords: ['Series', 'startups', 'hiring', 'engineers', 'series a'],
      sectors: ['ai', 'ml'],
      fundingStages: ['series-a'],
    })
    const query = buildCompanyQuery(intent)

    // Should NOT contain noise words
    expect(query.toLowerCase()).not.toContain('hiring')
    expect(query.toLowerCase()).not.toContain('engineers')
    expect(query.toLowerCase()).not.toContain('startups')

    // Should contain company-descriptive terms
    expect(query.toLowerCase()).toContain('series a')
    expect(query.toLowerCase()).toContain('ai')
    expect(query.toLowerCase()).toContain('ml')
  })

  it('keeps geo terms', () => {
    const intent = makeIntent({
      keywords: ['startups', 'hiring'],
      sectors: ['saas'],
      expandedGeo: ['india', 'bangalore'],
    })
    const query = buildCompanyQuery(intent)

    expect(query.toLowerCase()).toContain('india')
    expect(query.toLowerCase()).toContain('bangalore')
    expect(query.toLowerCase()).not.toContain('hiring')
  })

  it('adds "technology company" fallback when all keywords are noise', () => {
    const intent = makeIntent({
      keywords: ['hiring', 'startups', 'engineers'],
      sectors: [],
      expandedGeo: [],
    })
    const query = buildCompanyQuery(intent)

    expect(query).toBe('technology company')
  })

  it('keeps sector terms even if they look like keywords', () => {
    const intent = makeIntent({
      keywords: ['ai', 'India'],
      sectors: ['fintech'],
      fundingStages: ['seed'],
    })
    const query = buildCompanyQuery(intent)

    expect(query.toLowerCase()).toContain('ai')
    expect(query.toLowerCase()).toContain('fintech')
    expect(query.toLowerCase()).toContain('seed')
  })

  it('adds funding stages to query', () => {
    const intent = makeIntent({
      keywords: ['Series', 'hiring', 'pms'],
      fundingStages: ['series-b'],
    })
    const query = buildCompanyQuery(intent)

    expect(query.toLowerCase()).toContain('series b')
    expect(query.toLowerCase()).not.toContain('hiring')
    expect(query.toLowerCase()).not.toContain('pms')
  })
})

describe('RECRUITING_PATTERNS', () => {
  it('matches recruiting/staffing company descriptions', () => {
    expect(RECRUITING_PATTERNS.test('AI-powered recruiting platform')).toBe(true)
    expect(RECRUITING_PATTERNS.test('talent acquisition software')).toBe(true)
    expect(RECRUITING_PATTERNS.test('staffing and hiring platform')).toBe(true)
    expect(RECRUITING_PATTERNS.test('HR SaaS for enterprise')).toBe(true)
    expect(RECRUITING_PATTERNS.test('applicant tracking system')).toBe(true)
    expect(RECRUITING_PATTERNS.test('candidate sourcing tool')).toBe(true)
  })

  it('does NOT match regular company descriptions', () => {
    expect(RECRUITING_PATTERNS.test('AI-powered analytics platform')).toBe(false)
    expect(RECRUITING_PATTERNS.test('Developer tools for cloud infrastructure')).toBe(false)
    expect(RECRUITING_PATTERNS.test('Fintech company building payments')).toBe(false)
    expect(RECRUITING_PATTERNS.test('Series A startup building AI agents')).toBe(false)
  })
})
