import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const generateVercelBlobURL = (filename: string): string | undefined => {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return undefined
  const match = token.match(/^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i)
  if (!match) return undefined
  const storeId = match[1].toLowerCase()
  return `https://${storeId}.public.blob.vercel-storage.com/${filename}`
}

export const Media: CollectionConfig = {
  slug: 'media',
  hooks: {
    afterRead: [
      ({ doc }) => {
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          if (doc.filename) {
            const url = generateVercelBlobURL(doc.filename)
            if (url) doc.url = url
          }
          if (doc.sizes) {
            Object.values(doc.sizes).forEach((size: any) => {
              if (size.filename) {
                const url = generateVercelBlobURL(size.filename)
                if (url) size.url = url
              }
            })
          }
        }
        return doc
      },
    ],
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      //required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  upload: {
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    staticDir: process.env.BLOB_READ_WRITE_TOKEN ? undefined : path.resolve(dirname, '../../public/media'),
    disableLocalStorage: !!process.env.BLOB_READ_WRITE_TOKEN,
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
      },
      {
        name: 'square',
        width: 500,
        height: 500,
      },
      {
        name: 'small',
        width: 600,
      },
      {
        name: 'medium',
        width: 900,
      },
      {
        name: 'large',
        width: 1400,
      },
      {
        name: 'xlarge',
        width: 1920,
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        crop: 'center',
      },
    ],
  },
}
