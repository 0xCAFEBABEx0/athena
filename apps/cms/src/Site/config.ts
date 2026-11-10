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
    description: 'Name, intro, links and projects shown on the public site (whoa.me).',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'siteName',
          type: 'text',
          required: true,
          defaultValue: 'whoa.me',
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
      name: 'defaultView',
      type: 'select',
      required: true,
      defaultValue: 'cli',
      options: [
        { label: 'CLI (terminal)', value: 'cli' },
        { label: 'ADE (agent app)', value: 'modern' },
      ],
      admin: {
        description:
          'Look that first-time visitors see. Visitors can switch with the CLI / ADE control; their choice is remembered in their browser.',
      },
    },
    {
      name: 'welcome',
      type: 'text',
      defaultValue: 'Welcome to whoa.me',
      localized: true,
      admin: { description: 'Small line at the top of the home-page intro box.' },
    },
    {
      name: 'intro',
      type: 'textarea',
      localized: true,
      admin: { description: 'One or two sentences under your name on the home page.' },
    },
    {
      name: 'tagline',
      type: 'text',
      localized: true,
      admin: {
        description:
          'Home page title after the site name ("whoa.me — <tagline>"), shown in browser tabs and search results. Keep the whole title under about 60 characters. Empty = the site name only.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      admin: {
        description:
          'Home page meta description (search-result snippet, about 155 characters), also used by pages without their own and the RSS feed. Empty = the intro, then the welcome line.',
      },
    },
    {
      name: 'ogImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'Default share image (1200 × 630) for pages without their own. Empty = the built-in image with Hoo.',
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
        { name: 'description', type: 'text', localized: true },
      ],
    },
    {
      name: 'banner',
      type: 'group',
      label: 'CLI banner',
      admin: {
        description:
          'Home-page welcome box in the CLI view. Hoo, the owl, sits on the left; clicking it wakes it up and it says one of the tips.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'style',
              type: 'select',
              defaultValue: 'fetch',
              options: [
                { label: 'Owl + details', value: 'fetch' },
                { label: 'Off (plain intro box)', value: 'off' },
              ],
              admin: { width: '50%' },
            },
            {
              name: 'mascot',
              type: 'checkbox',
              label: 'Show Hoo (the owl)',
              defaultValue: true,
              admin: { width: '50%', style: { alignSelf: 'flex-end' } },
            },
          ],
        },
        {
          name: 'tips',
          type: 'array',
          maxRows: 12,
          labels: { singular: 'Tip', plural: 'Tips' },
          admin: {
            initCollapsed: true,
            description:
              'What Hoo says when woken, one per click in this order. Empty: the built-in greeting and keyboard tips.',
          },
          fields: [{ name: 'text', type: 'text', required: true, localized: true }],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateSite],
  },
}
