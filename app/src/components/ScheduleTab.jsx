import { useEffect, useMemo, useRef, useState } from 'react'
import { DAYS, DAY_DATES, DAY_ISO, slotStartMinutes } from '../lib/data.js'
import { titleCase } from '../lib/calendar.js'
import SessionCard from './SessionCard.jsx'
import BottomSheet from './BottomSheet.jsx'
import FilterSheet, { sessionVenue, sessionDaypart, DAYPARTS } from './FilterSheet.jsx'
import { useIsDesktop } from '../lib/useDesktop.js'

const DAYS_STORAGE_KEY = 'bp26-schedule-days'

// YYYY-MM-DD in the visitor's own local time zone — deliberately not UTC
// (toISOString) and not the conference's Eastern time, so "today" matches
// what the visitor's own clock and calendar app already tell them.
function todayIsoLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// First-time default: today onward, so a day that's already over doesn't
// stay selected. Falls back to every day once the conference itself is over,
// and before it starts every day is still "upcoming" so nothing is excluded.
function defaultDays() {
  const today = todayIsoLocal()
  const upcoming = DAYS.filter((d) => DAY_ISO[d] >= today)
  return new Set(upcoming.length > 0 ? upcoming : DAYS)
}

function loadStoredDays() {
  try {
    const raw = JSON.parse(localStorage.getItem(DAYS_STORAGE_KEY))
    if (Array.isArray(raw) && raw.length > 0) return new Set(raw.filter((d) => DAYS.includes(d)))
  } catch {
    // ignore
  }
  return null
}

