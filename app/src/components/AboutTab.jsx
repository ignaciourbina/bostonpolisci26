export default function AboutTab() {
  return (
    <div className="center-panel">
      <h2>About</h2>
      <p>
        The full APSA 2026 Boston program — 1,753 sessions, 5,554 papers — parsed into a machine-readable dataset and
        served through a knowledge-graph search: semantic similarity between paper titles, co-authorship links, and
        session structure.
      </p>
      <p>
        Built by <a href="https://www.ignacio-urbina.com/">Ignacio Urbina</a>, Ph.D. candidate in Political Science at
        Stony Brook University. Research: the political economy of AI and automation, public opinion on AI, and
        human-AI agency and coordination.
      </p>
      <p>
        <a href="https://www.ignacio-urbina.com/">www.ignacio-urbina.com</a>
      </p>
      <p style={{ fontSize: '0.75rem' }}>
        Unofficial companion. Data from the public APSA 2026 program; verify rooms and times against the official
        program. Not affiliated with APSA.
      </p>
    </div>
  )
}
