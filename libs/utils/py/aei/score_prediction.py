"""Prediction scoring of benchmarks/METRICS.md (P1 and P2), as specified in benchmarks/overnight-2026-10-17/harness-spec.md.

P2, county forecasts. THL's register gives monthly cases per county and report group; the four phenotype series per
region are sums of report groups (`PHENOTYPE_GROUPS`), 23 regions plus the national total. A forecaster is a function
`forecast(history, target_month) -> {series_key: distribution}`; a distribution is anything with `logpmf(y)` and
`ppf(q)` (a frozen scipy distribution qualifies). It receives only the months before the target (`History`), and
`score_forecaster` audits that (`PeekingError`).

    from aei import score_prediction as sp
    metrics, intervals, n = sp.score_forecaster(sp.seasonal_naive)      # {"P2": {...}}, same shape, same shape
    table = sp.evaluate(my_forecaster).table()                          # raw MAE and log score per group, for the record

Targets 2024-10 to 2026-09, one month ahead. The series are THL's as fetched (`harness.THL_FETCHED`), final values for
every target month; THL revises recent months, so the scores are not strictly as-of (METRICS.md P2) and the newest two
months are still incomplete at fetch time, which is why every key also has a "without the last two months" version.

P1, exposure ranking after an event (ENGINE.md section 4). `flow_matrix`, `exposure`, `unit_outcome`, `auc`,
`rewired_auc_null` and the wrapper `score_exposure` (E1 and E2 are in `EVENTS`).

    result = sp.score_exposure(cultures, records, source="URO", onset="2025-05-30", flt=sp.E1_FILTER)
    result.metrics    # {"P1": {auc_share_a05, auc_raw_a05, auc_share_a001, auc_raw_a001, null_p_share_a05, ...}}

Everything is vectorised: 1,000 label permutations of the nine-unit flow graph take a few seconds.
"""

from __future__ import annotations

import contextlib
import functools
from collections.abc import Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Protocol

import numpy as np
import pandas as pd
from scipy import stats

from aei import harness
from aei.dataset import Culture, IsolateRecord
from aei.dates import add_days
from aei.domain import UNITS
from aei.regional import NATIONAL
from aei.thl import GROUPS, PHENOTYPE_GROUPS

# ---------------------------------------------------------------------------------------------------------------------
# P2: county series
# ---------------------------------------------------------------------------------------------------------------------

PHENOTYPES: tuple[str, ...] = tuple(PHENOTYPE_GROUPS)
assert {g for gs in PHENOTYPE_GROUPS.values() for g in gs} == set(GROUPS.values()), "every THL report group belongs to one phenotype"

FIRST_MONTH = "2021-01"
FIRST_TARGET, LAST_TARGET = "2024-10", "2026-09"
Key = tuple[str, str]  # (phenotype, region); region is NATIONAL for the country total


def month_add(month: str, k: int) -> str:
    """The month `k` months after `month` ("YYYY-MM"); negative k goes back."""
    return str(pd.Period(month, "M") + k)


def month_range(first: str, last: str) -> list[str]:
    return [str(p) for p in pd.period_range(first, last, freq="M")]


TARGETS: tuple[str, ...] = tuple(month_range(FIRST_TARGET, LAST_TARGET))  # 24 months


@dataclass(frozen=True)
class CountySeries:
    """The 96 series (4 phenotypes x (23 regions + national)) over `months`, as an array (series x month)."""

    keys: tuple[Key, ...]
    months: tuple[str, ...]
    values: np.ndarray  # float, shape (len(keys), len(months)), read-only

    def index(self, key: Key) -> int:
        return self.keys.index(key)

    def series(self, key: Key) -> np.ndarray:
        return self.values[self.index(key)]

    def frame(self) -> pd.DataFrame:
        """Tidy: one row per series and month, columns phenotype, region, month, cases."""
        s, m = np.meshgrid(np.arange(len(self.keys)), np.arange(len(self.months)), indexing="ij")
        return pd.DataFrame(
            {
                "phenotype": [self.keys[i][0] for i in s.ravel()],
                "region": [self.keys[i][1] for i in s.ravel()],
                "month": [self.months[j] for j in m.ravel()],
                "cases": self.values.ravel().astype(int),
            }
        )


@dataclass(frozen=True)
class History:
    """What a forecaster sees at `target`: every series up to the month before it, nothing else."""

    target: str
    keys: tuple[Key, ...]
    months: tuple[str, ...]  # all before `target`, consecutive, ending the month before it
    values: np.ndarray  # (series x month), read-only

    def index(self, key: Key) -> int:
        return self.keys.index(key)

    def series(self, key: Key) -> np.ndarray:
        return self.values[self.index(key)]

    def last(self, lag: int = 1) -> np.ndarray:
        """The value `lag` months before the target, for every series (lag 1: last month, 12: same month last year)."""
        return self.values[:, -lag]

    def frame(self) -> pd.DataFrame:
        return CountySeries(self.keys, self.months, self.values).frame()


