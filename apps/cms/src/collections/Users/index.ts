import type { CollectionConfig } from 'payload'

import { isEditor } from '@/access/isEditor'

import { canDeleteUser, keepAnEditor, keepAnEditorOnDelete } from './keepAnEditor'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: isEditor,
    create: isEditor,
    delete: canDeleteUser,
    read: isEditor,
    unlock: isEditor,
    update: isEditor,
  },
  admin: {
    defaultColumns: ['name', 'email', 'role'],
    useAsTitle: 'name',
  },
  // API keys enable the Astro web app's service account ("web-frontend"
  // user) to fetch draft content over REST for preview rendering. It has the
  // `service` role, so its key can read drafts but not log in to the admin
  // or change anything.
  auth: {
    useAPIKey: true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: 'Editor', value: 'editor' },
        { label: 'Service (read-only API key)', value: 'service' },
      ],
      saveToJWT: true,
      admin: {
        position: 'sidebar',
        description: 'Editors manage the site. Service accounts can only read, drafts included.',
      },
    },
  ],
  hooks: {
    beforeChange: [keepAnEditor],
    beforeDelete: [keepAnEditorOnDelete],
  },
  timestamps: true,
}
