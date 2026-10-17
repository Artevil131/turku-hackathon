"""Experiment 0013: the two-layer coverage estimate (Dirichlet organism mix x per-organism Beta, ENGINE.md 2.3 to 2.4) on C1
to C8, its one-layer control, and WISCA at episode level. Plan: README.md.

    uv run python experiments/0013-dirichlet-organism-mix/run.py

Stage 1 chooses (M_pi, M) and the control's M on the TUNE windows only. Stage 2 runs the checks the plan lists. Stage 3
scores every setting on the scoring period through `aei.score_coverage.score_estimator`. Stage 4 scores the episode-level
WISCA part (experiment-local, not a harness metric). Stage 5 writes out/results.md, out/metrics.json (the chosen setting,
through `aei.harness.write_metrics`), out/grid.json and out/figure.png.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy import stats

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import episodes as epi  # noqa: E402
import figure  # noqa: E402
import mixture as mx  # noqa: E402
import wisca_eval as we  # noqa: E402

from aei import harness  # noqa: E402
from aei import score_coverage as sc  # noqa: E402
from aei.dates import add_days  # noqa: E402

OUT = HERE / "out"
BASELINES = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
GRID_M = (10, 30, 100, 300)
SETTINGS = [(mp, m) for mp in GRID_M for m in GRID_M]
TUNE_FIRST, TUNE_WINDOWS = "2023-12-25", 10
TIE = 0.0001  # plan: ties within 0.0001 of the best TUNE Brier go to (30, 30), else to the smallest distance from it
TUNED_ON = "2023-12-25..2024-09-29"
C1_MARGIN = 0.002  # METRICS.md "Decision rules", proposed
C4_KEYS = ("mild_spectrum", "mild_all", "severe", "mild_spectrum_counted", "mild_all_counted", "severe_counted")
MC_DRAWS = 200_000
MC_SEED = 2026
CHECK_STARTS = (sc.windows()[0][0], sc.windows()[12][0], "2026-05-01")


# --- formatting ---------------------------------------------------------------------------------------------------------


def f(x, d: int = 4) -> str:
    return "n/a" if x is None or (isinstance(x, float) and math.isnan(x)) else f"{x:.{d}f}"


def fi(x, ci, d: int = 4) -> str:
    return "n/a" if x is None else (f"{f(x, d)} ({f(ci[0], d)} to {f(ci[1], d)})" if ci else f(x, d))


def md_table(header: list[str], rows: list[list[str]]) -> str:
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(r) + " |" for r in rows]
    return "\n".join(out) + "\n"


def get(d: dict, *path):
    for p in path:
        if d is None or p not in d:
            return None
        d = d[p]
    return d


# --- stage 1: the TUNE windows ------------------------------------------------------------------------------------------


def tune_brier(ests: dict) -> tuple[dict, int]:
    """Mean Brier over all isolate x antibiotic predictions of the ten TUNE windows in `left_out`, for each estimator.
    Selection only; never reported as C1."""
    num = {k: 0.0 for k in ests}
    den = 0
    for i in range(TUNE_WINDOWS):
        start = add_days(TUNE_FIRST, 28 * i)
        end = add_days(start, 27)
        view = sc.View(start)
        tgt = sc.first_isolate_cells(start, end)
        y = tgt["y_left_out"].to_numpy()
        ok = ~np.isnan(y)
        y, cid = y[ok], tgt["cell_id"].to_numpy()[ok]
        base = sc.hospital_365.predict(view, "left_out")
        bp = np.full(mx.NCELL, np.nan)
        bp[base["cell_id"].to_numpy()] = base["p"].to_numpy()
        den += len(y)
        for k, est in ests.items():
            pred = est.predict(view, "left_out")
            arr = np.full(mx.NCELL, np.nan)
            arr[pred["cell_id"].to_numpy()] = pred["p"].to_numpy()
            p = arr[cid]
            p = np.where(np.isnan(p), bp[cid], p)
            num[k] += float(((p - y) ** 2).sum())
    return {k: v / den for k, v in num.items()}, den


def choose(brier: dict):
    """Lowest TUNE Brier; settings within TIE of it go to (30, 30) if among them, else to the smallest sum of |ln(x/30)|."""
    best = min(brier.values())
    tied = [k for k, v in brier.items() if v <= best + TIE]
    centre = (30, 30) if isinstance(tied[0], tuple) else 30
    if centre in tied:
        return centre, tied
    dist = lambda k: sum(abs(math.log(x / 30)) for x in (k if isinstance(k, tuple) else (k,)))  # noqa: E731
    return min(tied, key=lambda k: (dist(k), tuple(-x for x in (k if isinstance(k, tuple) else (k,))))), tied


# --- stage 2: the checks ------------------------------------------------------------------------------------------------


def check_variance_two_layer(m_pi: float, m: float) -> dict:
    """Check 1: closed-form mean and variance of 2.4 against Monte Carlo on 20 cells at 2026-09-27, and the matched-Beta 90 %
    interval against the Monte Carlo quantiles."""
    rng = np.random.default_rng(MC_SEED)
    view = sc.view_as_of("2026-09-27")
    st = mx.stats(view, "left_out")
    r = mx.two_layer(st, m_pi, m)
    cand = np.nonzero((r["supp"].sum(1) >= 3) & np.isfinite(r["p"]) & (r["p"] > 0.02) & (r["p"] < 0.98))[0]
    cells = np.sort(rng.choice(cand, 20, replace=False))
    rel, dmean, qgap = [], [], []
    for c in cells:
        S = np.nonzero(r["supp"][c])[0]
        alpha = m_pi * r["pi0"][c, S] + st.n[c, S]
        pi = rng.dirichlet(alpha, size=MC_DRAWS)
        pm = np.zeros((MC_DRAWS, len(S)))
        for j, o in enumerate(S):
            if not mx.MASKCELL[c, o]:
                pm[:, j] = rng.beta(r["A"][c, o], r["B"][c, o], MC_DRAWS)
        cov = (pi * pm).sum(1)
        rel.append(abs(r["var"][c] - cov.var()) / cov.var())
        dmean.append(abs(r["p"][c] - cov.mean()))
        a, b = mx.match_beta(np.array([r["p"][c]]), np.array([r["var"][c]]))
        qb = stats.beta.ppf([0.05, 0.95], a[0], b[0])
        qm = np.quantile(cov, [0.05, 0.95])
        qgap.append(float(np.abs(qb - qm).max()))
    return {"cells": int(len(cells)), "max_rel_var_error": max(rel), "median_rel_var_error": float(np.median(rel)), "max_mean_error": max(dmean), "max_interval_gap": max(qgap), "pass": max(rel) < 0.01}


def check_variance_wisca(m_pi: float, m: float) -> dict:
    """Check 2: the WISCA variance against Monte Carlo on 20 cells with two-organism types, and its reduction to the formula
    of 2.4 with one-organism types only."""
    rng = np.random.default_rng(MC_SEED)
    ep = epi.episodes()
    view = sc.view_as_of("2026-09-27")
    es = epi.ep_stats(view, "left_out")
    r = mx.two_layer(mx.stats(view, "left_out"), m_pi, m)
    two = ep.I.sum(1) == 2
    cand = np.nonzero(((es.hct > 0) & two[None, :]).sum(1) >= 2)[0]
    cand = cand[np.isfinite(r["p"][cand]) & (r["p"][cand] > 0.02) & (r["p"][cand] < 0.98)]
    cells = np.sort(rng.choice(cand, 20, replace=False))
    w = epi.wisca_cells(view, "left_out", m_pi, m, cells)
    rel, dmean = [], []
    for j, c in enumerate(cells):
        S = np.nonzero(es.hct[c] > 0)[0]
        pi0 = (es.hct[c, S] - es.ct[c, S] + mx.SMOOTH)
        pi0 = pi0 / pi0.sum()
        alpha = m_pi * pi0 + es.ct[c, S]
        pi = rng.dirichlet(alpha, size=MC_DRAWS)
        orgs = np.nonzero(ep.I[S].sum(0) > 0)[0]
        pm = np.zeros((MC_DRAWS, mx.NO))
        for o in orgs:
            if not mx.MASKCELL[c, o]:
                pm[:, o] = rng.beta(r["A"][c, o], r["B"][c, o], MC_DRAWS)
        q = np.prod(np.where(ep.I[S][None, :, :] == 1, pm[:, None, :], 1.0), axis=2)
        cov = (pi * q).sum(1)
        rel.append(abs(w["var"][j] - cov.var()) / cov.var())
        dmean.append(abs(w["p"][j] - cov.mean()))
    # reduction: identity indicator (one-organism types) must give the variance of the mixture formula
    m1, v1 = epi.wisca_moments(r["pib"], r["a0"], np.eye(mx.NO), r["pbar"], r["v"])
    ok = np.isfinite(r["var"])
    red = float(max(np.abs(m1[ok] - r["p"][ok]).max(), np.abs(v1[ok] - r["var"][ok]).max()))
    return {"cells": int(len(cells)), "max_rel_var_error": max(rel), "median_rel_var_error": float(np.median(rel)), "max_mean_error": max(dmean), "reduction_max_abs_diff": red, "pass": bool(max(rel) < 0.01 and red < 1e-12)}


def check_identities() -> dict:
    """Checks 3 and 4: M_pi = M = 0 reproduces 0004's unit 365-day raw estimator; the whole hospital as parent with huge M_pi
    and M (no smoothing) reproduces hospital-365's p. Three as-of dates, three conventions."""
    raw = sc.estimators_0004()[1][1]
    d3, d4, cells3, cells4 = 0.0, 0.0, 0, 0
    for start in CHECK_STARTS:
        view = sc.View(start)
        cid = view.grid["cell_id"].to_numpy()
        for conv in mx.CONVENTIONS:
            st = mx.stats(view, conv)
            p = mx.two_layer(st, 0, 0)["p"][cid]
            q = raw.predict(view, conv)["p"].to_numpy()
            fin = np.isfinite(p)
            assert (fin == (st.n.sum(1)[cid] > 0)).all()
            d3 = max(d3, float(np.abs(p[fin] - q[fin]).max()))
            cells3 += int(fin.sum())
            p4 = mx.two_layer(st, 1e12, 1e12, parent="full", smooth=0.0)["p"][cid]
            h = sc.hospital_365.predict(view, conv)["p"].to_numpy()
            fin4 = np.isfinite(p4)
            d4 = max(d4, float(np.abs(p4[fin4] - h[fin4]).max()))
            cells4 += int(fin4.sum())
    return {"check3_max_abs_diff": d3, "check3_cells": cells3, "check3_pass": d3 < 1e-9, "check4_max_abs_diff": d4, "check4_cells": cells4, "check4_pass": d4 < 1e-6}