class Distribution(Protocol):
    def logpmf(self, y): ...
    def ppf(self, q): ...


Forecaster = Callable[[History, str], Mapping[Key, Distribution]]

_override: CountySeries | None = None  # set only while strictness is audited


def _build_county_series(thl: pd.DataFrame, last_month: str) -> CountySeries:
    months = month_range(FIRST_MONTH, last_month)
    thl = thl[(thl["month"] >= FIRST_MONTH) & (thl["month"] <= last_month)]
    regions = sorted(thl["region"].unique())
    keys: list[Key] = []
    rows = []
    for ph, groups in PHENOTYPE_GROUPS.items():
        sub = thl[thl["group"].isin(groups)]
        table = sub.groupby(["region", "month"])["cases"].sum().unstack("month").reindex(index=regions, columns=months).fillna(0)
        mat = table.to_numpy(dtype=float)
        for r, region in enumerate(regions):
            keys.append((ph, region))
            rows.append(mat[r])
        keys.append((ph, NATIONAL))
        rows.append(mat.sum(axis=0))
    values = np.vstack(rows)
    values.setflags(write=False)
    return CountySeries(tuple(keys), tuple(months), values)


@functools.lru_cache(maxsize=1)
def _real_county_series() -> CountySeries:
    thl = pd.read_csv(harness.THL)
    last = month_add(harness.THL_FETCHED[:7], -1)  # the month of the fetch is incomplete and left out (as aei.regional)
    return _build_county_series(thl, last)


def county_series() -> CountySeries:
    """The 96 phenotype series from `data/external/thl/ttr_monthly.csv`, months 2021-01 to the month before the fetch
    (`harness.THL_FETCHED`): per phenotype, the 23 regions (alphabetical) then the national total. A report group
    missing for a region and month counts as zero, as in aei.regional. Use `.values` for the (series x month) array
    and `.frame()` for the tidy table."""
    return _override if _override is not None else _real_county_series()


def is_national(key: Key) -> bool:
    return key[1] == NATIONAL


class PeekingError(RuntimeError):
    """A forecaster's output depended on data at or after the target month."""


@contextlib.contextmanager
def _poisoned(first_bad_month: str, poison: float = 1.0e4) -> Iterator[None]:
    """For the audit: `county_series()` returns the real series with every month from `first_bad_month` on replaced by
    an absurd number, so a forecaster that reads it directly gets wrong answers it cannot hide."""
    global _override
    real = _real_county_series()
    j = real.months.index(first_bad_month)
    vals = real.values.copy()
    vals[:, j:] = poison
    vals.setflags(write=False)
    _override = CountySeries(real.keys, real.months, vals)
    try:
        yield
    finally:
        _override = None


# ---------------------------------------------------------------------------------------------------------------------
# P2: baselines (Choices 6)
# ---------------------------------------------------------------------------------------------------------------------


class PointPoisson:
    """A Poisson forecast around a point value with mean max(point, floor); its median is the point itself, so MAE is
    that of the point forecast (persistence: y(t-1)). The floor keeps the log score finite after a zero month."""

    __slots__ = ("point", "mean")

    def __init__(self, point: float, floor: float = 0.5) -> None:
        self.point = float(point)
        self.mean = max(self.point, floor)

    def logpmf(self, y):
        return stats.poisson.logpmf(y, self.mean)

    def ppf(self, q):
        q = np.asarray(q, dtype=float)
        out = stats.poisson.ppf(q, self.mean)
        out = np.where(q == 0.5, self.point, out)
        return float(out) if out.ndim == 0 else out


def persistence(history: History, target: str) -> dict[Key, PointPoisson]:
    """Poisson with mean max(y(t-1), 0.5); point forecast y(t-1)."""
    return {key: PointPoisson(y) for key, y in zip(history.keys, history.last(1))}


def seasonal_naive(history: History, target: str) -> dict[Key, PointPoisson]:
    """Poisson with mean max(y(t-12), 0.5); point forecast y(t-12)."""
    return {key: PointPoisson(y) for key, y in zip(history.keys, history.last(12))}


# ---------------------------------------------------------------------------------------------------------------------
# P2: scoring
# ---------------------------------------------------------------------------------------------------------------------

GROUP_NAMES = ("pooled", *PHENOTYPES, "national")  # pooled: the 92 county series; a phenotype: its 23 counties; national: the 4 totals


