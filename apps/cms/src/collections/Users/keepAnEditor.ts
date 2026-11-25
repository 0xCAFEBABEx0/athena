import {
  type Access,
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type PayloadRequest,
  ValidationError,
} from 'payload'

import { isEditorUser } from '@/access/isEditor'
import type { User } from '@/payload-types'

const LAST_EDITOR = 'At least one editor must remain, or nobody can open the admin.'

const otherEditors = async (req: PayloadRequest, ids: User['id'][]): Promise<number> =>
  (
    await req.payload.count({
      collection: 'users',
      overrideAccess: true,
      req,
      where: { and: [{ role: { equals: 'editor' } }, { id: { not_in: ids } }] },
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
    if ((await otherEditors(req, [originalDoc.id])) === 0) {
      throw new ValidationError({ errors: [{ message: LAST_EDITOR, path: 'role' }], req })
    }
  }
  return data
}

/**
 * Editors may delete users, but while only one editor is left the delete
 * query skips editors. A filter rather than an error: Payload's bulk delete
 * drops the preferences of every selected user, even ones a hook refused.
 */
export const canDeleteUser: Access<User> = async ({ req }) => {
  if (!isEditorUser(req.user)) return false
  const { totalDocs } = await req.payload.count({
    collection: 'users',
    overrideAccess: true,
    req,
    where: { role: { equals: 'editor' } },
  })
  return totalDocs > 1 || { role: { not_equals: 'editor' } }
}

/** Backstop for calls that skip access; the seed clears its demo author with `allowDeletingLastEditor`. */
export const keepAnEditorOnDelete: CollectionBeforeDeleteHook = async ({ context, id, req }) => {
  if (context.allowDeletingLastEditor) return
  // A bulk delete runs these hooks concurrently: each one counts the editors
  // outside every user this request has started deleting, so the last hook
  // to count refuses when the selection holds every editor.
  const deleting = [
    ...((context.deletingUserIds as User['id'][] | undefined) ?? []),
    id as User['id'],
  ]
  context.deletingUserIds = deleting
  const user = (await req.payload.findByID({
    collection: 'users',
    depth: 0,
    id,
    overrideAccess: true,
    req,
  })) as User
  if (
    user.role === 'editor' &&
    (await otherEditors(req, context.deletingUserIds as User['id'][])) === 0
  ) {
    throw new APIError(LAST_EDITOR, 400)
  }
}
