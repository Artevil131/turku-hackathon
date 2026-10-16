"""Detection scoring of benchmarks/METRICS.md (D1 to D7, I1) for any detector; specification and choices in
benchmarks/overnight-2026-10-17/harness-spec.md ("Detection", Choices 3 to 5, "Metric keys").

A detector is anything with this surface (`Detector` below is the ready-made class; `LiveSet` is the shipped live set):

    name                       text for the leaderboard
    levels                     its threshold sweep, loosest first (the live set: multiples of its alphas)
    run(records, cultures, focus) -> list[Signal]
                               causal: a signal dated t depends only on rows dated up to t. Records and cultures come
                               in date order. `focus` (None for the whole data) is a hint a trial passes so a detector
                               may compute only what can match; ignoring it is correct, only slower. A run is made once
                               at the loosest level and every stricter one is read from it with `passes`.
    passes(signal, level) -> bool
                               default: p is None (a rule) or p < level
    kind_of(signal) -> str     sentinel, cluster, trend, divergence or data

    metrics, intervals, n, extra = score_detector(detector)            # screening: seed 2026, 200 trials per cell
    held = confirm(detector)                                           # held-out seeds 2027-2030, 50 per seed
    rows = tune_curve(detector)                                        # year-1 curve (noise a year, rates at k = 4) to pick a setting
    check_causal(detector, ["2025-03-31", "2026-06-30"])               # guard: raises if a signal depends on later rows

`score_detector` gives exactly the detection keys of the spec's "Metric keys" in `metrics`, `intervals` and `n`; `extra`
holds `D5_curve` (one row per level) and `D2_per_seed`, and some detail. Everything is as-of: a signal for day t used
rows dated up to t, checked by `check_causal`. CPU seconds per part are printed.

    from aei import harness, score_detection as sd
    live = sd.LiveSet()
    metrics, intervals, n, extra = sd.score_detector(live)
    harness.write_metrics(path, experiment=..., family="detection", metrics=metrics, intervals=intervals, n=n, ..., **extra)
"""

from __future__ import annotations

import math
import time
from bisect import bisect_left, bisect_right
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from aei import harness
from aei.coverage import wilson
from aei.dataset import Culture, IsolateRecord
from aei.dates import add_days, days_between
from aei.detect import (
    LIVE_SETTINGS,
    SURVEILLANCE_PAIRS,
    Signal,
    episodes,
    empty_run,
    in_detected_cluster,
    phenotype_excess,
    profile_excess,
    rising_trend,
    sampling_drop,
)
from aei.domain import PHENOTYPES, UNITS, WARD_TYPE
from aei.inject import (
    DEFAULT_KS,
    FAMILIES,
    GAP_SETTINGS,
    Focus,
    TrialHits,
    _pick_int,
    base_of,
    cluster_hits,
    gap_at,
    seed_trials,
    ward_in,
)
from aei.jscompat import mulberry32

__all__ = [
    "Detector",
    "Focus",
    "LiveSet",
    "check_causal",
    "confirm",
    "new_in_unit_signals",
    "retune_live_set",
    "score_detector",
    "tune_curve",
]

KS = DEFAULT_KS
SEEDS_SCREEN = (2026,)
SEEDS_HELDOUT = (2027, 2028, 2029, 2030)
KINDS = ("sentinel", "cluster", "trend", "divergence", "data")
KIND_OF = {
    "profile-excess": "cluster",
    "phenotype-excess": "cluster",
    "profile-rule": "cluster",
    "new-in-unit": "sentinel",
    "sampling-drop": "data",
    "empty-run": "data",
    "rising-trend": "trend",
    "resistance-shift": "divergence",
}
HEADLINE_NOISE = 5.0  # episodes a year (METRICS.md D5)
GAP_KEY = {(0, False): "gap0", (2, False): "gap2", (3, False): "gap3", (5, False): "gap5", (7, False): "gap7", (7, True): "half7"}
D2_KEYS = [f"{f}_k{k}" for f in FAMILIES for k in KS]


def default_kind_of(signal: Signal) -> str:
    try:
        return KIND_OF[signal.detector]
    except KeyError:
        raise ValueError(f"kind_of: unknown detector {signal.detector!r}; give the Detector a kind_fn naming its signals' kinds {KINDS}") from None


# ---------- the detector ----------


@dataclass
class Detector:
    """A detector from functions: `run_fn(records, cultures, focus) -> list[Signal]` (causal), `levels` loosest first,
    `passes_fn(signal, level)` (default p < level; a signal without p, a rule, always passes), `kind_fn(signal)`
    (default by `Signal.detector` for the live detectors' names). `default_level` is where D2, D3, D4, D6, D7 and I1
    are read; None reads them at D5's headline level. Subclass and override the methods for more."""

    name: str = "detector"
    run_fn: Callable[[Sequence[IsolateRecord], Sequence[Culture], Focus | None], list[Signal]] | None = None
    levels: tuple[float, ...] = (1e-2, 1e-3, 1e-4)
    default_level: float | None = None
    passes_fn: Callable[[Signal, float], bool] | None = None
    kind_fn: Callable[[Signal], str] | None = None

    def run(self, records: Sequence[IsolateRecord], cultures: Sequence[Culture], focus: Focus | None = None) -> list[Signal]:
        if self.run_fn is None:
            raise NotImplementedError("give the Detector a run_fn or override run")
        return self.run_fn(records, cultures, focus)

    def passes(self, signal: Signal, level: float) -> bool:
        if self.passes_fn is not None:
            return self.passes_fn(signal, level)
        return signal.p is None or signal.p < level

    def kind_of(self, signal: Signal) -> str:
        return (self.kind_fn or default_kind_of)(signal)

    def alert_groups(self, signals: Sequence[Signal]) -> list[list[Signal]]:
        """The detector's own alerts: its signals grouped by detector and key within 28 days (one alert per group, on
        its first signal), as the live tool's `detectorAlerts`; by first date."""
        return group_signals(signals, lambda s: f"{s.detector}|{s.key}")


def group_signals(signals: Sequence[Signal], key: Callable[[Signal], str], gap_days: int = 28) -> list[list[Signal]]:
    """Signals with the same key at most `gap_days` apart in one list each, each by date; lists by first date."""
    by_key: dict[str, list[Signal]] = {}
    for s in signals:
        by_key.setdefault(key(s), []).append(s)
    out: list[list[Signal]] = []
    for items in by_key.values():
        items = sorted(items, key=lambda s: s.date)
        cur: list[Signal] | None = None
        for s in items:
            if cur is not None and days_between(cur[-1].date, s.date) <= gap_days:
                cur.append(s)
            else:
                cur = [s]
                out.append(cur)
    out.sort(key=lambda g: g[0].date)
    return out


