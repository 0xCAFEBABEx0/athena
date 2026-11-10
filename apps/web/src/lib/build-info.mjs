import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

/**
 * Build metadata baked into the bundle by astro.config.mjs (`__BUILD_INFO__`).
 * The site version is the root package.json `version`, bumped once per
 * release (docs/VERSIONING.md). Production shows it as is; other builds get a
 * pre-release suffix so a preview can never pass for a release:
 *   production  1.2.0
 *   preview     1.2.0-preview.abc1234
 *   local       1.2.0-dev.abc1234
 *
 * @returns {{ version: string, release: string, commit: string, env: string, builtAt: string, astro: string }}
 */
export const buildInfo = () => {
  const rootPackage = new URL('../../../../package.json', import.meta.url)
  const release = JSON.parse(readFileSync(rootPackage, 'utf8')).version
  const astro = createRequire(import.meta.url)('astro/package.json').version

  let commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7)
  if (!commit) {
    try {
      commit = execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim()
    } catch {
      commit = ''
    }
  }

  const env = process.env.VERCEL_ENV ?? 'development'
  const suffix = env === 'production' ? '' : `-${env === 'preview' ? 'preview' : 'dev'}`
  const version = `${release}${suffix}${suffix && commit ? `.${commit}` : ''}`

  return { version, release, commit, env, builtAt: new Date().toISOString(), astro }
}
