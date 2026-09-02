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
      <h2>How the data was built</h2>
      <p>
        This is an unofficial companion app, not an APSA product. The pipeline is fully transparent: the official
        APSA 2026 Annual Meeting program PDF, downloaded from APSA, was parsed into a structured dataset of sessions,
        papers, rooms, times, and participants. Titles are embedded with sentence-transformer models; nearest-neighbor
        similarities power Search and "Similar papers." The topic map is a three-level nested hierarchy (one Ward tree
        over all-mpnet-base-v2 embeddings, cut at 14 / 70 / 210 topics, labeled by class-based TF-IDF), with an
        STM-style structural layer: each topic's prevalence conditioned on metadata observables — division, day of
        conference, time of day, and poster-vs-panel format. The person layer maps who appears where: shared-panel
        links connect 90% of sessions into one component.
      </p>
      <p style={{ fontSize: '0.75rem' }}>
        Rooms and times reflect the program PDF at parse time; verify against the official APSA program for late
        changes. Not affiliated with or endorsed by APSA.
      </p>
    </div>
  )
}
