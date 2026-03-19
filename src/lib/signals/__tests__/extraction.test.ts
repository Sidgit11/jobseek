import { describe, test, expect } from 'vitest'
import {
  normalizeCompanyName,
  looksLikePersonName,
  extractCompanyFromTitle,
  extractCompanyFromReasoning,
  extractCompanyFromPreview,
  extractRoleFromTitle,
  parseSeniority,
  parseDepartment,
  looksLikeJobTitle,
} from '../extraction'

describe('normalizeCompanyName', () => {
  test('strips "Inc" suffix', () => {
    expect(normalizeCompanyName('Meta Platforms Inc')).toBe('Meta Platforms')
  })

  test('strips "Inc." with trailing period', () => {
    expect(normalizeCompanyName('Stripe, Inc.')).toBe('Stripe')
  })

  test('trims surrounding whitespace', () => {
    expect(normalizeCompanyName('  Google  ')).toBe('Google')
  })

  test('returns simple name unchanged', () => {
    expect(normalizeCompanyName('Revolut')).toBe('Revolut')
  })

  test('strips "Corp." suffix', () => {
    expect(normalizeCompanyName('Company Corp.')).toBe('Company')
  })

  test('strips "LLC" suffix', () => {
    expect(normalizeCompanyName('Acme LLC')).toBe('Acme')
  })

  test('strips "Ltd" suffix', () => {
    expect(normalizeCompanyName('Barclays Ltd')).toBe('Barclays')
  })

  test('collapses internal whitespace', () => {
    expect(normalizeCompanyName('Open   AI')).toBe('Open AI')
  })
})

describe('looksLikePersonName', () => {
  test('abbreviated last name like "Shweta V."', () => {
    expect(looksLikePersonName('Shweta V.')).toBe(true)
  })

  test('two-word capitalized name', () => {
    expect(looksLikePersonName('Prashant Tiwari')).toBe(true)
  })

  test('common English name', () => {
    expect(looksLikePersonName('John Smith')).toBe(true)
  })

  test('three-word name', () => {
    expect(looksLikePersonName('Mary Jane Watson')).toBe(true)
  })

  test('single word is not a person name', () => {
    expect(looksLikePersonName('Google')).toBe(false)
  })

  test('company indicator "Platforms"', () => {
    expect(looksLikePersonName('Meta Platforms')).toBe(false)
  })

  test('company with "Labs" and "Health"', () => {
    expect(looksLikePersonName('Orange Health Labs')).toBe(false)
  })

  test('single uppercase word', () => {
    expect(looksLikePersonName('AI')).toBe(false)
  })

  test('empty string', () => {
    expect(looksLikePersonName('')).toBe(false)
  })

  test('single company name', () => {
    expect(looksLikePersonName('Stripe')).toBe(false)
  })

  test('name with abbreviated initial (no dot)', () => {
    expect(looksLikePersonName('Shweta V')).toBe(true)
  })

  test('company with "Technologies"', () => {
    expect(looksLikePersonName('Acme Technologies')).toBe(false)
  })
})

describe('looksLikeJobTitle', () => {
  test('recognizes "Product Manager"', () => {
    expect(looksLikeJobTitle('Product Manager')).toBe(true)
  })

  test('recognizes "Senior Software Engineer"', () => {
    expect(looksLikeJobTitle('Senior Software Engineer')).toBe(true)
  })

  test('recognizes "Head of Growth"', () => {
    expect(looksLikeJobTitle('Head of Growth')).toBe(true)
  })

  test('does not match plain company name', () => {
    expect(looksLikeJobTitle('Google')).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(looksLikeJobTitle('')).toBe(false)
  })

  test('recognizes "UX Designer"', () => {
    expect(looksLikeJobTitle('UX Designer')).toBe(true)
  })
})

describe('extractCompanyFromTitle', () => {
  test('extracts company after " · " separator', () => {
    expect(extractCompanyFromTitle('Product Manager · Google')).toBe('Google')
  })

  test('extracts company after " | " separator', () => {
    expect(extractCompanyFromTitle('Senior PM | Meta')).toBe('Meta')
  })

  test('extracts company after "at" keyword', () => {
    expect(extractCompanyFromTitle('Doctor at MeraDoc')).toBe('MeraDoc')
  })

  test('extracts company after " @ " separator', () => {
    expect(extractCompanyFromTitle('CEO @ Stripe')).toBe('Stripe')
  })

  test('skips job title fragments after separator', () => {
    expect(extractCompanyFromTitle('Engineer - Senior')).toBe(null)
  })

  test('returns null for null input', () => {
    expect(extractCompanyFromTitle(null)).toBe(null)
  })

  test('returns null for empty string', () => {
    expect(extractCompanyFromTitle('')).toBe(null)
  })

  test('returns null when no separator present', () => {
    expect(extractCompanyFromTitle('Product Manager')).toBe(null)
  })

  test('normalizes company suffix from title', () => {
    expect(extractCompanyFromTitle('PM · Acme Inc')).toBe('Acme')
  })

  test('skips person names after separator', () => {
    expect(extractCompanyFromTitle('Engineer · John Smith')).toBe(null)
  })
})

