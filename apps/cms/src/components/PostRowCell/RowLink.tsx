'use client'

import { useListDrawerContext } from '@payloadcms/ui'
import type { CollectionSlug } from 'payload'
import type React from 'react'

/**
 * The row's link. Inside a list drawer (choosing a post for a relationship
 * field such as Related posts) a click selects the post, as Payload's own
 * default cell does, instead of opening its editor.
 */
export const RowLink: React.FC<{
  children: React.ReactNode
  className: string
  collectionSlug: CollectionSlug
  href: string
  rowData: Record<string, unknown>
}> = ({ children, className, collectionSlug, href, rowData }) => {
  const { drawerSlug, onSelect } = useListDrawerContext()
  if (drawerSlug && typeof onSelect === 'function') {
    return (
      <button
        className={`${className} tw:w-full tw:cursor-pointer tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:font-[inherit]`}
        // Payload's default cell passes rowData.id as is (a number on Postgres) despite the string type.
        onClick={() => onSelect({ collectionSlug, doc: rowData, docID: rowData.id as string })}
        type="button"
      >
        {children}
      </button>
    )
  }
  return (
    <a className={className} href={href}>
      {children}
    </a>
  )
}
