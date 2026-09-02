import { useSheets } from '../lib/sheets.jsx'
import { DAY_DATES } from '../lib/data.js'
import { calendarUrl, titleCase } from '../lib/calendar.js'
import StarButton from './StarButton.jsx'

export default function SessionSheet({ data, sessionId }) {
  const { openPaper, openSession, openPerson } = useSheets()
  const session = data.sessions[sessionId]
  const paperIds = data.sessionPapers[sessionId]
  const gcal = calendarUrl(session)

  const personButton = (entry, i) => {
    const pid = data.nameToPerson?.get(entry.name.toLowerCase())
    const label = `${entry.name}${entry.affiliation ? ` (${entry.affiliation})` : ''}`
    return pid != null ? (
      <button className="person-link" key={i} onClick={() => openPerson(pid)}>
        {label}
      </button>
    ) : (
      <span key={i}>{label}</span>
    )
  }

  const connected = (data.sessionLinks?.[sessionId] || []).slice(0, 6).map(({ id, w }) => {
    const shared = data.sessionPeople[sessionId].filter((p) => data.sessionPeople[id].includes(p))
    return { id, w, names: shared.slice(0, 2).map((p) => data.people[p].name) }
  })

  return (
    <div>
      {session.division && <div className="eyebrow">{titleCase(session.division)}</div>}
      <div className="sheet-head">
        <h2 className="sheet-title">
          {session.session_number} · {titleCase(session.title)}
        </h2>
        <StarButton kind="sessions" id={sessionId} />
      </div>
      <div className="meta">
        <span>
          {session.day} {DAY_DATES[session.day]} · {session.time}
        </span>
        {session.room && <span className="room">{session.room}</span>}
      </div>

      <div className="actions">
        {gcal && (
          <a className="btn primary" href={gcal} target="_blank" rel="noreferrer">
            + Add to Google Calendar
          </a>
        )}
      </div>

      {session.chairs.length > 0 && (
        <p className="people">
          <b>Chair:</b> {session.chairs.map(personButton)}
        </p>
      )}
      {session.discussants.length > 0 && (
        <p className="people">
          <b>Disc:</b> {session.discussants.map(personButton)}
        </p>
      )}
      {session.participants.length > 0 && (
        <p className="people">
          <b>Participants:</b> {session.participants.map(personButton)}
        </p>
      )}

      {paperIds.length > 0 && <div className="result-heading">Papers</div>}
      {paperIds.map((pid) => {
        const p = data.papers[pid]
        return (
          <button className="similar-row" key={pid} onClick={() => openPaper(pid)}>
            <span className="sim-title">{p.title}</span>
            <span className="sim-meta">{p.authors.map((a) => a.name).join(', ')}</span>
          </button>
        )
      })}

      {connected.length > 0 && <div className="result-heading">Connected sessions (shared people)</div>}
      {connected.map(({ id, w, names }) => {
        const s = data.sessions[id]
        return (
          <button className="similar-row" key={id} onClick={() => openSession(id)}>
            <span className="sim-title">
              {s.session_number} · {titleCase(s.title)}
            </span>
            <span className="sim-meta">
              via {names.join(', ')}
              {w > names.length ? ` +${w - names.length} more` : ''} · {s.day} {s.time.split(' to ')[0]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