# --- stage 3: scoring ----------------------------------------------------------------------------------------------------


def replacement_rule(m: dict, i: dict, shipped: dict, hosp: dict) -> list[dict]:
    """The replacement rule of METRICS.md "Decision rules" line by line (readings: Hypothesis and Experiment of README.md)."""
    lines = []
    c1 = m["C1"]["all"] - shipped["metrics"]["C1"]["all"]
    lines.append({"rule": f"C1 (all, left_out) not worse than the shipped row by more than {C1_MARGIN}", "value": f"{f(m['C1']['all'])} against shipped {f(shipped['metrics']['C1']['all'])}: {c1:+.4f}; against hospital-365 {fi(m['C1_diff']['all'], i['C1_diff']['all'])}; small cells {fi(m['C1_diff']['small'], i['C1_diff']['small'])}", "pass": bool(c1 <= C1_MARGIN)})
    worse = []
    for k in C4_KEYS:
        v, s = get(m, "C4", k), get(shipped["metrics"], "C4", k)
        if v is None or s is None or v < s:
            worse.append(k)
    lines.append({"rule": "C4 not worse than the shipped row, all six figures (point estimate not below)", "value": "; ".join(f"{k} {f(get(m, 'C4', k))} vs {f(get(shipped['metrics'], 'C4', k))} ({get(m, 'C4', k) - get(shipped['metrics'], 'C4', k):+.4f})" for k in C4_KEYS) + (f"; below: {', '.join(worse)}" if worse else ""), "pass": not worse})
    c8, s8 = get(m, "C8", "C1"), shipped["metrics"]["C8"]["C1"]
    lines.append({"rule": "C8 better than the shipped row (lower C1 on the outbreak unit-months)", "value": f"{fi(c8, get(i, 'C8', 'C1'))} against shipped {f(s8)}; C4 parts: mild_spectrum {f(get(m, 'C8', 'C4_mild_spectrum'), 3)} vs {f(shipped['metrics']['C8']['C4_mild_spectrum'], 3)}, severe {f(get(m, 'C8', 'C4_severe'), 3)} vs {f(shipped['metrics']['C8']['C4_severe'], 3)}", "pass": bool(c8 is not None and c8 < s8)})
    lines.append({"rule": "C3(b) passes (both ratios at most 1.5)", "value": f"mild {f(get(m, 'C3b', 'mild_obs'), 0)} of {f(get(m, 'C3b', 'mild_exp'), 2)} expected, severe {f(get(m, 'C3b', 'severe_obs'), 0)} of {f(get(m, 'C3b', 'severe_exp'), 2)}", "pass": bool(get(m, "C3b", "pass"))})
    lines.append({"rule": "C7(a) passes (0.85 to 0.95)", "value": fi(get(m, "C7", "a"), get(i, "C7", "a"), 3), "pass": bool(get(m, "C7", "pass_a"))})
    return lines


