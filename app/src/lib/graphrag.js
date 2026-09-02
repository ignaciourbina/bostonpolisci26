// Graph-RAG retrieval, fully client-side.
//
// 1. Seed: fuzzy lexical match (Fuse.js) over paper titles/authors and
//    session titles/divisions.
// 2. Expand: propagate seed scores along graph edges —
//    semantic kNN (title embeddings, precomputed), co-authorship,
//    paper-in-session membership.
// 3. Rank: aggregate into a top-10 paper list and a top-10 session list,
//    each item carrying its provenance ("matched" vs "related via …").

import Fuse from 'fuse.js'

const SEMANTIC_DAMPING = 0.65
const COAUTHOR_DAMPING = 0.45
const SESSION_TO_PAPER_DAMPING = 0.5
const SESSION_SEMANTIC_DAMPING = 0.55

let fusePapers = null
let fuseSessions = null

export function buildSearch(data) {
  fusePapers = new Fuse(
    data.papers.map((p) => ({
      id: p.id,
      title: p.title,
      authors: p.authors.map((a) => a.name).join(' '),
      affiliations: p.authors.map((a) => a.affiliation).join(' '),
    })),
    {
      keys: [
        { name: 'title', weight: 0.6 },
        { name: 'authors', weight: 0.3 },
        { name: 'affiliations', weight: 0.1 },
      ],
      includeScore: true,
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 3,
    },
  )
  fuseSessions = new Fuse(
    data.sessions.map((s, i) => ({
      id: i,
      title: s.title,
      division: s.division || '',
      tags: (s.tags || []).join(' '),
    })),
    {
      keys: [
        { name: 'title', weight: 0.6 },
        { name: 'division', weight: 0.3 },
        { name: 'tags', weight: 0.1 },
      ],
      includeScore: true,
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 3,
    },
  )
}

export function graphRagQuery(data, query, topK = 10) {
  if (!query || query.trim().length < 2) return { papers: [], sessions: [] }

  const paperScores = new Map() // id -> {score, why}
  const sessionScores = new Map()

  const bump = (map, id, score, why) => {
    const cur = map.get(id)
    if (!cur || score > cur.score) map.set(id, { score, why })
  }

  // --- 1. lexical seeds ---
  const paperSeeds = fusePapers.search(query, { limit: 40 })
  for (const r of paperSeeds) {
    bump(paperScores, r.item.id, 1 - r.score, 'matched your query')
  }
  const sessionSeeds = fuseSessions.search(query, { limit: 25 })
  for (const r of sessionSeeds) {
    bump(sessionScores, r.item.id, 1 - r.score, 'matched your query')
  }

  // --- 2. graph expansion ---
  // semantic kNN from seed papers
  for (const [id, { score }] of [...paperScores]) {
    for (const nb of data.paperNeighbors[id]) {
      const s = score * nb.w * SEMANTIC_DAMPING
      const from = data.papers[id]
      bump(paperScores, nb.id, s, `semantically related to “${truncate(from.title)}”`)
    }
  }
  // co-authorship from seed papers
  for (const [id, { score }] of [...paperScores]) {
    for (const a of data.papers[id].authors) {
      for (const other of data.authorPapers.get(a.name.toLowerCase()) || []) {
        if (other !== id) {
          bump(paperScores, other, score * COAUTHOR_DAMPING, `same author: ${a.name}`)
        }
      }
    }
  }
  // session -> its papers
  for (const [sid, { score }] of [...sessionScores]) {
    for (const pid of data.sessionPapers[sid]) {
      bump(paperScores, pid, score * SESSION_TO_PAPER_DAMPING, `in matched session “${truncate(data.sessions[sid].title)}”`)
    }
  }
  // session semantic kNN
  for (const [sid, { score }] of [...sessionScores]) {
    for (const nb of data.sessionNeighbors[sid]) {
      bump(sessionScores, nb.id, score * nb.w * SESSION_SEMANTIC_DAMPING, `related to “${truncate(data.sessions[sid].title)}”`)
    }
  }
  // papers roll up into their sessions
  for (const [pid, { score }] of paperScores) {
    const sid = data.papers[pid].session
    const cur = sessionScores.get(sid)
    const rolled = score * 0.9
    if (!cur || rolled > cur.score) {
      sessionScores.set(sid, { score: rolled, why: `has paper “${truncate(data.papers[pid].title)}”` })
    }
  }

  const topPapers = [...paperScores]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, topK)
    .map(([id, meta]) => ({ paper: data.papers[id], session: data.sessions[data.papers[id].session], ...meta }))

  const topSessions = [...sessionScores]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, topK)
    .map(([id, meta]) => ({ session: data.sessions[id], sessionIndex: id, ...meta }))

  return { papers: topPapers, sessions: topSessions }
}

function truncate(s, n = 48) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
