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
import math
from bisect import bisect_left, bisect_right
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date as _date

from aei.dataset import Culture, IsolateRecord
from aei.dates import add_days, days_between
from aei.detect import LIVE_SETTINGS, Signal, has_acquired_resistance, phenotype_excess, profile_excess, profile_of, sampling_drop
from aei.domain import UNITS, WARD_TYPE
from aei.jscompat import mulberry32
from aei.relations import count_flows, patient_moves

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


# ---------- generic trials: any detector (overnight harness, see aei.score_detection) ----------
#
# The trials above run the live detectors by hand. The ones below take any detector with
# `run(records, cultures, focus) -> list[Signal]` (aei.score_detection.Detector), run it once per trial and keep every
# signal that could match, with its p, so any threshold level is judged afterwards from the same trial:
#
#     base = base_of(records, cultures)
#     rand = mulberry32(2026)
#     hits = rare_hits(detector, base, rand, k=4)                  # 0007's draws
#     hits.detected(lambda s: detector.passes(s, level))
#
# The draws of `rare_hits` (with `gap_hits` after them) are 0007's and those of `common_hits` are 0011's, so the same
# seeds give the same units, starts and sources; `seed_trials` chains them in one fixed order from one mulberry32 stream.
# A trial gets `detector=None` to draw without running anything (it consumes the stream the same way).

FAMILIES = ("rare", "common_resistant", "wild_type", "common_esbl", "two_unit")
COMMON_ARM_OF = {"common_resistant": "common resistant", "wild_type": "wild type", "common_esbl": "common ESBL E. coli"}
DEFAULT_KS = (0, 2, 3, 4, 6)
GAP_SETTINGS = ((0, False), (2, False), (3, False), (5, False), (7, False), (7, True))  # (days, halved); 0 is the control
LARGE_UNITS = ("ED", "PHC-N", "PHC-S")
OTHER_UNITS = tuple(u for u in UNITS if u not in LARGE_UNITS)
# Order of the cells of one seed's stream: 0007's clusters and gaps, then 0011's three arms, then two-unit clusters.
_BLOCKS = ("rare", "gaps", "common_resistant", "wild_type", "common_esbl", "two_unit")


@dataclass(frozen=True, slots=True)
class Focus:
    """What a trial needs from a detector, as a hint: only signals for `units` dated `start` to `end` are read, and only
    those about `organism` / `phenotypes` for a cluster (None: any). Ignoring it is correct, only slower. `data_start`
    is the first sample date of the whole data, so a rule that depends on it (new-in-unit's silent first 180 days) is
    the same on a detector that cuts the data. Records and cultures are in date order and run to `end` at most."""

    units: tuple[str, ...]
    organism: str | None = None
    phenotypes: tuple[str, ...] | None = None
    specimen: str | None = None
    start: str | None = None
    end: str | None = None
    data_start: str | None = None


def ward_in(ward: str | None, units: Sequence[str]) -> bool:
    """A signal's ward ("A", or "A+B" for a multi-unit signal) names one of `units`."""
    return ward is not None and any(u in units for u in ward.split("+"))


@dataclass(slots=True)
class TrialHits:
    """One generic trial: the signals the detector gave for the trial's units in the window that could count.

    For a cluster, `signals` are those for `units` (a "+" set containing one of them too) dated `start` to `until`
    (28 days) about the source's organism or one of its phenotypes (0007's rule); for a gap, every signal for the unit
    dated `start` to `until` (14 days). Which of them count at a threshold is up to the caller: pass `accept`, a
    function of a signal, to the methods below."""

    family: str  # rare, common_resistant, wild_type, common_esbl, two_unit, gap
    setting: str
    k: int  # patients injected (0: control); for a gap, the silent days
    units: tuple[str, ...]
    start: str
    until: str
    onset: str  # first injected sample date (clusters) or the first missing day (gaps)
    organism: str | None
    phenotypes: tuple[str, ...]
    profile: str | None
    signals: list[Signal]
    stratum: str | None = None  # "large" or "other" in the common families
    halved: bool = False
    ran: bool = True

    def first(self, accept: Callable[[Signal], bool] | None = None) -> str | None:
        return min((s.date for s in self.signals if accept is None or accept(s)), default=None)

    def detected(self, accept: Callable[[Signal], bool] | None = None) -> bool:
        return self.first(accept) is not None

    def delay(self, accept: Callable[[Signal], bool] | None = None) -> int | None:
        """Days from the onset to the first accepted signal (not below 0, as 0007)."""
        f = self.first(accept)
        return None if f is None else max(0, days_between(self.onset, f))

    def strict(self, accept: Callable[[Signal], bool] | None = None) -> bool:
        """An accepted profile-excess signal for the source's exact profile (0011)."""
        return any(
            (accept is None or accept(s)) and s.detector == "profile-excess" and s.organism == self.organism and s.profile == self.profile
            for s in self.signals
        )