def slim(m: dict, i: dict) -> dict:
    keep = ("C1", "C1_diff", "C2", "C2_diff", "C3a", "C3b", "C4", "C6", "C7", "C8")
    return {"metrics": {k: m[k] for k in keep if k in m}, "intervals": {k: i[k] for k in ("C1", "C1_diff", "C4", "C7", "C8") if k in i}}


def paired_vs_control(est2, est1) -> dict:
    """C1 of the two-layer estimate minus the one-layer control's, paired over the 26 windows (95 % bootstrap, the harness's
    draws), all and small cells, `left_out` and `counted`."""
    T = sc.window_targets()
    idx = sc.boot_indices(T.nwin)
    r2, r1 = sc.Run(est2), sc.Run(est1)
    out = {}
    for conv, suffix in (("left_out", ""), ("counted", "_counted")):
        p2, p1 = r2.window_p(conv).p, r1.window_p(conv).p
        y = T.y[conv]
        for subset, mask in (("all", None), ("small", T.small)):
            sel = ~np.isnan(y) if mask is None else (~np.isnan(y)) & mask
            w = T.window[sel]
            d = np.bincount(w, weights=(p2[sel] - y[sel]) ** 2 - (p1[sel] - y[sel]) ** 2, minlength=T.nwin)
            n = np.bincount(w, minlength=T.nwin).astype(float)
            out[subset + suffix] = {"diff": float(d.sum() / n.sum()), "ci": we._ci(we._boot(d, n, idx))}
    return out


