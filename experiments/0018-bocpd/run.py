"""Experiment 0018: Bayesian online change-point detection on weekly counts and weekly %R, scored on D1 to D7 and I1.
Plan: README.md. From the repository root:

    uv run python experiments/0018-bocpd/run.py

Stage 1 scores the eight settings (hazard H x width w) on the tuning year only (`aei.score_detection.tune_curve`: 40 rare and 40
common ESBL E. coli clusters of 4 injected 2024-04-01 to 2024-08-15, noise over 2024-04-01 to 2024-09-30) and chooses a setting and
level by the plan's rule. Stage 2 scores the chosen setting on the scoring period through `aei.score_detection.score_detector`
for three rows (counts, rates, both), D7 a second way, every setting of the grid (exploratory) and four looser levels
(exploratory). Stage 3 checks causality, the trial path against the unfocused run, run-length pruning and the series, then writes
out/results.md, out/metrics.json (the combined row), out/metrics-counts.json, out/metrics-rates.json, out/grid.json and the figures.
The filter is in bocpd.py.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import bocpd  # noqa: E402

from aei import harness, inject  # noqa: E402
from aei import score_detection as sd  # noqa: E402
from aei.coverage import wilson  # noqa: E402
from aei.jscompat import mulberry32  # noqa: E402

OUT = HERE / "out"
BASELINES = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
HAZARDS = (1 / 26, 1 / 52, 1 / 104, 1 / 208)
WIDTHS = (2, 4)
GRID = [(h, w) for h in HAZARDS for w in WIDTHS]
NOISE_LIMIT = 5.0
PARTS = ("D1", "D2", "D4", "D5", "D6", "D7", "I1")  # D3 left out: the detector has no data signals (plan)
CUTS = ["2025-03-31", "2025-12-31", "2026-06-30"]  # a Monday, a Wednesday and a Tuesday
TUNED_ON = "2024-04-01..2024-09-30"
CARD = {"unit": "URO", "series": ("URO", "ph", "esbl"), "asof": "2025-06-15", "onset": "2025-05-30", "from": "2024-11-04", "to": "2025-07-06"}


def hname(h: float) -> str:
    return f"1/{round(1 / h)}"


def clean(x):
    """JSON-safe, floats to 6 significant digits (as `aei.harness.write_metrics`), so reruns compare equal."""
    if isinstance(x, dict):
        return {str(k): clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [clean(v) for v in x]
    if hasattr(x, "item") and not isinstance(x, (str, bytes)):
        x = x.item()
    if isinstance(x, float):
        return None if x != x or x in (float("inf"), float("-inf")) else float(f"{x:.6g}")
    return x


def pct(x, d=1):
    return "none" if x is None else f"{100 * x:.{d}f} %"


def pct_iv(x, iv):
    return f"{pct(x)} ({100 * iv[0]:.0f} to {100 * iv[1]:.0f})"


def num(x, d=1):
    return "none" if x is None else f"{x:.{d}f}"


# ---------- stage 1: the tuning year ----------


def choose(rows_by_setting: dict) -> dict:
    """The plan's rule: per setting the loosest level with at most 5 episodes a year; then the highest rare rate, ties by the
    common ESBL rate, then fewer episodes, then the smaller H (then the smaller w, not in the plan)."""
    cands = []
    for (h, w), rows in rows_by_setting.items():
        ok = [r for r in rows if r["noise_per_year"] <= NOISE_LIMIT]
        if ok:
            r = ok[0]
            cands.append(((r["rare_hit"], r["common_esbl_hit"], -r["noise_per_year"], -h, -w), h, w, r))
    best = max(cands, key=lambda c: c[0])
    ties = [c for c in cands if c[0][:4] == best[0][:4]]
    return {"H": best[1], "w": best[2], "row": best[3], "tied_on_all_but_w": len(ties) > 1}


# ---------- stage 2: scoring ----------


def score_row(records, cultures, part: str, h: float, w: int, level: float, levels=bocpd.LEVELS, parts=PARTS, **kw):
    det = bocpd.make_detector(h, w, part, levels=levels, default_level=level)
    signals = det.run(records, cultures, None)
    m, iv, n, ex = sd.score_detector(det, records=records, cultures=cultures, full_signals=signals, parts=parts, verbose=False, **kw)
    ex.pop("cpu_by_part", None)
    return det, signals, m, iv, n, ex


def d7_as_cluster(records, cultures, part: str, h: float, w: int, level: float, signals):
    det = bocpd.make_detector(h, w, part, rate_kind="cluster", default_level=level)
    m, iv, n, ex = sd.score_detector(det, records=records, cultures=cultures, full_signals=signals, parts=("D7",), level=level, verbose=False)
    return {"share": m["D7"], "interval": iv.get("D7"), "n": n["D7"], "detail": ex["D7_detail"]}


SCALES = (4.0, 16.0)


def ablation(records, cultures) -> list[dict]:
    """Exploratory, not in the plan: the counts prior's mean multiplied by c (the plan's prior is Gamma(1, rate 1/m), mean m,
    an exponential that puts little mass on a segment at 10 or 20 times the unit's usual rate). For each c the setting and level
    are chosen on the tuning year by the plan's rule and the chosen row is scored (rare and common ESBL families only)."""
    out = []
    for c in SCALES:
        tun = {}
        for h, w in GRID:
            det = bocpd.make_detector(h, w, "both", levels=bocpd.LEVELS, scale=c)
            tun[(h, w)] = sd.tune_curve(det, records, cultures, noise_kinds=None)
        pick = choose(tun)
        h, w, L = pick["H"], pick["w"], pick["row"]["level"]
        res = {"scale": c, "H": h, "w": w, "level": L, "tuning_row": pick["row"], "parts": {}}
        for part in ("both", "count", "rate"):
            det = bocpd.make_detector(h, w, part, levels=bocpd.LEVELS, default_level=L, scale=c)
            m, iv, n, ex = sd.score_detector(det, records=records, cultures=cultures, families=("rare", "common_esbl"), parts=("D2", "D4", "D5"), verbose=False)
            res["parts"][part] = {
                "D2_rare_k4": m["D2"]["rare_k4"],
                "D2_common_esbl_k4": m["D2"]["common_esbl_k4"],
                "D2_intervals": {k: iv["D2"][k] for k in ("rare_k4", "common_esbl_k4")},
                "D2_rare_k0": m["D2"]["rare_k0"],
                "D4": m["D4"],
                "D4_counts": n["D4"],
                "D5": m["D5"],
                "D5_interval": iv["D5"],
                "D5_whole_tool": whole_tool_headline(ex["D5_curve"]),
            }
        out.append(res)
        print(f"[0018] ablation prior mean x{c:g}: H = {hname(h)}, w = {w}, p < {L}")
    return out


def blocks_of_40(records, cultures, rows: dict, level: float) -> dict:
    """The plan's spread: D2 at k = 4 for the rare and common ESBL families in the five consecutive blocks of 40 of the 200 trials."""
    out = {}
    for part in ("both", "count", "rate"):
        det = rows[part]["det"]
        hits = sd.run_trials(det, records, cultures, (2026,), ("rare", "common_esbl"), sd.KS, 200, ())[2026]
        accept = sd.accept_fn(det, level)
        out[part] = {fam: [sum(t.detected(accept) for t in hits[fam][4][i : i + 40]) for i in range(0, 200, 40)] for fam in ("rare", "common_esbl")}
    return out


