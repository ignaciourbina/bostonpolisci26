import { useSyncExternalStore } from 'react'

// Single structural breakpoint for the desktop layout. 940 clears every
// landscape phone (iPhone Pro Max is 932 CSS px) so no phone ever gets the
// desktop chrome. Must stay textually identical to the desktop @media query
// in styles.css so CSS and matchMedia flip on the same frame.
export const DESKTOP_MQ = '(min-width: 940px)'

const mql = window.matchMedia(DESKTOP_MQ)

function subscribe(fn) {
  mql.addEventListener('change', fn)
  return () => mql.removeEventListener('change', fn)
}

export function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => mql.matches)
}
