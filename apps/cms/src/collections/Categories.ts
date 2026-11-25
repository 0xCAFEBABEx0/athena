import type { CollectionConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { isEditor } from '@/access/isEditor'
import { slugField } from '@/fields/slug'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: isEditor,
    delete: isEditor,
    read: anyone,
    update: isEditor,
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      localized: true,
      required: true,
    },
    ...slugField(),
  ],
}
