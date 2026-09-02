import { useEffect, useRef, useState } from 'react'

// Generic bottom sheet. Dismiss: backdrop tap, swipe down on the grab zone,
// Esc, or the browser/Android back button (history integration lives in
// App.jsx's sheet stack — this component only renders and reports "close").

export default function BottomSheet({ onClose, onBack, children }) {
  const sheetRef = useRef(null)
  const dragStart = useRef(null)
  const [dragY, setDragY] = useState(0)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const onTouchStart = (e) => {
    dragStart.current = e.touches[0].clientY
  }
  const onTouchMove = (e) => {
    if (dragStart.current == null) return
    const dy = e.touches[0].clientY - dragStart.current
    if (dy > 0) setDragY(dy)
  }
  const onTouchEnd = () => {
    if (dragY > 90) onClose()
    setDragY(0)
    dragStart.current = null
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        ref={sheetRef}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sheet-grab" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="sheet-handle" />
        </div>
        <div className="sheet-toolbar">
          {onBack ? (
            <button className="sheet-nav" onClick={onBack} aria-label="Back">
              ←
            </button>
          ) : (
            <span />
          )}
          <button className="sheet-nav" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
