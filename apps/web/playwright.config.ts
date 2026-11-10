import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests (docs/TESTING.md). They drive a running site:
 *
 *   bun run dev:web                     # or any deployment
 *   E2E_BASE_URL=http://localhost:4321 bun run --filter @athena/web test:e2e
 *
 * Content-dependent cases skip themselves when the CMS has no posts.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4321',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