# --- stage 5: the record --------------------------------------------------------------------------------------------------


def metric_rows(cols: list[tuple[dict, dict]]) -> list[list[str]]:
    rows = []

    def add(label, *path, d=4):
        rows.append([label] + [fi(get(m, *path), get(i, *path), d) if get(i, *path) else f(get(m, *path), d) for m, i in cols])

    for k in ("all", "small", "all_counted", "small_counted"):
        add(f"C1 Brier {k}", "C1", k)
    for k in ("all", "small", "all_counted", "small_counted"):
        add(f"C1 difference to hospital-365, {k}", "C1_diff", k)
    for k in ("all", "small", "all_counted"):
        add(f"C2 log loss {k}", "C2", k)
    add("C2 difference, all", "C2_diff", "all")
    add("C3(a) slope", "C3a", "slope", d=3)
    add("C3(a) intercept", "C3a", "intercept", d=3)
    for k in ("mild_obs", "mild_exp", "severe_obs", "severe_exp"):
        add(f"C3(b) {k}", "C3b", k, d=2)
    rows.append(["C3(b) pass"] + [str(get(m, "C3b", "pass")) for m, _ in cols])
    for k in C4_KEYS:
        add(f"C4 {k}", "C4", k, d=4)
    for k in ("E1_CRO", "E1_CXM", "E2_CXM"):
        rows.append([f"C6 {k} (days)"] + [("not reached" if get(m, "C6", k) is None else str(get(m, "C6", k))) if get(m, "C6") is not None else "n/a" for m, _ in cols])
    for k in ("a", "b", "a_literal", "b_literal"):
        add(f"C7 {k}", "C7", k, d=3)
    rows.append(["C7 pass (a)"] + [str(get(m, "C7", "pass_a")) for m, _ in cols])
    add("C8 C1", "C8", "C1")
    add("C8 C1 difference", "C8", "C1_diff")
    add("C8 C4 mild_spectrum", "C8", "C4_mild_spectrum", d=3)
    add("C8 C4 severe", "C8", "C4_severe", d=3)
    return rows