# ---------- new in a unit (D-021, D-034), a port of newInUnitAlerts in @aei/alerts ----------


def new_in_unit_signals(
    records: Sequence[IsolateRecord],
    phenotypes: Sequence[str] = ("mrsa", "vre"),
    lookback_days: int = 180,
    data_start: str | None = None,
) -> list[Signal]:
    """An isolate with the phenotype in an inpatient unit that had none in the `lookback_days` before it; nothing
    during the first `lookback_days` of the data (`data_start`, or the first record's date), where the look-back would
    reach before the data. As `newInUnitAlerts`; the signal's key is "unit|phenotype", `observed` 1, no p."""
    if not records:
        return []
    start = data_start or min(r.sample_date for r in records)
    quiet_until = add_days(start, lookback_days)
    ordered = sorted(records, key=lambda r: (r.sample_date, r.isolate_id))
    out: list[Signal] = []
    for ph in phenotypes:
        last: dict[str, str] = {}
        for r in ordered:
            if ph not in r.phenotypes or WARD_TYPE.get(r.ward) != "in":
                continue
            previous = last.get(r.ward)
            if r.sample_date >= quiet_until and (previous is None or days_between(previous, r.sample_date) > lookback_days):
                out.append(Signal("new-in-unit", f"{r.ward}|{ph}", r.sample_date, r.ward, 1, organism=r.organism, phenotype=ph))
            last[r.ward] = r.sample_date
    return out


# ---------- the live set as a detector ----------

LEVELS_LIVE = (100.0, 30.0, 10.0, 3.0, 1.0, 0.3, 0.1, 0.03, 0.01)


@dataclass
class LiveSet(Detector):
    """The live set (D-020, D-022, D-031) and new-in-unit (D-021 as revised by D-034). The threshold level m multiplies the
    two cluster alphas (profile excess 1e-4, phenotype excess 1e-3); sampling drop, empty run and the trend test keep
    theirs. A run is made at the loosest level and read at any other with `passes`. The trend test leaves out isolates
    of clusters detected at the level-1 alphas (D-022), whatever the level, so a level sweep changes the cluster
    signals only. `new_in_unit_days` None leaves new-in-unit out. With a `focus` only signals for its units are computed
    (profile excess for its organism and specimen, phenotype excess for its phenotypes, new-in-unit, the two data
    rules), from 400 days before its start to its end; no trend test."""

    name: str = "live set (D-020, D-021, D-022, D-031, D-034)"
    levels: tuple[float, ...] = LEVELS_LIVE
    default_level: float | None = 1.0
    profile_alpha: float = LIVE_SETTINGS["profile_excess"]["alpha"]
    phenotype_alpha: float = LIVE_SETTINGS["phenotype_excess"]["alpha"]
    sampling_alpha: float = LIVE_SETTINGS["sampling_drop"]["alpha"]
    empty_alpha: float = LIVE_SETTINGS["empty_run"]["alpha"]
    trend_alpha: float = LIVE_SETTINGS["rising_trend"]["alpha"]
    new_in_unit_days: int | None = 180

    def _cluster_args(self, level: float) -> tuple[dict, dict]:
        prof = {**LIVE_SETTINGS["profile_excess"], "alpha": self.profile_alpha * level}
        phen = {**LIVE_SETTINGS["phenotype_excess"], "alpha": self.phenotype_alpha * level}
        return prof, phen

    def passes(self, signal: Signal, level: float) -> bool:
        d, p = signal.detector, signal.p
        if d == "profile-excess":
            return p is not None and p < self.profile_alpha * level
        if d == "phenotype-excess":
            return p is not None and p < self.phenotype_alpha * level
        if d == "sampling-drop":
            return p is not None and p < self.sampling_alpha
        if d == "empty-run":
            return p is not None and p < self.empty_alpha
        if d == "rising-trend":
            return p is not None and p < self.trend_alpha
        return p is None or p < level

    def run(self, records: Sequence[IsolateRecord], cultures: Sequence[Culture], focus: Focus | None = None) -> list[Signal]:
        loosest = max(self.levels)
        prof, phen = self._cluster_args(loosest)
        if focus is None or focus.start is None or focus.end is None:
            clusters = [*profile_excess(records, **prof), *phenotype_excess(records, PHENOTYPES, **phen)]
            shipped = [s for s in clusters if self.passes(s, 1.0)]
            trend = {**LIVE_SETTINGS["rising_trend"], "alpha": self.trend_alpha}
            signals = [
                *clusters,
                *sampling_drop(cultures, **{**LIVE_SETTINGS["sampling_drop"], "alpha": self.sampling_alpha}),
                *empty_run(cultures, **{**LIVE_SETTINGS["empty_run"], "alpha": self.empty_alpha}),
                *rising_trend(records, SURVEILLANCE_PAIRS, **trend, exclude=in_detected_cluster(shipped)),
            ]
            if self.new_in_unit_days is not None:
                signals += new_in_unit_signals(records, lookback_days=self.new_in_unit_days)
            return signals
        return self._focused(records, cultures, focus, prof, phen)

    def _focused(self, records, cultures, focus: Focus, prof: dict, phen: dict) -> list[Signal]:
        units = set(focus.units)
        start, end = focus.start, focus.end
        lo = add_days(start, -400)
        rs = records[bisect_left(records, lo, key=_sample_date) : bisect_right(records, end, key=_sample_date)]
        cs = cultures[bisect_left(cultures, lo, key=_sample_date) : bisect_right(cultures, end, key=_sample_date)]

        def only(r: IsolateRecord) -> bool:
            return r.ward in units and start <= r.sample_date <= end

        signals: list[Signal] = []
        if focus.organism is not None:
            pool = [r for r in rs if r.organism == focus.organism and (focus.specimen is None or r.specimen == focus.specimen)]
        else:
            strata = {(r.organism, r.specimen) for r in rs if only(r)}
            pool = [r for r in rs if (r.organism, r.specimen) in strata]
        signals += profile_excess(pool, **prof, only=only)
        phenotypes = PHENOTYPES if focus.phenotypes is None else [p for p in PHENOTYPES if p in focus.phenotypes]
        unit_records = [r for r in rs if r.ward in units]
        if phenotypes:
            signals += phenotype_excess(unit_records, phenotypes, **phen)
        unit_cultures = [c for c in cs if c.ward in units]
        signals += sampling_drop(unit_cultures, **{**LIVE_SETTINGS["sampling_drop"], "alpha": self.sampling_alpha})
        signals += empty_run(unit_cultures, **{**LIVE_SETTINGS["empty_run"], "alpha": self.empty_alpha})
        if self.new_in_unit_days is not None:
            data_start = focus.data_start or records[0].sample_date
            signals += new_in_unit_signals(
                unit_records, [p for p in ("mrsa", "vre") if focus.phenotypes is None or p in focus.phenotypes], self.new_in_unit_days, data_start
            )
        return signals

    def alert_groups(self, signals: Sequence[Signal]) -> list[list[Signal]]:
        """The tool's alerts (`detectorAlerts`, new-in-unit): one per episode of a detector and key, a 7-day sampling-drop
        episode that starts within 14 days after an empty-run episode of the same unit left out (D-031), and one alert
        per new-in-unit signal."""
        groups = group_signals([s for s in signals if s.detector != "new-in-unit"], lambda s: f"{s.detector}|{s.key}")
        runs = [g[0] for g in groups if g[0].detector == "empty-run"]
        keep = [
            g
            for g in groups
            if not (
                g[0].detector == "sampling-drop"
                and any(r.ward == g[0].ward and r.date <= g[0].date and days_between(r.date, g[0].date) <= 14 for r in runs)
            )
        ]
        keep += [[s] for s in signals if s.detector == "new-in-unit"]
        keep.sort(key=lambda g: g[0].date)
        return keep


