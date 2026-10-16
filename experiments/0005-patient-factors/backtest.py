"""0005: do patient factors predict coverage better than the hospital's last year? (README.md).

Run from the repository root:
    uv run python experiments/0005-patient-factors/backtest.py
"""

from __future__ import annotations

import math
from pathlib import Path

from aei.counting import first_isolates
from aei.dataset import IsolateRecord, load_records
from aei.dates import add_days, days_between
from aei.domain import ANTIBIOTICS, SPECIMENS
from aei.eucast import effective_result, suits_specimen
from aei.jscompat import js_round, mulberry32, table, to_fixed
from aei.logistic import LogisticModel, fit_logistic, predict

DATA = Path("data/synthetic_microbiology_dataset")
OUT = Path("experiments/0005-patient-factors/out")
FIRST_TARGET = "2024-09-30"
LAST_DAY = "2026-09-27"
PERIOD = 28
TRAIN_PERIODS = 13
BOOTSTRAPS = 1000

records, cultures = load_records(DATA)
ward_type = {c.culture_id: c.ward_type for c in cultures}

# Outcome per isolate and antibiotic (as in 0004).
outcome: dict[str, dict[str, int]] = {}
for r in records:
    o = {}
    for a in ANTIBIOTICS:
        if not suits_specimen(a, r.specimen):
            continue
        e = effective_result(r, a)
        if e.basis == "untested":
            continue
        o[a] = 1 if e.result == "S" else 0
    outcome[r.isolate_id] = o

# Each patient's isolates in date order, for the earlier-findings features.
by_patient: dict[str, list[IsolateRecord]] = {}
for r in records:
    by_patient.setdefault(r.patient_id, []).append(r)
for items in by_patient.values():
    items.sort(key=lambda r: r.sample_date)


def earlier(r: IsolateRecord) -> list[IsolateRecord]:
    return [e for e in by_patient[r.patient_id] if e.sample_date < r.sample_date and days_between(e.sample_date, r.sample_date) <= 365]


MODELS = ["A all", "B earlier resistance", "C demographics and stay"]
FEATURE_NAMES = {
    "A all": ["male", "age (per decade)", "inpatient", "day 3+ of stay", "earlier isolate not covered", "earlier ESBL/MRSA/VRE/CPE"],
    "B earlier resistance": ["earlier isolate not covered", "earlier ESBL/MRSA/VRE/CPE"],
    "C demographics and stay": ["male", "age (per decade)", "inpatient", "day 3+ of stay"],
}


def features(r: IsolateRecord, a: str) -> dict[str, list[float]]:
    prior = earlier(r)
    not_covered = 1 if any(outcome[e.isolate_id].get(a) == 0 for e in prior) else 0
    flagged = 1 if any(e.phenotypes for e in prior) else 0
    male = 1 if r.sex == "M" else 0
    age = (r.age_years - 60) / 10
    inpatient = 1 if ward_type.get(r.culture_id) == "in" else 0
    onset = 1 if r.admission_date and days_between(r.admission_date, r.sample_date) >= 2 else 0
    return {
        "A all": [male, age, inpatient, onset, not_covered, flagged],
        "B earlier resistance": [not_covered, flagged],
        "C demographics and stay": [male, age, inpatient, onset],
    }


# First isolates per 28-day period on a grid that ends each period just before a target window.
def period_start(i: int) -> str:
    return add_days(FIRST_TARGET, PERIOD * i)


periods: dict[int, list[IsolateRecord]] = {}


def period_of(i: int) -> list[IsolateRecord]:
    if i not in periods:
        start = period_start(i)
        end = add_days(start, PERIOD - 1)
        periods[i] = first_isolates([r for r in records if start <= r.sample_date <= end], (start, end))
    return periods[i]


feature_cache: dict[tuple[str, str], dict[str, list[float]]] = {}


def features_of(r: IsolateRecord, a: str) -> dict[str, list[float]]:
    k = (r.isolate_id, a)
    if k not in feature_cache:
        feature_cache[k] = features(r, a)
    return feature_cache[k]


Fit = tuple[float, dict[str, LogisticModel]]  # hospital share covered, models


