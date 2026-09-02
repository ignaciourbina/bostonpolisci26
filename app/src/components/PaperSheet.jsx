import { useSheets } from '../lib/sheets.jsx'
import { DAY_DATES } from '../lib/data.js'
import { titleCase } from '../lib/calendar.js'
import StarButton from './StarButton.jsx'

export default function PaperSheet({ data, paperId }) {
  const { openPaper, openSession } = useSheets()
  const paper = data.papers[paperId]
  const session = data.sessions[paper.session]

  const similar = [...data.paperNeighbors[paperId]]
    .sort((a, b) => b.w - a.w)
    .slice(0, 8)
    .map((nb) => ({ ...data.papers[nb.id], w: nb.w }))

  return (
    <div>
      <div className="sheet-head">
        <h2 className="sheet-title">{paper.title}</h2>
        <StarButton kind="papers" id={paperId} />
      </div>
      {paper.authors.map((a, i) => (
        <p className="people" key={i}>
          <b>{a.name}</b>
          {a.affiliation ? ` — ${a.affiliation}` : ''}
        </p>
      ))}

      <button className="context-line" onClick={() => openSession(paper.session)}>
        <span className="eyebrow">In session</span>
        {session.session_number} · {titleCase(session.title)}
        <span className="context-meta">
          {session.day} {DAY_DATES[session.day]} · {session.time}
          {session.room ? ` · ${session.room}` : ''}
        </span>
      </button>

      <div className="result-heading">Similar papers</div>
      {similar.map((p) => {
        const s = data.sessions[p.session]
        return (
          <button className="similar-row" key={p.id} onClick={() => openPaper(p.id)}>
            <span className="sim-title">{p.title}</span>
            <span className="sim-meta">
              {p.authors.map((a) => a.name).join(', ')} · {s.day} {s.time.split(' to ')[0]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
