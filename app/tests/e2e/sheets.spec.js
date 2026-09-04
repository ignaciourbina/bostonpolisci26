import { test, expect } from '@playwright/test'
import { gotoReady, appData } from '../helpers.js'

test('session sheet opens, closes on Esc, closes on backdrop click', async ({ page }) => {
  await gotoReady(page)
  const dialog = page.getByRole('dialog')

  await page.locator('.card.tappable').first().click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  await page.locator('.card.tappable').first().click()
  await expect(dialog).toBeVisible()
  await page.locator('.sheet-backdrop').click({ position: { x: 10, y: 10 } })
  await expect(dialog).toHaveCount(0)
})

test('sheet stack: back arrow, browser back, and close-all stay in sync', async ({ page }) => {
  await gotoReady(page)
  const dialog = page.getByRole('dialog')
  const backBtn = page.getByRole('button', { name: 'Back' })

  // depth 1: session with participants → depth 2: person
  await page.locator('.card.tappable', { hasText: '2.1' }).first().click()
  await expect(dialog).toBeVisible()
  await expect(backBtn).toHaveCount(0)
  await dialog.locator('.person-link').first().click()
  await expect(backBtn).toBeVisible()

  // sheet's own back arrow pops one level
  await backBtn.click()
  await expect(dialog).toContainText('2.1')
  await expect(backBtn).toHaveCount(0)

  // browser back pops the remaining sheet (history integration)
  await dialog.locator('.person-link').first().click()
  await expect(backBtn).toBeVisible()
  await page.goBack()
  await expect(dialog).toContainText('2.1')
  await page.goBack()
  await expect(dialog).toHaveCount(0)

  // close-all from depth 2 unwinds the whole stack
  await page.locator('.card.tappable', { hasText: '2.1' }).first().click()
  await dialog.locator('.person-link').first().click()
  await expect(backBtn).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)
})

test('add-to-calendar link is a correct Google Calendar URL', async ({ page }) => {
  await gotoReady(page)
  await page.locator('.card.tappable').first().click()

  // first card = first Wednesday session in the data
  const s = appData.sessions.find((x) => x.day === 'Wednesday')
  const href = await page.getByRole('dialog').locator('a.btn.primary').getAttribute('href')
  expect(href).toContain('calendar.google.com/calendar/render')
  expect(href).toContain('action=TEMPLATE')
  expect(href).toContain('20260902T083000') // 8:30 AM start of session 1.1
  expect(href).toContain('ctz=America%2FNew_York')
  expect(decodeURIComponent(href)).toContain(s.session_number)
})
