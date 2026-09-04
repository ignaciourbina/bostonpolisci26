import { test, expect } from '@playwright/test'
import { gotoReady, switchTab } from '../helpers.js'

test('search finds people by name and opens their sheet', async ({ page }) => {
  await gotoReady(page)
  await switchTab(page, 'Search')
  // Fuse's 0.3 threshold needs the full name; "Sharon Austin" (no middle
  // name) scores past the cutoff — current app behavior, encoded as-is.
  await page.getByPlaceholder(/Topics or people/).fill('Sharon Denise Austin')

  const person = page.locator('.similar-row:visible', { hasText: 'Sharon Denise Austin' }).first()
  await expect(person).toBeVisible()
  await person.click()
  await expect(page.getByRole('dialog')).toContainText('Sharon Denise Austin')
})

test('topic search returns papers and sessions with a working segment toggle', async ({ page }) => {
  await gotoReady(page)
  await switchTab(page, 'Search')
  await page.getByPlaceholder(/Topics or people/).fill('climate')

  await expect(page.locator('.segment-row')).toBeVisible()
  await expect(page.getByRole('tab', { name: /Papers · \d+/ })).toBeVisible()
  await expect(page.locator('.card.tappable:visible').first()).toBeVisible() // paper cards

  await page.getByRole('tab', { name: /Sessions · \d+/ }).click()
  await expect(page.locator('.card.tappable:visible').first()).toBeVisible() // session cards
  // clearing the query returns to the idle topic browser
  await page.getByPlaceholder(/Topics or people/).fill('')
  await expect(page.locator('.macro-row').first()).toBeVisible()
})

test('topic browser expands a macro topic and opens a topic sheet', async ({ page }) => {
  await gotoReady(page)
  await switchTab(page, 'Search')

  const macro = page.locator('.macro-row').first()
  await macro.click()
  await expect(macro).toHaveAttribute('aria-expanded', 'true')
  await page.locator('.similar-row.indent:visible').first().click()
  await expect(page.getByRole('dialog').locator('.day-bars')).toBeVisible()
})