def whole_tool_headline(curve: list[dict]) -> dict:
    """D5's headline read on the whole tool's noise (counts and %R episodes), derived from the same curve."""
    row = next((r for r in curve if r["whole_tool"] <= NOISE_LIMIT), curve[-1])
    return {k: row.get(k) for k in ("level", "whole_tool", "rare", "rare_hit", "rare_delay", "common_esbl", "common_esbl_hit", "common_esbl_delay")}


# ---------- stage 3: checks ----------


def check_trial_path(records, cultures, h: float, w: int) -> list[dict]:
    """The focused trial path against the unfocused run on the same rows, for a few trials of the harness's streams."""
    base = inject.base_of(records, cultures)
    seen: list = []

    def run_fn(r, c, f):
        seen.append((r, c, f))
        return [s for s in bocpd.signals_for(r, c, f, h)[w]]

    spy = sd.Detector(name="spy", run_fn=run_fn, levels=bocpd.LEVELS, kind_fn=lambda s: "cluster")
    rand = mulberry32(2026)
    trials = []
    for t in range(3):
        trials.append(inject.rare_hits(spy, base, rand, 4, t))
    for t in range(2):
        trials.append(inject.common_hits(spy, base, rand, "common_esbl", 4, ("ED", "PHC-N", "PHC-S"), 10 + t, "large"))
    trials.append(inject.two_unit_hits(spy, base, rand, 4, 20))
    trials.append(inject.gap_hits(spy, base, rand, 5, False, 21))
    trials.append(inject.gap_hits(spy, base, rand, 7, True, 22))
    out = []
    for (r, c, f), tr in zip(seen, trials, strict=True):
        full = bocpd.FullRun(r, c, h, ws=(w,)).signals[w]
        sel = [s for s in full if sd.ward_in(s.ward, f.units) and f.start <= s.date <= f.end]
        if f.organism is not None:
            sel = [s for s in sel if s.organism == f.organism or (s.phenotype is not None and s.phenotype in f.phenotypes)]
        foc = [s for s in bocpd.signals_for(r, c, f, h)[w] if f.start <= s.date <= f.end]
        ka = sorted((s.date, s.key, s.p) for s in sel)
        kb = sorted((s.date, s.key, s.p) for s in foc)
        same = [x[:2] for x in ka] == [x[:2] for x in kb] and all(abs(x[2] - y[2]) < 1e-9 for x, y in zip(ka, kb, strict=True))
        out.append({"family": tr.family, "units": "+".join(f.units), "start": f.start, "signals_full": len(ka), "signals_focused": len(kb), "same": same})
    return out


def pruning_check(records, cultures) -> list[dict]:
    """Does dropping run lengths below 1e-4 posterior (and renormalising) change any signal date, over the whole data?"""
    rows = []
    for h in HAZARDS:
        exact = bocpd.full_run(records, cultures, h)
        pruned = bocpd.full_run(records, cultures, h, prune=1e-4)
        for w in WIDTHS:
            a = {(s.date, s.key): s.p for s in exact.signals[w]}
            b = {(s.date, s.key): s.p for s in pruned.signals[w]}
            common = set(a) & set(b)
            rows.append(
                {
                    "H": h,
                    "w": w,
                    "signals_exact": len(a),
                    "signals_pruned": len(b),
                    "only_exact": len(set(a) - set(b)),
                    "only_pruned": len(set(b) - set(a)),
                    "max_abs_dp": max((abs(a[k] - b[k]) for k in common), default=0.0),
                }
            )
    return rows


def data_checks(records) -> dict:
    com = bocpd.common()
    obs = com.obs
    weeks = obs.n_weeks

    def weekly(series):
        return obs.dy[bocpd.C_INDEX[series]].reshape(-1, 7).sum(1)

    def rate_n(unit, org, ab):
        i = next(j for j, p in enumerate(bocpd.PAIRS) if p.organism == org and p.antibiotic == ab)
        return obs.dn[bocpd.R_INDEX[(unit, i)]].reshape(-1, 7).sum(1)

    out = {
        "count_series": len(bocpd.COUNT_SERIES),
        "rate_series": len(bocpd.RATE_SERIES),
        "weeks": weeks,
        "anchor": bocpd.iso(obs.anchor),
        "last_day": bocpd.iso(obs.anchor + obs.last_abs),
        "events_total": int(obs.dy.sum()),
        "rate_results_total": int(obs.dn.sum()),
        "rate_R_total": int(obs.dr.sum()),
        "organisms_in_data": sorted({r.organism for r in records}) == sorted(bocpd.ORGANISMS),
    }
    for unit in ("URO", "ED", "ICU"):
        out[f"{unit}_esbl_per_week"] = float(weekly((unit, "ph", "esbl")).mean())
    mrsa = weekly(("ICU", "ph", "mrsa"))
    out["ICU_mrsa_per_week"] = float(mrsa.mean())
    out["ICU_mrsa_zero_weeks"] = float((mrsa == 0).mean())
    for unit in ("PHC-N", "PHC-S", "URO", "ICU"):
        out[f"{unit}_ecoli_cro_per_week"] = float(rate_n(unit, "Escherichia coli", "CRO").mean())
    a0, b0 = obs.prior[0], obs.prior[1]
    out["prior_mean_URO_esbl"] = float(1 / b0[bocpd.C_INDEX[("URO", "ph", "esbl")]])
    out["prior_mean_ICU_mrsa"] = float(1 / b0[bocpd.C_INDEX[("ICU", "ph", "mrsa")]])
    out["prior_mean_floor_series"] = int((np.isclose(1 / b0, bocpd.RATE_FLOOR)).sum())
    pair = next(j for j, p in enumerate(bocpd.PAIRS) if p.organism == "Escherichia coli" and p.antibiotic == "CRO")
    A0, B0 = obs.prior[2], obs.prior[3]
    out["prior_share_URO_ecoli_cro"] = float(A0[bocpd.R_INDEX[("URO", pair)]] / (A0[bocpd.R_INDEX[("URO", pair)]] + B0[bocpd.R_INDEX[("URO", pair)]]))
    return out


# ---------- the report ----------


def load_baseline(name: str) -> dict:
    return json.loads((BASELINES / f"{name}.json").read_text())


def d2_cell(m, iv, key, delay=True):
    d = m["D2_delay"].get(key) if "D2_delay" in m else None
    s = pct_iv(m["D2"][key], iv["D2"][key])
    return s + (f", {d} d" if delay and d is not None else "")


def table(header: list[str], rows: list[list[str]]) -> str:
    lines = ["| " + " | ".join(header) + " |", "|" + "|".join(["---"] * len(header)) + "|"]
    lines += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(lines) + "\n"


