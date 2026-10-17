"""Experiment 0016: Poisson and Bernoulli CUSUM detectors for `aei.score_detection`, calibrated to an in-control run length.
Formulas and their derivation: README.md, "Mathematical foundation". Statement of what is computed: README.md, "Experiment".

Series: Poisson per unit x phenotype (esbl, mrsa, vre, cpe) and unit x organism x specimen, Bernoulli per unit x
SURVEILLANCE_PAIR (R or not). An event or observation is a patient's first isolate of the series in the unit within the
trailing 365 days (the previous isolate of the patient in the series more than 365 days back; one per patient and day).

    S_t = max(0, S_(t-u) + y_t ln(theta) - (theta - 1) lam_t)                           Poisson, u = 1 or 7 days
    S_t = max(0, S_(t-1) + r_t ln(theta) - n_t ln(1 + (theta - 1) p_t))                 Bernoulli, daily batches
    lam_t = max((C + k R_b) / (S_b (1 + k)), floor) per week, p_t = clip((R + M p_hosp) / (n + M)), from the S_b <= 26
    weeks that end 7g + u days before t (at least 13 weeks needed), R_b the hospital's share times the unit's volume.

No reset after an alarm. The harness `p` of a signal is 1 / A(S_t), A Siegmund's in-control run length in days for this
series and today's baseline ("equalised"), or exp(-S_t) ("common"). The statistic is a cumulative sum and a running
minimum (Lindley), computed for all series at once.

A `World` holds the cumulative daily counts of a set of rows (unit-series events, unit isolates, hospital sums). The
detector reads only columns up to the date of the last row it is given. For trials of `aei.inject` it takes the real
data's `World` and applies the change (injected rows added, removed rows taken out, the hospital sums too), which is
exact for injected rows and, for removed rows, does not re-flag a patient's later isolate as a first one; with
`rebuild=True` it builds the `World` from the rows it is given, which is what `check_causal` is run on.
"""

from __future__ import annotations

import math
from bisect import bisect_left, bisect_right
from collections import defaultdict
from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from aei import harness
from aei.dataset import IsolateRecord
from aei.dates import add_days, days_between
from aei.detect import SURVEILLANCE_PAIRS, Signal
from aei.domain import PHENOTYPES, SPECIMENS, UNITS
from aei.inject import Focus
from aei.score_detection import Detector

K = 0.1  # prior weight in weeks of the hospital's rate (QUESTIONS C3)
M = 30.0  # prior weight in isolates for a proportion (QUESTIONS B1)
SB_WEEKS = 26
MIN_WEEKS = 13
DEDUP_DAYS = 365
LAM_FLOOR_WEEK = 1e-3  # events a week; keeps the baseline off zero where the hospital has none either
NU_FLOOR_WEEK = 1e-3
P_LO, P_HI = 1e-3, 0.999
OVERSHOOT = 1.166  # Siegmund's 2 x 0.583
A_LOOSE_DAYS = 365.25  # signals are emitted when the run length is above one year (the loosest level)
H_MIN_COMMON = 3.0  # common-limit mapping: the loosest limit
EXP_CAP = 700.0
PATHS = {"fast": 0, "rebuild": 0, "slow": 0}  # runs by the way the world was obtained (reported in results.md)
P_FLOOR = 1e-300
LEVELS_YEARS = (1.0, 3.0, 10.0, 30.0, 100.0, 300.0, 1000.0, 3000.0, 10000.0)
H_GRID = (3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 12.0)
NAME_P, NAME_B = "cusum-poisson", "cusum-bernoulli"


def level_of_years(years: float) -> float:
    """The harness level (a p) of a per-series in-control run length of `years` years."""
    return 1.0 / (365.25 * years)


# ---------- the calendar and the universe of series ----------


@lru_cache(maxsize=1)
def calendar() -> tuple[str, list[str], dict[str, int]]:
    records, _ = harness.data()
    day0 = min(r.sample_date for r in records)
    last = max(r.sample_date for r in records)
    dates = [add_days(day0, i) for i in range(days_between(day0, last) + 1)]
    return day0, dates, {d: i for i, d in enumerate(dates)}


