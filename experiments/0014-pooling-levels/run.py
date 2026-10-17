"""Experiment 0014: coverage pooled at hospital, inpatient/outpatient, ward class or unit, with and without the onset split,
on C1 to C8 through `aei.score_coverage`. Plan: README.md.

    uv run python experiments/0014-pooling-levels/run.py

Stage 1 scores the eight selectable rows (P and S at four levels) on the TUNE windows only and picks one by the plan's rule.
Stage 2 scores all twelve rows (P, S, F) on the scoring period through `score_estimator`, against both baseline rows and the
replacement rule. Stage 3 runs the plan's checks and writes out/results.md, out/metrics.json (the TUNE-chosen row, through
`aei.harness.write_metrics`), out/grid.json and out/figure.png.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import pooling as pl  # noqa: E402

from aei import harness  # noqa: E402
from aei import score_coverage as sc  # noqa: E402
from aei.dates import add_days  # noqa: E402

OUT = HERE / "out"
BASELINES = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
TUNE_FIRST, TUNE_WINDOWS = "2023-12-25", 10
TUNED_ON = "2023-12-25..2024-09-29"
C1_MARGIN = 0.002  # METRICS.md "Decision rules", proposed
C4_KEYS = ("mild_spectrum", "mild_all", "severe", "mild_spectrum_counted", "mild_all_counted", "severe_counted")
C5_PAIRS = ("Escherichia coli|TMP", "Escherichia coli|CIP", "Escherichia coli|AMP", "Escherichia coli|MEC")
CHECK_VIEWS = ("2024-09-30", "2025-06-16", "2026-03-02")
CONVENTIONS = ("left_out", "counted", "spectrum")
FIGURE_CELL_AS_OF = "2024-10-01"  # a view that sees rows dated up to 2024-09-30 only
FIGURE_AS_OF_START = "2026-09-28"  # the estimate as of 2026-09-27, the last day of the data
SHIPPED_LEVEL_ROW = {"hospital": "H", "ward type": "IO", "unit": "U"}


# --- helpers --------------------------------------------------------------------------------------------------------------


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


def f4(x) -> str:
    return "n/a" if x is None else f"{x:.4f}"


def sd(x, digits: int = 4) -> str:
    return "n/a" if x is None else f"{x:+.{digits}f}"


def ci(iv, signed: bool = False, digits: int = 4) -> str:
    if iv is None:
        return ""
    fmt = (lambda v: sd(v, digits)) if signed else (lambda v: f"{v:.{digits}f}")
    return f"({fmt(iv[0])} to {fmt(iv[1])})"


def days(x) -> str:
    return "not reached" if x is None else str(x)


def pct(x) -> str:
    return "n/a" if x is None else f"{100 * x:.1f} %"


def mark(v) -> str:
    return "n/a" if v is None else ("pass" if v else "fail")


def get(d: dict, *path):
    for p in path:
        if not isinstance(d, dict) or p not in d:
            return None
        d = d[p]
    return d


def with_ci(m: dict, i: dict, key: str, sub: str, signed: bool = False, digits: int = 4) -> str:
    v = get(m, key, sub)
    if v is None:
        return "n/a"
    return f"{sd(v, digits) if signed else f'{v:.{digits}f}'} {ci(get(i, key, sub), signed, digits)}".strip()


# --- stage 1: TUNE --------------------------------------------------------------------------------------------------------


def tune_windows() -> list[tuple[str, str]]:
    out = [(add_days(TUNE_FIRST, 28 * i), add_days(TUNE_FIRST, 28 * i + 27)) for i in range(TUNE_WINDOWS)]
    assert out[-1][1] == "2024-09-29"
    return out


def tune_brier(est: pl.Pooled) -> tuple[float, int]:
    """Brier over the TUNE windows' targets, `left_out`, the harness's target rule (first isolate x suiting antibiotic in
    28-day windows), pooled over all isolate x antibiotic predictions. Used only to choose a row; never reported as C1."""
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


def choose(tune: dict[str, float]) -> str:
    """The plan's rule: the lowest TUNE Brier among the eight selectable rows; exact ties (to 9 decimals) go to the coarser
    level, then to no split."""
    order = {r.name: (pl.LEVELS.index(r.level), r.split) for r in pl.rows()}
    return min(tune, key=lambda name: (round(tune[name], 9), *order[name]))


# --- stage 2: scoring against the shipped row and the replacement rule ------------------------------------------------------


def outbreak_sums(p: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Per target window: squared errors and count over the outbreak unit-months' target pairs (left_out), the parts of C8's C1."""
    T = sc.window_targets()
    y = T.y["left_out"]
    ok = ~np.isnan(y) & T.outbreak
    return np.bincount(T.window[ok], weights=(p[ok] - y[ok]) ** 2, minlength=T.nwin), np.bincount(T.window[ok], minlength=T.nwin).astype(float)


