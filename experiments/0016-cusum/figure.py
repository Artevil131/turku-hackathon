"""Experiment 0016: the sketch of the signal-feed card (README.md, "Proposed visualisation"): URO, ESBL, 30 weeks ending 2025-06-15,
at the chosen Poisson setting and the operating run length. Top: weekly new patients, the baseline's expectation with its
Poisson 95 % band, the guard band. Bottom: the CUSUM S with the band from re-running it at the baseline rate's 2.5th and 97.5th
Gamma percentile, the series' limit, alarm days, the start of the run, E1's onset and the as-of date."""

from __future__ import annotations

import csv
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from scipy import stats  # noqa: E402

import cusum as cs  # noqa: E402
from aei import harness  # noqa: E402
from aei.dates import add_days  # noqa: E402

UNIT, PHEN = "URO", "esbl"
AS_OF = "2025-06-15"  # a Sunday
ONSET = "2025-05-30"  # E1's first outbreak isolate
WEEKS = 30


def _names(unit: str) -> tuple[str, str]:
    with (harness.DATA / "wards.csv").open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["ward_code"] == unit:
                return r["ward_fi"], r["ward_en"]
    return unit, unit


def limit_s(lam_period: np.ndarray, theta: float, u: int, run_days: float) -> np.ndarray:
    """The S at which Siegmund's run length of the series equals `run_days`, for each baseline rate (per period)."""
    lt = math.log(theta)
    mu = lam_period * (theta - 1 - lt)
    target = run_days * mu / u
    lo, hi = np.zeros_like(target), np.full_like(target, cs.EXP_CAP)
    for _ in range(80):
        mid = (lo + hi) / 2
        too_big = (np.expm1(mid) - mid) > target
        hi = np.where(too_big, mid, hi)
        lo = np.where(too_big, lo, mid)
    return np.maximum((lo + hi) / 2 - cs.OVERSHOOT * np.sqrt(lam_period) * lt, 0.0)


