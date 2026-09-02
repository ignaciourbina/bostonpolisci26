import { useEffect, useMemo, useState } from 'react'
import { buildSearch, graphRagQuery } from '../lib/graphrag.js'
import SessionCard from './SessionCard.jsx'
import { DAY_DATES } from '../lib/data.js'
import { titleCase } from '../lib/calendar.js'

export default function SearchTab({ data }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    buildSearch(data)
  }, [data])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 220)
    return () => clearTimeout(t)
  }, [query])

  const results = useMemo(() => graphRagQuery(data, debounced), [data, debounced])

  return (
    <>
      <div className="search-box">
        <input
          autoFocus
          placeholder="Your research topics — e.g. automation labor AI"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {!debounced && (
        <p className="hint">
          Type keywords from your research agenda. Matches expand through the program's knowledge graph — semantic
          similarity between paper titles, co-authorship, and shared sessions — and come back ranked.
        </p>
      )}

      {results.papers.length > 0 && (
        <>
          <div className="result-heading">Top papers</div>
          {results.papers.map(({ paper, session, why }) => (
            <div className="card" key={paper.id}>
              <div className="eyebrow">
                {session.day} {DAY_DATES[session.day]} · {session.time} {session.room ? `· ${session.room}` : ''}
              </div>
              <h3 className="title">{paper.title}</h3>
              <div className="meta">
                <span>{paper.authors.map((a) => a.name).join(', ')}</span>
              </div>
              <div className="meta">
                <span>
                  In {session.session_number}: {titleCase(session.title)}
                </span>
              </div>
              <div className="why">{why}</div>
            </div>
          ))}
        </>
      )}

      {results.sessions.length > 0 && (
        <>
          <div className="result-heading">Top sessions</div>
          {results.sessions.map(({ session, why }) => (
            <SessionCard key={session.session_number + session.title} session={session} why={why} />
          ))}
        </>
      )}
    </>
  )
}