def main() -> None:
    clock = harness.Clock()
    hosp = json.loads((BASELINES / "coverage-hospital-365.json").read_text())
    ship = json.loads((BASELINES / "coverage-shipped.json").read_text())

    # stage 1
    two = {s: mx.TwoLayer(*s) for s in SETTINGS}
    one = {m: mx.OneLayer(m) for m in GRID_M}
    tune2, n_tune = tune_brier({s: e for s, e in two.items()})
    tune1, _ = tune_brier({m: e for m, e in one.items()})
    chosen, tied2 = choose(tune2)
    chosen_m, tied1 = choose(tune1)
    print(f"TUNE: {n_tune} predictions; chosen (M_pi, M) = {chosen}, control M = {chosen_m}", flush=True)

    # stage 2
    checks = {
        "check1_variance_two_layer": check_variance_two_layer(*chosen),
        "check2_variance_wisca": check_variance_wisca(*chosen),
        **check_identities(),
    }
    print("checks 1 to 4:", {k: (v.get("pass") if isinstance(v, dict) else v) for k, v in checks.items()}, flush=True)

    # stage 3
    scored: dict = {}
    timings: dict = {}
    for name, est in [*[(("two", s), e) for s, e in two.items()], *[(("one", m), e) for m, e in one.items()]]:
        scored[name] = sc.score_estimator(est, with_c6=True, extras=True, verbose=False, timings=timings if name == ("two", chosen) else None)
    m_c, i_c, n_c = scored[("two", chosen)]
    m_1, i_1, _ = scored[("one", chosen_m)]
    print(f"scored {len(scored)} estimators; CPU {clock.cpu:.0f} s", flush=True)

    vs_control = paired_vs_control(two[chosen], one[chosen_m])
    # stage 4
    chosen_est = two[chosen]
    predictors = {"E0": sc.hospital_365, "E1": chosen_est, "E2": epi.Wisca(*chosen), "E3": epi.EpisodeHospital()}
    brier = we.episode_brier(predictors)
    c4 = we.c4_style(predictors)
    gap = we.per_drug_gap()
    indep = we.independence_check()
    # check 6: the C4-style loop reproduces the baseline row's isolate-level severe figures
    chk6 = {"severe": [c4["E0"]["isolate_left_out"]["value"], hosp["metrics"]["C4"]["severe"]], "severe_counted": [c4["E0"]["isolate_counted"]["value"], hosp["metrics"]["C4"]["severe_counted"]]}
    checks["check6_c4_style_reproduces_baseline"] = {"computed_vs_baseline": chk6, "pass": all(abs(a - b) < 1e-5 for a, b in chk6.values())}
    checks["check5_causality"] = {"views_built": mx.CALLS["built"], "pass": True}
    wisca = {"brier": brier, "c4_style": c4, "per_drug_gap": gap, "independence": indep,
             "note": "experiment-local episode-level target; not a harness metric, not comparable with the leaderboard's C1 or C4"}

    # stage 5
    OUT.mkdir(exist_ok=True)
    fig = figure.draw(OUT / "figure.png", *chosen)
    rule = replacement_rule(m_c, i_c, ship, hosp)
    rule1 = replacement_rule(m_1, i_1, ship, hosp)
    write_results(clock, chosen, chosen_m, tune2, tune1, tied2, tied1, n_tune, scored, hosp, ship, rule, rule1, checks, brier, c4, gap, indep, fig, vs_control)
    grid = {"note": "exploratory: every setting scored on the scoring period; a row picked from this table was picked on the scoring period (tuned-on-test)",
            "chosen_on_tune": {"M_pi": chosen[0], "M": chosen[1]}, "two_layer": {f"M_pi={s[0]},M={s[1]}": {"tune_brier": tune2[s], **slim(*scored[("two", s)][:2])} for s in SETTINGS},
            "one_layer": {f"M={m}": {"tune_brier": tune1[m], **slim(*scored[("one", m)][:2])} for m in GRID_M}}
    (OUT / "grid.json").write_text(json.dumps(harness._clean(grid), indent=2, ensure_ascii=False) + "\n")
    harness.write_metrics(
        OUT / "metrics.json",
        experiment="0013-dirichlet-organism-mix",
        method=f"Two-layer coverage: Dirichlet organism mix (M_pi {chosen[0]}) times per-organism Beta (M {chosen[1]}), one Dirichlet per drug over the organisms with an outcome, unit year shrunk to the hospital year with the unit left out, "
        "closed-form variance (ENGINE.md 2.4) and a matched Beta; setting chosen on TUNE windows only",
        family="coverage",
        metrics=m_c,
        intervals=i_c,
        n=n_c,
        runtime_s=clock.wall,
        cpu_s=clock.cpu,
        seeds=[sc.SEED],
        tuned_on_test=False,
        tuned_on=TUNED_ON,
        notes="C4 and C3(b) rank this estimator's shares by the shipped list's rules; no cell is gated on its own count (n not returned). WISCA numbers are experiment-local (episode target), in `wisca`.",
        setting={"M_pi": chosen[0], "M": chosen[1], "control_M": chosen_m},
        tune_brier={f"M_pi={s[0]},M={s[1]}": tune2[s] for s in SETTINGS},
        control={"metrics": slim(m_1, i_1)["metrics"], "intervals": slim(m_1, i_1)["intervals"]},
        vs_control=vs_control,
        checks=checks,
        wisca=wisca,
    )
    print(f"done: CPU {clock.cpu:.1f} s, wall {clock.wall:.1f} s", flush=True)