def draw(path: Path, pois: tuple[float, int, int], l_sim_years: float) -> None:
    theta, u, g = pois
    w = cs.real_world()
    uni = cs.universe()
    _, dates, day_of = cs.calendar()
    ui, pi = uni.unit_index[UNIT], uni.ph_index[PHEN]
    n_days = w.D
    st = cs.poisson_stat(w.cEV[ui, pi][None, :], w.cHEV[pi][None, :], w.cVOL[ui][None, :], w.cHVOL, theta, u, g, n_days)
    t, S, lam_w, y = st["t"], st["S"][0], st["lam_w"][0], st["y"][0]
    lt = math.log(theta)
    # the band: S re-run with the baseline rate at its 2.5th and 97.5th Gamma percentile
    shape, rate = st["shape"][0], st["rate_w"][0]
    bands = []
    for q in (0.975, 0.025):  # a high rate gives a low S
        lam_q = np.maximum(stats.gamma.ppf(q, np.maximum(shape, 1e-9)) / rate, cs.LAM_FLOOR_WEEK) * (u / 7.0)
        x = y * lt - (theta - 1) * lam_q
        c = np.concatenate([[0.0], np.cumsum(x)])
        bands.append((c - np.minimum.accumulate(c))[1:])
    s_lo, s_hi = bands
    lim = limit_s(lam_w * (u / 7.0), theta, u, 365.25 * l_sim_years)
    end = day_of[AS_OF]
    start = end - 7 * WEEKS + 1
    keep = (t >= start) & (t <= end)
    tt = t[keep]
    d = [np.datetime64(dates[i]) for i in tt]
    wk_start = np.arange(start, end + 1, 7)
    counts = [w.EV[ui, pi, a : a + 7].sum() for a in wk_start]
    wk_mid = [np.datetime64(dates[a]) + np.timedelta64(3, "D") for a in wk_start]
    wk_last = np.array([a + 6 for a in wk_start])
    lam_at = np.interp(wk_last, t, lam_w) if len(t) else np.zeros(len(wk_last))
    lo_b = stats.poisson.ppf(0.025, lam_at)
    hi_b = stats.poisson.ppf(0.975, lam_at)
    fi_name, en_name = _names(UNIT)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(9.2, 6.4), sharex=True, gridspec_kw={"height_ratios": [1, 1.25], "hspace": 0.12})
    for a in (ax1, ax2):
        a.set_facecolor("white")
        a.spines[["top", "right"]].set_visible(False)
    # top panel: counts, expectation, band, guard band
    ax1.bar(wk_mid, counts, width=6, color="#9a9a9a", edgecolor="#555555", linewidth=0.6, zorder=2)
    for x, cnt in zip(wk_mid, counts, strict=True):
        ax1.text(x, cnt + 0.15, f"{int(cnt)}", ha="center", va="bottom", fontsize=7)
    ax1.fill_between(wk_mid, lo_b, hi_b, step="mid", color="#4a7bb5", alpha=0.18, zorder=1, label="vaihteluväli 95 % / 95 % range of a week")
    ax1.step(wk_mid, lam_at, where="mid", color="#1f4e8c", lw=1.4, ls="-", label="odotettu viikossa / expected a week", zorder=3)
    ax1.set_ylabel("uudet potilaat / viikko\nnew patients / week", fontsize=8)
    ax1.set_ylim(bottom=0)
    if g > 0:
        g0, g1 = np.datetime64(dates[max(end - 7 * g - u + 1, 0)]), np.datetime64(dates[end - u + 1])
        ax1.axvspan(g0, g1, ymin=0, ymax=0.06, facecolor="none", edgecolor="#444444", hatch="////", lw=0.5)
        ax1.text(g0, ax1.get_ylim()[1] * 0.09, f"suojaväli / guard band, {g} vk / wk", fontsize=7)
    ax1.legend(loc="upper left", fontsize=7, frameon=False)
    # bottom panel: the CUSUM
    ax2.fill_between(d, s_lo[keep], s_hi[keep], step="post", color="#4a7bb5", alpha=0.2, label="kertymä, vertailun epävarmuus 95 % / S with baseline uncertainty 95 %")
    ax2.step(d, S[keep], where="post", color="#1f4e8c", lw=1.6, label="kertymä S / evidence S")
    ax2.step(d, lim[keep], where="post", color="#8c2d04", lw=1.3, ls="--", label=f"hälytysraja / alarm limit ({l_sim_years:.3g} v / yr)")
    alarm = (S > lim) & keep
    ax2.plot([np.datetime64(dates[i]) for i in t[alarm]], S[alarm], "s", color="#8c2d04", ms=4, label="hälytyspäivä / alarm day")
    # the start of the run in force at the as-of date: the last period with S = 0 before it
    idx = np.nonzero((S <= 0) & (t <= end))[0]
    if len(idx):
        run_start = np.datetime64(dates[int(t[idx[-1]])])
        ax2.axvline(run_start, color="#333333", lw=1.0, ls="-.")
        ax2.text(run_start, ax2.get_ylim()[1] * 0.97, "alkoi / began ", fontsize=7, va="top", ha="right")
    ax2.axvline(np.datetime64(ONSET), color="#333333", lw=1.0, ls=":")
    ax2.text(np.datetime64(ONSET), ax2.get_ylim()[1] * 0.80, "E1:n alku / E1 onset ", fontsize=7, va="top", ha="right")
    ax2.axvline(np.datetime64(AS_OF), color="black", lw=1.4)
    ax2.text(np.datetime64(AS_OF), ax2.get_ylim()[1] * 0.62, "tänään / as of ", fontsize=7, va="top", ha="right")
    ax2.set_ylabel("kertymä, ln-uskottavuus\nevidence, log likelihood ratio", fontsize=8)
    ax2.set_ylim(bottom=0)
    ax2.set_ylim(top=max(ax2.get_ylim()[1], 1.15 * float(np.max(lim[keep]))))
    ax2.legend(loc="upper left", fontsize=7, frameon=False)
    ax2.set_xlabel("päivämäärä / date", fontsize=8)
    ax2.set_xlim(np.datetime64(dates[start]), np.datetime64(dates[end]) + np.timedelta64(2, "D"))
    j_end = int(np.nonzero(t == end)[0][0]) if (t == end).any() else len(t) - 1
    fig.suptitle(
        f"ESBL · {fi_name} / {en_name} — kertymä {S[j_end]:.1f}, raja {lim[j_end]:.1f} / sum {S[j_end]:.1f}, limit {lim[j_end]:.1f}",
        fontsize=10, x=0.01, ha="left", y=0.985,
    )
    fig.text(
        0.01, 0.005,
        f"θ {theta:g} · vertailu 26 vk, suojaväli {g} vk / baseline 26 wk, guard {g} wk · väärä hälytys kerran ~{l_sim_years:.3g} v sarjaa kohti / one false alarm in ~{l_sim_years:.3g} yr per series · {AS_OF}",
        fontsize=7,
    )
    fig.subplots_adjust(left=0.1, right=0.98, top=0.93, bottom=0.12)
    for a in (ax1, ax2):
        a.tick_params(labelsize=7)
    fig.savefig(path, dpi=110, metadata={"Software": None})
    plt.close(fig)
