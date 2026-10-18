"""0025: the volume-jump detector (D-081) on the full dataset, the planted events of 0001 and injected surges and gaps (README.md).

Run from the repository root:
    uv run python experiments/0025-volume-jump/score.py
"""

from __future__ import annotations

import dataclasses
import time
from collections import Counter
from pathlib import Path

from aei.coverage import wilson
from aei.dataset import Culture, load_records
from aei.dates import add_days, days_between
from aei.detect import LIVE_SETTINGS, episodes, sampling_drop, volume_jump
from aei.domain import UNITS
from aei.inject import GAP_AVOID, _pick_int, draw_start
from aei.jscompat import js_round, mulberry32, table, to_fixed

DATA = Path("data/synthetic_microbiology_dataset")
OUT = Path("experiments/0025-volume-jump/out")
YEARS = 1092 / 365.25
JUMP = LIVE_SETTINGS["volume_jump"]
TRIALS = 40

t0 = time.perf_counter()
records, cultures = load_records(DATA)

# ---------- the whole dataset ----------
eps = episodes(volume_jump(cultures, **JUMP))
by_year = Counter(e.first.date[:4] for e in eps)
drops = episodes(sampling_drop(cultures, **LIVE_SETTINGS["sampling_drop"]))

PLANTED = [
    ("E1 Urology ESBL E. coli, from 2025-06-04", "URO", "2025-06-04"),
    ("E2 ICU MRSA, from 2026-03-03", "ICU", "2026-03-03"),
    ("E3 no samples at PHC-S, 2025-12-08 to 12-14", "PHC-S", "2025-12-08"),
    ("E4 urinary E. coli trimethoprim rising (hospital-wide, no unit or date)", None, None),
]
planted_rows = []
for label, unit, start in PLANTED:
    near = [e for e in eps if unit and e.first.ward == unit and start <= e.first.date <= add_days(start, 28 + (7 if label.startswith("E3") else 0))]
    planted_rows.append([label, "n/a" if not unit else (f"{len(near)} episode(s): {[e.first.date for e in near]}" if near else "none")])

# ---------- injected events ----------
rand = mulberry32(2026)
by_unit: dict[str, list[Culture]] = {}
for c in cultures:
    by_unit.setdefault(c.ward, []).append(c)


def around(unit: str, start: str) -> list[Culture]:
    frm, to = add_days(start, -400), add_days(start, 60)
    return [c for c in by_unit[unit] if frm <= c.sample_date <= to]


def median(xs: list[int]) -> int | None:
    s = sorted(xs)
    return s[(len(s) - 1) >> 1] if s else None


def rate(k: int, n: int) -> str:
    lo, hi = wilson(k, n)
    return f"{k}/{n} ({js_round(100 * lo)}–{js_round(100 * hi)} %)"


def first_jump(rows: list[Culture], unit: str, start: str) -> int | None:
    until = add_days(start, 14)
    d = [s.date for s in volume_jump(rows, **JUMP) if s.ward == unit and start <= s.date <= until]
    return days_between(start, min(d)) if d else None


def gap_trial(days: int, halve: bool) -> int | None:
    """0007's gap: remove a unit's cultures (or every other one) for `days` days; a jump signal is a false alarm."""
    unit = UNITS[_pick_int(rand, len(UNITS))]
    start = draw_start(rand, unit, GAP_AVOID)
    end = add_days(start, days - 1)
    kept, flip = [], False
    for c in around(unit, start):
        if c.sample_date < start or c.sample_date > end or days == 0:
            kept.append(c)
        elif halve:
            flip = not flip
            if flip:
                kept.append(c)
    return first_jump(kept, unit, start)


def surge_trial(m: int, t: int) -> int | None:
    """Every culture of the unit in the 7 days from the start is copied m - 1 times on the same day."""
    unit = UNITS[_pick_int(rand, len(UNITS))]
    start = draw_start(rand, unit, GAP_AVOID)
    end = add_days(start, 6)
    rows = []
    for c in around(unit, start):
        rows.append(c)
        if start <= c.sample_date <= end:
            rows.extend(dataclasses.replace(c, culture_id=f"SRG{t}-{c.culture_id}-{i}") for i in range(1, m))
    return first_jump(rows, unit, start)


def row(setting: str, res: list[int | None]) -> list[object]:
    d = [x for x in res if x is not None]
    return [setting, rate(len(d), len(res)), "–" if not d else median(d)]


gap_rows = []
for days, halve in ((0, False), (2, False), (3, False), (5, False), (7, False), (7, True)):
    label = "control, nothing removed" if days == 0 else f"half the cultures for {days} d" if halve else f"no cultures for {days} d"
    gap_rows.append(row(label, [gap_trial(days, halve) for _ in range(TRIALS)]))
surge_rows = []
n = 0
for m in (1, 2, 3):
    res = []
    for _ in range(TRIALS):
        res.append(surge_trial(m, n))
        n += 1
    surge_rows.append(row("control, nothing added" if m == 1 else f"week at {m} times the volume", res))
seconds = to_fixed(time.perf_counter() - t0, 1)

md = (
    "# 0025 results\n\n"
    f"Volume jump at the D-081 settings ({JUMP}), all cultures, {to_fixed(YEARS, 2)} years, causal. "
    f"Episodes: same unit within 28 days. All computed; deterministic scan, seed 2026 for the injections, {TRIALS} trials per setting. "
    f"Run time {seconds} s.\n\n## Whole dataset\n\n"
    f"Volume-jump episodes: {len(eps)} ({to_fixed(len(eps) / YEARS, 2)} a year); by calendar year: {dict(sorted(by_year.items()))}. "
    f"For comparison the live sampling drop raises {len(drops)} episodes ({to_fixed(len(drops) / YEARS, 1)} a year) on the same cultures.\n\n"
    f"{table(['planted event (0001)', 'volume jump within 28 days of the start'], planted_rows)}\n\n"
    "## Injected surges\n\n"
    "Detected: a volume-jump signal for the unit from the start to 14 days after it; delay in days from the start.\n\n"
    f"{table(['setting', 'detected', 'median delay'], surge_rows)}\n\n"
    "## 0007's gaps (a signal here is a false alarm)\n\n"
    f"{table(['setting', 'jump signalled', 'median delay'], gap_rows)}\n"
)
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "results.md").write_text(md)
print(md)
