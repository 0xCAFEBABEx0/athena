import { describe, expect, mock, test } from 'bun:test'
import type { PayloadRequest } from 'payload'

import { canDeleteUser, keepAnEditor, keepAnEditorOnDelete } from './keepAnEditor'

const reqWith = (users: { id: number; role: 'editor' | 'service' }[]) => {
  const count = mock(async ({ where }: { where?: unknown }) => {
    if (!where) return { totalDocs: users.length }
    const ids = (where as { and: [unknown, { id: { not_in: number[] } }] }).and[1].id.not_in
    return { totalDocs: users.filter((u) => u.role === 'editor' && !ids.includes(u.id)).length }
  })
  const findByID = mock(async ({ id }: { id: number }) => users.find((u) => u.id === id))
  return { payload: { count, findByID } } as unknown as PayloadRequest
}

const change = (args: Record<string, unknown>) =>
  keepAnEditor({ collection: {}, context: {}, ...args } as never)

describe('keepAnEditor', () => {
  test('the first user is always an editor', async () => {
    const data = await change({ data: { role: 'service' }, operation: 'create', req: reqWith([]) })
    expect(data.role).toBe('editor')
  })

  test('later users keep the chosen role', async () => {
    const req = reqWith([{ id: 1, role: 'editor' }])
    const data = await change({ data: { role: 'service' }, operation: 'create', req })
    expect(data.role).toBe('service')
  })

  test('the last editor cannot be demoted', async () => {
    const req = reqWith([
      { id: 1, role: 'editor' },
      { id: 2, role: 'service' },
    ])
    const originalDoc = { id: 1, role: 'editor' }
    await expect(
      change({ data: { role: 'service' }, operation: 'update', originalDoc, req }),
    ).rejects.toThrow()
  })

  test('an editor can be demoted while another editor remains', async () => {
    const req = reqWith([
      { id: 1, role: 'editor' },
      { id: 2, role: 'editor' },
    ])
    const originalDoc = { id: 1, role: 'editor' }
    const data = await change({ data: { role: 'service' }, operation: 'update', originalDoc, req })
    expect(data.role).toBe('service')
  })

  test('the last editor cannot be deleted; a service account can', async () => {
    const req = reqWith([
      { id: 1, role: 'editor' },
      { id: 2, role: 'service' },
    ])
    await expect(keepAnEditorOnDelete({ context: {}, id: 1, req } as never)).rejects.toThrow()
    await expect(
      keepAnEditorOnDelete({ context: {}, id: 2, req } as never),
    ).resolves.toBeUndefined()
  })
})

describe('canDeleteUser', () => {
  const as = (role: 'editor' | 'service', users: { id: number; role: 'editor' | 'service' }[]) => {
    const req = reqWith(users)
    const count = mock(async () => ({
      totalDocs: users.filter((u) => u.role === 'editor').length,
    }))
    Object.assign(req, { user: { id: 1, role } })
    Object.assign(req.payload, { count })
    return { req } as never
  }

  test('the service role cannot delete users', async () => {
    expect(await canDeleteUser(as('service', [{ id: 1, role: 'editor' }]))).toBe(false)
  })

  test('with several editors, editors may delete anyone', async () => {
    const users = [
      { id: 1, role: 'editor' as const },
      { id: 2, role: 'editor' as const },
    ]
    expect(await canDeleteUser(as('editor', users))).toBe(true)
  })

  test('with one editor left, deletes skip editors', async () => {
    const users = [
      { id: 1, role: 'editor' as const },
      { id: 2, role: 'service' as const },
    ]
    expect(await canDeleteUser(as('editor', users))).toEqual({ role: { not_equals: 'editor' } })
  })

  test('a bulk delete of every editor keeps one', async () => {
    const req = reqWith([
      { id: 1, role: 'editor' },
      { id: 2, role: 'editor' },
    ])
    const context = {}
    const results = await Promise.allSettled([
      keepAnEditorOnDelete({ context, id: 1, req } as never),
      keepAnEditorOnDelete({ context, id: 2, req } as never),
    ])
    expect(results.some((r) => r.status === 'rejected')).toBe(true)
  })
})