def write_results(clock, chosen, chosen_m, tune2, tune1, tied2, tied1, n_tune, scored, hosp, ship, rule, rule1, checks, brier, c4, gap, indep, fig, vs_control) -> None:
    m_c, i_c, n_c = scored[("two", chosen)]
    m_1, i_1, _ = scored[("one", chosen_m)]
    L: list[str] = ["# 0013 results", ""]
    L.append(f"Chosen on the ten TUNE windows (2023-12-25 to 2024-09-29, {n_tune} isolate x antibiotic predictions, `left_out`, selection only): "
             f"**M_pi = {chosen[0]}, M = {chosen[1]}**; tied within {TIE} of the lowest: {', '.join(f'({a}, {b})' for a, b in tied2)}. "
             f"One-layer control: **M = {chosen_m}** (tied: {', '.join(str(x) for x in tied1)}).")
    L.append("`tuned_on_test` false. Everything below is computed (aei.score_coverage, 26 target windows, 24 target months, bootstrap seed 2026).")
    L.append("")
    L.append("## Metrics against both baseline rows")
    L.append("")
    cols = [(m_c, i_c), (m_1, i_1), (hosp["metrics"], hosp["intervals"]), (ship["metrics"], ship["intervals"])]
    L.append(md_table(["metric", f"two-layer ({chosen[0]}, {chosen[1]})", f"one-layer control (M {chosen_m})", "hospital-365", "shipped"], metric_rows(cols)))
    L.append(f"n: C1 all {n_c['C1']['all']}, small {n_c['C1']['small']}, all_counted {n_c['C1']['all_counted']}; C4 mild_spectrum {get(n_c, 'C4', 'mild_spectrum')}, severe {get(n_c, 'C4', 'severe')}; C7 blocks (a) {get(n_c, 'C7', 'a')}, (b) {get(n_c, 'C7', 'b')}; C8 C1 {get(n_c, 'C8', 'C1')}; fallback (cells scored with the baseline's p) {n_c['C1']['fallback']}.")
    L.append("")
    L.append("**Two-layer minus one-layer control, C1, paired over the 26 windows (95 % bootstrap): the value of separating the organism layer**")
    L.append("")
    L.append(md_table(["subset", "difference", "95 % interval"], [[k, f"{v['diff']:+.5f}", f"{v['ci'][0]:+.5f} to {v['ci'][1]:+.5f}"] for k, v in vs_control.items()]))
    L.append("## Replacement rule, line by line")
    L.append("")
    for title, r in (("Two-layer, chosen setting", rule), ("One-layer control", rule1)):
        L.append(f"**{title}**")
        L.append("")
        L.append(md_table(["rule", "value", "passes"], [[x["rule"], x["value"], "yes" if x["pass"] else "no"] for x in r]))
        L.append(f"Replaces the shipped estimate under this reading: **{'yes' if all(x['pass'] for x in r) else 'no'}**. C6 is reported in the metrics table.")
        L.append("")
    L.append("## TUNE Brier per setting (selection only, not C1)")
    L.append("")
    rows = [[f"{mp}"] + [f"{tune2[(mp, m)]:.5f}" + (" *" if (mp, m) == chosen else "") for m in GRID_M] for mp in GRID_M]
    L.append(md_table(["M_pi \\ M"] + [str(m) for m in GRID_M], rows))
    L.append("One-layer control: " + ", ".join(f"M {m}: {tune1[m]:.5f}" + (" *" if m == chosen_m else "") for m in GRID_M) + ".")
    L.append("")
    L.append("## Exploratory grid on the scoring period")
    L.append("")
    L.append("Every setting scored on the scoring period. A row picked from this table was picked on the scoring period and must carry `tuned-on-test` if promoted. C1 differences are to hospital-365 with 95 % bootstrap intervals; * marks the setting chosen on TUNE.")
    L.append("")
    rows = []
    for s in SETTINGS:
        m, i, _ = scored[("two", s)]
        rows.append([f"({s[0]}, {s[1]})" + (" *" if s == chosen else ""), f"{tune2[s]:.5f}", fi(m["C1_diff"]["all"], i["C1_diff"]["all"], 5), f(m["C1_diff"]["small"], 5), f(m["C1_diff"]["all_counted"], 5), f(get(m, "C4", "mild_spectrum"), 3), f(get(m, "C4", "mild_all"), 3), f(get(m, "C4", "severe"), 3), f(get(m, "C7", "a"), 3), f(get(m, "C8", "C1"), 4), str(get(m, "C6", "E1_CRO") or "not reached")])
    for k in GRID_M:
        m, i, _ = scored[("one", k)]
        rows.append([f"one-layer M {k}" + (" *" if k == chosen_m else ""), f"{tune1[k]:.5f}", fi(m["C1_diff"]["all"], i["C1_diff"]["all"], 5), f(m["C1_diff"]["small"], 5), f(m["C1_diff"]["all_counted"], 5), f(get(m, "C4", "mild_spectrum"), 3), f(get(m, "C4", "mild_all"), 3), f(get(m, "C4", "severe"), 3), f(get(m, "C7", "a"), 3), f(get(m, "C8", "C1"), 4), str(get(m, "C6", "E1_CRO") or "not reached")])
    L.append(md_table(["setting (M_pi, M)", "TUNE Brier", "C1 diff all", "C1 diff small", "C1 diff all_counted", "C4 mild_spectrum", "C4 mild_all", "C4 severe", "C7 a", "C8 C1", "C6 E1_CRO"], rows))

    L.append("## WISCA at episode level (experiment-local; not a harness metric; not comparable with the leaderboard's C1 or C4)")
    L.append("")
    t = brier["targets"]
    L.append(f"Targets: {t['episodes']} first-positive-culture episodes in the 26 windows, {t['two_organism']} with two organisms ({t['two_organism'] / t['episodes'] * 100:.1f} %), computed. "
             f"WISCA and the mix use the chosen setting ({chosen[0]}, {chosen[1]}); nothing is tuned on the episode target. Predictors: E0 hospital-365 isolate level, E1 two-layer isolate level, E2 WISCA, E3 hospital-365 episode level (reference).")
    L.append("")
    for conv in ("left_out", "counted"):
        rows = []
        for name, label in we.PRED_NAMES.items():
            r = brier[conv][name]
            rows.append([f"{name} {label}", fi(r["all"]["brier"], r["all"]["brier_ci"]), fi(r["all"]["diff_E3"], r["all"]["diff_E3_ci"], 5) if name != "E3" else "reference",
                         fi(r["two"]["brier"], r["two"]["brier_ci"]), fi(r["two"]["diff_E3"], r["two"]["diff_E3_ci"], 5) if name != "E3" else "reference", fi(r["one"]["brier"], r["one"]["brier_ci"])])
        n_all, n_two, n_one = (brier[conv]["E3"][k]["n"] for k in ("all", "two", "one"))
        L.append(f"**Brier on the episode target, `{conv}`** (n = {n_all} episode x antibiotic outcomes, {n_two} on two-organism episodes, {n_one} on one-organism)")
        L.append("")
        L.append(md_table(["predictor", "Brier, all", "diff to E3, all", "Brier, two-organism", "diff to E3, two-organism", "Brier, one-organism"], rows))
    r2, r1 = brier["left_out"]["E2"], brier["left_out"]["E1"]
    L.append(f"WISCA minus two-layer isolate level (E2 − E1), `left_out`: all {fi(r2['all']['diff_E1'], r2['all']['diff_E1_ci'], 5)}; two-organism episodes {fi(r2['two']['diff_E1'], r2['two']['diff_E1_ci'], 5)}. "
             f"`counted`: all {fi(brier['counted']['E2']['all']['diff_E1'], brier['counted']['E2']['all']['diff_E1_ci'], 5)}.")
    L.append("")
    L.append("**C4-style: realised coverage of the shipped list's first severe-basis pick that clears (threshold 0.90), pooled over the query-months where it clears; isolate level (what C4 reports) against episode level**")
    L.append("")
    rows = []
    for name, label in we.PRED_NAMES.items():
        r = c4[name]
        rows.append([f"{name} {label}", str(r["query_months"]), ", ".join(f"{k} {v}" for k, v in r["top_picks"].items()),
                     fi(r["isolate_left_out"]["value"], r["isolate_left_out"]["ci"], 4), fi(r["episode_left_out"]["value"], r["episode_left_out"]["ci"], 4),
                     fi(r["isolate_counted"]["value"], r["isolate_counted"]["ci"], 4), fi(r["episode_counted"]["value"], r["episode_counted"]["ci"], 4)])
    L.append(md_table(["predictor", "query-months clearing", "first picks", "isolate level, left_out", "episode level, left_out", "isolate level, counted", "episode level, counted"], rows))
    L.append("Severe basis only; the mild basis is organism-level (D-027) and has no episode counterpart here. Bootstrap over the 24 target months.")
    L.append("")
    L.append("**Descriptive: per antibiotic, realised covered share over the 26 windows, first isolates against first-positive-culture episodes (`left_out`)**")
    L.append("")
    L.append(md_table(["antibiotic", "isolate share", "isolates", "episode share", "episodes", "episode − isolate"],
                      [[g["antibiotic"], f(g["isolate_share"], 4), str(g["isolate_n"]), f(g["episode_share"], 4), str(g["episode_n"]), f"{g['episode_share'] - g['isolate_share']:+.4f}"] for g in gap]))
    p = indep["pooled"]
    L.append(f"**Descriptive: two-organism episodes, realised covered share against the product of the two organisms' realised shares among one-organism episodes of the same specimen (`left_out`; needs 10 such episodes per organism and drug).** Pooled over episode x antibiotic outcomes: observed {p['observed']:.4f}, independence product {p['independence']:.4f}, n = {p['n']}.")
    L.append("")
    L.append(md_table(["antibiotic", "observed", "independence product", "n"], [[a, f(v[0], 4), f(v[1], 4), str(int(v[2]))] for a, v in indep["per_drug"].items()]))

    L.append("## Checks")
    L.append("")
    c1, c2 = checks["check1_variance_two_layer"], checks["check2_variance_wisca"]
    L.append(f"1. Closed-form variance of ENGINE.md 2.4 against {MC_DRAWS:,}-draw Monte Carlo on {c1['cells']} cells at 2026-09-27: maximum relative error {c1['max_rel_var_error']:.4f}, median {c1['median_rel_var_error']:.4f} (pass if under 0.01: **{'pass' if c1['pass'] else 'fail'}**); maximum error of the mean {c1['max_mean_error']:.5f}; largest gap between the matched-Beta 5 % and 95 % quantiles and the Monte Carlo quantiles {c1['max_interval_gap']:.4f} (reported, not a pass condition).")
    L.append(f"2. WISCA variance against Monte Carlo on {c2['cells']} cells with two-organism types: maximum relative error {c2['max_rel_var_error']:.4f}, median {c2['median_rel_var_error']:.4f}; with one-organism types only it reduces to the formula of 2.4 (maximum absolute difference {c2['reduction_max_abs_diff']:.1e}): **{'pass' if c2['pass'] else 'fail'}**.")
    L.append(f"3. M_pi = M = 0 reproduces 0004's unit 365-day raw estimator on {checks['check3_cells']} cells (three as-of dates, three conventions): maximum absolute difference {checks['check3_max_abs_diff']:.1e}: **{'pass' if checks['check3_pass'] else 'fail'}**.")
    L.append(f"4. Whole hospital as parent, M_pi = M = 1e12, no smoothing, reproduces hospital-365's p on {checks['check4_cells']} cells: maximum absolute difference {checks['check4_max_abs_diff']:.1e}: **{'pass' if checks['check4_pass'] else 'fail'}**.")
    L.append(f"5. Every as-of view built {checks['check5_causality']['views_built']} times asserted that the latest row read is dated before `view.start` (episodes likewise): **pass** (no assertion fired).")
    c6 = checks["check6_c4_style_reproduces_baseline"]["computed_vs_baseline"]
    L.append(f"6. The C4-style loop for E0 reproduces the baseline row's isolate-level severe figures: left_out {c6['severe'][0]:.6f} against {c6['severe'][1]:.6f}, counted {c6['severe_counted'][0]:.6f} against {c6['severe_counted'][1]:.6f}: **{'pass' if checks['check6_c4_style_reproduces_baseline']['pass'] else 'fail'}**.")
    L.append("")
    L.append("## The figure")
    L.append("")
    L.append(f"`out/figure.png`: {fig['cell']} as of {fig['as_of']}, chosen setting. Coverage {fig['coverage'] * 100:.1f} % (90 % interval {fig['interval90'][0] * 100:.1f} to {fig['interval90'][1] * 100:.1f}), hospital-365 share {fig['hospital_365'] * 100:.1f} %. "
             "Columns (organism, expected share %, expected susceptibility %, n unit / hospital): " + "; ".join(f"{c['name']} {c['w'] * 100:.1f} %, {c['p'] * 100:.1f} %, {c['n_unit']}/{c['n_hosp']}" for c in fig["columns"]) + (". The interval of the merged column is a normal approximation." if any(c.get("merged") for c in fig["columns"]) else ". No organism is under 3 %, so no column is merged."))
    L.append("")
    L.append(f"Run time {clock.cpu:.1f} s.")
    (OUT / "results.md").write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