def group_masks(keys: Sequence[Key]) -> dict[str, np.ndarray]:
    nat = np.array([is_national(k) for k in keys])
    out = {"pooled": ~nat}
    for ph in PHENOTYPES:
        out[ph] = ~nat & np.array([k[0] == ph for k in keys])
    out["national"] = nat
    return out


@dataclass
class Scores:
    """Per target month and series: the forecaster's absolute error of its predictive median and its log score."""

    targets: tuple[str, ...]
    keys: tuple[Key, ...]
    observed: np.ndarray  # (target x series)
    abs_err: np.ndarray
    log_score: np.ndarray


def _call(forecaster: Forecaster, cs: CountySeries, target: str) -> Mapping[Key, Distribution]:
    i = cs.months.index(target)
    vals = cs.values[:, :i].copy()
    vals.setflags(write=False)
    hist = History(target, cs.keys, cs.months[:i], vals)
    out = forecaster(hist, target)
    missing = [k for k in cs.keys if k not in out]
    if missing:
        raise ValueError(f"forecaster gave no distribution for {len(missing)} series at {target}, first {missing[0]}")
    return out


def run_forecaster(forecaster: Forecaster, targets: Sequence[str] = TARGETS) -> Scores:
    cs = _real_county_series()
    T, S = len(targets), len(cs.keys)
    obs, ae, ls = np.empty((T, S)), np.empty((T, S)), np.empty((T, S))
    for t, target in enumerate(targets):
        out = _call(forecaster, cs, target)
        j = cs.months.index(target)
        for s, key in enumerate(cs.keys):
            d, y = out[key], cs.values[s, j]
            point = float(np.asarray(d.ppf(0.5)))
            if not np.isfinite(point):
                raise ValueError(f"non-finite median for {key} at {target}")
            obs[t, s], ae[t, s], ls[t, s] = y, abs(y - point), float(np.asarray(d.logpmf(y)))
    return Scores(tuple(targets), cs.keys, obs, ae, ls)


@functools.lru_cache(maxsize=4)
def _baseline_scores(name: str, targets: tuple[str, ...]) -> Scores:
    return run_forecaster({"persistence": persistence, "seasonal_naive": seasonal_naive}[name], targets)


def audit_strict(forecaster: Forecaster, targets: Sequence[str] = TARGETS, n: int = 3) -> None:
    """Call the forecaster at `n` targets (first, middle, last, ...) on the real series and again while every month from
    the target on is poisoned in `county_series()`; raise `PeekingError` if its 5, 50 and 95 % quantiles move. Catches a
    forecaster that reads the module's series itself; one that reads the CSV on its own is outside this check, and the
    run is not strict then (say so in the record)."""
    cs = _real_county_series()
    picks = sorted({targets[round(i * (len(targets) - 1) / max(n - 1, 1))] for i in range(n)})

    def q(target: str) -> np.ndarray:
        out = _call(forecaster, cs, target)
        return np.array([[float(np.asarray(out[k].ppf(p))) for p in (0.05, 0.5, 0.95)] for k in cs.keys])

    for target in picks:
        clean = q(target)
        with _poisoned(target):
            dirty = q(target)
        if np.any(np.abs(clean - dirty) > 1.0 + 0.25 * np.abs(clean)):
            raise PeekingError(f"forecast for {target} depends on data from {target} on")


def _group_sums(x: np.ndarray, masks: Mapping[str, np.ndarray]) -> np.ndarray:
    """(target x series) to (target x group): the sum over each group's series."""
    return np.column_stack([x[:, masks[g]].sum(axis=1) for g in GROUP_NAMES])


def _stats(sum_err: np.ndarray, sum_log: np.ndarray, base_err: dict[str, np.ndarray], base_log: dict[str, np.ndarray], idx: np.ndarray, size: np.ndarray) -> dict[str, np.ndarray]:
    """The P2 statistics for every group from per-target group sums, over the target months `idx` (shape (..., T): a
    point estimate has one row, a bootstrap B rows). Each value has shape (..., groups)."""
    def total(x: np.ndarray) -> np.ndarray:
        return x[idx].sum(axis=-2)

    n = size * idx.shape[-1]
    em, lm = total(sum_err), total(sum_log)
    out = {"mae": em / n, "log_score": lm / n}
    with np.errstate(divide="ignore", invalid="ignore"):
        for tag, name in (("", "persistence"), ("_seasonal", "seasonal_naive")):
            out[f"mae_skill{tag}"] = 1.0 - em / total(base_err[name])
            out[f"log_skill{tag}"] = (lm - total(base_log[name])) / n
    return out


