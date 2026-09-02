// Google Calendar constructor-URL links. Dates are APSA 2026 Boston days.

const DAY_TO_DATE = {
  Wednesday: '20260902',
  Thursday: '20260903',
  Friday: '20260904',
  Saturday: '20260905',
  Sunday: '20260906',
}

function toCompactTime(t) {
  // "2:30 PM" -> "143000"
  const m = t.trim().match(/(\d{1,2}):(\d{2})\s*([AP]M)/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2]
  const pm = m[3].toUpperCase() === 'PM'
  if (pm && h !== 12) h += 12
  if (!pm && h === 12) h = 0
  return `${String(h).padStart(2, '0')}${min}00`
}

export function calendarUrl(session) {
  const date = DAY_TO_DATE[session.day]
  const [startRaw, endRaw] = (session.time || '').split(' to ')
  const start = toCompactTime(startRaw || '')
  const end = toCompactTime(endRaw || '')
  if (!date || !start || !end) return null

  const details = [
    session.division,
    session.room ? `Room: ${session.room}` : '',
    session.papers.length ? `Papers: ${session.papers.map((p) => p.title).join(' · ')}` : '',
    'Via bostonpolisci26 — APSA 2026 Boston program.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `APSA ${session.session_number}: ${titleCase(session.title)}`,
    dates: `${date}T${start}/${date}T${end}`,
    ctz: 'America/New_York',
    location: session.room || 'APSA 2026, Boston',
    details,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function titleCase(s) {
  if (!s) return s
  if (s !== s.toUpperCase()) return s
  const small = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with'])
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}
