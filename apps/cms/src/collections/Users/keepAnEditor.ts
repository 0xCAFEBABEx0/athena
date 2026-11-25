import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type PayloadRequest,
  ValidationError,
} from 'payload'

import type { User } from '@/payload-types'

const LAST_EDITOR = 'At least one editor must remain, or nobody can open the admin.'

const otherEditors = async (req: PayloadRequest, id: User['id']): Promise<number> =>
  (
    await req.payload.count({
      collection: 'users',
      overrideAccess: true,
      req,
      where: { and: [{ role: { equals: 'editor' } }, { id: { not_equals: id } }] },
    })
  ).totalDocs

/**
 * Only editors can open the admin or manage users, so the CMS must never be
 * left without one: the first user is always an editor, and the last editor
 * can be neither demoted nor deleted.
 */
export const keepAnEditor: CollectionBeforeChangeHook<User> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation === 'create') {
    const { totalDocs } = await req.payload.count({
      collection: 'users',
      overrideAccess: true,
      req,
    })
    return totalDocs === 0 ? { ...data, role: 'editor' } : data
  }

  if (originalDoc?.role === 'editor' && data.role && data.role !== 'editor') {
    if ((await otherEditors(req, originalDoc.id)) === 0) {
      throw new ValidationError({ errors: [{ message: LAST_EDITOR, path: 'role' }], req })
    }
  }
  return data
}

export const keepAnEditorOnDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const user = (await req.payload.findByID({
    collection: 'users',
    depth: 0,
    id,
    overrideAccess: true,
    req,
  })) as User
  if (user.role === 'editor' && (await otherEditors(req, user.id)) === 0) {
    throw new APIError(LAST_EDITOR, 400)
  }
}