export default function ScheduleTab({ data }) {
  const isDesktop = useIsDesktop()
  // Days are multi-select: every chip toggles its own day, so the schedule
  // can span any combination at once. A saved selection always wins; a
  // first-time visitor gets today-onward instead of the whole week.
  const [days, setDays] = useState(() => loadStoredDays() ?? defaultDays())
  const [filters, setFilters] = useState({ division: null, venue: null, daypart: null, text: '' })
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Lazy list: render the first chunk immediately and grow as the sentinel
  // at the bottom scrolls into view. With every day selected the full list
  // is 1,753 cards (~15k DOM nodes) — mounting it all at once visibly
  // freezes the page, especially on phones.
  const CHUNK = 60
  const [limit, setLimit] = useState(CHUNK)
  const sentinelRef = useRef(null)

  const visible = useMemo(() => {
    const q = filters.text.trim().toLowerCase()
    return data.sessions
      .map((s, i) => ({ session: s, id: i }))
      .filter(({ session: s }) => days.has(s.day))
      .filter(({ session: s }) => !filters.division || s.division === filters.division)
      .filter(({ session: s }) => !filters.venue || sessionVenue(s) === filters.venue)
      .filter(({ session: s }) => !filters.daypart || sessionDaypart(s) === filters.daypart)
      .filter(
        ({ session: s }) =>
          !q ||
          s.title.toLowerCase().includes(q) ||
          (s.division || '').toLowerCase().includes(q) ||
          (s.room || '').toLowerCase().includes(q) ||
          s.papers.some((p) => p.title.toLowerCase().includes(q)),
      )
      .sort(
        (a, b) =>
          DAYS.indexOf(a.session.day) - DAYS.indexOf(b.session.day) ||
          slotStartMinutes(a.session.time) - slotStartMinutes(b.session.time),
      )
  }, [data, days, filters])

  // any change to days or filters starts the lazy list over
  const resetKey = `${[...days].sort().join()}|${filters.division}|${filters.venue}|${filters.daypart}|${filters.text}`
  useEffect(() => setLimit(CHUNK), [resetKey])

  const shown = useMemo(() => visible.slice(0, limit), [visible, limit])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || shown.length >= visible.length) return
    const ob = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setLimit((l) => l + 2 * CHUNK),
      { rootMargin: '900px' },
    )
    ob.observe(node)
    return () => ob.disconnect()
  }, [shown.length, visible.length])

  const slots = useMemo(() => {
    const groups = []
    let current = null
    for (const item of shown) {
      const { day, time } = item.session
      if (!current || current.time !== time || current.day !== day) {
        current = { day, time, key: `${day}|${time}`, items: [] }
        groups.push(current)
      }
      current.items.push(item)
    }
    return groups
  }, [shown])

  const toggleDay = (d) =>
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      try {
        localStorage.setItem(DAYS_STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // storage full / private mode — selection still works this session
      }
      return next
    })

  const activeChips = [
    filters.division && { key: 'division', label: titleCase(filters.division) },
    filters.venue && { key: 'venue', label: filters.venue },
    filters.daypart && { key: 'daypart', label: DAYPARTS.find((d) => d.id === filters.daypart)?.label },
  ].filter(Boolean)

  // Shared fragments: the mobile branch below must emit exactly the tree this
  // component produced before the desktop layer existed (the visual freeze
  // suite holds it to that), so anything reused by both layouts lives here.
  const dayChips = (
    <div className="chip-row" role="group" aria-label="Days">
      {DAYS.map((d) => (
        <button
          key={d}
          className={`chip ${days.has(d) ? 'active' : ''}`}
          aria-pressed={days.has(d)}
          onClick={() => toggleDay(d)}
        >
          {d.slice(0, 3)}
          <span className="d">{DAY_DATES[d]}</span>
        </button>
      ))}
    </div>
  )

  const textInput = (
    <input
      placeholder="Filter titles, rooms…"
      value={filters.text}
      onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
    />
  )

  const noDaysMsg = isDesktop
    ? 'No days selected — pick a day in the sidebar.'
    : 'No days selected — tap a day above to see sessions.'

  const list = (
    <>
      <div className="hint count-line">
        {visible.length} session{visible.length === 1 ? '' : 's'}
      </div>

      {days.size === 0 && <div className="empty">{noDaysMsg}</div>}
      {days.size > 0 && slots.length === 0 && <div className="empty">Nothing matches these filters.</div>}
      {slots.map((slot) => (
        <div key={slot.key}>
          <div className="slot-header">
            {days.size > 1 && `${slot.day.slice(0, 3)} ${DAY_DATES[slot.day]} · `}
            {slot.time}
          </div>
          {slot.items.map(({ session, id }) => (
            <SessionCard key={id} session={session} sessionId={id} />
          ))}
        </div>
      ))}

      {shown.length < visible.length && (
        <div ref={sentinelRef} className="hint count-line">
          Showing {shown.length} of {visible.length} — scroll for more
        </div>
      )}
    </>
  )

  if (!isDesktop) {
    return (
      <>
        {dayChips}

        <div className="filter-bar">
          <button className="btn" onClick={() => setFilterSheetOpen(true)}>
            ⚙ Filters{activeChips.length > 0 ? ` · ${activeChips.length}` : ''}
          </button>
          {textInput}
        </div>

        {activeChips.length > 0 && (
          <div className="chip-row secondary">
            {activeChips.map((c) => (
              <button
                key={c.key}
                className="chip active removable"
                onClick={() => setFilters((f) => ({ ...f, [c.key]: null }))}
              >
                {c.label} ✕
              </button>
            ))}
          </div>
        )}

        {list}

        {filterSheetOpen && (
          <BottomSheet onClose={() => setFilterSheetOpen(false)}>
            <FilterSheet data={data} filters={filters} setFilters={setFilters} />
          </BottomSheet>
        )}
      </>
    )
  }

  // Desktop: everything the mobile Filters sheet holds sits permanently in a
  // left sidebar, driving the exact same state. The list column deliberately
  // has no scroll container of its own — the document keeps scrolling, so
  // tab scroll-memory and the lazy-list sentinel work unchanged.
  return (
    <div className="schedule-layout">
      <aside className="schedule-sidebar" aria-label="Schedule filters">
        {dayChips}
        <div className="sidebar-search">{textInput}</div>
        <FilterSheet data={data} filters={filters} setFilters={setFilters} />
      </aside>
      <div className="schedule-main">{list}</div>
    </div>
  )
}
