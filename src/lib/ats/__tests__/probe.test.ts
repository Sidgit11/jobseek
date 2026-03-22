import { describe, test, expect } from 'vitest'
import { guessSlug, guessDomain, matchRoles } from '../probe'
import type { ATSJobPosting } from '@/types'

// ── guessSlug ────────────────────────────────────────────────────────────────

describe('guessSlug', () => {
  test('simple .com domain', () => {
    const slugs = guessSlug('razorpay.com')
    expect(slugs[0]).toBe('razorpay')
    expect(slugs).toContain('razorpay')
  })

  test('simple .io domain', () => {
    expect(guessSlug('linear.io')).toContain('linear')
  })

  test('.ai domain generates name-tld variant', () => {
    const slugs = guessSlug('scale.ai')
    expect(slugs).toContain('scale')
    expect(slugs).toContain('scale-ai')
  })

  test('strips www prefix', () => {
    const slugs = guessSlug('www.stripe.com')
    expect(slugs).toContain('stripe')
  })

  test('hyphenated domain preserves and strips hyphens', () => {
    const slugs = guessSlug('acme-corp.com')
    expect(slugs).toContain('acme-corp')
    expect(slugs).toContain('acmecorp')
  })

  test('.co.uk domain', () => {
    const slugs = guessSlug('monzo.co.uk')
    // should handle multi-part TLD
    expect(slugs.length).toBeGreaterThan(0)
  })

  test('does not produce duplicates', () => {
    const slugs = guessSlug('notion.com')
    const unique = [...new Set(slugs)]
    expect(slugs.length).toBe(unique.length)
  })

  test('.app domain generates name-tld variant', () => {
    const slugs = guessSlug('cash.app')
    expect(slugs).toContain('cash')
    expect(slugs).toContain('cash-app')
  })
})

// ── guessDomain ──────────────────────────────────────────────────────────────

describe('guessDomain', () => {
  test('simple company name', () => {
    expect(guessDomain('Stripe')).toBe('stripe.com')
  })

  test('multi-word company name strips spaces', () => {
    expect(guessDomain('Acme Corp')).toBe('acmecorp.com')
  })

  test('strips special characters', () => {
    expect(guessDomain("O'Reilly")).toBe('oreilly.com')
  })

  test('handles single word', () => {
    expect(guessDomain('Microsoft')).toBe('microsoft.com')
  })
})

// ── matchRoles ───────────────────────────────────────────────────────────────

describe('matchRoles', () => {
  const mockJobs: ATSJobPosting[] = [
    { title: 'Senior Product Manager', location: 'NYC', department: 'Product', posted_date: null, url: '', employment_type: null },
    { title: 'Software Engineer - Backend', location: 'Remote', department: 'Engineering', posted_date: null, url: '', employment_type: null },
    { title: 'Senior Designer', location: 'SF', department: 'Design', posted_date: null, url: '', employment_type: null },
    { title: 'Data Analyst', location: 'London', department: 'Analytics', posted_date: null, url: '', employment_type: null },
    { title: 'Office Manager', location: 'NYC', department: 'Operations', posted_date: null, url: '', employment_type: null },
    { title: 'Growth Marketing Lead', location: 'Remote', department: 'Marketing', posted_date: null, url: '', employment_type: null },
    { title: 'Account Executive - Enterprise', location: 'Chicago', department: 'Sales', posted_date: null, url: '', employment_type: null },
  ]

  test('matches Product Manager roles', () => {
    const matched = matchRoles(mockJobs, ['Product Manager'])
    expect(matched.length).toBe(1)
    expect(matched[0].title).toBe('Senior Product Manager')
  })

  test('matches Software Engineer roles', () => {
    const matched = matchRoles(mockJobs, ['Software Engineer'])
    expect(matched.length).toBe(1)
    expect(matched[0].title).toBe('Software Engineer - Backend')
  })

  test('matches Designer roles', () => {
    const matched = matchRoles(mockJobs, ['Designer'])
    expect(matched.length).toBe(1)
    expect(matched[0].title).toBe('Senior Designer')
  })

  test('matches Data Scientist roles (includes data analyst)', () => {
    const matched = matchRoles(mockJobs, ['Data Scientist'])
    expect(matched.length).toBe(1)
    expect(matched[0].title).toBe('Data Analyst')
  })

  test('matches GTM / Sales roles', () => {
    const matched = matchRoles(mockJobs, ['GTM / Sales'])
    expect(matched.length).toBe(1)
    expect(matched[0].title).toBe('Account Executive - Enterprise')
  })

  test('matches Growth roles', () => {
    const matched = matchRoles(mockJobs, ['Growth'])
    expect(matched.length).toBe(1)
    expect(matched[0].title).toBe('Growth Marketing Lead')
  })

  test('matches multiple target roles', () => {
    const matched = matchRoles(mockJobs, ['Product Manager', 'Designer'])
    expect(matched.length).toBe(2)
  })

  test('returns empty for no target roles', () => {
    expect(matchRoles(mockJobs, [])).toEqual([])
  })

  test('returns empty when no matches found', () => {
    const matched = matchRoles(mockJobs, ['Legal Counsel'])
    expect(matched.length).toBe(0)
  })

  test('handles custom role not in alias map', () => {
    const jobs: ATSJobPosting[] = [
      { title: 'DevOps Engineer', location: null, department: null, posted_date: null, url: '', employment_type: null },
    ]
    const matched = matchRoles(jobs, ['DevOps'])
    expect(matched.length).toBe(1)
  })

  test('case insensitive matching', () => {
    const jobs: ATSJobPosting[] = [
      { title: 'SENIOR PRODUCT MANAGER', location: null, department: null, posted_date: null, url: '', employment_type: null },
    ]
    const matched = matchRoles(jobs, ['Product Manager'])
    expect(matched.length).toBe(1)
  })
})
