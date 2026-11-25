import { describe, expect, test } from 'bun:test'
import type { Access, PayloadRequest } from 'payload'

import config from '@/payload.config'

import { isEditor, isEditorUser } from './isEditor'

const reqAs = (role: 'editor' | 'service' | null) =>
  ({ user: role ? { id: 1, collection: 'users', role } : null }) as unknown as PayloadRequest

const allows = async (access: Access | undefined, role: 'editor' | 'service' | null) =>
  // Payload's default for a missing rule: any logged-in user.
  access ? await access({ req: reqAs(role) }) : Boolean(reqAs(role).user)

describe('isEditor', () => {
  test('only the editor role passes', () => {
    expect(isEditorUser({ role: 'editor' })).toBe(true)
    expect(isEditorUser({ role: 'service' })).toBe(false)
    expect(isEditorUser(null)).toBe(false)
    expect(isEditorUser(undefined)).toBe(false)
    expect(isEditor({ req: reqAs('service') })).toBe(false)
  })
})

describe('the service account is read-only', async () => {
  const sanitized = await config
  const collections = sanitized.collections.filter(({ slug }) => !slug.startsWith('payload-'))
  const globals = sanitized.globals.filter(({ slug }) => !slug.startsWith('payload-'))

  test.each(collections.map((c) => [c.slug, c] as const))(
    '%s: no create, update or delete',
    async (_slug, collection) => {
      for (const op of ['create', 'update', 'delete'] as const) {
        // form-submissions keeps a public create: visitors send forms through the web app.
        if (collection.slug === 'form-submissions' && op === 'create') continue
        expect(await allows(collection.access[op], 'service')).toBe(false)
      }
    },
  )

  test.each(globals.map((g) => [g.slug, g] as const))(
    '%s global: no update',
    async (_slug, global) => {
      expect(await allows(global.access.update, 'service')).toBe(false)
    },
  )

  test('users: only editors manage users or open the admin', async () => {
    const users = collections.find(({ slug }) => slug === 'users')
    expect(users).toBeDefined()
    for (const op of ['admin', 'create', 'read', 'update', 'delete', 'unlock'] as const) {
      const rule = users?.access[op] as Access | undefined
      expect(await allows(rule, 'service')).toBe(false)
      expect(await allows(rule, 'editor')).toBe(true)
    }
  })

  test('drafts stay readable for the service account', async () => {
    for (const slug of ['posts', 'pages']) {
      const collection = collections.find((c) => c.slug === slug)
      expect(await allows(collection?.access.read, 'service')).toBe(true)
    }
  })

  test('jobs: the service account cannot run, queue or cancel', async () => {
    const { cancel, queue, run } = sanitized.jobs.access
    const req = reqAs('service')
    req.headers = new Headers()
    expect(await cancel?.({ req } as never)).toBe(false)
    expect(await queue?.({ req } as never)).toBe(false)
    expect(await run?.({ req } as never)).toBe(false)
  })
})
