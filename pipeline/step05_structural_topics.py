"""
Step 05 — Structural hierarchical topic model (supersedes step03's output).

Upgrades over step03:
  1. Encoder: all-mpnet-base-v2 (768-d) instead of MiniLM (384-d).
  2. Hierarchy: ONE Ward tree over all titles, cut at three levels
     (L1 macro = 14, L2 sub = 70, L3 micro = 210). Nesting is guaranteed
     by construction — every micro sits inside exactly one sub, every sub
     inside one macro.
  3. Structural layer (STM-style prevalence conditioning): for each L2
     topic, topic prevalence conditional on metadata observables —
     division (lift), day-of-conference distribution, and a logistic
     regression of membership on day + daypart + poster format
     (statsmodels, only p<0.05 terms shipped).

Output: ../app/public/data/topics.json (same schema as step03 plus:
  sub[*].micro_children, sub[*].days, sub[*].divisions, sub[*].conditional,
  and paper_micro).
"""

import json
import re
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from scipy.cluster.hierarchy import cut_tree, linkage
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import CountVectorizer

HERE = Path(__file__).resolve().parent
PROGRAM_JSON = HERE.parent.parent / "apsa2026_program.json"
OUT_PATH = HERE.parent / "app" / "public" / "data" / "topics.json"

MODEL_NAME = "sentence-transformers/all-mpnet-base-v2"
LEVELS = {"macro": 14, "sub": 70, "micro": 210}
LABEL_TERMS = 4
DAYS = ["Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
EXTRA_STOPWORDS = {
    "politics", "political", "policy", "public", "evidence", "case", "analysis",
    "study", "effect", "effects", "role", "new", "toward", "towards", "using",
    "understanding", "states", "united",
}
ACRONYMS = {"ai", "us", "eu", "un", "nato", "llm", "llms", "lgbtq", "covid"}


def daypart(time_str: str) -> str:
    m = re.match(r"(\d{1,2}):(\d{2})\s*([AP]M)", time_str or "")
    if not m:
        return "morning"
    h = int(m.group(1)) % 12 + (12 if m.group(3) == "PM" else 0)
    return "morning" if h < 12 else ("afternoon" if h < 17 else "evening")


def load_papers() -> list[dict]:
    sessions = json.loads(PROGRAM_JSON.read_text())
    papers = []
    for s in sessions:
        for p in s["papers"]:
            papers.append(
                {
                    "title": p["title"],
                    "division": s.get("division") or "(no division)",
                    "day": s["day"],
                    "daypart": daypart(s["time"]),
                    "poster": int("POSTER" in s["title"].upper()),
                }
            )
    assert len(papers) > 4000
    return papers


def embed_titles(papers: list[dict]) -> np.ndarray:
    model = SentenceTransformer(MODEL_NAME)
    vectors = model.encode([p["title"] for p in papers], batch_size=64, show_progress_bar=True)
    return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


def nested_assignments(vectors: np.ndarray) -> dict[str, np.ndarray]:
    tree = linkage(vectors, method="ward")
    cuts = cut_tree(tree, n_clusters=[LEVELS["macro"], LEVELS["sub"], LEVELS["micro"]])
    return {"macro": cuts[:, 0], "sub": cuts[:, 1], "micro": cuts[:, 2]}


def ctfidf_labels(titles_by_cluster: dict[int, list[str]], n_terms: int) -> dict[int, list[str]]:
    cluster_ids = sorted(titles_by_cluster)
    docs = [" ".join(titles_by_cluster[c]) for c in cluster_ids]
    vectorizer = CountVectorizer(
        stop_words="english", ngram_range=(1, 2), min_df=2, token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z-]+\b"
    )
    counts = vectorizer.fit_transform(docs).toarray().astype(float)
    vocab = np.array(vectorizer.get_feature_names_out())
    tf = counts / counts.sum(axis=1, keepdims=True).clip(min=1)
    idf = np.log(1 + len(docs) / (counts > 0).sum(axis=0))
    scores = tf * idf
    keep = np.array([not any(w in EXTRA_STOPWORDS for w in term.split()) for term in vocab])

    labels = {}
    for row, cid in enumerate(cluster_ids):
        terms = [vocab[j] for j in np.argsort(-scores[row]) if keep[j]][: n_terms * 3]
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
        labels[cid] = picked[:n_terms]
    return labels


