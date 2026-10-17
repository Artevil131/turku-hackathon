"""Experiment 0016: the two calibrations of the operating level, on year 1 only (README.md, "Experiment").

Siegmund: with equal in-control run lengths over m series at E episodes a year, each series' run length is L_S = m / E years
(`equal_run_length`); for one common limit h the pooled episodes a year at h, summed over series with their year-1 mean
parameters, are solved for E (`siegmund_common_h`).

Simulation: the in-control model fitted to year 1 (`fit_year1`: per active series a Poisson rate, per unit its volume, per
pair an arrival rate and a resistant share, shrunk as the statistic shrinks them), panels of independent daily counts
(`simulate`), the same statistic code on each panel, fixed-key episodes (28-day merge) counted over the last 2.4 years at
every run length (equalised) and every common limit, interpolated in log-log to E a year.
"""

from __future__ import annotations

import math

import numpy as np

import cusum as cs
from aei.domain import UNITS

E_TARGET = 5.0  # episodes a year (METRICS.md D5)
YEAR1_END = "2024-09-30"
SCORED_DAYS = 876  # 2.4 years of a 3-year panel
PANEL_DAYS = 1095


def year1_days() -> int:
    _, _, day_of = cs.calendar()
    return day_of[YEAR1_END] + 1


def fit_year1(world: cs.World) -> dict:
    """The in-control model of year 1: rates per day, for the series with at least one event (or observation) in year 1."""
    D1 = year1_days()
    nu_, npp, nq = len(UNITS), len(world.uni.pser), len(world.uni.pairs)
    ev = world.cEV[:, :, D1]  # events in year 1 per unit x series
    hev = world.cHEV[:, D1]
    vol = world.cVOL[:, D1]
    hvol = world.cHVOL[D1]
    r_b = np.where(hvol > 0, hev[None, :] / max(hvol, 1.0) * vol[:, None], 0.0)
    lam_day = np.maximum((ev + cs.K * r_b) / (D1 * (1 + cs.K)), cs.LAM_FLOOR_WEEK / 7.0)
    active_p = ev >= 1
    n = world.cBN[:, :, D1]
    r = world.cBR[:, :, D1]
    hn, hr = world.cHBN[:, D1], world.cHBR[:, D1]
    p_h = np.where(hn > 0, hr / np.maximum(hn, 1.0), 0.0)
    p_i = np.clip((r + cs.M * p_h[None, :]) / (n + cs.M), cs.P_LO, cs.P_HI)
    nu = np.maximum(n / D1, cs.NU_FLOOR_WEEK / 7.0)
    active_q = n >= 1
    return {
        "lam_day": lam_day, "active_p": active_p, "vol_day": vol / D1, "p_i": p_i, "nu_day": nu, "active_q": active_q,
        "m_p": int(active_p.sum()), "m_q": int(active_q.sum()), "D1": D1,
    }


def siegmund_a_days(lam_day: np.ndarray, theta: float, u: int, h: float) -> np.ndarray:
    lt = math.log(theta)
    lam = lam_day * u
    b = np.minimum(h + cs.OVERSHOOT * np.sqrt(lam) * lt, cs.EXP_CAP)
    return u * (np.expm1(b) - b) / (lam * (theta - 1 - lt))


def siegmund_a_days_bern(p: np.ndarray, nu_day: np.ndarray, theta: float, h: float) -> np.ndarray:
    lt = math.log(theta)
    mu = np.maximum(np.log1p((theta - 1) * p) - p * lt, 1e-12)
    b = np.minimum(h + cs.OVERSHOOT * np.sqrt(p * (1 - p)) * lt, cs.EXP_CAP)
    return (np.expm1(b) - b) / (mu * nu_day)


def siegmund_pooled(fit: dict, pois, bern, h: float) -> float:
    """Pooled episodes a year at one common limit h by Siegmund's approximation (year-1 mean parameters)."""
    tot = 0.0
    if pois:
        theta, u, _ = pois
        a = siegmund_a_days(fit["lam_day"][fit["active_p"]], theta, u, h)
        tot += float((365.25 / a).sum())
    if bern:
        theta, _ = bern
        a = siegmund_a_days_bern(fit["p_i"][fit["active_q"]], fit["nu_day"][fit["active_q"]], theta, h)
        tot += float((365.25 / a).sum())
    return tot


def siegmund_common_h(fit: dict, pois, bern, target: float = E_TARGET) -> float:
    lo, hi = 0.0, 40.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if siegmund_pooled(fit, pois, bern, mid) > target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def equal_run_length(fit: dict, pois, bern, target: float = E_TARGET) -> tuple[int, float]:
    """m, the active series of the parts in use, and L_S = m / target years."""
    m = (fit["m_p"] if pois else 0) + (fit["m_q"] if bern else 0)
    return m, m / target


def _keys(rows, kind: str):
    uni = cs.universe()
    out = []
    for u, x in rows:
        if kind == "p":
            ser = uni.pser[x]
            out.append((u, ser[1]))  # phenotype name or organism: the fixed key's tag
        else:
            out.append((u, uni.pairs[x].organism))
    return out


