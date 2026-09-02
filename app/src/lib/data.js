// Loads app_data.json once and derives the in-memory graph indexes.

let cache = null

export async function loadData() {
  if (cache) return cache
  const res = await fetch(`${import.meta.env.BASE_URL}data/app_data.json`)
  if (!res.ok) throw new Error(`data load failed: ${res.status}`)
  const raw = await res.json()
  cache = buildIndexes(raw)
  return cache
}

function buildIndexes(raw) {
  const { sessions, papers, paper_knn, session_knn } = raw

  // paper -> semantic neighbors [{id, w}]
  const paperNeighbors = papers.map(() => [])
  for (const [i, j, w] of paper_knn) {
    paperNeighbors[i].push({ id: j, w })
    paperNeighbors[j].push({ id: i, w })
  }

  const sessionNeighbors = sessions.map(() => [])
  for (const [i, j, w] of session_knn) {
    sessionNeighbors[i].push({ id: j, w })
    sessionNeighbors[j].push({ id: i, w })
  }

  // author name -> paper ids (co-authorship edges)
  const authorPapers = new Map()
  for (const p of papers) {
    for (const a of p.authors) {
      const key = a.name.toLowerCase()
      if (!authorPapers.has(key)) authorPapers.set(key, [])
      authorPapers.get(key).push(p.id)
    }
  }

  // session -> its paper ids
  const sessionPapers = sessions.map(() => [])
  for (const p of papers) sessionPapers[p.session].push(p.id)

  return { sessions, papers, paperNeighbors, sessionNeighbors, authorPapers, sessionPapers }
}

export const DAYS = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_DATES = { Wednesday: 'Sep 2', Thursday: 'Sep 3', Friday: 'Sep 4', Saturday: 'Sep 5', Sunday: 'Sep 6' }

export function slotStartMinutes(time) {
  const m = (time || '').match(/(\d{1,2}):(\d{2})\s*([AP]M)/i)
  if (!m) return 0
  let h = parseInt(m[1], 10)
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
  return h * 60 + parseInt(m[2], 10)
}
