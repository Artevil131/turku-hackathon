"""Experiment 0015: the Gamma-Poisson surprise test with a guard band, a minimum-count filter and Benjamini-Hochberg
q-values (ENGINE.md 3.3), as a detector for `aei.score_detection`. Formulas and their derivation: README.md, "Mathematical
foundation".

A series is a unit x phenotype (esbl, mrsa, vre, cpe) or a unit x organism x specimen. An event is a patient's first
isolate of the series in the unit within the trailing 365 days (no earlier isolate of that patient in that series and unit
in the 365 days before; one event per day), dated by sample date. On day t, for a setting (S, g, L) in weeks:

    window    the L weeks ending at t                                       count y
    guard     the g weeks before the window                                 not counted
    baseline  the S weeks before the guard band                             count C
    r_hosp    the hospital's events of the series over the baseline divided by the hospital's isolates over the
              baseline, times the unit's isolates over the baseline (the expected events over the whole baseline)
    prior     Gamma(C + k r_hosp, S (1 + k)), k = 0.1  (r_hosp here is already summed over the S weeks)
    Y         NegativeBinomial(n = C + k r_hosp, p = S (1 + k) / (S (1 + k) + L))
    p         P(Y >= y)  (clipped at 1e-300), tested only when y >= 2; q = Benjamini-Hochberg adjusted p over the series
              tested that day (both families together)

A `Signal` carries `p` = the q-value, so the harness's filter `p < level` is BH at `level`. Signals are emitted at q < 0.2.
Where the predictive's shape C + k r_hosp is exactly 0 (neither the unit nor the hospital had an event of the series in the
baseline) Y is 0 for sure and p is 0, clipped to 1e-300. `organism_series=False` leaves the unit x organism x specimen
series out (the 36 phenotype series only), a control that is not in the plan.

The alert budget (B = 3 series per ISO week, hospital-wide) is evaluated as of the day (causal): a signal of day t is kept
when its series is among the B series with the highest score so far (the maximum of -log10 p over the passing signals of
the ISO week up to t). It depends on the level (it ranks only the signals that pass), so each signal carries, in the
otherwise unused `profile` field, a string of 0 and 1 saying whether it survives the budget at each of `LEVELS`.

`Engine` holds the real data encoded once. A trial of `aei.inject` hands the detector the real rows up to the trial's end
plus injected rows (or minus removed ones, in a gap trial) and a `Focus`; the engine then takes the change relative to the
real data (rows not in the real data are injected, real rows missing from the focus window are removed), updates the event
counts exactly (a removed row can make a patient's next isolate an event) and computes the tests for the days of the
window only, for every series, so BH and the budget see the whole hospital. `reference_signals` computes every signal from
scratch from the rows it is given; the two agree (checked in run.py), and any trial the fast path cannot take falls back to
the from-scratch computation.
"""

from __future__ import annotations

import datetime as _dt
from bisect import bisect_left, bisect_right
from collections.abc import Sequence
from dataclasses import dataclass, field

import numpy as np
from scipy import stats

from aei.dataset import Culture, IsolateRecord
from aei.dates import add_days, days_between
from aei.detect import Signal
from aei.domain import PHENOTYPES, SPECIMENS, UNITS
from aei.score_detection import Detector
from aei.inject import Focus

K = 0.1  # prior weight in weeks of the hospital's rate (QUESTIONS C3)
Y_MIN = 2  # minimum count to be tested
BUDGET = 3  # series per ISO week
DEDUP_DAYS = 365
P_FLOOR = 1e-300
LEVELS = (0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.001, 0.0001)
LEVEL_INDEX = {lv: i for i, lv in enumerate(LEVELS)}
DETECTOR = "gamma-poisson"


def _sample_date(x) -> str:
    return x.sample_date


# ---------- the series ----------


@dataclass(frozen=True, slots=True)
class Series:
    key: str  # "URO|esbl" or "URO|Escherichia coli|urine"
    unit: str
    phenotype: str | None
    organism: str | None
    group: str  # the hospital-wide series it is a part of


def make_series(organisms: Sequence[str], organism_series: bool = True) -> list[Series]:
    """Every series of the universe (36 unit x phenotype, and with `organism_series` 9 x organisms x 3 unit x organism x
    specimen), sorted by key so that ties are broken the same way whatever the data."""
    out = [Series(f"{u}|{ph}", u, ph, None, f"ph:{ph}") for u in UNITS for ph in PHENOTYPES]
    if organism_series:
        out += [Series(f"{u}|{o}|{sp}", u, None, o, f"os:{o}|{sp}") for u in UNITS for o in organisms for sp in SPECIMENS]
    out.sort(key=lambda s: s.key)
    return out