def simulate(fit: dict, pois, bern, n_panels: int, seed: int = 2026) -> dict:
    """Panels of 3 years from the fitted model; episodes by level (equalised, run lengths in `LEVELS_YEARS`) and by common
    limit (`H_GRID`) over the last 2.4 years, summed over panels, and the number of panel-years they cover."""
    rng = np.random.default_rng(seed)
    uni = cs.universe()
    nu_, npp, nq = len(UNITS), len(uni.pser), len(uni.pairs)
    rows_p = [(int(u), int(p)) for u, p in zip(*np.nonzero(fit["active_p"]), strict=True)] if pois else []
    rows_q = [(int(u), int(q)) for u, q in zip(*np.nonzero(fit["active_q"]), strict=True)] if bern else []
    D = PANEL_DAYS
    first_day = D - SCORED_DAYS
    keys = _keys(rows_p, "p") + _keys(rows_q, "q")
    key_ids = {k: i for i, k in enumerate(dict.fromkeys(keys))}
    rbk_p: dict = {}
    for i, k in enumerate(_keys(rows_p, "p")):
        rbk_p.setdefault(key_ids[k], []).append(i)
    rbk_q: dict = {}
    for i, k in enumerate(_keys(rows_q, "q")):
        rbk_q.setdefault(key_ids[k], []).append(i)
    rbk_p = {k: np.array(v) for k, v in rbk_p.items()}
    rbk_q = {k: np.array(v) for k, v in rbk_q.items()}
    uu = np.array([u for u, _ in rows_p], dtype=np.int64)
    pp = np.array([p for _, p in rows_p], dtype=np.int64)
    qu = np.array([u for u, _ in rows_q], dtype=np.int64)
    qq = np.array([q for _, q in rows_q], dtype=np.int64)
    thr_days = [365.25 * y for y in cs.LEVELS_YEARS]
    eq = np.zeros(len(thr_days))
    com = np.zeros(len(cs.H_GRID))
    lam = fit["lam_day"][:, :, None]
    nu = fit["nu_day"][:, :, None]
    act_p = fit["active_p"][:, :, None]
    act_q = fit["active_q"][:, :, None]
    for _ in range(n_panels):
        EV = np.where(act_p, rng.poisson(np.broadcast_to(lam, (nu_, npp, D))), 0).astype(np.float64) if pois else np.zeros((nu_, npp, D))
        VOL = rng.poisson(np.broadcast_to(fit["vol_day"][:, None], (nu_, D))).astype(np.float64)
        if bern:
            BN = np.where(act_q, rng.poisson(np.broadcast_to(nu, (nu_, nq, D))), 0)
            BR = rng.binomial(BN, np.broadcast_to(fit["p_i"][:, :, None], (nu_, nq, D))).astype(np.float64)
            BN = BN.astype(np.float64)
        else:
            BN = BR = np.zeros((nu_, nq, D))
        w = cs.World(None, arrays=(EV, VOL, BN, BR))
        parts = []
        if pois:
            theta, u_, g = pois
            st = cs.poisson_stat(w.cEV[uu, pp], w.cHEV[pp], w.cVOL[uu], w.cHVOL, theta, u_, g, D)
            parts.append((st, rbk_p))
        if bern:
            theta, g = bern
            st = cs.bernoulli_stat(w.cBN[qu, qq], w.cBR[qu, qq], w.cHBN[qq], w.cHBR[qq], theta, g, D)
            parts.append((st, rbk_q))
        eq += _count(parts, "A", thr_days, first_day, key_ids)
        com += _count(parts, "S", list(cs.H_GRID), first_day, key_ids)
    years = n_panels * SCORED_DAYS / 365.25
    return {
        "levels_years": list(cs.LEVELS_YEARS), "episodes_per_year_equalised": (eq / years).tolist(),
        "h_grid": list(cs.H_GRID), "episodes_per_year_common": (com / years).tolist(), "panels": n_panels, "scored_years": years,
        "series": len(rows_p) + len(rows_q),
    }


def _count(parts, field: str, thresholds, first_day: int, key_ids: dict) -> np.ndarray:
    """Fixed-key episodes (a new one when the gap to the key's previous alarm day exceeds 28 days) starting on or after
    `first_day`, at each threshold on `field` ("A": run length in days; "S": the common limit)."""
    out = np.zeros(len(thresholds))
    for j, thr in enumerate(thresholds):
        total = 0
        for k in key_ids.values():
            ds = []
            for st, rbk in parts:
                rows = rbk.get(k)
                if rows is None or len(st["t"]) == 0:
                    continue
                m = st[field][rows] > thr
                if field == "A":
                    m &= st["S"][rows] > 0
                alarm = m.any(axis=0)
                if alarm.any():
                    ds.append(st["t"][alarm])
            if not ds:
                continue
            d = np.unique(np.concatenate(ds)) if len(ds) > 1 else ds[0]
            starts = d[np.concatenate([[True], np.diff(d) > 28])]
            total += int((starts >= first_day).sum())
        out[j] = total
    return out


def crossing(xs, ys, target: float = E_TARGET) -> float | None:
    """The x at which the decreasing curve ys(xs) crosses `target`, interpolated in log of ys, linear in log of xs when xs are
    run lengths (pass log xs); None when it never reaches the target inside the grid."""
    xs = list(xs)
    ys = list(ys)
    for i in range(len(xs) - 1):
        if ys[i] >= target >= ys[i + 1] and ys[i + 1] > 0 and ys[i] > ys[i + 1]:
            f = (math.log(ys[i]) - math.log(target)) / (math.log(ys[i]) - math.log(ys[i + 1]))
            return xs[i] + f * (xs[i + 1] - xs[i])
        if ys[i] >= target and ys[i + 1] == 0:
            return xs[i + 1]  # fell to zero inside the step: the upper end is the first grid point at or below target
    if ys and ys[0] <= target:
        return xs[0]
    return None


def l_sim(sim: dict, target: float = E_TARGET) -> float | None:
    x = crossing([math.log(y) for y in sim["levels_years"]], sim["episodes_per_year_equalised"], target)
    return None if x is None else math.exp(x)


def h_sim(sim: dict, target: float = E_TARGET) -> float | None:
    return crossing(sim["h_grid"], sim["episodes_per_year_common"], target)
