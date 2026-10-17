"""Bayesian online change-point detection (Adams and MacKay 2007) on weekly counts and weekly %R, as a detector for
`aei.score_detection`. Plan and mathematics: README.md ("Experiment", "Mathematical foundation").

Series (per unit, ISO weeks from the Monday on or before the first sample date):
  counts  unit x phenotype (4) and unit x organism (9): 117 series, the weekly number of patients whose isolate is the
          first of the series in the unit within the trailing 365 days (sample date);
  rates   unit x surveillance pair (22): 198 series, the weekly n (first isolates with an S or R result) and r (those R).
Filter: a posterior over the run length (complete weeks since the last change) per series, constant hazard H, Gamma-Poisson
(counts, new-segment prior Gamma(1, rate 1/m)) and Beta-binomial (rates, Beta(2 pi0, 2 (1 - pi0))) predictives, in log space,
vectorised over series and run lengths. A day inside a week is one provisional step from the last complete week's state
with the partial week (exposure d / 7 for counts, the (n, r) so far for rates); the carried state advances on complete
weeks only. Signal for day t and width w: p = P(run length >= w | data to t) = 1 - m_t, emitted when p < 0.9, the posterior
mean over runs shorter than w exceeds that over the longer ones, and the last w weeks hold at least 2 events (2 R results).

The prior is read from the first 26 weeks of the data the detector receives (never revised); the first 26 weeks raise no
signal. Reproducing the harness's trials cheaply: with a `Focus`, the filter states of the complete weeks before the trial's
first week come from a cache of the run on the whole dataset (the trials change nothing before their start; checked by a
fingerprint of the rows), and only the weeks from the start are filtered, from the rows the trial passes; the unfocused run
on the passed rows gives the same signals (`experiments/0018-bocpd/run.py` checks a few trials).
"""

from __future__ import annotations

import hashlib
import math
from bisect import bisect_left, bisect_right
from collections import OrderedDict
from datetime import date

import numpy as np
from scipy.special import gammaln

from aei import harness
from aei import score_detection as sd
from aei.detect import SURVEILLANCE_PAIRS, Signal
from aei.domain import PHENOTYPES, UNITS

ORGANISMS = (
    "Citrobacter freundii",
    "Enterococcus faecalis",
    "Escherichia coli",
    "Klebsiella oxytoca",
    "Klebsiella pneumoniae",
    "Proteus mirabilis",
    "Pseudomonas aeruginosa",
    "Staphylococcus aureus",
    "Staphylococcus saprophyticus",
)
PAIRS = SURVEILLANCE_PAIRS
COUNT_SERIES = [(u, "ph", p) for u in UNITS for p in PHENOTYPES] + [(u, "org", o) for u in UNITS for o in ORGANISMS]
RATE_SERIES = [(u, i) for u in UNITS for i in range(len(PAIRS))]
C_INDEX = {s: i for i, s in enumerate(COUNT_SERIES)}
R_INDEX = {s: i for i, s in enumerate(RATE_SERIES)}

WARMUP_WEEKS = 26
WARMUP_DAYS = 7 * WARMUP_WEEKS
TRAIL = 365  # days: an isolate is "first" when the patient has none of the series in the unit in the previous 365 days
PRIOR_STRENGTH_RATE = 2.0
COUNT_SHAPE = 1.0
RATE_FLOOR = 0.02  # weekly events, floor of the counts prior mean
P_MAX = 0.9  # signals with p < 0.9 are emitted, so the plan's levels (p < 0.5 and below) and the extended ones are read from one run
LEVELS = (0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005)  # the plan's, loosest first
LEVELS_EXT = (0.9, 0.8, 0.7, 0.6, *LEVELS)  # exploratory: four looser levels in front of the plan's
MIN_EVENTS = 2
COUNT, RATE = "bocpd-count", "bocpd-rate"

_ORD: dict[str, int] = {}


def ordinal(day: str) -> int:
    o = _ORD.get(day)
    if o is None:
        o = _ORD[day] = date.fromisoformat(day).toordinal()
    return o


def iso(ord_: int) -> str:
    return date.fromordinal(ord_).isoformat()


def _sd(r) -> str:
    return r.sample_date


# ---------- events of a row ----------

_SIG: dict[tuple, tuple] = {}


