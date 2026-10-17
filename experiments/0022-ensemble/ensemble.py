"""Experiment 0022: the year-1 re-tuned live set (A) and the 0016 CUSUM union (B) combined into one detector for
`aei.score_detection`. Plan: README.md, "Experiment" and "Mathematical foundation".

Join key and score field. A cell is a unit and a tag, the tag a phenotype (esbl, mrsa, vre, cpe) or an organism; a signal maps
to a cell by `cell_of` (a phenotype when it has one, else its organism, specimen dropped; a Bernoulli pair to its organism).
A component's score in cell c on day t is s_j(c, t) = the smallest p of its signals in c dated in (t - JOIN, t], 1 when silent,
and a new-in-unit sentinel (a rule without p) counts as p = NEW_P. Only cell-days where a component signalled can pass.

Rules, each a monotone map of (s_A, s_B) to a harness p, frozen at the end of the tuning year:
  RankProduct   q_j = (1 + #{background cell-days with s_j <= s}) / (N_j + 1), p = RP^2 (1 - 2 ln RP), RP = sqrt(q_A q_B)
  Stack         logistic on x1 = -log10 s_A, x2 = -log10 s_B, x3 = [both fired] (scaled), p = the upper-tail share of the
                background cell-days with the same or a larger linear predictor
  union / intersection   p = min / max of (s_A, s_B)
`Components` runs A and B once per trial (cached by the trial's rows) and every rule is derived from the same signals.
"""

from __future__ import annotations

import dataclasses
import datetime
import math
from bisect import bisect_left, bisect_right
from functools import lru_cache

import numpy as np

from aei import cusum as cs
from aei import harness
from aei import score_detection as sd
from aei.dates import add_days
from aei.detect import Signal
from aei.domain import PHENOTYPES, UNITS
from aei.inject import Focus
from aei.logistic import fit_logistic

JOIN = 7  # a component's signal carries forward over this many days (t, t + 1, ..., t + 6)
NEW_P = 1e-6  # new-in-unit has no p; it scores below every level tested
LEVELS = (0.3, 0.1, 0.03, 0.01, 3e-3, 1e-3, 3e-4, 1e-4, 3e-5, 1e-5, 3e-6, 1e-6)
A_NAMES = ("profile-excess", "phenotype-excess", "new-in-unit")
BG = ("2024-01-01", "2024-09-30")  # ranks' background: 13 weeks of CUSUM baseline first, to the end of the tuning year
STACK_NEG = ("2024-04-01", "2024-09-30")


@lru_cache(maxsize=None)
def ordinal(day: str) -> int:
    return datetime.date.fromisoformat(day).toordinal()


@lru_cache(maxsize=None)
def iso(t: int) -> str:
    return datetime.date.fromordinal(t).isoformat()


def cell_of(s: Signal) -> tuple[str, str, str]:
    """(unit, "ph" or "org", name): the phenotype when the signal has one (new-in-unit has both), else the organism."""
    if s.phenotype:
        return (s.ward, "ph", s.phenotype)
    return (s.ward, "org", s.organism)


def all_cells() -> list[tuple[str, str, str]]:
    orgs = cs.universe().organisms
    return [(u, "ph", p) for u in UNITS for p in PHENOTYPES] + [(u, "org", o) for u in UNITS for o in orgs]


# ---------- components, run once per trial ----------


def _sample_date(x) -> str:
    return x.sample_date


class Components:
    """The live set (A, its cluster and sentinel signals) and the CUSUM (B) on the same rows. `run` returns (A signals, B
    signals) and caches them by the trial (the focus and the rows inside its window), so every rule scored on one
    seed-2026 stream costs one run of A and B per trial. With a focus the components see it widened by JOIN - 1 days at the
    start so that the signals of the days before the window are there to carry forward."""

    def __init__(self, live: sd.LiveSet, cusum: cs.Cusum, cache: bool = True):
        self.live, self.cusum, self.use_cache = live, cusum, cache
        self.cache: dict = {}
        self.calls = {"hit": 0, "run": 0}

    def _key(self, records, cultures, focus):
        n, m = len(records), len(cultures)
        if focus is None or focus.start is None or focus.end is None:
            return (None, n, m, records[-1].isolate_id if n else None)
        lo, hi = bisect_left(records, focus.start, key=_sample_date), bisect_right(records, focus.end, key=_sample_date)
        clo, chi = bisect_left(cultures, focus.start, key=_sample_date), bisect_right(cultures, focus.end, key=_sample_date)
        return (focus, n, m, hash(tuple(r.isolate_id for r in records[lo:hi])), hash(tuple(c.culture_id for c in cultures[clo:chi])))

    def run(self, records, cultures, focus: Focus | None = None) -> tuple[list[Signal], list[Signal]]:
        key = self._key(records, cultures, focus) if self.use_cache else None
        if key is not None and key in self.cache:
            self.calls["hit"] += 1
            return self.cache[key]
        self.calls["run"] += 1
        wf = focus
        lo_date = None
        if focus is not None and focus.start is not None and focus.end is not None:
            lo_date = add_days(focus.start, -(JOIN - 1))
            wf = dataclasses.replace(focus, start=lo_date)
        a = [s for s in self.live.run(records, cultures, wf) if s.detector in A_NAMES and (lo_date is None or s.date >= lo_date)]
        b = self.cusum.run(records, cultures, wf)
        out = (a, b)
        if key is not None:
            self.cache[key] = out
        return out


