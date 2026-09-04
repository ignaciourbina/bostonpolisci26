import { test, expect } from '@playwright/test'
import { gotoReady, switchTab } from '../helpers.js'

test('bottom tab bar reaches all five tabs and restores scroll @mobileOnly', async ({ page }) => {
  await gotoReady(page)

  await page.evaluate(() => window.scrollTo(0, 1500))
  await page.waitForFunction(() => window.scrollY >= 1400)

  await page.locator('.tab-btn', { hasText: 'Search' }).click()
  await expect(page.getByPlaceholder(/Topics or people/)).toBeVisible()
  await page.waitForFunction(() => window.scrollY === 0)

  await page.locator('.tab-btn', { hasText: 'Agenda' }).click()
  await expect(page.locator('.center-panel:visible')).toContainText('My agenda')
  await page.locator('.tab-btn', { hasText: 'Share' }).click()
  await expect(page.locator('.qr-wrap:visible svg')).toBeVisible()
  await page.locator('.tab-btn', { hasText: 'About' }).click()
  await expect(page.locator('.center-panel:visible')).toContainText('About')

  // returning to the schedule restores the saved scroll position
  await page.locator('.tab-btn', { hasText: 'Schedule' }).click()
  await page.waitForFunction(() => Math.abs(window.scrollY - 1500) < 2)
})

test('share and about tabs render', async ({ page }) => {
  await gotoReady(page)
  await switchTab(page, 'Share')
  await expect(page.locator('.qr-wrap:visible svg')).toBeVisible()
  await switchTab(page, 'About')
  await expect(page.locator('.center-panel:visible')).toContainText('About')
})