def _metric_keys() -> list[str]:
    keys = ["mae", "log_score", "mae_skill", "log_skill", "mae_skill_seasonal", "log_skill_seasonal"]
    for ph in PHENOTYPES:
        keys += [f"{ph}_mae_skill", f"{ph}_log_skill"]
    keys += ["national_mae_skill", "national_log_skill", "mae_skill_no_last2", "log_skill_no_last2"]
    return keys


P2_KEYS = tuple(_metric_keys())


@dataclass
class Evaluation:
    """A forecaster's P2 scores and the two baselines' on the same targets."""

    scores: Scores
    baselines: dict[str, Scores]
    metrics: dict[str, float]
    intervals: dict[str, list[float]]
    n: dict[str, int]

    def table(self) -> pd.DataFrame:
        """Raw per-group MAE (of the median) and mean log score for the forecaster, persistence and seasonal naive, over
        all targets, with the number of series-months."""
        masks = group_masks(self.scores.keys)
        rows = []
        for g in GROUP_NAMES:
            m = masks[g]
            row: dict[str, object] = {"group": g, "n": int(m.sum() * len(self.scores.targets))}
            for name, sc in (("model", self.scores), ("persistence", self.baselines["persistence"]), ("seasonal_naive", self.baselines["seasonal_naive"])):
                row[f"mae_{name}"] = float(sc.abs_err[:, m].mean())
                row[f"log_{name}"] = float(sc.log_score[:, m].mean())
            rows.append(row)
        return pd.DataFrame(rows).set_index("group")


def evaluate(
    forecaster: Forecaster,
    *,
    targets: Sequence[str] = TARGETS,
    audit: bool = True,
    n_boot: int = 1000,
    seed: int = 2026,
) -> Evaluation:
    """Score `forecaster` one month ahead at every target, against persistence and seasonal naive, with 95 % intervals
    from `n_boot` bootstraps over target months (`numpy.random.default_rng(seed)`; the 'without the last two months'
    keys get their own draws after the first set). `audit` first checks strictness (`audit_strict`)."""
    targets = tuple(targets)
    if audit:
        audit_strict(forecaster, targets)
    model = run_forecaster(forecaster, targets)
    base = {name: _baseline_scores(name, targets) for name in ("persistence", "seasonal_naive")}
    masks = group_masks(model.keys)
    size = np.array([masks[g].sum() for g in GROUP_NAMES], dtype=float)
    sum_err, sum_log = _group_sums(model.abs_err, masks), _group_sums(model.log_score, masks)
    base_err = {k: _group_sums(v.abs_err, masks) for k, v in base.items()}
    base_log = {k: _group_sums(v.log_score, masks) for k, v in base.items()}
    T = len(targets)
    rng = np.random.default_rng(seed)
    gi = {g: i for i, g in enumerate(GROUP_NAMES)}

    def run(rows: slice) -> tuple[dict[str, np.ndarray], dict[str, np.ndarray]]:
        n_t = len(range(T)[rows])
        args = (sum_err[rows], sum_log[rows], {k: v[rows] for k, v in base_err.items()}, {k: v[rows] for k, v in base_log.items()})
        point = _stats(*args, np.arange(n_t)[None, :], size)
        boot = _stats(*args, rng.integers(0, n_t, size=(n_boot, n_t)), size)
        return point, boot

    metrics: dict[str, float] = {}
    intervals: dict[str, list[float]] = {}
    n: dict[str, int] = {}

    def put(key: str, stat: str, group: str, point: dict[str, np.ndarray], boot: dict[str, np.ndarray], n_t: int) -> None:
        metrics[key] = float(point[stat][0, gi[group]])
        b = boot[stat][:, gi[group]]
        b = b[np.isfinite(b)]
        intervals[key] = [float(np.percentile(b, 2.5)), float(np.percentile(b, 97.5))] if len(b) else [float("nan")] * 2
        n[key] = int(size[gi[group]] * n_t)

    point, boot = run(slice(None))
    for key in ("mae", "log_score", "mae_skill", "log_skill", "mae_skill_seasonal", "log_skill_seasonal"):
        put(key, key, "pooled", point, boot, T)
    for ph in PHENOTYPES:
        put(f"{ph}_mae_skill", "mae_skill", ph, point, boot, T)
        put(f"{ph}_log_skill", "log_skill", ph, point, boot, T)
    put("national_mae_skill", "mae_skill", "national", point, boot, T)
    put("national_log_skill", "log_skill", "national", point, boot, T)
    point2, boot2 = run(slice(0, T - 2))
    put("mae_skill_no_last2", "mae_skill", "pooled", point2, boot2, T - 2)
    put("log_skill_no_last2", "log_skill", "pooled", point2, boot2, T - 2)
    ordered = {k: metrics[k] for k in P2_KEYS}
    return Evaluation(model, base, ordered, {k: intervals[k] for k in P2_KEYS}, {k: n[k] for k in P2_KEYS})


