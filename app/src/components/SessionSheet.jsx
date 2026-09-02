import { useSheets } from '../lib/sheets.jsx'
import { DAY_DATES } from '../lib/data.js'
import { calendarUrl, titleCase } from '../lib/calendar.js'
import StarButton from './StarButton.jsx'

export default function SessionSheet({ data, sessionId }) {
  const { openPaper } = useSheets()
  const session = data.sessions[sessionId]
  const paperIds = data.sessionPapers[sessionId]
  const gcal = calendarUrl(session)

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
          <b>Chair:</b> {session.chairs.map((c) => `${c.name}${c.affiliation ? ` (${c.affiliation})` : ''}`).join(', ')}
        </p>
      )}
      {session.discussants.length > 0 && (
        <p className="people">
          <b>Disc:</b>{' '}
          {session.discussants.map((d) => `${d.name}${d.affiliation ? ` (${d.affiliation})` : ''}`).join(', ')}
        </p>
      )}
      {session.participants.length > 0 && (
        <p className="people">
          <b>Participants:</b> {session.participants.map((p) => p.name).join(', ')}
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
    </div>
  )
}
