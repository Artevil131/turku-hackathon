"""0002: run candidate detectors over the whole dataset and score them on the planted events of 0001 (README.md).

Run from the repository root:
    uv run python experiments/0002-detectors-on-planted-events/sweep.py
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from aei.dataset import load_records
from aei.dates import days_between
from aei.detect import (
    SURVEILLANCE_PAIRS,
    Episode,
    Signal,
    episodes,
    phenotype_excess,
    profile_excess,
    profile_rule,
    resistance_shift,
    rising_trend,
    sampling_drop,
)
from aei.domain import PHENOTYPES
from aei.jscompat import js_round, js_str, table, to_exponential, to_fixed, to_precision

DATA = Path("data/synthetic_microbiology_dataset")
OUT = Path("experiments/0002-detectors-on-planted-events/out")
YEARS = 1092 / 365.25

records, cultures = load_records(DATA)
PAIRS = SURVEILLANCE_PAIRS  # the 22 pairs of 0001, as listed in the original sweep

# ---------- planted events (0001) ----------


@dataclass
class PlantedEvent:
    id: str
    label: str
    start: str
    matches: Callable[[Episode], bool]


def within(date: str, start: str, end: str) -> bool:
    return start <= date <= end


EVENTS = [
    PlantedEvent(
        "E1",
        "Urology ESBL E. coli, from 2025-06-04",
        "2025-06-04",
        lambda e: e.first.ward == "URO"
        and within(e.first.date, "2025-06-04", "2025-08-31")
        and (e.first.organism == "Escherichia coli" or e.first.phenotype == "esbl"),
    ),
    PlantedEvent(
        "E2",
        "ICU MRSA, from 2026-03-03",
        "2026-03-03",
        lambda e: e.first.ward == "ICU"
        and within(e.first.date, "2026-03-03", "2026-05-31")
        and (e.first.organism == "Staphylococcus aureus" or e.first.phenotype == "mrsa"),
    ),
    PlantedEvent(
        "E3",
        "No samples at PHC-S, 2025-12-08 to 12-14",
        "2025-12-08",
        lambda e: e.detector == "sampling-drop" and e.first.ward == "PHC-S" and within(e.first.date, "2025-12-08", "2026-01-15"),
    ),
    PlantedEvent(
        "E4",
        "Urinary E. coli trimethoprim rising",
        "",
        lambda e: e.detector == "rising-trend" and e.key == "Escherichia coli|TMP|urine",
    ),
]

# ---------- variants ----------

ALPHAS = [0.01, 0.001, 0.0001]
variants: list[tuple[str, str, Callable[[], list[Signal]]]] = []


def variant(detector: str, setting: str, run: Callable[[], list[Signal]]) -> None:
    variants.append((detector, setting, run))


for min_patients in (3, 4):
    for window_days in (14, 28):
        for onset_only in (False, True):
            variant(
                "1 profile rule",
                f"k {min_patients}, {window_days} d, {'day 3+ only' if onset_only else 'all patients'}",
                lambda m=min_patients, w=window_days, h=onset_only: profile_rule(records, min_patients=m, window_days=w, hospital_onset_only=h),
            )
for a in ALPHAS:
    variant(
        "2 profile excess",
        f"alpha {js_str(a)}",
        lambda a=a: profile_excess(records, window_days=28, baseline_days=365, alpha=a, min_observed=3),
    )
for a in ALPHAS:
    variant(
        "2b profile excess, share within specimen",
        f"alpha {js_str(a)}",
        lambda a=a: profile_excess(records, window_days=28, baseline_days=365, alpha=a, min_observed=3, same_specimen=True),
    )
for a in ALPHAS:
    variant(
        "3 phenotype excess",
        f"alpha {js_str(a)}",
        lambda a=a: phenotype_excess(records, PHENOTYPES, window_days=28, baseline_days=365, alpha=a, min_observed=2),
    )
for a in ALPHAS:
    variant("4 sampling drop", f"alpha {js_str(a)}", lambda a=a: sampling_drop(cultures, window_days=7, baseline_days=56, alpha=a))
for a in ALPHAS:
    variant(
        "5 resistance shift",
        f"alpha {js_str(a)}",
        lambda a=a: resistance_shift(records, PAIRS, window_days=28, baseline_days=336, step_days=7, alpha=a, min_resistant=3),
    )
for a in ALPHAS:
    variant("6 rising trend", f"alpha {js_str(a)}", lambda a=a: rising_trend(records, PAIRS, bin_days=28, min_bins=13, alpha=a))

# ---------- run and score ----------


def fmt_p(p: float | None) -> str:
    return "" if p is None else to_exponential(p, 1) if p < 1e-6 else to_precision(p, 2)


def describe(e: Episode) -> list[object]:
    s = e.first
    what = " ".join(x for x in (s.organism, s.antibiotic, s.phenotype.upper() if s.phenotype else None, f"`{s.profile}`" if s.profile else None) if x)
    if s.detector in ("resistance-shift", "rising-trend"):
        value = f"{js_round(100 * s.observed)} % R" + (f" vs {js_round(100 * s.expected)} %" if s.expected is not None else "")
    else:
        value = js_str(s.observed) + (f" vs {to_fixed(s.expected, 1)}" if s.expected is not None else "")
    return [s.ward or "hospital", what, e.first.date, e.last.date, e.signals, value, fmt_p(s.p)]


summary = []
details = []
t0 = time.perf_counter()
for detector, setting, run in variants:
    eps = episodes(run())
    hits = [[e for e in eps if ev.matches(e)] for ev in EVENTS]
    matched = {id(e) for h in hits for e in h}
    other = [e for e in eps if id(e) not in matched]
    delays = []
    for ev, h in zip(EVENTS, hits, strict=True):
        if not h:
            delays.append("–")
        else:
            delays.append(f"{days_between(ev.start, h[0].first.date)} d" if ev.start else h[0].first.date)
    summary.append([detector, setting, *delays, len(other), to_fixed(len(other) / YEARS, 1)])
    details.append(
        f"### {detector}, {setting}: {len(other)} other episodes\n\n"
        + table(["unit", "about", "first signal", "last signal", "signals", "observed", "p"], [describe(e) for e in other[:40]])
        + (f"\n\n…and {len(other) - 40} more." if len(other) > 40 else "")
        + "\n"
    )
seconds = to_fixed(time.perf_counter() - t0, 1)

head = ["detector", "setting", *(f"{e.id} delay" for e in EVENTS), "other episodes", "per year"]
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "summary.md").write_text(
    "# 0002 summary\n\nDelay: days from the event's start to the detector's first signal for it (\"–\": never). E4 has no start date, "
    "so its first signal date is shown. Other episodes: signal episodes (same detector and key, gaps of at most 28 days) that match "
    f"no planted event, over {to_fixed(YEARS, 2)} years. All computed.\n\n"
    + "\n".join(f"- {e.id}: {e.label}" for e in EVENTS)
    + f"\n\n{table(head, summary)}\n\nSweep time: {seconds} s.\n"
)
(OUT / "other-episodes.md").write_text(f"# 0002 other episodes per variant\n\n{chr(10).join(details)}")
print(table(head, summary))
print(f"sweep {seconds} s")
