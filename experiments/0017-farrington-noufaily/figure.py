"""Experiment 0017: the proposed visualisation, one card for URO x ESBL drawn from the headline setting."""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

import farrington as F  # noqa: E402
from aei.regional import upper_tail  # noqa: E402

UNIT, SERIES = "URO", "esbl"
FIRST, ASOF = "2025-01-06", "2025-12-14"
E1_ONSET = "2025-05-30"


def _d(day: int) -> dt.date:
    return dt.date.fromisoformat(F.date_of(day))


def draw(path: Path, design: str, H: int, g: int, reweight: bool, level: float) -> dict:
    uni = F.universe()
    world = F.real_world()
    y = world.EV[uni.unit_index[UNIT], uni.index[SERIES], :].copy()
    t_last = (F.day_of(ASOF) - 6) // 7
    t_first = F.day_of(FIRST) // 7
    ts = list(range(t_first, t_last + 1))
    fits = {t: F.explain(y, t, design, H, g, reweight, level) for t in ts}
    # the weights of the last as-of date: from the reweighted fit, shown whatever the headline weighting
    last = F.explain(y, t_last, design, H, g, True, level)
    starts = [_d(7 * t) for t in ts]
    fig, ax = plt.subplots(figsize=(10, 4.6), dpi=110)
    ref = set(int(i) for i in last["ref"])
    omega = dict(zip((int(i) for i in last["ref"]), last["omega"], strict=True))
    signals = []
    run_len = 0
    prev_hit = False
    top = max(float(y[ts].max()) + 4.5, 9.0)
    for t, s in zip(ts, starts, strict=True):
        f = fits[t]
        hit = y[t] >= f["need"]
        down = t in omega and omega[t] < 0.5
        if down:
            ax.bar(s, y[t], width=6, align="edge", facecolor="white", edgecolor="#5f6368", hatch="///", linewidth=0.8)
        else:
            ax.bar(s, y[t], width=6, align="edge", facecolor="#202124" if hit else "#b8bcc2", edgecolor="#5f6368", linewidth=0.5)
        ax.text(s + dt.timedelta(days=3), y[t] + 0.12, f"{int(y[t])}", ha="center", va="bottom", fontsize=6.5, color="#3c4043")
        run_len = run_len + 1 if (hit and prev_hit) else (1 if hit else 0)
        prev_hit = hit
        if hit:
            p = upper_tail(int(y[t]), f["mu0"], f["phi"])
            signals.append((s, y[t], p, run_len))
    for s, v, p, k in signals:
        x = s + dt.timedelta(days=3)
        ax.plot([x], [v + 0.9], marker="s", color="#202124", markersize=5)
        ax.text(x, v + 1.3 + 0.9 * ((k - 1) % 3), f"p = {p:.0e}", ha="center", va="bottom", fontsize=6.5, color="#202124")
    xs = [s for s in starts] + [starts[-1] + dt.timedelta(days=7)]

    def step(key):
        v = [fits[t][key] for t in ts]
        return v + [v[-1]]

    ax.fill_between(xs, step("lo"), step("hi"), step="post", color="#1a56a0", alpha=0.18, linewidth=0, label="Luottamusväli μ̂ / Wald 95 % band of μ̂")
    ax.step(xs, step("mu0"), where="post", color="#1a56a0", linewidth=1.6, label="Odotettu μ0 / expected μ0")
    need = [fits[t]["need"] - 0.5 for t in ts]
    ax.step(xs, need + [need[-1]], where="post", color="#b3261e", linewidth=1.3, linestyle="--", label="Hälytysraja / alarm threshold (smallest alarming count)")
    ax.set_ylim(-1.1, top)
    if max(need) > top:
        ax.text(starts[-1], top - 0.35, f"raja nousee arvoon / threshold rises to {max(fits[t]['need'] for t in ts)} (kuvan yläpuolella / above the axis)", ha="right", va="top", fontsize=6.5, color="#b3261e")
    for t in sorted(ref):
        if t_first - 1 <= t <= t_last:
            ax.broken_barh([(mdates_num(_d(7 * t)), 6)], (-0.95, 0.5), facecolors="#9aa0a6")
    ax.axvline(mdates_num(dt.date.fromisoformat(E1_ONSET)), color="#5f6368", linestyle=":", linewidth=1.0)
    ax.text(dt.date.fromisoformat(E1_ONSET), top - 0.3, " E1 alkoi / began", fontsize=7, va="top", color="#3c4043")
    ax.set_ylabel("Viikkomäärä / weekly count (new patients)")
    ax.set_xlabel("Viikon alku / week starting")
    ax.set_yticks(list(range(0, int(top) + 1, 1 if top <= 12 else 2)))
    ax.set_title(
        f"{UNIT} · ESBL: viikkomäärä ja odotus / weekly count and expectation, as of {ASOF}\n"
        f"{'liukuva' if design == 'T' else 'vuosi taaksepäin'} / {'trailing' if design == 'T' else 'year-back'} {H} vk/wk, suojaväli / guard {g} vk/wk, "
        f"{'alipainotus / down-weighting' if reweight else 'ei alipainotusta / no down-weighting'}, p < {level:g}",
        fontsize=9,
        loc="left",
    )
    lowest = float(np.min(last["omega"]))
    fig.text(
        0.01,
        0.012,
        f"Harmaa kaista akselin alla / grey strip below the axis: vertailuviikot / reference weeks of the last week. Tyhjä viistoviivapalkki / hatched bar: alipainotettu / down-weighted (ω < 0.5); "
        f"alin ω / lowest ω = {lowest:.2f}.",
        fontsize=6.3,
        color="#3c4043",
    )
    ax.legend(loc="upper left", fontsize=7, frameon=False)
    ax.grid(axis="y", color="#e3e5e8", linewidth=0.6)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    fig.autofmt_xdate()
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(path, dpi=110, metadata={"Software": None})
    plt.close(fig)
    return {"signals": len(signals), "down_weighted": sum(1 for v in omega.values() if v < 0.5), "lowest_omega": lowest, "reference_weeks": len(ref), "last_mu0": last["mu0"]}


def mdates_num(d: dt.date) -> float:
    import matplotlib.dates as md

    return md.date2num(d)
