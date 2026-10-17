"""Experiment 0017: the improved Farrington algorithm (Noufaily et al. 2013) on weekly counts, as a detector for
`aei.score_detection`. Formulas and derivation: README.md, "Mathematical foundation". What is computed: "Experiment".

Series: weekly counts (ISO weeks, Monday to Sunday) of a patient's first isolate of the series in the trailing 365 days.
Unit scope: unit x organism (9) and unit x phenotype (4), 117 series. Hospital scope: the same 13 series hospital-wide
(a patient's first in the hospital). A week closes when the data hold a row dated on or after its Sunday; the signal is
dated that Sunday.

Per series and closed week t: reference weeks R_t (design T trailing, Y year-back, S seasonal GLM), a weighted
quasi-Poisson fit of the level (S: level and one harmonic), optional Anscombe down-weighting, mu0 and phi, and
p = P(Y >= y_t) under the negative binomial with mean mu0 and variance phi mu0 (`aei.regional.upper_tail`). Tested when
y_t >= 2. A week's counts and its reference never include a later week, so the detector is causal by construction.

A `World` holds the weekly event counts of a set of rows (unit x series and hospital x series). For the trials of
`aei.inject` the detector takes the real data's `World` and applies the change (injected rows added, removed rows taken
out), which is exact for injected rows and, for removed rows, does not re-flag a patient's later isolate as a first one;
with `rebuild=True` it builds the `World` from the rows it is given, which is what `check_causal` is run on.
"""

from __future__ import annotations

import math
from bisect import bisect_left, bisect_right
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from scipy import stats

from aei import harness
from aei.dates import add_days
from aei.detect import Signal
from aei.domain import PHENOTYPES, UNITS
from aei.inject import Focus
from aei.regional import upper_tail
from aei.score_detection import Detector

EPOCH = "2023-10-02"  # a Monday, the first day of the data
C_ANSCOMBE = 2.58  # down-weighting threshold (Noufaily et al. 2013)
MIN_WEEKS = 13  # reference weeks needed (T and S)
MIN_Y = 2  # least count tested in a week (the minimum count of 0015)
LEVELS = (3e-2, 1e-2, 3e-3, 1e-3, 3e-4, 1e-4, 3e-5, 1e-5, 1e-6)
DEDUP_DAYS = 365
YEAR_B, YEAR_W = 2, 3  # design Y: b = 2 years back, w = 3 weeks either side
S_WINDOW, S_MIN, S_MIN_EVENTS = 104, 52, 20  # design S: last 104 weeks, at least 52; harmonic only with 20 events
PREFILTER = 0.1  # the Poisson tail is never above the negative binomial one at the levels used
PATHS = {"fast": 0, "rebuild": 0, "slow": 0, "hospital": 0}  # runs by the way the world was obtained (reported in results.md)

_DAY: dict[str, int] = {}


def day_of(date: str) -> int:
    d = _DAY.get(date)
    if d is None:
        from aei.dates import days_between

        d = _DAY[date] = days_between(EPOCH, date)
    return d


@lru_cache(maxsize=None)
def date_of(day: int) -> str:
    return add_days(EPOCH, day)


@dataclass(frozen=True)
class Universe:
    organisms: tuple[str, ...]
    names: tuple[str, ...]  # organisms, then phenotypes
    index: dict
    unit_index: dict


@lru_cache(maxsize=1)
def universe() -> Universe:
    records, _ = harness.data()
    orgs = tuple(sorted({r.organism for r in records}))
    names = orgs + tuple(PHENOTYPES)
    return Universe(orgs, names, {n: i for i, n in enumerate(names)}, {u: i for i, u in enumerate(UNITS)})


def memberships(r, uni: Universe) -> list[int]:
    return [uni.index[r.organism]] + [uni.index[p] for p in r.phenotypes if p in uni.index]


