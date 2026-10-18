"""0024: the resistance-shift detector (D-080) on the full dataset, the planted events of 0001 and injected events (README.md).

Run from the repository root:
    uv run python experiments/0024-resistance-shift/score.py
"""

from __future__ import annotations

import dataclasses
import time
from collections import Counter
from pathlib import Path

from aei.coverage import wilson
from aei.dataset import load_records
from aei.dates import add_days, days_between
from aei.detect import (
    LIVE_SETTINGS,
    SURVEILLANCE_PAIRS,
    Episode,
    cluster_signals,
    episodes,
    in_detected_cluster,
    phenotype_excess,
    profile_excess,
    resistance_shift_binomial,
)
from aei.domain import UNITS, WARD_TYPE
from aei.inject import CLUSTER_AVOID, _pick_int, clones, draw_start
from aei.jscompat import js_round, mulberry32, table, to_fixed

DATA = Path("data/synthetic_microbiology_dataset")
OUT = Path("experiments/0024-resistance-shift/out")
YEARS = 1092 / 365.25
SHIFT = LIVE_SETTINGS["resistance_shift"]
TRIALS = 40

t0 = time.perf_counter()
records, cultures = load_records(DATA)

# ---------- the whole dataset ----------
clusters = cluster_signals(records)
live = episodes(resistance_shift_binomial(records, **SHIFT, exclude=in_detected_cluster(clusters)))
raw = episodes(resistance_shift_binomial(records, **SHIFT))


def within(date: str, start: str, end: str) -> bool:
    return start <= date <= end


E1 = ("2025-06-04", lambda e: e.first.ward == "URO" and within(e.first.date, "2025-06-04", "2025-08-31") and e.first.organism == "Escherichia coli")
E2 = ("2026-03-03", lambda e: e.first.ward == "ICU" and within(e.first.date, "2026-03-03", "2026-05-31") and e.first.organism == "Staphylococcus aureus")


def planted(eps: list[Episode]) -> tuple[list[str], list[Episode]]:
    cells, matched = [], []
    for start, match in (E1, E2):
        hit = [e for e in eps if match(e)]
        matched += hit
        cells.append(f"{days_between(start, hit[0].first.date)} d ({hit[0].key.split('|', 1)[1]})" if hit else "–")
    return cells, matched


def e4_related(e: Episode) -> bool:
    return e.first.organism == "Escherichia coli" and e.first.antibiotic == "TMP" and "|urine|" in e.key


rows = []
for name, eps in (("with cluster exclusion (live)", live), ("without exclusion", raw)):
    cells, matched = planted(eps)
    ids = {id(e) for e in matched}
    other = [e for e in eps if id(e) not in ids]
    rows.append([name, *cells, len(eps), len(other), to_fixed(len(other) / YEARS, 1), sum(1 for e in other if e4_related(e))])
head = ["setting", "E1 delay (first signal)", "E2 delay (first signal)", "episodes", "other episodes", "other per year", "of them E4-related"]

_, matched = planted(live)
ids = {id(e) for e in matched}
other_live = [e for e in live if id(e) not in ids]
by_year = Counter(e.first.date[:4] for e in other_live)
year_rows = [[y, by_year[y]] for y in sorted(by_year)]
by_drug = Counter(e.first.antibiotic for e in other_live)
by_unit = Counter(e.first.ward for e in other_live)
cells_tested = len({e.key for e in live})

# ---------- injected events ----------
rand = mulberry32(2026)
sources = clones(records)
by_unit_records: dict[str, list] = {}
for r in records:
    by_unit_records.setdefault(r.ward, []).append(r)


def around(unit: str, start: str):
    frm, to = add_days(start, -400), add_days(start, 60)
    return [r for r in by_unit_records[unit] if frm <= r.sample_date <= to]


def median(xs: list[int]) -> int | None:
    s = sorted(xs)
    return s[(len(s) - 1) >> 1] if s else None


def cluster_shift_trial(k: int, t: int) -> tuple[bool, bool, int | None, int | None]:
    """0007's draws and injection; (detected with exclusion, without, delay with, delay without)."""
    unit = UNITS[_pick_int(rand, len(UNITS))]
    start = draw_start(rand, unit, CLUSTER_AVOID)
    source = sources[_pick_int(rand, len(sources))]
    inpatient = WARD_TYPE[unit] == "in"
    injected = []
    for i in range(k):
        sample_date = add_days(start, _pick_int(rand, 14))
        injected.append(
            dataclasses.replace(
                source,
                isolate_id=f"INJ{t}-{i}-1",
                culture_id=f"INJ{t}-{i}",
                patient_id=f"PINJ{t}-{i}",
                sample_date=sample_date,
                admission_date=add_days(sample_date, -5) if inpatient else None,
                ward=unit,
                sex="F" if rand() < 0.5 else "M",
            )
        )
    unit_rows = around(unit, start) + injected
    # The clusters the live set would have raised for these rows (the stratum and the unit give the same signals).
    frm, to = add_days(start, -400), add_days(start, 60)
    stratum = [
        r
        for r in records
        if frm <= r.sample_date <= to and r.organism == source.organism and r.specimen == source.specimen
    ] + injected
    settings = LIVE_SETTINGS["profile_excess"]
    cl = [
        *profile_excess(stratum, **settings),
        *phenotype_excess(unit_rows, ["esbl", "mrsa", "vre", "cpe"], **LIVE_SETTINGS["phenotype_excess"]),
    ]
    until = add_days(start, 28)

    def first(signals):
        d = [s.date for s in signals if s.ward == unit and s.organism == source.organism and start <= s.date <= until]
        return min(d, default=None)

    f_live = first(resistance_shift_binomial(unit_rows, **SHIFT, exclude=in_detected_cluster(cl)))
    f_raw = first(resistance_shift_binomial(unit_rows, **SHIFT))
    onset = min((r.sample_date for r in injected), default=start)
    delay = lambda f: None if f is None else max(0, days_between(onset, f))  # noqa: E731
    return f_live is not None, f_raw is not None, delay(f_live), delay(f_raw)


