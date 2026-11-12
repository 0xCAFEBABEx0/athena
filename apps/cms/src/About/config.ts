import type { GlobalConfig } from 'payload'
import {
  BlockquoteFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  OrderedListFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { revalidateAbout } from './hooks/revalidateAbout'

/**
 * Master's profile, shown on /about: a greeting, a short lead, an optional
 * portrait and the longer story as rich text. The page stays hidden (404)
 * until the lead or the story has text. Links come from Site → Social links.
 */
export const About: GlobalConfig = {
  slug: 'about',
  label: 'About',
  access: {
    read: () => true,
  },
  admin: {
    description:
      'Your profile on /about. Add an /about link to the Header nav to show the page in the menu. The links at the end of the page are Site → Social links.',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      localized: true,
      admin: {
        placeholder: 'Hi, I’m …',
        description: 'Page heading. Empty = “About”.',
      },
    },
    {
      name: 'lead',
      type: 'textarea',
      localized: true,
      admin: {
        description:
          'Two or three sentences under the heading: who you are and what you build. Also the page’s search-result snippet.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'portrait',
          type: 'upload',
          relationTo: 'media',
          admin: {
            width: '50%',
            description: 'Optional photo or drawing beside the lead. Its Alt text is read aloud.',
          },
        },
        {
          name: 'portraitCaption',
          type: 'text',
          localized: true,
          admin: { width: '50%', placeholder: 'Tokyo, November 2026' },
        },
      ],
    },
    {
      name: 'body',
      type: 'richText',
      localized: true,
      label: 'Story',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => [
          ...rootFeatures,
          HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
          UnorderedListFeature(),
          OrderedListFeature(),
          BlockquoteFeature(),
          HorizontalRuleFeature(),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
        ],
      }),
      admin: {
        description:
          'The longer story: background, what you work on now, what you are looking for. Use H2 headings for sections (e.g. Background, Now).',
      },
    },
  ],
  hooks: {
    afterChange: [revalidateAbout],
  },
}
