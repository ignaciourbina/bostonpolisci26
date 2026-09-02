import { useMemo, useState } from 'react'
import { DAYS, DAY_DATES, slotStartMinutes } from '../lib/data.js'
import { titleCase } from '../lib/calendar.js'
import SessionCard from './SessionCard.jsx'

export default function ScheduleTab({ data }) {
  const [day, setDay] = useState('Wednesday')
  const [division, setDivision] = useState('')
  const [text, setText] = useState('')

  const divisions = useMemo(() => {
    const set = new Set(data.sessions.map((s) => s.division).filter(Boolean))
    return [...set].sort()
  }, [data])

  const visible = useMemo(() => {
    const q = text.trim().toLowerCase()
    return data.sessions
      .map((s, i) => ({ ...s, _idx: i }))
      .filter((s) => s.day === day)
      .filter((s) => !division || s.division === division)
      .filter(
        (s) =>
          !q ||
          s.title.toLowerCase().includes(q) ||
          (s.division || '').toLowerCase().includes(q) ||
          (s.room || '').toLowerCase().includes(q) ||
          s.papers.some((p) => p.title.toLowerCase().includes(q)),
      )
      .sort((a, b) => slotStartMinutes(a.time) - slotStartMinutes(b.time))
  }, [data, day, division, text])

  const slots = useMemo(() => {
    const groups = []
    let current = null
    for (const s of visible) {
      if (!current || current.time !== s.time) {
        current = { time: s.time, sessions: [] }
        groups.push(current)
      }
      current.sessions.push(s)
    }
    return groups
  }, [visible])

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
        <select value={division} onChange={(e) => setDivision(e.target.value)} aria-label="Division">
          <option value="">All divisions</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {titleCase(d)}
            </option>
          ))}
        </select>
        <input placeholder="Filter titles, rooms…" value={text} onChange={(e) => setText(e.target.value)} />
      </div>

      {slots.length === 0 && <div className="empty">Nothing matches these filters.</div>}
      {slots.map((slot) => (
        <div key={slot.time}>
          <div className="slot-header">{slot.time}</div>
          {slot.sessions.map((s) => (
            <SessionCard key={s.session_number + s.title} session={s} />
          ))}
        </div>
      ))}
    </>
  )
}
