import { useMemo, useState } from 'react'
import { titleCase } from '../lib/calendar.js'
import { slotStartMinutes } from '../lib/data.js'

export const VENUES = ['Hynes', 'Sheraton', 'Marriott', 'Westin']
export const DAYPARTS = [
  { id: 'morning', label: 'Morning', test: (m) => m < 12 * 60 },
  { id: 'afternoon', label: 'Afternoon', test: (m) => m >= 12 * 60 && m < 17 * 60 },
  { id: 'evening', label: 'Evening', test: (m) => m >= 17 * 60 },
]

export function sessionVenue(session) {
  const room = session.room || ''
  return VENUES.find((v) => room.startsWith(v)) || null
}

export function sessionDaypart(session) {
  const m = slotStartMinutes(session.time)
  return DAYPARTS.find((dp) => dp.test(m))?.id
}

export default function FilterSheet({ data, day, filters, setFilters }) {
  const [divisionQuery, setDivisionQuery] = useState('')

  const divisionCounts = useMemo(() => {
    const counts = new Map()
    for (const s of data.sessions) {
      if (s.day !== day || !s.division) continue
      counts.set(s.division, (counts.get(s.division) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [data, day])

  const visibleDivisions = divisionCounts.filter(
    ([d]) => !divisionQuery || d.toLowerCase().includes(divisionQuery.toLowerCase()),
  )

  const toggle = (key, value) => {
    setFilters((f) => ({ ...f, [key]: f[key] === value ? null : value }))
  }

  return (
    <div>
      <h2 className="sheet-title">Filters</h2>

      <div className="result-heading">Time of day</div>
      <div className="option-row">
        {DAYPARTS.map((dp) => (
          <button
            key={dp.id}
            className={`chip ${filters.daypart === dp.id ? 'active' : ''}`}
            onClick={() => toggle('daypart', dp.id)}
          >
            {dp.label}
          </button>
        ))}
      </div>

      <div className="result-heading">Venue</div>
      <div className="option-row">
        {VENUES.map((v) => (
          <button key={v} className={`chip ${filters.venue === v ? 'active' : ''}`} onClick={() => toggle('venue', v)}>
            {v}
          </button>
        ))}
      </div>

      <div className="result-heading">Division</div>
      <input
        className="division-search"
        placeholder="Find a division…"
        value={divisionQuery}
        onChange={(e) => setDivisionQuery(e.target.value)}
      />
      <div className="division-list">
        {visibleDivisions.map(([d, n]) => (
          <button
            key={d}
            className={`division-option ${filters.division === d ? 'active' : ''}`}
            onClick={() => toggle('division', d)}
          >
            <span>{titleCase(d)}</span>
            <span className="count">{n}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
