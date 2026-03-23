/**
 * Engagement scoring logic — pure functions for testability.
 * Scores LinkedIn posts to determine if they're worth commenting on.
 */

import type { EngagementPostInput, ScoredEngagement } from './types'

/** Minimum score to surface an opportunity */
export const SCORE_THRESHOLD = 40

/** Score a single post for engagement worthiness */
export function scorePost(post: EngagementPostInput, userId: string): ScoredEngagement {
  let score = 0
  const reasons: string[] = []

  // Target company boost
  if (post.is_target_company) {
    score += 40
    reasons.push('Author at target company')
  }

  // Visibility / virality
  if (post.reaction_count > 500) {
    score += 15
    reasons.push(`${post.reaction_count} reactions — high visibility`)
  } else if (post.reaction_count > 200) {
    score += 8
  }

  // Freshness
  if (post.hours_old < 6) {
    score += 15
    reasons.push('Posted < 6 hours ago')
  } else if (post.hours_old < 24) {
    score += 8
  }

  // Author seniority
  const titleLower = (post.author_title ?? '').toLowerCase()
  if (/\b(vp|chief|cpo|cto|ceo|head of|director)\b/.test(titleLower)) {
    score += 25
    reasons.push('Decision-maker level author')
  } else if (/\b(manager|lead|senior|principal|staff)\b/.test(titleLower)) {
    score += 10
  }

  return {
    user_id: userId,
    post_id: post.post_id,
    author_name: post.author_name,
    author_title: post.author_title,
    author_company: post.author_company,
    post_text: post.post_text,
    post_url: post.post_url,
    engagement_score: Math.min(score, 100),
    score_reasons: reasons,
    suggested_angle: null,
  }
}

/** Score multiple posts and filter below threshold */
export function scoreAndFilter(posts: EngagementPostInput[], userId: string): ScoredEngagement[] {
  return posts
    .map(p => scorePost(p, userId))
    .filter(p => p.engagement_score >= SCORE_THRESHOLD)
}
