"""Experiment 0012: the discounted Beta-binomial coverage estimator (ENGINE.md 2.2) on C1 to C8. Plan: README.md.

    uv run python experiments/0012-discounted-beta-binomial/run.py

Stage 1 scores the twelve settings (delta x M) on the TUNE windows only (local Brier over the harness's target rule),
chooses one by the plan's rule. Stage 2 scores every setting on the scoring period through `aei.score_coverage`
(`score_estimator`), plus the no-onset-split ablation at the chosen setting and, exploratory, the tracked-prior variant at
delta = 1.0. Stage 3 checks causality and the recursion, and writes out/results.md, out/metrics.json (the chosen setting,
through `aei.harness.write_metrics`), out/grid.json and the two figures.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import discounted_bb as db  # noqa: E402

from aei import harness  # noqa: E402
from aei import score_coverage as sc  # noqa: E402
from aei.dates import add_days  # noqa: E402

OUT = HERE / "out"
BASELINES = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
DELTAS = (0.90, 0.95, 0.98, 1.0)
MS = (10, 30, 100)
SETTINGS = [(d, m) for d in DELTAS for m in MS]
TUNE_FIRST, TUNE_WINDOWS = "2023-12-25", 10
TIE = 0.0005  # plan: ties within 0.0005 of the best TUNE Brier go to the larger delta, then to M = 30
TUNED_ON = "2023-12-25..2024-09-29"
CAUSALITY_CUTS = ["2024-06-16", "2025-07-09", "2026-03-18"]  # a Sunday, a Wednesday and a Wednesday
C1_MARGIN = 0.002  # METRICS.md "Decision rules", proposed
C4_KEYS = ("mild_spectrum", "mild_all", "severe", "mild_spectrum_counted", "mild_all_counted", "severe_counted")


# --- small helpers ------------------------------------------------------------------------------------------------------


def clean(x):
    """JSON-safe, floats to 6 significant digits (as `aei.harness.write_metrics`), so reruns compare equal."""
    if isinstance(x, dict):
        return {str(k): clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [clean(v) for v in x]
    if hasattr(x, "item") and not isinstance(x, (str, bytes)):
        x = x.item()
    if isinstance(x, float):
        return None if not math.isfinite(x) else float(f"{x:.6g}")
    return x


def f4(x: float | None) -> str:
    return "n/a" if x is None else f"{x:.4f}"


def sd(x: float | None, digits: int = 4) -> str:
    return "n/a" if x is None else f"{x:+.{digits}f}"


def ci(iv, signed: bool = False, digits: int = 4) -> str:
    if iv is None:
        return ""
    fmt = sd if signed else (lambda v, digits=digits: f"{v:.{digits}f}")
    return f"({fmt(iv[0], digits)} to {fmt(iv[1], digits)})"


def pct(x: float | None) -> str:
    return "n/a" if x is None else f"{100 * x:.1f} %"


def days(x) -> str:
    return "not reached" if x is None else str(x)


def tune_windows() -> list[tuple[str, str]]:
    out = [(add_days(TUNE_FIRST, 28 * i), add_days(TUNE_FIRST, 28 * i + 27)) for i in range(TUNE_WINDOWS)]
    assert out[-1][1] == "2024-09-29"
    return out


# --- stage 1: TUNE ---------------------------------------------------------------------------------------------------------


def tune_brier(est: object) -> tuple[float, int]:
    """Brier score over the TUNE windows' targets, left_out convention, the harness's target rule (first isolate x suiting
    antibiotic in 28-day windows; first isolate per patient x organism x specimen inside the window), pooled. Used only to
    choose a setting; never reported as C1."""
    num = n = 0.0
    for start, end in tune_windows():
        pred = est.predict(sc.View(start, end=end), "left_out")
        cells = sc.first_isolate_cells(start, end)
        y = cells["y_left_out"].to_numpy()
        if "isolate_id" in pred and "ward" not in pred:
            lookup = pd.Series(pred["p"].to_numpy(dtype=float), index=pred["isolate_id"].astype(str) + "|" + pred["antibiotic"].astype(str))
            p = (cells["isolate_id"].astype(str) + "|" + cells["antibiotic"].astype(str)).map(lookup).to_numpy(dtype=float)
        else:
            p = sc.normalise(pred).p[cells["cell_id"].to_numpy()]
        ok = ~np.isnan(y)
        num += float(((p[ok] - y[ok]) ** 2).sum())
        n += int(ok.sum())
    return num / n, int(n)


def choose(tune: dict[tuple[float, int], float]) -> tuple[tuple[float, int], list[tuple[float, int]]]:
    """The plan's rule: lowest TUNE Brier; settings within 0.0005 of it are tied; the tie goes to the largest delta, then to
    M = 30 if it is among the tied settings of that delta, else to the lowest Brier among them."""
    best = min(tune.values())
    tied = sorted(k for k, v in tune.items() if v <= best + TIE)
    top = max(d for d, _ in tied)
    cands = [k for k in tied if k[0] == top]
    pick = next((k for k in cands if k[1] == 30), None) or min(cands, key=lambda k: tune[k])
    return pick, tied


# --- stage 2: scoring --------------------------------------------------------------------------------------------------------


def score(est: db.DiscountedBB, clock: harness.Clock) -> dict:
    run = sc.Run(est)
    metrics, intervals, n = sc.score_estimator(run, verbose=False)
    return {"run": run, "metrics": metrics, "intervals": intervals, "n": n}


def shipped_parts(run_ship: sc.Run) -> dict:
    """The shipped list's per-month C4 parts and per-window outbreak Brier sums, computed once."""
    nm = len(sc.month_targets().months)
    return {"c4": sc.c4_parts(sc.rank_queries(run_ship, run_ship.month_p()), nm), "c8": outbreak_sums(run_ship.window_p("left_out").p)}


