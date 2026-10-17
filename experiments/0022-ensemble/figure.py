"""Experiment 0022: the researcher's signal-feed card (README.md, "Proposed visualisation"): the cell URO x ESBL over the 16 weeks
ending 2025-06-15 (E1's weeks). Top: the re-tuned live set's phenotype-excess signals as -log10 p; middle: the CUSUM's signals
in the same cell; bottom: the combined rank product with its operating level and first crossing. Weeks where both components
signalled on one day are shaded; a row of integers gives the first ESBL isolates in URO that week."""

from __future__ import annotations

import math
from datetime import date, timedelta
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

import ensemble as E  # noqa: E402
from aei import cusum as cs  # noqa: E402

CELL = ("URO", "ph", "esbl")
AS_OF = "2025-06-15"  # a Sunday
WEEKS = 16
L_B = 72.0682


def draw(path: Path, a_real, b_real, rp, op_level: float, live, records) -> None:
    hi = E.ordinal(AS_OF)
    lo = hi - 7 * WEEKS + 1
    days = list(range(lo, hi + 1))
    a = [s for s in a_real if E.cell_of(s) == CELL]
    b = [s for s in b_real if E.cell_of(s) == CELL]
    mA, mB = E.score_map(a, E.JOIN, lo, hi), E.score_map(b, E.JOIN, lo, hi)
    keys = [(CELL, t) for t in days]
    sA, sB, _, _ = E.fields(mA, mB, keys)
    p = rp.score(sA, sB)
    ml = -np.log10(p)
    pa = {E.ordinal(s.date): s.p for s in a if lo <= E.ordinal(s.date) <= hi and s.p is not None}
    pb = {}
    for s in b:
        t = E.ordinal(s.date)
        if lo <= t <= hi:
            pb[t] = min(pb.get(t, 1.0), s.p)
    both_days = [t for t, k in zip(days, keys) if k in mA and k in mB]
    week_of = lambda t: (t - lo) // 7  # noqa: E731
    both_weeks = sorted({week_of(t) for t in both_days})
    first = next((t for t, v in zip(days, p) if v < op_level), None)

    fig, axes = plt.subplots(3, 1, figsize=(12, 5), sharex=True, dpi=120)
    x = np.array(days) - lo
    for ax in axes:
        for wk in both_weeks:
            ax.axvspan(wk * 7 - 0.5, wk * 7 + 6.5, color="0.88", zorder=0)
        ax.set_ylabel("-log10 p")
        ax.grid(axis="y", color="0.9", lw=0.6)
    ax = axes[0]
    ax.vlines([t - lo for t in pa], 0, [-math.log10(v) for v in pa.values()], color="0.35", lw=1)
    ax.plot([t - lo for t in pa], [-math.log10(v) for v in pa.values()], "o", color="0.15", ms=4, label="Live set")
    ax.axhline(-math.log10(live.phenotype_alpha), color="0.4", ls="--", lw=1, label="limit")
    ax.legend(loc="upper left", fontsize=8, frameon=False)
    ax.set_title("URO x ESBL, 16 weeks to 2025-06-15", fontsize=10, loc="left")
    ax = axes[1]
    ax.vlines([t - lo for t in pb], 0, [-math.log10(v) for v in pb.values()], color="0.35", lw=1)
    ax.plot([t - lo for t in pb], [-math.log10(v) for v in pb.values()], "^", color="0.15", ms=5, label="CUSUM")
    ax.axhline(-math.log10(cs.level_of_years(L_B)), color="0.4", ls="--", lw=1, label="limit")
    ax.legend(loc="upper left", fontsize=8, frameon=False)
    ax = axes[2]
    ax.step(x, ml, where="post", color="0.1", lw=1.4, label="Combined")
    ax.axhline(-math.log10(op_level), color="0.4", ls="--", lw=1, label="limit")
    if first is not None:
        ax.axvline(first - lo, color="C3", lw=1.2, label="first alarm")
        ax.text(first - lo + 0.5, ax.get_ylim()[1] * 0.85, date.fromordinal(first).isoformat(), fontsize=8, color="C3")
    if both_weeks:
        ax.text(both_weeks[0] * 7 + 3, ax.get_ylim()[1] * 0.4, "both", fontsize=8, ha="center", color="0.3")
    ax.legend(loc="upper left", fontsize=8, frameon=False)
    starts = [lo + 7 * i for i in range(WEEKS)]
    ticks = [7 * i for i in range(0, WEEKS, 2)]
    ax.set_xticks(ticks)
    ax.set_xticklabels([date.fromordinal(starts[i // 7]).isoformat() for i in ticks], fontsize=8)
    ax.set_xlabel("Week starting", labelpad=24)
    counts = [0] * WEEKS
    d0, d1 = date.fromordinal(lo).isoformat(), AS_OF
    for r in records:
        if r.ward == CELL[0] and CELL[2] in r.phenotypes and d0 <= r.sample_date <= d1:
            counts[week_of(E.ordinal(r.sample_date))] += 1
    for i, cnt in enumerate(counts):
        ax.text(i * 7 + 3, -0.2, str(cnt), transform=ax.get_xaxis_transform(), ha="center", va="top", fontsize=8)
    ax.text(-0.01, -0.2, "ESBL / week", transform=ax.get_xaxis_transform(), ha="right", va="top", fontsize=8)
    fig.tight_layout()
    fig.subplots_adjust(bottom=0.22)
    fig.savefig(path, dpi=120, metadata={"Software": None})
    plt.close(fig)
