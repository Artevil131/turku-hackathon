"""Monthly outbreak signals in regional notification counts (experiments/0008), a simplified Farrington test.

    signals = regional_signals(series, first_target="2024-01")   # series: group_sid, group, region, month, cases
    view = regional_view(thl, fetched="2026-10-16")               # the server's /api/regional data (D-037)

For each series and target month t: a Poisson GLM with log link on months t-36 to t-1 (intercept, linear time, one
annual harmonic), quasi-Poisson dispersion phi = max(1, Pearson chi2 / df); the month signals when P(X >= observed)
under a negative binomial with mean mu and variance phi*mu (Poisson when phi = 1) is below alpha and the month has at
least `min_cases`. Past outbreaks are not down-weighted.
"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from scipy import stats

from aei.forecasts import FORECAST_METHOD, monthly_forecasts

SIGNAL_COLUMNS = ["group", "region", "month", "cases", "expected", "dispersion", "p"]


def upper_tail(observed: int, mu: float, phi: float) -> float:
    """P(X >= observed) for a negative binomial with mean mu and variance phi*mu; Poisson when phi is 1."""
    if phi <= 1.0 + 1e-9:
        return float(stats.poisson.sf(observed - 1, mu))
    size = mu / (phi - 1.0)
    return float(stats.nbinom.sf(observed - 1, size, size / (size + mu)))


def expected_month(counts: np.ndarray, t: int, baseline: int = 36) -> tuple[float, float]:
    """Expected count and dispersion for month index t from the `baseline` months before it. Needs `aei[analysis]`."""
    import statsmodels.api as sm

    y = counts[t - baseline : t]
    if y.sum() == 0:
        return 0.5 / baseline, 1.0
    x = np.arange(t - baseline, t, dtype=float)
    design = np.column_stack([np.ones_like(x), x, np.sin(2 * np.pi * x / 12), np.cos(2 * np.pi * x / 12)])
    target = np.array([1.0, t, np.sin(2 * np.pi * t / 12), np.cos(2 * np.pi * t / 12)])
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit = sm.GLM(y, design, family=sm.families.Poisson()).fit()
    return float(np.exp(target @ fit.params)), max(1.0, float(fit.pearson_chi2 / fit.df_resid))


def regional_signals(
    series: pd.DataFrame, *, first_target: str, baseline: int = 36, alpha: float = 1e-3, min_cases: int = 5
) -> pd.DataFrame:
    """Every (group, region, month) from `first_target` on that signals; strongest first. `series` needs columns
    group_sid, group, region, month (YYYY-MM) and cases, and at least `baseline` months before `first_target`."""
    months = sorted(series["month"].unique())
    index = {m: i for i, m in enumerate(months)}
    rows = []
    for (_, group, region), s in series.groupby(["group_sid", "group", "region"]):
        counts = s.set_index("month")["cases"].reindex(months, fill_value=0).to_numpy(dtype=float)
        for m in months:
            if m < first_target:
                continue
            t = index[m]
            observed = int(counts[t])
            if observed < min_cases or t < baseline:
                continue
            mu, phi = expected_month(counts, t, baseline)
            p = upper_tail(observed, mu, phi)
            if p < alpha:
                rows.append({"group": group, "region": region, "month": m, "cases": observed, "expected": mu, "dispersion": phi, "p": p})
    return pd.DataFrame(rows, columns=SIGNAL_COLUMNS).sort_values("p") if rows else pd.DataFrame(columns=SIGNAL_COLUMNS)


NATIONAL = "Finland (all counties)"
# The settings of experiments/0008.
VIEW_SETTINGS = {"from_month": "2021-01", "first_target": "2024-01", "baseline": 36, "alpha": 1e-3, "min_cases": 5}
# A signal is "strong" when it survives a Bonferroni correction at this level over every series-month tested
# (experiments/0008, review round 2: most of the weaker signals could be chance).
FAMILY_ALPHA = 0.05


def regional_view(thl: pd.DataFrame, *, fetched: str) -> dict:
    """County series and their signals for the network view, as JSON-ready data (D-037). `thl` is
    `aei.thl.fetch_ttr_monthly()`'s table; the month of `fetched` is left out, being incomplete. The national total is
    added as one more region. Series run from VIEW_SETTINGS["from_month"]; signals are tested from "first_target".
    Each signal says whether it is strong: p below FAMILY_ALPHA divided by the number of series-months tested."""
    cfg = VIEW_SETTINGS
    last = (pd.Period(fetched[:7], "M") - 1).strftime("%Y-%m")
    thl = thl[(thl["month"] >= cfg["from_month"]) & (thl["month"] <= last)]
    national = thl.groupby(["group_sid", "group", "month"], as_index=False)["cases"].sum().assign(region=NATIONAL)
    series = pd.concat([thl[["group_sid", "group", "region", "month", "cases", "incidence_per_100k"]], national], ignore_index=True)
    months = sorted(series["month"].unique())
    out_series = []
    for (group, region), s in series.groupby(["group", "region"], sort=True):
        s = s.set_index("month").reindex(months)
        incidence = [None if pd.isna(v) else round(float(v), 3) for v in s["incidence_per_100k"]]
        out_series.append({
            "group": group,
            "region": region,
            "cases": [int(v) for v in s["cases"].fillna(0)],
            "incidencePer100k": incidence if region != NATIONAL else None,
        })
    signals = regional_signals(
        series, first_target=cfg["first_target"], baseline=cfg["baseline"], alpha=cfg["alpha"], min_cases=cfg["min_cases"]
    )
    tested = sum(1 for m in months if m >= cfg["first_target"]) * len(out_series)
    strong_below = FAMILY_ALPHA / tested if tested else 0.0
    return {
        "source": "THL communicable disease register (tartuntatautirekisteri), CC BY 4.0 (c) THL",
        "fetched": fetched,
        "settings": {
            "firstTarget": cfg["first_target"],
            "baseline": cfg["baseline"],
            "alpha": cfg["alpha"],
            "minCases": cfg["min_cases"],
            "familyAlpha": FAMILY_ALPHA,
            "testedSeriesMonths": tested,
            "forecastMethod": FORECAST_METHOD,
        },
        "months": months,
        "groups": sorted(series["group"].unique()),
        "regions": sorted(r for r in series["region"].unique() if r != NATIONAL) + [NATIONAL],
        "series": out_series,
        "forecasts": monthly_forecasts(series, fetched=fetched, national_region=NATIONAL),
        "signals": [
            {"group": r.group, "region": r.region, "month": r.month, "cases": int(r.cases),
             "expected": round(float(r.expected), 3), "dispersion": round(float(r.dispersion), 3), "p": float(f"{r.p:.3g}"),
             "strong": bool(r.p < strong_below)}
            for r in signals.itertuples()
        ],
    }