def outbreak_sums(p: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Per target window: squared errors and count over the outbreak unit-months' target pairs (left_out), the parts of C8's C1."""
    T = sc.window_targets()
    y = T.y["left_out"]
    ok = ~np.isnan(y) & T.outbreak
    return np.bincount(T.window[ok], weights=(p[ok] - y[ok]) ** 2, minlength=T.nwin), np.bincount(T.window[ok], minlength=T.nwin).astype(float)


def paired_vs_shipped(run_est: sc.Run, ship: dict) -> dict:
    """Differences to the shipped list with 95 % paired bootstrap intervals (the harness's resamples of months or windows,
    seed 2026): C4's six figures over target months, and C8's Brier over the target windows. Computed from the harness's
    own per-month and per-window parts (`c4_parts`, the same per-window sums as C8); the point values are the harness's.
    A C4 figure is left out where a method has no top pick that clears in any month."""
    nm = len(sc.month_targets().months)
    idx_m = sc.boot_indices(nm)
    pe = sc.c4_parts(sc.rank_queries(run_est, run_est.month_p()), nm)
    out: dict = {"C4": {}, "C8_C1": {}}
    for k in C4_KEYS:
        (ne, de), (ns, ds) = pe[k], ship["c4"][k]
        if de.sum() == 0:
            continue
        point = ne.sum() / de.sum() - ns.sum() / ds.sum()
        with np.errstate(invalid="ignore", divide="ignore"):
            boots = ne[idx_m].sum(axis=1) / de[idx_m].sum(axis=1) - ns[idx_m].sum(axis=1) / ds[idx_m].sum(axis=1)
        out["C4"][k] = {"diff": float(point), "ci": [sc.quantile(boots, 0.025), sc.quantile(boots, 0.975)], "shipped": float(ns.sum() / ds.sum()), "n": int(de.sum()), "n_shipped": int(ds.sum())}
    idx_w = sc.boot_indices(sc.window_targets().nwin)
    (se, n_), (ss, _) = outbreak_sums(run_est.window_p("left_out").p), ship["c8"]
    boots = (se[idx_w].sum(axis=1) - ss[idx_w].sum(axis=1)) / n_[idx_w].sum(axis=1)
    out["C8_C1"] = {"diff": float((se.sum() - ss.sum()) / n_.sum()), "ci": [sc.quantile(boots, 0.025), sc.quantile(boots, 0.975)], "n": int(n_.sum())}
    return out


def rule_lines(m: dict, ship: dict, paired: dict) -> dict[str, bool | None]:
    """The replacement rule of METRICS.md "Decision rules", line by line, each of C4 and C8 in two readings (both proposed
    (overnight), pending Artem): "points" compares point values (C4: none of the six figures below the shipped row's; C8:
    Brier below the shipped row's); "interval" asks only for what the paired 95 % interval allows (C4: no figure whose
    interval lies wholly below zero, so not credibly worse; C8: the interval lies wholly below zero, so credibly better).
    C1: at most 0.002 above hospital-365 (all cells, left_out). C3(b) and C7(a) as the harness passes them; `C3b_bb` is
    C3(b) with the Beta-binomial expectation of METRICS.md's wording, which the harness reports beside its binomial one."""
    c4 = paired["C4"]
    full = len(c4) == len(C4_KEYS)
    return {
        "C1": m["C1_diff"]["all"] <= C1_MARGIN,
        "C4_points": all(v["diff"] >= 0 for v in c4.values()) if full else None,
        "C4_interval": all(v["ci"][1] >= 0 for v in c4.values()) if full else None,
        "C8_points": paired["C8_C1"]["diff"] < 0,
        "C8_interval": paired["C8_C1"]["ci"][1] < 0,
        "C3b": m.get("C3b", {}).get("pass"),
        "C3b_bb": m.get("C3b_bb", {}).get("pass"),
        "C7a": m.get("C7", {}).get("pass_a"),
    }


def passed(rl: dict, reading: str) -> int:
    keys = ["C1", f"C4_{reading}", f"C8_{reading}", "C3b", "C7a"]
    return sum(rl[k] is True for k in keys)


# --- stage 3: output ------------------------------------------------------------------------------------------------------------


def mark(v: bool | None) -> str:
    return "n/a" if v is None else ("pass" if v else "fail")


def setting_name(d: float, m: float, variant: str = "") -> str:
    return f"δ {d:.2f}, M {m:g}" + (f" ({variant})" if variant else "")


def figure_sketch(path: Path, chosen_m: float = 30) -> dict:
    """The right panel of the proposed visualisation: URO urine ceftriaxone, 2025-03 to 2025-09, weekly E[p] with its 90 %
    band for delta 0.90 and 1.0 at M 30, the hospital-365 share, the week's first-isolate counts, the E1 onset."""
    first, last = "2025-03-03", "2025-09-28"
    mondays = [add_days(first, 7 * i) for i in range((db.ordinal(last) - db.ordinal(first)) // 7 + 1)]
    sundays = [add_days(x, 6) for x in mondays]
    series = {}
    for label, est in (("0.90", db.DiscountedBB(0.90, 30)), ("1.0", db.DiscountedBB(1.0, 30)), ("hospital", sc.hospital_365)):
        e = sc.c6_estimates(est, "E1", sundays)
        series[label] = e[e["antibiotic"] == "CRO"].reset_index(drop=True)
    wk = db.weekly()
    cell = sc.cell_id("URO", "urine", "CRO")
    w0 = (db.ordinal(first) - wk.base) // 7
    cov = np.array([wk.S["left_out"][w0 + i, :, cell].sum() for i in range(len(mondays))])
    unc = np.array([wk.R["left_out"][w0 + i, :, cell].sum() for i in range(len(mondays))])
    x_end = pd.to_datetime(sundays)
    x_mid = pd.to_datetime([add_days(x, 3) for x in mondays])
    onset = pd.Timestamp(sc.EVENTS["E1"]["onset"])
    fig, (ax, ax2) = plt.subplots(2, 1, figsize=(8, 5.6), sharex=True, gridspec_kw={"height_ratios": [3, 1.4], "hspace": 0.08}, dpi=120)
    fig.patch.set_facecolor("white")
    s09, s10, sh = series["0.90"], series["1.0"], series["hospital"]
    ax.fill_between(x_end, 100 * s09["lo90"], 100 * s09["hi90"], color="0.82", lw=0, label="90 % väli / interval, δ 0.90")
    ax.fill_between(x_end, 100 * s10["lo90"], 100 * s10["hi90"], facecolor="none", edgecolor="0.35", hatch="////", lw=0, label="90 % väli / interval, δ 1.0")
    ax.plot(x_end, 100 * s09["p"], color="black", lw=2, label="δ 0.90")
    ax.plot(x_end, 100 * s10["p"], color="black", lw=2, ls=":", label="δ 1.0")
    ax.plot(x_end, 100 * sh["p"], color="0.35", lw=1.4, ls="--", label="sairaala 365 vrk / hospital 365 d")
    ax.axvline(onset, color="black", lw=1, ls="-.")
    ax.text(onset, 1.02, "E1 alkaa / onset", transform=ax.get_xaxis_transform(), ha="center", va="bottom", fontsize=8)
    ax.set_ylabel("Kattavuus / coverage (%)")
    ax.set_ylim(50, 92)
    ax.grid(axis="y", color="0.9", lw=0.6)
    ax.legend(loc="lower left", fontsize=7.5, ncol=2, frameon=True, framealpha=0.95)
    ax.set_title("Keftriaksoni / Ceftriaxone, URO, virtsa / urine (M 30)", fontsize=10, pad=16)
    ax2.bar(x_mid, cov, width=5, color="0.25", label="katettu / covered")
    ax2.bar(x_mid, -unc, width=5, facecolor="white", edgecolor="0.25", hatch="////", label="ei katettu / not covered")
    ax2.axhline(0, color="black", lw=0.8)
    ax2.axvline(onset, color="black", lw=1, ls="-.")
    ax2.set_ylabel("Ensi-isolaatit / first isolates\nper viikko / week (n)", fontsize=8)
    ax2.legend(loc="upper left", fontsize=7.5, ncol=2, frameon=True, framealpha=0.95)
    ax2.xaxis.set_major_locator(mdates.MonthLocator())
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%m"))
    ax2.set_xlabel("Kuukausi 2025 / month 2025")
    ax2.set_xlim(pd.Timestamp(first), pd.Timestamp(last))
    ymax = max(cov.max(), unc.max()) + 2
    ax2.set_ylim(-ymax, ymax)
    fig.savefig(path, dpi=120, metadata={"Software": None}, facecolor="white", bbox_inches="tight")
    plt.close(fig)
    return {
        "as_of_end_of_week_before_onset_p": {k: float(series[k]["p"][series[k]["date"] == "2025-05-25"].iloc[0]) for k in series},
        "weeks": len(mondays),
    }


def figure_grid(path: Path, rows: list[dict], chosen: tuple[float, int]) -> None:
    """C1 difference to hospital-365 (all cells and small cells) per setting with 95 % intervals."""
    fig, ax = plt.subplots(figsize=(10.5, 4.8), dpi=110)
    fig.patch.set_facecolor("white")
    xs = np.arange(len(rows))
    for off, key, marker, label in ((-0.12, "all", "o", "kaikki solut / all cells"), (0.12, "small", "s", "pienet solut / small cells")):
        v = np.array([r["metrics"]["C1_diff"][key] for r in rows])
        lo = np.array([r["intervals"]["C1_diff"][key][0] for r in rows])
        hi = np.array([r["intervals"]["C1_diff"][key][1] for r in rows])
        ax.errorbar(xs + off, 1000 * v, yerr=[1000 * (v - lo), 1000 * (hi - v)], fmt=marker, color="black", mfc="black" if key == "all" else "white", capsize=3, lw=1.2, label=label)
    ax.axhline(0, color="black", lw=0.8)
    ax.axhline(1000 * C1_MARGIN, color="0.35", lw=1, ls="--")
    ax.text(len(rows) - 0.5, 1000 * C1_MARGIN, " raja / limit 0.002", va="bottom", ha="right", fontsize=8)
    tags = {"": "", "no onset split": "\nei jakoa\nno split", "tracked prior": "\nseurattu\ntracked"}
    names = [f"{r['delta']:.2f}\nM {r['M']:g}{tags[r['variant']]}" for r in rows]
    ax.set_xticks(xs, names, fontsize=7.5)
    ax.axvline(len(SETTINGS) - 0.5, color="0.6", lw=0.8, ls=":")
    for i, r in enumerate(rows):
        if (r["delta"], r["M"]) == chosen and r["variant"] == "":
            ax.annotate("valittu\nchosen", (i, 1000 * r["metrics"]["C1_diff"]["small"]), textcoords="offset points", xytext=(0, 22), ha="center", fontsize=7.5, arrowprops={"arrowstyle": "-", "lw": 0.8})
    ax.set_ylabel("Brier − sairaala 365 vrk / hospital 365 d (× 0.001)")
    ax.set_xlabel("δ viikossa / per week, M (pseudo-isolaatit / pseudo-isolates)")
    ax.set_title("Tarkkuus 2024-10…2026-09, 163 666 ennustetta / accuracy, 163,666 predictions", fontsize=9.5)
    ax.grid(axis="y", color="0.9", lw=0.6)
    ax.legend(loc="upper left", fontsize=8)
    fig.savefig(path, dpi=110, metadata={"Software": None}, facecolor="white", bbox_inches="tight")
    plt.close(fig)


def check_counts(weeks: list[int]) -> dict:
    """Weekly counts of `discounted_bb.weekly()` against a plain loop over the records (`aei.counting.first_isolates`,
    `aei.eucast.effective_result`) for some ISO weeks: every cell, both strata, both outcomes."""
    from aei.counting import first_isolates
    from aei.dates import days_between
    from aei.eucast import effective_result, suits_specimen

    wk = db.weekly()
    records, _ = harness.data()
    worst, pairs = 0.0, 0
    for w in weeks:
        lo = add_days("2023-10-02", 7 * w)
        hi = add_days(lo, 6)
        want = {c: (np.zeros((2, sc.NCELL)), np.zeros((2, sc.NCELL))) for c in ("left_out", "spectrum")}
        for r in first_isolates(records, (lo, hi)):
            onset = int(r.admission_date is not None and days_between(r.admission_date, r.sample_date) >= 2)
            for a in sc.ANTIBIOTICS:
                if not suits_specimen(a, r.specimen):
                    continue
                e = effective_result(r, a)
                cid = sc.cell_id(r.ward, r.specimen, a)
                for conv, skip in (("left_out", {"untested"}), ("spectrum", {"untested", "no-breakpoint"})):
                    if e.basis in skip:
                        continue
                    want[conv][0 if e.result == "S" else 1][onset, cid] += 1
        for conv in want:
            worst = max(worst, float(np.abs(want[conv][0] - wk.S[conv][w]).max()), float(np.abs(want[conv][1] - wk.R[conv][w]).max()))
            pairs += int((want[conv][0] > 0).sum() + (want[conv][1] > 0).sum())
    return {"weeks": ", ".join(map(str, weeks)), "max_abs_difference": worst, "pairs": pairs}


def check_mixture(chosen: tuple[float, int]) -> tuple[float, float, int]:
    """The moment-matched Beta of `mix_strata` has the mixture's mean and variance (where its concentration is above the
    floor of 1), at the as-of 2025-07-09."""
    est = db.DiscountedBB(*chosen)
    a, b = est.at(db.ordinal("2025-07-09"), "left_out")
    p, pa, pb = db.mix_strata(a, b, est.m)
    n = a + b
    mean = a / n
    var = mean * (1 - mean) / (n + 1)
    neff = n - est.m
    tot = neff.sum(axis=0)
    ok = tot > 1e-9
    w = np.where(ok, neff / np.where(ok, tot, 1.0), 0.0)
    mm = (w * mean).sum(axis=0)
    vv = (w * (var + mean**2)).sum(axis=0) - mm**2
    mb_var = pa * pb / ((pa + pb) ** 2 * (pa + pb + 1))
    sel = ok & (pa + pb > 1.0 + 1e-9)
    return float(np.abs(p - mm)[sel].max()), float(np.abs(mb_var - vv)[sel].max()), int(sel.sum())


def main() -> None:
    clock = harness.Clock()
    OUT.mkdir(exist_ok=True)
    hosp = json.loads((BASELINES / "coverage-hospital-365.json").read_text())
    ship_row = json.loads((BASELINES / "coverage-shipped.json").read_text())

    # Stage 1: choose a setting on TUNE only.
    tune: dict[tuple[float, int], float] = {}
    tune_n = 0
    for d, m in SETTINGS:
        tune[(d, m)], tune_n = tune_brier(db.DiscountedBB(d, m))
    tune_hospital, _ = tune_brier(sc.hospital_365)
    chosen, tied = choose(tune)
    print(f"TUNE: chose delta {chosen[0]}, M {chosen[1]} (tied within {TIE}: {tied})", flush=True)

    # Stage 2: score the grid on the scoring period.
    rows: list[dict] = []
    ship_run = sc.Run(sc.shipped)
    plans = [(d, m, "") for d, m in SETTINGS]
    plans.append((chosen[0], chosen[1], "no onset split"))
    plans += [(1.0, m, "tracked prior") for m in MS]
    ship = shipped_parts(ship_run)
    paired: dict = {}
    for d, m, variant in plans:
        est = db.DiscountedBB(d, m, split=variant != "no onset split", tracked=variant == "tracked prior")
        r = score(est, clock)
        pr = paired_vs_shipped(r["run"], ship)
        row = {"delta": d, "M": m, "variant": variant, "name": est.name, "tune_brier": tune.get((d, m)) if variant == "" else None, "metrics": r["metrics"], "intervals": r["intervals"], "n": r["n"], "paired_vs_shipped": pr, "rule": rule_lines(r["metrics"], ship_row["metrics"], pr)}
        rows.append(row)
        print(f"  {est.name}: C1 diff {r['metrics']['C1_diff']['all']:+.5f}, C6 {r['metrics'].get('C6')}, CPU so far {clock.cpu:.0f} s", flush=True)
    ref_name = "5 unit 365 d shrunk to hospital (M 20)"  # 0004's estimator 5: the unit's year, shrunk to the hospital's, no recency
    ref_m, ref_i, _ = sc.score_estimator(dict(sc.estimators_0004())[ref_name], with_c6=False, extras=False, verbose=False)
    reference = {"name": "0004 estimator " + ref_name, "metrics": {k: ref_m[k] for k in ("C1", "C1_diff", "C2_diff", "C8")}, "intervals": {k: ref_i[k] for k in ("C1_diff", "C2_diff", "C8")}}
    chosen_row = next(r for r in rows if (r["delta"], r["M"]) == chosen and r["variant"] == "")
    paired = chosen_row["paired_vs_shipped"]

    # Stage 3: checks, outputs.
    wk = db.weekly()
    S, R = wk.S["left_out"], wk.R["left_out"]
    p0 = wk.p0("left_out", True)
    cell = sc.cell_id("URO", "urine", "CRO")
    worst = 0.0
    for d, m in ((0.90, 30), (0.95, 10), (0.98, 100)):
        a, b = db.run_filter(S, R, p0, d, m)
        for o in (0, 1):
            naive = db.naive_filter(list(S[:, o, cell]), list(R[:, o, cell]), list(p0[:-1, o, cell]), d, m)
            worst = max(worst, float(np.abs(np.array(naive) - a[1:, o, cell] / (a[1:, o, cell] + b[1:, o, cell])).max()))
    causal = db.causality(chosen[0], chosen[1], CAUSALITY_CUTS) + db.causality(1.0, 10, CAUSALITY_CUTS[:1])
    counts_check = check_counts([0, 70, 130])
    mix_check = check_mixture(chosen)
    ship_check = (
        max(abs(ship["c4"][k][0].sum() / ship["c4"][k][1].sum() - ship_row["metrics"]["C4"][k]) for k in C4_KEYS),
        abs(ship["c8"][0].sum() / ship["c8"][1].sum() - ship_row["metrics"]["C8"]["C1"]),
    )
    base_check = sc.c1_c2_table(sc.hospital_365, "left_out", ("all",), 10)["all"]["brier"]["value"]
    sketch = figure_sketch(OUT / "figure.png")
    figure_grid(OUT / "c1_grid.png", rows, chosen)

    cpu, wall = clock.cpu, clock.wall
    metrics = chosen_row["metrics"]
    harness.write_metrics(
        OUT / "metrics.json",
        experiment="0012-discounted-beta-binomial",
        method=(
            f"Discounted Beta-binomial (ENGINE.md 2.2), delta {chosen[0]} per week, M {chosen[1]}, per unit x specimen x onset x antibiotic, parent: hospital, "
            "same specimen and onset, 52 weeks before, own unit left out, Jeffreys; isolate-level p by the isolate's onset, cell-level Beta by mixing the onset strata "
            "by effective own count; untested results do not enter the filter. Chosen on the TUNE windows 2023-12-25 to 2024-09-29 only"
        ),
        family="coverage",
        metrics=metrics,
        intervals=chosen_row["intervals"],
        n=chosen_row["n"],
        runtime_s=wall,
        cpu_s=cpu,
        seeds=[2026],
        tuned_on_test=False,
        tuned_on=TUNED_ON,
        notes="Chosen setting of a 12-setting grid (full grid in grid.json, exploratory); no number from the scoring period was used to choose it.",
        setting={"delta": chosen[0], "M": chosen[1]},
    )
    grid_doc = {
        "experiment": "0012-discounted-beta-binomial",
        "status": "exploratory: every row was scored on the scoring period 2024-10-01 to 2026-09-27; a row picked from this table was picked on the scoring period and must carry tuned_on_test if promoted",
        "chosen_on_tune": {"delta": chosen[0], "M": chosen[1], "tuned_on": TUNED_ON, "tune_brier": {f"{d}|{m}": v for (d, m), v in tune.items()}, "tune_brier_hospital_365": tune_hospital, "tune_targets": tune_n},
        "reference_row_not_in_plan": reference,
        "rows": [{k: v for k, v in r.items() if k not in ("metrics", "n")} | {"metrics": {k: v for k, v in r["metrics"].items() if k != "C5"}, "n": {k: v for k, v in r["n"].items() if k != "C5"}} for r in rows],
    }
    (OUT / "grid.json").write_text(json.dumps(clean(grid_doc), indent=1, ensure_ascii=False) + "\n")
    write_results(rows, chosen_row, chosen, tied, tune, tune_hospital, tune_n, hosp, ship_row, worst, causal, base_check, ship_check, counts_check, mix_check, reference, sketch, cpu)
    print(f"done: CPU {cpu:.1f} s, wall {wall:.1f} s", flush=True)


def write_results(rows, chosen_row, chosen, tied, tune, tune_hospital, tune_n, hosp, ship_row, worst, causal, base_check, ship_check, counts_check, mix_check, reference, sketch, cpu) -> None:
    hm, hi_, sm, si = hosp["metrics"], hosp["intervals"], ship_row["metrics"], ship_row["intervals"]
    paired = chosen_row["paired_vs_shipped"]
    L: list[str] = []
    add = L.append
    add("# 0012 discounted Beta-binomial: results\n")
    add("All numbers are computed by this run through `aei.score_coverage`, except the two baseline rows, which are the committed rows")
    add("(`benchmarks/overnight-2026-10-17/baselines/coverage-hospital-365.json`, `coverage-shipped.json`, computed by the same harness).")
    add("Intervals are 95 % bootstrap intervals over target windows (C1, C2, C3(a), C8) or target months (C4, C7), 1,000 resamples, seed 2026.")
    add("Exploratory (PROTOCOL.md): every grid row was scored on the scoring period; only the chosen row was chosen without it.\n")
    add(f"Run time {cpu:.1f} s CPU (computed, `aei.harness.Clock`).\n")

    add("## Choosing a setting on the TUNE windows\n")
    add(f"Ten 28-day windows 2023-12-25 to 2024-09-29, {tune_n:,} isolate x antibiotic targets, left_out, local Brier (used only to choose; not C1).")
    add(f"Hospital-365 on the same targets, for reference: {tune_hospital:.4f}.\n")
    add("| δ per week | M 10 | M 30 | M 100 |\n|---|---|---|---|")
    for d in DELTAS:
        add(f"| {d:.2f} | " + " | ".join(f"{tune[(d, m)]:.4f}{' *' if (d, m) == chosen else ''}" for m in MS) + " |")
    add(f"\nBest {min(tune.values()):.4f}; settings within {TIE} of it: " + ", ".join(f"δ {d:.2f} M {m}" for d, m in tied) + f". Chosen by the plan's rule: **δ {chosen[0]:.2f}, M {chosen[1]}** (*).\n")

    main_rows = [r for r in rows if r["variant"] == ""]
    add("## The grid on the scoring period (exploratory)\n")
    add("C1 and C2 as value, then difference to hospital-365 (negative is better) with the 95 % interval of the difference. Hospital-365 and shipped rows first.\n")
    add("| setting | C1 all | C1 diff, all | C1 diff, small | C1 diff, all counted | C2 diff, all |\n|---|---|---|---|---|---|")
    add(f"| hospital 365 d (baseline) | {f4(hm['C1']['all'])} | 0 | 0 | 0 | 0 |")
    add(f"| shipped list | {f4(sm['C1']['all'])} | {sd(sm['C1_diff']['all'])} {ci(si['C1_diff']['all'], True)} | {sd(sm['C1_diff']['small'])} {ci(si['C1_diff']['small'], True)} | {sd(sm['C1_diff']['all_counted'])} {ci(si['C1_diff']['all_counted'], True)} | {sd(sm['C2_diff']['all'])} {ci(si['C2_diff']['all'], True)} |")
    for r in rows:
        m, i = r["metrics"], r["intervals"]
        add(f"| {setting_name(r['delta'], r['M'], r['variant'])} | {f4(m['C1']['all'])} | {sd(m['C1_diff']['all'])} {ci(i['C1_diff']['all'], True)} | {sd(m['C1_diff']['small'])} {ci(i['C1_diff']['small'], True)} | {sd(m['C1_diff']['all_counted'])} {ci(i['C1_diff']['all_counted'], True)} | {sd(m['C2_diff']['all'])} {ci(i['C2_diff']['all'], True)} |")
    add("\nThe `counted` column is worse for every setting because the filter is fitted on tested results only (README, \"Experiment\"), so its share says nothing about the untested part of an antibiotic that is tested on few isolates; hospital-365 in that convention counts untested as not covered.\n")

    add("| setting | C3(a) slope | C3(a) intercept | C3(b) mild obs / exp | C3(b) severe obs / exp | C3(b) | C7(a) | C7(b) | C7(a) literal |\n|---|---|---|---|---|---|---|---|---|")
    for label, m in (("hospital 365 d (baseline)", hm), ("shipped list", sm)):
        add(f"| {label} | {m['C3a']['slope']:.3f} | {m['C3a']['intercept']:+.3f} | {m['C3b']['mild_obs']} / {m['C3b']['mild_exp']:.2f} | {m['C3b']['severe_obs']} / {m['C3b']['severe_exp']:.1f} | {mark(m['C3b']['pass'])} | {m['C7']['a']:.3f} | {m['C7']['b']:.3f} | {m['C7']['a_literal']:.3f} |")
    for r in rows:
        m = r["metrics"]
        add(f"| {setting_name(r['delta'], r['M'], r['variant'])} | {m['C3a']['slope']:.3f} | {m['C3a']['intercept']:+.3f} | {m['C3b']['mild_obs']} / {m['C3b']['mild_exp']:.2f} | {m['C3b']['severe_obs']} / {m['C3b']['severe_exp']:.1f} | {mark(m['C3b']['pass'])} | {m['C7']['a']:.3f} | {m['C7']['b']:.3f} | {m['C7']['a_literal']:.3f} |")
    add("")

    add("| setting | C4 mild spectrum | C4 mild all | C4 severe | C4 mild spectrum counted | C4 mild all counted | C4 severe counted |\n|---|---|---|---|---|---|---|")
    for label, m in (("hospital 365 d (baseline)", hm), ("shipped list", sm)):
        add(f"| {label} | " + " | ".join(pct(m["C4"][k]) for k in C4_KEYS) + " |")
    for r in rows:
        add(f"| {setting_name(r['delta'], r['M'], r['variant'])} | " + " | ".join(pct(r["metrics"]["C4"][k]) for k in C4_KEYS) + " |")
    add("")

    add("| setting | C8 C1 | C8 C1 diff to hospital-365 | C8 C4 mild spectrum | C8 C4 severe | C6 E1 CRO | C6 E1 CXM | C6 E2 CXM |\n|---|---|---|---|---|---|---|---|")
    for label, m, i in (("hospital 365 d (baseline)", hm, hi_), ("shipped list", sm, si)):
        c6 = m["C6"]
        add(f"| {label} | {f4(m['C8']['C1'])} | {sd(m['C8']['C1_diff'])} {ci(i['C8']['C1_diff'], True)} | {pct(m['C8']['C4_mild_spectrum'])} | {pct(m['C8']['C4_severe'])} | {days(c6['E1_CRO'])} | {days(c6['E1_CXM'])} | {days(c6['E2_CXM'])} |")
    for r in rows:
        m, i = r["metrics"], r["intervals"]
        c6 = m.get("C6", {})
        add(f"| {setting_name(r['delta'], r['M'], r['variant'])} | {f4(m['C8']['C1'])} | {sd(m['C8']['C1_diff'])} {ci(i['C8']['C1_diff'], True)} | {pct(m['C8'].get('C4_mild_spectrum'))} | {pct(m['C8'].get('C4_severe'))} | {days(c6.get('E1_CRO'))} | {days(c6.get('E1_CXM'))} | {days(c6.get('E2_CXM'))} |")
    n8 = chosen_row["n"]["C8"]
    add(f"\nC8 (chosen setting) rests on {n8['C1']:,} target isolate x antibiotic pairs (C1), {n8.get('C4_mild_spectrum', 'n/a')} isolates (C4 mild spectrum) and {n8.get('C4_severe', 'n/a')} (C4 severe) in the six outbreak unit-months; \"n/a\" in the C8 C4 columns means no top pick of that setting cleared its bar in any outbreak query-month, so there is nothing to score. C6 is days from the first outbreak isolate (E1 2025-05-30, E2 2026-03-03) until the 90 % interval excludes the estimate of the day before; \"not reached\" is no exclusion within 120 days.\n")

    rm, ri = reference["metrics"], reference["intervals"]
    add(f"Reference, not part of the plan's grid: {reference['name']} (the unit's last 365 days shrunk to the hospital's, no recency): C1 diff to hospital-365 {sd(rm['C1_diff']['all'])} {ci(ri['C1_diff']['all'], True)} (small cells {sd(rm['C1_diff']['small'])} {ci(ri['C1_diff']['small'], True)}); C8 C1 {f4(rm['C8']['C1'])}, diff to hospital-365 {sd(rm['C8']['C1_diff'])} {ci(ri['C8']['C1_diff'], True)}. It has no interval, so no C4, C6 or C7.\n")

    m, i = chosen_row["metrics"], chosen_row["intervals"]
    cn = chosen_row["n"]
    add(f"## The chosen setting, δ {chosen[0]:.2f}, M {chosen[1]}, against the two baseline rows\n")
    add("| | hospital 365 d | shipped list | chosen |\n|---|---|---|---|")
    add(f"| C1, all cells (n {cn['C1']['all']:,}) | {f4(hm['C1']['all'])} {ci(hi_['C1']['all'])} | {f4(sm['C1']['all'])} {ci(si['C1']['all'])} | {f4(m['C1']['all'])} {ci(i['C1']['all'])} |")
    add(f"| C1 diff to hospital-365, all | 0 | {sd(sm['C1_diff']['all'])} {ci(si['C1_diff']['all'], True)} | {sd(m['C1_diff']['all'])} {ci(i['C1_diff']['all'], True)} |")
    add(f"| C1, small cells (n {cn['C1']['small']:,}) | {f4(hm['C1']['small'])} {ci(hi_['C1']['small'])} | {f4(sm['C1']['small'])} {ci(si['C1']['small'])} | {f4(m['C1']['small'])} {ci(i['C1']['small'])} |")
    add(f"| C1 diff, small | 0 | {sd(sm['C1_diff']['small'])} {ci(si['C1_diff']['small'], True)} | {sd(m['C1_diff']['small'])} {ci(i['C1_diff']['small'], True)} |")
    add(f"| C1, all counted | {f4(hm['C1']['all_counted'])} {ci(hi_['C1']['all_counted'])} | {f4(sm['C1']['all_counted'])} {ci(si['C1']['all_counted'])} | {f4(m['C1']['all_counted'])} {ci(i['C1']['all_counted'])} |")
    add(f"| C2, all cells | {f4(hm['C2']['all'])} {ci(hi_['C2']['all'])} | {f4(sm['C2']['all'])} {ci(si['C2']['all'])} | {f4(m['C2']['all'])} {ci(i['C2']['all'])} |")
    add(f"| C2 diff, all | 0 | {sd(sm['C2_diff']['all'])} {ci(si['C2_diff']['all'], True)} | {sd(m['C2_diff']['all'])} {ci(i['C2_diff']['all'], True)} |")
    add(f"| C3(a) slope | {hm['C3a']['slope']:.3f} {ci(hi_['C3a']['slope'], digits=3)} | {sm['C3a']['slope']:.3f} {ci(si['C3a']['slope'], digits=3)} | {m['C3a']['slope']:.3f} {ci(i['C3a']['slope'], digits=3)} |")
    add(f"| C3(a) intercept | {hm['C3a']['intercept']:+.3f} {ci(hi_['C3a']['intercept'], True, 3)} | {sm['C3a']['intercept']:+.3f} {ci(si['C3a']['intercept'], True, 3)} | {m['C3a']['intercept']:+.3f} {ci(i['C3a']['intercept'], True, 3)} |")
    for k in C4_KEYS:
        add(f"| C4 {k.replace('_', ' ')} | {pct(hm['C4'][k])} {ci([100 * x for x in hi_['C4'][k]], digits=1)} | {pct(sm['C4'][k])} {ci([100 * x for x in si['C4'][k]], digits=1)} | {pct(m['C4'][k])} {ci([100 * x for x in i['C4'][k]], digits=1)} |")
    add(f"| C7(a), 90 % predictive interval (blocks {cn['C7']['a']}) | {hm['C7']['a']:.3f} {ci(hi_['C7']['a'], digits=3)} | {sm['C7']['a']:.3f} {ci(si['C7']['a'], digits=3)} | {m['C7']['a']:.3f} {ci(i['C7']['a'], digits=3)} |")
    add(f"| C7(b), outbreak blocks ({cn['C7']['b']}) | {hm['C7']['b']:.3f} | {sm['C7']['b']:.3f} | {m['C7']['b']:.3f} |")
    add(f"| C8 C1 (n {cn['C8']['C1']:,}) | {f4(hm['C8']['C1'])} {ci(hi_['C8']['C1'])} | {f4(sm['C8']['C1'])} {ci(si['C8']['C1'])} | {f4(m['C8']['C1'])} {ci(i['C8']['C1'])} |")
    add(f"| C8 C4 mild spectrum (n {cn['C8'].get('C4_mild_spectrum')}) | {pct(hm['C8']['C4_mild_spectrum'])} | {pct(sm['C8']['C4_mild_spectrum'])} | {pct(m['C8'].get('C4_mild_spectrum'))} |")
    add(f"| C8 C4 severe (n {cn['C8'].get('C4_severe', 'none cleared')}) | {pct(hm['C8']['C4_severe'])} | {pct(sm['C8']['C4_severe'])} | {pct(m['C8'].get('C4_severe'))} |")
    c6 = m.get("C6", {})
    add(f"| C6 days, E1 ceftriaxone | {days(hm['C6']['E1_CRO'])} | {days(sm['C6']['E1_CRO'])} | {days(c6.get('E1_CRO'))} |")
    add(f"| C6 days, E1 cefuroxime | {days(hm['C6']['E1_CXM'])} | {days(sm['C6']['E1_CXM'])} | {days(c6.get('E1_CXM'))} |")
    add(f"| C6 days, E2 cefuroxime | {days(hm['C6']['E2_CXM'])} | {days(sm['C6']['E2_CXM'])} | {days(c6.get('E2_CXM'))} |")
    add("")

    add("### Differences to the shipped list, chosen setting (paired bootstrap, same resamples, seed 2026)\n")
    add("| figure | chosen minus shipped | 95 % interval | shipped | n chosen / shipped |\n|---|---|---|---|---|")
    for k in C4_KEYS:
        p = paired["C4"][k]
        add(f"| C4 {k.replace('_', ' ')} | {sd(100 * p['diff'], 3)} points | {ci([100 * x for x in p['ci']], True, 3)} | {pct(p['shipped'])} | {p['n']:,} / {p['n_shipped']:,} |")
    p = paired["C8_C1"]
    add(f"| C8 C1 (Brier) | {sd(p['diff'])} | {ci(p['ci'], True)} | {f4(sm['C8']['C1'])} | {p['n']:,} |")
    add("")

    add("## Replacement rule of METRICS.md \"Decision rules\", chosen setting, line by line\n")
    rl = chosen_row["rule"]
    add("\"Not worse\" and \"better\" are read two ways, both proposed (overnight), pending Artem: by point values, and by what the paired 95 % interval allows (C4 not credibly worse: no figure whose interval lies wholly below zero; C8 credibly better: the interval lies wholly below zero).\n")
    add("| line | criterion | chosen | reference | verdict |\n|---|---|---|---|---|")
    add(f"| C1 within 0.002 | C1 diff to hospital-365, all cells, left_out, at most +0.002 | {sd(m['C1_diff']['all'])} {ci(i['C1_diff']['all'], True)} | limit +0.0020 | {mark(rl['C1'])} |")
    c4_txt = "; ".join(f"{k.replace('_', ' ')} {sd(100 * paired['C4'][k]['diff'], 3)}" for k in C4_KEYS if k in paired["C4"])
    add(f"| C4 not worse, both untested conventions, by points | none of the six figures below the shipped row | {c4_txt} (points) | shipped row | {mark(rl['C4_points'])} |")
    add(f"| C4 not worse, by interval | no paired interval wholly below zero | lowest upper bound {sd(100 * min(v['ci'][1] for v in paired['C4'].values()), 3)} points | shipped row | {mark(rl['C4_interval'])} |")
    add(f"| C8 better, by points | C8 Brier below the shipped row's | {f4(m['C8']['C1'])}, diff {sd(paired['C8_C1']['diff'])} | shipped {f4(sm['C8']['C1'])} | {mark(rl['C8_points'])} |")
    add(f"| C8 better, by interval | paired interval wholly below zero | {ci(paired['C8_C1']['ci'], True)} | shipped {f4(sm['C8']['C1'])} | {mark(rl['C8_interval'])} |")
    add(f"| C3(b) passes (binomial expectation, the harness's, as 0010) | obs / exp at most 1.5 for mild and severe | severe {m['C3b']['severe_obs']} / {m['C3b']['severe_exp']:.1f} = {m['C3b']['severe_ratio']:.2f}; mild {m['C3b']['mild_obs']} / {m['C3b']['mild_exp']:.2f} | shipped severe 23 / 19.6 = 1.17 | {mark(rl['C3b'])} |")
    bb = m["C3b_bb"]
    add(f"| C3(b) with the Beta-binomial expectation (METRICS.md's wording), beside it | same | severe {bb['severe_obs']} / {bb['severe_exp']:.1f} = {bb['severe_ratio']:.2f}; mild {bb['mild_obs']} / {bb['mild_exp']:.2f} | shipped severe 23 / 21.3 = 1.08 | {mark(rl['C3b_bb'])} |")
    add(f"| C7(a) passes | share inside 0.85 to 0.95 (proposed band) | {m['C7']['a']:.3f} {ci(i['C7']['a'], digits=3)} | shipped {sm['C7']['a']:.3f} | {mark(rl['C7a'])} |")
    add(f"\nLines passed: {passed(rl, 'points')} of 5 by points, {passed(rl, 'interval')} of 5 by interval. All five pass: **{'yes' if passed(rl, 'points') == 5 else 'no'}** by points, **{'yes' if passed(rl, 'interval') == 5 else 'no'}** by interval. C6 beside it: E1 ceftriaxone {days(c6.get('E1_CRO'))}, E1 cefuroxime {days(c6.get('E1_CXM'))}, E2 cefuroxime {days(c6.get('E2_CXM'))}.\n")

    add("### The same lines for every row of the grid (exploratory; every row was scored on the scoring period)\n")
    add("| setting | C1 | C4 points | C4 interval | C8 points | C8 interval | C3(b) | C3(b) Beta-binomial | C7(a) | passed, points | passed, interval |\n|---|---|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        rr = r["rule"]
        add(f"| {setting_name(r['delta'], r['M'], r['variant'])} | {mark(rr['C1'])} | {mark(rr['C4_points'])} | {mark(rr['C4_interval'])} | {mark(rr['C8_points'])} | {mark(rr['C8_interval'])} | {mark(rr['C3b'])} | {mark(rr['C3b_bb'])} | {mark(rr['C7a'])} | {passed(rr, 'points')} of 5 | {passed(rr, 'interval')} of 5 |")
    add("")

    add("## Checks\n")
    add(f"- Recursion: the vectorised filter equals a plain Python loop of the formula on URO urine ceftriaxone for three settings; largest absolute difference in E[p] {worst:.1e} (computed).")
    add("- Causality: the estimate for a target starting the day after a cut date, from a table truncated at the cut, against the full table (largest absolute difference of a and b over all cells, both strata, both outcomes): " + "; ".join(f"{c['cut']} {c['max_abs_difference']:.1e}" for c in causal[:3]) + f"; δ 1.0, M 10 at {causal[3]['cut']}: {causal[3]['max_abs_difference']:.1e} (computed).")
    add(f"- Baseline: hospital-365 C1 all cells recomputed here {base_check:.6f}; committed row {hm['C1']['all']:.6f} (computed).")
    add(f"- Weekly counts: the first-isolate covered and not covered counts of weeks {counts_check['weeks']} (all cells, both strata, both outcomes) equal a plain loop over `aei.counting.first_isolates` and `aei.eucast.effective_result`; largest absolute difference {counts_check['max_abs_difference']:.0f}, {counts_check['pairs']:,} non-zero cell counts compared (computed).")
    add(f"- Mixture: for the as-of 2025-07-09 the moment-matched Beta has the mixture's mean and variance; largest absolute differences {mix_check[0]:.1e} (mean) and {mix_check[1]:.1e} (variance), over the {mix_check[2]} cells whose weights come from the effective counts and whose concentration is above the floor of 1 (computed).")
    add(f"- Shipped row: the per-month C4 parts and per-window C8 sums used for the paired differences reproduce the committed row's C4 (largest difference {ship_check[0]:.1e}) and C8 C1 (difference {ship_check[1]:.1e}) (computed).")
    add("")
    add("## Figures\n")
    add("- `figure.png`: the proposed visualisation's sparkline for URO urine ceftriaxone, weekly estimate and 90 % interval for δ 0.90 and δ 1.0 at M 30, the hospital-365 share, the week's first-isolate counts, the E1 onset.")
    add("- `c1_grid.png`: C1 difference to hospital-365, all cells and small cells, per setting with 95 % intervals.")
    (OUT / "results.md").write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
