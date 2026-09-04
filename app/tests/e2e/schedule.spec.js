import { test, expect } from '@playwright/test'
import { gotoReady } from '../helpers.js'

// The frozen clock (Wednesday 7am, see helpers) makes the date-aware default
// select all five days, so no localStorage seeding is needed here — which
// also lets reload-persistence assertions work (an addInitScript seed would
// re-run on reload and clobber what the UI wrote).

const TOTAL = '1753 sessions'

test('day chips toggle, update the count, and persist across reload', async ({ page }) => {
  await gotoReady(page)
  const count = page.locator('.count-line').first()
  await expect(count).toHaveText(TOTAL)

  const wed = page.getByRole('button', { name: 'Wed Sep 2' })
  await wed.click()
  await expect(wed).toHaveAttribute('aria-pressed', 'false')
  await expect(count).not.toHaveText(TOTAL)

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bp26-schedule-days')))
  expect(stored).not.toContain('Wednesday')
  expect(stored).toHaveLength(4)

  await page.reload()
  await page.locator('.card').first().waitFor()
  await expect(page.getByRole('button', { name: 'Wed Sep 2' })).toHaveAttribute('aria-pressed', 'false')
  await expect(count).not.toHaveText(TOTAL)
})

test('first visit mid-conference defaults to today onward @mobileOnly', async ({ page }) => {
  await gotoReady(page, { time: '2026-09-04T09:00:00-04:00' }) // Friday of the conference
  for (const [name, pressed] of [
    ['Wed Sep 2', 'false'],
    ['Thu Sep 3', 'false'],
    ['Fri Sep 4', 'true'],
    ['Sat Sep 5', 'true'],
    ['Sun Sep 6', 'true'],
  ]) {
    await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', pressed)
  }
})

test('first visit after the conference falls back to the whole week @mobileOnly', async ({ page }) => {
  await gotoReady(page, { time: '2026-10-01T09:00:00-04:00' })
  for (const name of ['Wed Sep 2', 'Thu Sep 3', 'Fri Sep 4', 'Sat Sep 5', 'Sun Sep 6']) {
    await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
  }
})

test('text filter narrows the list and clears back', async ({ page }) => {
  await gotoReady(page)
  const count = page.locator('.count-line').first()
  const input = page.getByPlaceholder('Filter titles, rooms…')
  await input.fill('authoritarianism')
  await expect(count).not.toHaveText(TOTAL)
  await input.fill('')
  await expect(count).toHaveText(TOTAL)
})

test('filter sheet applies filters, shows removable chips, and clears @mobileOnly', async ({ page }) => {
  await gotoReady(page)
  const count = page.locator('.count-line').first()

  await page.getByRole('button', { name: /Filters/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Morning', exact: true }).click()
  await dialog.getByRole('button', { name: 'Hynes', exact: true }).click()
  await page.getByRole('button', { name: 'Close' }).click()

  await expect(page.locator('.chip.removable')).toHaveCount(2)
  await expect(count).not.toHaveText(TOTAL)
  await expect(page.getByRole('button', { name: /Filters · 2/ })).toBeVisible()

  await page.locator('.chip.removable', { hasText: 'Hynes' }).click()
  await expect(page.locator('.chip.removable')).toHaveCount(1)
  await page.locator('.chip.removable', { hasText: 'Morning' }).click()
  await expect(page.locator('.chip.removable')).toHaveCount(0)
  await expect(count).toHaveText(TOTAL)
})

test('lazy list grows on scroll and resets when the query changes', async ({ page }) => {
  await gotoReady(page)
  const sentinel = page.locator('.count-line', { hasText: 'Showing' })
  await expect(sentinel).toHaveText('Showing 60 of 1753 — scroll for more')

  await sentinel.scrollIntoViewIfNeeded()
  await expect(sentinel).not.toHaveText('Showing 60 of 1753 — scroll for more')
  const grown = await sentinel.textContent()
  expect(parseInt(grown.replace('Showing ', ''), 10)).toBeGreaterThan(60)

  // any filter change restarts the lazy window
  await page.getByRole('button', { name: 'Wed Sep 2' }).click()
  await expect(sentinel).toHaveText(/^Showing 60 of \d+/)
})
