import { describe, expect, test } from 'bun:test'

import {
  CMS_DATA_TAG,
  cachedCms,
  expireCmsData,
  withFreshCmsReads,
  type CmsCacheStore,
} from './cms-cache'

const fakeStore = () => {
  const data = new Map<string, { value: unknown; tags: string[] }>()
  const calls = {
    get: 0,
    set: [] as { key: string; tags?: string[]; ttl?: number }[],
    expired: [] as unknown[],
  }
  const store: CmsCacheStore = {
    get: async (key) => {
      calls.get++
      return data.get(key)?.value ?? null
    },
    set: async (key, value, options) => {
      calls.set.push({ key, ...options })
      data.set(key, { value, tags: options?.tags ?? [] })
    },
    expireTag: async (tag) => {
      calls.expired.push(tag)
      const expired = Array.isArray(tag) ? tag : [tag]
      for (const [key, entry] of data) {
        if (entry.tags.some((t) => expired.includes(t))) data.delete(key)
      }
    },
  }
  return { store, calls }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('cachedCms', () => {
  test('loads once, then serves the cached copy', async () => {
    const { store, calls } = fakeStore()
    let loads = 0
    const load = async () => ({ docs: [++loads] })

    expect(await cachedCms('k', load, store)).toEqual({ docs: [1] })
    await settle()
    expect(await cachedCms('k', load, store)).toEqual({ docs: [1] })
    expect(loads).toBe(1)
    expect(calls.set[0]).toMatchObject({ key: 'k', tags: [CMS_DATA_TAG] })
    expect(calls.set[0]?.ttl).toBeGreaterThan(0)
  })

  test('never caches a failed load', async () => {
    const { store, calls } = fakeStore()
    await expect(
      cachedCms('k', () => Promise.reject(new Error('CMS down')), store),
    ).rejects.toThrow('CMS down')
    expect(calls.set).toHaveLength(0)
  })

  test('falls back to the CMS when the cache errors', async () => {
    const broken: CmsCacheStore = {
      get: () => Promise.reject(new Error('cache down')),
      set: () => Promise.reject(new Error('cache down')),
      expireTag: () => Promise.reject(new Error('cache down')),
    }
    expect(await cachedCms('k', async () => 'live', broken)).toBe('live')
    expect(await expireCmsData(broken)).toBe(false)
  })

  test('re-renders read the CMS unless the entry was read after a known expiry, and refresh it', async () => {
    const { store } = fakeStore()
    await cachedCms('k', async () => 'old', store)
    await settle()

    // No expiry recorded yet: a re-render cannot tell the entry is current.
    const value = await withFreshCmsReads(() => cachedCms('k', async () => 'new', store))
    expect(value).toBe('new')
    await settle()
    expect(await cachedCms('k', async () => 'unused', store)).toBe('new')
  })

  test('after an expiry, the first re-render reads the CMS and the next ones reuse it', async () => {
    const { store } = fakeStore()
    await cachedCms('layout', async () => 'before', store)
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 2))
    await expireCmsData(store)
    await new Promise((resolve) => setTimeout(resolve, 2))

    let loads = 0
    const load = async () => `after ${++loads}`
    expect(await withFreshCmsReads(() => cachedCms('layout', load, store))).toBe('after 1')
    await settle()
    expect(await withFreshCmsReads(() => cachedCms('layout', load, store))).toBe('after 1')
    expect(loads).toBe(1)
  })

  test('a re-render with its invalidation time never uses an entry read at or before it', async () => {
    const { store } = fakeStore()
    // The expiry before this one was recorded; this one's write fails.
    await expireCmsData(store)
    await new Promise((resolve) => setTimeout(resolve, 2))
    await cachedCms('k', async () => 'before the change', store)
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 2))
    const invalidatedAt = Date.now()
    const failing: CmsCacheStore = {
      ...store,
      set: (key, value, options) =>
        key === 'cms-data:expired-at'
          ? Promise.reject(new Error('cache write failed'))
          : store.set(key, value, options),
    }
    expect(await expireCmsData(failing)).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 2))

    // Without the time, the entry looks newer than the last recorded expiry.
    expect(await withFreshCmsReads(() => cachedCms('k', async () => 'unused', store))).toBe(
      'before the change',
    )
    let loads = 0
    const load = async () => `after ${++loads}`
    const rerender = () => withFreshCmsReads(() => cachedCms('k', load, store), invalidatedAt)
    expect(await rerender()).toBe('after 1')
    await settle()
    expect(await rerender()).toBe('after 1')
    expect(loads).toBe(1)
  })

  test('the invalidation time alone is enough; a bad one falls back to the recorded expiry', async () => {
    const { store } = fakeStore()
    await cachedCms('k', async () => 'old', store)
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 2))
    const invalidatedAt = Date.now()
    await new Promise((resolve) => setTimeout(resolve, 2))

    // No expiry recorded at all: the time the request carries decides.
    expect(
      await withFreshCmsReads(() => cachedCms('k', async () => 'new', store), invalidatedAt),
    ).toBe('new')
    await settle()
    expect(
      await withFreshCmsReads(() => cachedCms('k', async () => 'unused', store), invalidatedAt),
    ).toBe('new')
    // NaN, 0 or a negative time: as without one (no recorded expiry, so a miss).
    for (const bad of [Number.NaN, 0, -5]) {
      expect(await withFreshCmsReads(() => cachedCms('k', async () => 'live', store), bad)).toBe(
        'live',
      )
      await settle()
    }
  })

  test('expireCmsData drops every cached response', async () => {
    const { store, calls } = fakeStore()
    await cachedCms('k', async () => 'old', store)
    await settle()
    expect(await expireCmsData(store)).toBe(true)
    expect(calls.expired).toEqual([CMS_DATA_TAG])
    expect(await cachedCms('k', async () => 'new', store)).toBe('new')
  })

  test('a read that started before an expiry cannot bring old data back', async () => {
    const { store } = fakeStore()
    let finishOld: (value: string) => void = () => {}
    const slow = cachedCms(
      'k',
      () => new Promise<string>((resolve) => (finishOld = resolve)),
      store,
    )

    // A publish lands while that read is in flight: expire, then re-render.
    await new Promise((resolve) => setTimeout(resolve, 2))
    await expireCmsData(store)
    await new Promise((resolve) => setTimeout(resolve, 2))
    await withFreshCmsReads(() => cachedCms('k', async () => 'new', store))
    await settle()

    finishOld('old')
    expect(await slow).toBe('old')
    await settle() // the old read's write lands last

    expect(await cachedCms('k', async () => 'reloaded', store)).toBe('reloaded')
  })

  test('without a store (local dev) every call reads the CMS', async () => {
    let loads = 0
    await cachedCms('k', async () => ++loads, null)
    await cachedCms('k', async () => ++loads, null)
    expect(loads).toBe(2)
  })
})
