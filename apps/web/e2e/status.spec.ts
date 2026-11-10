import { expect, test } from '@playwright/test'

import { open } from './helpers'

test('TC-E-27 "/status" in the bottom prompt opens the status panel', async ({ page }) => {
  await open(page, '/', { view: 'cli' })
  const input = page.locator('[data-search-prompt] [data-search-input]')
  await input.fill('/st')
  await expect(page.locator('[data-prompt-commands]')).toBeVisible()
  await input.press('Enter')
  await expect(page.locator('[data-status-dialog]')).toHaveAttribute('open', '')
})

test('TC-E-28 the status panel stays open after changing the language', async ({ page }) => {
  await open(page, '/', { view: 'cli' })
  await page.keyboard.press('s')
  await page.locator('[data-status-tab="config"]').click()
  await page.locator('[data-config="language"]').click()
  await expect(page).toHaveURL(/\/ja$/)
  await expect(page.locator('[data-status-dialog]')).toHaveAttribute('open', '')
  await expect(page.locator('[data-config="language"]')).toBeFocused()
})
