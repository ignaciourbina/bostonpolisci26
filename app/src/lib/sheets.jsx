import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// Sheet-stack navigation. Each opened sheet pushes a history entry, so the
// browser/Android back button pops exactly one sheet; the back arrow and
// close button drive history rather than state directly, keeping the two
// in sync. popstate truncates the stack to the depth stored in the entry.

const SheetContext = createContext(null)

export function SheetProvider({ children }) {
  const [stack, setStack] = useState([]) // [{type: 'paper'|'session', id}]

  useEffect(() => {
    const onPop = (e) => {
      const depth = e.state?.sheetDepth ?? 0
      setStack((s) => s.slice(0, depth))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const push = useCallback((entry) => {
    setStack((s) => {
      const next = [...s, entry]
      window.history.pushState({ sheetDepth: next.length }, '')
      return next
    })
  }, [])

  const openPaper = useCallback((id) => push({ type: 'paper', id }), [push])
  const openSession = useCallback((id) => push({ type: 'session', id }), [push])
  const openTopic = useCallback((id) => push({ type: 'topic', id }), [push])
  const back = useCallback(() => window.history.back(), [])
  const closeAll = useCallback(() => {
    setStack((s) => {
      if (s.length > 0) window.history.go(-s.length)
      return s // popstate does the truncation
    })
  }, [])

  return (
    <SheetContext.Provider value={{ stack, openPaper, openSession, openTopic, back, closeAll }}>
      {children}
    </SheetContext.Provider>
  )
}

export function useSheets() {
  return useContext(SheetContext)
}
