import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// The static program data the app itself fetches — specs read it in Node to
// derive fixtures (ids, titles, counts) instead of hardcoding fragile values.
export const appData = JSON.parse(
  fs.readFileSync(path.join(here, '../public/data/app_data.json'), 'utf8'),
)

export const ALL_DAYS = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Conference opening morning: with this clock frozen, the date-aware day
// defaults select all five days, and goldens stay valid forever, including
// long after the conference has ended. Specs therefore don't need to seed
// the day selection at all (addInitScript re-runs on reload, which would
// clobber persistence assertions).
export const CONFERENCE_TIME = '2026-09-02T07:00:00-04:00'

// localStorage seeds must land before any page script runs: both the day
// selection and the agenda store are read during module init / initial render.
export async function seedDays(context, days = ALL_DAYS) {
  await context.addInitScript((d) => localStorage.setItem('bp26-schedule-days', JSON.stringify(d)), days)
}

export async function seedAgenda(context, agenda) {
  await context.addInitScript(
    (a) => localStorage.setItem('bp26-agenda', JSON.stringify(a)),
    { sessions: [], papers: [], ...agenda },
  )
}

// setFixedTime fakes Date but leaves real timers running (the search debounce
// and CSS transitions must still fire). Must be called before page.goto.
export async function gotoReady(page, { time = CONFERENCE_TIME } = {}) {
  await page.clock.setFixedTime(new Date(time))
  await page.goto('/')
  await page.locator('.card').first().waitFor()
}

// Works on today's mobile UI and on the desktop top-nav the sprint adds, so
// specs written now survive the layout change.
export async function switchTab(page, label) {
  const top = page.locator('.top-tab', { hasText: label })
  if ((await top.count()) > 0 && (await top.first().isVisible())) {
    await top.first().click()
    return
  }
  await page.locator('.tab-btn', { hasText: label }).click()
}

// First pair of sessions sharing day+time, in schedule sort order — used to
// assert the agenda's overlap warning deterministically.
export function overlapPair() {
  const seen = new Map()
  for (let i = 0; i < appData.sessions.length; i++) {
    const s = appData.sessions[i]
    const key = `${s.day}|${s.time}`
    if (seen.has(key)) return [seen.get(key), i]
    seen.set(key, i)
  }
  throw new Error('no overlapping sessions in data')
}
