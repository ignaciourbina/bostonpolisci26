// My Agenda store — starred sessions and papers, persisted to localStorage.
// Tiny subscribe/notify pattern so any StarButton re-renders on change.

const KEY = 'bp26-agenda'

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    return { sessions: raw?.sessions ?? [], papers: raw?.papers ?? [] }
  } catch {
    return { sessions: [], papers: [] }
  }
}

let state = read()
const listeners = new Set()

function write(next) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage full / private mode — keep in-memory state
  }
  listeners.forEach((fn) => fn())
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function isStarred(kind, id) {
  return state[kind].includes(id)
}

export function toggleStar(kind, id) {
  const list = state[kind]
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  write({ ...state, [kind]: next })
}

export function agendaSnapshot() {
  return state
}
