import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
  Where,
} from 'payload'

import { CACHE_TAGS } from '@athena/shared/constants'

import { authenticated } from '../../access/authenticated'
import { fetchRepos, isRepoName } from '../../github/sync'
import { translateUIField } from '../../translation/translate'
import { invalidateWeb } from '../../utilities/invalidateWeb'

/**
 * Portfolio entries shown on the public site at /work, one per GitHub
 * repository. Only repositories added here appear (nothing is imported
 * automatically), and "Hidden" takes one off the site without deleting it.
 *
 * The editor writes the brief / write-up; the `github` snapshot is filled on
 * save and refreshed by the `syncGitHub` job (see src/github/sync.ts).
 */

const slugOf = (repo: string): string =>
  (repo.split('/').pop() ?? repo)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')

const fillFromGitHub: CollectionBeforeChangeHook = async ({ data, originalDoc, req, context }) => {
  if (typeof data.repo === 'string')
    data.repo = data.repo.trim().replace(/^https:\/\/github\.com\//, '')
  if (typeof data.repo === 'string' && isRepoName(data.repo)) data.slug = slugOf(data.repo)
  if (context.skipGitHubFetch) return data

  // Fetch right away when the entry is new or points at another repository,
  // so the page is complete on first publish instead of after the next sync.
  const repoChanged = !originalDoc || originalDoc.repo !== data.repo
  if (!repoChanged && originalDoc?.github) return data
  if (!isRepoName(data.repo)) return data

  try {
    const result = (await fetchRepos([data.repo])).get(data.repo)
    if (result?.ok) {
      data.github = result.snapshot
      data.syncError = null
      data.syncedAt = new Date().toISOString()
      // Start from GitHub's description (English) so Translate has text.
      if (!data.description && result.snapshot.description && req.locale === 'en') {
        data.description = result.snapshot.description
      }
    } else if (result) {
      data.syncError = result.error
    }
  } catch (error) {
    req.payload.logger.error({ err: error, msg: `GitHub fetch for ${data.repo} failed` })
    data.syncError = 'GitHub request failed. The next sync will retry.'
  }
  return data
}

const revalidateProject: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (req.context.disableRevalidate) return doc
  const paths = ['/', '/work', `/work/${doc.slug}`]
  if (previousDoc?.slug && previousDoc.slug !== doc.slug) paths.push(`/work/${previousDoc.slug}`)
  await invalidateWeb({ paths, tags: [CACHE_TAGS.projects], payload: req.payload })
  return doc
}

const revalidateProjectDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (req.context.disableRevalidate) return doc
  await invalidateWeb({
    paths: ['/', '/work', `/work/${doc?.slug}`],
    tags: [CACHE_TAGS.projects],
    payload: req.payload,
  })
  return doc
}

export const Projects: CollectionConfig<'projects'> = {
  slug: 'projects',
  labels: { singular: 'Work', plural: 'Work' },
  access: {
    create: authenticated,
    delete: authenticated,
    update: authenticated,
    // Visitors (the web app) never see hidden entries.
    read: ({ req: { user } }): boolean | Where => (user ? true : { hidden: { not_equals: true } }),
  },
  defaultSort: 'order',
  admin: {
    useAsTitle: 'repo',
    defaultColumns: ['repo', 'status', 'pinned', 'hidden', 'order', 'syncedAt'],
    description:
      'Repositories shown at /work. Only entries added here appear; tick Hidden to take one off the site.',
  },
  fields: [
    {
      name: 'repo',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description:
          'GitHub repository as owner/name, e.g. 0xCAFEBABEx0/athena. Public repositories only.',
      },
      validate: (value: unknown) =>
        isRepoName(
          typeof value === 'string' ? value.trim().replace(/^https:\/\/github\.com\//, '') : value,
        ) || 'Use the form owner/name.',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'title',
          type: 'text',
          admin: { width: '50%', description: 'Display name. Defaults to the repository name.' },
        },
        {
          name: 'liveUrl',
          type: 'text',
          admin: { width: '50%', description: 'Live site. Defaults to the repository homepage.' },
        },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'One line for the list. Filled from GitHub on first save; edit freely.',
      },
    },
    {
      name: 'brief',
      type: 'textarea',
      localized: true,
      admin: {
        description:
          'What you set out to build, in your words. Shown as your message at the top of the thread.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      localized: true,
      admin: { description: 'A short write-up of what it does and how. Shown as the reply.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          defaultValue: 'auto',
          required: true,
          options: [
            { label: 'Auto (from GitHub activity)', value: 'auto' },
            { label: 'Working', value: 'working' },
            { label: 'Idle', value: 'idle' },
            { label: 'Done', value: 'done' },
          ],
          admin: {
            width: '50%',
            description: 'Auto: pushed in the last 30 days = Working, archived = Done, else Idle.',
          },
        },
        {
          name: 'order',
          type: 'number',
          defaultValue: 0,
          admin: { width: '50%', description: 'Lower comes first among the pinned entries.' },
        },
      ],
    },
    {
      name: 'pinned',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Show on the home page.' },
    },
    {
      name: 'hidden',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Keep the entry but take it off the site.' },
    },
    {
      name: 'slug',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'URL: /work/<slug>, from the repository name.',
      },
    },
    translateUIField,
    {
      name: 'syncedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Last time GitHub data changed. Refreshed every 6 hours.',
      },
    },
    {
      name: 'syncError',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true, condition: (data) => Boolean(data?.syncError) },
    },
    {
      name: 'github',
      type: 'json',
      admin: { readOnly: true, description: 'Snapshot from GitHub (read-only).' },
    },
  ],
  hooks: {
    beforeChange: [fillFromGitHub],
    afterChange: [revalidateProject],
    afterDelete: [revalidateProjectDelete],
  },
}
