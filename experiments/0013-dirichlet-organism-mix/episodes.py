"""Episode-level data and the WISCA estimator of experiment 0013 (README.md, "WISCA at episode level").

An episode is a positive culture (one or two organisms). Its outcome for a drug is "covered" iff every isolate has effective
result S; under `left_out` the pair is in the target only if every isolate has a known effective result, under `counted`
every episode is in it and untested is not S. Experiment-local: the harness scores isolates.
"""

from __future__ import annotations

from datetime import date
from functools import lru_cache

import numpy as np
import pandas as pd

import mixture as mx
from aei import harness
from aei import score_coverage as sc
from aei.domain import ANTIBIOTICS
from aei.eucast import effective_result, suits_specimen

NO, NW, NS, NA, NCELL = mx.NO, mx.NW, mx.NS, mx.NA, mx.NCELL
EP_CONVENTIONS = ("left_out", "counted")


def ordinal(day: str) -> int:
    return date.fromisoformat(day).toordinal()


class Episodes:
    """All positive cultures in date order with their organism set and outcome per drug and convention."""

    def __init__(self) -> None:
        records, cultures = harness.data()
        by: dict[str, list] = {}
        for r in records:
            by.setdefault(r.culture_id, []).append(r)
        pos = {c.culture_id: c for c in cultures if c.result == "positive"}
        assert set(by) == set(pos), "positive cultures and cultures with isolates differ"
        ids = sorted(by, key=lambda c: (pos[c].sample_date, c))
        n = len(ids)
        self.n = n
        self.ids = ids
        self.day = np.array([ordinal(pos[c].sample_date) for c in ids], dtype=np.int64)
        self.ward = np.array([sc.WARD_INDEX[pos[c].ward] for c in ids], dtype=np.int64)
        self.spec = np.array([sc.SPEC_INDEX[pos[c].specimen] for c in ids], dtype=np.int64)
        self.key = pd.factorize(pd.Series([f"{pos[c].patient_id}|{pos[c].specimen}" for c in ids]))[0].astype(np.int64)
        orgs = [tuple(sorted(mx.ORGS.index(r.organism) for r in by[c])) for c in ids]
        self.types = sorted(set(orgs))
        tid = {t: i for i, t in enumerate(self.types)}
        self.type = np.array([tid[t] for t in orgs], dtype=np.int64)
        self.norg = np.array([len(t) for t in orgs], dtype=np.int64)
        self.K = len(self.types)
        self.I = np.zeros((self.K, NO))  # type x organism indicator
        for t, i in tid.items():
            self.I[i, list(t)] = 1.0
        suit = {s: [a for a, code in enumerate(ANTIBIOTICS) if suits_specimen(code, s)] for s in sc.SPECIMENS}
        self.Y = {c: np.full((n, NA), np.nan) for c in EP_CONVENTIONS}
        for e, c in enumerate(ids):
            recs = sorted(by[c], key=lambda r: r.isolate_id)
            for a in suit[pos[c].specimen]:
                effs = [effective_result(r, ANTIBIOTICS[a]) for r in recs]
                all_s = all(x.result == "S" for x in effs)
                self.Y["counted"][e, a] = 1.0 if all_s else 0.0
                if all(x.basis != "untested" for x in effs):
                    self.Y["left_out"][e, a] = 1.0 if all_s else 0.0
        self.cell = (self.ward * NS + self.spec)[:, None] * NA + np.arange(NA)[None, :]
        self.organisms_of = orgs


@lru_cache(maxsize=1)
def episodes() -> Episodes:
    return Episodes()


@lru_cache(maxsize=4096)
def _first_eps(lo: int, hi: int) -> np.ndarray:
    ep = episodes()
    i0, i1 = np.searchsorted(ep.day, [lo, hi + 1])
    if i1 <= i0:
        return np.zeros(0, dtype=np.int64)
    _, first = np.unique(ep.key[i0:i1], return_index=True)
    return i0 + np.sort(first)


def first_eps(start: str, end: str) -> np.ndarray:
    """Episodes dated from `start` to `end` that are the first positive culture of their patient x specimen in the window."""
    return _first_eps(ordinal(start), ordinal(end))


class EpStats:
    """Per cell: episodes per type with an outcome for the drug (`ct`), covered and counted (`ek`, `en`), and the hospital's."""

    def __init__(self, ct: np.ndarray, ek: np.ndarray, en: np.ndarray) -> None:
        K = ct.shape[1]
        self.ct, self.ek, self.en = ct, ek, en
        self.hct = np.tile(ct.reshape(NW, NS * NA, K).sum(0), (NW, 1))
        self.hek = np.tile(ek.reshape(NW, NS * NA).sum(0), NW)
        self.hen = np.tile(en.reshape(NW, NS * NA).sum(0), NW)


_EP_CACHE: dict[tuple[str, str], EpStats] = {}


