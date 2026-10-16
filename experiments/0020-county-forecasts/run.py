"""Experiment 0020: one-month-ahead county forecasts of THL's MRSA, ESBL, VRE and CPE series by a rolling Poisson GLM
with annual harmonics, scored on P2 against persistence and seasonal naive. Plan and formulas: README.md.

    uv run python experiments/0020-county-forecasts/run.py

Stage 1 tunes on the targets 2024-01 to 2024-09 only and writes out/tuning.csv and out/selected.json; stage 2 scores
the rows R1 to R4 on 2024-10 to 2026-09 through `aei.score_prediction`; stage 3 writes out/results.md, out/metrics.json
(R1) and out/skill_by_phenotype.svg (SVG, not PNG: scripts/verify_experiments.py decodes every file
in out/ as UTF-8 and stops on a binary one).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
matplotlib.rcParams["svg.hashsalt"] = "0020-county-forecasts"  # fixed ids, so reruns compare equal
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from glm_forecast import DISPERSIONS, EMPTY, STATUS, FitCache, GLMForecaster, Spec, fit_window  # noqa: E402

from aei import harness  # noqa: E402
from aei import score_prediction as sp  # noqa: E402
from aei.regional import expected_month  # noqa: E402

OUT = HERE / "out"
BASELINES = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
TUNE_TARGETS = tuple(sp.month_range("2024-01", "2024-09"))
WINDOWS, KS, TRENDS, RHOS, FLOORS = (24, 36), (0, 1, 2), (False, True), (0.0, 1.0), (0.02, 0.1, 0.5)
PHENOS = sp.PHENOTYPES
GROUPS_ORDER = ("pooled", *PHENOS, "national")
GROUP_LABEL = {"pooled": "Pooled (92 county series)", "national": "National (4 totals)", **{p: p for p in PHENOS}}
TUNED_ON = "targets 2024-01 to 2024-09 (windows from 2021-01); no scoring-period number used"


# ---------------------------------------------------------------------------------------------------------------------
# Grid and selection
# ---------------------------------------------------------------------------------------------------------------------


def grid() -> list[Spec]:
    cells = []
    for w in WINDOWS:
        for k in KS:
            for trend in TRENDS:
                for rho in RHOS:
                    if k == 0 and not trend and rho == 1.0:
                        continue  # rho changes nothing when the model is the level alone
                    for disp in DISPERSIONS:
                        for floor in FLOORS:
                            cells.append(Spec(w, k, trend, rho, disp, floor))
    assert len(cells) == 198, len(cells)
    return cells


def tune(cells: list[Spec], cache: FitCache) -> tuple[np.ndarray, dict[str, np.ndarray]]:
    """Mean log score over the 92 county series (and over each phenotype's 23) at every tuning target, per cell, scored
    through `run_forecaster`: arrays (cells x months)."""
    pooled = np.zeros((len(cells), len(TUNE_TARGETS)))
    per = {ph: np.zeros_like(pooled) for ph in PHENOS}
    for c, spec in enumerate(cells):
        sc = sp.run_forecaster(GLMForecaster(spec, cache), TUNE_TARGETS)
        masks = sp.group_masks(sc.keys)
        pooled[c] = sc.log_score[:, masks["pooled"]].mean(axis=1)
        for ph in PHENOS:
            per[ph][c] = sc.log_score[:, masks[ph]].mean(axis=1)
    return pooled, per


def select(cells: list[Spec], table: np.ndarray) -> tuple[int, np.ndarray, np.ndarray, np.ndarray]:
    """The one-standard-error rule of the plan. Returns the chosen cell, the mean tuning scores, the standard errors of
    the difference to the best cell, and the eligibility mask."""
    mean = table.mean(axis=1)
    best = int(np.argmax(mean))
    diff = table[best][None, :] - table
    se = diff.std(axis=1, ddof=1) / np.sqrt(table.shape[1])
    eligible = (mean[best] - mean) <= se + 1e-12
    rank = {d: i for i, d in enumerate(DISPERSIONS)}

    def key(i: int) -> tuple:
        c = cells[i]
        return (c.n_params, rank[c.dispersion], c.rho, -c.window, -c.floor)

    return min(np.flatnonzero(eligible), key=key), mean, se, eligible


def ablation_k(spec: Spec) -> Spec:
    return Spec(spec.window, 1 if spec.k == 0 else 0, spec.trend, spec.rho, spec.dispersion, spec.floor)


def ablation_dispersion(spec: Spec) -> Spec:
    return Spec(spec.window, spec.k, spec.trend, spec.rho, "quasi_pooled" if spec.dispersion == "poisson" else "poisson", spec.floor)


# ---------------------------------------------------------------------------------------------------------------------
# Checks and diagnostics
# ---------------------------------------------------------------------------------------------------------------------


def check_against_0008() -> dict:
    """The fitter against aei.regional.expected_month (statsmodels; W = 36, linear trend, K = 1), before floor and guards,
    on the tuning targets, every (series, target) whose window has at least 20 cases."""
    cs = sp.county_series()
    worst_mu = worst_phi = 0.0
    n = skipped = 0
    for target in TUNE_TARGETS:
        ti = cs.months.index(target)
        for ph in PHENOS:
            idx = np.array([i for i, k in enumerate(cs.keys) if k[0] == ph])
            y = cs.values[idx, ti - 36 : ti]
            fit = fit_window(y, 36, ti, 1, True, 0.0)
            for j, i in enumerate(idx):
                if y[j].sum() < 20:
                    continue
                if not fit.raw_converged[j]:
                    skipped += 1
                    continue
                mu0, phi0 = expected_month(cs.values[i], ti, 36)
                phi = max(1.0, fit.raw_chi2[j] / (36 - 4))
                worst_mu = max(worst_mu, abs(fit.raw_mu[j] - mu0) / mu0)
                worst_phi = max(worst_phi, abs(phi - phi0) / phi0)
                n += 1
    assert n and worst_mu < 1e-6 and worst_phi < 1e-6, (n, worst_mu, worst_phi)
    return {"pairs": n, "not_converged_skipped": skipped, "max_rel_diff_mean": worst_mu, "max_rel_diff_phi": worst_phi}


def check_baselines(ev: sp.Evaluation) -> dict[str, float]:
    """The harness's baselines on the same targets equal the committed rows (6 digits stored)."""
    table = ev.table()
    worst = 0.0
    for name, file in (("persistence", "county-persistence.json"), ("seasonal_naive", "county-seasonal-naive.json")):
        detail = {r["group"]: r for r in json.loads((BASELINES / file).read_text())["detail"]}
        for g in table.index:
            for stat in ("mae", "log"):
                a, b = float(table.loc[g, f"{stat}_{name}"]), float(detail[g][f"{stat}_{name}"])
                diff = abs(a - b) / max(abs(b), 1e-12)  # the committed rows keep 6 significant digits
                worst = max(worst, diff)
                assert diff < 3e-6, (name, g, stat, a, b)
    return {"max_rel_diff": worst}


def diagnostics(fc: GLMForecaster, ev: sp.Evaluation) -> dict:
    """Descriptive extras: share of observed counts inside the 90 % predictive interval, and how often the sparse-window
    rule and the guards were used, over the county series-months of the scoring period."""
    keys, obs = ev.scores.keys, ev.scores.observed
    masks = sp.group_masks(keys)
    rec = [fc.records[t] for t in sp.TARGETS]
    q05, q95 = (np.array([r[name] for r in rec]) for name in ("q05", "q95"))
    status = np.array([r["status"] for r in rec]).astype(int)
    window_mean = np.array([r["window_mean"] for r in rec])
    inside = (obs >= q05) & (obs <= q95)
    out: dict = {"coverage90": {}, "status": {}}
    for g in GROUPS_ORDER:
        m = masks[g][None, :].repeat(len(rec), axis=0)
        big = m & (window_mean >= 5)
        out["coverage90"][g] = {
            "all": float(inside[m].mean()),
            "n_all": int(m.sum()),
            "window_mean_ge5": float(inside[big].mean()) if big.any() else None,
            "n_window_mean_ge5": int(big.sum()),
        }
        out["status"][g] = {name: int((status[m] == code).sum()) for code, name in enumerate(STATUS)}
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------------------------------------------------


def num(v: float, nd: int = 3) -> str:
    return "–" if v is None or not np.isfinite(v) else f"{v:+.{nd}f}"


def skill_text(ev: sp.Evaluation, key: str, nd: int = 3) -> str:
    lo, hi = ev.intervals[key]
    return f"{num(ev.metrics[key], nd)} ({num(lo, nd)} to {num(hi, nd)})"


def paired_difference(a: sp.Evaluation, b: sp.Evaluation, n_boot: int = 1000, seed: int = 2026) -> dict:
    """Descriptive: row a minus row b on the 92 county series, per target month, then the mean and a 95 % bootstrap interval
    over months (seed 2026). Computed from the harness's per-series scores; not a P2 key."""
    m = sp.group_masks(a.scores.keys)["pooled"]
    out = {}
    for name, x, y in (("log_score", a.scores.log_score, b.scores.log_score), ("mae", a.scores.abs_err, b.scores.abs_err)):
        d = x[:, m].mean(axis=1) - y[:, m].mean(axis=1)
        boot = d[np.random.default_rng(seed).integers(0, len(d), size=(n_boot, len(d)))].mean(axis=1)
        out[name] = (float(d.mean()), float(np.percentile(boot, 2.5)), float(np.percentile(boot, 97.5)))
    return out


def spec_text(spec: Spec | dict) -> str:
    return spec.label() if isinstance(spec, Spec) else "; ".join(f"{ph}: {s.label()}" for ph, s in spec.items())


def figure(ev: sp.Evaluation, path: Path) -> None:
    base = json.loads((BASELINES / "county-seasonal-naive.json").read_text())
    bm, bi = base["metrics"]["P2"], base["intervals"]["P2"]

    def entry(group: str) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
        key = "log_skill" if group == "pooled" else f"{group}_log_skill"
        m, (lo, hi) = ev.metrics[key], ev.intervals[key]
        return (m, lo, hi), (bm[key], *bi[key])

    n = {"pooled": ev.n["log_skill"], "national": ev.n["national_log_skill"], **{p: ev.n[f"{p}_log_skill"] for p in PHENOS}}
    fig, (top, bottom) = plt.subplots(2, 1, figsize=(7.6, 4.8), dpi=120, gridspec_kw={"height_ratios": [5, 1.5]})
    fig.patch.set_facecolor("white")
    colours = {"glm": "#1b4f8a", "seasonal": "#b35806"}
    for ax, groups in ((top, ("pooled", *PHENOS)), (bottom, ("national",))):
        ys = np.arange(len(groups))[::-1].astype(float)
        for y, g in zip(ys, groups):
            glm, naive = entry(g)
            for off, (m, lo, hi), colour, marker in ((0.16, glm, colours["glm"], "o"), (-0.16, naive, colours["seasonal"], "s")):
                ax.plot([lo, hi], [y + off, y + off], color=colour, lw=2, solid_capstyle="butt")
                ax.plot([m], [y + off], marker=marker, color=colour, ms=6, mec="white", mew=0.8)
        ax.axvline(0, color="#444444", lw=1)
        ax.set_yticks(ys)
        ax.set_yticklabels([f"{GROUP_LABEL[g]}\nn = {n[g]:,}" for g in groups], fontsize=8.5)
        ax.set_ylim(-0.6, len(groups) - 0.4)
        ax.grid(axis="x", color="#dddddd", lw=0.6)
        ax.set_axisbelow(True)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
        ax.tick_params(axis="x", labelsize=8.5)
    top.plot([], [], "o-", color=colours["glm"], lw=2, label="Poisson GLM, R1")
    top.plot([], [], "s-", color=colours["seasonal"], lw=2, label="Seasonal naive")
    top.legend(loc="lower left", fontsize=8.5, frameon=False)
    top.set_title("One-month-ahead log-score skill against persistence, 2024-10 to 2026-09", fontsize=10, loc="left")
    bottom.set_xlabel("Log-score skill, nats per series-month (right of 0: better than persistence). Bars: 95 % interval.", fontsize=8.5)
    fig.tight_layout()
    fig.savefig(path, format="svg", metadata={"Creator": None, "Date": None}, facecolor="white")
    plt.close(fig)


def write_results(ctx: dict) -> None:
    ev1: sp.Evaluation = ctx["evals"]["R1"]
    cells, pooled, per = ctx["cells"], ctx["pooled"], ctx["per"]
    mean, se, eligible, chosen = ctx["mean"], ctx["se"], ctx["eligible"], ctx["chosen"]
    base_p = json.loads((BASELINES / "county-persistence.json").read_text())
    base_s = json.loads((BASELINES / "county-seasonal-naive.json").read_text())
    L: list[str] = []
    a = L.append
    a("# 0020 results\n")
    a(
        "One-month-ahead forecasts of THL's MRSA, ESBL, VRE and CPE series, 23 counties and the national totals, "
        "scoring targets 2024-10 to 2026-09 (24 months), THL as fetched 2026-10-17 (final values, not strictly as-of; the last two "
        "months are incomplete, see the `no_last2` rows). Every number is computed by this run unless it is labelled as a "
        "committed baseline row.\n"
    )
    a(f"Run time {ctx['wall']:.1f} s (wall)\n")
    a(f"Run time {ctx['cpu']:.1f} s (CPU)\n")

    a("## Tuning, targets 2024-01 to 2024-09 only\n")
    a(
        f"Nine months, 92 county series, {pooled.shape[0]} cells. Mean log score per county series-month on these months: "
        f"persistence {ctx['tune_persistence']:.4f}, seasonal naive {ctx['tune_seasonal']:.4f} (harness baselines, computed).\n"
    )
    a(f"**R1, selected on the pooled county log score:** {chosen.label()}. Tuning score {mean[ctx['i_chosen']]:.4f}; the best cell "
      f"scored {mean.max():.4f} ({cells[int(np.argmax(mean))].label()}); {int(eligible.sum())} of {len(cells)} cells were within one "
      "standard error of the best and eligible.\n")
    a("Top 12 cells by tuning score (full table in `tuning.csv`):\n")
    a("| rank | cell | tuning log score | se of difference to best | eligible |")
    a("|---|---|---|---|---|")
    for r, i in enumerate(np.argsort(-mean, kind="stable")[:12], 1):
        a(f"| {r} | {cells[i].label()} | {mean[i]:.4f} | {se[i]:.4f} | {'yes' if eligible[i] else 'no'} |")
    a("")
    a("Spread of the tuning table: tuning scores of the top 12 cells span "
      f"{mean[np.argsort(-mean, kind='stable')[:12]].min():.4f} to {mean.max():.4f}; the worst of 198 cells scored {mean.min():.4f}.\n")
    a("**R2, one cell per phenotype (same rule on its 23 counties):**\n")
    a("| phenotype | cell | tuning log score | eligible cells |")
    a("|---|---|---|---|")
    for ph in PHENOS:
        c = ctx["per_choice"][ph]
        a(f"| {ph} | {cells[c['i']].label()} | {c['mean'][c['i']]:.4f} | {int(c['eligible'].sum())} |")
    a("")

    a("## R1 on the scoring targets: P2 keys\n")
    a(f"R1 = {chosen.label()}. Intervals: 95 %, 1,000 bootstrap resamples of target months, seed 2026. Skill against "
      "persistence unless named; log-score skill in nats per series-month (higher is better); MAE skill is 1 - MAE / MAE of persistence.\n")
    a("| key | value | 95 % interval | n |")
    a("|---|---|---|---|")
    for k in sp.P2_KEYS:
        v, (lo, hi) = ev1.metrics[k], ev1.intervals[k]
        digits = 4 if k in ("mae", "log_score") else 3
        a(f"| {k} | {v:.{digits}f} | {lo:.{digits}f} to {hi:.{digits}f} | {ev1.n[k]:,} |")
    a("")
    a("### Raw scores against the two baseline rows\n")
    a("MAE of the predictive median and mean log score per series-month, R1 against the harness's persistence and seasonal naive "
      "(equal to the committed baseline rows to 6 digits, checked).\n")
    a("| group | n | MAE R1 | MAE persistence | MAE seasonal naive | log R1 | log persistence | log seasonal naive |")
    a("|---|---|---|---|---|---|---|---|")
    t = ev1.table()
    for g in GROUPS_ORDER:
        r = t.loc[g]
        a(f"| {g} | {int(r['n']):,} | {r['mae_model']:.3f} | {r['mae_persistence']:.3f} | {r['mae_seasonal_naive']:.3f} | "
          f"{r['log_model']:.3f} | {r['log_persistence']:.3f} | {r['log_seasonal_naive']:.3f} |")
    a("")
    a("Seasonal naive's own skill against persistence (committed row, log score): "
      f"pooled {num(base_s['metrics']['P2']['log_skill'])} ({num(base_s['intervals']['P2']['log_skill'][0])} to "
      f"{num(base_s['intervals']['P2']['log_skill'][1])}); persistence's pooled MAE {base_p['metrics']['P2']['mae']:.4f}, log score "
      f"{base_p['metrics']['P2']['log_score']:.4f}.\n")

    a("## Secondary rows (descriptive; none can replace R1)\n")
    a("| row | setting | MAE skill pooled | log skill pooled | log skill without the last 2 months | log skill MRSA | ESBL | VRE | CPE | national |")
    a("|---|---|---|---|---|---|---|---|---|---|")
    for name in ("R1", "R2", "R3", "R4"):
        ev = ctx["evals"][name]
        a(f"| {name} | {spec_text(ctx['specs'][name])} | {skill_text(ev, 'mae_skill')} | {skill_text(ev, 'log_skill')} | "
          f"{skill_text(ev, 'log_skill_no_last2')} | " + " | ".join(num(ev.metrics[f"{p}_log_skill"]) for p in (*PHENOS, "national")) + " |")
    a("")
    a("R3 changes K only (R1's K = 0, or K = 1 if R1 has none); R4 changes the dispersion only (Poisson, or pooled quasi-Poisson if R1 is Poisson). "
      "Per-phenotype MAE skill of R1: " + ", ".join(f"{p} {num(ev1.metrics[f'{p}_mae_skill'])}" for p in (*PHENOS, "national")) + ".\n")

    a("Differences between rows, pooled over the 92 county series (R1 minus the row; mean over the 24 target months, 95 % bootstrap interval over "
      "months, seed 2026; computed here from the harness's per-series scores, not a P2 key). Log score: positive favours R1; MAE: negative favours R1.\n")
    a("| comparison | log score difference | MAE difference |")
    a("|---|---|---|")
    for name in ("R2", "R3", "R4"):
        pd_ = paired_difference(ctx["evals"]["R1"], ctx["evals"][name])
        a(f"| R1 minus {name} | " + " | ".join(f"{num(v[0])} ({num(v[1])} to {num(v[2])})" for v in (pd_["log_score"], pd_["mae"])) + " |")
    a("")
    a("## Diagnostics for R1 (descriptive, not P2 metrics)\n")
    d = ctx["diag"]["R1"]
    a("Share of observed counts inside the 90 % predictive interval [q05, q95] (a discrete interval over-covers when the mean is small; "
      "target about 0.90 for series with a window mean of at least 5 cases a month):\n")
    a("| group | all series-months | n | window mean at least 5 | n |")
    a("|---|---|---|---|---|")
    for g in GROUPS_ORDER:
        c = d["coverage90"][g]
        big = "–" if c["window_mean_ge5"] is None else f"{c['window_mean_ge5']:.3f}"
        a(f"| {g} | {c['all']:.3f} | {c['n_all']:,} | {big} | {c['n_window_mean_ge5']:,} |")
    a("")
    a("Fit status over the series-months (guards and the sparse-window rule; `fit` includes the level-only model when the cell has K = 0 and no trend):\n")
    a("| group | " + " | ".join(STATUS) + " |")
    a("|---|" + "---|" * len(STATUS))
    for g in GROUPS_ORDER:
        a(f"| {g} | " + " | ".join(f"{d['status'][g][s]:,}" for s in STATUS) + " |")
    a("")

    a("The same for R3 (K = 1, no trend, window 24, rho = 0): the only scored row that fits harmonics, so the only one where non-convergence "
      "or the explosion guard can bind:\n")
    d3 = ctx["diag"]["R3"]
    a("| group | " + " | ".join(STATUS) + " |")
    a("|---|" + "---|" * len(STATUS))
    for g in GROUPS_ORDER:
        a(f"| {g} | " + " | ".join(f"{d3['status'][g][s]:,}" for s in STATUS) + " |")
    a("")

    a("## Checks\n")
    c0 = ctx["check_0008"]
    a(f"- Fitter against `aei.regional.expected_month` (statsmodels, W = 36, trend, K = 1), before floor and guards: {c0['pairs']} "
      f"(series, target) pairs with at least 20 cases in the window on the tuning targets ({c0['not_converged_skipped']} skipped as not converged); "
      f"largest relative difference {c0['max_rel_diff_mean']:.1e} in the forecast mean, {c0['max_rel_diff_phi']:.1e} in phi.")
    a(f"- Baseline rows reproduced: largest relative difference to the committed rows {ctx['check_baselines']['max_rel_diff']:.1e} (6 significant digits stored).")
    a("- `audit_strict` (history poisoned from the target on) passed for R1 to R4.")
    a(f"- Mean fits: {ctx['fits']:,} series fitted in total (shared across cells by a cache).")
    (OUT / "results.md").write_text("\n".join(L) + "\n")


def main() -> None:
    clock = harness.Clock()
    OUT.mkdir(exist_ok=True)
    cells = grid()
    cache = FitCache()

    # Stage 1: tuning on targets before 2024-10 only.
    pooled, per = tune(cells, cache)
    i_chosen, mean, se, eligible = select(cells, pooled)
    chosen = cells[i_chosen]
    per_choice = {}
    for ph in PHENOS:
        i, m, s, e = select(cells, per[ph])
        per_choice[ph] = {"i": i, "mean": m, "se": s, "eligible": e}
    spec_r2 = {ph: cells[per_choice[ph]["i"]] for ph in PHENOS}
    tune_persistence = float(sp.run_forecaster(sp.persistence, TUNE_TARGETS).log_score[:, sp.group_masks(sp.county_series().keys)["pooled"]].mean())
    tune_seasonal = float(sp.run_forecaster(sp.seasonal_naive, TUNE_TARGETS).log_score[:, sp.group_masks(sp.county_series().keys)["pooled"]].mean())

    rows = []
    for i, c in enumerate(cells):
        row = {**c.as_dict(), "n_params": c.n_params, "tune_log_score": mean[i], "se_diff_to_best": se[i], "eligible": bool(eligible[i]), "selected": i == i_chosen}
        for ph in PHENOS:
            pc = per_choice[ph]
            row[f"tune_log_score_{ph}"] = pc["mean"][i]
            row[f"selected_{ph}"] = i == pc["i"]
        rows.append(row)
    pd.DataFrame(rows).round(6).to_csv(OUT / "tuning.csv", index=False)
    specs = {"R1": chosen, "R2": spec_r2, "R3": ablation_k(chosen), "R4": ablation_dispersion(chosen)}
    selected = {
        "tuned_on": TUNED_ON,
        "tune_targets": list(TUNE_TARGETS),
        "R1": chosen.as_dict(),
        "R2": {ph: s.as_dict() for ph, s in spec_r2.items()},
        "R3": specs["R3"].as_dict(),
        "R4": specs["R4"].as_dict(),
        "eligible_cells_pooled": int(eligible.sum()),
        "eligible_cells_by_phenotype": {ph: int(per_choice[ph]["eligible"].sum()) for ph in PHENOS},
    }
    (OUT / "selected.json").write_text(json.dumps(selected, indent=2) + "\n")

    # Stage 2: score on 2024-10 to 2026-09 through the harness (audit on).
    evals, forecasters, diag = {}, {}, {}
    for name, spec in specs.items():
        fc = GLMForecaster(spec, cache, record=True)
        evals[name] = sp.evaluate(fc)
        forecasters[name] = fc
        diag[name] = diagnostics(fc, evals[name])
    check_base = check_baselines(evals["R1"])
    check_0008 = check_against_0008()

    # Stage 3: outputs.
    ev1 = evals["R1"]
    figure(ev1, OUT / "skill_by_phenotype.svg")
    ctx = dict(evals=evals, cells=cells, pooled=pooled, per=per, mean=mean, se=se, eligible=eligible, chosen=chosen, i_chosen=i_chosen,
               per_choice=per_choice, specs=specs, diag=diag, check_0008=check_0008, check_baselines=check_base,
               tune_persistence=tune_persistence, tune_seasonal=tune_seasonal, fits=cache.fits, wall=clock.wall, cpu=clock.cpu)
    write_results(ctx)
    harness.write_metrics(
        OUT / "metrics.json",
        experiment="0020-county-forecasts",
        method=(
            "County one-month-ahead forecast: rolling Poisson GLM with annual harmonics per series, negative binomial predictive, "
            f"cell chosen on targets 2024-01 to 2024-09 ({chosen.label()}); 4 phenotypes x 23 counties + national, targets 2024-10 to 2026-09"
        ),
        family="prediction",
        metrics={"P2": ev1.metrics},
        intervals={"P2": ev1.intervals},
        n={"P2": ev1.n},
        runtime_s=clock.wall,
        cpu_s=clock.cpu,
        seeds=[2026],
        tuned_on_test=False,
        tuned_on=TUNED_ON,
        notes=(
            f"THL series as fetched {harness.THL_FETCHED}, final values for every target month, so not strictly as-of; the last two months "
            "(2026-08, 2026-09) are incomplete at fetch time (see the _no_last2 keys). Skill is against persistence unless named. "
            "Bootstrap: 1,000 resamples of target months, seed 2026. The model is deterministic."
        ),
        detail=ev1.table().round(6).reset_index().to_dict(orient="records"),
        selected=selected,
        diagnostics=diag["R1"],
    )


if __name__ == "__main__":
    main()
