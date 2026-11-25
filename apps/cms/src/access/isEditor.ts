import type { AccessArgs, SanitizedConfig } from 'payload'

import type { User } from '@/payload-types'

/**
 * People who edit the site. The `service` role (the web app's `web-frontend`
 * API key) may only read, so a leaked key cannot change content or users.
 */
export const isEditorUser = (user: Pick<User, 'role'> | null | undefined): boolean =>
  user?.role === 'editor'

export const isEditor = ({ req: { user } }: AccessArgs<User>): boolean => isEditorUser(user)

/**
 * Payload adds its document locks and the scheduler's stats global while it
 * sanitizes the config (after plugins), writable by any logged-in user.
 * Lock reads stay open: `includeLockStatus` reads them with the caller's access.
 */
export const restrictPayloadInternals = (config: SanitizedConfig): SanitizedConfig => {
  const locks = config.collections.find(({ slug }) => slug === 'payload-locked-documents')
  if (locks) Object.assign(locks.access, { create: isEditor, delete: isEditor, update: isEditor })

  const jobStats = config.globals.find(({ slug }) => slug === 'payload-jobs-stats')
  if (jobStats) Object.assign(jobStats.access, { read: isEditor, update: isEditor })

  return config
}
