"""One-month phenotype-total county forecasts using experiment 0020's R1 (D-045).

R1 is a 24-month rolling mean, no trend or harmonics, with a mean floor of 0.1 and a
pooled quasi-Poisson negative-binomial predictive. The central 90% interval is its
5th and 95th percentiles. VRE is omitted: 0020's review says its ship rule should
not fire. County means use only their own history, not other counties' counts;
the predictive dispersion is pooled over nonempty counties of the same phenotype.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from aei.thl import PHENOTYPE_GROUPS

FORECAST_METHOD = (
    "Forecast (experiment 0020 R1, D-045), per phenotype total per county and nationally: "
    "24-month rolling mean, no trend or harmonics; mean floor 0.1; "
    "pooled quasi-Poisson negative-binomial predictive (Poisson at dispersion 1); "
    "central 90% predictive interval. Own-history mean, dispersion pooled over nonempty counties "
    "of the phenotype; national dispersion separate. VRE omitted per 0020's review. "
    "Smoothed level, not a surge prediction. Recent THL counts may be revised."
)


def monthly_forecasts(thl: pd.DataFrame, *, fetched: str, national_region: str | None = None) -> list[dict]:
    """Forecast phenotype totals after the last observed, calendar-complete month.

    Accepts `aei.thl.fetch_ttr_monthly()`'s table. Missing report groups and
    county-months count as zero from 2021-01, exactly as in 0020; at least 24
    calendar months are required. The fetch month and later data are excluded.
    If supplied, `national_region` identifies an already-added national total;
    its dispersion stays separate from the county pool, as in 0020.
    """
    last_complete = str(pd.Period(fetched[:7], "M") - 1)
    history = thl[(thl["month"] >= "2021-01") & (thl["month"] <= last_complete)]
    if history.empty:
        return []
    last = history["month"].max()
    months = pd.period_range("2021-01", last, freq="M").astype(str)
    if len(months) < 24:
        return []
    window = months[-24:]
    target = str(pd.Period(last, "M") + 1)
    rows = []
    regions = sorted(history["region"].unique())
    for phenotype, groups in PHENOTYPE_GROUPS.items():
        if phenotype == "VRE":
            continue
        sub = history[history["group"].isin(groups)]
        table = sub.groupby(["region", "month"])["cases"].sum().unstack("month").reindex(index=regions, columns=window).fillna(0)
        y = table.to_numpy(dtype=float)
        means = y.mean(axis=1)
        nonempty = means > 0
        chi2 = np.zeros(len(means))
        chi2[nonempty] = ((y[nonempty] - means[nonempty, None]) ** 2 / means[nonempty, None]).sum(axis=1)
        # R1 has one fitted parameter. Empty windows have no residuals and keep phi = 1.
        use = nonempty & (table.index.to_numpy() != national_region)
        pooled = max(1.0, float(chi2[use].sum() / (23 * use.sum()))) if use.any() else 1.0
        for i, region in enumerate(table.index):
            phi = max(1.0, float(chi2[i] / 23)) if region == national_region else pooled
            if not nonempty[i]:
                phi = 1.0
            mean = max(float(means[i]), 0.1)
            predictive = stats.poisson(mean) if phi <= 1.0 + 1e-9 else stats.nbinom(mean / (phi - 1.0), 1.0 / phi)
            low, high = predictive.ppf([0.05, 0.95])
            rows.append({"phenotype": phenotype, "region": region, "month": target, "mean": mean,
                         "low": int(low), "high": int(high), "level": 0.9})
    return rows