# ---------- the score field ----------


def score_map(signals, join: int, lo: int = -(10**9), hi: int = 10**9) -> dict:
    """{(cell, t): [smallest p, number of cluster-kind signals]} over t in [lo, hi], each signal carried over `join` days."""
    m: dict = {}
    for s in signals:
        d = ordinal(s.date)
        if d > hi or d + join - 1 < lo:
            continue
        p = NEW_P if s.p is None else s.p
        cl = 0 if s.detector == "new-in-unit" else 1
        c = cell_of(s)
        for t in range(max(d, lo), min(d + join - 1, hi) + 1):
            e = m.get((c, t))
            if e is None:
                m[(c, t)] = [p, cl]
            else:
                if p < e[0]:
                    e[0] = p
                e[1] += cl
    return m


def fields(mA: dict, mB: dict, keys: list) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """s_A, s_B (1 when silent), A's number of cluster-kind signals and B's number of signals, over `keys`."""
    sA = np.array([mA[k][0] if k in mA else 1.0 for k in keys])
    sB = np.array([mB[k][0] if k in mB else 1.0 for k in keys])
    nA = np.array([mA[k][1] if k in mA else 0 for k in keys])
    nB = np.array([mB[k][1] if k in mB else 0 for k in keys])
    return sA, sB, nA, nB


# ---------- the rules ----------


class Union:
    name = "union"

    def score(self, sA, sB):
        return np.minimum(sA, sB)


class Intersection:
    name = "intersection"

    def score(self, sA, sB):
        return np.maximum(sA, sB)


class Background:
    """The real data's component scores over BG for every cell and day (frozen at BG[1]): the fired values of each component
    sorted, the number of cell-days N, and the maps they define."""

    def __init__(self, a_real, b_real, join: int):
        lo, hi = ordinal(BG[0]), ordinal(BG[1])
        self.join, self.lo, self.hi = join, lo, hi
        self.mA = score_map(a_real, join, lo, hi)
        self.mB = score_map(b_real, join, lo, hi)
        self.N = len(all_cells()) * (hi - lo + 1)
        self.fA = np.sort(np.array([v[0] for v in self.mA.values()]))
        self.fB = np.sort(np.array([v[0] for v in self.mB.values()]))
        self.keys = sorted(set(self.mA) | set(self.mB))

    def q(self, which: str, s: np.ndarray) -> np.ndarray:
        """Quantile of s against the background of component `which`: (1 + #{bg cell-days with s_j <= s}) / (N + 1)."""
        f = self.fA if which == "A" else self.fB
        return np.where(s >= 1.0, 1.0, (1.0 + np.searchsorted(f, s, side="right")) / (self.N + 1.0))


class RankProduct:
    name = "rank_product"

    def __init__(self, bg: Background):
        self.bg = bg

    def score(self, sA, sB):
        qq = self.bg.q("A", sA) * self.bg.q("B", sB)  # RP^2
        return np.minimum(qq * (1.0 - np.log(qq)), 1.0)

    def empirical(self, levels) -> list[dict]:
        """The independence null against the background's own tail: share of the N background cell-days with p below a level."""
        sA, sB, _, _ = fields(self.bg.mA, self.bg.mB, self.bg.keys)
        p = self.score(sA, sB)
        out = []
        for lv in levels:
            c = int((p < lv).sum())
            emp = c / self.bg.N
            out.append({"level": lv, "count": c, "empirical": emp, "ratio_analytic_over_empirical": (lv / emp) if emp > 0 else None})
        return out


