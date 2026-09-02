import { useSheets } from '../lib/sheets.jsx'
import { titleCase } from '../lib/calendar.js'
import { DAY_DATES } from '../lib/data.js'
import StarButton from './StarButton.jsx'

// Compact, tappable card: eyebrow, title, time + room, star.
// All detail lives in SessionSheet (progressive disclosure).

export default function SessionCard({ session, sessionId, why, showDay = false }) {
  const { openSession } = useSheets()

  return (
    <div className="card tappable" onClick={() => openSession(sessionId)}>
      <div className="card-row">
        <div className="card-main">
          {session.division && <div className="eyebrow">{titleCase(session.division)}</div>}
          <h3 className="title">
            {session.session_number} · {titleCase(session.title)}
          </h3>
          <div className="meta">
            {showDay && (
              <span>
                {session.day} {DAY_DATES[session.day]} · {session.time}
              </span>
            )}
            {!showDay && session.papers.length > 0 && <span>{session.papers.length} papers</span>}
            {session.room && <span className="room">{session.room}</span>}
          </div>
          {why && <div className="why">{why}</div>}
        </div>
        <StarButton kind="sessions" id={sessionId} />
      </div>
    </div>
  )
}
