import { test, expect } from '@playwright/test'
import { seedDays, seedAgenda, gotoReady, switchTab, overlapPair } from '../helpers.js'

// The mobile freeze: these goldens are captured from the production build
// BEFORE any desktop work and must never change during the desktop sprint.
// Tests tagged @dark also run in the visual-dark project (separate goldens).
// All shots are viewport clips — full-page on a 1,753-card lazy list is
// inherently nondeterministic.

const TOTAL = '1753 sessions'

test('schedule top @dark', async ({ page }) => {
  await gotoReady(page)
  await expect(page.locator('.count-line').first()).toHaveText(TOTAL)
  await expect(page).toHaveScreenshot('schedule-top.png')
})

test('schedule scrolled', async ({ page }) => {
  await gotoReady(page)
  await page.evaluate(() => window.scrollTo(0, 2600))
  await page.waitForFunction(() => window.scrollY >= 2000)
  await expect(page).toHaveScreenshot('schedule-scrolled.png')
})

test('schedule single day', async ({ page }) => {
  await seedDays(page.context(), ['Friday'])
  await gotoReady(page)
  await expect(page).toHaveScreenshot('schedule-single-day.png')
})

test('schedule text filter', async ({ page }) => {
  await gotoReady(page)
  await page.getByPlaceholder('Filter titles, rooms…').fill('climate')
  await expect(page.locator('.count-line').first()).not.toHaveText(TOTAL)
  await expect(page).toHaveScreenshot('schedule-text-filter.png')
})

test('filter sheet open @dark', async ({ page }) => {
  await gotoReady(page)
  await page.getByRole('button', { name: /Filters/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page).toHaveScreenshot('filter-sheet.png')
})

test('schedule active filter chips', async ({ page }) => {
  await gotoReady(page)
  await page.getByRole('button', { name: /Filters/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Morning', exact: true }).click()
  await dialog.getByRole('button', { name: 'Hynes', exact: true }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('.chip.removable')).toHaveCount(2)
  await expect(page).toHaveScreenshot('schedule-active-chips.png')
})

test('session sheet @dark', async ({ page }) => {
  await gotoReady(page)
  await page.locator('.card.tappable').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page).toHaveScreenshot('session-sheet.png')
})

test('person sheet stacked over session', async ({ page }) => {
  await gotoReady(page)
  // session 2.1 has participants, so its sheet has person links
  await page.locator('.card.tappable', { hasText: '2.1' }).first().click()
  await page.getByRole('dialog').locator('.person-link').first().click()
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()
  await expect(page).toHaveScreenshot('person-sheet-stacked.png')
})

test('search idle topic browser', async ({ page }) => {
  await gotoReady(page)
  await switchTab(page, 'Search')
  await expect(page.locator('.macro-row').first()).toBeVisible()
  await expect(page).toHaveScreenshot('search-idle.png')
})

test('search results @dark', async ({ page }) => {
  await gotoReady(page)
  await switchTab(page, 'Search')
  await page.getByPlaceholder(/Topics or people/).fill('climate')
  await expect(page.locator('.segment-row')).toBeVisible()
  await expect(page).toHaveScreenshot('search-results.png')
})

test('agenda empty', async ({ page }) => {
  await gotoReady(page)
  await switchTab(page, 'Agenda')
  await expect(page.locator('.center-panel:visible')).toBeVisible()
  await expect(page).toHaveScreenshot('agenda-empty.png')
})

test('agenda seeded with overlap @dark', async ({ page }) => {
  const [a, b] = overlapPair()
  await seedAgenda(page.context(), { sessions: [a, b], papers: [0] })
  await gotoReady(page)
  await switchTab(page, 'Agenda')
  await expect(page.locator('.overlap-note:visible')).toHaveCount(2)
  await expect(page).toHaveScreenshot('agenda-seeded.png')
})

test('share tab', async ({ page }) => {
  await gotoReady(page)
  await switchTab(page, 'Share')
  await expect(page.locator('.qr-wrap:visible svg')).toBeVisible()
  await expect(page).toHaveScreenshot('share.png')
})

test('about tab', async ({ page }) => {
  await gotoReady(page)
  await switchTab(page, 'About')
  await expect(page.locator('.center-panel:visible')).toBeVisible()
  await expect(page).toHaveScreenshot('about.png')
})
