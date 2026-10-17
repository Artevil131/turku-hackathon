"""The two-layer coverage estimate of experiment 0013 (Dirichlet organism mix times per-organism Beta, ENGINE.md 2.3 to
2.4) and its one-layer control. Formulas and the support rule: README.md, "Mathematical foundation".

Both are estimators of the harness protocol (`predict(view, convention)`, aei.score_coverage). The sufficient statistics of
a view (the unit's first isolates of the last 365 days per cell x organism, covered and counted, under each convention) are
computed once per as-of date and shared by every setting.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from aei import score_coverage as sc
from aei.domain import ANTIBIOTICS
from aei.eucast import has_no_breakpoint, is_intrinsic

ORGS: list[str] = sc.data().organisms
NO, NW, NS, NA, NCELL = len(ORGS), sc.NWARD, sc.NSPEC, sc.NABX, sc.NCELL
CONVENTIONS = ("left_out", "counted", "spectrum")
SMOOTH = 0.5  # Jeffreys: 0.5 per organism in the mix prior, p0 = (k + 0.5) / (n + 1)

# A pair EUCAST makes intrinsic or without breakpoint is a mask (p = 0 exactly, no Beta), ENGINE.md 1.
_MASK_OA = np.array([[is_intrinsic(o, a) or has_no_breakpoint(o, a) for a in ANTIBIOTICS] for o in ORGS])
MASKCELL = _MASK_OA[:, np.arange(NCELL) % NA].T  # (cell, organism)


class Stats:
    """Per cell (unit x specimen x antibiotic) and organism: `k` covered and `n` counted among the unit's first isolates of
    the last 365 days, and the same summed over the units (`hk`, `hn`, the whole hospital, repeated for every unit's cell)."""

    __slots__ = ("k", "n", "hk", "hn")

    def __init__(self, k: np.ndarray, n: np.ndarray) -> None:
        self.k, self.n = k, n
        self.hk = np.tile(k.reshape(NW, NS * NA, NO).sum(0), (NW, 1))
        self.hn = np.tile(n.reshape(NW, NS * NA, NO).sum(0), (NW, 1))


_CACHE: dict[tuple[str, str], Stats] = {}
CALLS = {"built": 0}  # causality check 5: every build asserts that the latest row read is dated before view.start


def stats(view: sc.View, convention: str) -> Stats:
    key = (view.start, convention)
    if key not in _CACHE:
        fc = view.first_cells(365)
        if len(fc):
            latest = str(fc["date"].max())
            assert latest < view.start, f"row dated {latest} read for a view starting {view.start}"
        CALLS["built"] += 1
        flat = fc["cell_id"].to_numpy().astype(np.int64) * NO + fc["organism"].cat.codes.to_numpy().astype(np.int64)
        for c in CONVENTIONS:
            y = fc[sc.Y[c]].to_numpy()
            ok = ~np.isnan(y)
            k = np.bincount(flat[ok], weights=y[ok], minlength=NCELL * NO).reshape(NCELL, NO)
            n = np.bincount(flat[ok], minlength=NCELL * NO).reshape(NCELL, NO).astype(float)
            _CACHE[(view.start, c)] = Stats(k, n)
    return _CACHE[key]


def two_layer(st: Stats, m_pi: float, m: float, parent: str = "loo", smooth: float = SMOOTH) -> dict[str, np.ndarray]:
    """Mean, variance and the pieces of the two-layer estimate for every cell. `parent`: "loo" (the hospital without the
    unit) or "full" (the whole hospital; only for check 4)."""
    with np.errstate(divide="ignore", invalid="ignore"):
        k, n = st.k, st.n
        pk, pn = (st.hk - k, st.hn - n) if parent == "loo" else (st.hk, st.hn)
        supp = st.hn > 0  # organisms with an outcome for the drug in the hospital's year (the unit is part of it)
        w0 = np.where(supp, pn + smooth, 0.0)
        tot = w0.sum(1, keepdims=True)
        pi0 = np.where(tot > 0, w0 / tot, 0.0)
        N = n.sum(1, keepdims=True)
        a0 = m_pi + N
        pib = (m_pi * pi0 + n) / a0
        V = pib * (1 - pib) / (a0 + 1)
        p0 = np.where(pn + 2 * smooth > 0, (pk + smooth) / (pn + 2 * smooth), 0.5)
        den = m + n
        pbar = np.where(den > 0, (m * p0 + k) / den, 0.0)
        v = pbar * (1 - pbar) / (den + 1)
        A, B = m * p0 + k, m * (1 - p0) + n - k
        pbar = np.where(MASKCELL, 0.0, pbar)
        v = np.where(MASKCELL, 0.0, v)
        A, B = np.where(MASKCELL, np.nan, A), np.where(MASKCELL, np.nan, B)
        cov = (pib * pbar).sum(1)
        var = ((pib**2 + V) * v).sum(1) + (pib * (pbar - cov[:, None]) ** 2).sum(1) / (a0[:, 0] + 1)
        bad = (tot[:, 0] == 0) | (a0[:, 0] <= 0)
        cov, var = np.where(bad, np.nan, cov), np.where(bad, np.nan, var)
    return {"p": cov, "var": var, "pib": pib, "V": V, "pbar": pbar, "v": v, "a0": a0[:, 0], "A": A, "B": B, "supp": supp, "pi0": pi0}


def match_beta(mean: np.ndarray, var: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Beta with the given mean (clipped to the harness's [0.001, 0.999]) and variance (floored at sd 1e-4 as the harness
    does): nu = m (1 - m) / v - 1, floored at 1e-3."""
    mm = np.clip(mean, *sc.CLIP)
    nu = np.maximum(mm * (1 - mm) / np.maximum(var, 1e-8) - 1, 1e-3)
    return mm * nu, (1 - mm) * nu


def _frame(view: sc.View, **cols: np.ndarray) -> pd.DataFrame:
    out = view.grid[["ward", "specimen", "antibiotic", "cell_id"]].copy()
    cid = out["cell_id"].to_numpy()
    for k, v in cols.items():
        out[k] = v[cid]
    return out


class TwoLayer:
    """Dirichlet organism mix times per-organism Beta, one Dirichlet per drug over the organisms with an outcome for it."""

    def __init__(self, m_pi: float, m: float) -> None:
        self.m_pi, self.m = m_pi, m
        self.name = f"two_layer_Mpi{m_pi:g}_M{m:g}"

    def predict(self, view: sc.View, convention: str) -> pd.DataFrame:
        r = two_layer(stats(view, convention), self.m_pi, self.m)
        a, b = match_beta(r["p"], r["var"])
        return _frame(view, p=r["p"], a=a, b=b)


class OneLayer:
    """The control: the pooled share shrunk to the hospital's, p = (k + M p0) / (n + M) over all organisms."""

    def __init__(self, m: float) -> None:
        self.m = m
        self.name = f"one_layer_M{m:g}"

    def predict(self, view: sc.View, convention: str) -> pd.DataFrame:
        st = stats(view, convention)
        k, n = st.k.sum(1), st.n.sum(1)
        hk, hn = st.hk.sum(1), st.hn.sum(1)
        pk, pn = hk - k, hn - n
        p0 = (pk + SMOOTH) / (pn + 2 * SMOOTH)
        a, b = k + self.m * p0, n - k + self.m * (1 - p0)
        p = np.where(hn > 0, a / (a + b), np.nan)
        return _frame(view, p=p, a=np.where(hn > 0, a, np.nan), b=np.where(hn > 0, b, np.nan))
