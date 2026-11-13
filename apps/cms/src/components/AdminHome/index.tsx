import type { ServerProps } from 'payload'
import type React from 'react'
import { publishState, thumbnailURL } from '@/utilities/adminFormat'
import { getWebURL } from '@/utilities/getURL'
import '@/admin-ui/index.css'

/**
 * Dashboard top (admin.components.beforeDashboard): post counts and the
 * latest notes, Ghost-style, built with daisyUI. Uses only the Local API and
 * plain links, so it carries over to Payload 4 unchanged.
 */
export const AdminHome: React.FC<ServerProps> = async ({ payload, user }) => {
  const [recent, drafts, published, builds] = await Promise.all([
    payload.find({ collection: 'posts', draft: true, limit: 5, sort: '-updatedAt', depth: 1 }),
    // Counted like the linked lists (latest drafts), so a published note with a
    // newer draft is a draft in both; count() would read the published table.
    payload.find({ collection: 'posts', draft: true, limit: 1, depth: 0, where: { _status: { equals: 'draft' } } }),
    payload.find({ collection: 'posts', draft: true, limit: 1, depth: 0, where: { _status: { equals: 'published' } } }),
    payload.count({ collection: 'projects' }),
  ])
  const web = getWebURL() || 'http://localhost:4321'
  const name = (user as { name?: string | null } | null)?.name || 'there'
  const posts = '/admin/collections/posts'
  const stats = [
    { label: 'Drafts', value: drafts.totalDocs, href: `${posts}?where[_status][equals]=draft`, accent: true },
    { label: 'Published', value: published.totalDocs, href: `${posts}?where[_status][equals]=published` },
    { label: 'Builds', value: builds.totalDocs, href: '/admin/collections/projects' },
  ]

  return (
    <section className="whoa-ui tw:mb-12 tw:grid tw:gap-8">
      <header className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <h2 className="tw:m-0 tw:mr-auto tw:text-2xl tw:font-semibold tw:tracking-tight">Hi {name}</h2>
        <a className="tw:btn tw:btn-ghost tw:rounded-full tw:no-underline" href={web} rel="noopener noreferrer" target="_blank">
          View site ↗
        </a>
        <a className="tw:btn tw:btn-neutral tw:rounded-full tw:no-underline" href={`${posts}/create`}>
          + New note
        </a>
      </header>

      <div className="tw:stats tw:stats-horizontal tw:w-full tw:border tw:border-base-300">
        {stats.map((s) => (
          <a className="tw:stat tw:text-inherit tw:no-underline tw:hover:bg-base-200" href={s.href} key={s.label}>
            <div className="tw:stat-title tw:text-xs">{s.label}</div>
            <div className={`tw:stat-value tw:text-2xl ${s.accent && s.value > 0 ? 'tw:text-primary' : ''}`}>{s.value}</div>
          </a>
        ))}
      </div>

      <div className="tw:grid tw:gap-2">
        <h3 className="tw:m-0 tw:text-sm tw:font-medium tw:opacity-60">Recent notes</h3>
        {recent.docs.length === 0 ? (
          <p className="tw:m-0 tw:opacity-70">No notes yet. Start one with New note.</p>
        ) : (
          <ul className="tw:list tw:m-0 tw:p-0 tw:border-t tw:border-base-300">
            {recent.docs.map((doc) => {
              const thumb = thumbnailURL(doc.heroImage)
              const state = publishState(doc._status)
              const authors = doc.populatedAuthors?.map((a) => a.name).filter(Boolean).join(', ')
              return (
                <li className="tw:list-row tw:items-center tw:rounded-none tw:border-b tw:border-base-300 tw:px-1" key={doc.id}>
                  {/* Like Ghost: no hero image, no box; the title moves to the left edge. */}
                  {thumb ? (
                    <div className="tw:w-20 tw:aspect-[16/10] tw:rounded-field tw:bg-base-200 tw:overflow-hidden">
                      {/* biome-ignore lint/performance/noImgElement: tiny admin thumbnail; next/image adds nothing here */}
                      <img alt="" className="tw:size-full tw:object-cover" src={thumb} />
                    </div>
                  ) : null}
                  <a className="tw:grid tw:gap-0.5 tw:text-inherit tw:no-underline" href={`${posts}/${doc.id}`}>
                    <span className="tw:text-[15px] tw:font-semibold tw:leading-snug">{doc.title}</span>
                    <span className="tw:text-xs tw:opacity-60">
                      {authors ? `${authors} · ` : ''}
                      {new Date(doc.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className={`tw:text-xs tw:font-medium ${state === 'draft' ? 'tw:text-primary' : 'tw:opacity-60'}`}>
                      {state === 'draft' ? 'Draft' : 'Published'}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default AdminHome
