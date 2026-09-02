import { useEffect, useState } from 'react'
import { loadData } from './lib/data.js'
import ScheduleTab from './components/ScheduleTab.jsx'
import SearchTab from './components/SearchTab.jsx'
import ShareTab from './components/ShareTab.jsx'
import AboutTab from './components/AboutTab.jsx'

const TABS = [
  { id: 'schedule', label: 'Schedule', icon: '🗓' },
  { id: 'search', label: 'Search', icon: '🔎' },
  { id: 'share', label: 'Share', icon: '📱' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
]

export default function App() {
  const [tab, setTab] = useState('schedule')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData().then(setData).catch((e) => setError(String(e)))
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>APSA 2026 Boston</h1>
        <span className="sub">Sep 2–6 · unofficial program</span>
      </header>

      {error && <div className="empty">Failed to load program data: {error}</div>}
      {!data && !error && <div className="loading">Loading 1,753 sessions…</div>}

      {data && tab === 'schedule' && <ScheduleTab data={data} />}
      {data && tab === 'search' && <SearchTab data={data} />}
      {tab === 'share' && <ShareTab />}
      {tab === 'about' && <AboutTab />}

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