def _sample_date(x) -> str:
    return x.sample_date


# ---------- causality guard ----------


def _signal_key(s: Signal) -> tuple:
    return (s.date, s.detector, s.key, s.ward or "", s.organism or "", s.antibiotic or "", s.phenotype or "", s.profile or "", float(s.observed))


def check_causal(
    detector,
    cut_dates: Sequence[str],
    records: Sequence[IsolateRecord] | None = None,
    cultures: Sequence[Culture] | None = None,
    *,
    focus: Focus | None = None,
    rel: float = 1e-9,
    raise_on_error: bool = True,
) -> list[str]:
    """Run the detector on all the data once and on the data cut at each of `cut_dates` (rows dated up to the cut);
    the signals dated up to the cut must be the same (dates, keys, observed within rounding, p within `rel`). Returns the
    differences found, empty when the detector is causal; raises AssertionError listing them unless `raise_on_error`
    is False. Experiments call it with a few dates (one cut costs one run) as a guard."""
    if records is None or cultures is None:
        records, cultures = harness.data()
    full = detector.run(records, cultures, focus)
    problems: list[str] = []
    for cut in cut_dates:
        part = detector.run([r for r in records if r.sample_date <= cut], [c for c in cultures if c.sample_date <= cut], focus)
        a = sorted(((_signal_key(s), s.p) for s in full if s.date <= cut), key=lambda x: x[0])
        b = sorted(((_signal_key(s), s.p) for s in part if s.date <= cut), key=lambda x: x[0])
        if [x[0] for x in a] != [x[0] for x in b]:
            sa, sb = {x[0] for x in a}, {x[0] for x in b}
            only_full, only_cut = sorted(sa - sb)[:3], sorted(sb - sa)[:3]
            problems.append(
                f"cut {cut}: {len(a)} signals on all the data, {len(b)} on the cut data; only with all data {only_full}, only on the cut data {only_cut}"
            )
            continue
        for (ka, pa), (_, pb) in zip(a, b, strict=True):
            if (pa is None) != (pb is None) or (pa is not None and not math.isclose(pa, pb, rel_tol=rel, abs_tol=1e-300)):
                problems.append(f"cut {cut}: p differs for {ka}: {pa} on all the data, {pb} on the cut data")
                break
    if problems and raise_on_error:
        raise AssertionError("detector is not causal:\n" + "\n".join(problems))
    return problems


# ---------- alerts and incidents (D-034), a port of @aei/alerts ----------

CARRIERS_OF = {
    "esbl": ["Escherichia coli", "Klebsiella pneumoniae", "Klebsiella oxytoca", "Proteus mirabilis", "Citrobacter freundii"],
    "mrsa": ["Staphylococcus aureus"],
    "vre": ["Enterococcus faecalis"],
    "cpe": ["Escherichia coli", "Klebsiella pneumoniae", "Klebsiella oxytoca", "Proteus mirabilis", "Citrobacter freundii"],
}
INCIDENT_DAYS = 28


@dataclass(slots=True)
class Alert:
    """What an incident is built from: an alert of the tool or of a detector's episode (`kind`: cpe, new-in-unit or
    detector); `sampling` marks data-quality alerts (they share one tag)."""

    id: str
    date: str
    ward: str | None
    kind: str = "detector"
    organism: str | None = None
    phenotype: str | None = None
    sampling: bool = False
    incident: str | None = None


def group_incidents(alerts: Sequence[Alert]) -> list[Alert]:
    """`groupIncidents` (D-034): an alert joins an earlier one's incident when it is about the same unit and shares its
    organism or phenotype (a phenotype implies its organisms; sampling alerts share one tag) and comes within 28 days
    of the incident's latest alert; `incident` is the first alert's id. Returns the alerts in date and id order."""

    def tags(a: Alert) -> list[str]:
        if a.sampling:
            return ["sampling"]
        out = []
        if a.organism:
            out.append(f"org:{a.organism}")
        if a.phenotype:
            out.append(f"ph:{a.phenotype}")
            out += [f"org:{o}" for o in CARRIERS_OF[a.phenotype]]
        if a.kind == "cpe":
            out.append("ph:cpe")
        return out

    open_: list[dict] = []
    out = []
    for a in sorted(alerts, key=lambda a: (a.date, a.id)):
        t = tags(a)
        hit = next(
            (i for i in open_ if a.ward is not None and i["ward"] == a.ward and days_between(i["last"], a.date) <= INCIDENT_DAYS and any(x in i["tags"] for x in t)),
            None,
        )
        if hit is not None:
            hit["last"] = a.date
            hit["tags"].update(t)
            out.append(Alert(a.id, a.date, a.ward, a.kind, a.organism, a.phenotype, a.sampling, hit["id"]))
        else:
            open_.append({"id": a.id, "ward": a.ward, "tags": set(t), "last": a.date})
            out.append(Alert(a.id, a.date, a.ward, a.kind, a.organism, a.phenotype, a.sampling, a.id))
    return out


def alerts_of(detector, signals: Sequence[Signal]) -> list[Alert]:
    """One alert per group of `detector.alert_groups(signals)`, on the group's first signal."""
    out = []
    for g in detector.alert_groups(signals):
        s = g[0]
        if s.detector == "new-in-unit":
            out.append(Alert(f"new:{s.phenotype}:{s.ward}:{s.date}", s.date, s.ward, "new-in-unit", s.organism, s.phenotype))
        else:
            out.append(
                Alert(f"detector:{s.detector}:{s.key}:{s.date}", s.date, s.ward, "detector", s.organism, s.phenotype, detector.kind_of(s) == "data")
            )
    return out


