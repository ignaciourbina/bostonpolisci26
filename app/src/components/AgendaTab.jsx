import { useSyncExternalStore } from 'react'
import { subscribe, agendaSnapshot } from '../lib/agenda.js'
import { useSheets } from '../lib/sheets.jsx'
import { DAYS, DAY_DATES, slotStartMinutes } from '../lib/data.js'
import SessionCard from './SessionCard.jsx'

export default function AgendaTab({ data }) {
  const agenda = useSyncExternalStore(subscribe, agendaSnapshot)
  const { openPaper } = useSheets()

  // starred papers imply their session for the day view
  const sessionIds = new Set(agenda.sessions)
  const paperBySession = new Map()
  for (const pid of agenda.papers) {
    const sid = data.papers[pid].session
    sessionIds.add(sid)
    if (!paperBySession.has(sid)) paperBySession.set(sid, [])
    paperBySession.get(sid).push(pid)
  }

  const byDay = DAYS.map((day) => {
    const items = [...sessionIds]
      .filter((sid) => data.sessions[sid].day === day)
      .sort((a, b) => slotStartMinutes(data.sessions[a].time) - slotStartMinutes(data.sessions[b].time))
    return { day, items }
  }).filter((g) => g.items.length > 0)

  const overlaps = new Set()
  for (const g of byDay) {
    for (let i = 0; i < g.items.length - 1; i++) {
      const a = data.sessions[g.items[i]]
      const b = data.sessions[g.items[i + 1]]
      if (a.time === b.time) {
        overlaps.add(g.items[i])
        overlaps.add(g.items[i + 1])
      }
    }
  }

  if (byDay.length === 0) {
    return (
      <div className="center-panel">
        <h2>My agenda</h2>
        <p>
          Nothing starred yet. Tap the ☆ on any session or paper — in the schedule, in search results, or inside a
          detail view — and it lands here, organized by day.
        </p>
      </div>
    )
  }

  return (
    <>
      {byDay.map(({ day, items }) => (
        <div key={day}>
          <div className="slot-header">
            {day} · {DAY_DATES[day]}
          </div>
          {items.map((sid) => (
            <div key={sid}>
              {overlaps.has(sid) && <div className="overlap-note">⚠ overlaps with another starred session</div>}
              <SessionCard session={data.sessions[sid]} sessionId={sid} />
              {(paperBySession.get(sid) || []).map((pid) => (
                <button className="similar-row indent" key={pid} onClick={() => openPaper(pid)}>
                  <span className="sim-title">★ {data.papers[pid].title}</span>
                  <span className="sim-meta">{data.papers[pid].authors.map((a) => a.name).join(', ')}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