describe('extractCompanyFromReasoning', () => {
  test('extracts company from "hiring for X as" pattern', () => {
    expect(extractCompanyFromReasoning('Author is hiring for Stripe as Head of Product')).toBe('Stripe')
  })

  test('extracts company from "new role at X which" pattern', () => {
    expect(extractCompanyFromReasoning('Starting a new role at Google which is growing')).toBe('Google')
  })

  test('extracts company from quoted name', () => {
    expect(extractCompanyFromReasoning('The company "Revolut" announced')).toBe('Revolut')
  })

  test('extracts company from "X is hiring" pattern', () => {
    expect(extractCompanyFromReasoning('Stripe is hiring for senior roles')).toBe('Stripe')
  })

  test('returns null for null input', () => {
    expect(extractCompanyFromReasoning(null)).toBe(null)
  })

  test('returns null when no company mentioned', () => {
    expect(extractCompanyFromReasoning('No company mentioned here')).toBe(null)
  })

  test('extracts company from "working at X" pattern', () => {
    expect(extractCompanyFromReasoning('She is working at Meta in London')).toBe('Meta')
  })
})

describe('extractCompanyFromPreview', () => {
  test('extracts company from "Job: role at Company." format', () => {
    expect(extractCompanyFromPreview('Job: Senior PM at Google. San Francisco')).toBe('Google')
  })

  test('extracts company from job preview with remote location', () => {
    expect(extractCompanyFromPreview('Job: Engineer at Stripe. Remote')).toBe('Stripe')
  })

  test('returns null when company matches job title', () => {
    expect(extractCompanyFromPreview('Job: PM at PM. Some location')).toBe(null)
  })

  test('returns null for null input', () => {
    expect(extractCompanyFromPreview(null)).toBe(null)
  })

  test('returns null for non-job format', () => {
    expect(extractCompanyFromPreview('Not a job post format')).toBe(null)
  })

  test('rejects candidate that looks like a job title', () => {
    expect(extractCompanyFromPreview('Job: Analyst at Senior Engineer. NYC')).toBe(null)
  })
})

describe('extractRoleFromTitle', () => {
  test('extracts role before " · " separator', () => {
    expect(extractRoleFromTitle('Product Manager · Google')).toBe('Product Manager')
  })

  test('extracts role before " | " separator', () => {
    expect(extractRoleFromTitle('Senior PM | Meta')).toBe('Senior PM')
  })

  test('extracts role before "at" keyword', () => {
    expect(extractRoleFromTitle('Software Engineer at Stripe')).toBe('Software Engineer')
  })

  test('returns full string when no separator', () => {
    expect(extractRoleFromTitle('Product Manager')).toBe('Product Manager')
  })

  test('returns null for null input', () => {
    expect(extractRoleFromTitle(null)).toBe(null)
  })

  test('returns null for empty string', () => {
    expect(extractRoleFromTitle('')).toBe(null)
  })

  test('extracts role before " - " separator', () => {
    expect(extractRoleFromTitle('Data Scientist - Google')).toBe('Data Scientist')
  })
})

describe('parseSeniority', () => {
  test('detects c-level from "CEO"', () => {
    expect(parseSeniority('CEO and Founder')).toBe('c-level')
  })

  test('detects vp', () => {
    expect(parseSeniority('VP of Engineering')).toBe('vp')
  })

  test('detects director', () => {
    expect(parseSeniority('Director of Product')).toBe('director')
  })

  test('detects head', () => {
    expect(parseSeniority('Head of Growth')).toBe('head')
  })

  test('detects lead from "Manager"', () => {
    expect(parseSeniority('Engineering Manager')).toBe('lead')
  })

  test('detects senior', () => {
    expect(parseSeniority('Senior Software Engineer')).toBe('senior')
  })

  test('detects junior', () => {
    expect(parseSeniority('Junior Developer')).toBe('junior')
  })

  test('defaults to mid for plain title', () => {
    expect(parseSeniority('Software Engineer')).toBe('mid')
  })

  test('detects c-level from "Founder"', () => {
    expect(parseSeniority('Co-Founder & CTO')).toBe('c-level')
  })

  test('detects lead from "Principal"', () => {
    expect(parseSeniority('Principal Engineer')).toBe('lead')
  })
})

describe('parseDepartment', () => {
  test('engineering from "Software Engineer"', () => {
    expect(parseDepartment('Software Engineer')).toBe('engineering')
  })

  test('product from "Product Manager"', () => {
    expect(parseDepartment('Product Manager')).toBe('product')
  })

  test('design from "UX Designer"', () => {
    expect(parseDepartment('UX Designer')).toBe('design')
  })

  test('marketing from "Growth Lead"', () => {
    expect(parseDepartment('Growth Lead')).toBe('marketing')
  })

  test('sales from "Sales Director"', () => {
    expect(parseDepartment('Sales Director')).toBe('sales')
  })

  test('data-science from "Data Scientist"', () => {
    expect(parseDepartment('Data Scientist')).toBe('data-science')
  })

  test('people from "Talent Acquisition"', () => {
    expect(parseDepartment('Talent Acquisition')).toBe('people')
  })

  test('operations from "Operations Manager"', () => {
    expect(parseDepartment('Operations Manager')).toBe('operations')
  })

  test('returns null for unrecognized title', () => {
    expect(parseDepartment('CEO')).toBe(null)
  })

  test('engineering from "Backend Developer"', () => {
    expect(parseDepartment('Backend Developer')).toBe('engineering')
  })
})
