"""The discounted Beta-binomial coverage estimator of ENGINE.md 2.2, as an `aei.score_coverage` estimator.

Plan, formulas and the choices made here: README.md ("Experiment", "Mathematical foundation"). In short, per cell
(unit, specimen, antibiotic) and onset stratum (community, hospital-onset), per ISO week t:

    a_t = delta * a_{t-1} + s_t + (1 - delta) * M * p0_t        b_t = delta * b_{t-1} + r_t + (1 - delta) * M * (1 - p0_t)

with s_t, r_t the week's first isolates (first per patient x organism x specimen inside the ISO week) that were covered
and not covered, and p0_t the hospital's share for the same specimen, onset and antibiotic over the 52 weeks before week
t with the cell's own unit left out, Jeffreys-smoothed. The start is a_0 = M p0_1. Inside the current, partial week the
counts are added without discount; the discount is applied when the week turns.

Everything the estimate reads is dated before the view's first target day: weekly counts come from complete weeks (from
the full table, whose week t depends on rows of week t only), the partial week from rows up to the day before the target.
`Weekly` is built from any `aei.score_coverage.Data`, so a table truncated at a date gives the same numbers (`causality`).
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date

import numpy as np
import pandas as pd

from aei import score_coverage as sc
from aei.domain import ANTIBIOTICS, WARD_TYPE

NWARD, NSPEC, NABX, NCELL = sc.NWARD, sc.NSPEC, sc.NABX, sc.NCELL
NSA = NSPEC * NABX
P0_WEEKS = 52
#: The outcome whose counts feed the filter for each convention: untested isolates never enter the filter, so `counted`
#: is fitted on the `left_out` counts (README, "Experiment"); `spectrum` leaves no-breakpoint results out as well.
COUNTS_OF = {"left_out": "left_out", "counted": "left_out", "spectrum": "spectrum"}
INPATIENT_WARD = np.array([WARD_TYPE[w] == "in" for w in sc.UNITS])
COMMUNITY, HOSPITAL = 0, 1


def ordinal(day: str) -> int:
    return date.fromisoformat(day).toordinal()


# --- weekly counts --------------------------------------------------------------------------------------------------


def counts_between(d: sc.Data, lo: int, hi: int) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """Covered and not covered first-isolate results, per onset stratum and cell, among the isolates dated `lo` to `hi`
    (ordinal days, inclusive); first per patient x organism x specimen inside that window. For each outcome ("left_out",
    "spectrum") a pair of arrays (2, NCELL); results the outcome leaves out are not counted."""
    i0, i1 = (int(i) for i in np.searchsorted(d.day, [lo, hi + 1], side="left"))
    out = {c: (np.zeros((2, NCELL)), np.zeros((2, NCELL))) for c in ("left_out", "spectrum")}
    if i1 <= i0:
        return out
    _, first = np.unique(d.key[i0:i1], return_index=True)
    rows = i0 + np.sort(first)
    cnt = d.cnt[rows]
    total = int(cnt.sum())
    within = np.arange(total) - np.repeat(np.cumsum(cnt) - cnt, cnt)
    pos = np.repeat(d.off[rows], cnt) + within
    onset = np.repeat(d.iso["hospital_onset"].to_numpy()[rows], cnt).astype(np.int64)
    idx = onset * NCELL + d.c_cell[pos]
    for conv in out:
        y = d.c_y[conv][pos]
        ok = ~np.isnan(y)
        s = np.bincount(idx[ok], weights=y[ok], minlength=2 * NCELL)
        n = np.bincount(idx[ok], minlength=2 * NCELL)
        out[conv] = (s.reshape(2, NCELL), (n - s).reshape(2, NCELL))
    return out


@dataclass
class Weekly:
    """Weekly first-isolate counts of a table: `S[conv][w]`, `R[conv][w]` of shape (2, NCELL) for ISO week `w` (week 0 is
    the Monday-to-Sunday week of the table's first day, `base` its Monday's ordinal day)."""

    d: sc.Data
    base: int
    nweeks: int
    S: dict[str, np.ndarray]
    R: dict[str, np.ndarray]
    _p0: dict

    def p0(self, conv: str, split: bool) -> np.ndarray:
        """Parent share for week w = 0 .. nweeks (index nweeks: the week after the table), per stratum (one if not
        `split`) and cell: the hospital's covered / (covered + not covered) over the 52 weeks before week w for the same
        specimen, antibiotic and onset, the cell's own unit left out, Jeffreys: (S + 0.5) / (N + 1)."""
        key = (conv, split)
        if key not in self._p0:
            s, r = self.S[conv], self.R[conv]
            if not split:
                s, r = s.sum(axis=1, keepdims=True), r.sum(axis=1, keepdims=True)
            w_ = s.shape[0]
            lo = np.maximum(np.arange(w_ + 1) - P0_WEEKS, 0)
            hi = np.arange(w_ + 1)

            def window(x: np.ndarray) -> np.ndarray:
                cum = np.concatenate([np.zeros((1, *x.shape[1:])), np.cumsum(x, axis=0)])
                win = (cum[hi] - cum[lo]).reshape(w_ + 1, x.shape[1], NWARD, NSA)
                return (win.sum(axis=2, keepdims=True) - win).reshape(w_ + 1, x.shape[1], NCELL)

            ks, kn = window(s), window(s + r)
            self._p0[key] = (ks + 0.5) / (kn + 1.0)
        return self._p0[key]