def cpe_alerts(records: Sequence[IsolateRecord]) -> list[Alert]:
    """Every CPE isolate is an alert on its sample date (D-014)."""
    return [Alert(f"cpe:{r.isolate_id}", r.sample_date, r.ward, "cpe", r.organism) for r in records if "cpe" in r.phenotypes]


def build_alerts(records: Sequence[IsolateRecord], signals: Sequence[Signal], detector: Detector) -> list[Alert]:
    """`buildAlerts` of the tool: CPE finds, new in a unit and detector episodes (the detector's `signals` at the level
    to be read), grouped into incidents."""
    return group_incidents([*cpe_alerts(records), *alerts_of(detector, signals)])


# ---------- the fixed episode key and the exclusion zones of D4 ----------

ECOLI, SAUREUS, PAERU = "Escherichia coli", "Staphylococcus aureus", "Pseudomonas aeruginosa"


def fixed_key(s: Signal, kind: str) -> str:
    """METRICS.md D4's key, the same for every method: unit × organism-or-phenotype (the phenotype when the signal has
    one), the unit alone for data signals, "hospital|series" for hospital-wide ones (organism, and the antibiotic)."""
    unit = s.ward if s.ward else "hospital"
    if kind == "data":
        return unit
    tag = s.phenotype or s.organism or s.key
    if s.ward is None and s.antibiotic:
        tag += f"|{s.antibiotic}"
    return f"{unit}|{tag}"


def zone_of(s: Signal, kind: str) -> str | None:
    """The planted or quarantined event a signal belongs to (Choices 4), or None: E1 URO × E. coli or ESBL from
    2025-05-30 to 2025-08-31; E2 ICU × S. aureus or MRSA 2026-03-01 to 2026-04-30; E3 PHC-S data signals 2025-12-08 to
    12-31; E4 trend signals for E. coli TMP and P. aeruginosa TZP; quarantined: MED-A data signals 2025-05-12 to
    05-31 and MED-A × E. coli 2025-08-25 to 2025-10-31."""
    d = s.date
    if ward_in(s.ward, ("URO",)) and "2025-05-30" <= d <= "2025-08-31" and (s.organism == ECOLI or s.phenotype == "esbl"):
        return "E1"
    if ward_in(s.ward, ("ICU",)) and "2026-03-01" <= d <= "2026-04-30" and (s.organism == SAUREUS or s.phenotype == "mrsa"):
        return "E2"
    if kind == "data" and ward_in(s.ward, ("PHC-S",)) and "2025-12-08" <= d <= "2025-12-31":
        return "E3"
    if kind == "trend" and ((s.organism, s.antibiotic) in {(ECOLI, "TMP"), (PAERU, "TZP")}):
        return "E4"
    if kind == "data" and ward_in(s.ward, ("MED-A",)) and "2025-05-12" <= d <= "2025-05-31":
        return "Q-MED-A-gap"
    if ward_in(s.ward, ("MED-A",)) and "2025-08-25" <= d <= "2025-10-31" and s.organism == ECOLI:
        return "Q-MED-A-ecoli"
    return None


def score_years(period: tuple[str, str] | None = None) -> float:
    a, b = period or harness.SCORE
    return (days_between(a, b) + 1) / 365.25


def episode_counts(
    detector,
    signals: Sequence[Signal],
    level: float,
    kinds: Sequence[str] | None = None,
    period: tuple[str, str] | None = None,
    zones: bool = True,
) -> dict:
    """D4 at `level`: signal episodes over SCORE (or `period`) with the fixed key, merged within 28 days, those with a
    signal in a planted or quarantined zone left out (not with `zones` False, for the tuning year, which has none);
    `kinds` limits the signals counted. Returns episodes per year in total and by the kind of each episode's first
    signal, the counts, and the detector's own alerts per week (its alerts over the period outside the zones). Episodes
    count when their first signal is dated in the period."""
    a, b = period or harness.SCORE
    sigs = [s for s in signals if detector.passes(s, level)]
    kind_of = {id(s): detector.kind_of(s) for s in sigs}
    if kinds is not None:
        sigs = [s for s in sigs if kind_of[id(s)] in kinds]

    def outside(g: list[Signal]) -> bool:
        return not zones or not any(zone_of(s, kind_of[id(s)]) for s in g)

    groups = group_signals(sigs, lambda s: fixed_key(s, kind_of[id(s)]))
    keep = [g for g in groups if a <= g[0].date <= b and outside(g)]
    by_kind = Counter(kind_of[id(g[0])] for g in keep)
    years = score_years((a, b))
    out = {"episodes_per_year": len(keep) / years, "count": len(keep)}
    for k in KINDS:
        out[k] = by_kind.get(k, 0) / years
        out[f"{k}_count"] = by_kind.get(k, 0)
    own = [g for g in detector.alert_groups(sigs) if a <= g[0].date <= b and outside(g)]
    out["alerts"] = len(own)
    out["alerts_per_week"] = len(own) / ((days_between(a, b) + 1) / 7)
    return out


# ---------- D1: the planted events ----------


@dataclass(frozen=True)
class Planted:
    id: str
    unit: str | None
    onset: str | None  # the delay is counted from here; None: report the first signal's date (E4)
    frm: str
    to: str
    kinds: tuple[str, ...]  # the kinds a signal must have to name the event right (D7)
    match: Callable[[Signal, str], bool]


def _is_ecoli_esbl(s: Signal, kind: str) -> bool:
    return s.organism == ECOLI or s.phenotype == "esbl"


def _is_saureus_mrsa(s: Signal, kind: str) -> bool:
    return s.organism == SAUREUS or s.phenotype == "mrsa"


PLANTED = [
    Planted("E1", "URO", "2025-06-04", "2025-06-04", "2025-08-31", ("cluster",), _is_ecoli_esbl),
    Planted("E1_corrected", "URO", "2025-05-30", "2025-05-30", "2025-08-31", ("cluster",), _is_ecoli_esbl),
    Planted("E2", "ICU", "2026-03-03", "2026-03-03", "2026-05-31", ("sentinel", "cluster"), _is_saureus_mrsa),
    Planted("E2_corrected", "ICU", "2026-03-03", "2026-03-03", "2026-05-31", ("sentinel", "cluster"), _is_saureus_mrsa),
    Planted("E3", "PHC-S", "2025-12-08", "2025-12-08", "2026-01-15", ("data",), lambda s, k: k == "data"),
    Planted("E4", None, None, "2000-01-01", "2100-01-01", ("trend",), lambda s, k: k == "trend" and s.organism == ECOLI and s.antibiotic == "TMP"),
]


def _planted_hit(ev: Planted, s: Signal, kind: str) -> bool:
    return (ev.unit is None or ward_in(s.ward, (ev.unit,))) and ev.frm <= s.date <= ev.to and ev.match(s, kind)


