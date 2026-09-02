import { useMemo, useState } from 'react'
import { DAYS, DAY_DATES, slotStartMinutes } from '../lib/data.js'
import { titleCase } from '../lib/calendar.js'
import SessionCard from './SessionCard.jsx'
import BottomSheet from './BottomSheet.jsx'
import FilterSheet, { sessionVenue, sessionDaypart, DAYPARTS } from './FilterSheet.jsx'

export default function ScheduleTab({ data }) {
  const [day, setDay] = useState('Wednesday')
  const [filters, setFilters] = useState({ division: null, venue: null, daypart: null, text: '' })
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const visible = useMemo(() => {
    const q = filters.text.trim().toLowerCase()
    return data.sessions
      .map((s, i) => ({ session: s, id: i }))
      .filter(({ session: s }) => s.day === day)
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
      .sort((a, b) => slotStartMinutes(a.session.time) - slotStartMinutes(b.session.time))
  }, [data, day, filters])

  const slots = useMemo(() => {
    const groups = []
    let current = null
    for (const item of visible) {
      if (!current || current.time !== item.session.time) {
        current = { time: item.session.time, items: [] }
        groups.push(current)
      }
      current.items.push(item)
    }
    return groups
  }, [visible])

  const activeChips = [
    filters.division && { key: 'division', label: titleCase(filters.division) },
    filters.venue && { key: 'venue', label: filters.venue },
    filters.daypart && { key: 'daypart', label: DAYPARTS.find((d) => d.id === filters.daypart)?.label },
  ].filter(Boolean)

  return (
    <>
      <div className="chip-row" role="tablist" aria-label="Day">
        {DAYS.map((d) => (
          <button key={d} className={`chip ${d === day ? 'active' : ''}`} onClick={() => setDay(d)}>
            {d.slice(0, 3)}
            <span className="d">{DAY_DATES[d]}</span>
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <button className="btn" onClick={() => setFilterSheetOpen(true)}>
          ⚙ Filters{activeChips.length > 0 ? ` · ${activeChips.length}` : ''}
        </button>
        <input
          placeholder="Filter titles, rooms…"
          value={filters.text}
          onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
        />
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

      <div className="hint count-line">
        {visible.length} session{visible.length === 1 ? '' : 's'}
      </div>

      {slots.length === 0 && <div className="empty">Nothing matches these filters.</div>}
      {slots.map((slot) => (
        <div key={slot.time}>
          <div className="slot-header">{slot.time}</div>
          {slot.items.map(({ session, id }) => (
            <SessionCard key={id} session={session} sessionId={id} />
          ))}
        </div>
      ))}

      {filterSheetOpen && (
        <BottomSheet onClose={() => setFilterSheetOpen(false)}>
          <FilterSheet data={data} filters={filters} setFilters={setFilters} />
        </BottomSheet>
      )}
    </>
  )
}
