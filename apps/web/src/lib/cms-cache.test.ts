import { describe, expect, test } from 'bun:test'

import {
  CMS_DATA_TAG,
  cachedCms,
  expireCmsData,
  withFreshCmsReads,
  type CmsCacheStore,
} from './cms-cache'

const fakeStore = () => {
  const data = new Map<string, unknown>()
  const calls = {
    get: 0,
    set: [] as { key: string; tags?: string[]; ttl?: number }[],
    expired: [] as unknown[],
  }
  const store: CmsCacheStore = {
    get: async (key) => {
      calls.get++
      return data.has(key) ? data.get(key) : null
    },
    set: async (key, value, options) => {
      calls.set.push({ key, ...options })
      data.set(key, value)
    },
    expireTag: async (tag) => {
      calls.expired.push(tag)
      data.clear()
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

  test('fresh reads skip the cache but refresh it', async () => {
    const { store, calls } = fakeStore()
    await cachedCms('k', async () => 'old', store)
    await settle()

    const value = await withFreshCmsReads(() => cachedCms('k', async () => 'new', store))
    expect(value).toBe('new')
    expect(calls.get).toBe(1)
    await settle()
    expect(await cachedCms('k', async () => 'unused', store)).toBe('new')
  })

  test('expireCmsData drops every cached response', async () => {
    const { store, calls } = fakeStore()
    await cachedCms('k', async () => 'old', store)
    await settle()
    expect(await expireCmsData(store)).toBe(true)
    expect(calls.expired).toEqual([CMS_DATA_TAG])
    expect(await cachedCms('k', async () => 'new', store)).toBe('new')
  })

  test('without a store (local dev) every call reads the CMS', async () => {
    let loads = 0
    await cachedCms('k', async () => ++loads, null)
    await cachedCms('k', async () => ++loads, null)
    expect(loads).toBe(2)
  })
})