def d1_scores(detector, signals: Sequence[Signal], level: float) -> dict:
    """E1 to E4 as 0002 scored them: episodes (detector and own key, 28 days) of the signals passing at `level`, the first
    episode whose first signal matches (0002's matchers, with "data signal" for E3 and "trend signal for urinary E. coli
    trimethoprim" for E4); the delay is days from 0002's start date to that signal (E1 2025-06-04, E2 2026-03-03, E3
    2025-12-08), E4 its date. `E1_corrected` counts from 2025-05-30 and lets the matcher start there (the first
    outbreak isolate, 0002's review); `E2_corrected` is E2's (the start was right). None: never found."""
    sigs = [s for s in signals if detector.passes(s, level)]
    kind_of = {id(s): detector.kind_of(s) for s in sigs}
    eps = episodes(sigs)
    out: dict = {}
    for ev in PLANTED:
        first = next((e.first for e in eps if _planted_hit(ev, e.first, kind_of[id(e.first)])), None)
        out[ev.id] = None if first is None else first.date if ev.onset is None else days_between(ev.onset, first.date)
    return out


# ---------- D2 to D7 from trials ----------


def _median(xs: Sequence[int]) -> int | None:
    s = sorted(xs)
    return s[(len(s) - 1) >> 1] if s else None


def accept_fn(detector, level: float, kinds: Sequence[str] | None = None) -> Callable[[Signal], bool]:
    """The signals that count at `level`: those that pass, and (with `kinds`) have one of the kinds."""
    if kinds is None:
        return lambda s: detector.passes(s, level)
    return lambda s: detector.passes(s, level) and detector.kind_of(s) in kinds


def cell_rate(trials: Sequence[TrialHits], accept: Callable[[Signal], bool]) -> tuple[int, int, int | None]:
    """Trials detected, trials, and the median delay in days over the detected ones."""
    flags = [(t.detected(accept), t.delay(accept)) for t in trials]
    delays = [d for f, d in flags if f and d is not None]
    return sum(1 for f, _ in flags if f), len(flags), _median(delays)


Hits = dict  # seed -> {family: {k: [TrialHits]}, "gaps": {(days, halved): [TrialHits]}}


def run_trials(
    detector,
    records: Sequence[IsolateRecord],
    cultures: Sequence[Culture],
    seeds: Sequence[int],
    families: Sequence[str],
    ks: Sequence[int],
    trials_per_seed: int,
    gap_settings: Sequence[tuple[int, bool]],
) -> Hits:
    return {
        seed: seed_trials(detector, records, cultures, seed, families=families, ks=ks, trials=trials_per_seed, gaps=gap_settings)
        for seed in seeds
    }


def _pool(hits: Hits, family: str, k) -> list[TrialHits]:
    return [t for seed in hits for t in hits[seed].get(family, {}).get(k, [])]


def _per_seed(hits: Hits, family: str, k, accept) -> list[int]:
    return [sum(1 for t in hits[seed].get(family, {}).get(k, []) if t.detected(accept)) for seed in hits]


def d2_block(detector, hits: Hits, families: Sequence[str], ks: Sequence[int], level: float) -> tuple[dict, dict, dict, dict, dict, dict]:
    """D2, D2_delay, intervals, n, per-seed counts and the cluster-signals-only rates, at `level`."""
    accept = accept_fn(detector, level)
    accept_cluster = accept_fn(detector, level, ("cluster",))
    rate, delay, iv, n, per_seed, cluster_only = {}, {}, {}, {}, {}, {}
    for f in families:
        for k in ks:
            trials = _pool(hits, f, k)
            if not trials:
                continue
            key = f"{f}_k{k}"
            hit, tot, med = cell_rate(trials, accept)
            rate[key], delay[key], n[key] = hit / tot, med, tot
            iv[key] = list(wilson(hit, tot))
            per_seed[key] = _per_seed(hits, f, k, accept)
            cluster_only[key] = sum(1 for t in trials if t.detected(accept_cluster)) / tot
    return rate, delay, iv, n, per_seed, cluster_only


def d3_block(detector, hits: Hits, level: float) -> tuple[dict, dict, dict, dict, dict]:
    """D3 and D3_delay (a data-kind signal for the unit within 14 days of the start), intervals, n, and D6 (the share of
    gaps with any non-data signal for the unit within the gap or the 7 days after it) with its count."""
    data = accept_fn(detector, level, ("data",))
    non_data = accept_fn(detector, level, tuple(k for k in KINDS if k != "data"))
    rate, delay, iv, n = {}, {}, {}, {}
    gaps = {g for seed in hits for g in hits[seed].get("gaps", {})}
    gaps_sorted = [g for g in GAP_SETTINGS if g in gaps] + sorted(g for g in gaps if g not in GAP_SETTINGS)
    six_hit = six_n = 0
    for g in gaps_sorted:
        trials = _pool(hits, "gaps", g)
        key = GAP_KEY.get(g, f"half{g[0]}" if g[1] else f"gap{g[0]}")
        hit, tot, med = cell_rate(trials, data)
        rate[key], delay[key], n[key] = hit / tot, med, tot
        iv[key] = list(wilson(hit, tot))
        if g[0] > 0:
            for t in trials:
                six_n += 1
                f = t.first(non_data)
                if f is not None and f <= add_days(t.start, t.k - 1 + 7):
                    six_hit += 1
    d6 = {"share": six_hit / six_n if six_n else None, "hit": six_hit, "n": six_n}
    return rate, delay, iv, n, d6


def d7_block(detector, hits: Hits, families: Sequence[str], ks: Sequence[int], signals: Sequence[Signal], level: float) -> dict:
    """D7: of the planted and injected events detected at `level`, those where some matching signal has the event's
    kind: cluster for injected clusters (k at least 2), data for gaps, E1 cluster, E2 sentinel and cluster, E3 data, E4
    trend (the planted events' signals are those D1's matchers accept)."""
    accept = accept_fn(detector, level)
    named = accept_fn(detector, level, ("cluster",))
    detail: dict = {}
    ev_hit = ev_right = 0
    sigs = [s for s in signals if detector.passes(s, level)]
    for ev in PLANTED:
        if ev.id.endswith("_corrected"):
            continue
        matching = [s for s in sigs if _planted_hit(ev, s, detector.kind_of(s))]
        kinds = {detector.kind_of(s) for s in matching}
        found = bool(matching)
        right = found and all(k in kinds for k in ev.kinds)
        detail[ev.id] = {"found": found, "right": right}
        ev_hit += found
        ev_right += right
    inj_hit = inj_right = 0
    cl_hit = cl_right = 0
    for f in families:
        for k in ks:
            if k < 2:
                continue
            for t in _pool(hits, f, k):
                if t.detected(accept):
                    cl_hit += 1
                    cl_right += t.detected(named)
    gp_hit = gp_right = 0
    data = accept_fn(detector, level, ("data",))
    for g in {g for seed in hits for g in hits[seed].get("gaps", {})}:
        if g[0] >= 2:
            for t in _pool(hits, "gaps", g):
                if t.detected(data):
                    gp_hit += 1
                    gp_right += 1  # a gap is detected through a data signal, which names it right
    inj_hit, inj_right = cl_hit + gp_hit, cl_right + gp_right
    detail["injected_clusters"] = {"detected": cl_hit, "right": cl_right}
    detail["injected_gaps"] = {"detected": gp_hit, "right": gp_right}
    total_hit, total_right = ev_hit + inj_hit, ev_right + inj_right
    return {"share": total_right / total_hit if total_hit else None, "right": total_right, "n": total_hit, "detail": detail}


