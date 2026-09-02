import { useSheets } from '../lib/sheets.jsx'
import { DAY_DATES, slotStartMinutes, DAYS } from '../lib/data.js'
import { titleCase } from '../lib/calendar.js'

export default function PersonSheet({ data, personId }) {
  const { openSession, openPaper } = useSheets()
  const person = data.people[personId]

  // group appearances by session, combining roles
  const bySession = new Map()
  for (const a of person.appearances) {
    if (!bySession.has(a.session)) bySession.set(a.session, { roles: new Set(), papers: [] })
    const entry = bySession.get(a.session)
    entry.roles.add(a.role)
    if (a.paper != null) entry.papers.push(a.paper)
  }
  const ordered = [...bySession.entries()].sort((a, b) => {
    const sa = data.sessions[a[0]]
    const sb = data.sessions[b[0]]
    const dayDiff = DAYS.indexOf(sa.day) - DAYS.indexOf(sb.day)
    return dayDiff !== 0 ? dayDiff : slotStartMinutes(sa.time) - slotStartMinutes(sb.time)
  })

  return (
    <div>
      <div className="eyebrow">Person</div>
      <h2 className="sheet-title">{person.name}</h2>
      {person.affiliation && <div className="meta">{person.affiliation}</div>}

      <div className="result-heading">
        Appears in {ordered.length} session{ordered.length === 1 ? '' : 's'}
      </div>
      {ordered.map(([sid, entry]) => {
        const s = data.sessions[sid]
        return (
          <div key={sid}>
            <button className="similar-row" onClick={() => openSession(sid)}>
              <span className="sim-title">
                {[...entry.roles].join(' + ')} · {s.session_number} {titleCase(s.title)}
              </span>
              <span className="sim-meta">
                {s.day} {DAY_DATES[s.day]} · {s.time} {s.room ? `· ${s.room}` : ''}
              </span>
            </button>
            {entry.papers.map((pid) => (
              <button className="similar-row indent" key={pid} onClick={() => openPaper(pid)}>
                <span className="sim-title">{data.papers[pid].title}</span>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
