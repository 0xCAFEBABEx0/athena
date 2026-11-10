import type { GlobalConfig } from 'payload'

import { revalidateSite } from './hooks/revalidateSite'

/**
 * Site-wide profile and copy rendered by the web frontend: site name, the
 * home-page intro, social links and the projects list.
 */
export const Site: GlobalConfig = {
  slug: 'site',
  label: 'Site',
  access: {
    read: () => true,
  },
  admin: {
    description: 'Name, intro, links and projects shown on the public site (www.findb.uk).',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'siteName',
          type: 'text',
          required: true,
          defaultValue: 'findb.uk',
          admin: { description: 'Header, page titles and RSS feed title.', width: '50%' },
        },
        {
          name: 'authorName',
          type: 'text',
          admin: { description: 'Home-page heading and copyright line.', width: '50%' },
        },
      ],
    },
    {
      name: 'welcome',
      type: 'text',
      defaultValue: 'findb.uk へようこそ',
      admin: { description: 'Small line at the top of the home-page intro box.' },
    },
    {
      name: 'intro',
      type: 'textarea',
      admin: { description: 'One or two sentences under your name on the home page.' },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Default meta description for pages without their own (home, post list, RSS).',
      },
    },
    {
      name: 'socialLinks',
      type: 'array',
      maxRows: 8,
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', required: true, admin: { width: '30%' } },
            { name: 'url', type: 'text', required: true, admin: { width: '70%' } },
          ],
        },
      ],
    },
    {
      name: 'projects',
      type: 'array',
      maxRows: 12,
      admin: { initCollapsed: true, description: 'Things you built, one line each.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true, admin: { width: '30%' } },
            { name: 'url', type: 'text', admin: { width: '70%' } },
          ],
        },
        { name: 'description', type: 'text' },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateSite],
  },
}