def shipped_parts(run_ship: sc.Run) -> dict:
    nm = len(sc.month_targets().months)
    return {"c4": sc.c4_parts(sc.rank_queries(run_ship, run_ship.month_p()), nm), "c8": outbreak_sums(run_ship.window_p("left_out").p)}


def paired_vs_shipped(run_est: sc.Run, ship: dict) -> dict:
    """Differences to the shipped list with 95 % paired bootstrap intervals (the harness's resamples of months or windows,
    seed 2026): C4's six figures over target months and C8's Brier over target windows, from the harness's own per-month and
    per-window parts. A C4 figure is left out where a row has no top pick that clears in any month."""
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


def rule_lines(m: dict, ship_json: dict, hosp_json: dict, paired: dict) -> dict:
    """The replacement rule of METRICS.md "Decision rules" line by line, C4 and C8 each in two readings (proposed (overnight),
    pending Artem): "points" compares point values (C4: none of the six figures below the shipped row's; C8: C1 below the
    shipped row's); "interval" asks only for what the paired 95 % interval allows (C4: no figure whose interval lies wholly
    below zero; C8: the interval lies wholly below zero). C1: the row's C1 (all cells, `left_out` and `counted`) at most 0.002
    above hospital-365's and above the shipped row's. C3(b) and C7(a) as the harness passes them; `C3b_bb` with the
    Beta-binomial expectation."""
    c1_vs_h = {k: m["C1"][k] - hosp_json["metrics"]["C1"][k] for k in ("all", "all_counted")}
    c1_vs_s = {k: m["C1"][k] - ship_json["metrics"]["C1"][k] for k in ("all", "all_counted")}
    c4 = paired["C4"]
    full = len(c4) == len(C4_KEYS)
    return {
        "C1_vs_hospital": c1_vs_h,
        "C1_vs_shipped": c1_vs_s,
        "C1": all(v <= C1_MARGIN for v in (*c1_vs_h.values(), *c1_vs_s.values())),
        "C4_points": all(v["diff"] >= 0 for v in c4.values()) if full else None,
        "C4_interval": all(v["ci"][1] >= 0 for v in c4.values()) if full else None,
        "C8_points": paired["C8_C1"]["diff"] < 0,
        "C8_interval": paired["C8_C1"]["ci"][1] < 0,
        "C3b": get(m, "C3b", "pass"),
        "C3b_bb": get(m, "C3b_bb", "pass"),
        "C7a": get(m, "C7", "pass_a"),
    }


def passed(rl: dict, reading: str) -> int:
    return sum(rl[k] is True for k in ("C1", f"C4_{reading}", f"C8_{reading}", "C3b", "C7a"))


def under30_shares() -> dict[str, float]:
    """Per level, the share of the 26 windows' isolate x antibiotic predictions (`left_out`, with an outcome) whose own-level
    pool has under 30 results (the unit's own 365-day cell for U)."""
    T = sc.window_targets()
    y = T.y["left_out"]
    ok = ~np.isnan(y)
    num = {lv: 0 for lv in pl.LEVELS}
    for w, (start, end) in enumerate(sc.windows()):
        lo, hi = np.searchsorted(T.window, [w, w + 1])
        view = sc.View(start, end=end)
        sel = ok[lo:hi]
        cells = T.cell[lo:hi][sel]
        for lv in pl.LEVELS:
            n = pl.pooled_counts(view, "left_out", lv)["all"][1].reshape(-1)
            num[lv] += int((n[cells] < 30).sum())
    return {lv: num[lv] / int(ok.sum()) for lv in pl.LEVELS}


# --- stage 3: checks ----------------------------------------------------------------------------------------------------------


def flat(d, prefix=""):
    if isinstance(d, dict):
        for k, v in d.items():
            yield from flat(v, f"{prefix}{k}.")
    elif isinstance(d, (int, float)) and not isinstance(d, bool):
        yield prefix.rstrip("."), float(d)


def max_diff(a: dict, b: dict) -> tuple[float, int, list[str]]:
    fa, fb = dict(flat(clean(a))), dict(flat(clean(b)))
    keys = sorted(set(fa) & set(fb))
    worst = max((abs(fa[k] - fb[k]) for k in keys), default=0.0)
    return worst, len(keys), sorted(set(fa) ^ set(fb))