class Base:
    """The real data prepared for many trials: records and cultures in date order with their date lists, the clones
    clusters are copied from, the patient moves for the flows, and 0011's `common_group` on slices instead of scans."""

    def __init__(self, records: Sequence[IsolateRecord], cultures: Sequence[Culture]):
        self.source_records, self.source_cultures = records, cultures
        self.records = list(records)
        if any(self.records[i].sample_date > self.records[i + 1].sample_date for i in range(len(self.records) - 1)):
            self.records.sort(key=lambda r: r.sample_date)
        self.cultures = list(cultures)
        if any(self.cultures[i].sample_date > self.cultures[i + 1].sample_date for i in range(len(self.cultures) - 1)):
            self.cultures.sort(key=lambda c: c.sample_date)
        self.rdates = [r.sample_date for r in self.records]
        self.cdates = [c.sample_date for c in self.cultures]
        self.sources = clones(self.records)
        self._moves = None

    @property
    def data_start(self) -> str:
        return self.rdates[0]

    def records_between(self, frm: str, to: str) -> list[IsolateRecord]:
        return self.records[bisect_left(self.rdates, frm) : bisect_right(self.rdates, to)]

    def common_group(self, unit: str, start: str, kind: str) -> list[IsolateRecord]:
        """`common_group` of 0011 on a slice; the same group, ties included, for date-ordered records."""
        pool = self.records_between(add_days(start, -365), add_days(start, -1))
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

    def neighbours(self, unit: str, start: str) -> list[tuple[str, int]]:
        """Units that exchanged patients with `unit` in the 365 days before `start`, either direction, with the
        patients moved (A to B plus B to A), in `UNITS` order (`aei.relations.patient_flows`)."""
        if self._moves is None:
            self._moves = patient_moves(self.cultures)
        flows = count_flows(self._moves, (add_days(start, -365), add_days(start, -1)))
        w: dict[str, int] = {}
        for f in flows:
            if f.source == unit:
                w[f.to] = w.get(f.to, 0) + f.patients
            elif f.to == unit:
                w[f.source] = w.get(f.source, 0) + f.patients
        return [(u, w[u]) for u in UNITS if u in w and u != unit]

    def prefix(self, until: str) -> tuple[list[IsolateRecord], list[str], list[Culture], list[str]]:
        i, j = bisect_right(self.rdates, until), bisect_right(self.cdates, until)
        return self.records[:i], self.rdates[:i], self.cultures[:j], self.cdates[:j]


_BASES: list[Base] = []


def base_of(records: Sequence[IsolateRecord], cultures: Sequence[Culture]) -> Base:
    """The `Base` of these records and cultures, built once per pair of lists (the last two are kept)."""
    for b in _BASES:
        if b.source_records is records and b.source_cultures is cultures:
            return b
    b = Base(records, cultures)
    _BASES.append(b)
    del _BASES[:-2]
    return b


def _iso_week(day: str) -> tuple[int, int]:
    y, w, _ = _date.fromisoformat(day).isocalendar()
    return y, w


