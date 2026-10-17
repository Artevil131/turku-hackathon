"""Scoring of the episode-level part of experiment 0013 (README.md, "WISCA at episode level"): Brier on the episode target,
the C4-style realised coverage of the shipped list's severe-basis top pick, and two descriptive comparisons. Experiment-local,
not a harness metric; bootstrap draws are the harness's (`aei.score_coverage.boot_indices`).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

import episodes as epi
from aei import score_coverage as sc
from aei.domain import ANTIBIOTICS

NA, NCELL = epi.NA, epi.NCELL
PRED_NAMES = {"E0": "hospital-365, isolate level", "E1": "two-layer mix, isolate level", "E2": "WISCA, episode types", "E3": "hospital-365, episode level"}


def _ci(xs: np.ndarray) -> list[float]:
    return [sc.quantile(xs, 0.025), sc.quantile(xs, 0.975)]


def _boot(num: np.ndarray, den: np.ndarray, idx: np.ndarray) -> np.ndarray:
    with np.errstate(invalid="ignore", divide="ignore"):
        return num[idx].sum(axis=1) / den[idx].sum(axis=1)


def episode_brier(predictors: dict[str, object]) -> dict:
    """Brier over all episode x antibiotic predictions of the 26 windows in both conventions, overall and on two-organism
    episodes alone, for each predictor, with the difference to E3 and 95 % bootstrap intervals over windows. A predictor's
    NaN p is scored with E0's p (the harness's rule for an empty cell), counted in `fallback`."""
    ep = epi.episodes()
    wins = sc.windows()
    nw = len(wins)
    idx = sc.boot_indices(nw)
    res: dict = {}
    n_ep = {"episodes": 0, "two_organism": 0}
    for conv in epi.EP_CONVENTIONS:
        num = {n: {"all": np.zeros(nw), "two": np.zeros(nw), "one": np.zeros(nw)} for n in predictors}
        den = {"all": np.zeros(nw), "two": np.zeros(nw), "one": np.zeros(nw)}
        fallback = {n: 0 for n in predictors}
        for w, (start, end) in enumerate(wins):
            view = sc.View(start)
            e = epi.first_eps(start, end)
            y = ep.Y[conv][e]
            ok = ~np.isnan(y)
            yy, cc = y[ok], ep.cell[e][ok]
            two = np.repeat((ep.norg[e] == 2)[:, None], NA, axis=1)[ok]
            if conv == "left_out":
                n_ep["episodes"] += len(e)
                n_ep["two_organism"] += int((ep.norg[e] == 2).sum())
            den["all"][w], den["two"][w], den["one"][w] = len(yy), two.sum(), (~two).sum()
            pcell = {}
            for name, est in predictors.items():
                pred = est.predict(view, conv)
                arr = np.full(NCELL, np.nan)
                arr[pred["cell_id"].to_numpy()] = pred["p"].to_numpy()
                pcell[name] = arr
            for name in predictors:
                p = pcell[name][cc]
                miss = np.isnan(p)
                fallback[name] += int(miss.sum())
                p = np.where(miss, pcell["E0"][cc], p)
                sq = (p - yy) ** 2
                num[name]["all"][w], num[name]["two"][w], num[name]["one"][w] = sq.sum(), sq[two].sum(), sq[~two].sum()
        res[conv] = {}
        for name in predictors:
            r: dict = {"fallback": fallback[name]}
            for sub in ("all", "two", "one"):
                d = den[sub]
                r[sub] = {
                    "n": int(d.sum()),
                    "brier": float(num[name][sub].sum() / d.sum()),
                    "brier_ci": _ci(_boot(num[name][sub], d, idx)),
                    "diff_E3": float(num[name][sub].sum() / d.sum() - num["E3"][sub].sum() / d.sum()),
                    "diff_E3_ci": _ci(_boot(num[name][sub] - num["E3"][sub], d, idx)),
                }
                if "E1" in num:
                    r[sub]["diff_E1"] = float(num[name][sub].sum() / d.sum() - num["E1"][sub].sum() / d.sum())
                    r[sub]["diff_E1_ci"] = _ci(_boot(num[name][sub] - num["E1"][sub], d, idx))
            res[conv][name] = r
    res["targets"] = n_ep
    return res


def month_episode_counts() -> dict[str, np.ndarray]:
    """Per target month of C4 and cell: episodes covered, with an outcome (left_out) and with the drug suiting the specimen
    (counted), first positive culture per patient x specimen within the month."""
    ep = epi.episodes()
    mt = sc.month_targets()
    nm = len(mt.months)
    cov, known, n = (np.zeros((nm, NCELL)) for _ in range(3))
    for m, (_, _, start, end) in enumerate(mt.months):
        e = epi.first_eps(start, end)
        yl, yc = ep.Y["left_out"][e], ep.Y["counted"][e]
        cid = ep.cell[e]
        ok = ~np.isnan(yl)
        cov[m] = np.bincount(cid[ok], weights=yl[ok], minlength=NCELL)
        known[m] = np.bincount(cid[ok], minlength=NCELL)
        okc = ~np.isnan(yc)
        n[m] = np.bincount(cid[okc], minlength=NCELL)
    return {"cov": cov, "known": known, "n": n}


def c4_style(predictors: dict[str, object]) -> dict:
    """For each predictor the shipped list's severe-basis order (`aei.coverage_list.suggest_rows` through
    `aei.score_coverage.rank_queries`, untested gate from the shipped pool); over the query-months where the first pick
    clears, the pooled realised coverage at isolate level (what C4 reports) and at episode level, in `left_out` and `counted`,
    with 95 % bootstrap intervals over the target months."""
    mc = month_episode_counts()
    nm = len(sc.month_targets().months)
    idx = sc.boot_indices(nm)
    out: dict = {}
    for name, est in predictors.items():
        ranked = sc.rank_queries(est)
        sel = ranked[(ranked["severity"] == "severe") & (ranked["rank"] == 0) & (ranked["standing"] == "clears")]
        m = sel["m"].to_numpy()
        cid = np.array([sc.cell_id(w, s, a) for w, s, a in zip(sel["ward"], sel["specimen"], sel["antibiotic"], strict=True)], dtype=np.int64)

        def by_month(x: np.ndarray) -> np.ndarray:
            return np.bincount(m, weights=x, minlength=nm)

        parts = {
            "isolate_left_out": (by_month(sel["covered"].to_numpy()), by_month(sel["known"].to_numpy())),
            "isolate_counted": (by_month(sel["covered"].to_numpy()), by_month(sel["n_target"].to_numpy())),
            "episode_left_out": (by_month(mc["cov"][m, cid]), by_month(mc["known"][m, cid])),
            "episode_counted": (by_month(mc["cov"][m, cid]), by_month(mc["n"][m, cid])),
        }
        r: dict = {"query_months": int(len(sel)), "top_picks": sel["antibiotic"].value_counts().to_dict()}
        for key, (num, den) in parts.items():
            r[key] = {"value": float(num.sum() / den.sum()) if den.sum() else None, "ci": _ci(_boot(num, den, idx)), "n": int(den.sum())}
        r["gap_left_out"] = r["isolate_left_out"]["value"] - r["episode_left_out"]["value"]
        out[name] = r
    return out


def per_drug_gap() -> list[dict]:
    """Descriptive: per antibiotic over the 26 windows, the realised covered share of first isolates (the harness's target)
    and of first-positive-culture episodes, `left_out`."""
    ep = epi.episodes()
    T = sc.window_targets()
    pairs = T.pairs
    iso = pairs.groupby("antibiotic", observed=True)["y_left_out"].agg(["mean", "count"])
    ys, cs = [], []
    for start, end in sc.windows():
        e = epi.first_eps(start, end)
        ys.append(ep.Y["left_out"][e])
    Y = np.concatenate(ys)
    rows = []
    for a, code in enumerate(ANTIBIOTICS):
        col = Y[:, a]
        ok = ~np.isnan(col)
        if code in iso.index and ok.any():
            rows.append(
                {
                    "antibiotic": code,
                    "isolate_share": float(iso.loc[code, "mean"]),
                    "isolate_n": int(iso.loc[code, "count"]),
                    "episode_share": float(col[ok].mean()),
                    "episode_n": int(ok.sum()),
                }
            )
    return rows


def independence_check() -> dict:
    """Descriptive: over the 26 windows' episodes (`left_out`), the realised covered share of two-organism episodes against
    the product of the two organisms' realised shares among one-organism episodes of the same specimen (needs 10 such
    episodes for each), per antibiotic and pooled."""
    ep = epi.episodes()
    ys, es = [], []
    for start, end in sc.windows():
        e = epi.first_eps(start, end)
        es.append(e)
    e = np.concatenate(es)
    Y = ep.Y["left_out"][e]
    spec = ep.spec[e]
    norg = ep.norg[e]
    first = np.array([ep.organisms_of[i][0] for i in e])
    second = np.array([ep.organisms_of[i][-1] for i in e])
    mono = norg == 1
    NOg = epi.NO
    # realised share per (specimen, organism, antibiotic) among one-organism episodes
    k = np.zeros((epi.NS, NOg, NA))
    n = np.zeros((epi.NS, NOg, NA))
    for s in range(epi.NS):
        for o in range(NOg):
            sel = mono & (spec == s) & (first == o)
            y = Y[sel]
            ok = ~np.isnan(y)
            k[s, o] = np.where(ok, y, 0).sum(0)
            n[s, o] = ok.sum(0)
    rows: dict[str, list[float]] = {}
    obs_all, exp_all, cnt_all = 0.0, 0.0, 0
    two = np.nonzero(~mono)[0]
    per: dict[int, list] = {a: [0.0, 0.0, 0] for a in range(NA)}
    for i in two:
        s, o1, o2 = spec[i], first[i], second[i]
        for a in range(NA):
            y = Y[i, a]
            if np.isnan(y) or n[s, o1, a] < 10 or n[s, o2, a] < 10:
                continue
            exp = (k[s, o1, a] / n[s, o1, a]) * (k[s, o2, a] / n[s, o2, a])
            per[a][0] += y
            per[a][1] += exp
            per[a][2] += 1
            obs_all += y
            exp_all += exp
            cnt_all += 1
    for a, (o, x, c) in per.items():
        if c:
            rows[ANTIBIOTICS[a]] = [o / c, x / c, c]
    return {"per_drug": rows, "pooled": {"observed": obs_all / cnt_all, "independence": exp_all / cnt_all, "n": cnt_all}}
