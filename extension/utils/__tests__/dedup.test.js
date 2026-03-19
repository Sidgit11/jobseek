import { describe, test, expect, beforeEach, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// In-memory store for chrome.storage.local mock
let storageData = {}

globalThis.window = globalThis.window || {}
globalThis.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const result = {}
        for (const key of keys) {
          if (key in storageData) {
            result[key] = storageData[key]
          }
        }
        cb(result)
      },
      set: (data, cb) => {
        Object.assign(storageData, data)
        if (cb) cb()
      },
    },
  },
}

beforeAll(() => {
  const src = readFileSync(join(__dirname, '..', 'dedup.js'), 'utf-8')
  const fn = new Function(src)
  fn()
})

beforeEach(() => {
  storageData = {}
})

describe('isSeenPost', () => {
  test('returns false for a new post ID', async () => {
    const result = await window.isSeenPost('post-123')
    expect(result).toBe(false)
  })

  test('returns true after markPostsSeen', async () => {
    await window.markPostsSeen(['post-abc'])
    const result = await window.isSeenPost('post-abc')
    expect(result).toBe(true)
  })

  test('returns false for an ID not in the seen list', async () => {
    await window.markPostsSeen(['post-1', 'post-2', 'post-3'])
    const result = await window.isSeenPost('post-999')
    expect(result).toBe(false)
  })
})

describe('markPostsSeen', () => {
  test('marks multiple IDs as seen', async () => {
    await window.markPostsSeen(['id-a', 'id-b', 'id-c'])
    expect(await window.isSeenPost('id-a')).toBe(true)
    expect(await window.isSeenPost('id-b')).toBe(true)
    expect(await window.isSeenPost('id-c')).toBe(true)
  })

  test('deduplicates IDs when marking', async () => {
    await window.markPostsSeen(['dup-1', 'dup-1', 'dup-1'])
    expect(storageData.seenPostIds.filter((id) => id === 'dup-1').length).toBe(1)
  })

  test('accumulates across multiple calls', async () => {
    await window.markPostsSeen(['batch1-a', 'batch1-b'])
    await window.markPostsSeen(['batch2-a', 'batch2-b'])
    expect(await window.isSeenPost('batch1-a')).toBe(true)
    expect(await window.isSeenPost('batch2-b')).toBe(true)
  })

  test('caps at 1000 entries (keeps last 1000)', async () => {
    // Insert 1005 unique IDs
    const ids = Array.from({ length: 1005 }, (_, i) => `id-${i}`)
    await window.markPostsSeen(ids)
    expect(storageData.seenPostIds.length).toBe(1000)
    // The first 5 should have been evicted (slice(-1000) keeps last 1000)
    expect(await window.isSeenPost('id-0')).toBe(false)
    expect(await window.isSeenPost('id-4')).toBe(false)
    // The later ones should still be present
    expect(await window.isSeenPost('id-5')).toBe(true)
    expect(await window.isSeenPost('id-1004')).toBe(true)
  })
})
