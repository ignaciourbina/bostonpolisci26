import { test, expect } from '@playwright/test'
import { gotoReady } from '../../helpers.js'

// Desktop-layer specs: these run only in the desktop project (the mobile
// project ignores this directory) and assert the ≥940px chrome — top nav,
// filter sidebar, right slide-over.

const TOTAL = '1753 sessions'

test('top nav replaces the bottom tab bar and switches tabs', async ({ page }) => {
  await gotoReady(page)

  await expect(page.locator('.top-nav')).toBeVisible()
  await expect(page.locator('.tab-bar')).toBeHidden()
  await expect(page.locator('.app-header')).toBeHidden()

  const schedule = page.locator('.top-tab', { hasText: 'Schedule' })
  await expect(schedule).toHaveAttribute('aria-current', 'page')

  await page.locator('.top-tab', { hasText: 'Search' }).click()
  await expect(page.getByPlaceholder(/Topics or people/)).toBeVisible()
  await expect(page.locator('.top-tab', { hasText: 'Search' })).toHaveAttribute('aria-current', 'page')

  await page.locator('.top-tab', { hasText: 'About' }).click()
  await expect(page.locator('.center-panel:visible')).toContainText('About')
  await page.locator('.top-tab', { hasText: 'Schedule' }).click()
  await expect(page.locator('.card.tappable:visible').first()).toBeVisible()
})

test('filter sidebar is persistent and drives the same state', async ({ page }) => {
  await gotoReady(page)
  const sidebar = page.locator('.schedule-sidebar')
  const count = page.locator('.schedule-main .count-line').first()

  await expect(sidebar).toBeVisible()
  // the mobile Filters button does not exist on desktop
  await expect(page.getByRole('button', { name: /⚙ Filters/ })).toHaveCount(0)
  await expect(count).toHaveText(TOTAL)

  // day chips live in the sidebar and persist to the same localStorage key
  await sidebar.getByRole('button', { name: 'Wed Sep 2' }).click()
  await expect(count).not.toHaveText(TOTAL)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bp26-schedule-days')))
  expect(stored).toHaveLength(4)
  await sidebar.getByRole('button', { name: 'Wed Sep 2' }).click()
  await expect(count).toHaveText(TOTAL)

  // daypart + venue chips are always visible — no sheet round-trip
  await sidebar.getByRole('button', { name: 'Morning', exact: true }).click()
  await expect(count).not.toHaveText(TOTAL)
  const afterDaypart = await count.textContent()
  await sidebar.getByRole('button', { name: 'Hynes', exact: true }).click()
  await expect(count).not.toHaveText(afterDaypart)

  // division search narrows the always-visible division list
  const divisions = sidebar.locator('.division-option')
  const all = await divisions.count()
  await sidebar.getByPlaceholder('Find a division…').fill('political thought')
  await expect(divisions.first()).toContainText(/Political Thought/i)
  expect(await divisions.count()).toBeLessThan(all)
  await divisions.first().click()
  await expect(sidebar.locator('.division-option.active')).toHaveCount(1)

  // the sidebar text filter is the same state as the mobile filter bar's
  await sidebar.getByPlaceholder('Filter titles, rooms…').fill('zzz-no-such-session')
  await expect(page.locator('.schedule-main .empty')).toContainText('Nothing matches')
})

test('detail opens as a right slide-over panel', async ({ page }) => {
  await gotoReady(page)
  await page.locator('.card.tappable:visible').first().click()

  const sheet = page.locator('.sheet')
  await expect(sheet).toBeVisible()
  await expect(page.locator('.sheet-grab')).toBeHidden() // touch-only affordance

  const viewport = page.viewportSize()
  const box = await sheet.boundingBox()
  expect(box.width).toBeLessThan(600) // panel, not full-width drawer
  expect(box.x + box.width).toBeGreaterThan(viewport.width - 2) // flush right
  expect(box.height).toBeGreaterThan(viewport.height - 2) // full height

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
