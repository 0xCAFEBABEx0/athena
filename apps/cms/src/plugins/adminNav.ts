import type { Plugin } from 'payload'

/**
 * Sorts every collection and global into the admin sidebar groups, including
 * the ones other plugins add (forms, redirects, search). Run it last in the
 * plugins list. Uses only admin.group, which Payload 3 and 4 both support.
 */
const GROUPS: Record<string, string> = {
  posts: 'Content',
  pages: 'Content',
  projects: 'Content',
  media: 'Content',
  categories: 'Content',
  site: 'Site',
  stack: 'Site',
  about: 'Site',
  header: 'Site',
  footer: 'Site',
  forms: 'Forms',
  'form-submissions': 'Forms',
  users: 'System',
  redirects: 'System',
  search: 'System',
}

export const adminNav: Plugin = (config) => ({
  ...config,
  collections: config.collections?.map((c) =>
    GROUPS[c.slug] ? { ...c, admin: { ...c.admin, group: GROUPS[c.slug] } } : c,
  ),
  globals: config.globals?.map((g) =>
    GROUPS[g.slug] ? { ...g, admin: { ...g.admin, group: GROUPS[g.slug] } } : g,
  ),
})
