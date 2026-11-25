import type { AccessArgs } from 'payload'

import type { User } from '@/payload-types'

/**
 * People who edit the site. The `service` role (the web app's `web-frontend`
 * API key) may only read, so a leaked key cannot change content or users.
 */
export const isEditorUser = (user: Pick<User, 'role'> | null | undefined): boolean =>
  user?.role === 'editor'

export const isEditor = ({ req: { user } }: AccessArgs<User>): boolean => isEditorUser(user)
