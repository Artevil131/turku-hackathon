"""0010: metrics for the coverage list as shipped (README.md), from backtest.ts's out/rows.json.

Run from the repository root:
    node experiments/0010-coverage-as-shipped/backtest.ts && uv run python experiments/0010-coverage-as-shipped/analysis.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

from aei.jscompat import table

OUT = Path("experiments/0010-coverage-as-shipped/out")
THRESHOLD = {"mild": 0.8, "severe": 0.9}
PLANTED = {("URO", "2025-06"), ("URO", "2025-07"), ("ICU", "2026-02"), ("ICU", "2026-03")}
BOOT, SEED = 1000, 2026

data = json.loads((OUT / "rows.json").read_text())
rows = pd.DataFrame(data["rows"])
combos = pd.DataFrame(data["combos"])
rows["threshold"] = rows["severity"].map(THRESHOLD)
KEY = ["month", "ward", "specimen", "severity"]


def pct(k: float, n: float) -> str:
    return f"{100 * k / n:.1f} %" if n else "–"


def pooled(df: pd.DataFrame, covered: str = "covered", known: str = "known") -> tuple[int, int]:
    return int(df[covered].sum()), int(df[known].sum())


def monthly_spread(df: pd.DataFrame) -> str:
    by = df.groupby("month")[["covered", "known"]].sum()
    by = by[by["known"] > 0]
    s = by["covered"] / by["known"]
    return f"{100 * s.min():.1f} / {100 * s.median():.1f} / {100 * s.max():.1f}" if len(s) else "–"


def misses(df: pd.DataFrame, share_col: str, bar_col: str) -> tuple[int, float, int]:
    """Observed and binomially expected query-months whose realised share is below the bar, at the predicted share."""
    d = df[df["known"] >= 10]
    observed = int((d["covered"] / d["known"] < d[bar_col]).sum())
    expected = float(sum(stats.binom.cdf(math.ceil(b * n - 1e-9) - 1, n, p) for n, p, b in zip(d["known"], d[share_col], d[bar_col])))
    return observed, expected, len(d)


def report(rows: pd.DataFrame, combos: pd.DataFrame, title: str) -> str:
    out = [f"## {title}"]
    top = rows[rows["rank"] == 0]
    base = rows[rows["baseline"]]
    n_queries = len(top)

    # Metric 1: claims hold.
    lines = []
    for sev in ("mild", "severe"):
        for standing in ("clears", "borderline", "below", "not assessable"):
            d = top[(top["severity"] == sev) & (top["standing"] == standing)]
            if d.empty:
                continue
            k, n = pooled(d)
            ka, na = pooled(d, "allCovered", "allKnown")
            lines.append([sev, standing, len(d), f"{100 * d['share'].mean():.1f} %", pct(k, n), f"{n}", pct(ka, na), monthly_spread(d)])
    out.append(
        "### 1. Top pick: claimed against realised next-month coverage\n\nBasis: within spectrum for mild, all organisms for "
        "severe. Realised = covered / known over the unit's first isolates of the following month, pooled.\n\n"
        + table(["severity", "top pick's standing", "query-months", "mean predicted", "realised", "isolates", "realised, all organisms",
                 "monthly realised min / median / max"], lines)
    )
    lines = []
    for sev in ("mild", "severe"):
        for spec in ("urine", "blood", "wound"):
            d = top[(top["severity"] == sev) & (top["standing"] == "clears") & (top["specimen"] == spec)]
            if d.empty:
                continue
            k, n = pooled(d)
            picks = ", ".join(f"{a} {c}" for a, c in d["antibiotic"].value_counts().items())
            lines.append([sev, spec, len(d), picks, f"{100 * d['share'].mean():.1f} %", pct(k, n), n])
    out.append("Top picks that clear, by specimen:\n\n" + table(["severity", "specimen", "query-months", "picks", "mean predicted", "realised", "isolates"], lines))

    # Metric 2: calibration.
    lines = []
    for sev in ("mild", "severe"):
        d = top[(top["severity"] == sev) & (top["standing"] == "clears")]
        o, e, m = misses(d, "share", "threshold")
        lines.append([f"{sev}: top pick clears, realised below {int(100 * THRESHOLD[sev])} %", m, o, f"{e:.1f}", f"{o / e:.2f}" if e else "–"])
    cells = rows[rows["lower"].notna()]
    o, e, m = misses(cells, "share", "lower")
    lines.append(["every antibiotic with an interval: realised below its Wilson lower bound", m, o, f"{e:.1f}", f"{o / e:.2f}" if e else "–"])
    out.append(
        "### 2. Calibration\n\nQuery-months with at least 10 target isolates with a result. Expected = sum over them of "
        "P(realised below the bar) under Binomial(isolates, predicted share).\n\n"
        + table(["check", "query-months", "observed below", "expected below", "observed / expected"], lines)
    )

    # Metric 3: against the hospital antibiogram.
    lines = []
    rng = np.random.default_rng(SEED)
    months = sorted(rows["month"].unique())
    for sev in ("mild", "severe"):
        t = top[top["severity"] == sev].set_index(KEY)
        b = base[base["severity"] == sev].set_index(KEY)
        j = t.join(b, rsuffix="_b", how="inner")
        per_month = j.groupby("month")[["covered", "known", "covered_b", "known_b"]].sum()
        diffs = []
        for _ in range(BOOT):
            s = per_month.loc[rng.choice(months, len(months))].sum()
            diffs.append(s["covered"] / s["known"] - s["covered_b"] / s["known_b"])
        lo, hi = np.percentile(diffs, [2.5, 97.5])
        k, n = pooled(j)
        kb, nb = pooled(j, "covered_b", "known_b")
        ka, na = pooled(j, "allCovered", "allKnown")
        kab, nab = pooled(j, "allCovered_b", "allKnown_b")
        same = (j["antibiotic"] == j["antibiotic_b"]).mean()
        everyone = int(j["targetIsolates"].sum())
        lines.append([
            sev, len(j), pct(k, n), pct(kb, nb), f"{100 * (k / n - kb / nb):+.1f} ({100 * lo:+.1f} to {100 * hi:+.1f})",
            pct(ka, na), pct(kab, nab), pct(ka, everyone), pct(kab, everyone), f"{100 * (j['aware'] == 'Access').mean():.0f} %", f"{100 * (j['aware_b'] == 'Access').mean():.0f} %",
            f"{100 * same:.0f} %",
        ])
    out.append(
        "### 3. Against the hospital antibiogram (baseline)\n\nSame query-months. Difference in points with a 95 % interval "
        f"from {BOOT} bootstrap resamples of target months (seed {SEED}). Realised shares leave out isolates the pick was not "
        "tested on; the 'untested as not covered' columns divide by every target isolate instead (added after the run, see "
        "Deviations).\n\n"
        + table(["severity", "query-months", "shipped realised", "baseline realised", "shipped − baseline", "shipped, all organisms",
                 "baseline, all organisms", "shipped, untested as not covered", "baseline, untested as not covered", "shipped Access",
                 "baseline Access", "same pick"], lines)
    )
    lines = []
    for sev in ("mild", "severe"):
        j = top[top["severity"] == sev].merge(base[base["severity"] == sev], on=KEY, suffixes=("", "_b"))
        for (a, b), d in j.groupby(["antibiotic", "antibiotic_b"]):
            lines.append([sev, a, b, len(d)])
    out.append("Pick against baseline pick:\n\n" + table(["severity", "shipped top pick", "baseline pick", "query-months"], lines))

    # Context.
    lv = top[top["severity"] == "mild"].groupby(["specimen", "level"]).size().unstack(fill_value=0)
    out.append("### Levels used (per unit, specimen and month)\n\n" + table(["specimen", *lv.columns], [[s, *map(int, r)] for s, r in lv.iterrows()]))
    nothing = [[sev, pct(int((top[top["severity"] == sev]["standing"] != "clears").sum()), int((top["severity"] == sev).sum()))] for sev in ("mild", "severe")]
    out.append(f"{n_queries // 2} unit × specimen × month queries with target isolates.\n\n" + table(["severity", "no antibiotic clears"], nothing))
    if not combos.empty:
        lines = []
        for standing, d in combos.groupby("standing"):
            k, n = pooled(d)
            pairs = ", ".join(f"{p} {c}" for p, c in d["pair"].value_counts().items())
            lines.append([standing, len(d), pairs, f"{100 * d['share'].mean():.1f} %", pct(k, n), n])
        out.append("### Combinations (severe, first pair when no single antibiotic clears)\n\n"
                   + table(["standing", "query-months", "pairs", "mean predicted", "realised", "isolates"], lines))
    return "\n\n".join(out)


planted = rows.apply(lambda r: (r["ward"], r["month"]) in PLANTED, axis=1)
planted_c = combos.apply(lambda r: (r["ward"], r["month"]) in PLANTED, axis=1) if not combos.empty else []
text = "# 0010 results\n\n" + report(rows, combos, "All query-months") + "\n\n" + report(
    rows[~planted], combos[~planted_c] if len(combos) else combos, "Without the planted outbreak months (URO 2025-06/07, ICU 2026-02/03)"
)
(OUT / "results.md").write_text(text + "\n")
print(text)
