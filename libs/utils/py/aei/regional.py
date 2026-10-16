"""Monthly outbreak signals in regional notification counts (experiments/0008), a simplified Farrington test.

    signals = regional_signals(series, first_target="2024-01")   # series: group_sid, group, region, month, cases

For each series and target month t: a Poisson GLM with log link on months t-36 to t-1 (intercept, linear time, one
annual harmonic), quasi-Poisson dispersion phi = max(1, Pearson chi2 / df); the month signals when P(X >= observed)
under a negative binomial with mean mu and variance phi*mu (Poisson when phi = 1) is below alpha and the month has at
least `min_cases`. Past outbreaks are not down-weighted.
"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats

SIGNAL_COLUMNS = ["group", "region", "month", "cases", "expected", "dispersion", "p"]


def upper_tail(observed: int, mu: float, phi: float) -> float:
    """P(X >= observed) for a negative binomial with mean mu and variance phi*mu; Poisson when phi is 1."""
    if phi <= 1.0 + 1e-9:
        return float(stats.poisson.sf(observed - 1, mu))
    size = mu / (phi - 1.0)
    return float(stats.nbinom.sf(observed - 1, size, size / (size + mu)))


def expected_month(counts: np.ndarray, t: int, baseline: int = 36) -> tuple[float, float]:
    """Expected count and dispersion for month index t from the `baseline` months before it."""
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
