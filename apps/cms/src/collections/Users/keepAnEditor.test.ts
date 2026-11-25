import { describe, expect, mock, test } from 'bun:test'
import type { PayloadRequest } from 'payload'

import { keepAnEditor, keepAnEditorOnDelete } from './keepAnEditor'

const reqWith = (users: { id: number; role: 'editor' | 'service' }[]) => {
  const count = mock(async ({ where }: { where?: unknown }) => {
    if (!where) return { totalDocs: users.length }
    const id = (where as { and: [unknown, { id: { not_equals: number } }] }).and[1].id.not_equals
    return { totalDocs: users.filter((u) => u.role === 'editor' && u.id !== id).length }
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
    await expect(keepAnEditorOnDelete({ id: 1, req } as never)).rejects.toThrow()
    await expect(keepAnEditorOnDelete({ id: 2, req } as never)).resolves.toBeUndefined()
  })
})