def run_checks(rows: dict, hosp_json: dict) -> list[tuple[str, str, bool]]:
    out: list[tuple[str, str, bool]] = []
    ph, pu = pl.Pooled("H"), pl.Pooled("U")
    ref_u = sc.estimators_0004()[1][1]
    d_h = d_u = 0.0
    for start in CHECK_VIEWS:
        for conv in CONVENTIONS:
            view = sc.View(start)
            a, b = ph.predict(view, conv), sc.hospital_365.predict(view, conv)
            d_h = max(d_h, max(float(np.abs(a[c].to_numpy() - b[c].to_numpy()).max()) for c in ("p", "a", "b", "n")))
            u, e = pu.predict(view, conv), ref_u.predict(view, conv)
            d_u = max(d_u, float(np.abs(u["p"].to_numpy() - e["p"].to_numpy()).max()))
    out.append(("P-H equals `hospital_365` (p, a, b, n; 3 views x 3 conventions)", f"largest absolute difference {d_h:g}", d_h == 0))
    out.append(("P-U equals `estimators_0004()[1]`, 0004's unit 365-day raw estimator (p; 3 views x 3 conventions)", f"largest absolute difference {d_u:g}", d_u == 0))
    worst, nkeys, odd = max_diff(rows["P-H"]["metrics"], hosp_json["metrics"])
    out.append(("P-H's metrics equal `coverage-hospital-365.json`", f"{nkeys} numbers compared at 6 significant digits, largest difference {worst:g}; keys in one file only: {', '.join(odd) if odd else 'none'}", worst == 0))
    # S equals P on the outpatient units where the pool has results (onset weight 0, community stratum = whole pool)
    outpatient = ~pl.INPATIENT
    worst_p = worst_ab = 0.0
    compared = excluded = 0
    for start in CHECK_VIEWS[1:]:
        for conv in CONVENTIONS:
            view = sc.View(start)
            for lv in ("IO", "WC", "U"):
                s_arr, p_arr = pl.Pooled(lv, True).arrays(view, conv), pl.Pooled(lv).arrays(view, conv)
                n = pl.pooled_counts(view, conv, lv)["all"][1]
                keep = (outpatient[:, None] & (n > 0)).reshape(-1)
                compared += int(keep.sum())
                excluded += int((outpatient[:, None] & (n == 0)).sum())
                worst_p = max(worst_p, float(np.abs(s_arr["p"][keep] - p_arr["p"][keep]).max()))
                worst_ab = max(worst_ab, float(np.abs(s_arr["a"][keep] - p_arr["a"][keep]).max()), float(np.abs(s_arr["b"][keep] - p_arr["b"][keep]).max()))
    out.append(("S equals P at IO, WC, U on the outpatient units (onset weight 0), cells with a non-empty pool", f"{compared} cells compared ({excluded} empty-pool cells left out, where the two fall back differently); largest difference in p {worst_p:g}, in a and b {worst_ab:g}", worst_p < 1e-12 and worst_ab < 1e-9))
    # proportional allocation: with w_s = n_s / n the split equals k / n
    worst_pa = 0.0
    cells_pa = 0
    for start in CHECK_VIEWS[1:]:
        for conv in CONVENTIONS:
            c = pl.unit_counts(sc.View(start), conv)
            (kc, nc), (ko, no), (ka, na) = c["C"], c["O"], c["all"]
            ok = na > 0
            w_o = np.where(ok, no / np.where(ok, na, 1.0), 0.0)
            pc, po = np.where(nc > 0, kc / np.where(nc > 0, nc, 1.0), 0.0), np.where(no > 0, ko / np.where(no > 0, no, 1.0), 0.0)
            p = w_o * po + (1 - w_o) * pc
            worst_pa = max(worst_pa, float(np.abs(p[ok] - ka[ok] / na[ok]).max()))
            cells_pa += int(ok.sum())
    out.append(("with w_s := n_s / n the split equals k / n (unit level, cells with results)", f"{cells_pa} cells, largest absolute difference {worst_pa:.2e}", worst_pa < 1e-12))
    # the matched Beta has the fold's mean and variance where the concentration floor is inactive
    worst_m = worst_v = 0.0
    cells_mb = 0
    for start in CHECK_VIEWS[1:]:
        view = sc.View(start)
        for lv in pl.LEVELS:
            st = pl.strata(view, "left_out", lv)
            w_o, n_unit = pl.onset_weights(view)
            p, a, b = pl.fold(st, w_o, n_unit)
            m, v = pl.fold_moments(st, w_o, n_unit)
            inside = (w_o > 0) & (w_o < 1) & (m > sc.CLIP[0]) & (m < sc.CLIP[1]) & (m * (1 - m) / v - 1 > pl.C_FLOOR)
            mb, vb = a / (a + b), a * b / ((a + b) ** 2 * (a + b + 1))
            worst_m = max(worst_m, float(np.abs(mb[inside] - m[inside]).max()))
            worst_v = max(worst_v, float((np.abs(vb[inside] - v[inside]) / v[inside]).max()))
            cells_mb += int(inside.sum())
            same = w_o <= 0
            assert np.array_equal(a[same], st["C"][1][same]) and np.array_equal(b[same], st["C"][2][same])
    out.append(("the matched Beta of the fold has its mean and variance (cells with 0 < w_O < 1, floor inactive); w_O = 0 returns the stratum's Beta", f"{cells_mb} cells, largest absolute difference in mean {worst_m:.2e}, largest relative difference in variance {worst_v:.2e}", worst_m < 1e-9 and worst_v < 1e-6))
    # F and S agree where the harness asks for cell-level predictions
    agree = []
    for lv in pl.LEVELS:
        s, f = rows[f"S-{lv}"], rows[f"F-{lv}"]
        for key in ("C3b", "C4", "C6", "C7"):
            agree.append(clean(s["metrics"].get(key)) == clean(f["metrics"].get(key)))
        agree.append(clean(get(s["metrics"], "C8", "C4_mild_spectrum")) == clean(get(f["metrics"], "C8", "C4_mild_spectrum")))
        agree.append(clean(get(s["metrics"], "C8", "C4_severe")) == clean(get(f["metrics"], "C8", "C4_severe")))
    out.append(("F and S have identical C3(b), C4, C6, C7 and C8 (C4) at every level", f"{sum(agree)} of {len(agree)} comparisons equal", all(agree)))
    # strict as-of
    bad = []
    for start in CHECK_VIEWS:
        view = sc.View(start)
        for name, frame in (("first_cells", view.first_cells(pl.WINDOW_DAYS)), ("first_isolates", view.first_isolates(pl.WINDOW_DAYS))):
            if len(frame) and not (frame["date"].max() < start and frame["date"].min() >= add_days(start, -pl.WINDOW_DAYS)):
                bad.append(f"{name} at {start}")
    out.append(("every call reads only rows dated before `view.start` and within 365 days of it", f"{len(CHECK_VIEWS)} views, frames' dates checked; violations: {', '.join(bad) if bad else 'none'}", not bad))
    return out