def signature(r) -> tuple[tuple, tuple]:
    """The series a row belongs to: count labels (("ph", p) ..., ("org", organism)) and the indices of the surveillance
    pairs it has a result for."""
    k = (r.organism, r.specimen, r.phenotypes, frozenset(r.results))
    s = _SIG.get(k)
    if s is None:
        labels = tuple(("ph", p) for p in r.phenotypes if p in PHENOTYPES) + (("org", r.organism),)
        pairs = tuple(
            i
            for i, pr in enumerate(PAIRS)
            if pr.organism == r.organism and (pr.specimen is None or pr.specimen == r.specimen) and pr.antibiotic in r.results
        )
        s = _SIG[k] = (labels, pairs)
    return s


def extract_events(rows, anchor: int, c_map: dict, r_map: dict, last: dict) -> tuple[list, list]:
    """Events of date-ordered rows: ([(day, count series)], [(day, rate series, 1 if R)]) with days from `anchor` (an
    ordinal). A row is an event of a series when its patient has no isolate of the series in the unit in the previous
    365 days (`last` holds the last isolate day per unit, series and patient, and is updated for every row)."""
    c_ev: list = []
    r_ev: list = []
    for r in rows:
        unit, pat = r.ward, r.patient_id
        labels, pairs = signature(r)
        day = ordinal(r.sample_date) - anchor
        for lab in labels:
            ci = c_map.get((unit, *lab))
            if ci is None:
                continue
            key = (unit, lab, pat)
            prev = last.get(key)
            if prev is None or day - prev > TRAIL:
                c_ev.append((day, ci))
            last[key] = day
        for pi in pairs:
            ri = r_map.get((unit, pi))
            if ri is None:
                continue
            key = (unit, pi, pat)
            prev = last.get(key)
            if prev is None or day - prev > TRAIL:
                r_ev.append((day, ri, 1 if r.results[PAIRS[pi].antibiotic] == "R" else 0))
            last[key] = day
    return c_ev, r_ev


def daily_arrays(c_ev, r_ev, n_c: int, n_r: int, offset: int, n_days: int):
    """Daily counts (n_c, n_days), n and r (n_r, n_days) from events, days from `offset` (events before it are dropped)."""
    dy = np.zeros((n_c, n_days), dtype=np.int64)
    dn = np.zeros((n_r, n_days), dtype=np.int64)
    dr = np.zeros((n_r, n_days), dtype=np.int64)
    if c_ev:
        d, i = np.array([(d - offset, i) for d, i in c_ev]).T
        keep = (d >= 0) & (d < n_days)
        np.add.at(dy, (i[keep], d[keep]), 1)
    if r_ev:
        d, i, x = np.array([(d - offset, i, x) for d, i, x in r_ev]).T
        keep = (d >= 0) & (d < n_days)
        np.add.at(dn, (i[keep], d[keep]), 1)
        np.add.at(dr, (i[keep], d[keep]), x[keep])
    return dy, dn, dr


# ---------- the prior, from the first 26 weeks ----------


def priors_from(c_ev, r_ev, rows_first26, scale: float = 1.0) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, dict]:
    """New-segment priors from the events and rows of the first 26 weeks: counts Gamma(1, rate 1/m), m = hospital events of the
    series per isolate x the unit's isolates a week (floor 0.02); rates Beta(2 pi0, 2 (1 - pi0)), pi0 the pair's hospital R share,
    Jeffreys-smoothed. `scale` multiplies the counts prior's mean (1 is the plan's; other values only for the exploratory ablation).
    Returns a0, b0 (counts), A0, B0 (rates) and the numbers behind them."""
    events_by_label: dict = {}
    for day, ci in c_ev:
        if day < WARMUP_DAYS:
            lab = COUNT_SERIES[ci][1:]
            events_by_label[lab] = events_by_label.get(lab, 0) + 1
    n_hosp = len(rows_first26)
    n_unit: dict = {}
    for r in rows_first26:
        n_unit[r.ward] = n_unit.get(r.ward, 0) + 1
    m = np.empty(len(COUNT_SERIES))
    for i, (u, kind, lab) in enumerate(COUNT_SERIES):
        m[i] = max(RATE_FLOOR, events_by_label.get((kind, lab), 0) / max(n_hosp, 1) * n_unit.get(u, 0) / WARMUP_WEEKS)
    n_pair = np.zeros(len(PAIRS))
    r_pair = np.zeros(len(PAIRS))
    for day, ri, x in r_ev:
        if day < WARMUP_DAYS:
            pi = RATE_SERIES[ri][1]
            n_pair[pi] += 1
            r_pair[pi] += x
    pi0 = (r_pair + 0.5) / (n_pair + 1.0)
    pi0_series = np.array([pi0[RATE_SERIES[i][1]] for i in range(len(RATE_SERIES))])
    a0 = np.full(len(COUNT_SERIES), COUNT_SHAPE)
    b0 = 1.0 / (m * scale)
    A0 = PRIOR_STRENGTH_RATE * pi0_series
    B0 = PRIOR_STRENGTH_RATE * (1.0 - pi0_series)
    return a0, b0, A0, B0, {"isolates": n_hosp, "pairs_n": n_pair.tolist(), "pairs_r": r_pair.tolist()}