def build_weekly(d: sc.Data) -> Weekly:
    base = int(d.day[0]) - (int(d.day[0]) - 1) % 7  # ordinal day 1 is a Monday
    nweeks = (int(d.day[-1]) - base) // 7 + 1
    s = {c: np.zeros((nweeks, 2, NCELL)) for c in ("left_out", "spectrum")}
    r = {c: np.zeros((nweeks, 2, NCELL)) for c in s}
    for w in range(nweeks):
        c = counts_between(d, base + 7 * w, base + 7 * w + 6)
        for conv in s:
            s[conv][w], r[conv][w] = c[conv]
    return Weekly(d, base, nweeks, s, r, {})


_WEEKLY: dict[int, Weekly] = {}


def weekly(d: sc.Data | None = None) -> Weekly:
    """`build_weekly` of the harness's table, built once per process."""
    d = d or sc.data()
    if id(d) not in _WEEKLY:
        _WEEKLY[id(d)] = build_weekly(d)
    return _WEEKLY[id(d)]


def truncated(d: sc.Data, upto: str) -> sc.Data:
    """A copy of the table holding only isolates dated up to and including `upto`: nothing later can be read from it."""
    i1 = int(np.searchsorted(d.day, ordinal(upto) + 1, side="left"))
    n_cells = int(d.off[i1 - 1] + d.cnt[i1 - 1])
    return replace(
        d,
        records=d.records[:i1],
        iso=d.iso.iloc[:i1],
        cells=d.cells.iloc[:n_cells],
        day=d.day[:i1],
        key=d.key[:i1],
        off=d.off[:i1],
        cnt=d.cnt[:i1],
        c_cell=d.c_cell[:n_cells],
        c_y={k: v[:n_cells] for k, v in d.c_y.items()},
    )


# --- the filter -------------------------------------------------------------------------------------------------------


def run_filter(s: np.ndarray, r: np.ndarray, p0: np.ndarray, delta: float, m: float, tracked: bool = False) -> tuple[np.ndarray, np.ndarray]:
    """The recursion over weeks. `s`, `r`: (weeks, strata, cells); `p0`: (weeks + 1, strata, cells). Returns a, b of shape
    (weeks + 1, strata, cells): index k is the state after k complete weeks (index 0 the start, m * p0[0]).

    Untracked (the plan, ENGINE.md 2.2): a_t = delta a_{t-1} + s_t + (1 - delta) m p0_t. Tracked (a variant, exploratory
    only): a_k = m p0_k + sum_j delta^(k-1-j) s_j, the form the recursion takes for a constant p0, which keeps the prior
    on the current parent also when delta = 1 (where the plan's floor term has weight 0)."""
    w_ = s.shape[0]
    a = np.empty((w_ + 1, *s.shape[1:]))
    b = np.empty_like(a)
    a[0], b[0] = m * p0[0], m * (1 - p0[0])
    if not tracked:
        for w in range(w_):
            a[w + 1] = delta * a[w] + s[w] + (1 - delta) * m * p0[w]
            b[w + 1] = delta * b[w] + r[w] + (1 - delta) * m * (1 - p0[w])
    else:
        cs, cr = np.zeros(s.shape[1:]), np.zeros(s.shape[1:])
        for w in range(w_):
            cs, cr = delta * cs + s[w], delta * cr + r[w]
            a[w + 1] = m * p0[w + 1] + cs
            b[w + 1] = m * (1 - p0[w + 1]) + cr
    return a, b