def pretty(terms: list[str]) -> str:
    def cap(term):
        return " ".join(w.upper() if w in ACRONYMS else w.title() for w in term.split())

    label = " · ".join(cap(t) for t in terms[:3])
    return re.sub(r"\bAi\b", "AI", label)


def division_lifts(members: pd.DataFrame, corpus: pd.DataFrame, top: int = 3) -> list[list]:
    base = corpus["division"].value_counts(normalize=True)
    obs = members["division"].value_counts()
    lifts = []
    for div, count in obs.items():
        if count < 4 or div == "(no division)":
            continue
        lifts.append([div, round(float((count / len(members)) / base[div]), 1), int(count)])
    return sorted(lifts, key=lambda x: -x[1])[:top]


def conditional_terms(membership: np.ndarray, corpus: pd.DataFrame) -> list[str]:
    """Logistic regression of topic membership on observables; p<.05 terms."""
    df = corpus.assign(y=membership)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fit = smf.logit("y ~ C(day) + C(daypart) + poster", data=df).fit(disp=0)
    except Exception:
        return []
    out = []
    for name, coef, p in zip(fit.params.index, fit.params.values, fit.pvalues.values):
        if name == "Intercept" or p >= 0.05:
            continue
        clean = name.replace("C(day)[T.", "").replace("C(daypart)[T.", "").replace("]", "")
        clean = "poster session" if clean == "poster" else clean
        out.append(f"{'more' if coef > 0 else 'less'} likely {clean}")
    return out


def main():
    papers = load_papers()
    corpus = pd.DataFrame(papers)
    vectors = embed_titles(papers)
    assign = nested_assignments(vectors)

    parent_sub = {}
    parent_macro = {}
    for i in range(len(papers)):
        parent_sub[int(assign["micro"][i])] = int(assign["sub"][i])
        parent_macro[int(assign["sub"][i])] = int(assign["macro"][i])

    labels = {}
    for level in LEVELS:
        titles = {}
        for i, p in enumerate(papers):
            titles.setdefault(int(assign[level][i]), []).append(p["title"])
        labels[level] = ctfidf_labels(titles, LABEL_TERMS)

    sub_entries = []
    for s_id in range(LEVELS["sub"]):
        mask = assign["sub"] == s_id
        members = corpus[mask]
        day_counts = members["day"].value_counts()
        sub_entries.append(
            {
                "id": s_id,
                "macro": parent_macro[s_id],
                "label": pretty(labels["sub"][s_id]),
                "terms": labels["sub"][s_id],
                "size": int(mask.sum()),
                "micro_children": sorted(m for m, ss in parent_sub.items() if ss == s_id),
                "days": {d: int(day_counts.get(d, 0)) for d in DAYS},
                "divisions": division_lifts(members, corpus),
                "conditional": conditional_terms(mask.astype(int), corpus),
            }
        )

    bundle = {
        "macro": [
            {
                "id": m,
                "label": pretty(labels["macro"][m]),
                "terms": labels["macro"][m],
                "size": int((assign["macro"] == m).sum()),
                "children": sorted(s for s, mm in parent_macro.items() if mm == m),
            }
            for m in range(LEVELS["macro"])
        ],
        "sub": sub_entries,
        "micro": [
            {
                "id": mi,
                "sub": parent_sub[mi],
                "label": pretty(labels["micro"][mi]),
                "terms": labels["micro"][mi],
                "size": int((assign["micro"] == mi).sum()),
            }
            for mi in range(LEVELS["micro"])
        ],
        "paper_topics": [int(x) for x in assign["sub"]],
        "paper_micro": [int(x) for x in assign["micro"]],
    }
    OUT_PATH.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")))
    print(f"L1 {LEVELS['macro']} | L2 {LEVELS['sub']} | L3 {LEVELS['micro']} | bytes {OUT_PATH.stat().st_size}")
    for m in bundle["macro"]:
        print(f'  [{m["size"]:4}] {m["label"]}')
    example = next(s for s in sub_entries if s["conditional"])
    print("example conditional:", example["label"], "->", example["conditional"], example["divisions"])


if __name__ == "__main__":
    main()