class World:
    """Weekly event counts: `EV[unit, series, week]` and `EH[series, week]` (weeks since EPOCH, the last one possibly
    part-filled), from rows in date order. `flags` (kept for the real data) say which series each row was an event of."""

    def __init__(self, records, keep_flags: bool = False):
        uni = universe()
        rec = records
        if any(rec[i].sample_date > rec[i + 1].sample_date for i in range(len(rec) - 1)):
            rec = sorted(records, key=lambda r: r.sample_date)
        self.records = rec
        self.rdates = [r.sample_date for r in rec]
        self.flags: dict = {}
        W = day_of(rec[-1].sample_date) // 7 + 1
        nu, ns = len(UNITS), len(uni.names)
        iu: list[int] = []
        ih: list[int] = []
        last_u: dict = {}
        last_h: dict = {}
        for r in rec:
            d = day_of(r.sample_date)
            w = d // 7
            u = uni.unit_index[r.ward]
            eu, eh = [], []
            for s in memberships(r, uni):
                key = (r.patient_id, u, s)
                prev = last_u.get(key)
                last_u[key] = d
                if prev is None or d - prev > DEDUP_DAYS:
                    iu.append((u * ns + s) * W + w)
                    eu.append(s)
                key = (r.patient_id, s)
                prev = last_h.get(key)
                last_h[key] = d
                if prev is None or d - prev > DEDUP_DAYS:
                    ih.append(s * W + w)
                    eh.append(s)
            if keep_flags:
                self.flags[r.isolate_id] = (tuple(eu), tuple(eh))
        self.EV = np.bincount(iu, minlength=nu * ns * W).reshape(nu, ns, W).astype(np.float64)
        self.EH = np.bincount(ih, minlength=ns * W).reshape(ns, W).astype(np.float64)
        self.W = W


@lru_cache(maxsize=1)
def real_world() -> World:
    records, _ = harness.data()
    return World(records, keep_flags=True)


@dataclass
class Delta:
    inj: list
    removed: list


def locate(world: World, recs, focus: Focus | None) -> Delta | None:
    """The change of `recs` against the real data's rows up to its last date: injected rows (not in the real data) and
    removed rows (real rows missing), both inside the focus window; None when `recs` is neither (a slow path is taken)."""
    n = len(recs)
    last = recs[-1].sample_date
    exp_n = bisect_right(world.rdates, last)
    if recs[0] is not world.records[0]:
        return None
    if focus is None or focus.start is None or focus.end is None:
        return Delta([], []) if n == exp_n and recs[-1] is world.records[exp_n - 1] else None
    lo, hi = bisect_left(world.rdates, focus.start), bisect_right(world.rdates, focus.end)

    def key(r):
        return r.sample_date

    i0, i1 = bisect_left(recs, focus.start, key=key), bisect_right(recs, focus.end, key=key)
    given, real = recs[i0:i1], world.records[lo:hi]
    real_ids = {r.isolate_id for r in real}
    given_ids = {r.isolate_id for r in given}
    inj = [r for r in given if r.isolate_id not in real_ids]
    removed = [r for r in real if r.isolate_id not in given_ids]
    if n != exp_n + len(inj) - len(removed):
        return None
    return Delta(inj, removed)


# ---------- the statistic ----------


def level_fit(y: np.ndarray, m: np.ndarray, reweight: bool):
    """Weighted quasi-Poisson level on reference counts `y` with 0/1 validity `m` (arrays (..., n)): returns mu0 (floored
    at 0.5 / n_ref), phi (at least 1), the weights, n_ref and se of log mu. Closed form: mu = sum(w y) / sum(w),
    phi = max(1, sum(w (y - mu)^2 / mu) / (n - 1)); with `reweight` a second pass with Anscombe weights."""
    with np.errstate(divide="ignore", invalid="ignore"):
        y = np.where(m > 0, y, 0.0)
        n = m.sum(-1)
        nn = np.maximum(n, 1.0)
        mu = (m * y).sum(-1) / nn
        muc = np.maximum(mu, 1e-12)
        phi = np.maximum(1.0, (m * (y - mu[..., None]) ** 2).sum(-1) / muc / np.maximum(n - 1.0, 1.0))
        om = m.astype(np.float64)
        if reweight:
            r = 1.5 * (y ** (2 / 3) - muc[..., None] ** (2 / 3)) / (muc[..., None] ** (1 / 6) * np.sqrt(phi * (1.0 - 1.0 / nn))[..., None])
            om = np.where(r > C_ANSCOMBE, (C_ANSCOMBE / np.maximum(r, 1e-12)) ** 2, 1.0) * m
            so = np.maximum(om.sum(-1), 1e-12)
            mu = (om * y).sum(-1) / so
            muc = np.maximum(mu, 1e-12)
            phi = np.maximum(1.0, (om * (y - mu[..., None]) ** 2).sum(-1) / muc / np.maximum(n - 1.0, 1.0))
        mu0 = np.maximum(mu, 0.5 / nn)
        se = np.sqrt(phi / (np.maximum(mu, 0.5 / nn) * np.maximum(om.sum(-1), 1e-12)))
    return mu0, phi, om, n, se


