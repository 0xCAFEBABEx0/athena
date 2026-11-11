import type { Page } from '@playwright/test'

export type Settings = {
  view?: 'cli' | 'modern'
  theme?: 'light' | 'dark'
  motion?: 'reduce' | 'full'
}

/** Opens a path with the visitor settings stored before the first script runs. */
export const open = async (page: Page, path: string, settings: Settings = {}) => {
  await page.addInitScript((s: Settings) => {
    try {
      if (s.view) localStorage.setItem('athena-view', s.view)
      if (s.theme) localStorage.setItem('payload-theme', s.theme)
      if (s.motion) localStorage.setItem('athena-motion', s.motion)
    } catch {
      /* storage blocked */
    }
  }, settings)
  const response = await page.goto(path, { waitUntil: 'networkidle' })
  // Astro's dev toolbar sits over the bottom of the page in `astro dev`.
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' })
  return response
}

export const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

export const isLocal = (baseURL: string | undefined) => /localhost|127\.0\.0\.1/.test(baseURL ?? '')