def drift_trial(f: float) -> tuple[bool, int | None, int]:
    """A drift without a clone: turn each susceptible result of one organism and antibiotic in one unit, over 28 days, to R with probability f."""
    unit = UNITS[_pick_int(rand, len(UNITS))]
    start = draw_start(rand, unit, CLUSTER_AVOID)
    pair = SURVEILLANCE_PAIRS[_pick_int(rand, len(SURVEILLANCE_PAIRS))]
    until = add_days(start, 27)
    rows = []
    n_window = 0
    for r in around(unit, start):
        if (
            r.organism == pair.organism
            and (pair.specimen is None or r.specimen == pair.specimen)
            and pair.antibiotic in r.results
            and start <= r.sample_date <= until
        ):
            n_window += 1
            if r.results[pair.antibiotic] == "S" and rand() < f:
                r = dataclasses.replace(r, results={**r.results, pair.antibiotic: "R"})
        rows.append(r)
    signals = [
        s
        for s in resistance_shift_binomial(rows, **SHIFT)
        if s.ward == unit and s.organism == pair.organism and s.antibiotic == pair.antibiotic and start <= s.date <= add_days(start, 28)
    ]
    first = min((s.date for s in signals), default=None)
    return first is not None, (days_between(start, first) if first else None), n_window


def rate(k: int, n: int) -> str:
    lo, hi = wilson(k, n)
    return f"{k}/{n} ({js_round(100 * lo)}–{js_round(100 * hi)} %)"


inj_rows = []
n = 0
for k in (0, 2, 3, 4, 6):
    res = [cluster_shift_trial(k, n + i) for i in range(TRIALS)]
    n += TRIALS
    dl = [r[2] for r in res if r[2] is not None]
    dr = [r[3] for r in res if r[3] is not None]
    inj_rows.append(
        [
            f"cluster of {k}" if k else "control, nothing injected",
            rate(sum(r[0] for r in res), TRIALS),
            "–" if not dl else median(dl),
            rate(sum(r[1] for r in res), TRIALS),
            "–" if not dr else median(dr),
        ]
    )
drift_rows = []
for f in (0.0, 0.3, 0.6):
    res = [drift_trial(f) for _ in range(TRIALS)]
    d = [r[1] for r in res if r[1] is not None]
    thin = sum(1 for r in res if r[2] < SHIFT["min_window"])
    drift_rows.append([f"drift f = {f}" if f else "control, nothing changed", rate(sum(r[0] for r in res), TRIALS), "–" if not d else median(d), thin])
seconds = to_fixed(time.perf_counter() - t0, 1)

md = (
    "# 0024 results\n\n"
    f"Resistance shift at the D-080 settings ({SHIFT}), all isolates, {to_fixed(YEARS, 2)} years, causal. "
    "Episodes: same detector and key (unit, specimen, organism, antibiotic) within 28 days. E1 and E2 are 0001's events, "
    "delay in days from the first case to the first matching signal. All computed; deterministic scan, seed 2026 for the injections. "
    f"Run time {seconds} s.\n\n## Whole dataset\n\n{table(head, rows)}\n\n"
    f"Distinct unit-specimen-organism-antibiotic keys with an episode (live): {cells_tested}. "
    f"Other episodes (live) by calendar year (2023 holds 3 months, 2026 nine):\n\n{table(['year', 'other episodes'], year_rows)}\n\n"
    f"By antibiotic: {dict(by_drug.most_common())}\n\nBy unit: {dict(by_unit.most_common())}\n\n"
    "## Injected clusters (0007's draws)\n\n"
    "Detected: a shift signal for the unit and the source's organism from the start to 28 days after it, any antibiotic. "
    f"{TRIALS} trials per setting; delay from the first injected case.\n\n"
    f"{table(['setting', 'detected, with exclusion', 'median delay', 'detected, without exclusion', 'median delay'], inj_rows)}\n\n"
    "## Injected drift without a clone\n\n"
    "Detected: a shift signal for the unit, organism and antibiotic from the start to 28 days after it; delay from the start. "
    "'Thin' trials had fewer than 3 known results in the window and cannot signal.\n\n"
    f"{table(['setting', 'detected', 'median delay', 'thin trials'], drift_rows)}\n"
)
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "results.md").write_text(md)
lines = [f"| {e.first.ward} | {e.key} | {e.first.date} | {e.last.date} | {e.signals} | {e.first.observed:g} vs {e.first.expected:.1f} | {e.first.p:.1e} |" for e in other_live]
(OUT / "other-episodes.md").write_text(
    "# 0024 other episodes (live setting)\n\n| unit | key | first signal | last signal | signals | observed | p |\n|---|---|---|---|---|---|---|\n"
    + "\n".join(lines)
    + "\n"
)
print(md)
