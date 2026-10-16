"""0011: detector sensitivity on injected clusters of common profiles (README.md).

Run from the repository root:
    uv run python experiments/0011-common-profile-injections/run.py
The trials themselves are in libs/utils/py/aei/inject.py.
"""

from __future__ import annotations

import time
from pathlib import Path

from aei.coverage import wilson
from aei.dataset import load_records
from aei.inject import CLUSTER_AVOID, COMMON_KINDS, Trial, _pick_int, common_group, draw_start, inject_cluster
from aei.detect import profile_of
from aei.jscompat import js_round, mulberry32, table

DATA = Path("data/synthetic_microbiology_dataset")
OUT = Path("experiments/0011-common-profile-injections/out")
SEEDS = (2026, 2027, 2028)
TRIALS = 20  # per seed, arm and k; half in each stratum
SIZES = (0, 3, 4, 6, 8)
LARGE = ("ED", "PHC-N", "PHC-S")
OTHER = ("MED-A", "MED-B", "SURG", "URO", "ICU", "GER")

records, _ = load_records(DATA)
t0 = time.perf_counter()
cpu0 = time.process_time()
rows_raw: list[tuple[int, str, int, str, Trial, str]] = []  # seed, arm, k, stratum, trial, source description
n = 0
for seed in SEEDS:
    rand = mulberry32(seed)
    for arm in COMMON_KINDS:
        for k in SIZES:
            for i in range(TRIALS):
                stratum, units = ("large", LARGE) if i % 2 == 0 else ("other", OTHER)
                while True:
                    unit = units[_pick_int(rand, len(units))]
                    start = draw_start(rand, unit, CLUSTER_AVOID)
                    group = common_group(records, unit, start, arm)
                    if group:
                        break
                source = group[_pick_int(rand, len(group))]
                trial = inject_cluster(records, source, unit, start, rand, k, n, f"k = {k}")
                n += 1
                rows_raw.append((seed, arm, k, stratum, trial, f"{source.organism} {source.specimen} {profile_of(source)}"))
seconds = time.perf_counter() - t0
cpu = time.process_time() - cpu0


def median(xs: list[int]) -> int | None:
    s = sorted(xs)
    return s[(len(s) - 1) >> 1] if s else None


def rate(ts: list[Trial], strict: bool = False) -> str:
    k = sum(1 for t in ts if (t.strict if strict else t.detected))
    lo, hi = wilson(k, len(ts))
    return f"{k}/{len(ts)} ({js_round(100 * lo)}–{js_round(100 * hi)} %)"


rows = []
for arm in COMMON_KINDS:
    for k in SIZES:
        sub = [r for r in rows_raw if r[1] == arm and r[2] == k]
        ts = [r[4] for r in sub]
        per_seed = " / ".join(str(sum(1 for r in sub if r[0] == s and r[4].detected)) for s in SEEDS)
        strata = [f"{sum(1 for r in sub if r[3] == z and r[4].detected)}/{sum(1 for r in sub if r[3] == z)}" for z in ("large", "other")]
        med = median([t.delay for t in ts if t.delay is not None])
        rows.append([arm, "control" if k == 0 else k, rate(ts), per_seed, *strata, rate(ts, strict=True), "–" if med is None else med])

pooled = []
for arm in COMMON_KINDS:
    sub = [r for r in rows_raw if r[1] == arm and r[2] >= 4]
    large = [r[4] for r in sub if r[3] == "large"]
    pooled.append([arm, rate([r[4] for r in sub]), rate(large), rate([r[4] for r in sub if r[3] == "other"])])

sources: dict[tuple[str, str], dict[str, int]] = {}
for r in rows_raw:
    if r[2] == 4:
        group = sources.setdefault((r[1], r[3]), {})
        group[r[5]] = group.get(r[5], 0) + 1
source_lines = "\n".join(
    f"- {arm}, {stratum} units: " + "; ".join(f"{d} ({c})" for d, c in sorted(v.items(), key=lambda x: -x[1])[:4])
    for (arm, stratum), v in sources.items()
)

md = (
    f"# 0011 results\n\nSeeds {', '.join(map(str, SEEDS))}; {TRIALS} trials per seed, arm and k (half in the large units ED, PHC-N, "
    "PHC-S, half in the other six); live settings (D-020, D-022). Detected: 0007's rule (a profile- or phenotype-excess signal for "
    "the unit and the source's organism or phenotype within 28 days of the start); strict: a profile-excess signal for the exact "
    "injected profile. Rates pooled over seeds with a 95 % Wilson interval; per seed: detected out of "
    f"{TRIALS}. Delay in days from the first injected case. All computed. Run time {seconds:.1f} s wall, {cpu:.1f} s CPU.\n\n"
    f"{table(['arm', 'k', 'detected', 'per seed', 'large units', 'other units', 'strict', 'median delay'], rows)}\n\n"
    "## Clusters of 4 or more, pooled over k = 4, 6, 8\n\n"
    f"{table(['arm', 'all units', 'large units', 'other units'], pooled)}\n\n"
    "## Most frequent sources, k = 4 (organism, specimen, profile over AMP MEC TZP FOX CXM CRO CAZ MEM CIP TMP NIT VAN CLI)\n\n"
    f"{source_lines}\n"
)
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "results.md").write_text(md)
print(md)
