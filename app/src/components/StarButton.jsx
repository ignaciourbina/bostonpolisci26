import { useSyncExternalStore } from 'react'
import { subscribe, isStarred, toggleStar } from '../lib/agenda.js'

export default function StarButton({ kind, id, size = 'md' }) {
  const starred = useSyncExternalStore(subscribe, () => isStarred(kind, id))
  return (
    <button
      className={`star ${size} ${starred ? 'on' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        toggleStar(kind, id)
      }}
      aria-label={starred ? 'Remove from my agenda' : 'Add to my agenda'}
      aria-pressed={starred}
    >
      {starred ? '★' : '☆'}
    </button>
  )
}