@dataclass(frozen=True)
class Universe:
    organisms: tuple[str, ...]
    pser: tuple[tuple, ...]  # ("ph", name) or ("os", organism, specimen)
    ph_index: dict
    os_index: dict
    pairs: tuple
    pairs_by_org: dict  # organism -> [(q, pair)]
    unit_index: dict


@lru_cache(maxsize=1)
def universe() -> Universe:
    records, _ = harness.data()
    day0, _, _ = calendar()
    assert date_weekday(day0) == 0, "periods are ISO weeks and the data must start on a Monday"
    orgs = tuple(sorted({r.organism for r in records}))
    pser = tuple([("ph", ph) for ph in PHENOTYPES] + [("os", o, sp) for o in orgs for sp in SPECIMENS])
    ph_index = {ph: i for i, ph in enumerate(PHENOTYPES)}
    os_index = {(o, sp): len(PHENOTYPES) + i for i, (o, sp) in enumerate((o, sp) for o in orgs for sp in SPECIMENS)}
    pairs = tuple(SURVEILLANCE_PAIRS)
    by_org: dict = defaultdict(list)
    for q, pair in enumerate(pairs):
        by_org[pair.organism].append((q, pair))
    return Universe(orgs, pser, ph_index, os_index, pairs, dict(by_org), {u: i for i, u in enumerate(UNITS)})


def date_weekday(day: str) -> int:
    import datetime

    return datetime.date.fromisoformat(day).weekday()


def memberships_p(r: IsolateRecord, uni: Universe) -> list[int]:
    """Poisson series (indices) the isolate belongs to in its unit: its phenotypes and its organism x specimen."""
    out = [uni.ph_index[ph] for ph in r.phenotypes if ph in uni.ph_index]
    p = uni.os_index.get((r.organism, r.specimen))
    if p is not None:
        out.append(p)
    return out


def memberships_q(r: IsolateRecord, uni: Universe) -> list[int]:
    """Bernoulli series (pair indices) the isolate belongs to: its organism's pairs it was tested for."""
    return [q for q, pair in uni.pairs_by_org.get(r.organism, ()) if (not pair.specimen or r.specimen == pair.specimen) and pair.antibiotic in r.results]


# ---------- the world: cumulative daily counts ----------


def _cum(a: np.ndarray) -> np.ndarray:
    out = np.zeros(a.shape[:-1] + (a.shape[-1] + 1,))
    np.cumsum(a, axis=-1, out=out[..., 1:])
    return out


