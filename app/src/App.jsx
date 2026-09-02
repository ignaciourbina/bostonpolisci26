import { useEffect, useRef, useState } from 'react'
import { loadData } from './lib/data.js'
import { SheetProvider, useSheets } from './lib/sheets.jsx'
import ScheduleTab from './components/ScheduleTab.jsx'
import SearchTab from './components/SearchTab.jsx'
import AgendaTab from './components/AgendaTab.jsx'
import ShareTab from './components/ShareTab.jsx'
import AboutTab from './components/AboutTab.jsx'
import BottomSheet from './components/BottomSheet.jsx'
import PaperSheet from './components/PaperSheet.jsx'
import SessionSheet from './components/SessionSheet.jsx'
import TopicSheet from './components/TopicSheet.jsx'

const TABS = [
  { id: 'schedule', label: 'Schedule', icon: '🗓' },
  { id: 'search', label: 'Search', icon: '🔎' },
  { id: 'agenda', label: 'Agenda', icon: '★' },
  { id: 'share', label: 'Share', icon: '📱' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
]

function SheetHost({ data }) {
  const { stack, back, closeAll } = useSheets()
  if (stack.length === 0) return null
  const top = stack[stack.length - 1]
  return (
    <BottomSheet onClose={closeAll} onBack={stack.length > 1 ? back : null}>
      {top.type === 'paper' && <PaperSheet data={data} paperId={top.id} />}
      {top.type === 'session' && <SessionSheet data={data} sessionId={top.id} />}
      {top.type === 'topic' && <TopicSheet data={data} topicId={top.id} />}
    </BottomSheet>
  )
}

export default function App() {
  const [tab, setTab] = useState('schedule')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const scrollPositions = useRef({})

  useEffect(() => {
    loadData().then(setData).catch((e) => setError(String(e)))
  }, [])

  // Tabs stay mounted (spatial memory); restore each tab's scroll position.
  const switchTab = (next) => {
    scrollPositions.current[tab] = window.scrollY
    setTab(next)
    requestAnimationFrame(() => window.scrollTo(0, scrollPositions.current[next] || 0))
  }

  return (
    <SheetProvider>
      <div className="app-shell">
        <header className="app-header">
          <h1>APSA 2026 Boston</h1>
          <button className="sub sub-link" onClick={() => switchTab('about')}>
            Sep 2–6 · unofficial app (see details)
          </button>
        </header>

        {error && <div className="empty">Failed to load program data: {error}</div>}
        {!data && !error && <div className="loading">Loading 1,753 sessions…</div>}

        {data && (
          <>
            <div hidden={tab !== 'schedule'}>
              <ScheduleTab data={data} />
            </div>
            <div hidden={tab !== 'search'}>
              <SearchTab data={data} />
            </div>
            <div hidden={tab !== 'agenda'}>
              <AgendaTab data={data} />
            </div>
          </>
        )}
        <div hidden={tab !== 'share'}>
          <ShareTab />
        </div>
        <div hidden={tab !== 'about'}>
          <AboutTab />
        </div>

        <nav className="tab-bar">
          {TABS.map((t) => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => switchTab(t.id)}>
              <span className="icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {data && <SheetHost data={data} />}
      </div>
    </SheetProvider>
  )
}
