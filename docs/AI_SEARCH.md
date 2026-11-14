# AI search

`/search` has two daisyUI tabs under the prompt, **Search** and **Ask AI**
(no tabs without Ask AI). Search does two things:

| Mode | What it does | Runs | Cost per uncached query |
|---|---|---|---|
| Keyword (`?mode` absent) | Filters the post list in the browser (unchanged) | while typing | none |
| By meaning (`?mode=meaning`) | Finds posts whose text is close in meaning to the query, best first, with the closest excerpt under each title | on Enter | 1 embedding request, 1 Neon query |
| Ask AI (`?mode=ask`) | Writes a short answer from the posts' text, with numbered citations that link to the posts | on Enter | the above + 1 Claude request |

So typing never costs anything: results narrow as you type, and Enter asks for
the posts closest in meaning; typing again goes back to the keyword filter.
When no post has the words, the empty line says to press Enter. Keyword
search stays because it is free and instant, finds names and tool names
exactly, and keeps working when the AI side is off.

Elsewhere on the site, the pinned composer and the "/" popup send Enter to
`/search?q=…&mode=meaning` (a hidden `mode` field, only when By meaning is
offered; the popup's Enter still opens a selected result first). With Ask AI
on, both also show an **Ask Hoo** row while you type, which opens the question
in `/search?mode=ask`. The row is never selected by itself (↓ in the composer,
↑↓ in the popup, or a click), so Enter never spends an answer by accident.

By meaning needs only the CMS side (`VOYAGE_API_KEY` and the table), so it
shows on every deployment that has `REVALIDATE_SECRET`. Ask AI shows only when
the web deployment also has `ANTHROPIC_API_KEY`. `AI_SEARCH=off` on athena-web
hides both, and `/search` is the keyword search it was before; `/api/ai/*` then
answer 503. A link with `?mode=` for a mode that is not offered opens Keyword.

## How it works

```
CMS (apps/cms)                                         Web (apps/web)
──────────────                                         ──────────────
Post published/edited ─► afterChange (ai/hooks.ts)     /search?mode=meaning|ask  (ISR page, query read in the browser)
  after the commit (Next after())                        │ POST /api/ai/search  or  /api/ai/ask   (same origin only)
  read the post as a visitor would, per language         ▼
  ─► chunks by heading (~300 tokens, ai/chunk.ts)      pages/api/ai/*.ts
  ─► embed only changed chunks (Voyage)                  │ limits: 10 / visitor / 10 min, AI_DAILY_LIMIT / day
  ─► ai.post_chunks (pgvector, own schema)               │ Runtime Cache: same query since the last CMS change = no CMS call
                                                         ▼
POST /api/ai/search  ◄──────────────── Bearer REVALIDATE_SECRET (+ protection bypass)
  embed the query, nearest excerpts (cosine)             │
  ─► { results: [{ slug, title, heading, content, score }] }
                                                         ├─ meaning: one row per post, best excerpt as snippet
                                                         └─ ask: excerpts as `search_result` blocks ─► Claude
                                                               (citations on, streamed as NDJSON to the page)
```

- **Index** (`apps/cms/src/ai/`): `lexical.ts` turns a post's rich text into
  sections (headings, paragraphs, lists, code, banners); `chunk.ts` packs them
  into chunks that never cross a heading, the meta description first;
  `embeddings.ts` calls Voyage (`voyage-4-lite`, 1024 dimensions; OpenAI's
  `text-embedding-3-small` at 1024 also works); `store.ts` is the only SQL;
  `indexer.ts` keeps the table in step with what the public can read.
- **What is indexed** is what an anonymous visitor can read: each post is
  read through the Local API with `overrideAccess: false`, once per language
  (en, ja, zh) with the usual English fallback. A draft, a scheduled post or
  an unpublished one is not in the index. A chunk's vector is reused when the
  same text was already embedded (an untranslated post's ja and zh rows reuse
  the English vectors), so a republish with no text change embeds nothing.
- **When it updates**: the Posts `afterChange` hook runs after the response
  (and the transaction) with Next's `after()`, for a save that publishes,
  edits a published post, or unpublishes one. Autosaves of drafts are skipped.
  Deleting a post removes its rows. A failure is logged and never fails the
  save.
- **First run**: the index starts empty. The first search on a deployment
  whose index is empty answers `building: true` and indexes every public post
  in the background; the page says the notes are being indexed (not cached),
  and a search a minute later finds them. To rebuild by hand, a logged-in
  admin can `POST /api/ai/reindex` on the CMS (same cookie as the admin).
- **Search** (`POST ${CMS_URL}/api/ai/search`, `{ q, locale, limit }`): embeds
  the query (`input_type: query`) and returns the nearest excerpts in that
  language, exact cosine scan (no ANN index; fine for a few thousand chunks).
  Only the web server (Bearer `REVALIDATE_SECRET`) or a logged-in user may call
  it; it is a CMS route like `/api/translate`, so athena-cms Deployment
  Protection applies too.
- **Answers** (`apps/web/src/lib/ai-answer.ts`): the excerpts close to the
  question (`relevantChunks`) go to Claude as `search_result` blocks with
  citations on. The system prompt says: answer only from them, in the page's
  language, briefly, no Markdown, and treat the question as a question, not
  instructions. Citations come back as `search_result_location` and are shown
  as `[1]`, `[2]` badges linking to the posts. No relevant excerpt means no
  Claude request ("No note seems to be about this"). A refusal shows an alert.
  At most 6 excerpts go to Claude (8 are searched), `effort: low`,
  `max_tokens` 1024, with the API's server-side fallback for declined
  requests (not for Haiku, which has none).
- **Model**: chosen in the CMS, Site → "AI search: answer model" (Opus 5.5,
  Sonnet 5.5 or Haiku 5.5). Saving the Site global expires the web's cache, so
  the next question uses the new model with no deploy. `AI_ANSWER_MODEL` on
  athena-web is used only while the Site has no value; the default is
  `claude-opus-5-5`.
- **Suggested questions**: Site → "AI search: suggested questions" (per
  language, up to 6). They show under the tabs in Ask AI only; clicking one
  fills the prompt and asks it. Since many visitors click the same ones, they
  are the questions most often answered from a kept answer (below).

## Cost and free-tier guards

- Search results and finished answers are kept in the Vercel Runtime Cache
  under the `cms-data` tag, the same as other CMS reads: the same query in the
  same language costs nothing until the next publish expires the tag. A
  replayed answer does not count against the limits.
- **Kept answers** (`ai.answers`): every finished answer is also saved in the
  CMS database, per language, question (case and spacing ignored) and answer
  model, with the question's embedding and a `source_key` (a hash of the
  prompt version, the model and the excerpts it was written from). A later
  question, also after a publish or on a new deployment, reuses it when it is
  written the same (case and spacing aside) **and** would be answered from
  the very same excerpts. A question that only means nearly the same
  (cosine ≥ 0.95) reuses an answer kept for one of the Site's suggested
  questions, never one written for another visitor's own words: those words
  could carry instructions that steered the answer (`mayReuse` in
  `apps/web/src/lib/ai-answer.ts`). When a post it used changes, the key
  no longer matches and Claude writes a new answer, which replaces the old
  one. The lookup rides on the search request the question needs anyway (one
  embedding, one more `SELECT` in the same round trip); saving runs after the
  answer is sent (`waitUntil`) and embeds the question once more. Rows not
  rewritten for 180 days are deleted.