def figure_card(h: float, w: int, level: float, signals, path: Path) -> dict:
    """The card of the proposed visualisation, drawn for E1 (URO, ESBL) at the chosen setting."""
    series = CARD["series"]
    anchor = bocpd.common().obs.anchor

    def week_of(day):
        return (bocpd.ordinal(day) - anchor) // 7

    def mon(j):
        return bocpd.iso(anchor + 7 * j)

    w0, w1 = week_of(CARD["from"]), week_of(CARD["to"])
    T_asof = (bocpd.ordinal(CARD["asof"]) - anchor + 1) // 7
    tr = bocpd.trace(h, w, series, range(w0 + 1, w1 + 2))
    post = bocpd.change_posterior(h, w, series, T_asof)
    fig = plt.figure(figsize=(9.2, 5.6), dpi=110)
    gs = fig.add_gridspec(2, 1, height_ratios=[3.2, 1.1], hspace=0.12, left=0.08, right=0.97, top=0.80, bottom=0.12)
    ax, st = fig.add_subplot(gs[0]), fig.add_subplot(gs[1], sharex=None)
    weeks = [t - 1 for t in tr["week"]]
    x0 = [mdates.date2num(bocpd.date.fromisoformat(mon(j))) for j in weeks]
    xend = x0[-1] + 7
    ax.bar(x0, tr["count"], width=6.6, align="edge", color="#b8b8b8", edgecolor="#8a8a8a", linewidth=0.5, label="Potilaita viikossa / Patients per week (count)")
    xs = np.array(x0 + [xend])
    ax.fill_between(xs, np.array(tr["lo"] + [tr["lo"][-1]]), np.array(tr["hi"] + [tr["hi"][-1]]), step="post", color="#3a3a3a", alpha=0.18, linewidth=0, label="80 % väli / 80 % band")
    ax.step(xs, np.array(tr["mean"] + [tr["mean"][-1]]), where="post", color="#202020", linewidth=1.6, label="Suodatettu viikkotaso / Filtered weekly rate")
    mode_x = mdates.date2num(bocpd.date.fromisoformat(mon(post["mode_week"])))
    lo_x = mdates.date2num(bocpd.date.fromisoformat(mon(post["lo_week"])))
    hi_x = mdates.date2num(bocpd.date.fromisoformat(mon(post["hi_week"]))) + 7
    top = max(tr["count"]) * 1.18 + 0.5
    ax.axvline(mode_x, color="#202020", linestyle=(0, (5, 2)), linewidth=1.1)
    ax.annotate("", xy=(lo_x, top * 0.96), xytext=(hi_x, top * 0.96), arrowprops=dict(arrowstyle="|-|,widthA=0.4,widthB=0.4", color="#202020", linewidth=1.0))
    ax.text((lo_x + hi_x) / 2, top * 0.99, "muutoksen päivä, 80 % väli / change date, 80 % interval", ha="center", va="bottom", fontsize=7)
    asof_x = mdates.date2num(bocpd.date.fromisoformat(CARD["asof"])) + 1
    ax.axvline(asof_x, color="#606060", linewidth=1.0)
    onset_x = mdates.date2num(bocpd.date.fromisoformat(CARD["onset"]))
    ax.axvline(onset_x, color="#8a8a8a", linewidth=0.9, linestyle=":")
    ax.text(onset_x - 2, top * 0.72, "alku / onset 30.5.2025", fontsize=7, ha="right", va="center")
    def e1_match(s):  # D1's matcher for E1: URO, E. coli or ESBL, from the onset to 2025-08-31
        return s.ward == CARD["unit"] and CARD["onset"] <= s.date <= "2025-08-31" and (s.organism == "Escherichia coli" or s.phenotype == "esbl")

    first = next((s for s in signals if e1_match(s) and sd_pass(s, level)), None)
    loosest = next((s for s in signals if e1_match(s)), None)
    if first is not None:
        fx = mdates.date2num(bocpd.date.fromisoformat(first.date))
        ax.plot([fx], [top * 0.08], marker="^", color="#202020", markersize=7, linestyle="none", label=f"Ensimmäinen hälytys / First signal {first.date} (p < {level:g})")
    else:
        ax.plot([], [], linestyle="none", label=f"Ei hälytystä tasolla p < {level:g} / no signal at p < {level:g}")
    if loosest is not None and (first is None or loosest.date != first.date):
        lx = mdates.date2num(bocpd.date.fromisoformat(loosest.date))
        ax.plot([lx], [top * 0.08], marker="^", markerfacecolor="white", markeredgecolor="#202020", markersize=7, linestyle="none", label=f"Löyhin taso / loosest level (p < 0.9): {loosest.date}")
    ax.set_ylim(0, top)
    ax.set_xlim(x0[0], xend)
    ax.set_ylabel("Potilasta viikossa\nPatients per week")
    ax.tick_params(labelbottom=False)
    ax.legend(loc="upper left", fontsize=6.5, frameon=False, ncol=1)
    # strip
    mm = np.array(tr["m"])
    st.fill_between(xs, np.append(mm, mm[-1]), step="post", color="#8c8c8c", linewidth=0)
    st.axhline(1 - level, color="#202020", linestyle=(0, (4, 2)), linewidth=1.0)
    st.text(xs[1], 1 - level + 0.04, f"hälytystaso / alert level {1 - level:.2f}", fontsize=6.5, va="bottom")
    st.axvline(asof_x, color="#606060", linewidth=1.0)
    st.text(asof_x - 2, 0.82, "tilanne / as of 15.6.2025", fontsize=7, ha="right", va="center")
    st.set_ylim(0, 1.05)
    st.set_xlim(x0[0], xend)
    st.set_ylabel("m_t\nmuutos /\nchange", fontsize=7.5)
    st.xaxis.set_major_locator(mdates.MonthLocator())
    st.xaxis.set_major_formatter(mdates.DateFormatter("%m/%y"))
    st.set_xlabel("Viikon alku (kk/vv) / Week start (month/year); 35 viikkoa / weeks")
    for a in (ax, st):
        a.spines[["top", "right"]].set_visible(False)
    iso_wk = bocpd.date.fromisoformat(mon(post["mode_week"])).isocalendar()[1]
    d = bocpd.date.fromisoformat(mon(post["mode_week"]))
    fig.text(
        0.08,
        0.965,
        f"ESBL · Urologia / Urology — muutos todennäköisesti viikolla {iso_wk} ({d.day}.{d.month}.) / change most likely in week {iso_wk} ({d.day} {d.strftime('%B')})",
        fontsize=9.2,
        weight="bold",
        va="top",
    )
    fig.text(
        0.08,
        0.905,
        f"{post['now_mean']:.1f} potilasta viikossa, ennen {post['before_mean']:.1f} / {post['now_mean']:.1f} patients a week, before {post['before_mean']:.1f} · "
        f"todennäköisyys {post['m']:.2f} / probability {post['m']:.2f}",
        fontsize=8.4,
        va="top",
    )
    fig.text(
        0.08,
        0.855,
        f"H = {hname(h)}, w = {w}; tilanne viikon 15.6.2025 lopussa / state at the end of the week of 15 June 2025; m_t = P(muutos {w} viikon sisällä / change within {w} weeks)",
        fontsize=6.8,
        va="top",
        color="#404040",
    )
    fig.savefig(path, dpi=110, metadata={"Software": None})
    plt.close(fig)
    return {"post": post, "first_signal": None if first is None else first.date, "loosest_signal": None if loosest is None else loosest.date, "T_asof": T_asof}


def sd_pass(s, level):
    return s.p is not None and s.p < level