class World:
    """Cumulative daily counts (leading zero column) of a set of rows, as arrays over (unit, series, day): cEV Poisson
    events, cVOL the unit's isolates, cBN and cBR Bernoulli observations and resistant ones; the hospital sums over units
    (cHEV, cHVOL, cHBN, cHBR). `flags` (kept for the real data) say which series each row was an event of."""

    def __init__(self, records, keep_flags: bool = False, arrays: tuple | None = None):
        uni = universe()
        day0, _, day_of = calendar()
        self.uni = uni
        self.flags: dict = {}
        if arrays is not None:
            EV, VOL, BN, BR = arrays
            self.records, self.rdates = [], []
        else:
            rec = sorted(records, key=lambda r: r.sample_date) if any(records[i].sample_date > records[i + 1].sample_date for i in range(len(records) - 1)) else list(records)
            self.records = rec
            self.rdates = [r.sample_date for r in rec]
            D = day_of[rec[-1].sample_date] + 1
            nu, npp, nq = len(UNITS), len(uni.pser), len(uni.pairs)
            iev, ibn, ibr, ivol = [], [], [], []
            last_p: dict = {}
            last_q: dict = {}
            uidx = uni.unit_index
            for r in rec:
                u = uidx[r.ward]
                d = day_of[r.sample_date]
                ivol.append(u * D + d)
                evp = []
                for p in memberships_p(r, uni):
                    key = (r.patient_id, u, p)
                    prev = last_p.get(key)
                    last_p[key] = d
                    if prev is None or d - prev > DEDUP_DAYS:
                        iev.append((u * npp + p) * D + d)
                        evp.append(p)
                evq = []
                for q in memberships_q(r, uni):
                    key = (r.patient_id, u, q)
                    prev = last_q.get(key)
                    last_q[key] = d
                    if prev is None or d - prev > DEDUP_DAYS:
                        ibn.append((u * nq + q) * D + d)
                        is_r = r.results[uni.pairs[q].antibiotic] == "R"
                        if is_r:
                            ibr.append((u * nq + q) * D + d)
                        evq.append((q, is_r))
                if keep_flags:
                    self.flags[r.isolate_id] = (tuple(evp), tuple(evq))
            EV = np.bincount(iev, minlength=nu * npp * D).reshape(nu, npp, D).astype(np.float64)
            VOL = np.bincount(ivol, minlength=nu * D).reshape(nu, D).astype(np.float64)
            BN = np.bincount(ibn, minlength=nu * nq * D).reshape(nu, nq, D).astype(np.float64)
            BR = np.bincount(ibr, minlength=nu * nq * D).reshape(nu, nq, D).astype(np.float64)
        self.D = EV.shape[-1]
        self.EV, self.VOL, self.BN, self.BR = EV, VOL, BN, BR
        self.cEV, self.cVOL, self.cBN, self.cBR = _cum(EV), _cum(VOL), _cum(BN), _cum(BR)
        self.cHEV, self.cHVOL = self.cEV.sum(axis=0), self.cVOL.sum(axis=0)
        self.cHBN, self.cHBR = self.cBN.sum(axis=0), self.cBR.sum(axis=0)


@lru_cache(maxsize=1)
def real_world() -> World:
    records, _ = harness.data()
    return World(records, keep_flags=True)


# ---------- the statistic ----------


def _lindley(x: np.ndarray) -> np.ndarray:
    c = np.concatenate([np.zeros((x.shape[0], 1)), np.cumsum(x, axis=1)], axis=1)
    return (c - np.minimum.accumulate(c, axis=1))[:, 1:]


def period_ends(n_days: int, u: int) -> np.ndarray:
    return np.arange(n_days) if u == 1 else np.arange(6, n_days, 7)  # ISO weeks end on a Sunday; day 0 is a Monday


def poisson_stat(cy, chy, cuv, chv, theta: float, u: int, g: int, n_days: int) -> dict:
    """The Poisson CUSUM of every row of `cy` (cumulative events, leading zero), with the hospital's cumulative events of the
    row's series `chy`, the unit's cumulative isolates `cuv` and the hospital's `chv` (1-D). Returns period ends `t`, S, the
    in-control run length A in days, the weekly baseline rate and the events of the period, all over the monitored periods."""
    t = period_ends(n_days, u)
    be = t - 7 * g - u
    bs = np.maximum(be - 7 * SB_WEEKS + 1, 0)
    ok = (be >= 0) & (be - bs + 1 >= 7 * MIN_WEEKS)
    t, be, bs = t[ok], be[ok], bs[ok]
    if len(t) == 0:
        z = np.zeros((cy.shape[0], 0))
        return {"t": t, "S": z, "A": z, "lam_w": z, "y": z, "shape": z, "rate_w": z}
    cb = cy[:, be + 1] - cy[:, bs]
    hy = chy[:, be + 1] - chy[:, bs]
    uv = cuv[:, be + 1] - cuv[:, bs]
    hv = (chv[be + 1] - chv[bs])[None, :]
    rb = np.where(hv > 0, hy / np.maximum(hv, 1.0) * uv, 0.0)
    weeks = ((be - bs + 1) / 7.0)[None, :]
    shape = cb + K * rb
    lam_w = np.maximum(shape / (weeks * (1 + K)), LAM_FLOOR_WEEK)
    lam = lam_w * (u / 7.0)
    y = cy[:, t + 1] - cy[:, t - (u - 1)]
    lt = math.log(theta)
    S = _lindley(y * lt - (theta - 1) * lam)
    b = np.minimum(S + OVERSHOOT * np.sqrt(lam) * lt, EXP_CAP)
    A = u * (np.expm1(b) - b) / (lam * (theta - 1 - lt))
    return {"t": t, "S": S, "A": A, "lam_w": lam_w, "y": y, "shape": shape, "rate_w": weeks * (1 + K)}