# --- figure -----------------------------------------------------------------------------------------------------------------


def figure_cell() -> tuple[str, str, str]:
    """The unit x specimen x antibiotic with the largest |p_IO - p_H| among unit cells of the list's offered grid with 30 or
    more unit results, from rows dated up to 2024-09-30."""
    view = sc.View(FIGURE_CELL_AS_OF)
    p_h = pl.unsplit(view, "left_out", "H")[0].reshape(-1)
    p_io = pl.unsplit(view, "left_out", "IO")[0].reshape(-1)
    n_u = pl.pooled_counts(view, "left_out", "U")["all"][1].reshape(-1)
    g = sc.OFFERED_GRID.sort_values("cell_id")
    cid = g["cell_id"].to_numpy()
    score = np.where(n_u[cid] >= 30, np.abs(p_io[cid] - p_h[cid]), -1.0)
    i = int(np.argmax(score))
    r = g.iloc[i]
    return str(r["ward"]), str(r["specimen"]), str(r["antibiotic"])


SPECIMEN_FI = {"urine": "virtsa", "blood": "veri", "wound": "haava"}


def figure_ladder(path: Path) -> dict:
    ward, specimen, abx = figure_cell()
    grid = sc.make_grid([(ward, specimen, abx)])
    view = sc.View(FIGURE_AS_OF_START, grid=grid)
    cid = int(grid["cell_id"].iloc[0])
    u, j = cid // pl.M, cid % pl.M
    used = SHIPPED_LEVEL_ROW[str(sc.shipped.predict(view, "left_out")["level"].iloc[0])]
    inpatient = bool(pl.INPATIENT[u])
    names = {"H": "Sairaala\nHospital", "IO": "Vuode- tai avo-osasto\nInpatient or outpatient", "WC": "Osastoluokka\nWard class", "U": "Yksikkö\nUnit"}
    fig, ax = plt.subplots(figsize=(7.5, 4.0), dpi=120)
    fig.patch.set_facecolor("white")
    detail = {}
    ypos = {lv: 3 - i for i, lv in enumerate(pl.LEVELS)}

    def bar(y, k, n, style):
        a, b = k + 0.5, n - k + 0.5
        lo, hi = sc.beta_interval(np.array([a]), np.array([b]), 0.90)
        lo, hi = 100 * float(lo[0]), 100 * float(hi[0])
        ax.plot([lo, hi], [y, y], color=style["color"], lw=style["lw"], solid_capstyle="butt", zorder=2)
        ax.plot([lo, lo], [y - style["tick"], y + style["tick"]], color=style["color"], lw=1.2, zorder=2)
        ax.plot([hi, hi], [y - style["tick"], y + style["tick"]], color=style["color"], lw=1.2, zorder=2)
        return lo, hi

    for lv in pl.LEVELS:
        cnt = pl.pooled_counts(view, "left_out", lv)
        k, n = float(cnt["all"][0][u, j]), float(cnt["all"][1][u, j])
        y = ypos[lv]
        lo, hi = bar(y, k, n, {"color": "#7fa6c9", "lw": 7, "tick": 0.16})
        ax.plot([100 * k / n], [y], "o", color="black", ms=7, zorder=3)
        lines = [f"k {int(k):,} / n {int(n):,}"]
        detail[lv] = {"k": int(k), "n": int(n), "p": k / n, "lo90": lo / 100, "hi90": hi / 100}
        if inpatient:
            for s, dy, marker, fill, tag in (("C", 0.27, "^", "white", "△"), ("O", -0.27, "s", "black", "■")):
                ks, ns = float(cnt[s][0][u, j]), float(cnt[s][1][u, j])
                if ns > 0:
                    bar(y + dy, ks, ns, {"color": "0.35", "lw": 1.6, "tick": 0.08})
                    ax.plot([100 * ks / ns], [y + dy], marker, mfc=fill, mec="black", color="black", ms=5.5, zorder=3)
                    detail[lv][s] = {"k": int(ks), "n": int(ns), "p": ks / ns}
                    lines.append(f"{tag} {int(ks):,} / {int(ns):,}")
        if lv == used:
            lines.append("käytössä / used")
        ax.text(101.5, y, "\n".join(lines), va="center", ha="left", fontsize=7.5, fontweight="bold" if lv == used else "normal", clip_on=False)
    ax.axvline(90, color="black", lw=1, ls=":", zorder=1)
    ax.text(90, 3.62, "raja / threshold 90 %", ha="center", va="bottom", fontsize=7.5)
    ax.set_xlim(0, 100)
    ax.set_ylim(-0.6, 3.9)
    ax.set_yticks([ypos[lv] for lv in pl.LEVELS])
    ax.set_yticklabels([names[lv] for lv in pl.LEVELS], fontsize=8)
    for lbl, lv in zip(ax.get_yticklabels(), pl.LEVELS, strict=True):
        if lv == used:
            lbl.set_fontweight("bold")
    ax.set_xlabel("Kattavuus / Coverage, % (90 % väli / interval)", fontsize=9)
    ax.grid(axis="x", color="0.9", lw=0.6, zorder=0)
    ax.set_axisbelow(True)
    if inpatient:
        ax.plot([], [], "^", mfc="white", mec="black", color="black", ms=5.5, label="yhteisöperäinen / community")
        ax.plot([], [], "s", mfc="black", mec="black", color="black", ms=5.5, label="sairaalaperäinen / hospital onset")
        ax.legend(loc="lower left", fontsize=7, frameon=True, framealpha=0.95)
    else:
        ax.text(2, -0.45, "Ei sairaalaperäisiä (avohoito) / no hospital-onset isolates (outpatient)", fontsize=7.5, va="center")
    ax.set_title(f"{ward} · {SPECIMEN_FI[specimen]} / {specimen} · {abx} · 2026-09-27", fontsize=9.5, pad=10)
    fig.savefig(path, dpi=120, metadata={"Software": None}, facecolor="white", bbox_inches="tight")
    plt.close(fig)
    return {"cell": f"{ward} {specimen} {abx}", "shipped_level": used, "inpatient": inpatient, "levels": detail}