def cluster_hits(
    detector,
    base: Base,
    source: IsolateRecord,
    placements: Sequence[tuple[str, int]],
    start: str,
    rand: Rand,
    t: int,
    *,
    family: str,
    k: int,
    stratum: str | None = None,
) -> TrialHits:
    """Copy `source` as new patients, n per (unit, n) of `placements`, each sampled within 14 days of `start` (sample
    date, then sex, drawn per patient as in 0007), each with a culture row too; run the detector on the data up to 28
    days after `start` and keep the signals for those units about the source's organism or phenotypes. `detector`
    None only draws."""
    injected: list[IsolateRecord] = []
    inj_cultures: list[Culture] = []
    for unit, n in placements:
        inpatient = WARD_TYPE[unit] == "in"
        for _ in range(n):
            i = len(injected)
            sample_date = add_days(start, _pick_int(rand, 14))
            admission = add_days(sample_date, -5) if inpatient else None
            injected.append(
                dataclasses.replace(
                    source,
                    isolate_id=f"INJ{t}-{i}-1",
                    culture_id=f"INJ{t}-{i}",
                    patient_id=f"PINJ{t}-{i}",
                    sample_date=sample_date,
                    admission_date=admission,
                    ward=unit,
                    sex="F" if rand() < 0.5 else "M",
                )
            )
            year, week = _iso_week(sample_date)
            inj_cultures.append(
                Culture(f"INJ{t}-{i}", f"PINJ{t}-{i}", sample_date, unit, WARD_TYPE[unit], admission, source.specimen, "positive", year, week, source.age_years)
            )
    units = tuple(dict.fromkeys(u for u, _ in placements))
    until = add_days(start, 28)
    onset = min((r.sample_date for r in injected), default=start)
    phenotypes = tuple(source.phenotypes)
    hits = TrialHits(family, f"k = {k}", k, units, start, until, onset, source.organism, phenotypes, profile_of(source), [], stratum, False, detector is not None)
    if detector is None:
        return hits
    recs, rdates, cults, cdates = base.prefix(until)
    for r in injected:
        pos = bisect_right(rdates, r.sample_date)
        recs.insert(pos, r)
        rdates.insert(pos, r.sample_date)
    for c in inj_cultures:
        pos = bisect_right(cdates, c.sample_date)
        cults.insert(pos, c)
        cdates.insert(pos, c.sample_date)
    focus = Focus(units, source.organism, phenotypes, source.specimen, start, until, base.data_start)
    hits.signals = [
        s
        for s in detector.run(recs, cults, focus)
        if ward_in(s.ward, units)
        and start <= s.date <= until
        and (s.organism == source.organism or (s.phenotype is not None and s.phenotype in phenotypes))
    ]
    return hits


def rare_hits(detector, base: Base, rand: Rand, k: int, t: int = 0) -> TrialHits:
    """0007's cluster trial with any detector: a random unit, a start (`draw_start`), one random ESBL or MRSA clone
    copied as k patients; the draws are `cluster_trial`'s."""
    unit = UNITS[_pick_int(rand, len(UNITS))]
    start = draw_start(rand, unit, CLUSTER_AVOID)
    source = base.sources[_pick_int(rand, len(base.sources))]
    return cluster_hits(detector, base, source, [(unit, k)], start, rand, t, family="rare", k=k)


def common_hits(detector, base: Base, rand: Rand, family: str, k: int, units: Sequence[str], t: int = 0, stratum: str | None = None) -> TrialHits:
    """0011's trial with any detector: `family` is common_resistant, wild_type or common_esbl; the unit is drawn from
    `units` and redrawn with its start until the arm's group exists; the source is a random member of the group."""
    kind = COMMON_ARM_OF[family]
    while True:
        unit = units[_pick_int(rand, len(units))]
        start = draw_start(rand, unit, CLUSTER_AVOID)
        group = base.common_group(unit, start, kind)
        if group:
            break
    source = group[_pick_int(rand, len(group))]
    return cluster_hits(detector, base, source, [(unit, k)], start, rand, t, family=family, k=k, stratum=stratum)