def d5_curve(detector, signals: Sequence[Signal], hits: Hits, families: Sequence[str], ks: Sequence[int], levels: Sequence[float]) -> list[dict]:
    """One row per level, loosest first: the noise (D4 over cluster and sentinel signals only, episodes a year), the
    whole tool's D4, and D2 at k = 4 with its median delay for each family run."""
    rows = []
    for level in levels:
        noise = episode_counts(detector, signals, level, ("cluster", "sentinel"))
        whole = episode_counts(detector, signals, level)
        row = {"level": level, "noise": noise["episodes_per_year"], "noise_count": noise["count"], "whole_tool": whole["episodes_per_year"]}
        if 4 in ks:
            accept = accept_fn(detector, level)
            for f in families:
                trials = _pool(hits, f, 4)
                if trials:
                    hit, tot, med = cell_rate(trials, accept)
                    row[f] = hit / tot
                    row[f"{f}_hit"] = hit
                    row[f"{f}_n"] = tot
                    row[f"{f}_delay"] = med
        rows.append(row)
    return rows


def d5_headline(curve: Sequence[dict], levels: Sequence[float], noise_limit: float = HEADLINE_NOISE) -> dict:
    """D5's headline: the row of the loosest level whose noise is at most `noise_limit` episodes a year (the strictest
    level when none is), with rare and common_esbl rates and delays at k = 4."""
    row = next((r for r in curve if r["noise"] <= noise_limit), curve[-1])
    out = {"level": row["level"], "noise": row["noise"]}
    for f in ("rare", "common_esbl"):
        if f in row:
            out[f] = row[f]
            out[f"{f}_delay"] = row[f"{f}_delay"]
    if row["noise"] > noise_limit:
        out["note"] = "no level at or under the noise limit; the strictest level is shown"
    return out


class _Cpu:
    """CPU seconds per part, printed."""

    def __init__(self, verbose: bool):
        self.verbose, self.parts, self.t0 = verbose, {}, time.process_time()
        self._last = self.t0

    def mark(self, label: str) -> None:
        now = time.process_time()
        self.parts[label] = round(now - self._last, 1)
        self._last = now
        if self.verbose:
            print(f"[score_detection] {label}: {self.parts[label]:.1f} s CPU")

    @property
    def total(self) -> float:
        return time.process_time() - self.t0


def _ci(hit: int, n: int) -> list[float]:
    return list(wilson(hit, n))


def score_detector(
    detector,
    *,
    families: Sequence[str] = FAMILIES,
    ks: Sequence[int] = KS,
    seeds: Sequence[int] = SEEDS_SCREEN,
    trials_per_seed: int = 200,
    gap_settings: Sequence[tuple[int, bool]] = GAP_SETTINGS,
    level: float | None = None,
    parts: Sequence[str] = ("D1", "D2", "D3", "D4", "D5", "D6", "D7", "I1"),
    records: Sequence[IsolateRecord] | None = None,
    cultures: Sequence[Culture] | None = None,
    full_signals: Sequence[Signal] | None = None,
    verbose: bool = True,
) -> tuple[dict, dict, dict, dict]:
    """Score a detector on METRICS.md's detection family. Defaults: the screening of the overnight run, seed 2026, 200
    trials per cell from one mulberry32 stream (cells in a fixed order: `aei.inject.seed_trials`), five families, k in
    0 (control), 2, 3, 4, 6, and the gap settings d in 2, 3, 5, 7 and a halved week plus a control that is drawn and
    reported in `extra["D3_control"]`. `level` is where D2, D3, D4, D6, D7 and I1 are read: `level`, else the
    detector's `default_level`, else D5's headline level. `full_signals` are the detector's signals on all the data, to
    avoid running it again. Returns (metrics, intervals, n, extra) with exactly the detection keys of the spec's
    "Metric keys" (a part not in `parts`, or a family not run, leaves its keys out); `extra` holds D5_curve,
    D2_per_seed and detail (D2_cluster_signals_only, D3_control, D4_counts, D7_detail, I1_full_tool, operating_level,
    cpu_by_part)."""
    if records is None or cultures is None:
        records, cultures = harness.data()
    cpu = _Cpu(verbose)
    want = set(parts)
    levels = tuple(detector.levels)
    ks = tuple(ks)
    families = tuple(families)
    fixed_level = level if level is not None else getattr(detector, "default_level", None)
    need_curve = "D5" in want or fixed_level is None
    need_full = bool(want & {"D1", "D4", "D7", "I1"}) or need_curve
    signals = full_signals
    if signals is None and need_full:
        signals = detector.run(records, cultures, None)
        cpu.mark(f"full run, {len(signals)} signals at the loosest level")
    gaps_on = bool(gap_settings) and bool(want & {"D3", "D6", "D7"})
    run_families = families if want & {"D2", "D5", "D7"} or fixed_level is None else ()
    hits: Hits = {}
    if run_families or gaps_on:
        hits = run_trials(detector, records, cultures, seeds, run_families, ks, trials_per_seed, tuple(gap_settings) if gaps_on else ())
        cpu.mark("trials")
    metrics: dict = {}
    intervals: dict = {}
    n: dict = {}
    extra: dict = {}

    curve = headline = None
    if need_curve and signals is not None:
        curve = d5_curve(detector, signals, hits, run_families, ks, levels)
        headline = d5_headline(curve, levels)
        cpu.mark("D5 curve")
    op = fixed_level if fixed_level is not None else headline["level"]
    extra["operating_level"] = op

    if "D1" in want:
        metrics["D1"] = d1_scores(detector, signals, op)
    if "D2" in want and run_families:
        rate, delay, iv, nn, per_seed, cluster_only = d2_block(detector, hits, run_families, ks, op)
        metrics["D2"], metrics["D2_delay"] = rate, delay
        intervals["D2"], n["D2"] = iv, nn
        extra["D2_per_seed"] = per_seed
        extra["D2_cluster_signals_only"] = cluster_only
    if gaps_on and want & {"D3", "D6"}:
        rate, delay, iv, nn, d6 = d3_block(detector, hits, op)
        control = {name: d.pop("gap0") for name, d in (("rate", rate), ("delay", delay), ("interval", iv), ("n", nn)) if "gap0" in d}
        if "D3" in want:
            metrics["D3"], metrics["D3_delay"] = rate, delay
            intervals["D3"], n["D3"] = iv, nn
            extra["D3_control"] = control
        if "D6" in want:
            metrics["D6"] = d6["share"]
            intervals["D6"] = _ci(d6["hit"], d6["n"]) if d6["n"] else None
            n["D6"] = d6["n"]
    if "D4" in want:
        d4 = episode_counts(detector, signals, op)
        metrics["D4"] = {k: d4[k] for k in ("episodes_per_year", *KINDS, "alerts_per_week")}
        n["D4"] = {"episodes_per_year": d4["count"], **{k: d4[f"{k}_count"] for k in KINDS}, "alerts_per_week": d4["alerts"]}
        extra["D4_score_years"] = score_years()
    if "D5" in want:
        row = next(r for r in curve if r["level"] == headline["level"])
        metrics["D5"] = {k: v for k, v in headline.items() if k != "note"}
        n["D5"] = {"noise": row["noise_count"]}
        for f in ("rare", "common_esbl"):
            if f in row:
                intervals.setdefault("D5", {})[f] = _ci(row[f"{f}_hit"], row[f"{f}_n"])
                n["D5"][f] = row[f"{f}_n"]
        extra["D5_curve"] = curve
        if "note" in headline:
            extra["D5_note"] = headline["note"]
    if "D7" in want:
        d7 = d7_block(detector, hits, run_families, ks, signals, op)
        metrics["D7"] = d7["share"]
        n["D7"] = d7["n"]
        if d7["n"]:
            intervals["D7"] = _ci(d7["right"], d7["n"])
        extra["D7_detail"] = d7["detail"]
    if "I1" in want:
        a, b = harness.SCORE
        sigs = [s for s in signals if detector.passes(s, op)]
        alerts = [x for x in group_incidents(alerts_of(detector, sigs)) if a <= x.date <= b]
        inc = len({x.incident for x in alerts})
        metrics["I1"] = {"alerts": len(alerts), "incidents": inc, "alerts_per_incident": len(alerts) / inc if inc else None}
        n["I1"] = {"alerts": len(alerts), "incidents": inc}
        full = [x for x in build_alerts(records, sigs, detector) if a <= x.date <= b]
        extra["I1_full_tool"] = {"alerts": len(full), "incidents": len({x.incident for x in full}), "includes": "CPE finds (D-014)"}
    cpu.mark("D1 to D7, I1")
    extra["cpu_by_part"] = cpu.parts
    extra["trial_seeds"] = list(seeds)
    extra["trials_per_seed"] = trials_per_seed
    return metrics, intervals, n, extra


