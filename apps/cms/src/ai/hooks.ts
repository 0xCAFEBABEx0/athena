import { after } from 'next/server'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload, PayloadRequest } from 'payload'

import type { Post } from '@/payload-types'
import { indexPost, removePost } from './indexer'
import { isMissingTable } from './store'

/**
 * Run `task` once the save is committed, like invalidateWeb: inside a request
 * Next's `after()` defers it until the response is sent (Payload has
 * committed by then, so a fresh read sees the change). Outside a request
 * (jobs, scripts) `after()` throws, and the task runs right away inside the
 * same transaction, so it is given `req`.
 *
 * Never throws: indexing must not break a publish. A missed update is picked
 * up by the next publish of that post or by POST /api/ai/reindex.
 */
const defer = (payload: Payload, label: string, task: (req?: PayloadRequest) => Promise<unknown>, req: PayloadRequest) => {
  const run = async (inline?: PayloadRequest) => {
    try {
      const result = await task(inline)
      if (result) payload.logger.info({ msg: `AI index: ${label}`, result })
    } catch (error) {
      if (isMissingTable(error)) {
        payload.logger.warn('AI index skipped: table ai.post_chunks does not exist (run the SQL in docs/AI_SEARCH.md)')
      } else {
        payload.logger.error({ err: error, msg: `AI index failed: ${label}` })
      }
    }
  }
  try {
    after(() => run())
    return Promise.resolve()
  } catch {
    return run(req)
  }
}

/**
 * After a post is published, unpublished or republished, re-embed what
 * changed. Draft saves and autosaves never change what the public reads, so
 * they are skipped (autosave runs every two seconds while editing).
 */
export const indexPostAfterChange: CollectionAfterChangeHook<Post> = async ({ doc, previousDoc, req }) => {
  if (req.context.skipAiIndex) return doc
  if (req.query?.autosave === 'true') return doc
  const touchesPublished = doc._status === 'published' || previousDoc?._status === 'published'
  if (!touchesPublished) return doc
  await defer(req.payload, `post ${doc.id}`, (inline) => indexPost(req.payload, doc.id, inline), req)
  return doc
}

export const removePostAfterDelete: CollectionAfterDeleteHook<Post> = async ({ doc, req }) => {
  if (req.context.skipAiIndex) return doc
  await defer(req.payload, `delete post ${doc.id}`, () => removePost(req.payload, doc.id).then(() => 'removed'), req)
  return doc
}