def bernoulli_stat(cn, cr, chn, chr_, theta: float, g: int, n_days: int) -> dict:
    """The Bernoulli CUSUM (odds ratio theta) with daily batches; `cn`, `cr` cumulative observations and resistant ones of
    each row, `chn`, `chr_` the hospital's of the row's pair. Returns days `t`, S, A in days, the baseline proportion."""
    t = np.arange(n_days)
    be = t - 7 * g - 1
    bs = np.maximum(be - 7 * SB_WEEKS + 1, 0)
    ok = (be >= 0) & (be - bs + 1 >= 7 * MIN_WEEKS)
    t, be, bs = t[ok], be[ok], bs[ok]
    if len(t) == 0:
        z = np.zeros((cn.shape[0], 0))
        return {"t": t, "S": z, "A": z, "p": z, "n": z, "r": z}
    nb = cn[:, be + 1] - cn[:, bs]
    rb = cr[:, be + 1] - cr[:, bs]
    hn = chn[:, be + 1] - chn[:, bs]
    hr = chr_[:, be + 1] - chr_[:, bs]
    p_h = np.where(hn > 0, hr / np.maximum(hn, 1.0), 0.0)
    p = np.clip((rb + M * p_h) / (nb + M), P_LO, P_HI)
    n = cn[:, t + 1] - cn[:, t]
    r = cr[:, t + 1] - cr[:, t]
    lt = math.log(theta)
    lg = np.log1p((theta - 1) * p)
    S = _lindley(r * lt - n * lg)
    nu = np.maximum(nb / (be - bs + 1)[None, :], NU_FLOOR_WEEK / 7.0)
    mu = np.maximum(lg - p * lt, 1e-12)
    b = np.minimum(S + OVERSHOOT * np.sqrt(p * (1 - p)) * lt, EXP_CAP)
    A = (np.expm1(b) - b) / (mu * nu)
    return {"t": t, "S": S, "A": A, "p": p, "n": n, "r": r}


# ---------- the detector ----------


@dataclass
class Delta:
    inj: list
    removed: list


def locate(world: World, recs, focus: Focus | None) -> Delta | None:
    """The change of `recs` relative to the real data's rows up to its last date: injected rows (not in the real data) and
    removed rows (real rows missing), both within the focus window; None when `recs` is not that (a slow path is taken)."""
    n = len(recs)
    last = recs[-1].sample_date
    exp_n = bisect_right(world.rdates, last)
    if recs[0] is not world.records[0]:
        return None
    if focus is None or focus.start is None or focus.end is None:
        return Delta([], []) if n == exp_n and recs[-1] is world.records[exp_n - 1] else None
    lo, hi = bisect_left(world.rdates, focus.start), bisect_right(world.rdates, focus.end)
    key = lambda r: r.sample_date  # noqa: E731
    i0, i1 = bisect_left(recs, focus.start, key=key), bisect_right(recs, focus.end, key=key)
    given, real = recs[i0:i1], world.records[lo:hi]
    real_ids = {r.isolate_id for r in real}
    given_ids = {r.isolate_id for r in given}
    inj = [r for r in given if r.isolate_id not in real_ids]
    removed = [r for r in real if r.isolate_id not in given_ids]
    if n != exp_n + len(inj) - len(removed):
        return None
    return Delta(inj, removed)