def fit_all(train_periods: list[int]) -> dict[str, Fit]:
    rows = [r for i in train_periods for r in period_of(i)]
    fits: dict[str, Fit] = {}
    for specimen in SPECIMENS:
        for ab in ANTIBIOTICS:
            if not suits_specimen(ab, specimen):
                continue
            train = [r for r in rows if r.specimen == specimen and ab in outcome[r.isolate_id]]
            if not train:
                continue
            y = [outcome[r.isolate_id][ab] for r in train]
            models = {m: fit_logistic([features_of(r, ab)[m] for r in train], y, l2=1) for m in MODELS}
            fits[f"{specimen}|{ab}"] = (sum(y) / len(y), models)
    return fits


NAMES = ["baseline: hospital 365 d", *(f"logistic {m}" for m in MODELS)]
per_window: list[dict] = []
unconverged = 0
n_fits = 0


def clip(p: float) -> float:
    return min(0.999, max(0.001, p))


j = 0
while add_days(period_start(j), PERIOD - 1) <= LAST_DAY:
    models = fit_all([j - TRAIN_PERIODS + k for k in range(TRAIN_PERIODS)])
    for _, ms in models.values():
        for m in MODELS:
            n_fits += 1
            if not ms[m].converged:
                unconverged += 1
    acc = {"brier": [0.0] * len(NAMES), "logloss": [0.0] * len(NAMES), "n": 0}
    for r in period_of(j):
        for a, y in outcome[r.isolate_id].items():
            fit = models.get(f"{r.specimen}|{a}")
            if fit is None:
                continue
            p_hosp, ms = fit
            f = features_of(r, a)
            ps = [p_hosp, *(predict(ms[m], f[m]) for m in MODELS)]
            acc["n"] += 1
            for i, p in enumerate(ps):
                acc["brier"][i] += (p - y) ** 2
                acc["logloss"][i] -= math.log(clip(p) if y else 1 - clip(p))
    per_window.append(acc)
    j += 1


def summarise(metric: str) -> list[list[str]]:
    def total(ws: list[dict], i: int) -> float:
        s = 0.0
        for w in ws:
            s += w[metric][i]
        n = 0
        for w in ws:
            n += w["n"]
        return s / n

    rand = mulberry32(2026)
    diffs: list[list[float]] = [[] for _ in NAMES]
    for _ in range(BOOTSTRAPS):
        sample = [per_window[math.floor(rand() * len(per_window))] for _ in per_window]
        base = total(sample, 0)
        for i in range(len(NAMES)):
            diffs[i].append(total(sample, i) - base)

    def q(xs: list[float], p: float) -> float:
        return sorted(xs)[math.floor(p * (len(xs) - 1))]

    base = total(per_window, 0)
    rows = []
    for i, name in enumerate(NAMES):
        v = total(per_window, i)
        interval = "–" if i == 0 else f"{to_fixed(q(diffs[i], 0.025), 4)} to {to_fixed(q(diffs[i], 0.975), 4)}"
        rows.append([name, to_fixed(v, 4), to_fixed(v - base, 4), interval])
    return rows


# Odds ratios of model A fitted on the last 13 periods of data.
last_j = len(per_window) - 1
final_fits = fit_all([last_j - TRAIN_PERIODS + 1 + k for k in range(TRAIN_PERIODS)])
or_rows = []
for key, (p_hosp, ms) in final_fits.items():
    specimen, a = key.split("|")
    w = ms["A all"].weights
    or_rows.append([specimen, a, f"{js_round(100 * p_hosp)} %", *(to_fixed(math.exp(-w[k + 1]), 2) for k in range(len(FEATURE_NAMES["A all"])))])

n = sum(w["n"] for w in per_window)
md = (
    f"# 0005 results\n\nTarget windows: {len(per_window)}; predictions: {n}; model fits: {n_fits}, not converged: {unconverged}. "
    f"Lower is better; difference to the baseline with a 95 % interval from {BOOTSTRAPS} bootstrap resamples of target windows "
    "(seed 2026). All computed.\n\n"
)
md += f"### Brier score\n\n{table(['model', 'mean', 'minus baseline', '95 % interval'], summarise('brier'))}\n\n"
md += f"### Log loss\n\n{table(['model', 'mean', 'minus baseline', '95 % interval'], summarise('logloss'))}\n\n"
md += (
    f"### Odds ratios for NOT being covered, model A, fitted on the last {TRAIN_PERIODS * PERIOD} days "
    "(penalised, so shrunk toward 1)\n\n"
)
md += f"{table(['specimen', 'antibiotic', 'covered (hospital)', *FEATURE_NAMES['A all']], or_rows)}\n"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "results.md").write_text(md)
print(md)
