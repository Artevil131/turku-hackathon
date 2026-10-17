"""Pooled-level coverage estimators of experiment 0014 (plan: README.md "Experiment" and "Mathematical foundation").

An estimator of the overnight harness (`aei.score_coverage`: `predict(view, convention)`) whose share for a unit's cell is
the covered share of a pool of units, over the first isolates of the last 365 days:

    H   hospital: all nine units
    IO  inpatient/outpatient: wards.csv `ward_type`
    WC  ward class: the cross of wards.csv `institution` and `ward_type` (in-wards, ED, health centres)
    U   the unit

`Pooled(level)` is unsplit (P rows). `Pooled(level, split=True)` splits by onset (S rows): isolate-level p of the target
isolate's own onset stratum on the harness's C1 windows, the folded cell-level Beta everywhere else. `Pooled(level,
split=True, fold_only=True)` folds on every view (F rows, the ablation of what the harness's cell grain loses).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from aei import harness
from aei import score_coverage as sc
from aei.dataset import INPATIENT_UNITS
from aei.domain import UNITS

NWARD, NSPEC, NABX, NCELL = sc.NWARD, sc.NSPEC, sc.NABX, sc.NCELL
M = NSPEC * NABX  # cells of one unit
LEVELS = ("H", "IO", "WC", "U")
LEVEL_NAMES = {"H": "hospital", "IO": "inpatient/outpatient", "WC": "ward class", "U": "unit"}
WINDOW_DAYS = 365
JEFFREYS = 0.5
C_FLOOR = 1e-3  # floor of the matched Beta's concentration (plan, "Variance of the fold")


def _wards() -> pd.DataFrame:
    w = pd.read_csv(harness.DATA / "wards.csv").set_index("ward_code")
    return w.loc[UNITS]


def group_ids(level: str) -> np.ndarray:
    """Pool of each unit (in `aei.domain.UNITS` order) at a level: the same id means the same pool."""
    w = _wards()
    if level == "H":
        return np.zeros(NWARD, dtype=np.int64)
    if level == "IO":
        return pd.factorize(w["ward_type"])[0].astype(np.int64)
    if level == "WC":
        return pd.factorize(w["institution"] + "|" + w["ward_type"])[0].astype(np.int64)
    if level == "U":
        return np.arange(NWARD, dtype=np.int64)
    raise ValueError(level)


def pool_matrix(level: str) -> np.ndarray:
    """(NWARD, NWARD) 0/1: entry [u, v] is 1 when unit v is in unit u's pool; `pool_matrix(level) @ x` pools unit counts."""
    g = group_ids(level)
    return (g[:, None] == g[None, :]).astype(float)


POOL = {level: pool_matrix(level) for level in LEVELS}
INPATIENT = np.array([u in INPATIENT_UNITS for u in UNITS])


# --- counts -------------------------------------------------------------------------------------------------------------


def unit_counts(view: sc.View, convention: str) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """Covered and counted per unit and (specimen x antibiotic) cell, shape (NWARD, M), over the view's first isolates of
    the last 365 days (`view.first_cells(365)`, strictly before `view.start`): all ("all") and by onset stratum ("C"
    community, "O" hospital onset, day 3 of the stay or later)."""
    key = ("counts0014", convention)
    if key not in view.memo:
        fc = view.first_cells(WINDOW_DAYS)
        onset = fc["hospital_onset"].to_numpy()
        out = {}
        for name, frame in (("all", fc), ("C", fc[~onset]), ("O", fc[onset])):
            k, n = sc.cell_counts(frame, convention, "unit")
            out[name] = (k.reshape(NWARD, M), n.reshape(NWARD, M))
        view.memo[key] = out
    return view.memo[key]


def pooled_counts(view: sc.View, convention: str, level: str) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """`unit_counts` summed over each unit's pool at a level (shape (NWARD, M): the pool of the row's unit)."""
    return {s: (POOL[level] @ k, POOL[level] @ n) for s, (k, n) in unit_counts(view, convention).items()}