def figure_d5(curves: dict, baselines: dict, path: Path):
    """Detection at k = 4 against the whole tool's noise (episodes a year, all kinds), one panel per family; BOCPD at every level of the
    extended grid (hollow: the four exploratory looser levels), the live rows at theirs."""
    fig, axes = plt.subplots(1, 2, figsize=(9.4, 4.4), dpi=110, sharey=True)
    styles = {"both": ("-", "o", "#202020"), "count": ("--", "s", "#505050"), "rate": (":", "^", "#707070")}
    labels = {"both": "BOCPD laskennat + osuudet / counts + %R", "count": "BOCPD laskennat / counts", "rate": "BOCPD osuudet / %R"}
    loose = set(bocpd.LEVELS_EXT) - set(bocpd.LEVELS)
    for ax, fam, title in zip(axes, ("rare", "common_esbl"), ("Harvinainen profiili / Rare profile", "Yleinen ESBL E. coli / Common ESBL E. coli"), strict=True):
        for part in ("both", "count", "rate"):
            curve = curves[part]
            xs = [r["whole_tool"] for r in curve]
            ys = [r[fam] for r in curve]
            ls, mk, col = styles[part]
            ax.plot(xs, ys, linestyle=ls, color=col, linewidth=1.2, label=labels[part])
            for r in curve:
                filled = r["level"] not in loose
                ax.plot([r["whole_tool"]], [r[fam]], marker=mk, markersize=4.5, color=col, markerfacecolor=col if filled else "white", linestyle="none")
            if part == "both":
                lo = [wilson(r[f"{fam}_hit"], r[f"{fam}_n"])[0] for r in curve]
                hi = [wilson(r[f"{fam}_hit"], r[f"{fam}_n"])[1] for r in curve]
                ax.fill_between(xs, lo, hi, color="#202020", alpha=0.12, linewidth=0)
        for name, (ls, mk, lab, col) in {
            "live-set-retuned-year1": ("-", "D", "Elävä sarja, viritetty / Live set, re-tuned", "#7a7a7a"),
            "live-set-shipped": ("-.", "x", "Elävä sarja, nykyinen / Live set, shipped", "#a8a8a8"),
        }.items():
            curve = baselines[name]["D5_curve"]
            ax.plot([r["whole_tool"] for r in curve], [r[fam] for r in curve], linestyle=ls, marker=mk, color=col, markersize=4.5, linewidth=1.1, label=lab)
        ax.axvline(NOISE_LIMIT, color="#a0a0a0", linestyle=(0, (2, 2)), linewidth=0.9)
        ax.set_xlim(-0.5, 20)
        ax.set_ylim(0, 1.02)
        ax.set_xlabel("Jaksoja vuodessa / Episodes a year (D4, whole tool)")
        ax.set_title(title, fontsize=9)
        ax.spines[["top", "right"]].set_visible(False)
    axes[0].set_ylabel("Löydetty / Detected, k = 4")
    axes[0].legend(fontsize=6.5, frameon=False, loc="center right", bbox_to_anchor=(1.0, 0.55))
    fig.text(
        0.5,
        0.01,
        "200 trials a point, band 95 % Wilson (counts + %R); katkoviiva / dashed line: 5 jaksoa vuodessa / 5 episodes a year; BOCPD points beyond 20 a year are off the axis",
        ha="center",
        fontsize=7,
        color="#404040",
    )
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig(path, dpi=110, metadata={"Software": None})
    plt.close(fig)