# --- output ---------------------------------------------------------------------------------------------------------------------


def row_label(name: str) -> str:
    kind, lv = name.split("-")
    word = {"P": "unsplit", "S": "split", "F": "split, folded"}[kind]
    return f"{name} ({pl.LEVEL_NAMES[lv]}, {word})"


def main() -> None:
    clock = harness.Clock()
    OUT.mkdir(exist_ok=True)
    hosp_json = json.loads((BASELINES / "coverage-hospital-365.json").read_text())
    ship_json = json.loads((BASELINES / "coverage-shipped.json").read_text())
    all_rows = pl.rows()
    selectable = [r for r in all_rows if r.kind in ("P", "S")]

    # stage 1: TUNE
    tune, tune_n = {}, 0
    for est in selectable:
        tune[est.name], tune_n = tune_brier(est)
    chosen = choose(tune)

    # stage 2: scoring period
    runs, scored = {}, {}
    for est in all_rows:
        run = sc.Run(est)
        metrics, intervals, n = sc.score_estimator(run, verbose=False)
        runs[est.name] = run
        scored[est.name] = {"metrics": metrics, "intervals": intervals, "n": n}
    ship = shipped_parts(sc.Run(sc.shipped))
    for name, run in runs.items():
        scored[name]["paired"] = paired_vs_shipped(run, ship)
        scored[name]["rule"] = rule_lines(scored[name]["metrics"], ship_json, hosp_json, scored[name]["paired"])
    shares = under30_shares()

    # stage 3: checks, figure, files
    checks = run_checks(scored, hosp_json)
    fig = figure_ladder(OUT / "figure.png")
    cpu, wall = clock.cpu, clock.wall

    ch = scored[chosen]
    harness.write_metrics(
        OUT / "metrics.json",
        experiment="0014-pooling-levels",
        method=(
            f"Coverage pooled at one level over the last 365 days of first isolates, row {chosen} ({row_label(chosen)}): p = k/n of the pool, Jeffreys Beta(k + 0.5, n - k + 0.5); "
            "the split rows use the target isolate's own onset stratum on the C1 windows and the strata folded by the unit's onset mix (moment-matched Beta) elsewhere; "
            "row chosen on the TUNE windows 2023-12-25 to 2024-09-29 only (lowest Brier among the eight P and S rows)"
        ),
        family="coverage",
        metrics=ch["metrics"],
        intervals=ch["intervals"],
        n=ch["n"],
        runtime_s=wall,
        cpu_s=cpu,
        seeds=[2026],
        tuned_on_test=False,
        tuned_on=TUNED_ON,
        notes="Chosen row of a 12-row grid (full grid in grid.json, exploratory); no number from the scoring period was used to choose it.",
        row=chosen,
        level=pl.LEVEL_NAMES[chosen.split("-")[1]],
        split=ch_kind(chosen),
    )
    grid = {
        "experiment": "0014-pooling-levels",
        "status": "exploratory: every row was scored on the scoring period 2024-10-01 to 2026-09-27; a row picked from this table was picked on the scoring period and must carry tuned_on_test if promoted",
        "chosen_on_tune": chosen,
        "tuned_on": TUNED_ON,
        "tune_predictions": tune_n,
        "rows": [
            {
                "row": est.name,
                "level": pl.LEVEL_NAMES[est.level],
                "kind": est.kind,
                "tune_brier": tune.get(est.name),
                "under_30_share": shares[est.level],
                "metrics": scored[est.name]["metrics"],
                "intervals": scored[est.name]["intervals"],
                "n": scored[est.name]["n"],
                "paired_vs_shipped": scored[est.name]["paired"],
                "replacement_rule": scored[est.name]["rule"],
            }
            for est in all_rows
        ],
    }
    (OUT / "grid.json").write_text(json.dumps(clean(grid), indent=1, ensure_ascii=False) + "\n")
    write_results(OUT / "results.md", all_rows, scored, tune, tune_n, chosen, shares, checks, fig, hosp_json, ship_json, cpu)
    print(f"chosen on TUNE: {chosen}; CPU {cpu:.1f} s, wall {wall:.1f} s")
    print("checks:", ", ".join(("ok" if ok else "FAILED") for _, _, ok in checks))