# ---------- the filter ----------


def run_chain(
    rate: bool,
    H: float,
    prior: tuple,
    cum: tuple,
    daily: tuple,
    T0: int,
    logp0: np.ndarray,
    sig_lo: int,
    last_abs: int,
    ws: tuple[int, ...],
    prune: float | None = None,
    keep_states: bool = False,
    p_max: float = P_MAX,
):
    """The filter over the weeks T0 to the last day, for one model (counts or rates) over n series. `cum` are the cumulative
    weekly arrays over absolute weeks 0..T0+L (counts: (C,); rates: (Cn, Cr)), `daily` the daily arrays from the Monday of
    week T0 (as many days as 7 L), `logp0` the log run-length posterior after T0 complete weeks, shape (n, T0 + 1).
    Signals are emitted for the days sig_lo to last_abs (absolute days from the anchor). Returns (hits, states): hits are
    (day, series, w, p, observed, expected) tuples, states the log posterior after T complete weeks from T0 on (when
    `keep_states`)."""
    n = logp0.shape[0]
    L = daily[0].shape[1] // 7
    d3 = [d.reshape(n, L, 7) for d in daily]
    wk = [d.sum(2) for d in d3]
    cp = [np.cumsum(d, axis=2) for d in d3]
    logH, log1m = math.log(H), math.log1p(-H)
    cut = math.log(prune) if prune else None
    logp = logp0
    states = [logp0] if keep_states else None
    hits: list = []
    a0, b0 = prior
    for l in range(L):
        T = T0 + l
        first_day = 7 * T
        if first_day > last_abs:
            break
        r = np.arange(T + 1)
        if rate:
            Cn, Cr = cum
            N = Cn[:, T : T + 1] - Cn[:, T::-1]
            R = Cr[:, T : T + 1] - Cr[:, T::-1]
            A = a0[:, None] + R
            B = b0[:, None] + N - R
            AB = A + B
            K = gammaln(AB) - gammaln(A) - gammaln(B)
            prior_mean = a0 / (a0 + b0)
        else:
            (C,) = cum
            S = C[:, T : T + 1] - C[:, T::-1]
            a = a0[:, None] + S
            b = b0[:, None] + r
            lb = np.log(b)
            ga = gammaln(a)
            prior_mean = a0 / b0
        win = {w: tuple(Cx[:, T] - Cx[:, max(T - (w - 1), 0)] for Cx in cum) for w in ws}

        def logpi(i: int, e: float) -> np.ndarray:
            if rate:
                npc = cp[0][:, l, i][:, None]
                rpc = cp[1][:, l, i][:, None]
                return (
                    gammaln(npc + 1) - gammaln(rpc + 1) - gammaln(npc - rpc + 1) + gammaln(rpc + A) + gammaln(npc - rpc + B) - gammaln(npc + AB) + K
                )
            yc = cp[0][:, l, i][:, None]
            lbe = np.log(b + e)
            return gammaln(yc + a) - ga - gammaln(yc + 1) + a * (lb - lbe) + yc * (math.log(e) - lbe)

        lp6 = None
        for i in range(7):
            day = first_day + i
            if day > last_abs:
                break
            if day < sig_lo and i < 6:
                continue
            e = (i + 1) / 7
            lpi = logpi(i, e)
            if i == 6:
                lp6 = lpi
            if day < sig_lo:
                continue
            lw = logp + lpi
            mx = lw.max(1, keepdims=True)
            q = np.exp(lw - mx)
            q /= q.sum(1, keepdims=True)
            if rate:
                npv, rpv = cp[0][:, l, i], cp[1][:, l, i]
                mean = (A + rpv[:, None]) / (AB + npv[:, None])
            else:
                yv = cp[0][:, l, i]
                mean = (a + yv[:, None]) / (b + e)
            for w in ws:
                k = w - 1
                q_short = q[:, :k].sum(1)
                p = (1 - H) * q[:, k:].sum(1)
                short_num = H * prior_mean + (1 - H) * (q[:, :k] * mean[:, :k]).sum(1)
                long_num = (1 - H) * (q[:, k:] * mean[:, k:]).sum(1)
                direction = short_num * p > long_num * (H + (1 - H) * q_short)
                if rate:
                    ev = win[w][1] + rpv
                else:
                    ev = win[w][0] + yv
                ok = (p < p_max) & direction & (ev >= MIN_EVENTS)
                for s in np.nonzero(ok)[0]:
                    long_mean = long_num[s] / p[s]
                    if rate:
                        nw = win[w][0][s] + npv[s]
                        obs = float(ev[s]) / float(nw) if nw > 0 else 0.0
                        exp_ = float(long_mean)
                    else:
                        obs = float(ev[s])
                        exp_ = float(long_mean) * ((w - 1) + e)
                    hits.append((day, int(s), w, float(p[s]), obs, exp_))
        if 7 * T + 6 > last_abs:
            break
        lpi = lp6 if lp6 is not None else logpi(6, 1.0)
        lw = logp + lpi
        mx = lw.max(1, keepdims=True)
        lse = mx + np.log(np.exp(lw - mx).sum(1, keepdims=True))
        new = np.empty((n, T + 2))
        new[:, 0] = logH
        new[:, 1:] = lw - lse + log1m
        if cut is not None:
            new[new < cut] = -np.inf
            mx = new.max(1, keepdims=True)
            new -= mx + np.log(np.exp(new - mx).sum(1, keepdims=True))
        logp = new
        if keep_states:
            states.append(logp)
    return hits, states


