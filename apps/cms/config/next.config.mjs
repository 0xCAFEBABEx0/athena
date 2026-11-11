import path from 'path'
import { fileURLToPath } from 'url'

import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const cmsRoot = path.resolve(dirname, '..')
const repoRoot = path.resolve(cmsRoot, '../..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable Web Vitals tracking
    webVitalsAttribution: ['CLS', 'LCP'],
  },

  // Next 16.3+ infers the workspace root from the nearest lockfile. In this bun
  // monorepo that is the repo root (where `next` is hoisted), not apps/cms.
  // The website template sets `root` to its own package dir; we set it to the
  // lockfile root so Turbopack can resolve next/package.json.
  turbopack: {
    root: repoRoot,
    // See the note on `payload/internal` below. Turbopack has no `false` alias,
    // so the browser condition points it at an empty module instead.
    resolveAlias: {
      'payload/internal': { browser: './config/empty-module.mjs' },
    },
  },

  // Temporarily required until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: [path.resolve(repoRoot, 'node_modules/@payloadcms/ui/dist/scss/')],
  },

  // The Vercel Blob client upload handler imports `getFileKey` from
  // `@payloadcms/plugin-cloud-storage/utilities`, whose barrel also re-exports
  // `resolveSignedURLKey` -- the one server-only module in that barrel. It pulls
  // in `payload/internal` (undici, telemetry), which references `node:*`
  // builtins webpack cannot bundle for the browser. That code never runs
  // client-side, so alias the `payload/internal` bridge to an empty module in
  // the client build to keep the server chain out of the bundle. Production
  // builds use Turbopack (`turbopack.resolveAlias` above); this webpack copy
  // only matters for an explicit `next build --webpack` fallback.
  webpack: (webpackConfig, { isServer }) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    if (!isServer) {
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        'payload/internal': false,
      }
    }
    return webpackConfig
  },

  // This app no longer serves a public site (it moved to apps/web). Send the
  // bare origin to the admin panel and, when WEB_URL is set, permanently
  // redirect any old public URL (e.g. /posts/foo) to the same path on the web
  // app. Admin, API, Next assets, the Sentry tunnel and static files at the
  // root are left alone.
  async redirects() {
    const webURL = process.env.WEB_URL
    return [
      { source: '/', destination: '/admin', permanent: false },
      ...(webURL
        ? [
            {
              source: '/:path((?!admin(?:/|$)|api(?:/|$)|_next/|monitoring(?:/|$)|robots\\.txt$|favicon\\.(?:ico|svg)$).+)',
              destination: `${webURL}/:path`,
              permanent: true,
            },
          ]
        : []),
    ]
  },

  // Enable standalone output for Docker
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // Image configuration
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/**',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        port: '',
      },
    ],
  },
}

// Check if Sentry should be enabled
// Temporarily disable Sentry for Next.js 15 compatibility
const shouldUseSentry = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
const hasSentryConfig = process.env.SENTRY_ORG && process.env.SENTRY_PROJECT

// Wrap with Payload's Next plugin so server-only packages (undici, sharp, etc.)
// are correctly externalized from client/edge bundles.
let finalConfig = withPayload(nextConfig, { devBundleServerPackages: false })

if (shouldUseSentry && hasSentryConfig) {
  finalConfig = withSentryConfig(
    finalConfig,
    {
      // For all available options, see:
      // https://www.npmjs.com/package/@sentry/webpack-plugin#options

      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,

      // Only print logs for uploading source maps in CI
      silent: !process.env.CI,

      // For all available options, see:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

      // Upload a larger set of source maps for prettier stack traces (increases build time)
      widenClientFileUpload: true,

      // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
      tunnelRoute: '/monitoring',

      // Source map configuration using newer options
      sourcemaps: {
        // Upload only for Production builds: it adds ~10 s to every Vercel
        // build, and Preview stack traces can stay minified.
        disable: process.env.VERCEL_ENV !== 'production',
        // Clean up source maps after upload for better security
        deleteSourcemapsAfterUpload: true,
        // Custom source rewriting to improve source map references
        rewriteSources: (source) => {
          // Remove absolute paths and make sources relative
          if (source.startsWith('webpack://')) {
            return source.replace('webpack://', '~/')
          }
          return source.replace(process.cwd(), '~')
        },
      },

      // withSentryConfig takes only two arguments; these webpack-only options
      // used to sit in an ignored third argument.
      webpack: {
        // Automatically tree-shake Sentry logger statements to reduce bundle size
        treeshake: {
          removeDebugLogging: true,
        },

        // Enables automatic instrumentation of Vercel Cron Monitors.
        automaticVercelMonitors: true,
      },
    },
  )
} else {
  console.warn('Sentry configuration incomplete - building without Sentry source map upload')
  if (shouldUseSentry && !hasSentryConfig) {
    console.info('Set SENTRY_ORG and SENTRY_PROJECT environment variables to enable Sentry source maps')
  }
}

export default finalConfig
