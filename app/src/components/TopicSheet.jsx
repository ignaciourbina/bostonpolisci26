import { useSheets } from '../lib/sheets.jsx'
import { DAY_DATES } from '../lib/data.js'

export default function TopicSheet({ data, topicId }) {
  const { openPaper } = useSheets()
  const sub = data.topics.sub[topicId]
  const macro = data.topics.macro[sub.macro]
  const paperIds = data.topicPapers[topicId]

  return (
    <div>
      <div className="eyebrow">Topic · in {macro.label}</div>
      <h2 className="sheet-title">{sub.label}</h2>
      <div className="meta">
        <span>{sub.size} papers</span>
        <span>{sub.terms.join(' · ')}</span>
      </div>

      <div className="result-heading">Papers</div>
      {paperIds.map((pid) => {
        const p = data.papers[pid]
        const s = data.sessions[p.session]
        return (
          <button className="similar-row" key={pid} onClick={() => openPaper(pid)}>
            <span className="sim-title">{p.title}</span>
            <span className="sim-meta">
              {p.authors.map((a) => a.name).join(', ')} · {s.day} {DAY_DATES[s.day]} {s.time.split(' to ')[0]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