def memberships(r: IsolateRecord) -> list[str]:
    """The series keys an isolate belongs to: its organism x specimen series and one per phenotype, in its unit."""
    keys = [f"{r.ward}|{r.organism}|{r.specimen}"]
    keys += [f"{r.ward}|{ph}" for ph in r.phenotypes if ph in PHENOTYPES]
    return keys


# ---------- the real data encoded ----------


class World:
    """Records in date order, encoded: memberships (record, series, day, patient), event flags, daily event counts per
    series, daily isolates per unit, and the cumulative sums the tests read."""

    def __init__(self, records: Sequence[IsolateRecord], organism_series: bool = True):
        self.records = records
        self.organism_series = organism_series
        n = len(records)
        self.day0 = records[0].sample_date
        self.n_days = D = days_between(self.day0, records[-1].sample_date) + 1
        self.dates = [add_days(self.day0, i) for i in range(D)]
        self.day_of = {d: i for i, d in enumerate(self.dates)}
        self.rdates = [r.sample_date for r in records]
        self.series = make_series(sorted({r.organism for r in records}), organism_series)
        ns = self.n_series = len(self.series)
        self.sidx = {s.key: i for i, s in enumerate(self.series)}
        self.uidx = {u: i for i, u in enumerate(UNITS)}
        groups = sorted({s.group for s in self.series})
        gidx = {g: i for i, g in enumerate(groups)}
        self.n_groups = len(groups)
        self.group_of = np.array([gidx[s.group] for s in self.series], dtype=np.int64)
        self.unit_of = np.array([self.uidx[s.unit] for s in self.series], dtype=np.int64)
        self.group_perm = np.argsort(self.group_of, kind="stable")
        self.group_starts = np.searchsorted(self.group_of[self.group_perm], np.arange(self.n_groups))
        self.patient_code: dict[str, int] = {}
        wd0 = _dt.date.fromisoformat(self.day0).weekday()
        self.week_start = np.arange(D) - ((wd0 + np.arange(D)) % 7)  # day index of the Monday of each day's ISO week
        mem_s: list[int] = []
        mem_d: list[int] = []
        mem_p: list[int] = []
        rec_start = np.empty(n + 1, dtype=np.int64)
        vol_idx: list[int] = []
        sidx, uidx, day_of, pc = self.sidx, self.uidx, self.day_of, self.patient_code
        for i, r in enumerate(records):
            rec_start[i] = len(mem_s)
            d = day_of[r.sample_date]
            p = pc.setdefault(r.patient_id, len(pc))
            vol_idx.append(uidx[r.ward] * D + d)
            for key in self.keys_of(r):
                mem_s.append(sidx[key])
                mem_d.append(d)
                mem_p.append(p)
        rec_start[n] = len(mem_s)
        self.rec_start = rec_start
        self.mem_series = np.array(mem_s, dtype=np.int64)
        self.mem_day = np.array(mem_d, dtype=np.int64)
        self.mem_patient = np.array(mem_p, dtype=np.int64)
        self.rid = {id(r): i for i, r in enumerate(records)}
        key = self.mem_patient * ns + self.mem_series
        order = np.lexsort((np.arange(len(key)), self.mem_day, key))
        ks, ds = key[order], self.mem_day[order]
        ev_sorted = np.ones(len(key), dtype=bool)
        ev_sorted[1:] = (ks[1:] != ks[:-1]) | (ds[1:] - ds[:-1] > DEDUP_DAYS)
        self.mem_event = np.empty(len(key), dtype=bool)
        self.mem_event[order] = ev_sorted
        self.keys_sorted, self.order_sorted = ks, order  # a (patient, series) group is a run of order_sorted by (day, membership)
        ev = self.mem_event
        E = np.bincount(self.mem_series[ev] * D + self.mem_day[ev], minlength=ns * D).reshape(ns, D)
        vol = np.bincount(np.array(vol_idx, dtype=np.int64), minlength=len(UNITS) * D).reshape(len(UNITS), D)
        self.events_per_day = E
        self.cum = Cum.build(self, E, vol)

    def keys_of(self, r: IsolateRecord) -> list[str]:
        """The series of the universe an isolate belongs to."""
        keys = memberships(r)
        return keys if self.organism_series else keys[1:]  # `memberships` gives the organism series first


