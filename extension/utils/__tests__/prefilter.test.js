import { describe, test, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Set up a minimal window/console global so prefilter.js can assign to window.preFilter
globalThis.window = globalThis.window || {}
globalThis.console = globalThis.console || { log: () => {} }

beforeAll(() => {
  const src = readFileSync(join(__dirname, '..', 'prefilter.js'), 'utf-8')
  // Evaluate in the global scope so window.preFilter gets defined
  const fn = new Function(src)
  fn()
})

function preFilter(post) {
  return window.preFilter(post)
}

describe('preFilter', () => {
  test('drops promoted/ad posts', () => {
    const post = {
      author: 'Ad Account',
      isPromoted: true,
      degree: '1st',
      body: 'Check out our amazing product that will change your life forever!',
      timeMinutes: 10,
    }
    expect(preFilter(post)).toBe(false)
  })

  test('drops unknown degree with no reactor', () => {
    const post = {
      author: 'Someone',
      degree: 'unknown',
      reactor: null,
      body: 'This is a perfectly fine post with enough characters to pass the body length check.',
      timeMinutes: 60,
    }
    expect(preFilter(post)).toBe(false)
  })

  test('drops body too short (< 40 chars)', () => {
    const post = {
      author: 'Short Poster',
      degree: '1st',
      body: 'Too short',
      timeMinutes: 10,
    }
    expect(preFilter(post)).toBe(false)
  })

  test('drops social noise (birthday wishes)', () => {
    const post = {
      author: 'Wisher',
      degree: '1st',
      body: 'Happy birthday to the most amazing person I know! Wishing you all the best!',
      timeMinutes: 30,
    }
    expect(preFilter(post)).toBe(false)
  })

  test('drops social noise (work anniversary)', () => {
    const post = {
      author: 'Colleague',
      degree: '1st',
      body: 'Congratulations on your 5 year anniversary at the company! Well deserved!',
      timeMinutes: 30,
    }
    expect(preFilter(post)).toBe(false)
  })

  test('drops engagement bait', () => {
    const post = {
      author: 'Baiter',
      degree: '1st',
      body: 'Like if you agree that Monday mornings are the worst! Share your thoughts below!',
      timeMinutes: 15,
    }
    expect(preFilter(post)).toBe(false)
  })

  test('drops engagement bait (tag someone)', () => {
    const post = {
      author: 'Baiter2',
      degree: '2nd',
      body: 'Tag someone who needs to hear this motivational message today in their feed!',
      timeMinutes: 15,
    }
    expect(preFilter(post)).toBe(false)
  })

  test('keeps valid 1st-degree post with good body', () => {
    const post = {
      author: 'Legit Person',
      degree: '1st',
      body: 'I just published a new article about machine learning techniques for natural language processing. Check it out!',
      timeMinutes: 120,
    }
    expect(preFilter(post)).toBe(true)
  })

  test('keeps job-degree post regardless of age', () => {
    const post = {
      author: 'Recruiter',
      degree: 'job',
      body: 'We are hiring a senior software engineer to join our distributed systems team. Apply now!',
      timeMinutes: 20000, // over 7 days but degree=job
    }
    expect(preFilter(post)).toBe(true)
  })

  test('keeps post with reactor even if degree is unknown', () => {
    const post = {
      author: 'Unknown',
      degree: 'unknown',
      reactor: 'My Connection',
      body: 'This is a post that was reacted to by someone in my network, so it should pass through filtering.',
      timeMinutes: 60,
    }
    expect(preFilter(post)).toBe(true)
  })

  test('drops old post (> 7 days)', () => {
    const post = {
      author: 'Old Poster',
      degree: '1st',
      body: 'This is a perfectly valid post but it was posted more than seven days ago so it should be filtered.',
      timeMinutes: 10081, // just over 7 days (10080 min)
    }
    expect(preFilter(post)).toBe(false)
  })

  test('keeps post at exactly 7 days', () => {
    const post = {
      author: 'Edge Case',
      degree: '2nd',
      body: 'This post is exactly 7 days old, right on the boundary of the time filter cutoff.',
      timeMinutes: 10080,
    }
    expect(preFilter(post)).toBe(true)
  })

  test('drops 3rd+ degree short post without reactor', () => {
    const post = {
      author: 'Distant',
      degree: '3rd+',
      reactor: null,
      body: 'Short 3rd+ post that has fewer than eighty characters total.',
      timeMinutes: 30,
    }
    expect(preFilter(post)).toBe(false)
  })

  test('keeps 3rd+ degree post with long body', () => {
    const post = {
      author: 'Distant but Relevant',
      degree: '3rd+',
      reactor: null,
      body: 'This is a much longer 3rd+ degree post that has substantial content and goes well over the eighty character minimum threshold for filtering.',
      timeMinutes: 30,
    }
    expect(preFilter(post)).toBe(true)
  })

  test('handles missing body gracefully', () => {
    const post = {
      author: 'No Body',
      degree: '1st',
      body: undefined,
      timeMinutes: 10,
    }
    expect(preFilter(post)).toBe(false)
  })

  test('handles missing author gracefully', () => {
    const post = {
      degree: '1st',
      body: 'A post without an author field but otherwise valid content that should pass the prefilter.',
      timeMinutes: 10,
    }
    expect(preFilter(post)).toBe(true)
  })
})