def main() -> None:
    clock = harness.Clock()
    OUT.mkdir(exist_ok=True)
    records, cultures = harness.data()
    live_re = load_baseline("live-set-retuned-year1")
    live_sh = load_baseline("live-set-shipped")

    # stage 1: tuning year (one run of every setting at the extended levels; the plan's levels are the last nine of them)
    tuning: dict = {}
    for h, w in GRID:
        det = bocpd.make_detector(h, w, "both", levels=bocpd.LEVELS_EXT)
        tuning[(h, w)] = sd.tune_curve(det, records, cultures, noise_kinds=None)
    plan_rows = {k: [r for r in v if r["level"] <= 0.5] for k, v in tuning.items()}
    pick = choose(plan_rows)
    h, w, L = pick["H"], pick["w"], pick["row"]["level"]
    pick_ext = choose(tuning)
    print(f"[0018] chosen on the tuning year: H = {hname(h)}, w = {w}, level p < {L}; extended levels: H = {hname(pick_ext['H'])}, w = {pick_ext['w']}, level p < {pick_ext['row']['level']}")

    # stage 2: the three rows at the chosen setting
    rows: dict = {}
    for part in ("both", "count", "rate"):
        det, signals, m, iv, n, ex = score_row(records, cultures, part, h, w, L)
        rows[part] = {"det": det, "signals": signals, "m": m, "iv": iv, "n": n, "ex": ex}
        rows[part]["d7_cluster"] = d7_as_cluster(records, cultures, part, h, w, L, signals) if part != "count" else None
        print(f"[0018] row {part}: D5 headline {m['D5']}")
    blocks = blocks_of_40(records, cultures, rows, L)
    print(f"[0018] CPU {clock.cpu:.0f} s after the three rows; filter runs {bocpd.STATS}")

    # exploratory: every setting of the grid at its own tuning level (families rare and common ESBL only), three rows each
    grid = []
    for (gh, gw), rws in tuning.items():
        prow = [r for r in rws if r["level"] <= 0.5]
        ok = [r for r in prow if r["noise_per_year"] <= NOISE_LIMIT]
        glevel = ok[0]["level"] if ok else prow[-1]["level"]
        entry = {"H": gh, "w": gw, "tuning_level": glevel, "tuning_row": next(r for r in rws if r["level"] == glevel), "parts": {}}
        for part in ("both", "count", "rate"):
            det = bocpd.make_detector(gh, gw, part, levels=bocpd.LEVELS, default_level=glevel)
            gm, giv, gn, gex = sd.score_detector(det, records=records, cultures=cultures, families=("rare", "common_esbl"), parts=("D2", "D4", "D5"), verbose=False)
            entry["parts"][part] = {
                "D2_rare_k4": gm["D2"]["rare_k4"],
                "D2_common_esbl_k4": gm["D2"]["common_esbl_k4"],
                "D2_intervals": {k: giv["D2"][k] for k in ("rare_k4", "common_esbl_k4")},
                "D4": gm["D4"],
                "D4_counts": gn["D4"],
                "D5": gm["D5"],
                "D5_interval": giv["D5"],
                "D5_whole_tool": whole_tool_headline(gex["D5_curve"]),
            }
        grid.append(entry)
    ext = {}
    for part in ("both", "count", "rate"):
        det = bocpd.make_detector(h, w, part, levels=bocpd.LEVELS_EXT, default_level=L)
        em, eiv, en, eex = sd.score_detector(det, records=records, cultures=cultures, families=("rare", "common_esbl"), parts=("D2", "D4", "D5"), verbose=False)
        ext[part] = {"D5": em["D5"], "D5_interval": eiv["D5"], "curve": eex["D5_curve"], "whole_tool": whole_tool_headline(eex["D5_curve"])}
    ext_choice = {"H": pick_ext["H"], "w": pick_ext["w"], "level": pick_ext["row"]["level"], "tune_row": pick_ext["row"]}
    abl = ablation(records, cultures)
    print(f"[0018] CPU {clock.cpu:.0f} s after the grid and the extended levels")

    # stage 3: checks
    both = rows["both"]
    problems = sd.check_causal(both["det"], CUTS, records, cultures, raise_on_error=False)
    trial_check = check_trial_path(records, cultures, h, w)
    prune = pruning_check(records, cultures)
    chosen_prune = {}
    for part_w in (w,):
        a = {(x.date, x.key) for x in bocpd.full_run(records, cultures, h).signals[part_w] if x.p < L}
        b = {(x.date, x.key) for x in bocpd.full_run(records, cultures, h, prune=1e-4).signals[part_w] if x.p < L}
        chosen_prune = {"H": h, "w": part_w, "level": L, "signals_exact": len(a), "signals_pruned": len(b), "only_exact": len(a - b), "only_pruned": len(b - a)}
    prune = [*prune, {"chosen": chosen_prune}]
    dchk = data_checks(records)
    e4 = [s for s in both["signals"] if s.detector == bocpd.RATE and s.organism == "Escherichia coli" and s.antibiotic == "TMP" and sd_pass(s, L)]
    if problems:
        print("[0018] NOT CAUSAL:\n" + "\n".join(problems))
    assert not problems, "the detector is not causal"
    assert all(t["same"] for t in trial_check), "the trial path differs from the unfocused run"

    # figures
    card = figure_card(h, w, L, both["signals"], OUT / "figure.png")
    figure_d5({p: ext[p]["curve"] for p in ext}, {"live-set-retuned-year1": live_re, "live-set-shipped": live_sh}, OUT / "d5_curve.png")

    wall, cpu = clock.wall, clock.cpu
    setting = {"H": h, "w": w, "level": L, "prior": "counts Gamma(1, rate 1/m); rates Beta(2 pi0, 2 (1 - pi0)); first 26 weeks"}
    for part, name, label in (("both", "metrics.json", "counts and %R"), ("count", "metrics-counts.json", "counts"), ("rate", "metrics-rates.json", "%R")):
        r = rows[part]
        extra = dict(r["ex"])
        extra["setting"] = setting
        extra["tuning_table"] = {f"H={hname(gh)},w={gw}": rws for (gh, gw), rws in tuning.items()}
        if part != "count":
            extra["D7_rates_as_cluster"] = {k: r["d7_cluster"][k] for k in ("share", "interval", "n")}
        extra["D5_whole_tool_noise"] = whole_tool_headline(r["ex"]["D5_curve"])
        extra["D2_blocks_of_40_k4"] = blocks[part]
        harness.write_metrics(
            OUT / name,
            experiment="0018-bocpd" if part == "both" else f"0018-bocpd-{part}",
            method=f"Bayesian online change-point detection (Adams and MacKay 2007), {label}, H = {hname(h)}, w = {w}, p < {L}",
            family="detection",
            metrics=r["m"],
            intervals=r["iv"],
            n=r["n"],
            runtime_s=wall,
            cpu_s=cpu,
            seeds=list(sd.SEEDS_SCREEN),
            tuned_on_test=False,
            tuned_on=TUNED_ON,
            notes=(
                "Chosen on the tuning year only (40 rare and 40 common ESBL E. coli clusters of 4, 2024-04-01 to 2024-08-15, seed 2026; "
                "noise 2024-04-01 to 2024-09-30). p = 1 - m_t is a monotone score of the posterior probability of a recent change, not a "
                "p-value. %R signals are named divergence (D7 beside it with %R named cluster). Screening seed 2026 only."
            ),
            **extra,
        )
    (OUT / "grid.json").write_text(
        json.dumps(
            clean(
                {
                    "note": "exploratory: every setting scored on the scoring period at the level its tuning-year rule gives; a row picked from here was picked on the scoring period",
                    "settings": grid,
                    "extended_levels": {"chosen_on_tuning_year": ext_choice, "at_the_plan_setting": ext},
                    "prior_mean_ablation": abl,
                    "tuning": {f"H={hname(gh)},w={gw}": rws for (gh, gw), rws in tuning.items()},
                    "pruning": prune,
                    "trial_path_check": trial_check,
                    "data_checks": dchk,
                }
            ),
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )
    write_results(clock, pick, pick_ext, tuning, rows, grid, ext, ext_choice, abl, blocks, prune, trial_check, dchk, card, e4, live_re, live_sh, problems)
    print(f"[0018] done, CPU {cpu:.0f} s, wall {wall:.0f} s; filter runs {bocpd.STATS}")


def write_results(clock, pick, pick_ext, tuning, rows, grid, ext, ext_choice, abl, blocks, prune, trial_check, dchk, card, e4, live_re, live_sh, problems) -> None:
    h, w, L = pick["H"], pick["w"], pick["row"]["level"]
    both = rows["both"]
    out: list[str] = []
    add = out.append
    add("# 0018 BOCPD: results\n")
    add(f"Run time {clock.cpu:.1f} s (CPU; computed, `aei.harness.Clock`; informational, the budget is 10 minutes).\n")
    add(
        "Tags: every number is **computed** by this run through `aei.score_detection` unless marked **measured** (counted in the data), "
        "**derived** (arithmetic on computed numbers) or **assumed** (a stated proposal). Baseline rows are the committed "
        "`baselines/live-set-*.json`, computed by the same harness. Screening seed 2026 only, 200 trials per cell; intervals are 95 % "
        "Wilson (rates) and exact Poisson (episodes a year). `tuned_on_test` is false for the chosen setting.\n"
    )
    # series and data
    add("## Series, priors and checks\n")
    add(
        f"Count series {dchk['count_series']} and rate series {dchk['rate_series']} (measured); {dchk['weeks']} weeks from {dchk['anchor']} to {dchk['last_day']}; "
        f"{dchk['events_total']:,} count events, {dchk['rate_results_total']:,} rate results of which {dchk['rate_R_total']:,} R (measured). "
        f"ESBL patients a week: URO {dchk['URO_esbl_per_week']:.2f}, ED {dchk['ED_esbl_per_week']:.2f}, ICU {dchk['ICU_esbl_per_week']:.2f}; ICU MRSA "
        f"{dchk['ICU_mrsa_per_week']:.2f} a week with {100 * dchk['ICU_mrsa_zero_weeks']:.0f} % zero weeks; *E. coli* ceftriaxone results a week: PHC-N "
        f"{dchk['PHC-N_ecoli_cro_per_week']:.1f}, PHC-S {dchk['PHC-S_ecoli_cro_per_week']:.1f}, URO {dchk['URO_ecoli_cro_per_week']:.1f}, ICU "
        f"{dchk['ICU_ecoli_cro_per_week']:.1f} (measured, first isolates per series within 365 days; the plan's figures count distinct patients per week). "
        f"Priors from the first 26 weeks: URO ESBL mean {dchk['prior_mean_URO_esbl']:.3f} a week, ICU MRSA {dchk['prior_mean_ICU_mrsa']:.3f}; "
        f"{dchk['prior_mean_floor_series']} of 117 count series sit on the 0.02 floor; URO *E. coli* ceftriaxone R share prior {dchk['prior_share_URO_ecoli_cro']:.3f} (computed).\n"
    )
    add("Checks (computed): ")
    add(f"`check_causal` on {', '.join(CUTS)}: {'no differences' if not problems else 'DIFFERENCES: ' + '; '.join(problems)}. ")
    n_same = sum(t["same"] for t in trial_check)
    add(
        f"Trial path (cached states before the trial's week, rows from the trial's week) against the unfocused run on the same rows, "
        f"{len(trial_check)} trials (3 rare, 2 common ESBL, 1 two-unit, 2 gaps): {n_same} of {len(trial_check)} identical (dates, keys, p within 1e-9). "
        f"Filter runs and cache hits: {bocpd.STATS['focused']} focused trials, {bocpd.STATS['fallback']} fallbacks to the full run.\n"
    )
    add("**Pruning run lengths below 1e-4 posterior** (computed; whole data, signals at the loosest level p < 0.9, exact against pruned):\n")
    add(
        table(
            ["H", "w", "signals exact", "signals pruned", "only in exact", "only in pruned", "max abs change of p"],
            [[hname(p["H"]), p["w"], p["signals_exact"], p["signals_pruned"], p["only_exact"], p["only_pruned"], f"{p['max_abs_dp']:.2e}"] for p in prune if "chosen" not in p],
        )
    )
    cp = next(p for p in prune if "chosen" in p)["chosen"]
    add(
        f"At the chosen setting and level (H = {hname(cp['H'])}, w = {cp['w']}, p < {cp['level']:g}): {cp['signals_exact']} signals exact, {cp['signals_pruned']} pruned, "
        f"{cp['only_exact']} only in the exact run, {cp['only_pruned']} only in the pruned run (computed). The signal dates are therefore "
        f"{'unchanged' if not (cp['only_exact'] or cp['only_pruned']) else 'changed for some signals'} at the operating level; at the loosest level some signals appear or vanish where p sits near 0.9.\n"
    )
    # tuning
    add("## Choice on the tuning year\n")
    add(
        "Injected clusters of 4 (40 rare, 40 common ESBL *E. coli*, seed 2026, starts 2024-04-01 to 2024-08-15) and real-data noise over "
        "2024-04-01 to 2024-09-30 scaled to a year, all episodes (counts and %R, fixed key); the detector saw no data after 2024-09-30. "
        "One episode in the half year is 2.0 a year (derived), so the noise column moves in steps of 2.\n"
    )
    for label, key, fmt in (("Noise, episodes a year (computed)", "noise_per_year", "{:.0f}"), ("Rare clusters detected of 40 (computed)", "rare_hit", "{}"), ("Common ESBL *E. coli* clusters detected of 40 (computed)", "common_esbl_hit", "{}")):
        add(f"**{label}**; levels p < the column head, the plan's nine first and the four looser exploratory ones in front:\n")
        levels = [r["level"] for r in next(iter(tuning.values()))]
        add(table(["H, w"] + [f"{lv:g}" for lv in levels], [[f"{hname(gh)}, {gw}"] + [fmt.format(r[key]) for r in rws] for (gh, gw), rws in tuning.items()]))
    r = pick["row"]
    add(
        f"**Chosen (plan's levels): H = {hname(h)}, w = {w}, level p < {L:g}** (noise {r['noise_per_year']:.0f} a year, rare {r['rare_hit']} of 40, common ESBL {r['common_esbl_hit']} of 40; "
        f"{'tied with another setting on every criterion but w' if pick['tied_on_all_but_w'] else 'no tie'}). The parts (counts, %R) use the same setting and level. "
        f"With the four looser levels the rule would choose H = {hname(ext_choice['H'])}, w = {ext_choice['w']}, p < {ext_choice['level']:g} (exploratory, below).\n"
    )
    # headline
    live_d5 = {"live set, re-tuned on year 1": live_re, "live set, as shipped (tuned on test)": live_sh}
    add("## Headline: D5 at the loosest level with at most 5 episodes a year\n")
    add(
        "D5 reads D2 at k = 4 at the loosest level of the method's own grid whose noise (D4 over cluster and sentinel signals only, "
        "harness-spec Choices 3) is at most 5 episodes a year. %R signals are named divergence, so they do not count in that noise; the "
        "last columns read the same curve on the whole tool's noise (counts and %R episodes, derived from `D5_curve`).\n"
    )
    hl = []
    years = sd.score_years()
    for part, label in (("both", "BOCPD counts and %R"), ("count", "BOCPD counts"), ("rate", "BOCPD %R")):
        m, iv, n = rows[part]["m"], rows[part]["iv"], rows[part]["n"]
        d5 = m["D5"]
        nz = sd.poisson_interval(n["D5"]["noise"], years)
        wt = whole_tool_headline(rows[part]["ex"]["D5_curve"])
        hl.append(
            [
                label,
                f"p < {d5['level']:g}",
                f"{d5['noise']:.1f} ({nz[0]:.1f} to {nz[1]:.1f})",
                pct_iv(d5["rare"], iv["D5"]["rare"]),
                pct_iv(d5["common_esbl"], iv["D5"]["common_esbl"]),
                num(d5["rare_delay"], 0),
                num(d5["common_esbl_delay"], 0),
                f"p < {wt['level']:g}: {wt['whole_tool']:.1f} a year, rare {pct(wt['rare'], 0)}, common ESBL {pct(wt['common_esbl'], 0)}",
            ]
        )
    for label, b in live_d5.items():
        d5, iv, n = b["metrics"]["D5"], b["intervals"]["D5"], b["n"]["D5"]
        nz = sd.poisson_interval(n["noise"], years)
        curve = b["D5_curve"]
        wt = whole_tool_headline(curve)
        hl.append(
            [
                label,
                f"level x{d5['level']:g}",
                f"{d5['noise']:.1f} ({nz[0]:.1f} to {nz[1]:.1f})",
                pct_iv(d5["rare"], iv["rare"]),
                pct_iv(d5["common_esbl"], iv["common_esbl"]),
                num(d5["rare_delay"], 0),
                num(d5["common_esbl_delay"], 0),
                f"level x{wt['level']:g}: {wt['whole_tool']:.1f} a year, rare {pct(wt['rare'], 0)}, common ESBL {pct(wt['common_esbl'], 0)}",
            ]
        )
    add(table(["row", "level", "noise, episodes a year (95 % Poisson)", "rare k = 4 (95 % Wilson)", "common ESBL k = 4", "rare delay, days", "common delay, days", "same curve on whole-tool noise"], hl))
    add(
        "The shipped and re-tuned live rows have the same D5 headline because level 0.3 of the re-tuned alphas is level 3 of the shipped ones "
        "(harness review, finding 12a). Delay is the median over the detected trials, days from the first injected isolate. Looser levels "
        "than the plan's, exploratory (the same setting, the curve read to p < 0.9):\n"
    )
    ex_rows = []
    for part, label in (("both", "counts and %R"), ("count", "counts"), ("rate", "%R")):
        e = ext[part]
        d5, iv = e["D5"], e["D5_interval"]
        wt = e["whole_tool"]
        ex_rows.append(
            [label, f"p < {d5['level']:g}", f"{d5['noise']:.1f}", pct_iv(d5["rare"], iv["rare"]), pct_iv(d5["common_esbl"], iv["common_esbl"]), num(d5["rare_delay"], 0), num(d5["common_esbl_delay"], 0), f"p < {wt['level']:g}: {wt['whole_tool']:.1f} a year, rare {pct(wt['rare'], 0)}, common ESBL {pct(wt['common_esbl'], 0)}"]
        )
    add(table(["row", "level", "noise a year", "rare k = 4", "common ESBL k = 4", "rare delay", "common delay", "whole-tool noise"], ex_rows))
    # D5 curves
    add("## D5 curves (plan's levels), counts and %R, counts, %R\n")
    for part, label in (("both", "counts and %R"), ("count", "counts"), ("rate", "%R")):
        curve = rows[part]["ex"]["D5_curve"]
        add(f"**{label}** (computed; noise = cluster and sentinel episodes a year over 2024-10-01 to 2026-09-27, count in brackets; whole tool beside it; rates at k = 4, 200 trials):\n")
        add(
            table(
                ["level p <", "noise a year (count)", "whole tool a year", "rare k = 4", "rare delay", "common resistant", "wild type", "common ESBL k = 4", "common ESBL delay", "two-unit"],
                [
                    [
                        f"{r['level']:g}",
                        f"{r['noise']:.1f} ({r['noise_count']})",
                        f"{r['whole_tool']:.1f}",
                        pct_iv(r["rare"], wilson(r["rare_hit"], r["rare_n"])),
                        num(r["rare_delay"], 0),
                        pct(r["common_resistant"], 1),
                        pct(r["wild_type"], 1),
                        pct_iv(r["common_esbl"], wilson(r["common_esbl_hit"], r["common_esbl_n"])),
                        num(r["common_esbl_delay"], 0),
                        pct(r["two_unit"], 1),
                    ]
                    for r in curve
                ],
            )
        )
    # operating level
    add(f"## All metrics at the chosen setting (H = {hname(h)}, w = {w}, p < {L:g})\n")
    base_rows = {"live set, re-tuned": live_re, "live set, shipped": live_sh}
    m, iv, n = both["m"], both["iv"], both["n"]
    add("**D2 and its delay, counts and %R** (computed; rate with 95 % Wilson interval, median delay in days; 200 trials per cell, per-seed counts in `metrics.json`):\n")
    fams = ("rare", "common_resistant", "wild_type", "common_esbl", "two_unit")
    add(
        table(
            ["family", "k = 0 (control)", "k = 2", "k = 3", "k = 4", "k = 6"],
            [[f] + [d2_cell(m, iv, f"{f}_k{k}") for k in (0, 2, 3, 4, 6)] for f in fams],
        )
    )
    add("**D2 at k = 3 and 4, the parts and the baseline rows** (computed):\n")
    drows = []
    for label, mm, ii in (
        ("BOCPD counts and %R", m, iv),
        ("BOCPD counts", rows["count"]["m"], rows["count"]["iv"]),
        ("BOCPD %R", rows["rate"]["m"], rows["rate"]["iv"]),
        ("live set, re-tuned", live_re["metrics"], live_re["intervals"]),
        ("live set, shipped", live_sh["metrics"], live_sh["intervals"]),
    ):
        drows.append([label] + [d2_cell(mm, ii, f"{f}_k{k}") for f in fams for k in (3, 4)])
    add(table(["row"] + [f"{f} k = {k}" for f in fams for k in (3, 4)], drows))
    add(
        f"D2 is read at the tuning-chosen level p < {L:g}; the live rows at their operating level (the re-tuned alphas, the shipped ones). "
        "Rare k = 0 and two-unit controls are the false-alarm side of the same cells.\n"
    )
    add("**Spread of D2 at k = 4: detections in each of the five consecutive blocks of 40 trials** (computed; one seed, so the blocks stand in for the per-seed spread):\n")
    add(
        table(
            ["row", "rare k = 4, blocks of 40", "common ESBL k = 4, blocks of 40"],
            [[label, " / ".join(map(str, blocks[part]["rare"])) + f" (sum {sum(blocks[part]['rare'])})", " / ".join(map(str, blocks[part]["common_esbl"])) + f" (sum {sum(blocks[part]['common_esbl'])})"] for part, label in (("both", "BOCPD counts and %R"), ("count", "BOCPD counts"), ("rate", "BOCPD %R"))],
        )
    )
    # D4
    add("**D4, episodes a year by kind, over 2024-10-01 to 2026-09-27** (computed; fixed key, planted and quarantined zones left out; counts, and 95 % exact Poisson in brackets for the total):\n")
    d4rows = []
    for label, mm, ii, nn in (
        ("BOCPD counts and %R", m, iv, n),
        ("BOCPD counts", rows["count"]["m"], rows["count"]["iv"], rows["count"]["n"]),
        ("BOCPD %R", rows["rate"]["m"], rows["rate"]["iv"], rows["rate"]["n"]),
        ("live set, re-tuned", live_re["metrics"], live_re["intervals"], live_re["n"]),
        ("live set, shipped", live_sh["metrics"], live_sh["intervals"], live_sh["n"]),
    ):
        d4 = mm["D4"]
        c = nn["D4"]
        d4rows.append(
            [
                label,
                f"{d4['episodes_per_year']:.1f} ({c['episodes_per_year']}; {ii['D4']['episodes_per_year'][0]:.1f} to {ii['D4']['episodes_per_year'][1]:.1f})",
                f"{d4['cluster']:.1f} ({c['cluster']})",
                f"{d4['sentinel']:.1f} ({c['sentinel']})",
                f"{d4['divergence']:.1f} ({c['divergence']})",
                f"{d4['trend']:.1f} ({c['trend']})",
                f"{d4['data']:.1f} ({c['data']})",
                f"{d4['alerts_per_week']:.3f} ({c['alerts_per_week']})",
            ]
        )
    add(table(["row", "all", "cluster", "sentinel", "divergence", "trend", "data", "alerts a week (alerts)"], d4rows))
    # D1, D6, D7, I1
    add("**D1** (demonstration only; days from the planted event's start, 'none' where the detector never raised a matching signal at the chosen level; E3 and E4 are not this method's kinds):\n")
    d1rows = []
    for label, mm in (("BOCPD counts and %R", m), ("BOCPD counts", rows["count"]["m"]), ("BOCPD %R", rows["rate"]["m"]), ("live set, re-tuned", live_re["metrics"]), ("live set, shipped", live_sh["metrics"])):
        d1 = mm["D1"]
        d1rows.append([label] + [str(d1.get(k)) if d1.get(k) is not None else "none" for k in ("E1", "E1_corrected", "E2", "E2_corrected", "E3", "E4")])
    add(table(["row", "E1", "E1 corrected", "E2", "E2 corrected", "E3", "E4"], d1rows))
    add("**D1 by level, counts and %R** (computed; the plan's levels and the four looser ones; days from the start date, 'none' = not found):\n")
    lv = list(bocpd.LEVELS_EXT)
    d1l = [sd.d1_scores(both["det"], both["signals"], lvl) for lvl in lv]
    add(table(["event"] + [f"p < {x:g}" for x in lv], [[ev] + [("none" if d[ev] is None else str(d[ev])) for d in d1l] for ev in ("E1", "E1_corrected", "E2", "E2_corrected", "E3", "E4")]))
    if e4:
        add(
            f"A %R signal on *E. coli* trimethoprim exists at the chosen level ({len(e4)} signals, first {e4[0].date}, in {', '.join(sorted({s.ward for s in e4}))}); reported, not claimed: E4 is a hospital-wide trend and the harness's matcher accepts only a trend signal.\n"
        )
    else:
        add("No %R signal on *E. coli* trimethoprim at the chosen level (reported, not claimed: E4 is a hospital-wide trend).\n")
    add("**D6, D7 and I1** (computed; D6 = injected gaps with any non-data signal for the unit within the gap or 7 days after, 1,000 gaps; D7 = share of detected events named right; I1 alerts per incident):\n")
    rr = []
    for label, part in (("BOCPD counts and %R", "both"), ("BOCPD counts", "count"), ("BOCPD %R", "rate")):
        mm, ii, nn = rows[part]["m"], rows[part]["iv"], rows[part]["n"]
        d7c = rows[part]["d7_cluster"]
        d7_div = pct_iv(mm["D7"], ii["D7"]) if mm["D7"] is not None and ii.get("D7") else "none (no detected event)"
        d7_cl = "same" if d7c is None else (pct_iv(d7c["share"], d7c["interval"]) if d7c["share"] is not None and d7c["interval"] else "none (no detected event)")
        rr.append(
            [
                label,
                pct_iv(mm["D6"], ii["D6"]) + f" ({round(mm['D6'] * nn['D6'])} of {nn['D6']})",
                d7_div + f", n {nn['D7']}",
                d7_cl,
                f"{mm['I1']['alerts']} alerts, {mm['I1']['incidents']} incidents, {num(mm['I1']['alerts_per_incident'], 2)} per incident",
            ]
        )
    for label, b in (("live set, re-tuned", live_re), ("live set, shipped", live_sh)):
        mm, ii, nn = b["metrics"], b["intervals"], b["n"]
        rr.append([label, pct_iv(mm["D6"], ii["D6"]) + f" ({round(mm['D6'] * nn['D6'])} of {nn['D6']})", pct_iv(mm["D7"], ii["D7"]) + f", n {nn['D7']}", "n/a", f"{mm['I1']['alerts']} alerts, {mm['I1']['incidents']} incidents, {num(mm['I1']['alerts_per_incident'], 2)} per incident"])
    add(table(["row", "D6", "D7, %R named divergence", "D7, %R named cluster", "I1"], rr))
    # grid
    add("## Every setting of the grid (exploratory)\n")
    add(
        "Each setting at the level its own tuning-year rule gives (the loosest with at most 5 episodes a year in the tuning window), scored on the "
        "scoring period, rare and common ESBL families only, three rows each. D5 headline: the loosest level of the plan's grid with cluster and "
        "sentinel noise at most 5 a year; 'whole tool' reads the same curve on all episodes (counts and %R). **Exploratory: every row was scored on the "
        "scoring period, so a row picked from this table was picked there.**\n"
    )
    for part, label in (("both", "counts and %R"), ("count", "counts"), ("rate", "%R")):
        add(f"**{label}** (computed):\n")
        add(
            table(
                ["H", "w", "tuning level p <", "tuning noise a year", "tuning rare / common (of 40)", "rare k = 4 at that level", "common ESBL k = 4", "D4 all / cluster a year", "D5 headline: level, noise, rare, common", "same curve, whole-tool noise <= 5: level, noise, rare, common"],
                [
                    [
                        hname(g["H"]),
                        g["w"],
                        f"{g['tuning_level']:g}",
                        f"{g['tuning_row']['noise_per_year']:.0f}",
                        f"{g['tuning_row']['rare_hit']} / {g['tuning_row']['common_esbl_hit']}",
                        pct_iv(g["parts"][part]["D2_rare_k4"], g["parts"][part]["D2_intervals"]["rare_k4"]),
                        pct_iv(g["parts"][part]["D2_common_esbl_k4"], g["parts"][part]["D2_intervals"]["common_esbl_k4"]),
                        f"{g['parts'][part]['D4']['episodes_per_year']:.1f} / {g['parts'][part]['D4']['cluster']:.1f}",
                        f"p < {g['parts'][part]['D5']['level']:g}, {g['parts'][part]['D5']['noise']:.1f}, {pct(g['parts'][part]['D5']['rare'], 0)}, {pct(g['parts'][part]['D5']['common_esbl'], 0)}",
                        (lambda wt: f"p < {wt['level']:g}, {wt['whole_tool']:.1f}, {pct(wt['rare'], 0)}, {pct(wt['common_esbl'], 0)}")(g["parts"][part]["D5_whole_tool"]),
                    ]
                    for g in grid
                ],
            )
        )
    add("## Beyond the plan: a broader new-segment prior (exploratory)\n")
    add(
        "The plan's count prior is Gamma(1, rate 1/m): an exponential with the unit's hospital-implied weekly rate m as its mean, which gives little mass to a "
        "segment at 10 to 20 times that rate (the size of an injected cluster of 4 within 14 days, or E1). To see whether the weak counts row comes from that choice, "
        "the prior's mean is multiplied by c (shape still 1; %R priors unchanged); for each c the setting and level are chosen on the tuning year by the plan's rule "
        "and the row is scored as above. **Proposed (overnight), pending Artem; not part of the plan; c = 4 and 16 are arbitrary.**\n"
    )
    arows = []
    for part, label in (("both", "counts and %R"), ("count", "counts"), ("rate", "%R")):
        r1 = rows[part]
        arows.append(
            [
                "1 (the plan's)",
                f"{hname(h)}, {w}, p < {L:g}",
                f"{pick['row']['rare_hit']} / {pick['row']['common_esbl_hit']} (noise {pick['row']['noise_per_year']:.0f})",
                label,
                pct_iv(r1["m"]["D2"]["rare_k4"], r1["iv"]["D2"]["rare_k4"]),
                pct_iv(r1["m"]["D2"]["common_esbl_k4"], r1["iv"]["D2"]["common_esbl_k4"]),
                f"{r1['m']['D4']['episodes_per_year']:.1f} / {r1['m']['D4']['cluster']:.1f}",
                f"p < {r1['m']['D5']['level']:g}, {r1['m']['D5']['noise']:.1f}, {pct(r1['m']['D5']['rare'], 0)}, {pct(r1['m']['D5']['common_esbl'], 0)}",
                (lambda wt: f"p < {wt['level']:g}, {wt['whole_tool']:.1f}, {pct(wt['rare'], 0)}, {pct(wt['common_esbl'], 0)}")(whole_tool_headline(r1["ex"]["D5_curve"])),
            ]
        )
    for a in abl:
        for part, label in (("both", "counts and %R"), ("count", "counts"), ("rate", "%R")):
            r2 = a["parts"][part]
            arows.append(
                [
                    f"{a['scale']:g}",
                    f"{hname(a['H'])}, {a['w']}, p < {a['level']:g}",
                    f"{a['tuning_row']['rare_hit']} / {a['tuning_row']['common_esbl_hit']} (noise {a['tuning_row']['noise_per_year']:.0f})",
                    label,
                    pct_iv(r2["D2_rare_k4"], r2["D2_intervals"]["rare_k4"]),
                    pct_iv(r2["D2_common_esbl_k4"], r2["D2_intervals"]["common_esbl_k4"]),
                    f"{r2['D4']['episodes_per_year']:.1f} / {r2['D4']['cluster']:.1f}",
                    f"p < {r2['D5']['level']:g}, {r2['D5']['noise']:.1f}, {pct(r2['D5']['rare'], 0)}, {pct(r2['D5']['common_esbl'], 0)}",
                    (lambda wt: f"p < {wt['level']:g}, {wt['whole_tool']:.1f}, {pct(wt['rare'], 0)}, {pct(wt['common_esbl'], 0)}")(r2["D5_whole_tool"]),
                ]
            )
    add(
        table(
            ["prior mean x c", "chosen on tuning: H, w, level", "tuning rare / common of 40", "row", "rare k = 4", "common ESBL k = 4", "D4 all / cluster a year", "D5 headline: level, noise, rare, common", "whole-tool noise <= 5: level, noise, rare, common"],
            arows,
        )
    )
    add("## Figures\n")
    add(
        f"`figure.png`: the card for E1 (URO, ESBL) at the chosen setting; as of the week ending 2025-06-15 the modal change week is index {card['post']['mode_week']} "
        f"(80 % interval {card['post']['lo_week']} to {card['post']['hi_week']}), m_t = {card['post']['m']:.2f}, the weekly rate since the modal change {card['post']['now_mean']:.2f} against {card['post']['before_mean']:.2f} before it "
        f"(the gate's means over runs shorter than w and over the others, {card['post']['short_mean']:.2f} and {card['post']['long_mean']:.2f}; at w = 2 two weeks after the change they straddle it) "
        f"(computed); the first E1-matching signal (D1's matcher, to 2025-08-31) is {card['first_signal'] or 'none at the chosen level'}, at the loosest level p < 0.9 {card['loosest_signal'] or 'none'}. `d5_curve.png`: detection at k = 4 against the whole tool's episodes a year, every level of the extended grid (hollow markers: the four exploratory looser levels), the three rows and the two live rows.\n"
    )
    (OUT / "results.md").write_text("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