def score_forecaster(forecaster: Forecaster, **kwargs) -> tuple[dict, dict, dict]:
    """P2 for one forecaster: `(metrics, intervals, n)`, each `{"P2": {key: ...}}` with exactly the keys of
    harness-spec.md, ready for `harness.write_metrics`. Skill against persistence unless named: MAE as 1 - MAE / MAE of
    the baseline, log score as the difference in mean log score (higher is better). Keyword arguments go to `evaluate`."""
    ev = evaluate(forecaster, **kwargs)
    return {"P2": ev.metrics}, {"P2": ev.intervals}, {"P2": ev.n}


# ---------------------------------------------------------------------------------------------------------------------
# P1: exposure on the time-ordered patient-flow graph
# ---------------------------------------------------------------------------------------------------------------------

E1_FILTER = {"organism": "Escherichia coli", "phenotype": "esbl"}
E2_FILTER = {"organism": "Staphylococcus aureus", "phenotype": "mrsa"}
# Onsets as the spec has them (the first outbreak isolate; E1 corrected in 0002's review).
EVENTS: dict[str, dict] = {
    "E1": {"source": "URO", "onset": "2025-05-30", "flt": E1_FILTER},
    "E2": {"source": "ICU", "onset": "2026-03-03", "flt": E2_FILTER},
}
ALPHAS = (0.05, 0.001)
FLOW_DAYS = 365  # the window before onset the graph is built from
LINK_DAYS = 30  # a culture in B within this many days of one in A makes an A -> B link
BASELINE_WEEKS, HORIZON_WEEKS = 26, 8


@dataclass(frozen=True)
class _Rows:
    """The culture rows of a window, prepared once: patient, unit and the index pairs that can make a link."""

    units: tuple[str, ...]
    n_patients: int
    patient: np.ndarray  # row -> patient index
    unit: np.ndarray  # row -> unit index
    pair_i: np.ndarray  # earlier row of each candidate pair (same patient, later row within `link_days`)
    pair_j: np.ndarray


def _prepare(cultures: Sequence[Culture], window: tuple[str, str], link_days: int = LINK_DAYS, units: Sequence[str] = UNITS) -> _Rows:
    units = tuple(units)
    code = {u: i for i, u in enumerate(units)}
    rows = [c for c in cultures if window[0] <= c.sample_date <= window[1]]
    if not rows:
        return _Rows(units, 0, np.zeros(0, int), np.zeros(0, int), np.zeros(0, int), np.zeros(0, int))
    df = pd.DataFrame(
        {
            "patient": [c.patient_id for c in rows],
            "date": pd.to_datetime([c.sample_date for c in rows]).to_numpy().astype("datetime64[D]").astype(np.int64),
            "cid": [c.culture_id for c in rows],
            "unit": [code[c.ward] for c in rows],
        }
    ).sort_values(["patient", "date", "cid"], kind="stable")
    patient = pd.factorize(df["patient"])[0]
    date, unit = df["date"].to_numpy(), df["unit"].to_numpy()
    ii, jj = [], []
    for k in range(1, len(df)):
        same = patient[:-k] == patient[k:]
        if not same.any():  # no patient has k + 1 cultures in the window: no larger offset can link either
            break
        i = np.flatnonzero(same & (date[k:] - date[:-k] <= link_days))
        ii.append(i)
        jj.append(i + k)
    pi = np.concatenate(ii) if ii else np.zeros(0, int)
    pj = np.concatenate(jj) if jj else np.zeros(0, int)
    return _Rows(units, int(patient.max()) + 1, patient, unit, pi, pj)


