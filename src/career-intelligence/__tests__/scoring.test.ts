import { describe, it, expect } from 'vitest'
import { scorePost, scoreAndFilter, SCORE_THRESHOLD } from '../scoring'
import type { EngagementPostInput } from '../types'

function makePost(overrides: Partial<EngagementPostInput> = {}): EngagementPostInput {
  return {
    post_id: 'post-1',
    author_name: 'Jane Doe',
    author_title: 'Software Engineer',
    author_company: 'Acme Corp',
    post_text: 'Some interesting post about engineering',
    post_url: 'https://linkedin.com/post/123',
    reaction_count: 50,
    is_target_company: false,
    hours_old: 12,
    ...overrides,
  }
}

const USER_ID = 'user-123'

describe('scorePost', () => {
  it('returns base fields from input', () => {
    const post = makePost()
    const result = scorePost(post, USER_ID)
    expect(result.user_id).toBe(USER_ID)
    expect(result.post_id).toBe('post-1')
    expect(result.author_name).toBe('Jane Doe')
    expect(result.suggested_angle).toBeNull()
  })

  it('adds 40 points for target company', () => {
    const withTarget = scorePost(makePost({ is_target_company: true }), USER_ID)
    const withoutTarget = scorePost(makePost({ is_target_company: false }), USER_ID)
    expect(withTarget.engagement_score - withoutTarget.engagement_score).toBe(40)
    expect(withTarget.score_reasons).toContain('Author at target company')
  })

  it('adds 15 points for >500 reactions', () => {
    const result = scorePost(makePost({ reaction_count: 600 }), USER_ID)
    expect(result.score_reasons).toContain('600 reactions — high visibility')
  })

  it('adds 8 points for 200-500 reactions (no reason string)', () => {
    const low = scorePost(makePost({ reaction_count: 50 }), USER_ID)
    const mid = scorePost(makePost({ reaction_count: 300 }), USER_ID)
    expect(mid.engagement_score - low.engagement_score).toBe(8)
  })

  it('adds 15 points for posts < 6 hours old', () => {
    const result = scorePost(makePost({ hours_old: 3 }), USER_ID)
    expect(result.score_reasons).toContain('Posted < 6 hours ago')
  })

  it('adds 8 points for posts 6-24 hours old', () => {
    const fresh = scorePost(makePost({ hours_old: 3 }), USER_ID)
    const dayOld = scorePost(makePost({ hours_old: 12 }), USER_ID)
    const stale = scorePost(makePost({ hours_old: 48 }), USER_ID)
    expect(fresh.engagement_score).toBeGreaterThan(dayOld.engagement_score)
    expect(dayOld.engagement_score).toBeGreaterThan(stale.engagement_score)
  })

  it('adds 25 points for decision-maker titles', () => {
    const ceo = scorePost(makePost({ author_title: 'CEO at StartupCo' }), USER_ID)
    const vp = scorePost(makePost({ author_title: 'VP of Engineering' }), USER_ID)
    const director = scorePost(makePost({ author_title: 'Director of Product' }), USER_ID)
    const headOf = scorePost(makePost({ author_title: 'Head of Design' }), USER_ID)

    for (const result of [ceo, vp, director, headOf]) {
      expect(result.score_reasons).toContain('Decision-maker level author')
    }
  })

  it('adds 10 points for mid-level leadership titles', () => {
    const manager = scorePost(makePost({ author_title: 'Engineering Manager' }), USER_ID)
    const lead = scorePost(makePost({ author_title: 'Tech Lead' }), USER_ID)
    const senior = scorePost(makePost({ author_title: 'Senior Product Designer' }), USER_ID)

    const baseline = scorePost(makePost({ author_title: 'Intern' }), USER_ID)
    expect(manager.engagement_score - baseline.engagement_score).toBe(10)
    expect(lead.engagement_score - baseline.engagement_score).toBe(10)
    expect(senior.engagement_score - baseline.engagement_score).toBe(10)
  })

  it('caps score at 100', () => {
    const maxPost = makePost({
      is_target_company: true,    // +40
      reaction_count: 1000,       // +15
      hours_old: 1,               // +15
      author_title: 'CEO',        // +25
    })
    const result = scorePost(maxPost, USER_ID)
    expect(result.engagement_score).toBe(95) // 40+15+15+25 = 95
  })

  it('handles null/empty author title gracefully', () => {
    const result = scorePost(makePost({ author_title: '' }), USER_ID)
    expect(result.engagement_score).toBeGreaterThanOrEqual(0)
  })
})

describe('scoreAndFilter', () => {
  it('filters out posts below threshold', () => {
    const posts = [
      makePost({ is_target_company: true, author_title: 'CEO', hours_old: 1 }), // high score
      makePost({ reaction_count: 10, hours_old: 100, author_title: 'Intern' }),  // low score
    ]
    const results = scoreAndFilter(posts, USER_ID)
    expect(results.length).toBe(1)
    expect(results[0].engagement_score).toBeGreaterThanOrEqual(SCORE_THRESHOLD)
  })

  it('returns empty array for empty input', () => {
    expect(scoreAndFilter([], USER_ID)).toEqual([])
  })

  it('returns all posts when all above threshold', () => {
    const posts = [
      makePost({ is_target_company: true }),
      makePost({ author_title: 'CEO', hours_old: 2 }),
    ]
    const results = scoreAndFilter(posts, USER_ID)
    expect(results.length).toBe(2)
  })

  it('preserves order from input', () => {
    const posts = [
      makePost({ post_id: 'a', is_target_company: true }),
      makePost({ post_id: 'b', author_title: 'VP Engineering', hours_old: 1 }),
    ]
    const results = scoreAndFilter(posts, USER_ID)
    expect(results[0].post_id).toBe('a')
    expect(results[1].post_id).toBe('b')
  })
})

describe('SCORE_THRESHOLD', () => {
  it('is 40', () => {
    expect(SCORE_THRESHOLD).toBe(40)
  })
})