def upper_tail_array(y: np.ndarray, mu: np.ndarray, phi: np.ndarray) -> np.ndarray:
    """`aei.regional.upper_tail` on arrays: P(X >= y) for a negative binomial with mean mu and variance phi mu."""
    y, mu, phi = np.broadcast_arrays(np.asarray(y, float), np.asarray(mu, float), np.asarray(phi, float))
    out = np.empty(y.shape)
    pois = phi <= 1.0 + 1e-9
    out[pois] = stats.poisson.sf(y[pois] - 1, mu[pois])
    nb = ~pois
    size = mu[nb] / (phi[nb] - 1.0)
    out[nb] = stats.nbinom.sf(y[nb] - 1, size, size / (size + mu[nb]))
    return out


def harmonic_fit(y: np.ndarray, s: np.ndarray, t: int, reweight: bool):
    """Design S for one series: quasi-Poisson GLM, log mu = a + b sin(2 pi s / 52) + c cos(2 pi s / 52), IRLS, reference
    weeks `s` (counts `y`), optional Anscombe pass with the GLM leverages; returns mu0 (floored), phi, weights, se of log
    mu at t. With fewer than S_MIN_EVENTS events, the level alone (`level_fit`)."""
    n = len(y)
    if y.sum() < S_MIN_EVENTS:
        mu0, phi, om, _, se = level_fit(y[None, :].astype(float), np.ones((1, n)), reweight)
        return float(mu0[0]), float(phi[0]), om[0], float(se[0])
    X = np.column_stack([np.ones(n), np.sin(2 * np.pi * s / 52.0), np.cos(2 * np.pi * s / 52.0)])
    xt = np.array([1.0, math.sin(2 * math.pi * t / 52.0), math.cos(2 * math.pi * t / 52.0)])

    def irls(om: np.ndarray):
        beta = np.array([math.log(max(y.mean(), 0.5 / n)), 0.0, 0.0])
        for _ in range(25):
            eta = np.clip(X @ beta, -30, 30)
            mu = np.exp(eta)
            z = eta + (y - mu) / mu
            w = om * mu
            A = X.T @ (w[:, None] * X)
            new = np.linalg.solve(A, X.T @ (w * z))
            done = np.max(np.abs(new - beta)) < 1e-10
            beta = new
            if done:
                break
        mu = np.exp(np.clip(X @ beta, -30, 30))
        w = om * mu
        A = X.T @ (w[:, None] * X)
        Ai = np.linalg.inv(A)
        h = w * np.einsum("ij,jk,ik->i", X, Ai, X)
        phi = max(1.0, float((om * (y - mu) ** 2 / mu).sum() / max(n - 3.0, 1.0)))
        return beta, mu, h, phi, Ai

    om = np.ones(n)
    beta, mu, h, phi, Ai = irls(om)
    if reweight:
        r = 1.5 * (y ** (2 / 3) - mu ** (2 / 3)) / (mu ** (1 / 6) * np.sqrt(phi * np.maximum(1.0 - h, 1e-9)))
        om = np.where(r > C_ANSCOMBE, (C_ANSCOMBE / np.maximum(r, 1e-12)) ** 2, 1.0)
        beta, mu, h, phi, Ai = irls(om)
    mu0 = max(float(math.exp(min(30.0, float(xt @ beta)))), 0.5 / n)
    se = math.sqrt(phi * float(xt @ Ai @ xt))
    return mu0, phi, om, se