def ch_kind(name: str) -> str:
    return {"P": "unsplit", "S": "split by onset", "F": "split by onset, folded"}[name[0]]


def write_results(path, all_rows, scored, tune, tune_n, chosen, shares, checks, fig, hosp_json, ship_json, cpu) -> None:
    L: list[str] = []
    w = L.append
    w("# 0014 results: coverage pooled at hospital, inpatient/outpatient, ward class or unit\n")
    w("Command: `uv run python experiments/0014-pooling-levels/run.py`. Every number is computed by that run unless tagged (measured:")
    w("counted in the data; derived: calculated from numbers here). Deterministic; bootstrap draws are the harness's (seed 2026, 1,000")
    w("resamples of 26 windows or 24 months). Data: synthetic_microbiology_dataset, seed 2026, as received 2026-10-09.\n")
    w(f"Run time {cpu:.1f} s CPU of the 600 s budget.\n")

    w("## Row chosen on TUNE only\n")
    w(f"Ten 28-day windows 2023-12-25 to 2024-09-29, {tune_n:,} isolate x antibiotic predictions, Brier in `left_out` (the isolate-level")
    w("credit for the S rows). Lowest wins, exact ties to the coarser level, then to no split. Never reported as C1.\n")
    w("| row | TUNE Brier | difference to the lowest |")
    w("|---|---|---|")
    lo = min(tune.values())
    for r in all_rows:
        if r.name in tune:
            w(f"| {row_label(r.name)}{' **(chosen)**' if r.name == chosen else ''} | {tune[r.name]:.5f} | {tune[r.name] - lo:+.5f} |")
    w("")

    cm, ci_, cn = scored[chosen]["metrics"], scored[chosen]["intervals"], scored[chosen]["n"]
    hm, hi = hosp_json["metrics"], hosp_json["intervals"]
    sm, si = ship_json["metrics"], ship_json["intervals"]
    w(f"## Metrics: chosen row {chosen} against both baseline rows (95 % bootstrap intervals; 26 windows for C1 to C3(a) and C8 C1, 24 months for C3(b), C4, C7, C8 C4)\n")
    w(f"| metric | {chosen} | hospital-365 | shipped |")
    w("|---|---|---|---|")
    items = [
        ("C1 all", "C1", "all", False), ("C1 small", "C1", "small", False), ("C1 all, counted", "C1", "all_counted", False), ("C1 small, counted", "C1", "small_counted", False),
        ("C1 diff to hospital-365, all", "C1_diff", "all", True), ("C1 diff, small", "C1_diff", "small", True), ("C1 diff, all, counted", "C1_diff", "all_counted", True), ("C1 diff, small, counted", "C1_diff", "small_counted", True),
        ("C2 all", "C2", "all", False), ("C2 diff, all", "C2_diff", "all", True),
        ("C3(a) slope", "C3a", "slope", False), ("C3(a) intercept", "C3a", "intercept", False),
        ("C4 mild, spectrum", "C4", "mild_spectrum", False), ("C4 mild, all organisms", "C4", "mild_all", False), ("C4 severe", "C4", "severe", False),
        ("C4 mild, spectrum, counted", "C4", "mild_spectrum_counted", False), ("C4 mild, all, counted", "C4", "mild_all_counted", False), ("C4 severe, counted", "C4", "severe_counted", False),
        ("C7(a) share inside the 90 % band", "C7", "a", False), ("C7(a) expected under the method's own predictive", "C7", "a_expected", False), ("C7(a) minus expected", "C7", "a_minus_expected", True), ("C7(a), literal", "C7", "a_literal", False), ("C7(b), outbreak unit-months", "C7", "b", False),
        ("C8 C1 (outbreak unit-months)", "C8", "C1", False), ("C8 C1 diff to hospital-365", "C8", "C1_diff", True), ("C8 C4 mild, spectrum", "C8", "C4_mild_spectrum", False), ("C8 C4 severe", "C8", "C4_severe", False),
    ]
    digits = {"C3a": 3, "C7": 3, "C4": 4}
    for label, key, sub, signed in items:
        dg = digits.get(key, 4)
        w(f"| {label} | {with_ci(cm, ci_, key, sub, signed, dg)} | {with_ci(hm, hi, key, sub, signed, dg)} | {with_ci(sm, si, key, sub, signed, dg)} |")
    for label, m in (("C3(b) mild, observed of expected", "mild"), ("C3(b) severe, observed of expected", "severe")):
        def c3b(mm):
            c = mm.get("C3b")
            return "n/a" if not c else f"{c[m + '_obs']} of {c[m + '_exp']:.1f} (ratio {c[m + '_ratio']:.2f}, {'pass' if c['pass'] else 'fail'} overall)"
        w(f"| {label} | {c3b(cm)} | {c3b(hm)} | {c3b(sm)} |")
    c6 = lambda mm: ", ".join(days(get(mm, "C6", k)) for k in ("E1_CRO", "E1_CXM", "E2_CXM"))  # noqa: E731
    w(f"| C6 E1 ceftriaxone, E1 cefuroxime, E2 cefuroxime (days) | {c6(cm)} | {c6(hm)} | {c6(sm)} |")
    w("")
    w(f"n (chosen row): C1 all {cn['C1']['all']:,}; C1 small {cn['C1']['small']:,}; C4 severe picks {cn.get('C4', {}).get('severe', 0):,}; C7(a) blocks {cn['C7']['a']:,}; C8 C1 {cn['C8']['C1']:,}.\n")

    w("## Grid: all twelve rows, exploratory (every row scored on the scoring period)\n")
    w("C1 and C2 as differences to hospital-365, 95 % bootstrap intervals over 26 windows. P unsplit, S split (isolate-level on C1 to C3(a), C5, C8 C1; folded elsewhere), F folded everywhere.\n")
    w("| row | predictions with under 30 results in the pool of their level | C1 diff, all | C1 diff, small | C1 diff, all, counted | C1 diff, small, counted | C2 diff, all |")
    w("|---|---|---|---|---|---|---|")
    for r in all_rows:
        m, i = scored[r.name]["metrics"], scored[r.name]["intervals"]
        w(f"| {r.name} | {pct(shares[r.level])} | {with_ci(m, i, 'C1_diff', 'all', True)} | {with_ci(m, i, 'C1_diff', 'small', True)} | {with_ci(m, i, 'C1_diff', 'all_counted', True)} | {with_ci(m, i, 'C1_diff', 'small_counted', True)} | {with_ci(m, i, 'C2_diff', 'all', True)} |")
    w("")
    w("| row | C3(a) slope, intercept | C3(b) severe obs / exp | C4 mild spectrum | C4 mild all | C4 severe | C4 severe, counted | C7(a) | C7(b) |")
    w("|---|---|---|---|---|---|---|---|---|")
    for r in all_rows:
        m, i = scored[r.name]["metrics"], scored[r.name]["intervals"]
        c3 = m.get("C3b", {})
        w(f"| {r.name} | {m['C3a']['slope']:.3f}, {m['C3a']['intercept']:.3f} | {c3.get('severe_obs')} / {c3.get('severe_exp', float('nan')):.1f} | {f4(get(m, 'C4', 'mild_spectrum'))} | {f4(get(m, 'C4', 'mild_all'))} | {f4(get(m, 'C4', 'severe'))} | {f4(get(m, 'C4', 'severe_counted'))} | {get(m, 'C7', 'a'):.3f} | {get(m, 'C7', 'b'):.3f} |")
    w("")
    w("| row | C8 C1 | C8 C1 diff to hospital-365 | C8 C4 mild spectrum | C8 C4 severe | C6 E1 CRO | C6 E1 CXM | C6 E2 CXM |")
    w("|---|---|---|---|---|---|---|---|")
    for r in all_rows:
        m, i = scored[r.name]["metrics"], scored[r.name]["intervals"]
        w(f"| {r.name} | {with_ci(m, i, 'C8', 'C1')} | {with_ci(m, i, 'C8', 'C1_diff', True)} | {f4(get(m, 'C8', 'C4_mild_spectrum'))} | {f4(get(m, 'C8', 'C4_severe'))} | {days(get(m, 'C6', 'E1_CRO'))} | {days(get(m, 'C6', 'E1_CXM'))} | {days(get(m, 'C6', 'E2_CXM'))} |")
    w("")

    w("### C5: Brier of the pairs where units differ, `left_out` (no interval; the harness gives C5 as a point value)\n")
    w("| row | " + " | ".join(p.replace("Escherichia coli|", "E. coli ") for p in C5_PAIRS) + " |")
    w("|---|" + "---|" * len(C5_PAIRS))
    w("| hospital-365 (baseline) | " + " | ".join(f4(hm["C5"].get(p)) for p in C5_PAIRS) + " |")
    w("| shipped (baseline) | " + " | ".join(f4(sm["C5"].get(p)) for p in C5_PAIRS) + " |")
    for r in all_rows:
        w(f"| {r.name} | " + " | ".join(f4(scored[r.name]["metrics"]["C5"].get(p)) for p in C5_PAIRS) + " |")
    w("")
    w("Difference to hospital-365 for the unsplit rows (negative is better): " + "; ".join(f"{n} {', '.join(f'{p.split(chr(124))[1]} {sd(scored[n]['metrics']['C5'][p] - hm['C5'][p])}' for p in C5_PAIRS)}" for n in ("P-IO", "P-WC", "P-U")) + ".\n")

    w("## Replacement rule, line by line, against the shipped row (readings proposed (overnight), pending Artem)\n")
    w("C1: the row's C1 (all cells, `left_out` and `counted`) at most 0.002 above hospital-365's and above the shipped row's. C4 \"points\": none of the six figures (mild spectrum, mild all, severe; both conventions) below the shipped row's; \"interval\": no figure whose paired 95 % interval lies wholly below zero. C8 \"points\": C8 C1 below the shipped row's; \"interval\": the paired interval lies wholly below zero. C3(b) and C7(a) as the harness passes them (C3(b) with the Beta-binomial expectation beside).\n")
    w("| row | C1 | C4 points | C4 interval | C8 points | C8 interval | C3(b) | C3(b) Beta-binomial | C7(a) | lines passed, points | lines passed, interval |")
    w("|---|---|---|---|---|---|---|---|---|---|---|")
    for r in all_rows:
        rl = scored[r.name]["rule"]
        w(f"| {r.name} | {mark(rl['C1'])} | {mark(rl['C4_points'])} | {mark(rl['C4_interval'])} | {mark(rl['C8_points'])} | {mark(rl['C8_interval'])} | {mark(rl['C3b'])} | {mark(rl['C3b_bb'])} | {mark(rl['C7a'])} | {passed(rl, 'points')} of 5 | {passed(rl, 'interval')} of 5 |")
    w("")
    w("Paired differences to the shipped row (C4 over 24 months, C8 C1 over 26 windows), with 95 % intervals:\n")
    w("| row | C4 mild spectrum | C4 mild all | C4 severe | C4 severe, counted | C8 C1 |")
    w("|---|---|---|---|---|---|")
    for r in all_rows:
        pr = scored[r.name]["paired"]
        c4 = pr["C4"]
        cell = lambda k: f"{sd(c4[k]['diff'])} {ci(c4[k]['ci'], True)}" if k in c4 else "n/a"  # noqa: E731
        w(f"| {r.name} | {cell('mild_spectrum')} | {cell('mild_all')} | {cell('severe')} | {cell('severe_counted')} | {sd(pr['C8_C1']['diff'])} {ci(pr['C8_C1']['ci'], True)} |")
    w("")
    w("C1 of each row minus the shipped row's, all cells (left_out, counted), point values without an interval (the harness bootstraps only against hospital-365):\n")
    w("| row | " + " | ".join(("left_out", "counted")) + " |")
    w("|---|---|---|")
    for r in all_rows:
        rl = scored[r.name]["rule"]
        w(f"| {r.name} | {sd(rl['C1_vs_shipped']['all'])} | {sd(rl['C1_vs_shipped']['all_counted'])} |")
    w("")

    w("## Checks\n")
    w("| check | result | pass |")
    w("|---|---|---|")
    for label, res, ok in checks:
        w(f"| {label} | {res} | {'yes' if ok else 'NO'} |")
    w("")

    w("## The figure\n")
    w(f"`figure.png`: the ladder of pools for {fig['cell']} as of 2026-09-27 (the cell chosen on rows dated up to 2024-09-30). The shipped rule would use the {pl.LEVEL_NAMES[fig['shipped_level']]} pool.\n")
    w("| level | k | n | covered | 90 % interval |")
    w("|---|---|---|---|---|")
    for lv in pl.LEVELS:
        d = fig["levels"][lv]
        w(f"| {pl.LEVEL_NAMES[lv]} | {d['k']:,} | {d['n']:,} | {pct(d['p'])} | {pct(d['lo90'])} to {pct(d['hi90'])} |")
    w("")
    path.write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