@dataclass
class Cum:
    """Cumulative sums, one extra leading column of zeros: events per series, isolates per unit, events per hospital-wide
    series, isolates in the hospital."""

    E: np.ndarray
    V: np.ndarray
    HE: np.ndarray
    N: np.ndarray

    @staticmethod
    def build(w: World, E: np.ndarray, vol: np.ndarray) -> Cum:
        D = w.n_days
        cumE = np.zeros((E.shape[0], D + 1), dtype=np.int64)
        np.cumsum(E, axis=1, out=cumE[:, 1:])
        cumV = np.zeros((vol.shape[0], D + 1), dtype=np.int64)
        np.cumsum(vol, axis=1, out=cumV[:, 1:])
        HE = np.add.reduceat(E[w.group_perm], w.group_starts, axis=0)
        cumHE = np.zeros((HE.shape[0], D + 1), dtype=np.int64)
        np.cumsum(HE, axis=1, out=cumHE[:, 1:])
        cumN = np.zeros(D + 1, dtype=np.int64)
        np.cumsum(vol.sum(axis=0), out=cumN[1:])
        return Cum(cumE, cumV, cumHE, cumN)

    def copy(self) -> Cum:
        return Cum(self.E.copy(), self.V.copy(), self.HE.copy(), self.N.copy())


# ---------- the test ----------


@dataclass
class Tests:
    """The tests of a range of days, arrays [series, day]: count y, predictive mean, raw p (1 where not tested), q (1 where
    not tested), whether tested, and the number tested each day."""

    days: np.ndarray
    y: np.ndarray
    alpha: np.ndarray
    mean: np.ndarray
    p: np.ndarray
    q: np.ndarray
    tested: np.ndarray
    m: np.ndarray


def first_valid_day(S: int, g: int, L: int) -> int:
    """The first day index with a full baseline: 7 (S + g + L) days of data, counting the day itself."""
    return 7 * (S + g + L) - 1


def run_tests(w: World, cum: Cum, days: np.ndarray, S: int, g: int, L: int) -> Tests:
    """The Gamma-Poisson predictive tests and BH q-values for every series on each of `days` (day indices, all at or after
    `first_valid_day`)."""
    W, G, B = 7 * L, 7 * g, 7 * S
    w_lo = days - W + 1
    b_hi = w_lo - G - 1
    b_lo = b_hi - B + 1
    y = cum.E[:, days + 1] - cum.E[:, w_lo]
    C = cum.E[:, b_hi + 1] - cum.E[:, b_lo]
    hosp_events = (cum.HE[:, b_hi + 1] - cum.HE[:, b_lo])[w.group_of]
    hosp_isolates = cum.N[b_hi + 1] - cum.N[b_lo]
    unit_isolates = (cum.V[:, b_hi + 1] - cum.V[:, b_lo])[w.unit_of]
    share = np.divide(hosp_events, hosp_isolates, out=np.zeros(hosp_events.shape), where=hosp_isolates > 0)
    alpha = C + K * share * unit_isolates  # k r_hosp over the whole baseline, plus the unit's own count
    beta = S * (1 + K)
    pnb = beta / (beta + L)
    mean = alpha * L / beta
    tested = y >= Y_MIN
    p = np.ones(y.shape)
    sel = np.nonzero(tested)
    if len(sel[0]):
        a = alpha[sel]
        pv = np.where(a > 0, stats.nbinom.sf(y[sel] - 1, np.where(a > 0, a, 1.0), pnb), 0.0)  # alpha 0: Y is 0 for sure
        p[sel] = np.clip(pv, P_FLOOR, 1.0)
    return Tests(days, y, alpha, mean, p, bh(p, tested), tested, tested.sum(axis=0))


def bh(p: np.ndarray, tested: np.ndarray) -> np.ndarray:
    """Benjamini-Hochberg adjusted p-values (q) over the tested entries of each column of `p`: with m tested and p_(1) <=
    ... <= p_(m), q_(i) = min over j >= i of m p_(j) / j, capped at 1; ties in p are ordered by row (series) index.
    Untested entries get 1."""
    ns, nd = p.shape
    pm = np.where(tested, p, np.inf)
    order = np.argsort(pm, axis=0, kind="stable")
    sp = np.take_along_axis(pm, order, axis=0)
    m = tested.sum(axis=0)
    ranks = np.arange(1, ns + 1)[:, None]
    with np.errstate(invalid="ignore", over="ignore"):
        raw = np.where(np.isfinite(sp), m[None, :] * sp / ranks, np.inf)
    qs = np.minimum(np.minimum.accumulate(raw[::-1], axis=0)[::-1], 1.0)
    q = np.ones_like(p)
    np.put_along_axis(q, order, np.where(np.isfinite(sp), qs, 1.0), axis=0)
    return q