def confirm(
    detector,
    *,
    families: Sequence[str] = FAMILIES,
    ks: Sequence[int] = KS,
    seeds: Sequence[int] = SEEDS_HELDOUT,
    trials_per_seed: int = 50,
    gap_settings: Sequence[tuple[int, bool]] = GAP_SETTINGS,
    level: float | None = None,
    records: Sequence[IsolateRecord] | None = None,
    cultures: Sequence[Culture] | None = None,
    full_signals: Sequence[Signal] | None = None,
    verbose: bool = True,
) -> tuple[dict, dict, dict, dict]:
    """Re-score D2, D3 and D5 on the held-out seeds (2027 to 2030, 50 trials per seed, 200 per cell), with the same
    level as the screening would use. Returns (metrics, intervals, n, extra) with the screening's keys plus the suffix
    `_heldout`: D2_heldout, D2_heldout_delay, D3_heldout, D3_heldout_delay, D5_heldout; extra holds
    D2_heldout_per_seed and D5_heldout_curve. Held-out seeds are for confirming a winner, not for tuning."""
    m, iv, nn, ex = score_detector(
        detector,
        families=families,
        ks=ks,
        seeds=seeds,
        trials_per_seed=trials_per_seed,
        gap_settings=gap_settings,
        level=level,
        parts=("D2", "D3", "D5"),
        records=records,
        cultures=cultures,
        full_signals=full_signals,
        verbose=verbose,
    )
    rename = {"D2": "D2_heldout", "D2_delay": "D2_heldout_delay", "D3": "D3_heldout", "D3_delay": "D3_heldout_delay", "D5": "D5_heldout"}
    metrics = {rename[k]: v for k, v in m.items() if k in rename}
    intervals = {rename[k]: v for k, v in iv.items() if k in rename}
    n = {rename[k]: v for k, v in nn.items() if k in rename}
    extra = {"D2_heldout_per_seed": ex.get("D2_per_seed", {}), "D5_heldout_curve": ex.get("D5_curve", []), "heldout_seeds": list(seeds), "heldout_trials_per_seed": trials_per_seed, "cpu_by_part_heldout": ex.get("cpu_by_part")}
    if "D3_control" in ex:
        extra["D3_heldout_control"] = ex["D3_control"]
    return metrics, intervals, n, extra


# ---------- a year-1 curve for any detector ----------


def tune_curve(
    detector,
    records: Sequence[IsolateRecord] | None = None,
    cultures: Sequence[Culture] | None = None,
    *,
    families: Sequence[str] = ("rare", "common_esbl"),
    k: int = 4,
    trials: int = 40,
    seed: int = 2026,
    starts: tuple[str, str] = ("2024-04-01", "2024-08-15"),
    noise_window: tuple[str, str] = ("2024-04-01", "2024-09-30"),
    noise_kinds: Sequence[str] | None = ("cluster", "sentinel"),
) -> list[dict]:
    """Choices 5's stand-in events for tuning any detector on year 1 only: `trials` clusters of k patients per family
    (`rare` or `common_esbl`; one mulberry32(`seed`) stream, families in turn, unit uniform, start uniform over `starts`),
    with the detector seeing no data after the end of the tuning year, and the real-data noise over `noise_window`.
    One row per level, loosest first: `level`, `noise_per_year` (fixed-key episodes of the `noise_kinds` signals over the
    window, scaled to a year, no exclusion zones since year 1 has none), and for each family `<family>` (detection rate),
    `<family>_hit`, `<family>_n`, `<family>_delay` (median days). Pick a setting from it; do not look at the scoring
    period to do so."""
    if records is None or cultures is None:
        records, cultures = harness.data()
    end = harness.TUNE[1]
    recs = [r for r in records if r.sample_date <= end]
    cults = [c for c in cultures if c.sample_date <= end]
    base = base_of(recs, cults)
    rand = mulberry32(seed)
    span = days_between(*starts)
    hits: dict[str, list[TrialHits]] = {}
    t = 0
    for f in families:
        hits[f] = []
        for _ in range(trials):
            while True:
                unit = UNITS[_pick_int(rand, len(UNITS))]
                start = add_days(starts[0], _pick_int(rand, span + 1))
                if f == "rare":
                    source = base.sources[_pick_int(rand, len(base.sources))]
                    break
                group = base.common_group(unit, start, "common ESBL E. coli")
                if group:
                    source = group[_pick_int(rand, len(group))]
                    break
            hits[f].append(cluster_hits(detector, base, source, [(unit, k)], start, rand, t, family=f, k=k))
            t += 1
    signals = detector.run(recs, cults, None)
    rows = []
    for level in detector.levels:
        noise = episode_counts(detector, signals, level, noise_kinds, noise_window, zones=False)
        row = {"level": level, "noise_per_year": noise["episodes_per_year"], "noise_count": noise["count"]}
        accept = accept_fn(detector, level)
        for f in families:
            hit, tot, med = cell_rate(hits[f], accept)
            row.update({f: hit / tot, f"{f}_hit": hit, f"{f}_n": tot, f"{f}_delay": med})
        rows.append(row)
    return rows