def reference_indices(design: str, ts: np.ndarray, H: int, g: int) -> tuple[np.ndarray, np.ndarray]:
    """Reference weeks of designs T and Y for target weeks `ts`: indices (T, n) and validity (T, n)."""
    if design == "T":
        idx = ts[:, None] - g - H + np.arange(H)[None, :]
        return idx, idx >= 0
    offs, js = [], []
    for j in range(1, YEAR_B + 1):
        for k in range(-YEAR_W, YEAR_W + 1):
            offs.append(-52 * j + k)
            js.append(j)
    idx = ts[:, None] + np.array(offs)[None, :]
    ok = (ts[:, None] - 52 * np.array(js)[None, :] - YEAR_W) >= 0
    return idx, ok


def week_signals(Y: np.ndarray, ts: np.ndarray, design: str, H: int, g: int, reweight: bool, loosest: float):
    """Tested weeks of the rows of `Y` (series, weeks) at target weeks `ts` with p below `loosest`: a list of
    (row, week, y, mu0, phi, p). Designs T and Y are vectorised; S loops over series and weeks."""
    out: list[tuple] = []
    if len(ts) == 0 or Y.shape[0] == 0:
        return out
    yt = Y[:, ts]
    if design in ("T", "Y"):
        idx, valid = reference_indices(design, ts, H, g)
        ref = Y[:, np.clip(idx, 0, None)]  # (S, T, n)
        m = np.broadcast_to(valid[None, :, :], ref.shape).astype(np.float64)
        mu0, phi, _, n, _ = level_fit(ref, m, reweight)
        need = MIN_WEEKS if design == "T" else 1
        tested = (yt >= MIN_Y) & (n >= need)
        with np.errstate(divide="ignore", invalid="ignore"):
            cand = tested & (stats.poisson.sf(yt - 1, mu0) < PREFILTER)
        for i, j in zip(*np.nonzero(cand), strict=True):
            p = upper_tail(int(yt[i, j]), float(mu0[i, j]), float(phi[i, j]))
            if p < loosest:
                out.append((int(i), int(ts[j]), int(yt[i, j]), float(mu0[i, j]), float(phi[i, j]), float(p)))
        return out
    for i in range(Y.shape[0]):
        for j, t in enumerate(ts):
            t = int(t)
            if yt[i, j] < MIN_Y or t < S_MIN:
                continue
            lo = max(0, t - S_WINDOW)
            s = np.arange(lo, t)
            mu0, phi, _, _ = harmonic_fit(Y[i, lo:t], s.astype(float), t, reweight)
            if stats.poisson.sf(yt[i, j] - 1, mu0) >= PREFILTER:
                continue
            p = upper_tail(int(yt[i, j]), mu0, phi)
            if p < loosest:
                out.append((i, t, int(yt[i, j]), mu0, phi, float(p)))
    return out


