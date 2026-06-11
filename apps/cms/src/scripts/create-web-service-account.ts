/**
 * One-off: create (or reset the API key of) the `web-frontend` service
 * account the Astro app uses for draft-content fetches.
 *
 *   bun run --filter @athena/cms payload run src/scripts/create-web-service-account.ts
 *
 * Prints the API key once — copy it into apps/web/.env as PAYLOAD_API_KEY
 * (and the web Vercel project's env).
 */
import { randomBytes, randomUUID } from 'crypto'

import config from '../payload.config'
import { getPayload } from 'payload'

const EMAIL = 'web-frontend@service.local'

const run = async () => {
  const payload = await getPayload({ config })

  const apiKey = randomUUID()

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: EMAIL } },
    limit: 1,
  })

  if (existing.docs[0]) {
    await payload.update({
      collection: 'users',
      id: existing.docs[0].id,
      data: { enableAPIKey: true, apiKey },
    })
    console.log(`Rotated API key for existing ${EMAIL}`)
  } else {
    await payload.create({
      collection: 'users',
      data: {
        name: 'web-frontend (service account)',
        email: EMAIL,
        password: randomBytes(32).toString('hex'),
        enableAPIKey: true,
        apiKey,
      },
    })
    console.log(`Created ${EMAIL}`)
  }

  console.log(`PAYLOAD_API_KEY=${apiKey}`)
  process.exit(0)
}

void run()