# ---------- the observations of a whole run and of the base data ----------


class Obs:
    """Weekly and daily observations of all series from rows, the priors, and the last day."""

    def __init__(self, records, cultures, scale: float = 1.0):
        first = records[0].sample_date
        o = ordinal(first)
        self.anchor = o - date.fromordinal(o).weekday()
        last_date = max(records[-1].sample_date, cultures[-1].sample_date if cultures else records[-1].sample_date)
        self.last_abs = ordinal(last_date) - self.anchor
        self.n_weeks = self.last_abs // 7 + 1
        n_days = 7 * self.n_weeks
        c_map = {s: i for i, s in enumerate(COUNT_SERIES)}
        r_map = {s: i for i, s in enumerate(RATE_SERIES)}
        c_ev, r_ev = extract_events(records, self.anchor, c_map, r_map, {})
        self.dy, self.dn, self.dr = daily_arrays(c_ev, r_ev, len(COUNT_SERIES), len(RATE_SERIES), 0, n_days)
        first26 = records[: bisect_left(records, iso(self.anchor + WARMUP_DAYS), key=_sd)]
        self.prior = priors_from(c_ev, r_ev, first26, scale)
        self.Cy = _cum(self.dy)
        self.Cn = _cum(self.dn)
        self.Cr = _cum(self.dr)


def _cum(daily: np.ndarray) -> np.ndarray:
    n = daily.shape[0]
    weekly = daily.reshape(n, -1, 7).sum(2)
    out = np.zeros((n, weekly.shape[1] + 1))
    out[:, 1:] = np.cumsum(weekly, axis=1)
    return out


class FullRun:
    """The filter over every series from week 0, signals by width and (for the base) the states after every week."""

    def __init__(self, records, cultures, H: float, ws=(2, 4), prune=None, keep_states=False, scale: float = 1.0):
        self.obs = obs = Obs(records, cultures, scale)
        a0, b0, A0, B0, _ = obs.prior
        n_c, n_r = len(COUNT_SERIES), len(RATE_SERIES)
        z = lambda n: np.zeros((n, 1))  # noqa: E731
        hc, self.states_c = run_chain(False, H, (a0, b0), (obs.Cy,), (obs.dy,), 0, z(n_c), WARMUP_DAYS, obs.last_abs, ws, prune, keep_states)
        hr, self.states_r = run_chain(True, H, (A0, B0), (obs.Cn, obs.Cr), (obs.dn, obs.dr), 0, z(n_r), WARMUP_DAYS, obs.last_abs, ws, prune, keep_states)
        self.signals = {w: sorted(self._signals(hc, hr, w, obs.anchor, None, None), key=lambda s: (s.date, s.key)) for w in ws}

    @staticmethod
    def _signals(hc, hr, w, anchor, c_sel, r_sel):
        out = []
        for day, s, ww, p, obs_, exp_ in hc:
            if ww == w:
                out.append(count_signal((COUNT_SERIES if c_sel is None else c_sel)[s], iso(anchor + day), p, obs_, exp_))
        for day, s, ww, p, obs_, exp_ in hr:
            if ww == w:
                out.append(rate_signal((RATE_SERIES if r_sel is None else r_sel)[s], iso(anchor + day), p, obs_, exp_))
        return out


