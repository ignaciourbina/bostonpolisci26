import { useEffect, useMemo, useState } from 'react'
import { buildSearch, graphRagQuery } from '../lib/graphrag.js'
import { useSheets } from '../lib/sheets.jsx'
import SessionCard from './SessionCard.jsx'
import StarButton from './StarButton.jsx'
import { DAY_DATES } from '../lib/data.js'
import { titleCase } from '../lib/calendar.js'

function TopicBrowser({ data }) {
  const { openTopic } = useSheets()
  const [openMacro, setOpenMacro] = useState(null)
  if (!data.topics) return null

  return (
    <div className="topic-browser">
      <div className="result-heading">Browse by topic</div>
      {data.topics.macro.map((m) => (
        <div key={m.id}>
          <button
            className={`macro-row ${openMacro === m.id ? 'open' : ''}`}
            onClick={() => setOpenMacro(openMacro === m.id ? null : m.id)}
            aria-expanded={openMacro === m.id}
          >
            <span className="sim-title">{m.label}</span>
            <span className="macro-count">
              {m.size} {openMacro === m.id ? '▾' : '▸'}
            </span>
          </button>
          {openMacro === m.id &&
            m.children.map((subId) => {
              const sub = data.topics.sub[subId]
              return (
                <button className="similar-row indent" key={subId} onClick={() => openTopic(subId)}>
                  <span className="sim-title">{sub.label}</span>
                  <span className="sim-meta">{sub.size} papers</span>
                </button>
              )
            })}
        </div>
      ))}
    </div>
  )
}

export default function SearchTab({ data }) {
  const { openPaper, openPerson } = useSheets()
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
  const hasPeople = results.people.length > 0

  return (
    <>
      <div className="search-box">
        <input
          placeholder="Topics or people — e.g. automation labor AI, or an author"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {!debounced && (
        <>
          <p className="hint">
            Type keywords from your research agenda — matches expand through the program's knowledge graph — or an
            author's name to see everything they chair, present, or discuss. Or browse the topic map below, built by a
            hierarchical topic model over all 5,554 paper titles.
          </p>
          <TopicBrowser data={data} />
        </>
      )}

      {hasPeople && (
        <>
          <div className="result-heading">People</div>
          {results.people.map(({ personId, person }) => (
            <button className="similar-row" key={personId} onClick={() => openPerson(personId)}>
              <span className="sim-title">{person.name}</span>
              <span className="sim-meta">
                {person.affiliation ? `${person.affiliation} · ` : ''}
                {new Set(person.appearances.map((a) => a.session)).size} session
                {new Set(person.appearances.map((a) => a.session)).size === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </>
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
