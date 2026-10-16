"""0006: trend detection by ward type (README.md).

Run from the repository root:
    uv run python experiments/0006-trends-by-ward-type/sweep.py
"""

from __future__ import annotations

from pathlib import Path

from aei.dataset import load_records
from aei.detect import LIVE_SETTINGS, SURVEILLANCE_PAIRS, Pair, cluster_signals, episodes, in_detected_cluster, rising_trend
from aei.jscompat import js_str, table, to_exponential

DATA = Path("data/synthetic_microbiology_dataset")
OUT = Path("experiments/0006-trends-by-ward-type/out")
ALPHAS = [0.01, 0.001, 0.0001]
SETTINGS = [None, "in", "out"]


def label(setting: str | None) -> str:
    return "inpatient" if setting == "in" else "outpatient" if setting == "out" else "all units"


records, _ = load_records(DATA)
exclude = in_detected_cluster(cluster_signals(records))
pairs = [Pair(p.organism, p.antibiotic, p.specimen, s) for p in SURVEILLANCE_PAIRS for s in SETTINGS]

# First signal date per series and alpha; the smallest p seen.
rows = []
signalling = dict.fromkeys(ALPHAS, 0)
every = rising_trend(records, pairs, **{**LIVE_SETTINGS["rising_trend"], "alpha": 1}, exclude=exclude)
for pair in pairs:
    mine = [s for s in every if s.key == pair.key]
    min_p = min(1.0 if s.p is None else s.p for s in mine) if mine else float("inf")
    firsts = [next((s.date for s in mine if (1.0 if s.p is None else s.p) < a), "–") for a in ALPHAS]
    for a, f in zip(ALPHAS, firsts, strict=True):
        if f != "–":
            signalling[a] += 1
    if firsts[0] != "–":
        at_001 = len(episodes([s for s in mine if (1.0 if s.p is None else s.p) < 0.001]))
        name = f"{pair.organism} {pair.antibiotic}" + (f" ({pair.specimen})" if pair.specimen else "")
        rows.append([name, label(pair.setting), to_exponential(min_p, 1), *firsts, str(at_001)])

md = (
    f"# 0006 results\n\n{len(pairs)} series (22 pairs × all units, inpatient, outpatient). Isolates of clusters already detected "
    "are left out from the day of detection (D-022). All computed.\n\n"
)
md += f"Series signalling at least once: {'; '.join(f'alpha {js_str(a)}: {signalling[a]}' for a in ALPHAS)}.\n\n"
head = ["pair", "stratum", "smallest p", *(f"first at {js_str(a)}" for a in ALPHAS), "episodes at 0.001"]
md += f"### Every series that signals at alpha 0.01\n\n{table(head, rows)}\n"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "results.md").write_text(md)
print(md)