- **Replays look like new answers**: a reused answer is streamed with the
  same events as a new one, paced like one (the sources after 0.35–0.8 s, the
  text after 0.9–1.8 s, in small pieces over about 6 s), and nothing in the
  response says it was reused. Do not add a `cached` flag or a header.
- Uncached requests: 10 per visitor per 10 minutes (per function instance),
  and `AI_DAILY_LIMIT` per UTC day for the whole site (default 100; `0` turns
  uncached AI requests off). Beyond that the page shows "busy" or "daily
  limit" in an alert. If the daily count cannot be read or written (Runtime
  Cache failure), the request is refused: the limit fails closed.
- Only same-origin browsers may call `/api/ai/*` (Origin check); bodies over
  2 KB and questions over 300 characters are refused before anything runs.
- The page never asks on its own: the AI modes run on Enter, and a page
  prerendered by a hovered link waits until it is shown. A link to
  `/search?q=…&mode=ask` asks on arrival only when the visitor came from this
  site (the "Ask Hoo" row; `document.referrer` of the same origin); from
  another site, or typed, the question waits in the box for Enter.
- No other site may frame the pages (`Content-Security-Policy:
  frame-ancestors 'self' <CMS origin>`, set in `middleware.ts` on HTML
  responses; the CMS origin is there for Payload's Live Preview), so a hidden
  frame cannot spend answers either.
- The index reads posts as an anonymous visitor **and** with
  `_status: published` in the query, so a save run by a script with a user
  (who can read drafts) still never indexes a draft.
- Neon: each uncached query is one short `SELECT` (it wakes the compute if it
  slept). Indexing reads the post and writes only changed rows.

Known limit: a publish expires the cached results at once, while the index
is updated a few seconds later (after the embedding call). A search for the
same words in that window caches the old results until the next publish.
With today's traffic this is unlikely; publishing again (or any other post)
clears it.

## Setup

| Where | Variable | Notes |
|---|---|---|
| athena-cms (Preview + Production) | `VOYAGE_API_KEY` | Embeddings. Without it the CMS does not index and `/api/ai/search` answers 503 |
| athena-cms | `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `EMBEDDING_BASE_URL` | Optional: `openai` (with `OPENAI_API_KEY`), another model, a gateway. Changing the model re-embeds everything on the next run |
| athena-web (Preview + Production) | `ANTHROPIC_API_KEY` | Answers, and the switch for the whole AI UI |
| athena-web | `AI_ANSWER_MODEL`, `AI_DAILY_LIMIT` | Optional; the model in the Site global wins over `AI_ANSWER_MODEL` |
| both | `REVALIDATE_SECRET` | Already set; the web server authenticates to `/api/ai/search` with it |

`@anthropic-ai/sdk` adds about 4 MB to the web server functions (12 MB in
all); only `/api/ai/ask` loads it, so other pages' cold starts do not change.

Database: run [`docs/sql/2026-11-13-ai-search.sql`](./sql/2026-11-13-ai-search.sql)
once on the preview Neon branch and on production (pgvector extension, schema
`ai`, table `ai.post_chunks`), then
[`docs/sql/2026-11-13-ai-answers.sql`](./sql/2026-11-13-ai-answers.sql)
(the Site columns `ai_model` and table `site_ai_presets`, and `ai.answers`).
Both are idempotent. Local dev creates the `ai` tables on first use (needs
pgvector in the local Postgres) and Payload pushes the Site fields. Without
`ai.answers`, search and answers still work, nothing is kept.

## Payload 4.0

The design keeps the index outside Payload so the 4.0 upgrade does not touch it:

- `ai.post_chunks` lives in its own schema, not in a Payload collection: no
  `generate:types`, no migration and no push ever sees it, and Payload 4.0's
  schema changes cannot drop it.
- The only database coupling is `payload.db.pool` (`store.ts` `dbOf`), a
  pg-style `query()`. If 4.0 renames it, that one line changes.
- "Published" comes from Payload itself: the indexer reads each post per
  language as an anonymous visitor (Local API, `overrideAccess: false`), so
  4.0's per-locale publish status is followed with no code change (a post
  published only in English drops out of the ja/zh index, or falls back,
  whatever Payload returns).
- No Payload job task (a new task slug would change the `payload_jobs` enum,
  i.e. manual SQL now and a migration later); indexing runs in `after()`.
- The hooks use only `afterChange` / `afterDelete` arguments that are the same
  in 3 and 4 (`doc`, `previousDoc`, `req`, `req.context`).
- The settings (`aiModel`, `aiPresets`) are ordinary Site global fields (a
  select and a localized array with one text field), so the 4.0 migration
  carries them like the other Site fields. The web reads them through
  `getSite`, never from table names.

## Checking it

Unit: TC-U-52–61. E2E: TC-E-62–68 (the browser calls are stubbed, so they
spend nothing on a deployment). Deployment: TC-P-19–23 in
[`TESTING.md`](./TESTING.md).