# ---------- the year-1 re-tune of the live set (Choices 5) ----------

TUNE_GRID = (0.01, 0.001, 0.0001)
_TUNED = (
    ("profile excess", "profile-excess", "profile_alpha"),
    ("phenotype excess", "phenotype-excess", "phenotype_alpha"),
    ("sampling drop", "sampling-drop", "sampling_alpha"),
    ("empty run", "empty-run", "empty_alpha"),
)


def retune_live_set(
    records: Sequence[IsolateRecord] | None = None,
    cultures: Sequence[Culture] | None = None,
    *,
    grid: Sequence[float] = TUNE_GRID,
    seed: int = 2026,
    trials: int = 40,
    starts: tuple[str, str] = ("2024-04-01", "2024-08-15"),
    noise_window: tuple[str, str] = ("2024-04-01", "2024-09-30"),
    bar: float = 0.8,
    verbose: bool = True,
) -> tuple[LiveSet, list[dict]]:
    """Choices 5, the live set re-tuned on year 1 "by the same procedure" as 0002: per detector and alpha of `grid`, how
    often it detects injected events (the data it sees stops at the end of year 1) and how many other episodes it
    raises over the real data of `noise_window`; take the alpha with the fewest episodes among those detecting at least
    `bar` of the events, else the one detecting most (ties: fewest episodes, then the stricter alpha). Events, `trials`
    each from one mulberry32(`seed`) stream with starts uniform over `starts`: rare clusters of 4 for profile and
    phenotype excess (the source a random ESBL or MRSA clone of year 1), 5-day gaps for sampling drop, 3-day gaps for
    empty run. The trend test and new-in-unit keep their shipped settings. Returns the LiveSet with the chosen alphas
    and the table it chose from (one row per detector and alpha)."""
    if records is None or cultures is None:
        records, cultures = harness.data()
    cpu0 = time.process_time()
    tune_end = harness.TUNE[1]
    recs = [r for r in records if r.sample_date <= tune_end]
    cults = [c for c in cultures if c.sample_date <= tune_end]
    base = base_of(recs, cults)
    loose = max(grid)
    probe = LiveSet(
        levels=(1.0,), profile_alpha=loose, phenotype_alpha=loose, sampling_alpha=loose, empty_alpha=loose, new_in_unit_days=None
    )  # signals at the loosest alpha of the grid; each alpha is read from p
    rand = mulberry32(seed)
    span = days_between(*starts)

    def draw() -> tuple[str, str]:
        return UNITS[_pick_int(rand, len(UNITS))], add_days(starts[0], _pick_int(rand, span + 1))

    clusters: list[TrialHits] = []
    for t in range(trials):
        unit, start = draw()
        source = base.sources[_pick_int(rand, len(base.sources))]
        clusters.append(cluster_hits(probe, base, source, [(unit, 4)], start, rand, t, family="rare", k=4))
    gaps5: list[TrialHits] = []
    for _ in range(trials):
        unit, start = draw()
        gaps5.append(gap_at(probe, base, unit, start, 5))
    gaps3: list[TrialHits] = []
    for _ in range(trials):
        unit, start = draw()
        gaps3.append(gap_at(probe, base, unit, start, 3))
    events = {"profile-excess": clusters, "phenotype-excess": clusters, "sampling-drop": gaps5, "empty-run": gaps3}
    real = {
        "profile-excess": profile_excess(recs, **{**LIVE_SETTINGS["profile_excess"], "alpha": loose}),
        "phenotype-excess": phenotype_excess(recs, PHENOTYPES, **{**LIVE_SETTINGS["phenotype_excess"], "alpha": loose}),
        "sampling-drop": sampling_drop(cults, **{**LIVE_SETTINGS["sampling_drop"], "alpha": loose}),
        "empty-run": empty_run(cults, **{**LIVE_SETTINGS["empty_run"], "alpha": loose}),
    }
    table: list[dict] = []
    chosen: dict[str, float] = {}
    for label, detector_name, attr in _TUNED:
        rows = []
        for alpha in sorted(grid, reverse=True):

            def accept(s: Signal, name=detector_name, a=alpha) -> bool:
                return s.detector == name and s.p is not None and s.p < a

            hit = sum(1 for t in events[detector_name] if t.detected(accept))
            noise = [s for s in real[detector_name] if s.p < alpha and noise_window[0] <= s.date <= noise_window[1]]
            rows.append(
                {
                    "detector": label,
                    "alpha": alpha,
                    "events": f"{'rare cluster of 4' if detector_name.endswith('excess') else '5-day gap' if detector_name == 'sampling-drop' else '3-day gap'}",
                    "detected": hit,
                    "n": trials,
                    "rate": hit / trials,
                    "other_episodes": len(episodes(noise)),
                    "chosen": False,
                }
            )
        ok = [r for r in rows if r["rate"] >= bar]
        pick = (
            min(ok, key=lambda r: (r["other_episodes"], -r["detected"], r["alpha"]))
            if ok
            else max(rows, key=lambda r: (r["detected"], -r["other_episodes"], -r["alpha"]))
        )
        pick["chosen"] = True
        chosen[attr] = pick["alpha"]
        table += rows
    live = LiveSet(name="live set re-tuned on year 1 (Choices 5)", **chosen)
    if verbose:
        print(f"[score_detection] re-tune: {chosen}, {time.process_time() - cpu0:.1f} s CPU")
    return live, table
