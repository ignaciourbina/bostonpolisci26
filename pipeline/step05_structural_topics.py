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
    "rethinking", "revisiting", "reimagining", "reexamining", "rereading",
    "reading", "beyond", "perspectives", "approach", "approaches", "lessons",
}
ACRONYMS = {"ai", "us", "eu", "un", "nato", "llm", "llms", "lgbtq", "covid", "prc", "imf", "fdi"}
BARE_UNIGRAM_BLOCKLIST = {"sexual"}  # adjective fragments that read wrong alone; bigrams stay allowed


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
    cache = HERE / "out" / "mpnet_title_embeddings.npy"
    if cache.exists():
        vectors = np.load(cache)
        assert vectors.shape[0] == len(papers), "embedding cache stale — delete it"
        return vectors
    model = SentenceTransformer(MODEL_NAME)
    vectors = model.encode([p["title"] for p in papers], batch_size=64, show_progress_bar=True)
    vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
    cache.parent.mkdir(exist_ok=True)
    np.save(cache, vectors)
    return vectors


def nested_assignments(vectors: np.ndarray) -> dict[str, np.ndarray]:
    tree = linkage(vectors, method="ward")
    cuts = cut_tree(tree, n_clusters=[LEVELS["macro"], LEVELS["sub"], LEVELS["micro"]])
    return {"macro": cuts[:, 0], "sub": cuts[:, 1], "micro": cuts[:, 2]}


def candidate_terms(
    titles_by_cluster: dict[int, list[str]], n_candidates: int = 20, min_coverage: float = 0.12
) -> dict[int, list[str]]:
    """Candidate label terms per cluster: c-TF-IDF weighted by coverage.

    Coverage = share of the cluster's titles containing the term. Pure c-TF-IDF
    rewards distinctiveness, so a proper noun in 4/22 titles ("Peru") can beat
    a term that actually describes the cluster. Weighting by sqrt(coverage) and
    flooring at min_coverage forces candidates to describe most members. Final
    selection among candidates is semantic (cosine to the topic centroid + MMR).
    """
    cluster_ids = sorted(titles_by_cluster)
    docs = [" ".join(titles_by_cluster[c]) for c in cluster_ids]
    vectorizer = CountVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        min_df=2,
        token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]+(?:-[a-zA-Z]+)*\b",
    )
    counts = vectorizer.fit_transform(docs).toarray().astype(float)
    vocab = np.array(vectorizer.get_feature_names_out())
    tf = counts / counts.sum(axis=1, keepdims=True).clip(min=1)
    idf = np.log(1 + len(docs) / (counts > 0).sum(axis=0))
    ctfidf = tf * idf
    keep = np.array(
        [
            not any(w in EXTRA_STOPWORDS for w in term.split()) and term not in BARE_UNIGRAM_BLOCKLIST
            for term in vocab
        ]
    )

    out = {}
    for row, cid in enumerate(cluster_ids):
        titles = titles_by_cluster[cid]
        title_presence = (vectorizer.transform(titles) > 0).toarray()
        coverage = title_presence.mean(axis=0)
        scores = ctfidf[row] * np.sqrt(coverage)
        eligible = keep & (coverage >= min_coverage)
        if eligible.sum() < n_candidates:  # tiny clusters: relax the floor rather than emit nothing
            eligible = keep & (coverage >= min_coverage / 2)
        if eligible.sum() < 4:
            eligible = keep
        out[cid] = [vocab[j] for j in np.argsort(-scores) if eligible[j]][:n_candidates]
    return out


def mmr_select(terms: list[str], term_vec: dict, centroid: np.ndarray, n_terms: int, lam: float = 0.75) -> list[str]:
    """Pick label terms semantically: relevance = cosine(term embedding, topic
    centroid), diversity via maximal marginal relevance. A term like "Peru"
    (peripheral to a corruption-centered cluster) loses to "corruption"
    (central), and near-synonyms ("elections"/"electoral") don't co-occur."""
    if not terms:
        return []
    embs = np.stack([term_vec[t] for t in terms])
    relevance = embs @ centroid
    picked = []
    while len(picked) < min(n_terms, len(terms)):
        best, best_score = None, -np.inf
        for i, t in enumerate(terms):
            if i in picked:
                continue
            if any(t in terms[j] or terms[j] in t for j in picked):
                continue
            if any(set(t.split()) & set(terms[j].split()) for j in picked):
                continue  # no word repeats across a label ("support climate" + "climate change")
            if any(t.split()[0][:6] == terms[j].split()[0][:6] for j in picked):
                continue  # same-stem pairs: democracy/democratic, gender/gendered
            redundancy = max((float(embs[i] @ embs[j]) for j in picked), default=0.0)
            if redundancy > 0.8:  # near-synonyms ("democracy"/"democratic") never co-occur
                continue
            score = lam * float(relevance[i]) - (1 - lam) * redundancy
            if score > best_score:
                best, best_score = i, score
        if best is None:
            break
        picked.append(best)
    return [terms[i] for i in picked]


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

    # Candidate terms per cluster (coverage-filtered c-TF-IDF), then semantic
    # selection: embed the candidate terms with the same encoder and pick by
    # cosine-to-centroid + MMR, so label terms are semantically central to the
    # cluster ("corruption" survives, incidental "Peru" does not).
    candidates = {}
    for level in ("sub", "micro"):
        titles = {}
        for i, p in enumerate(papers):
            titles.setdefault(int(assign[level][i]), []).append(p["title"])
        candidates[level] = candidate_terms(titles)

    macro_pool = {}
    for m in range(LEVELS["macro"]):
        children = [s for s, mm in parent_macro.items() if mm == m]
        pool = []
        for s in children:
            pool.extend(candidates["sub"][s][:10])
        macro_pool[m] = sorted(set(pool))

    unique_terms = sorted(
        {t for level in candidates for terms in candidates[level].values() for t in terms}
        | {t for pool in macro_pool.values() for t in pool}
    )
    model = SentenceTransformer(MODEL_NAME)
    term_embs = model.encode(unique_terms, batch_size=128, show_progress_bar=False)
    term_embs = term_embs / np.linalg.norm(term_embs, axis=1, keepdims=True)
    term_vec = dict(zip(unique_terms, term_embs))

    def centroid_of(mask: np.ndarray) -> np.ndarray:
        c = vectors[mask].mean(axis=0)
        return c / np.linalg.norm(c)

    labels = {"macro": {}, "sub": {}, "micro": {}}
    for level in ("sub", "micro"):
        for cid, terms in candidates[level].items():
            labels[level][cid] = mmr_select(terms, term_vec, centroid_of(assign[level] == cid), LABEL_TERMS)
    for m in range(LEVELS["macro"]):
        labels["macro"][m] = mmr_select(macro_pool[m], term_vec, centroid_of(assign["macro"] == m), LABEL_TERMS)

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
