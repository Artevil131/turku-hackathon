"""0008: regional signals in THL county data, and the synthetic hospital against its county (README.md).

Run from the repository root, after `uv run python scripts/fetch_thl_ttr.py`:
    uv run python experiments/0008-regional-signals/analysis.py
"""

from __future__ import annotations

import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats

from aei.dataset import join_isolates, load_dataset

THL = Path("data/external/thl/ttr_monthly.csv")
DATA = Path("data/synthetic_microbiology_dataset")
OUT = Path("experiments/0008-regional-signals/out")
FIRST_TARGET, LAST_TARGET = "2024-01", "2026-09"
BASELINE = 36
ALPHA = 1e-3
MIN_CASES = 5
NATIONAL = "Finland (all counties)"

warnings.filterwarnings("ignore")
t0 = time.time()
thl = pd.read_csv(THL)
thl = thl[(thl["month"] >= "2021-01") & (thl["month"] <= LAST_TARGET)]
national = thl.groupby(["group_sid", "group", "month"], as_index=False)["cases"].sum().assign(region=NATIONAL)
series = pd.concat([thl[["group_sid", "group", "region", "month", "cases"]], national], ignore_index=True)
months = sorted(series["month"].unique())
index = {m: i for i, m in enumerate(months)}


def upper_tail(observed: int, mu: float, phi: float) -> float:
    if phi <= 1.0 + 1e-9:
        return float(stats.poisson.sf(observed - 1, mu))
    size = mu / (phi - 1.0)
    return float(stats.nbinom.sf(observed - 1, size, size / (size + mu)))


rows = []
for (sid, group, region), s in series.groupby(["group_sid", "group", "region"]):
    counts = s.set_index("month")["cases"].reindex(months, fill_value=0).to_numpy(dtype=float)
    for m in months:
        if m < FIRST_TARGET:
            continue
        t = index[m]
        y = counts[t - BASELINE : t]
        obs = int(counts[t])
        if obs < MIN_CASES:
            continue
        x = np.arange(t - BASELINE, t, dtype=float)
        X = np.column_stack([np.ones_like(x), x, np.sin(2 * np.pi * x / 12), np.cos(2 * np.pi * x / 12)])
        xt = np.array([1.0, t, np.sin(2 * np.pi * t / 12), np.cos(2 * np.pi * t / 12)])
        if y.sum() == 0:
            mu, phi = 0.5 / BASELINE, 1.0
        else:
            fit = sm.GLM(y, X, family=sm.families.Poisson()).fit()
            mu = float(np.exp(xt @ fit.params))
            phi = max(1.0, float(fit.pearson_chi2 / fit.df_resid))
        p = upper_tail(obs, mu, phi)
        if p < ALPHA:
            rows.append({"group": group, "region": region, "month": m, "cases": obs, "expected": mu, "dispersion": phi, "p": p})
signals = pd.DataFrame(rows).sort_values("p") if rows else pd.DataFrame(columns=["group", "region", "month", "cases", "expected", "dispersion", "p"])
tested = series[(series["month"] >= FIRST_TARGET)]
n_series = tested.groupby(["group_sid", "region"]).ngroups
n_months = tested["month"].nunique()

# ---------- synthetic hospital against Varsinais-Suomi ----------
iso = join_isolates(load_dataset(DATA))
iso["month"] = iso["sample_date"].dt.strftime("%Y-%m")
syn = {}
for label, mask in {
    "ESBL E. coli": (iso["organism"] == "Escherichia coli") & (iso["esbl"] == 1),
    "MRSA": iso["mrsa"] == 1,
}.items():
    first = iso[mask].sort_values("sample_date").drop_duplicates(["patient_id", "organism", "month"])
    syn[label] = first.groupby("month").size()
vs = thl[thl["region"].str.startswith("Varsinais")]
pairs = {"ESBL E. coli": "ESBL carriage, E. coli", "MRSA": "MRSA carriage"}
comparison = []
for label, group in pairs.items():
    county = vs[vs["group"] == group].set_index("month")["cases"]
    ms = [m for m in county.index if "2023-10" <= m <= "2026-09"]
    a = syn[label].reindex(ms, fill_value=0).astype(float)
    b = county.reindex(ms).astype(float)
    r, p = stats.pearsonr(a, b)
    comparison.append([label, group, f"{a.mean():.1f}", f"{b.mean():.1f}", f"{a.sum() / b.sum():.2f}", f"{r:.2f}", f"{p:.2f}", len(ms)])


def table(head: list[str], body: list[list]) -> str:
    return "\n".join([f"| {' | '.join(head)} |", "|" + "|".join("---" for _ in head) + "|", *(f"| {' | '.join(str(c) for c in r)} |" for r in body)])


by_group = signals.groupby("group").size().reindex(sorted(series["group"].unique()), fill_value=0)
md = f"# 0008 results\n\nTHL cases cube as fetched, months {FIRST_TARGET} to {LAST_TARGET} ({n_months} months), {n_series} series (11 report groups × 23 counties and the whole country). Signal: upper tail below {ALPHA} and at least {MIN_CASES} cases. Computed in {time.time() - t0:.0f} s.\n\n"
md += f"Signals: **{len(signals)}** of {n_series * n_months} series-months tested.\n\n"
md += table(["report group", "signals"], [[g, n] for g, n in by_group.items()]) + "\n\n"
md += "### All signals, strongest first\n\n" + table(
    ["report group", "region", "month", "cases", "expected", "dispersion", "p"],
    [[r.group, r.region, r.month, r.cases, f"{r.expected:.1f}", f"{r.dispersion:.1f}", f"{r.p:.1e}"] for r in signals.itertuples()],
) + "\n\n"
md += "### Synthetic hospital against Varsinais-Suomi, monthly, 2023-10 to 2026-09\n\nSynthetic: first isolates per patient, organism and month with the flag. County: THL carriage cases (all specimen types reported to the register).\n\n"
md += table(["synthetic series", "county series", "synthetic mean / month", "county mean / month", "ratio of totals", "Pearson r", "p", "months"], comparison) + "\n"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "results.md").write_text(md)
print(md)
