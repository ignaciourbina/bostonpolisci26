"""
Step 03 — Hierarchical topic model over paper titles.

Architecture (BERTopic's core, on native sklearn):
  1. Embed titles with all-MiniLM-L6-v2 (same model as step02).
  2. Level 1: Ward agglomerative clustering on the unit-normalized
     embeddings into N_MACRO macro topics.
  3. Level 2: within each macro topic, Ward again into subtopics
     (one subtopic per ~SUBTOPIC_TARGET_SIZE papers, min 2).
  4. Label every cluster by class-based TF-IDF (c-TF-IDF) over titles.

Empirical note (2026-09-02): the pure co-authorship graph is unusable as a
positioning space — 4,091 components, 3,437/5,554 papers isolated, largest
component 107. Topic structure must come from the text, not the network.

Output: ../app/public/data/topics.json
  { "macro":  [{id, label, terms, size, children:[subtopic ids]}],
    "sub":    [{id, macro, label, terms, size}],
    "paper_topics": [subtopic id per paper, aligned with app_data papers] }
"""

import json
import re
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.cluster import AgglomerativeClustering
from sklearn.feature_extraction.text import CountVectorizer

HERE = Path(__file__).resolve().parent
PROGRAM_JSON = HERE.parent.parent / "apsa2026_program.json"
OUT_PATH = HERE.parent / "app" / "public" / "data" / "topics.json"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
N_MACRO = 14
SUBTOPIC_TARGET_SIZE = 80
LABEL_TERMS = 4
EXTRA_STOPWORDS = {
    "politics", "political", "policy", "public", "evidence", "case", "analysis",
    "study", "effect", "effects", "role", "new", "toward", "towards", "using",
    "understanding", "states", "united",
}


def load_papers() -> list[dict]:
    sessions = json.loads(PROGRAM_JSON.read_text())
    papers = []
    for s in sessions:
        for p in s["papers"]:
            papers.append({"title": p["title"], "division": s.get("division") or ""})
    assert len(papers) > 4000
    return papers


def embed_titles(papers: list[dict]) -> np.ndarray:
    model = SentenceTransformer(MODEL_NAME)
    vectors = model.encode([p["title"] for p in papers], batch_size=128, show_progress_bar=True)
    return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


def ctfidf_labels(titles_by_cluster: dict[int, list[str]], n_terms: int) -> dict[int, list[str]]:
    """Class-based TF-IDF: one pseudo-document per cluster, tf * idf over classes."""
    cluster_ids = sorted(titles_by_cluster)
    docs = [" ".join(titles_by_cluster[c]) for c in cluster_ids]
    vectorizer = CountVectorizer(
        stop_words="english", ngram_range=(1, 2), min_df=2, token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z-]+\b"
    )
    counts = vectorizer.fit_transform(docs).toarray().astype(float)
    vocab = np.array(vectorizer.get_feature_names_out())

    tf = counts / counts.sum(axis=1, keepdims=True).clip(min=1)
    df = (counts > 0).sum(axis=0)
    idf = np.log(1 + len(docs) / df)
    scores = tf * idf

    keep = np.array([not any(w in EXTRA_STOPWORDS for w in term.split()) for term in vocab])
    labels = {}
    for row, cid in enumerate(cluster_ids):
        order = np.argsort(-scores[row])
        terms = [vocab[j] for j in order if keep[j]][: n_terms * 3]
        # resolve containment collisions in favor of the longer term
        # ("latin america" absorbs "latin"), otherwise keep by score order
        picked = []
        for t in terms:
            absorbed = False
            for i, p in enumerate(picked):
                if p in t:
                    picked[i] = t
                    absorbed = True
                    break
                if t in p:
                    absorbed = True
                    break
            if not absorbed:
                picked.append(t)
            if len(picked) >= n_terms and all(len(p.split()) > 0 for p in picked):
                pass
        labels[cid] = picked[:n_terms]
    return labels


def main():
    papers = load_papers()
    vectors = embed_titles(papers)

    macro_assign = AgglomerativeClustering(n_clusters=N_MACRO, linkage="ward").fit_predict(vectors)

    sub_assign = np.zeros(len(papers), dtype=int)
    sub_to_macro = {}
    next_sub = 0
    for m in range(N_MACRO):
        members = np.where(macro_assign == m)[0]
        n_sub = max(2, round(len(members) / SUBTOPIC_TARGET_SIZE))
        local = AgglomerativeClustering(n_clusters=min(n_sub, len(members)), linkage="ward").fit_predict(
            vectors[members]
        )
        for local_id in range(int(local.max()) + 1):
            sub_to_macro[next_sub + local_id] = int(m)
        sub_assign[members] = local + next_sub
        next_sub += int(local.max()) + 1

    macro_titles = {m: [papers[i]["title"] for i in np.where(macro_assign == m)[0]] for m in range(N_MACRO)}
    sub_titles = {s: [papers[i]["title"] for i in np.where(sub_assign == s)[0]] for s in range(next_sub)}
    macro_labels = ctfidf_labels(macro_titles, LABEL_TERMS)
    sub_labels = ctfidf_labels(sub_titles, LABEL_TERMS)

    ACRONYMS = {"ai", "us", "eu", "un", "nato", "llm", "llms", "lgbtq", "covid"}

    def pretty(terms):
        def cap(term):
            return " ".join(w.upper() if w in ACRONYMS else w.title() for w in term.split())

        return " · ".join(cap(t) for t in terms[:3])

    bundle = {
        "macro": [
            {
                "id": m,
                "label": pretty(macro_labels[m]),
                "terms": macro_labels[m],
                "size": int((macro_assign == m).sum()),
                "children": sorted(s for s, mm in sub_to_macro.items() if mm == m),
            }
            for m in range(N_MACRO)
        ],
        "sub": [
            {
                "id": s,
                "macro": sub_to_macro[s],
                "label": pretty(sub_labels[s]),
                "terms": sub_labels[s],
                "size": int((sub_assign == s).sum()),
            }
            for s in range(next_sub)
        ],
        "paper_topics": sub_assign.tolist(),
    }
    OUT_PATH.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")))
    print(f"macro topics: {N_MACRO} | subtopics: {next_sub} | bytes: {OUT_PATH.stat().st_size}")
    for m in bundle["macro"]:
        print(f'  [{m["size"]:4}] {m["label"]}')


if __name__ == "__main__":
    main()
