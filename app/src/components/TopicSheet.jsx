import { useSheets } from '../lib/sheets.jsx'
import { DAY_DATES } from '../lib/data.js'
import { titleCase } from '../lib/calendar.js'

function PaperRow({ data, pid, onOpen }) {
  const p = data.papers[pid]
  const s = data.sessions[p.session]
  return (
    <button className="similar-row" onClick={() => onOpen(pid)}>
      <span className="sim-title">{p.title}</span>
      <span className="sim-meta">
        {p.authors.map((a) => a.name).join(', ')} · {s.day} {DAY_DATES[s.day]} {s.time.split(' to ')[0]}
      </span>
    </button>
  )
}

export default function TopicSheet({ data, topicId }) {
  const { openPaper } = useSheets()
  const sub = data.topics.sub[topicId]
  const macro = data.topics.macro[sub.macro]
  const paperIds = data.topicPapers[topicId]

  const days = sub.days || {}
  const maxDay = Math.max(1, ...Object.values(days))
  const micros = (sub.micro_children || []).filter((mi) => data.microPapers?.[mi]?.length > 0)

  return (
    <div>
      <div className="eyebrow">Topic · in {macro.label}</div>
      <h2 className="sheet-title">{sub.label}</h2>
      <div className="meta">
        <span>{sub.size} papers</span>
        <span>{sub.terms.join(' · ')}</span>
      </div>

      {Object.keys(days).length > 0 && (
        <div className="day-bars">
          {Object.entries(days).map(([d, n]) => (
            <div className="day-bar" key={d}>
              <span className="db-label">{d.slice(0, 3)}</span>
              <span className="db-track">
                <span className="db-fill" style={{ width: `${(100 * n) / maxDay}%` }} />
              </span>
              <span className="db-n">{n}</span>
            </div>
          ))}
        </div>
      )}

      {sub.divisions?.length > 0 && (
        <p className="people">
          <b>Concentrated in:</b>{' '}
          {sub.divisions.map(([div, lift, n]) => `${titleCase(div)} (${lift}×, ${n})`).join(' · ')}
        </p>
      )}
      {sub.conditional?.length > 0 && (
        <p className="people conditional-line">Conditional prevalence: {sub.conditional.join(' · ')}</p>
      )}

      {micros.length > 1 ? (
        micros.map((mi) => (
          <div key={mi}>
            <div className="result-heading">
              {data.topics.micro[mi].label} · {data.microPapers[mi].length}
            </div>
            {data.microPapers[mi].map((pid) => (
              <PaperRow key={pid} data={data} pid={pid} onOpen={openPaper} />
            ))}
          </div>
        ))
      ) : (
        <>
          <div className="result-heading">Papers</div>
          {paperIds.map((pid) => (
            <PaperRow key={pid} data={data} pid={pid} onOpen={openPaper} />
          ))}
        </>
      )}
    </div>
  )
}