def budget_masks(si: np.ndarray, day: np.ndarray, score: np.ndarray, q: np.ndarray, week: np.ndarray, levels: Sequence[float] = LEVELS, budget: int = BUDGET) -> list[str]:
    """For each signal (arrays in day order), a string with one 0 or 1 per level: whether the signal survives the weekly
    budget at that level. Among the signals with q < level, the budget keeps a signal of day t when its series is among the
    `budget` series with the highest running maximum of the score over the ISO week up to and including t (ties to the
    series with the lower index). Causal: nothing dated after t is read."""
    n = len(si)
    keep = np.zeros((len(levels), n), dtype=bool)
    for j, level in enumerate(levels):
        sel = np.nonzero(q < level)[0]
        i = 0
        cur_week = None
        run_max: dict[int, float] = {}
        while i < len(sel):
            d = day[sel[i]]
            if week[d] != cur_week:
                cur_week, run_max = week[d], {}
            e = i
            while e < len(sel) and day[sel[e]] == d:
                s = si[sel[e]]
                run_max[s] = max(run_max.get(s, -1.0), score[sel[e]])
                e += 1
            top = {s for s, _ in sorted(run_max.items(), key=lambda kv: (-kv[1], kv[0]))[:budget]}
            for t in sel[i:e]:
                keep[j, t] = si[t] in top
            i = e
    return ["".join("1" if keep[j, t] else "0" for j in range(len(levels))) for t in range(n)]


def make_signals(w: World, tests: Tests, S: int, L: int, units: Sequence[str] | None = None, from_day: int | None = None) -> list[Signal]:
    """The signals (q below the loosest level) of the days of `tests`, with budget masks in `profile`; only those for
    `units` and from `from_day` on when given (the budget is ranked over all of them first)."""
    si, dj = np.nonzero(tests.q < LEVELS[0])
    if not len(si):
        return []
    o = np.lexsort((si, dj))
    si, dj = si[o], dj[o]
    days = tests.days[dj]
    score = -np.log10(tests.p[si, dj])
    masks = budget_masks(si, days, score, tests.q[si, dj], w.week_start)
    out = []
    for k in range(len(si)):
        s = w.series[si[k]]
        if units is not None and s.unit not in units:
            continue
        if from_day is not None and days[k] < from_day:
            continue
        out.append(
            Signal(DETECTOR, s.key, w.dates[days[k]], s.unit, int(tests.y[si[k], dj[k]]), organism=s.organism, phenotype=s.phenotype,
                   profile=masks[k], expected=float(tests.mean[si[k], dj[k]]), p=float(tests.q[si[k], dj[k]]))
        )
    return out


def reference_signals(records: Sequence[IsolateRecord], S: int, g: int, L: int, organism_series: bool = True) -> list[Signal]:
    """Every signal of the setting computed from scratch from `records` (date order): the definition of the detector."""
    if not records:
        return []
    w = World(records, organism_series)
    first = first_valid_day(S, g, L)
    if first >= w.n_days:
        return []
    return make_signals(w, run_tests(w, w.cum, np.arange(first, w.n_days), S, g, L), S, L)


# ---------- the fast path for trials ----------


