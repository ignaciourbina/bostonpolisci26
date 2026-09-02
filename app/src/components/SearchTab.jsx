import { useEffect, useMemo, useState } from 'react'
import { buildSearch, graphRagQuery } from '../lib/graphrag.js'
import { useSheets } from '../lib/sheets.jsx'
import SessionCard from './SessionCard.jsx'
import StarButton from './StarButton.jsx'
import { DAY_DATES } from '../lib/data.js'
import { titleCase } from '../lib/calendar.js'

export default function SearchTab({ data }) {
  const { openPaper } = useSheets()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [segment, setSegment] = useState('papers')

  useEffect(() => {
    buildSearch(data)
  }, [data])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 220)
    return () => clearTimeout(t)
  }, [query])

  const results = useMemo(() => graphRagQuery(data, debounced), [data, debounced])
  const hasResults = results.papers.length > 0 || results.sessions.length > 0

  return (
    <>
      <div className="search-box">
        <input
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

      {hasResults && (
        <div className="segment-row" role="tablist" aria-label="Result type">
          <button
            className={`segment ${segment === 'papers' ? 'active' : ''}`}
            onClick={() => setSegment('papers')}
            role="tab"
            aria-selected={segment === 'papers'}
          >
            Papers · {results.papers.length}
          </button>
          <button
            className={`segment ${segment === 'sessions' ? 'active' : ''}`}
            onClick={() => setSegment('sessions')}
            role="tab"
            aria-selected={segment === 'sessions'}
          >
            Sessions · {results.sessions.length}
          </button>
        </div>
      )}

      {segment === 'papers' &&
        results.papers.map(({ paper, session, why }) => (
          <div className="card tappable" key={paper.id} onClick={() => openPaper(paper.id)}>
            <div className="card-row">
              <div className="card-main">
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
              <StarButton kind="papers" id={paper.id} />
            </div>
          </div>
        ))}

      {segment === 'sessions' &&
        results.sessions.map(({ session, sessionIndex, why }) => (
          <SessionCard key={sessionIndex} session={session} sessionId={sessionIndex} why={why} showDay />
        ))}
    </>
  )
}