def onset_weights(view: sc.View) -> tuple[np.ndarray, np.ndarray]:
    """(w_O, N) of shape (NWARD, M): w_O is the unit's hospital-onset share of its first isolates of the specimen over the
    last 365 days (all organisms), N their number; the hospital's share for that specimen where an inpatient unit has none;
    0 for the outpatient units (no admission date, community only)."""
    key = "weights0014"
    if key not in view.memo:
        iso = view.first_isolates(WINDOW_DAYS)
        cnt = np.zeros((2, NWARD, NSPEC))
        np.add.at(cnt, (iso["hospital_onset"].to_numpy().astype(np.int64), iso["ward"].cat.codes.to_numpy().astype(np.int64), iso["specimen"].cat.codes.to_numpy().astype(np.int64)), 1.0)
        n = cnt.sum(axis=0)
        tot = n.sum(axis=0)
        hosp = np.where(tot > 0, cnt[1].sum(axis=0) / np.where(tot > 0, tot, 1.0), 0.0)
        w = np.where(n > 0, cnt[1] / np.where(n > 0, n, 1.0), hosp[None, :])
        w = np.where(INPATIENT[:, None], w, 0.0)
        view.memo[key] = (np.repeat(w, NABX, axis=1), np.repeat(n, NABX, axis=1))
    return view.memo[key]


# --- the estimates --------------------------------------------------------------------------------------------------------


def _share(k: np.ndarray, n: np.ndarray, fallback: np.ndarray) -> np.ndarray:
    ok = n > 0
    return np.where(ok, k / np.where(ok, n, 1.0), fallback)


