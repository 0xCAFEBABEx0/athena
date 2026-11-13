import type { DefaultServerCellComponentProps } from 'payload'
import type React from 'react'
import { publishState, thumbnailURL, timeAgo } from '@/utilities/adminFormat'
import '@/admin-ui/index.css'

/**
 * Title cell for the Notes list (field admin.components.Cell, a public API in
 * Payload 3 and 4): thumbnail, title, byline and Draft/Published in one row,
 * like Ghost's post list. A custom cell renders its own link to the document.
 */
export const PostRowCell: React.FC<DefaultServerCellComponentProps> = async ({
  cellData,
  collectionSlug,
  payload,
  rowData,
}) => {
  const doc = rowData as Record<string, unknown>
  let thumb: string | undefined
  if (doc.heroImage) {
    const media =
      typeof doc.heroImage === 'object'
        ? doc.heroImage
        : await payload
            .findByID({ collection: 'media', id: doc.heroImage as number, depth: 0 })
            .catch(() => undefined)
    thumb = thumbnailURL(media)
  }
  const authors = ((doc.populatedAuthors as { name?: string | null }[] | undefined) ?? [])
    .map((a) => a.name)
    .filter(Boolean)
  const state = publishState(doc._status)

  return (
    <a
      className="whoa-ui tw:grid tw:grid-cols-[64px_minmax(0,1fr)] tw:md:grid-cols-[100px_minmax(0,1fr)] tw:items-center tw:gap-3 tw:md:gap-4 tw:min-w-0 tw:text-inherit tw:no-underline"
      href={`/admin/collections/${collectionSlug}/${doc.id}`}
    >
      <span className="tw:block tw:aspect-[16/10] tw:rounded-field tw:bg-base-200 tw:overflow-hidden">
        {thumb ? (
                      // biome-ignore lint/performance/noImgElement: tiny admin thumbnail; next/image adds nothing here
                      <img alt="" className="tw:block tw:size-full tw:object-cover" src={thumb} />
                    ) : null}
      </span>
      <span className="tw:grid tw:gap-0.5 tw:min-w-0">
        <span className="tw:text-sm tw:md:text-[15px] tw:font-semibold tw:leading-snug tw:whitespace-normal">
          {String(cellData || 'Untitled')}
        </span>
        <span className="tw:text-[13px] tw:opacity-60">
          {authors.length ? `By ${authors.join(', ')} · ` : ''}
          {timeAgo(doc.updatedAt as string)}
        </span>
        <span className={`tw:text-[13px] tw:font-medium ${state === 'draft' ? 'tw:text-primary' : 'tw:opacity-60'}`}>
          {state === 'draft' ? 'Draft' : 'Published'}
        </span>
      </span>
    </a>
  )
}

export default PostRowCell
