/** Build metadata (version, commit, environment); see lib/build-info.mjs. */
export const BUILD = __BUILD_INFO__

/**
 * Version shown next to the site name: the release, plus `-preview` / `-dev`
 * outside Production. The /status panel shows the full version with commit.
 */
export const SHORT_VERSION =
  BUILD.env === 'production'
    ? BUILD.release
    : `${BUILD.release}-${BUILD.env === 'preview' ? 'preview' : 'dev'}`
