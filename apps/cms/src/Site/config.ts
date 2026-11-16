import type { GlobalConfig } from 'payload'

import { fillContributions, isGitHubLogin } from '@/github/contributions'
import { normalizeXUrl } from '@/x/oembed'
import { fillXPicks } from './hooks/fillXPicks'
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
    description:
      'Name, intro, links, projects, X picks and the GitHub graph shown on the public site (whoa.me).',
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
      name: 'picks',
      type: 'array',
      label: 'Picks from X',
      maxRows: 6,
      labels: { singular: 'Pick', plural: 'Picks' },
      admin: {
        initCollapsed: true,
        description:
          'Posts on X shown as cards on the home page, in this order. Paste the link and save: text, author and date are read from X. Clear Text and save to read it again. Nothing is loaded from X when visitors open the page.',
      },
      fields: [
        {
          name: 'url',
          type: 'text',
          required: true,
          label: 'Link to the post',
          admin: { placeholder: 'https://x.com/<user>/status/<id>' },
          validate: (value: string | null | undefined) =>
            normalizeXUrl(value)
              ? true
              : 'Paste a link to a post on x.com or twitter.com (…/status/<id>).',
        },
        {
          name: 'note',
          type: 'text',
          localized: true,
          admin: { description: 'Optional: why you picked it, shown under the post.' },
        },
        {
          name: 'text',
          type: 'textarea',
          admin: { description: 'Filled from X on save. Edit to shorten or fix it.' },
        },
        {
          type: 'row',
          fields: [
            { name: 'authorName', type: 'text', admin: { width: '35%' } },
            {
              name: 'authorHandle',
              type: 'text',
              label: 'Handle',
              admin: { width: '25%', description: 'Without @' },
            },
            {
              name: 'postedAt',
              type: 'date',
              label: 'Posted',
              admin: { width: '25%', date: { pickerAppearance: 'dayOnly' } },
            },
            {
              name: 'lang',
              type: 'text',
              label: 'Language',
              admin: { width: '15%', description: 'e.g. en, ja' },
            },
          ],
        },
      ],
    },
    {
      name: 'github',
      type: 'group',
      label: 'GitHub contributions',
      admin: {
        description:
          'The contribution graph on the home page. Enter a GitHub username and save: the last year is read from GitHub now and every 6 hours after. Leave it empty to hide the graph.',
      },
      fields: [
        {
          name: 'username',
          type: 'text',
          label: 'GitHub username',
          admin: { placeholder: 'octocat' },
          validate: (value: string | null | undefined) =>
            !value?.trim() || isGitHubLogin(value.trim())
              ? true
              : 'Enter a GitHub username (letters, digits and hyphens), without @ or a link.',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'syncedAt',
              type: 'date',
              label: 'Read from GitHub',
              admin: {
                width: '35%',
                readOnly: true,
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'syncError',
              type: 'text',
              label: 'Last error',
              admin: { width: '65%', readOnly: true },
            },
          ],
        },
        {
          // Filled by the CMS; the web app draws the graph from it.
          name: 'contributions',
          type: 'json',
          admin: { hidden: true },
        },
      ],
    },
    {
      name: 'aiModel',
      type: 'select',
      label: 'AI search: answer model',
      defaultValue: 'claude-opus-5-5',
      options: [
        { label: 'Claude Opus 5.5 (best answers, ~$0.03 each)', value: 'claude-opus-5-5' },
        { label: 'Claude Sonnet 5.5 (~$0.015 each)', value: 'claude-sonnet-5-5' },
        { label: 'Claude Haiku 5.5 (cheapest, ~$0.001 each)', value: 'claude-haiku-5-5' },
      ],
      admin: {
        description:
          'Writes the answers under "Ask AI" on /search. Takes effect on save, no deploy. Answers kept from another model are written again on their next ask.',
      },
    },
    {
      name: 'aiPresets',
      type: 'array',
      localized: true,
      maxRows: 6,
      label: 'AI search: suggested questions',
      labels: { singular: 'Question', plural: 'Questions' },
      admin: {
        initCollapsed: true,
        description:
          'Offered under "Ask AI" on /search, in this language. Each answer is written once and kept until the notes it cites change. Empty: no suggestions.',
      },
      fields: [{ name: 'question', type: 'text', required: true, maxLength: 120 }],
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
    beforeChange: [fillXPicks(), fillContributions()],
    afterChange: [revalidateSite],
  },
}
