"""The two figures of experiment 0015: the signal-feed card for E1 (README "Proposed visualisation") and the sensitivity against
noise curves (D5) of the chosen setting and the two live-set rows.

PNG, light background, saved with metadata={"Software": None} so reruns compare equal. Labels Finnish first.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
from scipy import stats

import gamma_poisson as gp

from aei import harness
from aei.coverage import wilson
from aei.dates import add_days, days_between

DPI = 120
INK, GREY, LIGHT = "#222222", "#8a8a8a", "#d9d9d9"
BLUE, ORANGE = "#1f5fa8", "#c4551d"


def _ward_names(unit: str) -> tuple[str, str]:
    wards = pd.read_csv(harness.DATA / "wards.csv")
    row = wards[wards.ward_code == unit].iloc[0]
    return str(row.ward_fi), str(row.ward_en)


def _running_rank(w: gp.World, S: int, g: int, L: int, as_of: str, level: float, series_idx: int) -> tuple[int | None, int]:
    """The series' rank by running maximum score among the series passing q < level in the ISO week up to `as_of`
    (the budget's ranking), and how many pass."""
    d = w.day_of[as_of]
    days = np.arange(max(int(w.week_start[d]), gp.first_valid_day(S, g, L)), d + 1)
    T = gp.run_tests(w, w.cum, days, S, g, L)
    best: dict[int, float] = {}
    for j in range(len(days)):
        for si in np.nonzero(T.q[:, j] < level)[0]:
            best[int(si)] = max(best.get(int(si), -1.0), float(-np.log10(T.p[si, j])))
    order = sorted(best.items(), key=lambda kv: (-kv[1], kv[0]))
    rank = next((i + 1 for i, (s, _) in enumerate(order) if s == series_idx), None)
    return rank, len(order)


def card(path: Path, records, st: tuple[int, int, int], level: float, signals, *, as_of: str = "2025-06-15", unit: str = "URO", series: str = "esbl", onset: str = "2025-05-30") -> dict:
    """One card of the signal feed for E1 (URO, ESBL) as of `as_of` at the setting `st`: weekly counts of events, the
    baseline weeks, the guard band, the window and the 95 % predictive band of the negative binomial; returns the numbers
    printed on it."""
    S, g, L = st
    w = gp.World(records)
    si = w.sidx[f"{unit}|{series}"]
    d = w.day_of[as_of]
    T = gp.run_tests(w, w.cum, np.array([d]), S, g, L)
    y, alpha, mean, p, q, m = int(T.y[si, 0]), float(T.alpha[si, 0]), float(T.mean[si, 0]), float(T.p[si, 0]), float(T.q[si, 0]), int(T.m[0])
    beta = S * (1 + gp.K)
    lo95, hi95 = stats.nbinom.ppf([0.025, 0.975], alpha, beta / (beta + L))
    rank, n_pass = _running_rank(w, S, g, L, as_of, level, si)
    n_weeks = S + g + L + 2
    counts = [int(w.events_per_day[si, d - 7 * (i + 1) + 1 : d - 7 * i + 1].sum()) for i in range(n_weeks)][::-1]  # oldest first
    ends = [add_days(as_of, -7 * i) for i in range(n_weeks)][::-1]
    xs = [dt.date.fromisoformat(e) - dt.timedelta(days=3) for e in ends]  # bar centre: the middle of its 7 days
    role = ["window" if i >= n_weeks - L else "guard" if i >= n_weeks - L - g else "base" if i >= n_weeks - L - g - S else "out" for i in range(n_weeks)]
    ward_fi, ward_en = _ward_names(unit)
    ph = series.upper()
    first_signal = min((s.date for s in signals if s.ward == unit and s.phenotype == series and s.p < level and s.date >= onset), default=None)

    fig, ax = plt.subplots(figsize=(9.2, 5.2), dpi=DPI)
    fig.patch.set_facecolor("white")
    for x, c, r in zip(xs, counts, role, strict=True):
        if r == "window":
            ax.bar(x, c, width=6.2, color=INK, edgecolor=INK, zorder=3)
        elif r == "guard":
            ax.bar(x, c, width=6.2, color="white", edgecolor=GREY, hatch="////", zorder=3)
        else:
            ax.bar(x, c, width=6.2, color=LIGHT, edgecolor=GREY, linewidth=0.6, zorder=3)
    x_win_lo = xs[n_weeks - L] - dt.timedelta(days=3.5)
    x_win_hi = xs[-1] + dt.timedelta(days=3.5)
    x_ci = x_win_hi + dt.timedelta(days=6)
    ax.fill_between([x_win_lo, x_win_hi], lo95 / L, hi95 / L, color="#bcd3ee", alpha=0.6, zorder=2, linewidth=0)
    ax.hlines(mean / L, x_win_lo, x_win_hi, color=BLUE, linestyle="--", linewidth=1.8, zorder=5)
    ax.errorbar([x_ci], [mean / L], yerr=[[mean / L - lo95 / L], [hi95 / L - mean / L]], color=BLUE, capsize=4, linewidth=2, marker="D", markersize=5, zorder=5)
    ymax = max(max(counts), hi95 / L, 4) * 1.35
    ax.set_ylim(0, ymax)
    as_of_x, onset_x = dt.date.fromisoformat(as_of), dt.date.fromisoformat(onset)
    ax.axvline(as_of_x, color=INK, linewidth=1.2, zorder=6)
    ax.text(as_of_x, ymax * 0.985, f"{as_of} (tilanne / as of) ", ha="right", va="top", fontsize=8)
    ax.axvline(onset_x, color=ORANGE, linewidth=1.2, linestyle=":", zorder=1)
    ax.text(onset_x, ymax * 0.90, f"alku / onset {onset} ", ha="right", va="top", fontsize=8, color=ORANGE, bbox={"facecolor": "white", "edgecolor": "none", "pad": 1.5})
    if first_signal is not None and first_signal <= as_of:
        fs_x = dt.date.fromisoformat(first_signal)
        ax.plot([fs_x], [ymax * 0.02], marker="^", color=ORANGE, markersize=9, zorder=6, clip_on=False)
        ax.annotate(f"ensimmäinen signaali / first signal {first_signal}", xy=(fs_x, ymax * 0.03), xytext=(onset_x - dt.timedelta(days=3), ymax * 0.42), fontsize=8, color=ORANGE, ha="right", va="center", arrowprops={"arrowstyle": "->", "color": ORANGE, "linewidth": 1})
    # baseline bracket and labels under the axis; the baseline ends where the guard band (or, without one, the window) begins
    y_br = -ymax * 0.07
    b_lo = xs[n_weeks - L - g - S] - dt.timedelta(days=3.5)
    b_hi = xs[n_weeks - L - g - 1] + dt.timedelta(days=3.5)
    ax.annotate("", xy=(b_lo, y_br), xytext=(b_hi, y_br), arrowprops={"arrowstyle": "|-|", "color": INK, "linewidth": 1}, annotation_clip=False)
    ax.text(b_lo + (b_hi - b_lo) / 2, y_br * 1.9, f"vertailu / baseline, {S} vk / wk", ha="center", va="top", fontsize=8.5)
    if g:
        g_lo, g_hi = xs[n_weeks - L - g] - dt.timedelta(days=3.5), xs[n_weeks - L - 1] + dt.timedelta(days=3.5)
        ax.annotate("", xy=(g_lo, y_br), xytext=(g_hi, y_br), arrowprops={"arrowstyle": "|-|", "color": GREY, "linewidth": 1}, annotation_clip=False)
        ax.text(g_lo + (g_hi - g_lo) / 2, y_br * 1.9, f"suojaväli / guard band, {g} vk / wk", ha="center", va="top", fontsize=8.5)
    ax.text(x_win_lo - dt.timedelta(days=2), ymax * 0.80, f"ikkuna / window, {L} vk / wk ", ha="right", va="top", fontsize=8.5, bbox={"facecolor": "white", "edgecolor": "none", "pad": 1.5})
    ax.set_ylabel("Potilaita viikossa / Patients per week")
    ax.set_xlabel("Näytteenottopäivä, viikot päättyvät / Sample date, weeks ending on the as-of date", labelpad=34)
    ax.set_xlim(xs[0] - dt.timedelta(days=5), xs[-1] + dt.timedelta(days=16))
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    ax.tick_params(labelsize=8)
    wk = "viikossa"
    en_weeks = "week" if L == 1 else "weeks"
    head = f"{ph} · {ward_fi} / {ward_en} — {y} potilasta {L} {wk}, tavallisesti {mean:.1f} / {y} patients in {L} {en_weeks}, usual {mean:.1f}"
    fig.text(0.07, 0.965, head, fontsize=11, fontweight="bold", va="top")
    budget_txt = f"{rank} / {gp.BUDGET}" if rank is not None else "ei läpi / not passing"
    foot = (
        f"p {p:.1e} · BH-korjattu / adjusted {q:.1e} · {m} testattua sarjaa tänään / tested series today · "
        f"budjetti / budget {budget_txt} · taso / level q < {level:g}"
    )
    fig.text(0.07, 0.025, foot, fontsize=8, va="bottom")
    ax.legend(
        handles=[
            Patch(facecolor=LIGHT, edgecolor=GREY, label="vertailuviikot / baseline weeks"),
            Patch(facecolor="white", edgecolor=GREY, hatch="////", label="suojaväli / guard band"),
            Patch(facecolor=INK, edgecolor=INK, label="ikkuna / window"),
            Line2D([0], [0], color=BLUE, marker="D", markersize=5, linewidth=2, label="ennuste 95 % ja keskiarvo / predictive 95 % and mean"),
        ],
        loc="upper left", fontsize=7.5, frameon=False, bbox_to_anchor=(0.0, 0.88),
    )
    fig.subplots_adjust(left=0.08, right=0.97, top=0.88, bottom=0.27)
    fig.savefig(path, dpi=DPI, metadata={"Software": None})
    plt.close(fig)
    return {"as_of": as_of, "unit": unit, "series": series, "y": y, "mean": mean, "lo95": float(lo95), "hi95": float(hi95), "p": p, "q": q, "tested_today": m, "budget_rank": rank, "passing_this_week": n_pass, "first_signal": first_signal, "setting": list(st), "level": level}


def curves(path: Path, chosen: dict, budget: dict, baselines: dict[str, dict], limit: float = 5.0) -> None:
    """D5: detection rate of a cluster of 4 against noise, rare and common ESBL families, for the chosen setting without and
    with the budget and for the two live-set rows. Wilson 95 % band on the chosen setting; the headline points carry their
    counts."""
    fig, axes = plt.subplots(1, 2, figsize=(10.2, 5.2), dpi=DPI, sharey=True)
    fig.patch.set_facecolor("white")
    series = [
        ("Valittu asetus / chosen setting", chosen, INK, "-", "o"),
        ("sama + budjetti / same + budget", budget, BLUE, "--", "s"),
        ("elävä sarja, viritetty / live set, re-tuned year 1", baselines["retuned"], ORANGE, ":", "^"),
        ("elävä sarja, toimitettu / live set, as shipped", baselines["shipped"], GREY, "-.", "D"),
    ]
    for ax, (fam, title) in zip(axes, [("rare", "Harvinainen klooni / Rare clone, k = 4"), ("common_esbl", "Yleinen ESBL E. coli / Common ESBL E. coli, k = 4")], strict=True):
        for name, curve, colour, ls, mk in series:
            rows = [r for r in curve if fam in r]
            x = np.array([r["noise"] for r in rows])
            yv = np.array([r[fam] for r in rows])
            ax.plot(np.maximum(x, 0.0), yv, color=colour, linestyle=ls, marker=mk, markersize=4.5, linewidth=1.6, label=name)
            if colour == INK:
                ci = np.array([wilson(r[f"{fam}_hit"], r[f"{fam}_n"]) for r in rows])
                ax.fill_between(x, ci[:, 0], ci[:, 1], color=INK, alpha=0.12, linewidth=0)
                ok = [r for r in rows if r["noise"] <= limit]
                if ok:
                    h = ok[0]
                    ax.annotate(f"{h[f'{fam}_hit']} / {h[f'{fam}_n']}", (h["noise"], h[fam]), textcoords="offset points", xytext=(6, -14), fontsize=8)
        ax.axvline(limit, color=INK, linewidth=0.8, linestyle=(0, (1, 3)))
        ax.set_xscale("symlog", linthresh=1.0)
        ax.set_xlim(-0.1, 300)
        ax.set_xticks([0, 1, 2, 5, 10, 30, 100, 300])
        ax.set_xticklabels(["0", "1", "2", "5", "10", "30", "100", "300"])
        ax.set_ylim(-0.02, 1.02)
        ax.set_title(title, fontsize=10)
        ax.set_xlabel("Kohinaa, jaksoa vuodessa / Noise, episodes per year")
        ax.grid(alpha=0.25)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
    axes[0].set_ylabel("Löydettyjen osuus / Share detected")
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="lower center", ncol=2, fontsize=8, frameon=False, bbox_to_anchor=(0.5, 0.045))
    fig.text(0.5, 0.005, "Pystyviiva: 5 jaksoa vuodessa / vertical line: 5 episodes a year. Kaista: Wilson 95 % / band: Wilson 95 %. Pisteet: tasot / points: levels. n = 200 koetta / trials per point.", ha="center", fontsize=7.5)
    fig.tight_layout(rect=(0, 0.14, 1, 1))
    fig.savefig(path, dpi=DPI, metadata={"Software": None})
    plt.close(fig)
