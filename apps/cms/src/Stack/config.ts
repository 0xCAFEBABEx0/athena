import type { GlobalConfig } from 'payload'

import { fillStackIcons } from './hooks/fillStackIcons'
import { revalidateStack } from './hooks/revalidateStack'

/**
 * The tools Master builds with, shown on /stacks: groups of items, each with a
 * one-line note, an optional link, year and status, and the site's favicon
 * (fetched on save, see ./favicon.ts). The page stays hidden (404) until at
 * least one item exists.
 */
export const Stack: GlobalConfig = {
  slug: 'stack',
  label: 'Stack',
  access: {
    read: () => true,
  },
  admin: {
    description:
      'Tools shown on /stacks. Add a /stacks link to the Header nav to show the page in the menu.',
  },
  fields: [
    {
      name: 'intro',
      type: 'text',
      localized: true,
      admin: {
        description:
          'One line under the page title, also the page’s search-result snippet. Empty = a built-in line.',
      },
    },
    {
      name: 'groups',
      type: 'array',
      maxRows: 12,
      labels: { singular: 'Group', plural: 'Groups' },
      admin: { initCollapsed: true, description: 'Shown in this order. Drag to reorder.' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              localized: true,
              admin: { width: '35%', placeholder: 'Agents' },
            },
            {
              name: 'description',
              type: 'text',
              localized: true,
              admin: { width: '65%', placeholder: 'Models and agents I work with every day' },
            },
          ],
        },
        {
          name: 'items',
          type: 'array',
          maxRows: 40,
          labels: { singular: 'Tool', plural: 'Tools' },
          admin: { initCollapsed: true },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'name',
                  type: 'text',
                  required: true,
                  admin: { width: '35%', description: 'Product name (not translated).' },
                },
                {
                  name: 'url',
                  type: 'text',
                  admin: {
                    width: '65%',
                    placeholder: 'https://',
                    description: 'Official site. Its favicon is fetched when you save.',
                  },
                  validate: (value: string | null | undefined) =>
                    !value || /^https?:\/\/[^\s]+$/i.test(value.trim())
                      ? true
                      : 'Enter a full link starting with https://',
                },
              ],
            },
            {
              name: 'note',
              type: 'text',
              localized: true,
              admin: { description: 'What you use it for, in one line.' },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'since',
                  type: 'number',
                  min: 1970,
                  max: 2100,
                  admin: { width: '25%', description: 'Year you started (optional).' },
                },
                {
                  name: 'status',
                  type: 'select',
                  required: true,
                  defaultValue: 'current',
                  options: [
                    { label: 'In use', value: 'current' },
                    { label: 'Trying', value: 'trying' },
                    { label: 'Former (folded at the end)', value: 'former' },
                  ],
                  admin: { width: '35%' },
                },
                {
                  name: 'icon',
                  type: 'upload',
                  relationTo: 'media',
                  admin: {
                    width: '40%',
                    description:
                      'Filled from the site’s favicon on save; pick another image to replace it. Initials are shown when the site has no readable icon.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [fillStackIcons()],
    afterChange: [revalidateStack],
  },
}