def hospital_unsplit(view: sc.View, convention: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The hospital's p (0.5 if empty) and Jeffreys (a, b), shape (NWARD, M) (the same row for every unit)."""
    k, n = pooled_counts(view, convention, "H")["all"]
    return _share(k, n, 0.5), k + JEFFREYS, n - k + JEFFREYS


def unsplit(view: sc.View, convention: str, level: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """p = k/n of the pool, (a, b) = (k + 0.5, n - k + 0.5); an empty pool takes the hospital's."""
    ph, ah, bh = hospital_unsplit(view, convention)
    k, n = pooled_counts(view, convention, level)["all"]
    ok = n > 0
    return _share(k, n, ph), np.where(ok, k + JEFFREYS, ah), np.where(ok, n - k + JEFFREYS, bh)


def strata(view: sc.View, convention: str, level: str) -> dict[str, tuple[np.ndarray, np.ndarray, np.ndarray]]:
    """Per stratum ("C", "O"): p = k_s/n_s of the pool and Jeffreys (a, b); an empty stratum takes the hospital's stratum,
    else the hospital's unsplit estimate."""
    ph, ah, bh = hospital_unsplit(view, convention)
    pool = pooled_counts(view, convention, level)
    hosp = pooled_counts(view, convention, "H")
    out = {}
    for s in ("C", "O"):
        k, n = pool[s]
        hk, hn = hosp[s]
        ok, okh = n > 0, hn > 0
        p = np.where(ok, k / np.where(ok, n, 1.0), np.where(okh, hk / np.where(okh, hn, 1.0), ph))
        a = np.where(ok, k + JEFFREYS, np.where(okh, hk + JEFFREYS, ah))
        b = np.where(ok, n - k + JEFFREYS, np.where(okh, hn - hk + JEFFREYS, bh))
        out[s] = (p, a, b)
    return out


def fold(st: dict[str, tuple[np.ndarray, np.ndarray, np.ndarray]], w_o: np.ndarray, n_unit: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The onset strata folded to one cell: p = w_O p_O + w_C p_C and the Beta (a, b) moment-matched to the Jeffreys means
    m_s = a_s/(a_s + b_s) and Var = sum w_s^2 v_s + (m_O - m_C)^2 w_O w_C / (N + 2); w_O = 0 (or 1) returns that
    stratum's Beta unchanged. `n_unit` is N, the unit's first isolates of the specimen."""
    w_c = 1.0 - w_o
    (pc, ac, bc), (po, ao, bo) = st["C"], st["O"]
    p = w_o * po + w_c * pc
    mc, mo = ac / (ac + bc), ao / (ao + bo)
    vc = ac * bc / ((ac + bc) ** 2 * (ac + bc + 1))
    vo = ao * bo / ((ao + bo) ** 2 * (ao + bo + 1))
    m = np.clip(w_o * mo + w_c * mc, sc.CLIP[0], sc.CLIP[1])
    var = w_o**2 * vo + w_c**2 * vc + (mo - mc) ** 2 * w_o * w_c / (n_unit + 2)
    c = np.maximum(m * (1 - m) / np.maximum(var, 1e-12) - 1, C_FLOOR)
    a, b = m * c, (1 - m) * c
    a = np.where(w_o <= 0, ac, np.where(w_o >= 1, ao, a))
    b = np.where(w_o <= 0, bc, np.where(w_o >= 1, bo, b))
    return p, a, b


def fold_moments(st: dict[str, tuple[np.ndarray, np.ndarray, np.ndarray]], w_o: np.ndarray, n_unit: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """The mean and variance the matched Beta of `fold` is meant to have (for a check)."""
    w_c = 1.0 - w_o
    (_, ac, bc), (_, ao, bo) = st["C"], st["O"]
    mc, mo = ac / (ac + bc), ao / (ao + bo)
    vc = ac * bc / ((ac + bc) ** 2 * (ac + bc + 1))
    vo = ao * bo / ((ao + bo) ** 2 * (ao + bo + 1))
    m = w_o * mo + w_c * mc
    return m, w_o**2 * vo + w_c**2 * vc + (mo - mc) ** 2 * w_o * w_c / (n_unit + 2)


# --- the estimator --------------------------------------------------------------------------------------------------------

_SUIT_CNT = np.bincount(sc.GRID["cell_id"].to_numpy() // NABX, minlength=NWARD * NSPEC)
_SUIT_OFF = np.cumsum(_SUIT_CNT) - _SUIT_CNT
_SUIT_ABX = (np.sort(sc.GRID["cell_id"].to_numpy()) % NABX).astype(np.int64)
_ABX_NAMES = np.array(sc.ANTIBIOTICS)


class Pooled:
    """Pooled coverage at `level` (H, IO, WC, U), unsplit, split (isolate-level on the harness's C1 windows, folded
    elsewhere) or folded everywhere (`fold_only`). `n` is the hospital's count of the cell for every row, so no row is gated
    at its own level (README.md, "Estimates")."""

    def __init__(self, level: str, split: bool = False, fold_only: bool = False) -> None:
        if level not in LEVELS:
            raise ValueError(level)
        self.level, self.split, self.fold_only = level, split, fold_only
        self.kind = "F" if (split and fold_only) else ("S" if split else "P")
        self.name = f"{self.kind}-{level}"

    def arrays(self, view: sc.View, convention: str) -> dict[str, np.ndarray]:
        """p, a, b of the cell (NCELL,) and, for a split row, p_strata (2, NCELL): community, then onset."""
        key = ("arrays0014", self.level, self.split, convention)
        if key not in view.memo:
            if not self.split:
                p, a, b = unsplit(view, convention, self.level)
                res = {"p": p.reshape(-1), "a": a.reshape(-1), "b": b.reshape(-1)}
            else:
                st = strata(view, convention, self.level)
                w_o, n_unit = onset_weights(view)
                p, a, b = fold(st, w_o, n_unit)
                res = {"p": p.reshape(-1), "a": a.reshape(-1), "b": b.reshape(-1), "p_strata": np.stack([st["C"][0].reshape(-1), st["O"][0].reshape(-1)])}
            view.memo[key] = res
        return view.memo[key]

    def predict(self, view: sc.View, convention: str) -> pd.DataFrame:
        if convention not in sc.CONVENTIONS:
            raise ValueError(convention)
        arr = self.arrays(view, convention)
        if self.split and not self.fold_only and view.grid is sc.GRID and view.target is not None:
            return self._isolate_level(view.target, arr["p_strata"])
        out = view.grid[["ward", "specimen", "antibiotic", "cell_id"]].copy()
        cid = out["cell_id"].to_numpy()
        n_hosp = pooled_counts(view, convention, "H")["all"][1].reshape(-1)
        out["p"], out["a"], out["b"], out["n"] = arr["p"][cid], arr["a"][cid], arr["b"][cid], n_hosp[cid]
        return out

    @staticmethod
    def _isolate_level(target: pd.DataFrame, p_strata: np.ndarray) -> pd.DataFrame:
        """Each target isolate x suiting antibiotic gets the p of its own onset stratum (known when the sample is taken)."""
        key = target["ward"].cat.codes.to_numpy().astype(np.int64) * NSPEC + target["specimen"].cat.codes.to_numpy().astype(np.int64)
        cnt = _SUIT_CNT[key]
        within = np.arange(int(cnt.sum())) - np.repeat(np.cumsum(cnt) - cnt, cnt)
        abx = _SUIT_ABX[np.repeat(_SUIT_OFF[key], cnt) + within]
        cid = np.repeat(key, cnt) * NABX + abx
        stratum = np.repeat(target["hospital_onset"].to_numpy().astype(np.int64), cnt)
        return pd.DataFrame({"isolate_id": np.repeat(target["isolate_id"].to_numpy(), cnt), "antibiotic": _ABX_NAMES[abx], "p": p_strata[stratum, cid]})


def rows() -> list[Pooled]:
    """The twelve rows in the plan's order: P, S, F by level."""
    return [Pooled(level, split, fold_only) for split, fold_only in ((False, False), (True, False), (True, True)) for level in LEVELS]
