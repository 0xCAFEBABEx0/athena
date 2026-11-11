// Runs after `astro build`. @astrojs/vercel writes the function runtime as
// `bun<major>.x` (`bun1.x`), which Vercel runs on its previous Bun line
// (1.3). Pin the functions to the `bunVersion` in vercel.json (1.4.x), the
// same Bun the CMS functions, the build and local dev use.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'

const vercelJson = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const functionsDir = new URL('../.vercel/output/functions/', import.meta.url)
const runtime = vercelJson.bunVersion ? `bun${vercelJson.bunVersion}` : undefined

if (runtime && existsSync(functionsDir)) {
  for (const entry of readdirSync(functionsDir)) {
    if (!entry.endsWith('.func')) continue
    const file = new URL(`${entry}/.vc-config.json`, functionsDir)
    if (!existsSync(file)) continue
    const config = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof config.runtime !== 'string' || !config.runtime.startsWith('bun')) continue
    config.runtime = runtime
    writeFileSync(file, `${JSON.stringify(config, null, '\t')}\n`)
    console.log(`[pin-bun-runtime] ${entry}: ${runtime}`)
  }
}