@dataclass
class Farrington:
    """The detector: `design` T (trailing H weeks ending g weeks before t), Y (year-back) or S (seasonal GLM, hospital
    scope); `scope` "unit" or "hospital"; `reweight` the Anscombe pass; `rebuild` builds the world from the rows given
    (the check of causality)."""

    design: str = "T"
    scope: str = "unit"
    H: int = 52
    g: int = 0
    reweight: bool = True
    rebuild: bool = False

    @property
    def name(self) -> str:
        w = "reweighted" if self.reweight else "plain"
        d = {"T": f"trailing {self.H} wk, guard {self.g} wk", "Y": "year-back b=2 w=3", "S": "seasonal GLM 104 wk"}[self.design]
        return f"Farrington {self.scope}, {d}, {w}"

    def _rows(self, focus: Focus | None):
        uni = universe()
        if self.scope == "hospital":
            return [(None, s) for s in range(len(uni.names))]
        units = list(focus.units) if focus else list(UNITS)
        if focus is None or (focus.organism is None and focus.phenotypes is None):
            ss = list(range(len(uni.names)))
        else:
            ss = sorted({uni.index[p] for p in (focus.phenotypes or ()) if p in uni.index} | ({uni.index[focus.organism]} if focus.organism in uni.index else set()))
        return [(u, s) for u in units for s in ss]

    def run(self, records, cultures, focus: Focus | None = None) -> list[Signal]:
        uni = universe()
        world = None
        delta = Delta([], [])
        if self.scope == "unit" and not self.rebuild:
            real = real_world()
            d = locate(real, records, focus)
            if d is not None:
                world, delta = real, d
                PATHS["fast"] += 1
        if world is None:
            PATHS["hospital" if self.scope == "hospital" else "rebuild" if self.rebuild else "slow"] += 1
            world, delta = World(records), Delta([], [])
        n_closed = (day_of(records[-1].sample_date) + 1) // 7
        lo, hi = 0, n_closed - 1
        if focus is not None and focus.start is not None:
            lo = max(0, -(-(day_of(focus.start) - 6) // 7))
        if focus is not None and focus.end is not None:
            hi = min(hi, (day_of(focus.end) - 6) // 7)
        ts = np.arange(lo, hi + 1)
        rows = self._rows(focus)
        if self.scope == "hospital":
            Y = world.EH[[s for _, s in rows], :n_closed].copy()
        else:
            Y = np.array([world.EV[uni.unit_index[u], s, :n_closed] for u, s in rows]) if rows else np.zeros((0, n_closed))
            if delta.inj or delta.removed:
                where = {}
                for i, (u, s) in enumerate(rows):
                    where.setdefault((uni.unit_index[u], s), i)
                for sign, items in ((1, delta.inj), (-1, delta.removed)):
                    for r in items:
                        w = day_of(r.sample_date) // 7
                        if w >= n_closed:
                            continue
                        ui = uni.unit_index[r.ward]
                        ss = memberships(r, uni) if sign > 0 else real_world().flags[r.isolate_id][0]
                        for s in ss:
                            i = where.get((ui, s))
                            if i is not None:
                                Y[i, w] += sign
        out: list[Signal] = []
        for i, t, y, mu0, phi, p in week_signals(Y, ts, self.design, self.H, self.g, self.reweight, LEVELS[0]):
            u, s = rows[i]
            name = uni.names[s]
            is_org = s < len(uni.organisms)
            out.append(
                Signal(
                    detector=f"farrington-{self.design}-{self.scope}",
                    key=f"{u or 'hospital'}|{name}",
                    date=date_of(7 * t + 6),
                    ward=u,
                    observed=float(y),
                    organism=name if is_org else None,
                    phenotype=None if is_org else name,
                    expected=mu0,
                    p=p,
                )
            )
        out.sort(key=lambda s: (s.date, s.key))
        return out

    def detector(self, levels: tuple[float, ...] = LEVELS, default_level: float | None = None, name: str | None = None) -> Detector:
        return Detector(name=name or self.name, run_fn=self.run, levels=tuple(levels), default_level=default_level, kind_fn=lambda s: "cluster")


def explain(y: np.ndarray, t: int, design: str, H: int, g: int, reweight: bool, level: float) -> dict:
    """The fit behind one series and week, for the figure: reference weeks, their weights, mu0, phi, the Wald 95 % band
    of mu0 and the least count that signals at `level`."""
    idx, valid = reference_indices(design, np.array([t]), H, g)
    idx, valid = idx[0], valid[0]
    ref_idx = idx[valid]
    mu0, phi, om, n, se = level_fit(y[ref_idx][None, :].astype(float), np.ones((1, len(ref_idx))), reweight)
    mu0, phi, se = float(mu0[0]), float(phi[0]), float(se[0])
    need = MIN_Y
    while upper_tail(need, mu0, phi) >= level and need < 10_000:
        need += 1
    return {"ref": ref_idx, "omega": om[0], "mu0": mu0, "phi": phi, "lo": mu0 * math.exp(-1.96 * se), "hi": mu0 * math.exp(1.96 * se), "need": need, "n": int(n[0])}
