"""0007: detector sensitivity on injected clusters and sampling gaps (README.md).

Run from the repository root:
    uv run python experiments/0007-injected-events/inject.py
The trials themselves are in libs/utils/py/aei/inject.py.
"""

from __future__ import annotations

import time
from pathlib import Path

from aei.coverage import wilson
from aei.dataset import load_records
from aei.inject import Trial, clones, cluster_trial, gap_trial
from aei.jscompat import js_round, mulberry32, table, to_fixed

DATA = Path("data/synthetic_microbiology_dataset")
OUT = Path("experiments/0007-injected-events/out")
TRIALS = 40
SIZE = {
    "ED": "large",
    "PHC-N": "large",
    "PHC-S": "large",
    "MED-A": "medium",
    "SURG": "medium",
    "URO": "medium",
    "GER": "medium",
    "MED-B": "small",
    "ICU": "small",
}

records, cultures = load_records(DATA)
rand = mulberry32(2026)
sources = clones(records)

trials: list[Trial] = []
t0 = time.perf_counter()
n = 0
for k in (0, 2, 3, 4, 6):
    for _ in range(TRIALS):
        trials.append(cluster_trial(records, sources, rand, k, n))
        n += 1
for days, halve in ((0, False), (2, False), (3, False), (5, False), (7, False), (7, True)):
    for _ in range(TRIALS):
        trials.append(gap_trial(cultures, rand, days, halve))
seconds = to_fixed(time.perf_counter() - t0, 1)


def median(xs: list[int]) -> int | None:
    s = sorted(xs)
    return s[(len(s) - 1) >> 1] if s else None


def rate(ts: list[Trial]) -> str:
    k = sum(1 for t in ts if t.detected)
    lo, hi = wilson(k, len(ts))
    return f"{k}/{len(ts)} ({js_round(100 * lo)}–{js_round(100 * hi)} %)"


rows = []
for s in dict.fromkeys(t.setting for t in trials):
    ts = [t for t in trials if t.setting == s]
    delays = [t.delay for t in ts if t.delay is not None]
    by_size = []
    for z in ("large", "medium", "small"):
        sub = [t for t in ts if SIZE[t.unit] == z]
        by_size.append(f"{sum(1 for t in sub if t.detected)}/{len(sub)}")
    med = median(delays)
    rows.append([s, rate(ts), "–" if med is None else med, f"{min(delays)}–{max(delays)}" if delays else "–", *by_size])

md = (
    f"# 0007 results\n\n{TRIALS} trials per setting, seed 2026, live settings (D-020). Detection rate with a 95 % Wilson interval; "
    "delay in days from the first injected case (clusters) or the first missing day (gaps) to the first signal; large units ED, "
    "PHC-N, PHC-S; medium MED-A, SURG, URO, GER; small MED-B, ICU. Controls inject or remove nothing and show how often a matching "
    f"signal appears by chance. All computed. Run time {seconds} s.\n\n"
    f"{table(['setting', 'detected', 'median delay', 'delay range', 'large units', 'medium units', 'small units'], rows)}\n"
)
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "results.md").write_text(md)
print(md)
