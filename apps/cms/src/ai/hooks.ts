import { after } from 'next/server'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  Payload,
  PayloadRequest,
} from 'payload'

import { invalidateWebAiResults } from '@/utilities/invalidateWeb'

import { indexDoc, removeDoc } from './indexer'
import { type DocKind, isMissingTable } from './store'

/**
 * Run `task` once the save is committed, like invalidateWeb: inside a request
 * (the admin, REST, and Payload jobs, which run in /api/payload-jobs/run)
 * Next's `after()` defers it until the response is sent (Payload has
 * committed by then, so a fresh read sees the change). Outside a request (a
 * script) `after()` throws: the task runs right away only when the save has
 * no transaction to wait for.
 *
 * When the task changed any row, the web app's cached AI results are expired
 * afterwards: the publish's own invalidation ran before the index caught up.
 *
 * Never throws: indexing must not break a publish. A missed update is picked
 * up by the next save of that document or by POST /api/ai/reindex.
 */
const defer = (
  payload: Payload,
  label: string,
  task: (req?: PayloadRequest) => Promise<{ changed: number } | null>,
  req: PayloadRequest,
) => {
  const run = async (inline?: PayloadRequest) => {
    try {
      const result = await task(inline)
      if (result) payload.logger.info({ msg: `AI index: ${label}`, result })
      if (result && result.changed > 0) await invalidateWebAiResults(payload)
    } catch (error) {
      if (isMissingTable(error)) {
        payload.logger.warn(
          'AI index skipped: table ai.chunks does not exist (run the SQL in docs/AI_SEARCH.md)',
        )
      } else {
        payload.logger.error({ err: error, msg: `AI index failed: ${label}` })
      }
    }
  }
  try {
    after(() => run())
    return Promise.resolve()
  } catch {
    // Outside a request (a script). Inside the save's transaction the index
    // write (its own connection) could commit while the save rolls back, so
    // it is skipped; POST /api/ai/reindex, or the next save, catches up.
    if (req.transactionID) {
      payload.logger.warn(`AI index skipped outside a request: ${label} (POST /api/ai/reindex to catch up)`)
      return Promise.resolve()
    }
    return run(req)
  }
}

type Saved = { id: string | number; _status?: string | null }

/**
 * After a document is saved, re-embed what changed. For notes and pages
 * (drafts on), only a save that is or was published changes what the public
 * reads; draft saves and autosaves (every two seconds while editing) are
 * skipped. Builds have no drafts: every save counts, and the GitHub sync's
 * saves cost one SELECT per excerpt unless the text changed.
 */
export const indexAfterChange =
  (kind: Exclude<DocKind, 'about' | 'stack'>): CollectionAfterChangeHook<Saved> =>
  async ({ doc, previousDoc, req }) => {
    if (req.context.skipAiIndex) return doc
    if (req.query?.autosave === 'true') return doc
    if (kind !== 'project') {
      const touchesPublished = doc._status === 'published' || previousDoc?._status === 'published'
      if (!touchesPublished) return doc
    }
    await defer(
      req.payload,
      `${kind} ${doc.id}`,
      (inline) => indexDoc(req.payload, kind, doc.id, inline, { untilBuilt: true }),
      req,
    )
    return doc
  }

export const removeAfterDelete =
  (kind: Exclude<DocKind, 'about' | 'stack'>): CollectionAfterDeleteHook<Saved> =>
  async ({ doc, req }) => {
    if (req.context.skipAiIndex) return doc
    await defer(
      req.payload,
      `delete ${kind} ${doc.id}`,
      async () => ({ removed: true, changed: await removeDoc(req.payload, kind, doc.id) }),
      req,
    )
    return doc
  }

/** /about and /stacks: one document each, re-read on every save. */
export const indexGlobalAfterChange =
  (kind: 'about' | 'stack'): GlobalAfterChangeHook =>
  async ({ doc, req }) => {
    if (req.context.skipAiIndex) return doc
    await defer(
      req.payload,
      kind,
      (inline) => indexDoc(req.payload, kind, kind, inline, { untilBuilt: true }),
      req,
    )
    return doc
  }