def _flows(rows: _Rows, unit: np.ndarray) -> np.ndarray:
    """The unit x unit weight matrix for unit labels `unit` (one per row): each patient counts once per ordered pair
    (A, B), A != B, for which one of their cultures in A is followed (same day or later, in the order of date then
    culture id) by one in B within the link window, with weight 1 / (number of distinct units their cultures in the
    window are labelled with)."""
    K, P = len(rows.units), rows.n_patients
    a, b = unit[rows.pair_i], unit[rows.pair_j]
    keep = a != b
    key = rows.patient[rows.pair_i[keep]] * (K * K) + a[keep] * K + b[keep]
    seen = np.zeros(P * K * K, dtype=bool)
    seen[key] = True
    nz = np.flatnonzero(seen)
    visited = np.zeros(P * K, dtype=bool)
    visited[rows.patient * K + unit] = True
    n_units = visited.reshape(P, K).sum(axis=1)
    w = 1.0 / n_units[nz // (K * K)]
    return np.bincount(nz % (K * K), weights=w, minlength=K * K).reshape(K, K)


def flow_matrix(cultures: Sequence[Culture], window: tuple[str, str], max_days: int = LINK_DAYS, units: Sequence[str] = UNITS) -> pd.DataFrame:
    """ENGINE.md section 4 flow graph: entry [A, B] (row A, column B, A != B) is the sum over patients with a culture
    in A followed by one in B within `max_days` days (both inside `window`, inclusive ISO dates) of 1 / (number of
    distinct units the patient was sampled in inside the window). A patient counts once per ordered pair however many
    cultures they have; every later culture within `max_days` of an earlier one counts as a successor, not only the
    next one (a patient seen in A, B, C within a month contributes A to B, A to C and B to C, each weighted 1/3). Same
    day: ordered by culture id. All cultures count, negative ones too (as aei.relations)."""
    rows = _prepare(cultures, window, max_days, units)
    return pd.DataFrame(_flows(rows, rows.unit) if rows.n_patients else np.zeros((len(rows.units),) * 2), index=list(rows.units), columns=list(rows.units))


def _as_sources(source: str | Sequence[str]) -> list[str]:
    return [source] if isinstance(source, str) else list(source)


def exposure(flow: pd.DataFrame, source: str | Sequence[str]) -> pd.DataFrame:
    """Exposure of every unit B from the source unit(s) S (ENGINE.md section 4 with active = 1 for S): `raw` is
    w(S -> B), summed over the sources when there are several; `share` is raw / sum over all A of w(A -> B), zero
    when nothing flows into B. Sources get NaN (a unit is not exposed to itself)."""
    src = _as_sources(source)
    units = list(flow.index)
    mat = flow.to_numpy(dtype=float)
    raw = mat[[units.index(s) for s in src]].sum(axis=0)
    into = mat.sum(axis=0)
    share = np.divide(raw, into, out=np.zeros_like(raw), where=into > 0)
    out = pd.DataFrame({"share": share, "raw": raw}, index=units)
    out.loc[src, :] = np.nan
    return out


def _predicate(flt) -> Callable[[IsolateRecord], bool]:
    """`flt`: a phenotype name, a dict with `organism` and/or `phenotype`, or any record -> bool function."""
    if callable(flt):
        return flt
    if isinstance(flt, str):
        flt = {"phenotype": flt}
    organism, phenotype = flt.get("organism"), flt.get("phenotype")
    return lambda r: (organism is None or r.organism == organism) and (phenotype is None or phenotype in r.phenotypes)


def unit_outcome(
    records: Sequence[IsolateRecord],
    flt,
    onset: str,
    alpha: float = 0.05,
    *,
    units: Sequence[str] = UNITS,
    baseline_weeks: int = BASELINE_WEEKS,
    horizon_weeks: int = HORIZON_WEEKS,
) -> pd.DataFrame:
    """Per unit, did the matching patients (distinct patients with an isolate passing `flt`) in the `horizon_weeks`
    weeks from `onset` exceed the unit's `baseline_weeks`-week baseline before it? Expected count mu = (baseline
    patients + 0.5) x horizon days / baseline days (the +0.5 keeps an empty baseline from making any single patient
    significant); positive when the Poisson upper tail P(X >= observed | mu) < alpha. Columns baseline, observed,
    expected, p, positive; one row per unit."""
    ok = _predicate(flt)
    b0, b1 = add_days(onset, -7 * baseline_weeks), add_days(onset, -1)
    h1 = add_days(onset, 7 * horizon_weeks - 1)
    base: dict[str, set[str]] = {u: set() for u in units}
    after: dict[str, set[str]] = {u: set() for u in units}
    for r in records:
        if r.ward not in base or not ok(r):
            continue
        if b0 <= r.sample_date <= b1:
            base[r.ward].add(r.patient_id)
        elif onset <= r.sample_date <= h1:
            after[r.ward].add(r.patient_id)
    scale = (7 * horizon_weeks) / (7 * baseline_weeks)
    rows = []
    for u in units:
        nb, no = len(base[u]), len(after[u])
        mu = (nb + 0.5) * scale
        p = float(stats.poisson.sf(no - 1, mu))
        rows.append({"unit": u, "baseline": nb, "observed": no, "expected": mu, "p": p, "positive": bool(p < alpha)})
    return pd.DataFrame(rows).set_index("unit")


def auc(scores: Sequence[float] | np.ndarray, outcomes: Sequence[bool] | np.ndarray) -> float:
    """Area under the ROC curve: the probability that a randomly chosen positive outranks a randomly chosen negative,
    ties counting half (Mann-Whitney U over n_pos x n_neg). NaN when there is no positive or no negative. A 2-D
    `scores` (replicates x units) gives one AUC per row."""
    s = np.asarray(scores, dtype=float)
    y = np.asarray(outcomes, dtype=bool)
    n_pos, n_neg = int(y.sum()), int((~y).sum())
    if n_pos == 0 or n_neg == 0:
        return float("nan") if s.ndim == 1 else np.full(s.shape[0], np.nan)
    ranks = stats.rankdata(s, axis=-1)
    u = ranks[..., y].sum(axis=-1) - n_pos * (n_pos + 1) / 2
    return u / (n_pos * n_neg)


@dataclass
class _Setup:
    rows: _Rows
    sources: list[str]
    others: np.ndarray  # indices of the units that are not sources
    outcome: dict[float, pd.DataFrame]
    observed: pd.DataFrame  # exposure (share, raw) of the real graph


def _setup(cultures, records, source, onset, flt, alphas, flow_days, units) -> _Setup:
    window = (add_days(onset, -flow_days), add_days(onset, -1))
    rows = _prepare(cultures, window, LINK_DAYS, units)
    src = _as_sources(source)
    flow = pd.DataFrame(_flows(rows, rows.unit) if rows.n_patients else np.zeros((len(units),) * 2), index=list(units), columns=list(units))
    others = np.array([i for i, u in enumerate(units) if u not in src])
    outcome = {a: unit_outcome(records, flt, onset, a, units=units) for a in alphas}
    return _Setup(rows, src, others, outcome, exposure(flow, src))


def _permuted_unit(rows: _Rows, rng: np.random.Generator) -> np.ndarray:
    """The row -> unit labels after a uniformly random permutation of the labels over the rows: every unit keeps its
    number of culture rows, every patient their number of cultures and their dates (Choices 7)."""
    return rows.unit[rng.permutation(len(rows.unit))]


def _null_exposures(st: _Setup, n: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """Share and raw exposure of the non-source units for `n` label permutations, shape (n, units)."""
    rng = np.random.default_rng(seed)
    K = len(st.rows.units)
    src_idx = [st.rows.units.index(s) for s in st.sources]
    share = np.empty((n, len(st.others)))
    raw = np.empty_like(share)
    for r in range(n):
        f = _flows(st.rows, _permuted_unit(st.rows, rng))
        col = f.sum(axis=0)
        e_raw = f[src_idx].sum(axis=0)
        share[r] = np.divide(e_raw, col, out=np.zeros(K), where=col > 0)[st.others]
        raw[r] = e_raw[st.others]
    return share, raw


def _p_upper(null: np.ndarray, observed: float) -> float:
    """One-sided rewiring p-value: (1 + #{null >= observed}) / (n + 1); NaN when the statistic is undefined."""
    if np.isnan(observed) or len(null) == 0:
        return float("nan")
    return float((1 + np.sum(null >= observed - 1e-12)) / (len(null) + 1))


def rank_corr(scores: np.ndarray, values: np.ndarray) -> float | np.ndarray:
    """Spearman correlation of `scores` (units, or replicates x units) with `values` (units); NaN when constant."""
    s = np.atleast_2d(np.asarray(scores, dtype=float))
    rs, rv = stats.rankdata(s, axis=-1), stats.rankdata(values)
    rs, rv = rs - rs.mean(axis=-1, keepdims=True), rv - rv.mean()
    with np.errstate(divide="ignore", invalid="ignore"):
        out = (rs * rv).sum(axis=-1) / np.sqrt((rs**2).sum(axis=-1) * (rv**2).sum())
    return float(out[0]) if np.ndim(scores) == 1 else out


def rewired_auc_null(
    cultures: Sequence[Culture],
    records: Sequence[IsolateRecord],
    source: str | Sequence[str],
    onset: str,
    flt=E1_FILTER,
    alpha: float = 0.05,
    *,
    flow_days: int = FLOW_DAYS,
    n: int = 1000,
    seed: int = 2026,
    units: Sequence[str] = UNITS,
) -> dict:
    """The exposure AUC of the real graph against `n` rewirings (harness-spec.md Choices 7): the unit labels are
    permuted over the culture rows of the window (`numpy.random.default_rng(seed)`), the 30-day links are rebuilt from
    the permuted labels, and the AUC of the exposure ranking over the units that are not sources is recomputed
    against the real outcomes (`unit_outcome` at `alpha`). Returns observed `auc_share`, `auc_raw`, the null arrays
    `null_share`, `null_raw`, one-sided `p_share`, `p_raw` = (1 + #{null >= observed}) / (n + 1) (NaN when the AUC is
    undefined: no positive or no negative unit), and `positives`."""
    st = _setup(cultures, records, source, onset, flt, (alpha,), flow_days, units)
    return _auc_null(st, alpha, n, _null_exposures(st, n, seed) if _can_rank(st, alpha) else None)


def _can_rank(st: _Setup, alpha: float) -> bool:
    y = st.outcome[alpha]["positive"].to_numpy()[st.others]
    return st.rows.n_patients > 0 and 0 < y.sum() < len(y)


def _auc_null(st: _Setup, alpha: float, n: int, null: tuple[np.ndarray, np.ndarray] | None) -> dict:
    y = st.outcome[alpha]["positive"].to_numpy()[st.others]
    obs = st.observed.iloc[st.others]
    a_share, a_raw = auc(obs["share"].to_numpy(), y), auc(obs["raw"].to_numpy(), y)
    res = {"auc_share": a_share, "auc_raw": a_raw, "positives": int(y.sum()), "units": int(len(y)), "null_share": np.zeros(0), "null_raw": np.zeros(0)}
    if null is not None:
        res["null_share"], res["null_raw"] = auc(null[0], y), auc(null[1], y)
    res["p_share"], res["p_raw"] = _p_upper(res["null_share"], a_share), _p_upper(res["null_raw"], a_raw)
    return res


@dataclass
class ExposureResult:
    metrics: dict  # {"P1": {...}} with the keys of harness-spec.md
    n: dict
    table: pd.DataFrame  # per unit: share, raw, and the outcome at alpha 0.05 and 0.001
    null: dict[str, dict] = field(default_factory=dict)  # "a05", "a001": rewired_auc_null's dictionary
    excess_corr: dict[str, float] = field(default_factory=dict)  # supplementary, see score_exposure
    intervals: dict = field(default_factory=dict)  # empty: the null p-values are the spread


def score_exposure(
    cultures: Sequence[Culture],
    records: Sequence[IsolateRecord],
    source: str | Sequence[str],
    onset: str,
    flt=E1_FILTER,
    *,
    flow_days: int = FLOW_DAYS,
    n_null: int = 1000,
    seed: int = 2026,
    units: Sequence[str] = UNITS,
) -> ExposureResult:
    """P1 for one event: graph over the `flow_days` before `onset`, exposure from `source` (a unit, or several for a
    cluster spread over two units), outcome per unit from `unit_outcome` at alpha 0.05 and 0.001, AUC over the units
    that are not sources for the share and the raw exposure, null p-values (alpha 0.05 only in `metrics`) from
    `n_null` rewirings. One event gives a description, not a claim.

    Supplementary, not a spec key: `excess_corr` is the Spearman correlation of each exposure with the unit's
    (observed + 0.5) / expected patients (a continuous outcome, defined even when no unit is positive) and its
    rewiring p-value, on the same permutations."""
    st = _setup(cultures, records, source, onset, flt, ALPHAS, flow_days, units)
    null = _null_exposures(st, n_null, seed) if st.rows.n_patients else None
    a05 = _auc_null(st, 0.05, n_null, null if _can_rank(st, 0.05) else None)
    a001 = _auc_null(st, 0.001, n_null, null if _can_rank(st, 0.001) else None)
    metrics = {
        "auc_share_a05": a05["auc_share"],
        "auc_raw_a05": a05["auc_raw"],
        "auc_share_a001": a001["auc_share"],
        "auc_raw_a001": a001["auc_raw"],
        "null_p_share_a05": a05["p_share"],
        "null_p_raw_a05": a05["p_raw"],
        "positives_a05": a05["positives"],
        "positives_a001": a001["positives"],
    }
    first = st.outcome[0.05]
    table = st.observed.copy()
    table["baseline_patients"], table["patients"], table["expected"] = first["baseline"], first["observed"], first["expected"]
    for a, label in ((0.05, "a05"), (0.001, "a001")):
        table[f"p_{label}"] = st.outcome[a]["p"]
        table[f"positive_{label}"] = st.outcome[a]["positive"]
    excess = ((first["observed"] + 0.5) / first["expected"]).to_numpy()[st.others]
    obs = st.observed.iloc[st.others]
    corr = {"share": rank_corr(obs["share"].to_numpy(), excess), "raw": rank_corr(obs["raw"].to_numpy(), excess)}
    if null is not None:
        for i, name in enumerate(("share", "raw")):
            corr[f"p_{name}"] = _p_upper(rank_corr(null[i], excess), corr[name])
    n_info = {
        "units_ranked": int(len(st.others)),
        "culture_rows_in_window": int(len(st.rows.unit)),
        "patients_in_window": int(st.rows.n_patients),
        "null_replicates": int(n_null),
    }
    return ExposureResult({"P1": metrics}, {"P1": n_info}, table, {"a05": a05, "a001": a001}, corr)
