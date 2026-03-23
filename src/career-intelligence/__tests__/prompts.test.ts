import { describe, it, expect } from 'vitest'
import { buildRecruiterPrompt, EXTRACTION_PROMPT } from '../prompts/recruiter'
import { buildCommentPrompt } from '../prompts/engagement'
import { buildCompletionPrompt } from '../prompts/completion'

describe('buildRecruiterPrompt', () => {
  it('includes the correct phase number', () => {
    const prompt = buildRecruiterPrompt(3, {})
    expect(prompt).toContain('Phase 3')
    expect(prompt).toContain('you are currently in Phase 3')
  })

  it('includes partial model data as JSON', () => {
    const model = { headline: 'Senior PM', skill_tags: ['product', 'ai'] }
    const prompt = buildRecruiterPrompt(1, model)
    expect(prompt).toContain('"headline"')
    expect(prompt).toContain('Senior PM')
    expect(prompt).toContain('"skill_tags"')
  })

  it('includes all 5 phases in the prompt', () => {
    const prompt = buildRecruiterPrompt(1, {})
    expect(prompt).toContain('Phase 1')
    expect(prompt).toContain('Phase 2')
    expect(prompt).toContain('Phase 3')
    expect(prompt).toContain('Phase 4')
    expect(prompt).toContain('Phase 5')
  })

  it('includes conversation rules', () => {
    const prompt = buildRecruiterPrompt(1, {})
    expect(prompt).toContain('Ask EXACTLY ONE question per turn')
    expect(prompt).toContain('NEVER start with affirmations')
  })

  it('handles empty model gracefully', () => {
    const prompt = buildRecruiterPrompt(1, {})
    expect(prompt).toContain('{}')
  })
})

describe('EXTRACTION_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof EXTRACTION_PROMPT).toBe('string')
    expect(EXTRACTION_PROMPT.length).toBeGreaterThan(100)
  })

  it('defines the expected JSON schema fields', () => {
    expect(EXTRACTION_PROMPT).toContain('"headline"')
    expect(EXTRACTION_PROMPT).toContain('"work_experiences"')
    expect(EXTRACTION_PROMPT).toContain('"skill_tags"')
    expect(EXTRACTION_PROMPT).toContain('"extracted_facts"')
    expect(EXTRACTION_PROMPT).toContain('"domain_expertise"')
    expect(EXTRACTION_PROMPT).toContain('"target_roles"')
  })

  it('instructs to return only valid JSON', () => {
    expect(EXTRACTION_PROMPT).toContain('Return ONLY valid JSON')
  })
})

describe('buildCommentPrompt', () => {
  it('includes candidate background', () => {
    const model = { positioning: 'B2B SaaS expert', domain_expertise: ['ai'] }
    const prompt = buildCommentPrompt(model, {
      author_name: 'Jane Doe',
      author_title: 'CEO',
      author_company: 'Acme',
      post_text: 'We just hit 10k customers',
      suggested_angle: null,
    })
    expect(prompt).toContain('B2B SaaS expert')
    expect(prompt).toContain('Jane Doe')
    expect(prompt).toContain('CEO')
    expect(prompt).toContain('Acme')
    expect(prompt).toContain('10k customers')
  })

  it('uses default angle when none provided', () => {
    const prompt = buildCommentPrompt(null, {
      author_name: 'Test',
      author_title: 'PM',
      author_company: 'Co',
      post_text: 'test post',
      suggested_angle: null,
    })
    expect(prompt).toContain('Take a thoughtful stance')
  })

  it('uses provided suggested angle', () => {
    const prompt = buildCommentPrompt(null, {
      author_name: 'Test',
      author_title: 'PM',
      author_company: 'Co',
      post_text: 'test post',
      suggested_angle: 'Disagree on the timeline',
    })
    expect(prompt).toContain('Disagree on the timeline')
  })

  it('includes anti-pattern rules', () => {
    const prompt = buildCommentPrompt(null, {
      author_name: 'X',
      author_title: 'Y',
      author_company: 'Z',
      post_text: 'post',
      suggested_angle: null,
    })
    expect(prompt).toContain('NEVER start with "Great post"')
    expect(prompt).toContain('Do NOT use')
  })
})

describe('buildCompletionPrompt', () => {
  it('includes model data', () => {
    const model = { headline: 'Test', work_experiences: [{ company: 'Acme' }] }
    const prompt = buildCompletionPrompt(model)
    expect(prompt).toContain('Test')
    expect(prompt).toContain('Acme')
  })

  it('requests all required output fields', () => {
    const prompt = buildCompletionPrompt({})
    expect(prompt).toContain('"linkedin_headline"')
    expect(prompt).toContain('"bio_short"')
    expect(prompt).toContain('"bio_long"')
    expect(prompt).toContain('"resume_bullets"')
    expect(prompt).toContain('"completeness_score"')
  })
})
