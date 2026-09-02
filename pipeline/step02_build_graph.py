"""
Step 02 — Build the app data bundle: sessions + papers + semantic kNN graph.

Input:  ../../apsa2026_program.json  (1753 sessions, 5554 papers)
Output: ../app/public/data/app_data.json

The client does graph-RAG retrieval: lexical seed match over titles/authors,
then expansion along the edges precomputed here (semantic kNN between paper
titles, and between sessions), plus the structural edges it derives from the
program itself (paper-in-session, shared authors).

Embeddings: sentence-transformers all-MiniLM-L6-v2, cosine similarity,
top-K neighbors per node. Embeddings are NOT shipped; only the edge lists.
"""

import json
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

HERE = Path(__file__).resolve().parent
PROGRAM_JSON = HERE.parent.parent / "apsa2026_program.json"
OUT_PATH = HERE.parent / "app" / "public" / "data" / "app_data.json"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
PAPER_KNN_K = 8
SESSION_KNN_K = 6


def load_sessions() -> list[dict]:
    sessions = json.loads(PROGRAM_JSON.read_text())
    assert len(sessions) > 1000, f"unexpectedly few sessions: {len(sessions)}"
    return sessions


def flatten_papers(sessions: list[dict]) -> list[dict]:
    papers = []
    for s_idx, session in enumerate(sessions):
        for paper in session["papers"]:
            papers.append(
                {
                    "id": len(papers),
                    "session": s_idx,
                    "title": paper["title"],
                    "authors": paper["authors"],
                }
            )
    assert len(papers) > 4000, f"unexpectedly few papers: {len(papers)}"
    return papers


def paper_embed_text(paper: dict, session: dict) -> str:
    division = session.get("division") or ""
    return f'{paper["title"]}. Session: {session["title"]}. {division}'


def session_embed_text(session: dict) -> str:
    division = session.get("division") or ""
    paper_titles = "; ".join(p["title"] for p in session["papers"][:6])
    return f'{session["title"]}. {division}. {paper_titles}'


def knn_edges(embeddings: np.ndarray, k: int) -> list[list]:
    """Top-k cosine neighbors per row -> [i, j, weight] with i < j deduplicated."""
    normalized = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
    similarity = normalized @ normalized.T
    np.fill_diagonal(similarity, -1.0)
    edges = {}
    for i in range(similarity.shape[0]):
        top = np.argpartition(-similarity[i], k)[:k]
        for j in top:
            pair = (min(i, int(j)), max(i, int(j)))
            weight = float(similarity[i, j])
            edges[pair] = max(edges.get(pair, 0.0), weight)
    return [[i, j, round(w, 4)] for (i, j), w in sorted(edges.items())]


def main():
    sessions = load_sessions()
    papers = flatten_papers(sessions)

    model = SentenceTransformer(MODEL_NAME)
    paper_texts = [paper_embed_text(p, sessions[p["session"]]) for p in papers]
    session_texts = [session_embed_text(s) for s in sessions]
    paper_vectors = model.encode(paper_texts, batch_size=128, show_progress_bar=True)
    session_vectors = model.encode(session_texts, batch_size=128, show_progress_bar=True)

    bundle = {
        "sessions": sessions,
        "papers": papers,
        "paper_knn": knn_edges(paper_vectors, PAPER_KNN_K),
        "session_knn": knn_edges(session_vectors, SESSION_KNN_K),
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")))
    size_mb = OUT_PATH.stat().st_size / 1e6
    print(
        f"sessions: {len(sessions)} | papers: {len(papers)} | "
        f"paper edges: {len(bundle['paper_knn'])} | session edges: {len(bundle['session_knn'])} | "
        f"bundle: {size_mb:.1f} MB"
    )


if __name__ == "__main__":
    main()
