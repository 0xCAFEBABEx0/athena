import { expect, test } from '@playwright/test'

import { open } from './helpers'

test.describe('CLI banner', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('TC-E-01 CLI home shows the banner, ADE home the intro card', async ({ page }) => {
    await open(page, '/', { view: 'cli' })
    await expect(page.locator('.cli-banner')).toBeVisible()
    await expect(page.locator('#banner-name')).toBeVisible()
    await expect(page.locator('.home-intro')).toBeHidden()
    await page.locator('[data-view-set="modern"]').first().click()
    await expect(page.locator('.cli-banner')).toBeHidden()
    await expect(page.locator('.home-intro')).toBeVisible()
  })

  test('TC-E-02 wide screens show tips and recent activity', async ({ page }) => {
    await open(page, '/', { view: 'cli' })
    const side = page.locator('.cli-banner-side')
    await expect(side).toBeVisible()
    await expect(side.locator('[data-banner-cmd]')).toHaveCount(4)
    const rows = side.locator('.cli-banner-activity li')
    const count = await rows.count()
    expect(count).toBeLessThanOrEqual(3)
    if (count === 0) {
      await expect(side.locator('.cli-banner-empty')).toBeVisible()
      return
    }
    for (let i = 0; i < count; i += 1) {
      const row = rows.nth(i)
      await expect(row.locator('time')).not.toHaveText(/^\d{4}-\d{2}-\d{2}$/) // relative after load
      await expect(row.locator('.cli-banner-kind')).not.toBeEmpty()
      await expect(row.locator('a')).toHaveAttribute('href', /^\/(posts|work)\//)
    }
    // Two panes: the side pane starts to the right of the owl.
    const owl = await page.locator('.cli-banner-owl').boundingBox()
    const pane = await side.boundingBox()
    expect(pane && owl && pane.x > owl.x + owl.width).toBe(true)
  })

  test('TC-E-03 "/" command opens the search popup', async ({ page }) => {
    await open(page, '/', { view: 'cli' })
    await page.locator('[data-banner-cmd="search"]').click()
    await expect(page.locator('[data-search-dialog]')).toHaveAttribute('open', '')
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-search-dialog]')).not.toHaveAttribute('open', '')
  })

  test('TC-E-04 "/status" command opens the status panel', async ({ page }) => {
    await open(page, '/', { view: 'cli' })
    await page.locator('[data-banner-cmd="status"]').click()
    await expect(page.locator('[data-status-dialog]')).toHaveAttribute('open', '')
  })

  test('TC-E-05 "t" and "v" commands switch theme and view', async ({ page }) => {
    await open(page, '/', { view: 'cli', theme: 'light' })
    await page.locator('[data-banner-cmd="theme"]').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.locator('[data-banner-cmd="view"]').click()
    await expect(page.locator('html')).toHaveAttribute('data-view', 'modern')
  })

  test('TC-E-06 clicking Hoo wakes it with a tip, clicking again puts it to sleep', async ({ page }) => {
    await open(page, '/', { view: 'cli', motion: 'full' })
    const button = page.locator('[data-owl-button]')
    const svg = page.locator('[data-owl-frame]')
    const tip = page.locator('[data-owl-tip]')
    await expect(svg).toHaveAttribute('data-owl-frame', 'sleep')
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(tip).toBeVisible()
    await expect(tip).not.toBeEmpty()
    await expect(svg).toHaveAttribute('data-owl-frame', 'awake', { timeout: 4000 })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect(svg).toHaveAttribute('data-owl-frame', 'sleep')
    await expect(tip).toBeHidden()
  })

  test('TC-E-07 Reduce motion wakes Hoo without the animation', async ({ page }) => {
    await open(page, '/', { view: 'cli', motion: 'reduce' })
    await page.locator('[data-owl-button]').click()
    await expect(page.locator('[data-owl-frame]')).toHaveAttribute('data-owl-frame', 'awake')
  })

  test('TC-E-08 the side pane appears from 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    await open(page, '/', { view: 'cli' })
    await expect(page.locator('.cli-banner-side')).toBeVisible()
    await page.setViewportSize({ width: 767, height: 900 })
    await expect(page.locator('.cli-banner-side')).toBeHidden()
  })
})

test.describe('CLI banner on phones', () => {
  test.use({ viewport: { width: 320, height: 800 } })

  test('TC-E-10 owl sits beside the name and the side pane is hidden', async ({ page }) => {
    await open(page, '/ja', { view: 'cli' })
    await expect(page.locator('.cli-banner-side')).toBeHidden()
    const owl = await page.locator('.cli-banner-owl').boundingBox()
    const name = await page.locator('#banner-name').boundingBox()
    expect(owl && name && name.x >= owl.x + owl.width).toBe(true)
  })
})

test.describe('ADE site mark', () => {
  test('TC-E-45 brand avatars show the ❯_ mark, not a letter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await open(page, '/', { view: 'modern' })
    for (const scope of ['.modern-sidebar', '.home-intro']) {
      const mark = page.locator(`${scope} .modern-avatar-mark`).first()
      await expect(mark).toBeVisible()
      await expect(mark.locator('svg')).toHaveCount(1)
      await expect(mark).toHaveText('')
    }
    await page.setViewportSize({ width: 390, height: 800 })
    const top = page.locator('.modern-topbar .modern-avatar-mark')
    await expect(top).toBeVisible()
    await expect(top.locator('svg')).toHaveCount(1)
  })
})
