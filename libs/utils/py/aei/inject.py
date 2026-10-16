"""Injected events for measuring detector sensitivity (experiments/0007): copy a resistant clone into a unit as k
new patients, or remove a unit's cultures for some days, and see whether the live detectors signal.

Draws come from a `rand()` returning floats in [0, 1), in the same order as the TypeScript script, so with
`jscompat.mulberry32` the trials are the same as the original's.

    rand = mulberry32(2026)
    trial = cluster_trial(records, clones(records), rand, k=3, t=0)

Experiment 0011 injects clones of common profiles instead: `common_group` picks the source group from the year before
the start, `inject_cluster` runs one trial with a chosen unit, start and source.
"""

from __future__ import annotations

import dataclasses
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from aei.dataset import Culture, IsolateRecord
from aei.dates import add_days, days_between
from aei.detect import LIVE_SETTINGS, Signal, has_acquired_resistance, phenotype_excess, profile_excess, profile_of, sampling_drop
from aei.domain import UNITS, WARD_TYPE

Rand = Callable[[], float]

FIRST = "2024-10-01"
LAST = "2026-08-15"
# Planted events of 0001 kept clear of (unit, centre date), 45 days either side.
CLUSTER_AVOID = [("URO", "2025-06-15"), ("ICU", "2026-03-15")]
GAP_AVOID = [("PHC-S", "2025-12-11"), ("MED-A", "2025-05-15")]


@dataclass(slots=True)
class Trial:
    setting: str
    unit: str
    detected: bool
    delay: int | None
    first: str | None  # date of the first matching signal
    strict: bool = False  # a profile-excess signal for the source's exact profile (0011)


def _pick_int(rand: Rand, n: int) -> int:
    return int(rand() * n)  # Math.floor of a non-negative number


def draw_start(rand: Rand, unit: str, avoid: Sequence[tuple[str, str]]) -> str:
    """A start day in [FIRST, LAST], redrawn while within 45 days of an avoided event in the same unit."""
    span = days_between(FIRST, LAST)
    while True:
        start = add_days(FIRST, _pick_int(rand, span + 1))
        if not any(u == unit and abs(days_between(c, start)) <= 45 for u, c in avoid):
            return start


def clones(records: Sequence[IsolateRecord]) -> list[IsolateRecord]:
    """Isolates a cluster is copied from: ESBL E. coli or K. pneumoniae, and MRSA."""
    return [
        r
        for r in records
        if (r.organism in ("Escherichia coli", "Klebsiella pneumoniae") and "esbl" in r.phenotypes)
        or (r.organism == "Staphylococcus aureus" and "mrsa" in r.phenotypes)
    ]


def _earliest(signals: Sequence[Signal]) -> str | None:
    return min((s.date for s in signals), default=None)


def cluster_trial(records: Sequence[IsolateRecord], sources: Sequence[IsolateRecord], rand: Rand, k: int, t: int) -> Trial:
    """Copy one random clone into a random unit as k patients sampled within 14 days of a random start; run the
    live profile and phenotype excess on 400 days before to 60 days after and look for a matching signal within 28 days."""
    unit = UNITS[_pick_int(rand, len(UNITS))]
    start = draw_start(rand, unit, CLUSTER_AVOID)
    source = sources[_pick_int(rand, len(sources))]
    return inject_cluster(records, source, unit, start, rand, k, t, f"cluster k = {k}")


def inject_cluster(
    records: Sequence[IsolateRecord], source: IsolateRecord, unit: str, start: str, rand: Rand, k: int, t: int, setting: str
) -> Trial:
    """k copies of `source` as new patients in `unit`, sampled within 14 days of `start`, then 0007's detection rule:
    a live profile- or phenotype-excess signal for the unit and the source's organism or phenotype within 28 days."""
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
    frm, to = add_days(start, -400), add_days(start, 60)
    around = [r for r in records if frm <= r.sample_date <= to]
    settings = LIVE_SETTINGS["profile_excess"]
    # Profile excess works per organism (and specimen) stratum, so the source's stratum gives the same signals.
    same_stratum = [
        r for r in around if r.organism == source.organism and (not settings.get("same_specimen") or r.specimen == source.specimen)
    ] + injected
    same_unit = [r for r in around if r.ward == unit] + injected
    until = add_days(start, 28)
    signals = [
        *profile_excess(same_stratum, **settings, only=lambda r: r.ward == unit and start <= r.sample_date <= until),
        *phenotype_excess(same_unit, ["esbl", "mrsa"], **LIVE_SETTINGS["phenotype_excess"]),
    ]
    matching = [
        s
        for s in signals
        if s.ward == unit
        and (s.organism == source.organism or (s.phenotype is not None and s.phenotype in source.phenotypes))
        and start <= s.date <= until
    ]
    first = _earliest(matching)
    prof = profile_of(source)
    strict = any(s.detector == "profile-excess" and s.organism == source.organism and s.profile == prof for s in matching)
    onset = min((r.sample_date for r in injected), default=start)  # the first injected case is the onset
    delay = max(0, days_between(onset, first)) if first else None
    return Trial(setting, unit, first is not None, delay, first, strict)


COMMON_KINDS = ("common resistant", "wild type", "common ESBL E. coli")


def common_group(records: Sequence[IsolateRecord], unit: str, start: str, kind: str) -> list[IsolateRecord]:
    """The isolates of the largest (organism, specimen, profile) group by distinct patients in the 365 days before
    `start`: in `unit` among isolates with acquired resistance ("common resistant") or without ("wild type"), or among
    ESBL E. coli in the whole hospital ("common ESBL E. coli"). Ties go to the group seen first. Empty if none."""
    frm, to = add_days(start, -365), add_days(start, -1)
    pool = [r for r in records if frm <= r.sample_date <= to]
    if kind == "common ESBL E. coli":
        pool = [r for r in pool if r.organism == "Escherichia coli" and "esbl" in r.phenotypes]
    else:
        resistant = kind == "common resistant"
        pool = [r for r in pool if r.ward == unit and has_acquired_resistance(r) == resistant]
    groups: dict[tuple[str, str, str], list[IsolateRecord]] = {}
    for r in pool:
        groups.setdefault((r.organism, r.specimen, profile_of(r)), []).append(r)
    if not groups:
        return []
    return max(groups.values(), key=lambda g: len({r.patient_id for r in g}))


def gap_trial(cultures: Sequence[Culture], rand: Rand, days: int, halve: bool) -> Trial:
    """Remove a random unit's cultures (or every other one, `halve`) for `days` days from a random start; run the
    live sampling drop on 400 days before to 60 days after and look for a signal within 14 days."""
    unit = UNITS[_pick_int(rand, len(UNITS))]
    start = draw_start(rand, unit, GAP_AVOID)
    end = add_days(start, days - 1)
    frm, to = add_days(start, -400), add_days(start, 60)
    kept = []
    flip = False
    for c in cultures:
        if c.ward != unit or c.sample_date < frm or c.sample_date > to:
            continue
        if c.sample_date < start or c.sample_date > end or days == 0:
            kept.append(c)
        elif halve:
            flip = not flip
            if flip:
                kept.append(c)
    until = add_days(start, 14)
    first = _earliest([s for s in sampling_drop(kept, **LIVE_SETTINGS["sampling_drop"]) if s.ward == unit and start <= s.date <= until])
    setting = "gap control (nothing removed)" if days == 0 else f"half the cultures for {days} d" if halve else f"no cultures for {days} d"
    return Trial(setting, unit, first is not None, days_between(start, first) if first else None, first)
