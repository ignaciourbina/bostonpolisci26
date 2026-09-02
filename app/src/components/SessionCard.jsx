import { useState } from 'react'
import { calendarUrl, titleCase } from '../lib/calendar.js'
import { DAY_DATES } from '../lib/data.js'

export default function SessionCard({ session, why, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const gcal = calendarUrl(session)

  return (
    <div className="card">
      {session.division && <div className="eyebrow">{titleCase(session.division)}</div>}
      <h3 className="title" onClick={() => setOpen(!open)}>
        {session.session_number} · {titleCase(session.title)}
      </h3>
      <div className="meta">
        <span>
          {session.day} {DAY_DATES[session.day]} · {session.time}
        </span>
        {session.room && <span className="room">{session.room}</span>}
      </div>
      {why && <div className="why">{why}</div>}

      {open && (
        <div className="body">
          {session.chairs.length > 0 && (
            <p className="people">
              <b>Chair:</b> {session.chairs.map((c) => c.name).join(', ')}
            </p>
          )}
          {session.discussants.length > 0 && (
            <p className="people">
              <b>Disc:</b> {session.discussants.map((d) => d.name).join(', ')}
            </p>
          )}
          {session.participants.length > 0 && (
            <p className="people">
              <b>Participants:</b> {session.participants.map((p) => p.name).join(', ')}
            </p>
          )}
          {session.papers.map((p, i) => (
            <div className="paper" key={i}>
              <p className="p-title">{p.title}</p>
              <p className="p-authors">
                {p.authors.map((a) => `${a.name}${a.affiliation ? ` (${a.affiliation})` : ''}`).join(', ')}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="actions">
        <button className="btn" onClick={() => setOpen(!open)}>
          {open ? 'Hide details' : `Details${session.papers.length ? ` · ${session.papers.length} papers` : ''}`}
        </button>
        {gcal && (
          <a className="btn primary" href={gcal} target="_blank" rel="noreferrer">
            + Calendar
          </a>
        )}
      </div>
    </div>
  )
}