def two_unit_hits(detector, base: Base, rand: Rand, k: int, t: int = 0) -> TrialHits:
    """A rare clone split over two units that exchange patients: unit A uniform over the nine and a start (`draw_start`,
    redrawn when no neighbour is clear of the planted events), unit B one of A's neighbours in the 365 days before the
    start weighted by the patients moved between them either way (`aei.relations.patient_flows`), ceil(k/2) patients in
    A and floor(k/2) in B, the source drawn as in `rare_hits`."""
    while True:
        a = UNITS[_pick_int(rand, len(UNITS))]
        start = draw_start(rand, a, CLUSTER_AVOID)
        cand = [(u, w) for u, w in base.neighbours(a, start) if not any(u == c_u and abs(days_between(c, start)) <= 45 for c_u, c in CLUSTER_AVOID)]
        if cand:
            break
    x = rand() * sum(w for _, w in cand)
    b = cand[-1][0]
    acc = 0
    for u, w in cand:
        acc += w
        if acc > x:
            b = u
            break
    source = base.sources[_pick_int(rand, len(base.sources))]
    return cluster_hits(detector, base, source, [(a, math.ceil(k / 2)), (b, k // 2)], start, rand, t, family="two_unit", k=k)


def gap_hits(detector, base: Base, rand: Rand, days: int, halve: bool, t: int = 0) -> TrialHits:
    """0007's gap trial with any detector: a random unit's cultures removed for `days` days from a random start (every
    second one with `halve`; nothing for days 0), and the isolates of the removed cultures with them. The detector
    runs on the data up to 14 days after the start; every signal for the unit in that span is kept."""
    unit = UNITS[_pick_int(rand, len(UNITS))]
    start = draw_start(rand, unit, GAP_AVOID)
    return gap_at(detector, base, unit, start, days, halve)


def gap_at(detector, base: Base, unit: str, start: str, days: int, halve: bool = False) -> TrialHits:
    """The gap trial of `gap_hits` for a chosen unit and start."""
    end = add_days(start, days - 1)
    until = add_days(start, 14)
    setting = "gap control (nothing removed)" if days == 0 else f"half the cultures for {days} d" if halve else f"no cultures for {days} d"
    hits = TrialHits("gap", setting, days, (unit,), start, until, start, None, (), None, [], None, halve, detector is not None)
    if detector is None:
        return hits
    recs, _, cults, _ = base.prefix(until)
    if days > 0:
        lo, hi = bisect_left(base.cdates, start), bisect_right(base.cdates, end)
        removed: set[str] = set()
        flip = False
        for c in base.cultures[lo:hi]:
            if c.ward != unit:
                continue
            if halve:
                flip = not flip
                if flip:
                    continue
            removed.add(c.culture_id)
        jj = len(cults)
        cults = base.cultures[:lo] + [c for c in base.cultures[lo : min(hi, jj)] if c.culture_id not in removed] + base.cultures[hi:jj]
        ri, rj = bisect_left(base.rdates, start), bisect_right(base.rdates, end)
        ii = len(recs)
        recs = base.records[:ri] + [r for r in base.records[ri : min(rj, ii)] if r.culture_id not in removed] + base.records[rj:ii]
    focus = Focus((unit,), None, None, None, start, until, base.data_start)
    hits.signals = [s for s in detector.run(recs, cults, focus) if ward_in(s.ward, (unit,)) and start <= s.date <= until]
    return hits


def seed_trials(
    detector,
    records: Sequence[IsolateRecord],
    cultures: Sequence[Culture],
    seed: int,
    *,
    families: Sequence[str] = FAMILIES,
    ks: Sequence[int] = DEFAULT_KS,
    trials: int = 40,
    gaps: Sequence[tuple[int, bool]] = GAP_SETTINGS,
) -> dict:
    """All trials of one seed, from one mulberry32(seed) stream in a fixed order: `rare` (k in `ks` in turn, `trials`
    each: 0007's order), `gaps` (the settings of `GAP_SETTINGS` in turn), then the three common arms (k in turn, `trials`
    each, half the trials in the large units and half in the others: 0011's order), then `two_unit`. What is run is
    up to `families` and `gaps` (a subset of `GAP_SETTINGS`): a cell not asked for is drawn but not run, so every cell is
    the same whichever others are requested (the stream is set by `ks` and `trials`). `detector` None draws everything
    and runs nothing. Returns {family: {k: [TrialHits]}, "gaps": {(days, halved): [TrialHits]}}."""
    unknown = [g for g in gaps if g not in GAP_SETTINGS]
    if unknown:
        raise ValueError(f"gap settings must come from GAP_SETTINGS, not {unknown}")
    base = base_of(records, cultures)
    rand = mulberry32(seed)
    want = set(families)
    if gaps:
        want.add("gaps")
    order = [b for b in _BLOCKS if b in want]
    if not order:
        return {}
    last = _BLOCKS.index(order[-1])
    out: dict = {}
    t = 0
    for block in _BLOCKS[: last + 1]:
        run = detector if block in want else None
        if block == "rare":
            out[block] = {k: [] for k in ks}
            for k in ks:
                for _ in range(trials):
                    out[block][k].append(rare_hits(run, base, rand, k, t))
                    t += 1
        elif block == "gaps":
            out[block] = {g: [] for g in GAP_SETTINGS}
            for days, halve in GAP_SETTINGS:
                for _ in range(trials):
                    out[block][(days, halve)].append(gap_hits(run if (days, halve) in gaps else None, base, rand, days, halve, t))
                    t += 1
            out[block] = {g: out[block][g] for g in gaps}
        elif block == "two_unit":
            out[block] = {k: [] for k in ks}
            for k in ks:
                for _ in range(trials):
                    out[block][k].append(two_unit_hits(run, base, rand, k, t))
                    t += 1
        else:
            out[block] = {k: [] for k in ks}
            for k in ks:
                for i in range(trials):
                    stratum, units = ("large", LARGE_UNITS) if i % 2 == 0 else ("other", OTHER_UNITS)
                    out[block][k].append(common_hits(run, base, rand, block, k, units, t, stratum))
                    t += 1
    return {b: v for b, v in out.items() if b in want}