def ep_stats(view: sc.View, convention: str) -> EpStats:
    key = (view.start, convention)
    if key not in _EP_CACHE:
        ep = episodes()
        s = ordinal(view.start)
        e = _first_eps(s - 365, s - 1)
        assert len(e) == 0 or ep.day[e].max() < s, "an episode dated on or after the view's start was read"
        for c in EP_CONVENTIONS:
            y = ep.Y[c][e]
            ok = ~np.isnan(y)
            cid = ep.cell[e][ok]
            t = np.repeat(ep.type[e][:, None], NA, axis=1)[ok]
            ct = np.bincount(cid * ep.K + t, minlength=NCELL * ep.K).reshape(NCELL, ep.K).astype(float)
            ek = np.bincount(cid, weights=y[ok], minlength=NCELL)
            en = np.bincount(cid, minlength=NCELL).astype(float)
            _EP_CACHE[(view.start, c)] = EpStats(ct, ek, en)
    return _EP_CACHE[key]


def wisca_moments(pib: np.ndarray, a0: np.ndarray, I: np.ndarray, pbar: np.ndarray, v: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Mean and variance of c = sum_T pi_T q_T, q_T = prod_{o in T} p_o, for cells (rows): pib (C, K) expected type
    shares, a0 (C,) the Dirichlet total, I (K, O) the type x organism indicator, pbar and v (C, O) the organisms' mean and
    variance. Exact under independence (README, "WISCA")."""
    C, K = pib.shape
    qbar = np.prod(np.where(I[None, :, :] == 1, pbar[:, None, :], 1.0), axis=2)
    mean = (pib * qbar).sum(1)
    outer = pib[:, :, None] * pib[:, None, :]
    diag = pib[:, :, None] * np.eye(K)[None, :, :]
    epi2 = outer + (diag - outer) / (a0[:, None, None] + 1)
    F = np.ones((C, K, K))
    for o in range(I.shape[1]):
        m = I[:, o][:, None] + I[:, o][None, :]
        f1 = pbar[:, o][:, None, None]
        f2 = (pbar[:, o] ** 2 + v[:, o])[:, None, None]
        F = F * np.where(m == 0, 1.0, np.where(m == 1, f1, f2))
    return mean, (epi2 * F).sum((1, 2)) - mean**2


def wisca_cells(view: sc.View, convention: str, m_pi: float, m: float, cids: np.ndarray | None = None, variance: bool = True) -> dict:
    """WISCA coverage (mean, variance) for the cells `cids` (all cells if None)."""
    ep = episodes()
    es = ep_stats(view, convention)
    r = mx.two_layer(mx.stats(view, convention), m_pi, m)
    sel = np.arange(NCELL) if cids is None else cids
    supp = es.hct[sel] > 0
    pct = (es.hct - es.ct)[sel]
    w0 = np.where(supp, pct + mx.SMOOTH, 0.0)
    tot = w0.sum(1, keepdims=True)
    nt = es.ct[sel]
    a0 = m_pi + nt.sum(1)
    with np.errstate(divide="ignore", invalid="ignore"):
        pi0 = np.where(tot > 0, w0 / tot, 0.0)
        pib = (m_pi * pi0 + nt) / a0[:, None]
    pbar, v = r["pbar"][sel], r["v"][sel]
    qbar = np.prod(np.where(ep.I[None, :, :] == 1, pbar[:, None, :], 1.0), axis=2)
    mean = np.where(tot[:, 0] > 0, (pib * qbar).sum(1), np.nan)
    var = np.full(len(sel), np.nan)
    if variance and len(sel):
        _, var = wisca_moments(pib, a0, ep.I, pbar, v)
        var = np.where(tot[:, 0] > 0, var, np.nan)
    return {"p": mean, "var": var, "pib": pib, "a0": a0, "pbar": pbar, "v": v, "supp": supp}


class Wisca:
    """Dirichlet over episode types (organism sets) times the same per-organism Betas, independent within an episode."""

    def __init__(self, m_pi: float, m: float) -> None:
        self.m_pi, self.m = m_pi, m
        self.name = f"wisca_Mpi{m_pi:g}_M{m:g}"

    def predict(self, view: sc.View, convention: str) -> pd.DataFrame:
        if convention not in EP_CONVENTIONS:
            raise NotImplementedError(convention)
        cid = view.grid["cell_id"].to_numpy()
        want_var = view.grid is not sc.GRID  # month and C6 views need intervals; the 26 windows only p
        r = wisca_cells(view, convention, self.m_pi, self.m, cid, variance=want_var)
        out = view.grid[["ward", "specimen", "antibiotic", "cell_id"]].copy()
        out["p"] = r["p"]
        if want_var:
            a, b = mx.match_beta(r["p"], r["var"])
            out["a"], out["b"] = a, b
        return out


class EpisodeHospital:
    """E3: covered over eligible episodes, hospital, same specimen, first positive culture per patient x specimen in the
    last 365 days; 0.5 if empty; Jeffreys Beta for intervals."""

    name = "episode_hospital_365"

    def predict(self, view: sc.View, convention: str) -> pd.DataFrame:
        if convention not in EP_CONVENTIONS:
            raise NotImplementedError(convention)
        es = ep_stats(view, convention)
        k, n = es.hek, es.hen
        p = np.where(n > 0, k / np.where(n > 0, n, 1), 0.5)
        return mx._frame(view, p=p, a=k + 0.5, b=n - k + 0.5)