def count_signal(series, day: str, p: float, observed: float, expected: float) -> Signal:
    unit, kind, label = series
    return Signal(
        COUNT,
        f"{unit}|{label}",
        day,
        unit,
        observed,
        organism=label if kind == "org" else None,
        phenotype=label if kind == "ph" else None,
        expected=expected,
        p=p,
    )


def rate_signal(series, day: str, p: float, observed: float, expected: float) -> Signal:
    unit, pi = series
    pair = PAIRS[pi]
    return Signal(RATE, f"{unit}|{pair.key}", day, unit, observed, organism=pair.organism, antibiotic=pair.antibiotic, expected=expected, p=p)


# ---------- caches, shared by every row of the experiment ----------

_FULL: OrderedDict = OrderedDict()
_TRIAL: dict = {}
STATS = {"focused": 0, "fallback": 0, "full": 0, "cache_hits": 0}
_COMMON: dict = {}


def _data_key(records, cultures) -> tuple:
    return (len(records), records[0].isolate_id, records[-1].isolate_id, len(cultures), cultures[-1].culture_id if cultures else "")


def full_run(records, cultures, H: float, prune=None, scale: float = 1.0) -> FullRun:
    """Signals (all series) on the given rows, cached per rows and H. The run on the harness's own data keeps its states."""
    base_records, base_cultures = harness.data()
    is_base = records is base_records
    key = (H, prune, scale, _data_key(records, cultures))
    hit = _FULL.get(key)
    if hit is not None:
        _FULL.move_to_end(key)
        STATS["cache_hits"] += 1
        return hit
    STATS["full"] += 1
    run = FullRun(records, cultures, H, prune=prune, keep_states=is_base and prune is None, scale=scale)
    _FULL[key] = run
    while len(_FULL) > 10:
        # keep the base runs, drop the oldest other one
        for k, v in list(_FULL.items()):
            if v.states_c is None:
                del _FULL[k]
                break
        else:
            _FULL.popitem(last=False)
    return run


class Common:
    """The harness's data prepared once for focused trials: rows by patient, first-26-week priors, weekly observations."""

    def __init__(self, scale: float = 1.0):
        records, cultures = harness.data()
        self.records = records
        self.rdates = [r.sample_date for r in records]
        self.by_patient: dict = {}
        for r in records:
            self.by_patient.setdefault(r.patient_id, []).append(r)
        self.obs = Obs(records, cultures, scale)


def common(scale: float = 1.0) -> Common:
    if scale not in _COMMON:
        _COMMON[scale] = Common(scale)
    return _COMMON[scale]


def _select(focus):
    units = tuple(focus.units)
    phs = [p for p in PHENOTYPES if focus.phenotypes is None or p in focus.phenotypes]
    orgs = [focus.organism] if focus.organism else list(ORGANISMS)
    c_sel = [(u, "ph", p) for u in units for p in phs] + [(u, "org", o) for u in units for o in orgs]
    pairs = [i for i, pr in enumerate(PAIRS) if focus.organism is None or pr.organism == focus.organism]
    r_sel = [(u, i) for u in units for i in pairs]
    return c_sel, r_sel


