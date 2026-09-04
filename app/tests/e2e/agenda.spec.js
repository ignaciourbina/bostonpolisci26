import { test, expect } from '@playwright/test'
import { seedAgenda, gotoReady, switchTab, overlapPair, appData } from '../helpers.js'

// All five tab panes stay mounted (hidden attribute), so content assertions
// use :visible to scope to the active pane.

test('starring a session round-trips through the agenda and survives reload', async ({ page }) => {
  await gotoReady(page)

  const star = page.locator('.card.tappable .star').first()
  await star.click()
  await expect(star).toHaveAttribute('aria-pressed', 'true')

  await switchTab(page, 'Agenda')
  await expect(page.locator('.card.tappable:visible')).toHaveCount(1)

  await page.reload()
  await page.locator('.card').first().waitFor()
  await switchTab(page, 'Agenda')
  await expect(page.locator('.card.tappable:visible')).toHaveCount(1)

  // unstar from the agenda itself → empty state returns
  await page.locator('.card.tappable:visible .star').click()
  await expect(page.locator('.center-panel:visible')).toContainText('Nothing starred yet')
})

test('two starred sessions in the same slot get overlap warnings', async ({ page }) => {
  const [a, b] = overlapPair()
  await seedAgenda(page.context(), { sessions: [a, b] })
  await gotoReady(page)
  await switchTab(page, 'Agenda')
  await expect(page.locator('.overlap-note:visible')).toHaveCount(2)
})

test('a starred paper implies its parent session in the agenda', async ({ page }) => {
  await seedAgenda(page.context(), { papers: [0] })
  await gotoReady(page)
  await switchTab(page, 'Agenda')

  const paper = appData.papers[0]
  const parent = appData.sessions[paper.session]
  await expect(page.locator('.card.tappable:visible')).toContainText(parent.session_number)
  const starredRow = page.locator('.similar-row.indent:visible', { hasText: paper.title })
  await expect(starredRow).toContainText('★')
  await starredRow.click()
  await expect(page.getByRole('dialog')).toContainText(paper.title)
})