class Engine:
    """The real data encoded once, shared by detectors of any setting; `focused` computes a trial's signals."""

    def __init__(self, records: Sequence[IsolateRecord], organism_series: bool = True):
        self.records = records
        self.world = World(records, organism_series)
        self.fast = 0
        self.fallback = 0

    def full(self, records: Sequence[IsolateRecord], S: int, g: int, L: int) -> list[Signal]:
        if records is self.records:
            w = self.world
            first = first_valid_day(S, g, L)
            if first >= w.n_days:
                return []
            return make_signals(w, run_tests(w, w.cum, np.arange(first, w.n_days), S, g, L), S, L)
        return reference_signals(records, S, g, L, self.world.organism_series)

    def focused(self, records: Sequence[IsolateRecord], focus: Focus, S: int, g: int, L: int) -> list[Signal] | None:
        """The signals for the focus units dated `focus.start` to `focus.end` of a trial whose rows are the real ones up to
        `focus.end` with rows added dated at or after the start and real rows of the window removed; None when the rows
        are not of that form (the caller computes from scratch)."""
        w = self.world
        start, end = focus.start, focus.end
        if start not in w.day_of or not records:
            return None
        lo = bisect_left(records, start, key=_sample_date)
        wlo = bisect_left(w.rdates, start)
        if lo != wlo or (lo > 0 and (records[lo - 1] is not w.records[lo - 1] or records[0] is not w.records[0])):
            return None
        end_day = w.day_of.get(end, w.n_days - 1)
        whi = bisect_right(w.rdates, w.dates[end_day])
        rid = w.rid
        injected: list[IsolateRecord] = []
        present: set[int] = set()
        for r in records[lo:]:
            j = rid.get(id(r))
            if j is None:
                injected.append(r)
            else:
                present.add(j)
        if any(j >= whi for j in present):
            return None
        for r in injected:
            if not (start <= r.sample_date <= end) or r.patient_id in w.patient_code or r.ward not in w.uidx or r.sample_date not in w.day_of:
                return None
            if any(key not in w.sidx for key in w.keys_of(r)):
                return None
        removed = [j for j in range(wlo, whi) if j not in present]
        cum = w.cum.copy()
        D = w.n_days

        def add(series: int, day: int, sign: int) -> None:
            cum.E[series, day + 1 :] += sign
            cum.HE[w.group_of[series], day + 1 :] += sign

        def add_row(unit: str, day: int, sign: int) -> None:
            cum.V[w.uidx[unit], day + 1 :] += sign
            cum.N[day + 1 :] += sign

        for r in injected:
            d = w.day_of[r.sample_date]
            add_row(r.ward, d, +1)
            for key in w.keys_of(r):
                add(w.sidx[key], d, +1)  # a new patient: every membership is an event
        gone = set()
        for j in removed:
            r = w.records[j]
            add_row(r.ward, int(w.day_of[r.sample_date]), -1)
            for m in range(w.rec_start[j], w.rec_start[j + 1]):
                gone.add(int(m))
                if w.mem_event[m]:
                    add(int(w.mem_series[m]), int(w.mem_day[m]), -1)
        seen = set()
        for m in sorted(gone):
            kk = int(w.mem_patient[m]) * w.n_series + int(w.mem_series[m])
            if kk in seen:
                continue
            seen.add(kk)
            a, b = np.searchsorted(w.keys_sorted, kk, "left"), np.searchsorted(w.keys_sorted, kk, "right")
            prev = None
            for mm in w.order_sorted[a:b]:
                mm = int(mm)
                if mm in gone or w.mem_day[mm] > end_day:
                    continue
                d = int(w.mem_day[mm])
                new = prev is None or d - prev > DEDUP_DAYS
                prev = d
                if new != bool(w.mem_event[mm]):
                    add(int(w.mem_series[mm]), d, +1 if new else -1)
        d_start, d_end = w.day_of[start], end_day
        first = first_valid_day(S, g, L)
        d_lo = max(int(w.week_start[d_start]), first)
        if d_lo > d_end:
            return []
        tests = run_tests(w, cum, np.arange(d_lo, d_end + 1), S, g, L)
        self.fast += 1
        return make_signals(w, tests, S, L, units=set(focus.units), from_day=d_start)


# ---------- the detector ----------


@dataclass(eq=False)
class GammaPoisson(Detector):
    """The Gamma-Poisson test of one setting (S, g, L in weeks) as a harness detector. `engine` (the real data encoded) makes
    trials fast; without it every run is from scratch. `budget` applies the weekly alert budget."""

    name: str = "Gamma-Poisson surprise"
    levels: tuple[float, ...] = LEVELS
    S: int = 26
    g: int = 4
    L: int = 4
    budget: bool = False
    organism_series: bool = True
    engine: Engine | None = field(default=None, repr=False)

    def run(self, records: Sequence[IsolateRecord], cultures: Sequence[Culture], focus: Focus | None = None) -> list[Signal]:
        if self.engine is not None:
            if focus is not None and focus.start is not None and focus.end is not None:
                out = self.engine.focused(records, focus, self.S, self.g, self.L)
                if out is not None:
                    return out
                self.engine.fallback += 1
            return self.engine.full(records, self.S, self.g, self.L)
        return reference_signals(records, self.S, self.g, self.L, self.organism_series)

    def passes(self, signal: Signal, level: float) -> bool:
        if signal.p is None or not signal.p < level:
            return False
        return not self.budget or signal.profile[LEVEL_INDEX[level]] == "1"

    def kind_of(self, signal: Signal) -> str:
        return "cluster"