@dataclass
class Cusum:
    """A CUSUM detector: `pois` = (theta, u, g) and/or `bern` = (theta, g); `mapping` "equalised" (p = 1 / A) or "common"
    (p = exp(-S)); `rebuild` builds the world from the rows given (the check of causality)."""

    pois: tuple[float, int, int] | None = (4.0, 1, 4)
    bern: tuple[float, int] | None = None
    mapping: str = "equalised"
    rebuild: bool = False

    def describe(self) -> str:
        parts = []
        if self.pois:
            parts.append(f"Poisson theta {self.pois[0]:g} {'daily' if self.pois[1] == 1 else 'weekly'} guard {self.pois[2]} wk")
        if self.bern:
            parts.append(f"Bernoulli theta {self.bern[0]:g} guard {self.bern[1]} wk")
        return "CUSUM, " + " + ".join(parts) + ("" if self.mapping == "equalised" else ", one common limit")

    # -- selecting the series a run needs
    def _series(self, focus: Focus | None) -> tuple[list[int], list[int], list[int]]:
        uni = universe()
        units = [uni.unit_index[u] for u in (focus.units if focus else UNITS)]
        if focus is None or (focus.organism is None and focus.phenotypes is None):
            ps, qs = list(range(len(uni.pser))), list(range(len(uni.pairs)))
        else:
            pset = {uni.ph_index[ph] for ph in (focus.phenotypes or ()) if ph in uni.ph_index}
            if focus.organism:
                pset |= {uni.os_index[(focus.organism, sp)] for sp in SPECIMENS if (focus.organism, sp) in uni.os_index}
            ps = sorted(pset)
            qs = [q for q, _ in uni.pairs_by_org.get(focus.organism, ())] if focus.organism else []
        return units, ps, qs

    def run(self, records, cultures, focus: Focus | None = None) -> list[Signal]:
        uni = universe()
        _, dates, day_of = calendar()
        delta = None
        world = None
        if not self.rebuild:
            real = real_world()
            delta = locate(real, records, focus)
            world = real if delta is not None else None
        if world is None:
            PATHS["rebuild" if self.rebuild else "slow"] += 1
            world = World(records)
            delta = Delta([], [])
        else:
            PATHS["fast"] += 1
        n_days = day_of[records[-1].sample_date] + 1
        units, ps, qs = self._series(focus)
        lo_day = day_of[focus.start] if focus and focus.start else 0
        hi_day = day_of[focus.end] if focus and focus.end else n_days - 1
        signals: list[Signal] = []
        T = n_days + 1
        rows_p = [(u, p) for u in units for p in ps]
        rows_q = [(u, q) for u in units for q in qs]
        uu = np.array([u for u, _ in rows_p], dtype=np.int64)
        pp = np.array([p for _, p in rows_p], dtype=np.int64)
        qu = np.array([u for u, _ in rows_q], dtype=np.int64)
        qq = np.array([q for _, q in rows_q], dtype=np.int64)
        cy, chy = world.cEV[uu, pp, :T].copy(), world.cHEV[pp, :T].copy()
        cuv, chv = world.cVOL[uu, :T].copy(), world.cHVOL[:T].copy()
        cn, cr = world.cBN[qu, qq, :T].copy(), world.cBR[qu, qq, :T].copy()
        chn, chr_ = world.cHBN[qq, :T].copy(), world.cHBR[qq, :T].copy()
        if delta.inj or delta.removed:
            real = world
            prow = {(u, p): i for i, (u, p) in enumerate(rows_p)}
            pgrp: dict = defaultdict(list)
            for i, (_, p) in enumerate(rows_p):
                pgrp[p].append(i)
            qrow = {(u, q): i for i, (u, q) in enumerate(rows_q)}
            qgrp: dict = defaultdict(list)
            for i, (_, q) in enumerate(rows_q):
                qgrp[q].append(i)
            urows: dict = defaultdict(list)
            for i, (u, _) in enumerate(rows_p):
                urows[u].append(i)
            for sign, rows in ((1, delta.inj), (-1, delta.removed)):
                for r in rows:
                    u, d = uni.unit_index[r.ward], day_of[r.sample_date]
                    chv[d + 1 :] += sign
                    for i in urows.get(u, ()):
                        cuv[i, d + 1 :] += sign
                    if sign > 0:
                        evp = memberships_p(r, uni)
                        evq = [(q, r.results[uni.pairs[q].antibiotic] == "R") for q in memberships_q(r, uni)]
                    else:
                        evp, evq = real.flags[r.isolate_id]
                    for p in evp:
                        if (u, p) in prow:
                            cy[prow[(u, p)], d + 1 :] += sign
                        for i in pgrp.get(p, ()):
                            chy[i, d + 1 :] += sign
                    for q, is_r in evq:
                        if (u, q) in qrow:
                            cn[qrow[(u, q)], d + 1 :] += sign
                            if is_r:
                                cr[qrow[(u, q)], d + 1 :] += sign
                        for i in qgrp.get(q, ()):
                            chn[i, d + 1 :] += sign
                            if is_r:
                                chr_[i, d + 1 :] += sign
        if self.pois and rows_p:
            theta, u_, g = self.pois
            st = poisson_stat(cy, chy, cuv, chv, theta, u_, g, n_days)
            signals += self._emit_p(st, rows_p, cy, lo_day, hi_day, dates)
        if self.bern and rows_q:
            theta, g = self.bern
            st = bernoulli_stat(cn, cr, chn, chr_, theta, g, n_days)
            signals += self._emit_b(st, rows_q, cn, cr, lo_day, hi_day, dates)
        return signals

    # -- signals
    def _p_of(self, S: float, A: float) -> float:
        if self.mapping == "common":
            return max(math.exp(-S), P_FLOOR)
        return max(1.0 / A, P_FLOOR)

    def _alarm(self, st: dict, lo_day: int, hi_day: int):
        t = st["t"]
        if len(t) == 0:
            return np.zeros((0,), dtype=np.int64), np.zeros((0,), dtype=np.int64)
        inwin = (t >= lo_day) & (t <= hi_day)
        mask = (st["S"] > 0) & inwin[None, :]
        mask &= (st["S"] > H_MIN_COMMON) if self.mapping == "common" else (st["A"] > A_LOOSE_DAYS)
        return np.nonzero(mask)

    def _emit_p(self, st, rows, cy, lo_day, hi_day, dates) -> list[Signal]:
        uni = universe()
        out = []
        ii, jj = self._alarm(st, lo_day, hi_day)
        for i, j in zip(ii.tolist(), jj.tolist(), strict=True):
            u, p = rows[i]
            t = int(st["t"][j])
            ser = uni.pser[p]
            unit = UNITS[u]
            obs = float(cy[i, t + 1] - cy[i, max(t - 27, 0)])
            exp = float(st["lam_w"][i, j] * 4.0)
            kw = {"phenotype": ser[1], "key": f"{unit}|{ser[1]}"} if ser[0] == "ph" else {"organism": ser[1], "key": f"{unit}|{ser[1]}|{ser[2]}"}
            out.append(Signal(NAME_P, kw.pop("key"), dates[t], unit, obs, expected=exp, p=self._p_of(float(st["S"][i, j]), float(st["A"][i, j])), **kw))
        return out

    def _emit_b(self, st, rows, cn, cr, lo_day, hi_day, dates) -> list[Signal]:
        uni = universe()
        out = []
        ii, jj = self._alarm(st, lo_day, hi_day)
        for i, j in zip(ii.tolist(), jj.tolist(), strict=True):
            u, q = rows[i]
            t = int(st["t"][j])
            pair = uni.pairs[q]
            unit = UNITS[u]
            lo = max(t - 27, 0)
            n28 = float(cn[i, t + 1] - cn[i, lo])
            obs = float(cr[i, t + 1] - cr[i, lo])
            out.append(
                Signal(
                    NAME_B, f"{unit}|{pair.key}", dates[t], unit, obs, organism=pair.organism, antibiotic=pair.antibiotic,
                    expected=float(st["p"][i, j]) * n28, p=self._p_of(float(st["S"][i, j]), float(st["A"][i, j])),
                )
            )
        return out

    def levels(self) -> tuple[float, ...]:
        if self.mapping == "common":
            return tuple(math.exp(-h) for h in H_GRID)
        return tuple(level_of_years(y) for y in LEVELS_YEARS)

    def detector(self, levels: tuple[float, ...] | None = None, default_level: float | None = None, name: str | None = None) -> Detector:
        return Detector(
            name=name or self.describe(), run_fn=self.run, levels=levels or self.levels(), default_level=default_level, kind_fn=lambda s: "cluster"
        )
