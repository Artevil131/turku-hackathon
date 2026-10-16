"""0004: backtest coverage estimators on the next 28 days (README.md).

Run from the repository root:
    uv run python experiments/0004-coverage-estimators/backtest.py
"""

from __future__ import annotations

import math
from collections.abc import Callable
from pathlib import Path

from aei.counting import first_isolates
from aei.dataset import IsolateRecord, load_records
from aei.dates import add_days
from aei.domain import ANTIBIOTICS
from aei.eucast import effective_result, suits_specimen
from aei.jscompat import mulberry32, table, to_fixed

DATA = Path("data/synthetic_microbiology_dataset")
OUT = Path("experiments/0004-coverage-estimators/out")
FIRST_TARGET = "2024-09-30"
LAST_DAY = "2026-09-27"
SHRINK_YEAR = 20
SHRINK_MONTH = [5, 20, 50]
BOOTSTRAPS = 1000

records, _ = load_records(DATA)

# Covered (1) or not covered (0) for each isolate and antibiotic with a known result, in antibiotic order.
outcome: dict[str, dict[str, int]] = {}
for r in records:
    o = {}
    for a in ANTIBIOTICS:
        if not suits_specimen(a, r.specimen):
            continue
        e = effective_result(r, a)
        if e.basis == "untested":
            continue
        o[a] = 1 if e.result == "S" else 0
    outcome[r.isolate_id] = o

Counts = dict[str, list[int]]  # cell -> [k, n]


def tally(items: list[IsolateRecord], cell_of: Callable[[IsolateRecord, str], str]) -> Counts:
    m: Counts = {}
    for r in items:
        for a, y in outcome[r.isolate_id].items():
            c = m.setdefault(cell_of(r, a), [0, 0])
            c[0] += y
            c[1] += 1
    return m


def unit_cell(r: IsolateRecord, a: str) -> str:
    return f"{r.ward}|{r.specimen}|{a}"


def hosp_cell(r: IsolateRecord, a: str) -> str:
    return f"{r.specimen}|{a}"


def first_in(start: str, end: str) -> list[IsolateRecord]:
    return first_isolates([r for r in records if start <= r.sample_date <= end], (start, end))


ESTIMATORS = [
    "1 unit 28 d raw",
    "2 unit 365 d raw",
    "3 hospital 365 d (baseline)",
    "4 hospital 28 d",
    f"5 unit 365 d shrunk to hospital (M {SHRINK_YEAR})",
    *(f"6 unit 28 d shrunk to 5 (M {m})" for m in SHRINK_MONTH),
]
BASE = 2
SUBSETS = ["all", "small", "no URO"]
# window -> subset -> {"brier": [...], "logloss": [...], "n": int}
per_window: list[dict[str, dict]] = []
fallbacks1 = fallbacks2 = predictions = 0


def clip(p: float) -> float:
    return min(0.999, max(0.001, p))


def ratio(c: list[int] | None) -> float | None:
    return c[0] / c[1] if c and c[1] > 0 else None


start = FIRST_TARGET
while add_days(start, 27) <= LAST_DAY:
    end = add_days(start, 27)
    target = first_in(start, end)
    f28 = first_in(add_days(start, -28), add_days(start, -1))
    f365 = first_in(add_days(start, -365), add_days(start, -1))
    u28, u365, h28, h365 = tally(f28, unit_cell), tally(f365, unit_cell), tally(f28, hosp_cell), tally(f365, hosp_cell)
    acc = {s: {"brier": [0.0] * len(ESTIMATORS), "logloss": [0.0] * len(ESTIMATORS), "n": 0} for s in SUBSETS}
    for r in target:
        for a, y in outcome[r.isolate_id].items():
            uc, hc = unit_cell(r, a), hosp_cell(r, a)
            p_hosp = ratio(h365.get(hc))
            p_hosp = 0.5 if p_hosp is None else p_hosp
            c28 = u28.get(uc, [0, 0])
            c365 = u365.get(uc, [0, 0])
            p5 = (c365[0] + SHRINK_YEAR * p_hosp) / (c365[1] + SHRINK_YEAR)
            if c28[1] == 0:
                fallbacks1 += 1
            if c365[1] == 0:
                fallbacks2 += 1
            predictions += 1

            def or_hosp(v: float | None) -> float:
                return p_hosp if v is None else v

            ps = [
                or_hosp(ratio(c28)),
                or_hosp(ratio(c365)),
                p_hosp,
                or_hosp(ratio(h28.get(hc))),
                p5,
                *((c28[0] + m * p5) / (c28[1] + m) for m in SHRINK_MONTH),
            ]
            subsets = ["all"]
            if c28[1] < 30:
                subsets.append("small")
            if r.ward != "URO":
                subsets.append("no URO")
            for s in subsets:
                A = acc[s]
                A["n"] += 1
                for i, p in enumerate(ps):
                    A["brier"][i] += (p - y) ** 2
                    A["logloss"][i] -= math.log(clip(p) if y else 1 - clip(p))
    per_window.append(acc)
    start = add_days(start, 28)


def summarise(subset: str, metric: str) -> list[list[str]]:
    def total(ws: list[dict], i: int) -> float:
        n = 0
        for w in ws:
            n += w[subset]["n"]
        s = 0.0
        for w in ws:
            s += w[subset][metric][i]
        return s / n if n else math.nan

    rand = mulberry32(2026)
    diffs: list[list[float]] = [[] for _ in ESTIMATORS]
    for _ in range(BOOTSTRAPS):
        sample = [per_window[math.floor(rand() * len(per_window))] for _ in per_window]
        base = total(sample, BASE)
        for i in range(len(ESTIMATORS)):
            diffs[i].append(total(sample, i) - base)

    def q(xs: list[float], p: float) -> float:
        return sorted(xs)[math.floor(p * (len(xs) - 1))]

    base = total(per_window, BASE)
    rows = []
    for i, name in enumerate(ESTIMATORS):
        v = total(per_window, i)
        interval = "–" if i == BASE else f"{to_fixed(q(diffs[i], 0.025), 4)} to {to_fixed(q(diffs[i], 0.975), 4)}"
        rows.append([name, to_fixed(v, 4), to_fixed(v - base, 4), interval])
    return rows


md = (
    "# 0004 results\n\nLower is better. Difference to the baseline (estimator 3) with a 95 % interval from 1,000 bootstrap "
    "resamples of target windows (seed 2026). All computed.\n\n"
)
md += (
    f"Target windows: {len(per_window)}; predictions (first isolate × antibiotic): {predictions}. Unit 28-day cell empty "
    f"(raw estimator 1 fell back to the baseline): {to_fixed((100 * fallbacks1) / predictions, 1)} %; unit 365-day cell empty: "
    f"{to_fixed((100 * fallbacks2) / predictions, 1)} %.\n\n"
)
TITLES = {"all": "All cells", "small": "Cells with under 30 first isolates in the unit's last 28 days", "no URO": "All units except Urology"}
for subset in SUBSETS:
    n = sum(w[subset]["n"] for w in per_window)
    for metric in ("brier", "logloss"):
        md += f"### {TITLES[subset]} · {'Brier score' if metric == 'brier' else 'log loss'} (n = {n})\n\n"
        md += f"{table(['estimator', 'mean', 'minus baseline', '95 % interval'], summarise(subset, metric))}\n\n"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "results.md").write_text(md)
print(md)