def mix_strata(a: np.ndarray, b: np.ndarray, m: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """One Beta per cell from the strata (arrays (strata, cells)): weights proportional to the effective own count
    n_eff = a + b - m, mean m_ = sum w E, variance v = sum w (Var + E^2) - m_^2, then the moment-matched Beta with c = m_
    (1 - m_) / v - 1 clipped at 1 from below. Returns p (the mixture mean), a and b. A cell with no own data in either
    stratum gets equal weights if its unit is an inpatient unit, and the community stratum if it is not."""
    if a.shape[0] == 1:
        n = a[0] + b[0]
        return a[0] / n, a[0], b[0]
    n = a + b
    mean = a / n
    var = mean * (1 - mean) / (n + 1)
    neff = n - m
    tot = neff.sum(axis=0)
    ward = np.arange(NCELL) // NSA
    fallback = np.where(INPATIENT_WARD[ward], 0.5, 1.0)
    w_comm = np.where(tot > 1e-9, neff[COMMUNITY] / np.where(tot > 1e-9, tot, 1.0), fallback)
    wt = np.stack([w_comm, 1 - w_comm])
    mm = (wt * mean).sum(axis=0)
    vv = (wt * (var + mean**2)).sum(axis=0) - mm**2
    c = np.maximum(mm * (1 - mm) / np.maximum(vv, 1e-12) - 1, 1.0)
    return mm, mm * c, (1 - mm) * c


# --- the estimator ----------------------------------------------------------------------------------------------------

_SUIT_CNT = np.bincount(sc.GRID["cell_id"].to_numpy() // NABX, minlength=NWARD * NSPEC)
_SUIT_OFF = np.cumsum(_SUIT_CNT) - _SUIT_CNT
_SUIT_ABX = (np.sort(sc.GRID["cell_id"].to_numpy()) % NABX).astype(np.int64)
_ABX_NAMES = np.array(ANTIBIOTICS)


class DiscountedBB:
    """The discounted Beta-binomial filter at (delta, m) as an estimator of the harness.

    `split=False` is the ablation without the onset split (parent and counts over both strata). `tracked=True` is the
    exploratory variant of `run_filter`. `wk` is the weekly table to read (default: the harness's full table).

    Isolate-level predictions (each target isolate gets the share of its own onset stratum) on the harness's `GRID` with a
    target, which is what C1, C2, C3(a), C5 and C8 (C1) ask for; one Beta per cell (the strata mixed by `mix_strata`)
    for every other view, which is what C3(b), C4, C6, C7 and C8 (C4) ask for. `n` is left out: the filter has no
    "fewer than 30 results" gate, every cell has a proper Beta."""

    def __init__(self, delta: float, m: float, *, split: bool = True, tracked: bool = False, wk: Weekly | None = None, label: str | None = None) -> None:
        self.delta, self.m, self.split, self.tracked = delta, float(m), split, tracked
        self.wk = wk or weekly()
        self.name = label or f"dbb_d{delta:g}_M{m:g}" + ("" if split else "_nosplit") + ("_tracked" if tracked else "")
        self._runs: dict[str, tuple[np.ndarray, np.ndarray]] = {}
        self._at: dict[tuple[int, str], tuple[np.ndarray, np.ndarray]] = {}

    def _strata(self, conv: str) -> tuple[np.ndarray, np.ndarray]:
        s, r = self.wk.S[conv], self.wk.R[conv]
        return (s, r) if self.split else (s.sum(axis=1, keepdims=True), r.sum(axis=1, keepdims=True))

    def state(self, conv: str, k: int) -> tuple[np.ndarray, np.ndarray]:
        """a, b (strata, cells) after k complete weeks; `conv` is the outcome ("left_out" or "spectrum")."""
        if conv not in self._runs:
            s, r = self._strata(conv)
            self._runs[conv] = run_filter(s, r, self.wk.p0(conv, self.split), self.delta, self.m, self.tracked)
        a, b = self._runs[conv]
        return a[k], b[k]

    def at(self, first_target_day: int, convention: str) -> tuple[np.ndarray, np.ndarray]:
        """a, b (strata, cells) for an estimate whose target starts on `first_target_day` (ordinal): the state after the
        complete weeks before it plus the counts of the partial week up to the day before, undiscounted."""
        conv = COUNTS_OF[convention]
        key = (first_target_day, conv)
        if key not in self._at:
            k = (first_target_day - self.wk.base) // 7
            if not 0 <= k <= self.wk.nweeks:
                raise ValueError("the target starts outside the table's weeks")
            a, b = (x.copy() for x in self.state(conv, k))
            lo, hi = self.wk.base + 7 * k, first_target_day - 1
            if hi >= lo:
                s, r = counts_between(self.wk.d, lo, hi)[conv]
                if not self.split:
                    s, r = s.sum(axis=0, keepdims=True), r.sum(axis=0, keepdims=True)
                a, b = a + s, b + r
            self._at[key] = (a, b)
        return self._at[key]

    def predict(self, view: sc.View, convention: str) -> pd.DataFrame:
        if convention not in COUNTS_OF:
            raise ValueError(convention)
        a, b = self.at(ordinal(view.start), convention)
        if view.grid is sc.GRID and view.target is not None:
            return self._isolate_level(view.target, a, b)
        p, pa, pb = mix_strata(a, b, self.m)
        out = view.grid[["ward", "specimen", "antibiotic", "cell_id"]].copy()
        cid = out["cell_id"].to_numpy()
        out["p"], out["a"], out["b"] = p[cid], pa[cid], pb[cid]
        return out

    def _isolate_level(self, target: pd.DataFrame, a: np.ndarray, b: np.ndarray) -> pd.DataFrame:
        share = a / (a + b)  # (strata, cells)
        key = target["ward"].cat.codes.to_numpy().astype(np.int64) * NSPEC + target["specimen"].cat.codes.to_numpy().astype(np.int64)
        cnt = _SUIT_CNT[key]
        within = np.arange(int(cnt.sum())) - np.repeat(np.cumsum(cnt) - cnt, cnt)
        abx = _SUIT_ABX[np.repeat(_SUIT_OFF[key], cnt) + within]
        cid = np.repeat(key, cnt) * NABX + abx
        stratum = np.repeat(target["hospital_onset"].to_numpy().astype(np.int64), cnt) if self.split else np.zeros(len(cid), dtype=np.int64)
        return pd.DataFrame({"isolate_id": np.repeat(target["isolate_id"].to_numpy(), cnt), "antibiotic": _ABX_NAMES[abx], "p": share[stratum, cid]})


# --- checks ---------------------------------------------------------------------------------------------------------------


def naive_filter(s: list[float], r: list[float], p0: list[float], delta: float, m: float) -> list[float]:
    """The recursion for one cell, as a plain Python loop (a check of `run_filter`): E[p] after each week."""
    a, b, out = m * p0[0], m * (1 - p0[0]), []
    for t in range(len(s)):
        a = delta * a + s[t] + (1 - delta) * m * p0[t]
        b = delta * b + r[t] + (1 - delta) * m * (1 - p0[t])
        out.append(a / (a + b))
    return out


def causality(delta: float, m: float, cuts: list[str]) -> list[dict]:
    """For each cut date, the estimate for a target starting the day after the cut from a table truncated at the cut
    against the same estimate from the full table: the largest absolute difference of a and b over both onset strata
    and every cell, for the outcomes left_out and spectrum (0 where identical)."""
    full = DiscountedBB(delta, m)
    out = []
    for cut in cuts:
        cut_est = DiscountedBB(delta, m, wk=build_weekly(truncated(sc.data(), cut)))
        day = ordinal(cut) + 1
        worst = 0.0
        for conv in ("left_out", "spectrum"):
            fa, fb = full.at(day, conv)
            ta, tb = cut_est.at(day, conv)
            worst = max(worst, float(np.abs(fa - ta).max()), float(np.abs(fb - tb).max()))
        out.append({"cut": cut, "max_abs_difference": worst})
    return out
