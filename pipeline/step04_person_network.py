"""
Step 04 — Person network layer: who appears where, and which sessions connect.

Empirical basis (2026-09-02): pure co-authorship is shattered (84% of papers
in components of <=3), but the shared-panel person network — authors, chairs,
discussants, participants — has a giant component covering 90% of sessions
and 99% of papers, with 6,572 session-session bridge edges.

Output: ../app/public/data/people.json
  people:        [{name, affiliation, appearances: [{session, role, paper?}]}]
                 only people with 2+ appearances (the bridges), plus all authors
  paper_authors: [[person ids] per paper]           (aligned with app_data papers)
  session_people:[[person ids] per session]         (any role)
  session_links: [[si, sj, weight]]                 sessions sharing >=1 person
"""

import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROGRAM_JSON = HERE.parent.parent / "apsa2026_program.json"
OUT_PATH = HERE.parent / "app" / "public" / "data" / "people.json"

ROLE_OF = {"chairs": "chair", "discussants": "discussant", "participants": "participant"}


def main():
    sessions = json.loads(PROGRAM_JSON.read_text())

    key_of = {}
    people = []

    def person_id(name: str, affiliation: str) -> int:
        key = name.lower().strip()
        if key not in key_of:
            key_of[key] = len(people)
            people.append({"name": name, "affiliation": affiliation or "", "appearances": []})
        pid = key_of[key]
        if affiliation and not people[pid]["affiliation"]:
            people[pid]["affiliation"] = affiliation
        return pid

    paper_authors = []
    session_people = [[] for _ in sessions]
    paper_counter = 0
    for si, s in enumerate(sessions):
        seen_here = set()
        for field, role in ROLE_OF.items():
            for entry in s[field]:
                pid = person_id(entry["name"], entry.get("affiliation", ""))
                people[pid]["appearances"].append({"session": si, "role": role})
                seen_here.add(pid)
        for paper in s["papers"]:
            author_ids = []
            for a in paper["authors"]:
                pid = person_id(a["name"], a.get("affiliation", ""))
                people[pid]["appearances"].append({"session": si, "role": "author", "paper": paper_counter})
                author_ids.append(pid)
                seen_here.add(pid)
            paper_authors.append(author_ids)
            paper_counter += 1
        session_people[si] = sorted(seen_here)

    # session-session links weighted by number of shared people
    pair_weight = defaultdict(int)
    for p in people:
        session_set = sorted({a["session"] for a in p["appearances"]})
        for i in range(len(session_set)):
            for j in range(i + 1, len(session_set)):
                pair_weight[(session_set[i], session_set[j])] += 1
    session_links = [[si, sj, w] for (si, sj), w in sorted(pair_weight.items())]

    bundle = {
        "people": people,
        "paper_authors": paper_authors,
        "session_people": session_people,
        "session_links": session_links,
    }
    OUT_PATH.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")))
    multi = sum(1 for p in people if len({a["session"] for a in p["appearances"]}) > 1)
    print(
        f"people: {len(people)} | multi-session: {multi} | papers: {paper_counter} | "
        f"links: {len(session_links)} | bytes: {OUT_PATH.stat().st_size}"
    )


if __name__ == "__main__":
    main()
