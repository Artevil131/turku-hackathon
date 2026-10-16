"""0009: a run-of-empty-days rule for short sampling gaps (README.md).

Run from the repository root:  uv run python experiments/0009-empty-day-runs/analysis.py
"""

from __future__ import annotations

import dataclasses
import time
from pathlib import Path

from aei.coverage import wilson
from aei.dataset import Culture, load_records
from aei.dates import add_days, days_between
from aei.detect import LIVE_SETTINGS, Signal, empty_run, episodes, sampling_drop
from aei.domain import UNITS
from aei.inject import CLUSTER_AVOID, GAP_AVOID, _pick_int, clones, draw_start
from aei.jscompat import mulberry32

DATA = Path("data/synthetic_microbiology_dataset")
OUT = Path("experiments/0009-empty-day-runs/out")
TRIALS = 40
BASELINE_DAYS = 56
ALPHAS = (1e-3, 1e-4)
KNOWN_GAPS = [("PHC-S", "2025-12-08", "2025-12-14"), ("MED-A", "2025-05-12", "2025-05-18")]
SIZE = {"ED": "large", "PHC-N": "large", "PHC-S": "large", "MED-A": "medium", "SURG": "medium", "URO": "medium", "GER": "medium", "MED-B": "small", "ICU": "small"}


def empty_runs(cultures: list[Culture], alpha: float, baseline_days: int = BASELINE_DAYS) -> list[Signal]:
    """The run rule as tested here, now `aei.detect.empty_run` (D-031); keys prefixed so its episodes stay
    apart from the 7-day rule's when the two are counted together."""
    return [dataclasses.replace(s, key=f"run|{s.key}") for s in empty_run(cultures, baseline_days=baseline_days, alpha=alpha)]


t0 = time.time()
records, cultures = load_records(DATA)
sources = clones(records)

# Replay 0007's draws: its cluster trials come first, then the gap trials, from one mulberry32(2026) stream.
rand = mulberry32(2026)
for k in (0, 2, 3, 4, 6):
    for _ in range(TRIALS):
        unit = UNITS[_pick_int(rand, len(UNITS))]
        draw_start(rand, unit, CLUSTER_AVOID)
        _pick_int(rand, len(sources))
        for _ in range(k):
            _pick_int(rand, 14)
            rand()

SETTINGS = [(0, False), (2, False), (3, False), (5, False), (7, False), (7, True)]
rows = []
for days, halve in SETTINGS:
    label = "control (nothing removed)" if days == 0 else f"half the cultures for {days} d" if halve else f"no cultures for {days} d"
    results = {name: [] for name in ("7-day rule (live)", *(f"run rule {a:g}" for a in ALPHAS), *(f"either, run {a:g}" for a in ALPHAS))}
    sizes = []
    for _ in range(TRIALS):
        unit = UNITS[_pick_int(rand, len(UNITS))]
        start = draw_start(rand, unit, GAP_AVOID)
        sizes.append(SIZE[unit])
        end_gap = add_days(start, days - 1)
        frm, to = add_days(start, -400), add_days(start, 60)
        kept, flip = [], False
        for c in cultures:
            if c.ward != unit or c.sample_date < frm or c.sample_date > to:
                continue
            if c.sample_date < start or c.sample_date > end_gap or days == 0:
                kept.append(c)
            elif halve:
                flip = not flip
                if flip:
                    kept.append(c)
        until = add_days(start, 14)

        def first(signals: list[Signal]) -> str | None:
            return min((s.date for s in signals if s.ward == unit and start <= s.date <= until), default=None)

        drop = first(sampling_drop(kept, **LIVE_SETTINGS["sampling_drop"]))
        results["7-day rule (live)"].append((drop, start))
        for a in ALPHAS:
            run = first(empty_runs(kept, a))
            results[f"run rule {a:g}"].append((run, start))
            both = min([d for d in (drop, run) if d], default=None)
            results[f"either, run {a:g}"].append((both, start))
    for name, hits in results.items():
        detected = [(f, s) for f, s in hits if f]
        k = len(detected)
        lo, hi = wilson(k, len(hits))
        delays = sorted(days_between(s, f) for f, s in detected)
        med = delays[(len(delays) - 1) // 2] if delays else "–"
        by_size = [f"{sum(1 for (f, _), z in zip(hits, sizes) if f and z == size)}/{sizes.count(size)}" for size in ("large", "medium", "small")]
        rows.append([label, name, f"{k}/{len(hits)} ({round(100 * lo)}–{round(100 * hi)} %)", med, *by_size])

# False alarms on the real data.
years = (days_between(min(c.sample_date for c in cultures), max(c.sample_date for c in cultures)) + 1) / 365.25


def outside_known(episode) -> bool:
    return not any(episode.first.ward == u and add_days(a, -3) <= episode.first.date <= add_days(b, 14) for u, a, b in KNOWN_GAPS)


fa_rows = []
live_eps = [e for e in episodes(sampling_drop(cultures, **LIVE_SETTINGS["sampling_drop"]))]
fa_rows.append(["7-day rule (live)", len(live_eps), sum(map(outside_known, live_eps)), f"{sum(map(outside_known, live_eps)) / years:.1f}"])
run_eps_by_alpha = {}
for a in ALPHAS:
    eps = episodes(empty_runs(cultures, a))
    run_eps_by_alpha[a] = eps
    fa_rows.append([f"run rule {a:g}", len(eps), sum(map(outside_known, eps)), f"{sum(map(outside_known, eps)) / years:.1f}"])
    merged = episodes([e.first for e in live_eps] + [e.first for e in eps])
    other = sum(map(outside_known, merged))
    fa_rows.append([f"either, run {a:g}", len(merged), other, f"{other / years:.1f}"])

known_rows = []
for u, a, b in KNOWN_GAPS:
    for name, eps in [("7-day rule (live)", live_eps), *((f"run rule {al:g}", run_eps_by_alpha[al]) for al in ALPHAS)]:
        hit = min((e.first.date for e in eps if e.first.ward == u and add_days(a, -3) <= e.first.date <= add_days(b, 14)), default=None)
        known_rows.append([f"{u} {a} to {b}", name, hit or "–", days_between(a, hit) if hit else "–"])


def table(head, body):
    return "\n".join([f"| {' | '.join(head)} |", "|" + "|".join("---" for _ in head) + "|", *(f"| {' | '.join(str(c) for c in r)} |" for r in body)])


md = f"# 0009 results\n\nGap trials of 0007 (seed 2026, {TRIALS} per setting), detection within 14 days of the first missing day; 95 % Wilson interval; delay in days from the first missing day. Large units ED, PHC-N, PHC-S; medium MED-A, SURG, URO, GER; small MED-B, ICU. All computed. Run time {time.time() - t0:.0f} s.\n\n"
md += table(["event", "rule", "detected", "median delay", "large", "medium", "small"], rows) + "\n\n"
md += f"### Signal episodes on the real data ({years:.2f} years)\n\n" + table(["rule", "episodes", "outside the two known gaps", "per year"], fa_rows) + "\n\n"
md += "### The two known gaps in the real data\n\n" + table(["gap", "rule", "first signal", "days after the gap began"], known_rows) + "\n"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "results.md").write_text(md)
print(md)