def focused_run(records, cultures, focus, H: float, ws=(2, 4), scale: float = 1.0):
    """The trial path: signals for the focus units' series from the week of focus.start, or None when the rows before that week
    are not the harness's own (then the caller runs everything)."""
    com = common(scale)
    obs = com.obs
    anchor = obs.anchor
    T0 = (ordinal(focus.start) - anchor) // 7
    lo = iso(anchor + 7 * T0)
    n_pre = bisect_left(records, lo, key=_sd)
    if n_pre != bisect_left(com.rdates, lo) or (focus.data_start is not None and focus.data_start != com.rdates[0]):
        return None
    if n_pre and any(records[i].isolate_id != com.records[i].isolate_id for i in (0, n_pre // 2, n_pre - 1)):
        return None
    units = set(focus.units)
    end_pos = bisect_right(records, focus.end, key=_sd) if focus.end else len(records)
    rows = [r for r in records[n_pre:end_pos] if r.ward in units]
    fp = hashlib.blake2b("|".join(r.isolate_id for r in rows).encode(), digest_size=8).hexdigest()
    last_date = max(records[-1].sample_date, cultures[-1].sample_date if cultures else records[-1].sample_date)
    last_abs = ordinal(last_date) - anchor
    if focus.end:
        last_abs = min(last_abs, ordinal(focus.end) - anchor)
    key = (H, scale, focus.units, focus.organism, focus.phenotypes, focus.start, focus.end, last_abs, fp)
    hit = _TRIAL.get(key)
    if hit is not None:
        STATS["cache_hits"] += 1
        return hit
    STATS["focused"] += 1
    c_sel, r_sel = _select(focus)
    c_map = {s: i for i, s in enumerate(c_sel)}
    r_map = {s: i for i, s in enumerate(r_sel)}
    last: dict = {}
    hist = [q for pat in {r.patient_id for r in rows} for q in com.by_patient.get(pat, ()) if q.sample_date < lo and q.ward in units]
    extract_events(hist, anchor, c_map, r_map, last)
    c_ev, r_ev = extract_events(rows, anchor, c_map, r_map, last)
    n_weeks = (last_abs - 7 * T0) // 7 + 1
    dy, dn, dr = daily_arrays(c_ev, r_ev, len(c_sel), len(r_sel), 7 * T0, 7 * n_weeks)
    base = full_run(*harness.data(), H, scale=scale)
    gc = [C_INDEX[s] for s in c_sel]
    gr = [R_INDEX[s] for s in r_sel]
    a0, b0, A0, B0, _ = obs.prior

    def cum(base_C, daily):
        n = daily.shape[0]
        weekly = daily.reshape(n, -1, 7).sum(2)
        return np.concatenate([base_C[:, : T0 + 1], base_C[:, T0 : T0 + 1] + np.cumsum(weekly, axis=1)], axis=1)

    gci, gri = np.array(gc), np.array(gr)
    hc, _ = run_chain(
        False, H, (a0[gci], b0[gci]), (cum(obs.Cy[gci], dy),), (dy,), T0, base.states_c[T0][gci], WARMUP_DAYS, last_abs, ws
    )
    hr, _ = run_chain(
        True, H, (A0[gri], B0[gri]), (cum(obs.Cn[gri], dn), cum(obs.Cr[gri], dr)), (dn, dr), T0, base.states_r[T0][gri], WARMUP_DAYS, last_abs, ws
    )
    # the harness reads signals from the trial's start on; days before it (the rest of its first week) are dropped
    start_abs = ordinal(focus.start) - anchor
    hc = [h for h in hc if h[0] >= start_abs]
    hr = [h for h in hr if h[0] >= start_abs]
    out = {w: sorted(FullRun._signals(hc, hr, w, anchor, c_sel, r_sel), key=lambda s: (s.date, s.key)) for w in ws}
    _TRIAL[key] = out
    return out


def signals_for(records, cultures, focus, H: float, scale: float = 1.0) -> dict:
    """{w: signals}: the focused trial path when a focus with a start is given and the rows allow it, else the full run."""
    if focus is not None and focus.start is not None and focus.end is not None:
        out = focused_run(records, cultures, focus, H, scale=scale)
        if out is not None:
            return out
        STATS["fallback"] += 1
    return full_run(records, cultures, H, scale=scale).signals


# ---------- the harness detector ----------


def make_detector(
    H: float,
    w: int,
    part: str = "both",
    *,
    levels: tuple[float, ...] = LEVELS,
    default_level: float | None = None,
    rate_kind: str = "divergence",
    name: str | None = None,
    scale: float = 1.0,
) -> sd.Detector:
    """A `score_detection.Detector` over the shared filter runs: `part` "count", "rate" or "both"; `rate_kind` the kind the %R
    signals are named ("divergence", the plan's; "cluster" for D7's other reading)."""
    names = {"count": (COUNT,), "rate": (RATE,), "both": (COUNT, RATE)}[part]

    def run_fn(records, cultures, focus):
        return [s for s in signals_for(records, cultures, focus, H, scale)[w] if s.detector in names]

    def kind_fn(s: Signal) -> str:
        return "cluster" if s.detector == COUNT else rate_kind

    return sd.Detector(
        name=name or f"BOCPD {part}, H = 1/{round(1 / H)}, w = {w}" + (f", prior mean x{scale:g}" if scale != 1.0 else ""),
        run_fn=run_fn,
        levels=levels,
        default_level=default_level,
        kind_fn=kind_fn,
    )


# ---------- what the card of the proposed visualisation reads ----------


def trace(H: float, w: int, series: tuple, weeks: range) -> dict:
    """One count series on the harness's data, for the figure: for each complete week T in `weeks` (the state after T weeks, from
    the cached run) the week's count, m_t = P(run length < w), and the posterior of the rate of the segment holding the latest
    week (the runs of 1 week or more, renormalised, a mixture of Gamma(a0 + S_r, b0 + r)): mean and 80 % band."""
    from scipy.stats import gamma

    base = full_run(*harness.data(), H)
    obs = base.obs
    i = C_INDEX[series]
    a0, b0 = obs.prior[0][i], obs.prior[1][i]
    C = obs.Cy[i]
    out = {"week": [], "count": [], "m": [], "mean": [], "lo": [], "hi": []}
    for T in weeks:
        p = np.exp(base.states_c[T][i])
        r = np.arange(T + 1)
        S = C[T] - C[T - r]
        shape, rate = a0 + S, b0 + r
        wts = p[1:] / p[1:].sum()
        keep = wts > 1e-6
        grid = np.linspace(0, float(np.max(shape[1:][keep] / rate[1:][keep])) * 3 + 1, 2000)
        cdf = sum(wk * gamma.cdf(grid, a, scale=1 / b) for wk, a, b in zip(wts[keep], shape[1:][keep], rate[1:][keep]))
        out["week"].append(T)
        out["count"].append(float(C[T] - C[T - 1]) if T >= 1 else 0.0)
        out["m"].append(float(p[:w].sum()))
        out["mean"].append(float((wts * shape[1:] / rate[1:]).sum()))
        out["lo"].append(float(np.interp(0.1, cdf, grid)))
        out["hi"].append(float(np.interp(0.9, cdf, grid)))
    return out


def change_posterior(H: float, w: int, series: tuple, T: int, horizon: int = 26) -> dict:
    """The run-length posterior after T complete weeks for one count series: the modal change week (week index T - r with r
    the most probable run length of 1 to `horizon` weeks), its 80 % interval, m_t, and the posterior means of the weekly rate over
    runs shorter than w and over the others (as the signal's direction gate reads them, on the carried state), and the card's
    "now" and "before": the posterior mean rate since the modal change and the one over all weeks before it."""
    base = full_run(*harness.data(), H)
    obs = base.obs
    i = C_INDEX[series]
    a0, b0 = obs.prior[0][i], obs.prior[1][i]
    C = obs.Cy[i]
    p = np.exp(base.states_c[T][i])
    r = np.arange(T + 1)
    mean = (a0 + C[T] - C[T - r]) / (b0 + r)
    mean[0] = a0 / b0
    short = float((p[:w] * mean[:w]).sum() / p[:w].sum())
    long = float((p[w:] * mean[w:]).sum() / p[w:].sum())
    h = min(horizon, T)
    cond = p[1 : h + 1] / p[1 : h + 1].sum()
    mode_r = int(np.argmax(cond)) + 1
    by_week = np.cumsum(cond[::-1])  # weeks from the oldest candidate change to the newest
    weeks = np.arange(T - h, T)  # week indices, oldest first
    lo_week = int(weeks[np.searchsorted(by_week, 0.1)])
    hi_week = int(weeks[min(np.searchsorted(by_week, 0.9), h - 1)])
    now = float((a0 + C[T] - C[T - mode_r]) / (b0 + mode_r))  # the segment since the modal change
    before = float((a0 + C[T - mode_r]) / (b0 + (T - mode_r)))  # everything before it, one segment
    return {
        "now_mean": now,
        "before_mean": before,
        "mode_week": T - mode_r,
        "lo_week": lo_week,
        "hi_week": hi_week,
        "m": float(p[:w].sum()),
        "short_mean": short,
        "long_mean": long,
        "mode_prob": float(cond[mode_r - 1]),
        "prob_change_within_horizon": float(p[1 : h + 1].sum()),
    }