class Stack:
    name = "stack"

    def __init__(self, bg: Background, weights: list[float], scale: list[float], l2: float, n_pos: int, n_neg: int):
        self.bg, self.w, self.scale, self.l2, self.n_pos, self.n_neg = bg, weights, scale, l2, n_pos, n_neg
        sA, sB, _, _ = fields(bg.mA, bg.mB, bg.keys)
        z = self.z(sA, sB)
        self.zf = np.sort(z)
        self.n_silent = bg.N - len(bg.keys)
        self.z0 = self.w[0]  # both silent: x = 0

    def x(self, sA, sB) -> np.ndarray:
        both = ((sA < 1.0) & (sB < 1.0)).astype(float)
        return np.column_stack([-np.log10(sA), -np.log10(sB), both]) / np.array(self.scale)

    def z(self, sA, sB) -> np.ndarray:
        return self.w[0] + self.x(sA, sB) @ np.array(self.w[1:])

    def score(self, sA, sB):
        z = self.z(sA, sB)
        ge = (len(self.zf) - np.searchsorted(self.zf, z, side="left")) + np.where(self.z0 >= z, self.n_silent, 0)
        return np.where((sA >= 1.0) & (sB >= 1.0), 1.0, (1.0 + ge) / (self.bg.N + 1.0))


def fit_stack(bg: Background, rows_pos: tuple, rows_neg: tuple, l2: float = 1.0) -> Stack:
    """Logistic regression (aei.logistic, L2 on the slopes, intercept free) on year-1 rows: `rows_*` are (s_A, s_B) arrays;
    features scaled by their standard deviation over the training rows."""
    sA = np.concatenate([rows_pos[0], rows_neg[0]])
    sB = np.concatenate([rows_pos[1], rows_neg[1]])
    y = np.concatenate([np.ones(len(rows_pos[0])), np.zeros(len(rows_neg[0]))])
    raw = np.column_stack([-np.log10(sA), -np.log10(sB), ((sA < 1.0) & (sB < 1.0)).astype(float)])
    scale = raw.std(axis=0)
    scale = np.where(scale > 0, scale, 1.0)
    model = fit_logistic(raw / scale, y.astype(int).tolist(), l2=l2)
    return Stack(bg, model.weights, scale.tolist(), l2, len(rows_pos[0]), len(rows_neg[0]))


# ---------- the detector ----------


def kind_fn(s: Signal) -> str:
    return "sentinel" if s.detector.endswith("_sentinel") else "cluster"


def ensemble_signals(comps: Components, rule, join: int, name: str, records, cultures, focus: Focus | None) -> list[Signal]:
    """The rule's signals: one per cell-day where a component signalled and the rule's p is below the loosest level, kind
    sentinel (detector name + "_sentinel") when only new-in-unit signalled. A focus limits the days to its window."""
    a, b = comps.run(records, cultures, focus)
    tmax = ordinal(records[-1].sample_date) if len(records) else 0
    lo, hi = -(10**9), tmax
    if focus is not None and focus.start is not None and focus.end is not None:
        lo, hi = ordinal(focus.start), min(tmax, ordinal(focus.end))
    mA = score_map(a, join, lo, hi)
    mB = score_map(b, join, lo, hi)
    keys = sorted(set(mA) | set(mB), key=lambda k: (k[1], k[0]))
    if not keys:
        return []
    sA, sB, nA, nB = fields(mA, mB, keys)
    p = rule.score(sA, sB)
    out = []
    for i in np.nonzero(p < LEVELS[0])[0].tolist():
        c, t = keys[i]
        sentinel = nA[i] == 0 and nB[i] == 0
        kw = {"phenotype": c[2]} if c[1] == "ph" else {"organism": c[2]}
        out.append(
            Signal(name + ("_sentinel" if sentinel else ""), f"{c[0]}|{c[2]}", iso(t), c[0], float(int(sA[i] < 1.0) + int(sB[i] < 1.0)), p=float(p[i]), **kw)
        )
    return out


def make_detector(comps: Components, rule, name: str, join: int = JOIN, default_level: float | None = None, label: str | None = None) -> sd.Detector:
    return sd.Detector(
        name=label or name,
        run_fn=lambda records, cultures, focus=None: ensemble_signals(comps, rule, join, name, records, cultures, focus),
        levels=LEVELS,
        default_level=default_level,
        kind_fn=kind_fn,
    )


def component_detector(comps: Components, which: str, level_fn) -> sd.Detector:
    """A or B alone as a Detector (raw signals), for the parts table: `level_fn(signal, level)` says what passes."""
    idx = 0 if which == "A" else 1
    return sd.Detector(
        name=f"component {which}", run_fn=lambda records, cultures, focus=None: comps.run(records, cultures, focus)[idx], levels=(1.0,), passes_fn=level_fn,
        kind_fn=lambda s: "sentinel" if s.detector == "new-in-unit" else "cluster",
    )
