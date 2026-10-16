"""Coverage scoring (C1 to C8 of benchmarks/METRICS.md) for the overnight harness.

Specification and the choices it makes: benchmarks/overnight-2026-10-17/harness-spec.md ("Coverage" and Choices 1 and
2). An estimator is anything with `predict(view, convention) -> DataFrame` (or a plain function of the same two
arguments); `score_estimator` runs every metric and returns what `aei.harness.write_metrics` takes:

    from aei import score_coverage as sc
    metrics, intervals, n = sc.score_estimator(sc.hospital_365)

The estimator protocol
----------------------
`view` (a `View`) shows only records dated before the first target day, `view.start`:

    view.grid                     cells to predict: DataFrame[ward, ward_type, specimen, antibiotic, cell_id]
    view.first_cells(days)        one row per first isolate x suiting antibiotic in the last `days` days (None: all
                                  history), first per patient x organism x specimen inside that window (0004's rule),
                                  with the outcome under each convention (y_left_out, y_counted, y_spectrum) and date,
                                  ward (unit), ward_type, specimen, organism, patient_id, sex, age_years, hospital_onset,
                                  inpatient, phenotypes (and esbl, mrsa, vre, cpe), home_area; `cells()` has all of them
    view.first_isolates(days)     the same at isolate level; view.isolates / view.cells: all history; view.records:
                                  the IsolateRecords (for `aei.coverage_list.coverage`)
    view.counts(days, convention, level="unit"|"hospital")   (k, n) arrays indexed by cell_id: covered and counted
    view.target                   the target's first isolates without organism or results (unit, specimen, sex, age,
                                  hospital onset, inpatient): what is known when the doctor asks; for isolate-level models
    view.memo                     a dict for caching within one view

`convention` is the outcome the estimate is for (harness-spec.md, "Outcome conventions"):
`"left_out"` (S is 1; R, intrinsic and no breakpoint 0; untested left out; the default and 0004's), `"counted"` (as
left_out but untested is 0) and `"spectrum"` (S is 1, R and intrinsic 0, no breakpoint and untested left out).

The return value has one row per `view.grid` row (cell-level) with columns `ward`, `specimen`, `antibiotic` (or `cell_id`)
and `p`, and optionally `a`, `b` (a Beta belief about p), `lo90`, `hi90`, `lo95`, `hi95` (intervals for p; derived from
a and b when missing) and `n` (results behind the cell; under 30 means not assessable for C4). A row may instead be
isolate-level (`isolate_id`, `antibiotic`, `p`), keyed to `view.target`; isolate-level estimators are scored on C1, C2,
C3(a) and C5 only. `p` NaN means no estimate: C1 to C3(a), C5 and C8 score the baseline's p instead (0004's rule for an
empty cell; the count is in n["C1"]["fallback"]); C4 treats the cell as not assessable. An estimator without intervals
gets no C3(b), C4, C6, C7. `NotImplementedError` from `predict` for a convention leaves out the metrics that need it.

`View.grid` is `GRID` (every unit x specimen x antibiotic that suits the specimen, 0004's cells) for C1, C2, C3(a), C5
and C8 (C1); `OFFERED_GRID` (the list's offered antibiotics) for the month targets of C3(b), C4, C7 and C8 (C4); two or
one cells of one unit for C6. An estimator should return a row for every grid row it is given.

Helpers for writing an estimator: `view_as_of(day)` (a view for an estimate dated `day`), `first_isolate_cells(start,
end)`, `cell_counts(frame, convention, level)`, `make_grid(cells)`, `beta_interval`, `beta_from_interval`, and the
baselines `hospital_365`, `shipped` and `estimators_0004()` as examples. `c6_series(estimator, "E1")` gives the daily
estimates of C6's displayed periods, for a figure.

Choices of this module beyond the spec are documented where they are made: the C4 "counted" readings (`c4_parts`), the
Jeffreys interval of `hospital_365`, the moment-matched Beta (`beta_from_interval`), the window bootstrap of C3(a)
(`c3a`), the baseline's p for a cell without an estimate (above), the small-cell subset defined on the left_out count
for every convention (`window_subsets`).
"""

from __future__ import annotations

import math
import time
from collections.abc import Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from typing import Protocol

import numpy as np
import pandas as pd
from scipy import stats

from aei import coverage_list as cl
from aei import harness
from aei.coverage import wilson
from aei.dataset import IsolateRecord
from aei.dates import add_days, days_between
from aei.domain import ANTIBIOTICS, SPECIMENS, UNITS, WARD_TYPE
from aei.eucast import effective_result, suits_specimen
from aei.jscompat import mulberry32

# --- constants ----------------------------------------------------------------------------------------------------

FIRST_TARGET = "2024-09-30"  # 0004: after a full year of history; one day before harness.SCORE starts
LAST_DAY = "2026-09-27"
WINDOW_DAYS = 28
CONVENTIONS = ("left_out", "counted", "spectrum")
Y = {"left_out": "y_left_out", "counted": "y_counted", "spectrum": "y_spectrum"}
SMALL = 30  # cells with fewer first-isolate results than this in the unit's last 28 days
CLIP = (0.001, 0.999)
BOOTSTRAPS = 1000
SEED = 2026
Z90 = 1.644854
Z95 = 1.959964
MIN_BLOCK = 20  # C7: target isolates with a result in a block
MIN_TARGET = 10  # C3(b): target isolates with a result in a query-month
PASS_RATIO = 1.5  # C3(b)
PASS_BAND = (0.85, 0.95)  # C7(a), proposed in METRICS.md
MIN_TESTED = 30
#: C7(b), C8: the planted outbreaks' unit-months (METRICS.md).
OUTBREAKS: dict[str, tuple[str, ...]] = {"URO": ("2025-06", "2025-07", "2025-08"), "ICU": ("2026-02", "2026-03", "2026-04")}
#: C6: the two events, their onsets (first outbreak isolate; 0002's review) and the displayed daily-estimate periods.
EVENTS = {
    "E1": {"ward": "URO", "specimen": "urine", "antibiotics": ("CRO", "CXM"), "onset": "2025-05-30", "period": ("2025-04-01", "2025-09-30")},
    "E2": {"ward": "ICU", "specimen": None, "antibiotics": ("CXM",), "onset": "2026-03-03", "period": ("2026-01-01", "2026-05-31")},
}
C6_MAX_DAYS = 120

NWARD, NSPEC, NABX = len(UNITS), len(SPECIMENS), len(ANTIBIOTICS)
NCELL = NWARD * NSPEC * NABX
WARD_INDEX = {w: i for i, w in enumerate(UNITS)}
SPEC_INDEX = {s: i for i, s in enumerate(SPECIMENS)}
ABX_INDEX = {a: i for i, a in enumerate(ANTIBIOTICS)}
BASES = ["tested", "intrinsic", "inferred", "no-breakpoint", "untested"]


def cell_id(ward: str, specimen: str, antibiotic: str) -> int:
    """Index of a unit x specimen x antibiotic cell: (unit index x 3 + specimen index) x 13 + antibiotic index."""
    return (WARD_INDEX[ward] * NSPEC + SPEC_INDEX[specimen]) * NABX + ABX_INDEX[antibiotic]


def make_grid(cells: Sequence[tuple[str, str, str]]) -> pd.DataFrame:
    """A grid of (ward, specimen, antibiotic) cells for `View(grid=...)`."""
    df = pd.DataFrame(list(cells), columns=["ward", "specimen", "antibiotic"])
    df["ward_type"] = df["ward"].map(WARD_TYPE)
    df["cell_id"] = [cell_id(*c) for c in cells]
    return df[["ward", "ward_type", "specimen", "antibiotic", "cell_id"]]


#: Every unit x specimen x antibiotic that suits the specimen (0004's cells): what C1, C2, C3(a) and C5 score.
GRID = make_grid([(w, s, a) for w in UNITS for s in SPECIMENS for a in ANTIBIOTICS if suits_specimen(a, s)])
#: The cells the doctor's list offers (no urine VAN or CLI): what C3(b), C4, C6, C7 and C8 (C4) score.
OFFERED_GRID = make_grid([(w, s, a) for w in UNITS for s in SPECIMENS for a in cl.offered(s)])


@lru_cache(maxsize=None)
def _day(s: str) -> int:
    return date.fromisoformat(s).toordinal()


# --- data ---------------------------------------------------------------------------------------------------------


@dataclass
class Data:
    """The dataset as frames, built once per process: `iso` (isolates in date order, ties by id) and `cells` (isolate x
    suiting antibiotic, in the same order). Do not mutate."""

    records: list[IsolateRecord]
    iso: pd.DataFrame
    cells: pd.DataFrame
    day: np.ndarray  # per isolate, ordinal day
    key: np.ndarray  # per isolate, code of patient x organism x specimen
    off: np.ndarray  # per isolate, first row in `cells`
    cnt: np.ndarray  # per isolate, rows in `cells`
    c_cell: np.ndarray  # per cell row, cell_id
    c_y: dict[str, np.ndarray]  # per cell row, outcome by convention (NaN = left out)
    organisms: list[str]


@lru_cache(maxsize=1)
def data() -> Data:
    records, _ = harness.data()
    recs = sorted(records, key=lambda r: (r.sample_date, r.isolate_id))
    suit = {s: [a for a in ANTIBIOTICS if suits_specimen(a, s)] for s in SPECIMENS}
    from aei.dataset import INPATIENT_UNITS

    onset = [r.admission_date is not None and days_between(r.admission_date, r.sample_date) >= 2 for r in recs]
    organisms = sorted({r.organism for r in recs})
    iso = pd.DataFrame(
        {
            "isolate_id": [r.isolate_id for r in recs],
            "patient_id": [r.patient_id for r in recs],
            "date": [r.sample_date for r in recs],
            "day": [_day(r.sample_date) for r in recs],
            "ward": pd.Categorical([r.ward for r in recs], categories=UNITS),
            "ward_type": pd.Categorical([WARD_TYPE[r.ward] for r in recs], categories=["in", "out"]),
            "specimen": pd.Categorical([r.specimen for r in recs], categories=SPECIMENS),
            "organism": pd.Categorical([r.organism for r in recs], categories=organisms),
            "sex": pd.Categorical([r.sex for r in recs]),
            "age_years": np.array([r.age_years for r in recs], dtype=np.int16),
            "hospital_onset": np.array(onset, dtype=bool),
            "inpatient": np.array([r.ward in INPATIENT_UNITS for r in recs], dtype=bool),
            "esbl": np.array(["esbl" in r.phenotypes for r in recs], dtype=bool),
            "mrsa": np.array(["mrsa" in r.phenotypes for r in recs], dtype=bool),
            "vre": np.array(["vre" in r.phenotypes for r in recs], dtype=bool),
            "cpe": np.array(["cpe" in r.phenotypes for r in recs], dtype=bool),
            "home_area": pd.Categorical([r.home_area for r in recs]),
        }
    )
    iso["phenotypes"] = [r.phenotypes for r in recs]
    key_codes = pd.factorize(pd.Series([f"{r.patient_id}|{r.organism}|{r.specimen}" for r in recs]))[0]

    iso_row: list[int] = []
    abx: list[int] = []
    basis: list[int] = []
    result: list[str | None] = []
    y_left: list[float] = []
    y_cnt: list[float] = []
    y_spec: list[float] = []
    off = np.zeros(len(recs), dtype=np.int64)
    cnt = np.zeros(len(recs), dtype=np.int64)
    nan = float("nan")
    for i, r in enumerate(recs):
        off[i] = len(iso_row)
        for a in suit[r.specimen]:
            e = effective_result(r, a)
            iso_row.append(i)
            abx.append(ABX_INDEX[a])
            basis.append(BASES.index(e.basis))
            result.append(e.result)
            s = 1.0 if e.result == "S" else 0.0
            y_cnt.append(s)
            y_left.append(nan if e.basis == "untested" else s)
            y_spec.append(nan if e.basis in ("untested", "no-breakpoint") else s)
        cnt[i] = len(iso_row) - off[i]
    rows_arr = np.array(iso_row, dtype=np.int64)
    abx_arr = np.array(abx, dtype=np.int64)
    base = iso.take(rows_arr).reset_index(drop=True)
    c_cell = ((base["ward"].cat.codes.to_numpy().astype(np.int64) * NSPEC + base["specimen"].cat.codes.to_numpy()) * NABX + abx_arr).astype(np.int64)
    cells = base.assign(
        iso_row=rows_arr,
        cell_id=c_cell,
        antibiotic=pd.Categorical.from_codes(abx_arr, categories=ANTIBIOTICS),
        basis=pd.Categorical.from_codes(np.array(basis), categories=BASES),
        result=pd.Categorical(result, categories=["S", "R"]),
        y_left_out=np.array(y_left),
        y_counted=np.array(y_cnt),
        y_spectrum=np.array(y_spec),
    )
    return Data(
        records=recs,
        iso=iso,
        cells=cells,
        day=iso["day"].to_numpy(),
        key=key_codes.astype(np.int64),
        off=off,
        cnt=cnt,
        c_cell=c_cell,
        c_y={"left_out": cells["y_left_out"].to_numpy(), "counted": cells["y_counted"].to_numpy(), "spectrum": cells["y_spectrum"].to_numpy()},
        organisms=organisms,
    )


@lru_cache(maxsize=2048)
def _first_rows(lo: int, hi: int) -> np.ndarray:
    """Rows of `Data.iso` that are the first isolate of their patient x organism x specimen among the isolates dated
    from ordinal day `lo` to `hi`, inclusive, in date order (`aei.counting.first_isolates`)."""
    d = data()
    i0 = int(np.searchsorted(d.day, lo, side="left"))
    i1 = int(np.searchsorted(d.day, hi, side="right"))
    if i1 <= i0:
        return np.zeros(0, dtype=np.int64)
    _, first = np.unique(d.key[i0:i1], return_index=True)
    return i0 + np.sort(first)


def first_rows(start: str, end: str) -> np.ndarray:
    return _first_rows(_day(start), _day(end))


def cell_positions(rows: np.ndarray) -> np.ndarray:
    """Rows of `Data.cells` that belong to the isolates `rows` of `Data.iso`."""
    d = data()
    cnt = d.cnt[rows]
    total = int(cnt.sum())
    if total == 0:
        return np.zeros(0, dtype=np.int64)
    within = np.arange(total) - np.repeat(np.cumsum(cnt) - cnt, cnt)
    return np.repeat(d.off[rows], cnt) + within


def cells() -> pd.DataFrame:
    """Every isolate x antibiotic that suits its specimen (the cefoxitin screen excluded), all three years, in date order:
    isolate_id, patient_id, date, day, ward (unit), ward_type, specimen, organism, sex, age_years, hospital_onset, inpatient,
    esbl, mrsa, vre, cpe, phenotypes, home_area, iso_row, cell_id, antibiotic, basis (tested, intrinsic, inferred,
    no-breakpoint, untested), result (S, R or missing), and the outcome under each convention: y_left_out, y_counted,
    y_spectrum (NaN where the convention leaves the pair out). Do not mutate."""
    return data().cells


def isolates() -> pd.DataFrame:
    """The same at isolate level, one row per isolate (`iso_row` indexes it)."""
    return data().iso


def first_isolate_cells(start: str, end: str) -> pd.DataFrame:
    """`cells()` of the first isolates (per patient, organism, specimen) dated from `start` to `end`: a target window, or
    any window an estimator wants its own first-isolate rule for."""
    return data().cells.iloc[cell_positions(first_rows(start, end))]


def view_as_of(day: str, grid: pd.DataFrame | None = None) -> View:
    """The view of an estimate dated `day`: records dated up to and including it (the target starts the day after)."""
    return View(add_days(day, 1), grid=grid)


def cell_counts(frame: pd.DataFrame, convention: str, level: str = "unit") -> tuple[np.ndarray, np.ndarray]:
    """Covered `k` and counted `n` per cell of a frame of cells (such as `view.first_cells(365)`), as arrays indexed by
    cell_id. `level="hospital"` adds the units up (the same figure for every unit's cell of a specimen x antibiotic)."""
    y = frame[Y[convention]].to_numpy()
    return _counts_of(frame["cell_id"].to_numpy(), y, level)


def _counts_of(cid: np.ndarray, y: np.ndarray, level: str) -> tuple[np.ndarray, np.ndarray]:
    ok = ~np.isnan(y)
    k = np.bincount(cid[ok], weights=y[ok], minlength=NCELL)
    n = np.bincount(cid[ok], minlength=NCELL).astype(float)
    if level == "hospital":
        m = NSPEC * NABX
        kh = k.reshape(NWARD, m).sum(axis=0)
        nh = n.reshape(NWARD, m).sum(axis=0)
        return np.tile(kh, NWARD), np.tile(nh, NWARD)
    if level != "unit":
        raise ValueError("level is 'unit' or 'hospital'")
    return k, n


class View:
    """What an estimator may see for a target starting on `start`: records dated before it (strict as-of)."""

    def __init__(self, start: str, *, end: str | None = None, grid: pd.DataFrame | None = None) -> None:
        self.start = start
        self.end = end
        self.as_of = add_days(start, -1)
        self.grid = GRID if grid is None else grid
        self.memo: dict = {}
        self._d = data()
        self._day = _day(start)
        self._i = int(np.searchsorted(self._d.day, self._day, side="left"))
        self._frames: dict = {}

    @property
    def records(self) -> list[IsolateRecord]:
        return self._d.records[: self._i]

    @property
    def isolates(self) -> pd.DataFrame:
        return self._d.iso.iloc[: self._i]

    @property
    def cells(self) -> pd.DataFrame:
        d = self._d
        return d.cells.iloc[: int(d.off[self._i - 1] + d.cnt[self._i - 1]) if self._i else 0]

    def _rows(self, days: int | None) -> np.ndarray:
        lo = int(self._d.day[0]) if days is None else self._day - days
        return _first_rows(lo, self._day - 1)

    def first_isolates(self, days: int | None = None) -> pd.DataFrame:
        """First isolates (per patient, organism and specimen) among those of the last `days` days; None: all history."""
        key = ("iso", days)
        if key not in self._frames:
            self._frames[key] = self._d.iso.iloc[self._rows(days)]
        return self._frames[key]

    def first_cells(self, days: int | None = None) -> pd.DataFrame:
        """`first_isolates(days)` times the antibiotics that suit the specimen, one row each, with outcomes."""
        key = ("cells", days)
        if key not in self._frames:
            self._frames[key] = self._d.cells.iloc[cell_positions(self._rows(days))]
        return self._frames[key]

    def counts(self, days: int | None, convention: str, level: str = "unit") -> tuple[np.ndarray, np.ndarray]:
        """Covered and counted per cell over the first isolates of the last `days` days (arrays by cell_id)."""
        pos = cell_positions(self._rows(days))
        return _counts_of(self._d.c_cell[pos], self._d.c_y[convention][pos], level)

    @property
    def target(self) -> pd.DataFrame | None:
        """The target's first isolates with what is known before the culture grows: no organism, no results."""
        if self.end is None:
            return None
        rows = first_rows(self.start, self.end)
        return self._d.iso.iloc[rows][["isolate_id", "date", "ward", "ward_type", "specimen", "sex", "age_years", "hospital_onset", "inpatient"]]


class Estimator(Protocol):
    name: str

    def predict(self, view: View, convention: str) -> pd.DataFrame: ...


def _predict(estimator: object, view: View, convention: str) -> pd.DataFrame | None:
    """Call an estimator (object or function); None if it does not support the convention."""
    try:
        fn = getattr(estimator, "predict", estimator)
        return fn(view, convention)  # type: ignore[operator]
    except NotImplementedError:
        return None


def _name(estimator: object) -> str:
    return getattr(estimator, "name", getattr(estimator, "__name__", type(estimator).__name__))


# --- normalising an estimator's output -----------------------------------------------------------------------------

COLS = ("p", "a", "b", "lo90", "hi90", "lo95", "hi95", "n")


def _cell_ids(pred: pd.DataFrame) -> np.ndarray:
    if "cell_id" in pred:
        return pred["cell_id"].to_numpy().astype(np.int64)
    w = pred["ward"].astype(str).map(WARD_INDEX)
    s = pred["specimen"].astype(str).map(SPEC_INDEX)
    a = pred["antibiotic"].astype(str).map(ABX_INDEX)
    if w.isna().any() or s.isna().any() or a.isna().any():
        raise ValueError("prediction rows must name a known ward, specimen and antibiotic")
    return ((w * NSPEC + s) * NABX + a).to_numpy().astype(np.int64)


def beta_interval(a: np.ndarray, b: np.ndarray, level: float) -> tuple[np.ndarray, np.ndarray]:
    """Equal-tailed interval of Beta(a, b): the (1 - level) / 2 and (1 + level) / 2 quantiles."""
    ok = np.isfinite(a) & np.isfinite(b) & (a > 0) & (b > 0)
    lo = np.full(a.shape, np.nan)
    hi = np.full(a.shape, np.nan)
    if ok.any():
        lo[ok] = stats.beta.ppf((1 - level) / 2, a[ok], b[ok])
        hi[ok] = stats.beta.ppf((1 + level) / 2, a[ok], b[ok])
    return lo, hi


def beta_from_interval(p: np.ndarray, lo: np.ndarray, hi: np.ndarray, z: float) -> tuple[np.ndarray, np.ndarray]:
    """Beta(a, b) with mean p (clipped to [0.001, 0.999]) and standard deviation (hi - lo) / (2 z): the Beta an interval
    stands for when the method gives no Beta of its own (harness-spec.md, Choices 1). Not finite where p or the interval is."""
    m = np.clip(p, *CLIP)
    sd = np.maximum((hi - lo) / (2 * z), 1e-4)
    nu = np.maximum(m * (1 - m) / sd**2 - 1, 1e-3)
    return m * nu, (1 - m) * nu


@dataclass
class Cells:
    """An estimator's cell-level output as arrays by cell_id (NaN where it gave nothing)."""

    p: np.ndarray
    a: np.ndarray
    b: np.ndarray
    lo90: np.ndarray
    hi90: np.ndarray
    lo95: np.ndarray
    hi95: np.ndarray
    n: np.ndarray

    @property
    def has_interval(self) -> bool:
        return bool(np.isfinite(self.lo95).any())

    @property
    def has_interval90(self) -> bool:
        return bool(np.isfinite(self.lo90).any())


def normalise(pred: pd.DataFrame) -> Cells:
    """Cell-level output to arrays by cell_id; missing intervals are derived from (a, b) where those are given."""
    if "p" not in pred:
        raise ValueError("prediction needs a column p")
    if "cell_id" not in pred and not {"ward", "specimen", "antibiotic"} <= set(pred.columns):
        raise NotImplementedError("isolate-level predictions are scored on C1, C2, C3(a) and C5 only")
    cid = _cell_ids(pred)
    if len(np.unique(cid)) != len(cid):
        raise ValueError("prediction has a cell twice")
    out: dict[str, np.ndarray] = {}
    for c in COLS:
        arr = np.full(NCELL, np.nan)
        if c in pred:
            arr[cid] = pred[c].to_numpy(dtype=float)
        out[c] = arr
    for lo, hi, level in (("lo90", "hi90", 0.90), ("lo95", "hi95", 0.95)):
        miss = ~(np.isfinite(out[lo]) & np.isfinite(out[hi]))
        if miss.any() and np.isfinite(out["a"]).any():
            blo, bhi = beta_interval(out["a"], out["b"], level)
            out[lo] = np.where(miss, blo, out[lo])
            out[hi] = np.where(miss, bhi, out[hi])
    return Cells(**out)


# --- targets ------------------------------------------------------------------------------------------------------


def windows() -> list[tuple[str, str]]:
    """0004's target windows: consecutive 28-day windows from 2024-09-30 while the last day is within the data."""
    out = []
    start = FIRST_TARGET
    while add_days(start, WINDOW_DAYS - 1) <= LAST_DAY:
        out.append((start, add_days(start, WINDOW_DAYS - 1)))
        start = add_days(start, WINDOW_DAYS)
    return out


@dataclass
class WindowTargets:
    """Every target first isolate x suiting antibiotic of the 26 windows (counted convention's rows; left_out leaves
    untested out), sorted by window."""

    pairs: pd.DataFrame
    window: np.ndarray
    cell: np.ndarray
    y: dict[str, np.ndarray]
    small: np.ndarray
    ward_uro: np.ndarray
    outbreak: np.ndarray
    org: np.ndarray
    abx: np.ndarray
    nwin: int


@lru_cache(maxsize=1)
def window_targets() -> WindowTargets:
    d = data()
    ws = windows()
    pos, win, small = [], [], []
    for w, (start, end) in enumerate(ws):
        rows = first_rows(start, end)
        p = cell_positions(rows)
        prev = cell_positions(first_rows(add_days(start, -28), add_days(start, -1)))
        yl = d.c_y["left_out"][prev]
        n28 = np.bincount(d.c_cell[prev][~np.isnan(yl)], minlength=NCELL)
        pos.append(p)
        win.append(np.full(len(p), w, dtype=np.int64))
        small.append(n28[d.c_cell[p]] < SMALL)
    pos_a, win_a, small_a = np.concatenate(pos), np.concatenate(win), np.concatenate(small)
    pairs = d.cells.iloc[pos_a][["isolate_id", "patient_id", "date", "ward", "specimen", "organism", "antibiotic", "cell_id", "y_left_out", "y_counted"]].reset_index(drop=True)
    pairs["window"] = win_a
    pairs["small"] = small_a
    month = pairs["date"].str.slice(0, 7)
    outbreak = np.zeros(len(pairs), dtype=bool)
    for ward, months in OUTBREAKS.items():
        outbreak |= ((pairs["ward"] == ward) & month.isin(months)).to_numpy()
    return WindowTargets(
        pairs=pairs,
        window=win_a,
        cell=pairs["cell_id"].to_numpy(),
        y={"left_out": pairs["y_left_out"].to_numpy(), "counted": pairs["y_counted"].to_numpy()},
        small=small_a,
        ward_uro=(pairs["ward"] == "URO").to_numpy(),
        outbreak=outbreak,
        org=pairs["organism"].cat.codes.to_numpy().astype(np.int64),
        abx=pairs["antibiotic"].cat.codes.to_numpy().astype(np.int64),
        nwin=len(ws),
    )


@dataclass
class MonthTargets:
    """0010's targets: as-of the last day of each month 2024-09 to 2026-08, the target is the next calendar month; per
    month the unit's own first isolates (first within the month, hospital-wide, then restricted to the unit)."""

    months: list[tuple[str, str, str, str]]  # (as_of, label YYYY-MM, first day, last day)
    n_iso: np.ndarray  # (months, unit x specimen): target first isolates
    n_target: np.ndarray  # (months, cell): isolates with a row for the antibiotic = every target isolate of the cell's query
    covered: np.ndarray  # (months, cell): S
    known_all: np.ndarray  # (months, cell): results (untested left out)
    known_spec: np.ndarray  # (months, cell): results within spectrum (untested and no breakpoint left out)


@lru_cache(maxsize=1)
def month_targets() -> MonthTargets:
    d = data()
    months = []
    for as_of, label, end, _ in cl.month_ends():
        months.append((as_of, label, add_days(as_of, 1), end))
    m = len(months)
    n_iso = np.zeros((m, NWARD * NSPEC))
    arrays = {k: np.zeros((m, NCELL)) for k in ("n_target", "covered", "known_all", "known_spec")}
    for i, (_, _, start, end) in enumerate(months):
        rows = first_rows(start, end)
        iso = d.iso.iloc[rows]
        ws = iso["ward"].cat.codes.to_numpy().astype(np.int64)
        ss = iso["specimen"].cat.codes.to_numpy().astype(np.int64)
        n_iso[i] = np.bincount(ws * NSPEC + ss, minlength=NWARD * NSPEC)
        pos = cell_positions(rows)
        cid = d.c_cell[pos]
        yl, ys = d.c_y["left_out"][pos], d.c_y["spectrum"][pos]
        arrays["n_target"][i] = np.bincount(cid, minlength=NCELL)
        arrays["covered"][i] = np.bincount(cid, weights=np.nan_to_num(yl), minlength=NCELL)
        arrays["known_all"][i] = np.bincount(cid[~np.isnan(yl)], minlength=NCELL)
        arrays["known_spec"][i] = np.bincount(cid[~np.isnan(ys)], minlength=NCELL)
    return MonthTargets(months, n_iso, **arrays)


@dataclass
class Gate:
    """What the shipped list's pool says at each as-of: the level, its size, and per cell the share of the pool without a
    result (harness-spec.md: the untested share that gates "not assessable" comes from the shipped level pool)."""

    level: np.ndarray  # (months, unit x specimen), str
    pool: np.ndarray  # (months, unit x specimen)
    untested: np.ndarray  # (months, cell), NaN for cells the list does not offer


@lru_cache(maxsize=1)
def shipped_gate() -> Gate:
    mt = month_targets()
    d = data()
    m = len(mt.months)
    level = np.empty((m, NWARD * NSPEC), dtype=object)
    pool = np.zeros((m, NWARD * NSPEC), dtype=np.int64)
    untested = np.full((m, NCELL), np.nan)
    for i, (as_of, _, start, _) in enumerate(mt.months):
        recs = d.records[: int(np.searchsorted(d.day, _day(start), side="left"))]
        for ward in UNITS:
            for specimen in SPECIMENS:
                res = cl.coverage(recs, as_of=as_of, ward=ward, specimen=specimen)
                q = WARD_INDEX[ward] * NSPEC + SPEC_INDEX[specimen]
                level[i, q] = res.level
                pool[i, q] = res.isolates
                for c in res.antibiotics:
                    untested[i, cell_id(ward, specimen, c.antibiotic)] = c.untested_share
    return Gate(level, pool, untested)


# --- bootstrap ----------------------------------------------------------------------------------------------------


@lru_cache(maxsize=8)
def boot_indices(groups: int, boots: int = BOOTSTRAPS, seed: int = SEED) -> np.ndarray:
    """Bootstrap resamples of `groups` target windows (or months), drawn as 0004 draws them: one mulberry32(seed) stream,
    `floor(rand() * groups)` for each of `groups` slots of each of `boots` resamples."""
    rand = mulberry32(seed)
    return np.array([[math.floor(rand() * groups) for _ in range(groups)] for _ in range(boots)], dtype=np.int64)


def quantile(xs: np.ndarray, q: float) -> float:
    """0004's quantile: `sorted(xs)[floor(q * (len - 1))]` (NaN resamples dropped)."""
    xs = np.sort(xs[~np.isnan(xs)])
    return float(xs[math.floor(q * (len(xs) - 1))]) if len(xs) else math.nan


def _ci(xs: np.ndarray) -> list[float]:
    return [quantile(xs, 0.025), quantile(xs, 0.975)]


def _ratio(num: np.ndarray, den: np.ndarray) -> float:
    s = float(den.sum())
    return float(num.sum()) / s if s else math.nan


def _boot_ratio(num: np.ndarray, den: np.ndarray, idx: np.ndarray) -> np.ndarray:
    with np.errstate(invalid="ignore", divide="ignore"):
        return num[idx].sum(axis=1) / den[idx].sum(axis=1)


# --- C1, C2, C3(a), C5, C8 (C1): the 0004 windows --------------------------------------------------------------------


@dataclass
class WindowP:
    p: np.ndarray  # per row of WindowTargets
    fallback: int  # rows scored with the baseline's p because the estimator gave none
    done: bool = True


class Run:
    """One estimator's predictions, kept while its metrics are computed so that each metric does not call it again.
    Every public scoring function accepts an estimator or a `Run`."""

    def __init__(self, estimator: object) -> None:
        self.estimator = estimator
        self.name = _name(estimator)
        self._wp: dict[str, WindowP | None] | None = None
        self._mp: MonthP | None = None

    def window_p(self, convention: str) -> WindowP | None:
        """The estimator's p for every target row of the 26 windows under a convention (None: not supported). The two
        conventions of C1 are computed in one pass over the windows, on the same views."""
        if self._wp is None:
            baseline = {c: _baseline_window_p(c) for c in ("left_out", "counted")} if self.estimator is not hospital_365 else None
            self._wp = _window_ps(self.estimator, ("left_out", "counted"), baseline)
        if convention not in self._wp:
            raise ValueError(f"window predictions are for left_out and counted, not {convention!r}")
        return self._wp[convention]

    def month_p(self) -> MonthP:
        if self._mp is None:
            self._mp = _month_predictions(self.estimator)
        return self._mp


def _run(estimator: object) -> Run:
    return estimator if isinstance(estimator, Run) else Run(estimator)


def _need(res: WindowP | None, convention: str) -> WindowP:
    if res is None:
        raise NotImplementedError(f"an estimator must support the {convention!r} convention")
    return res


def _window_ps(
    estimator: object, conventions: Sequence[str], baseline: dict[str, np.ndarray] | None
) -> dict[str, WindowP | None]:
    """p of every target row for each convention, calling the estimator once per window and convention."""
    T = window_targets()
    ps: dict[str, np.ndarray | None] = {c: np.full(len(T.window), np.nan) for c in conventions}
    for w, (start, end) in enumerate(windows()):
        lo, hi = np.searchsorted(T.window, [w, w + 1])
        view = View(start, end=end)
        for convention in conventions:
            if ps[convention] is None:
                continue
            pred = _predict(estimator, view, convention)
            if pred is None:
                ps[convention] = None
                continue
            if "isolate_id" in pred and "cell_id" not in pred and "ward" not in pred:
                sl = T.pairs.iloc[lo:hi]
                key = sl["isolate_id"].astype(str) + "|" + sl["antibiotic"].astype(str)
                m = pd.Series(pred["p"].to_numpy(dtype=float), index=pred["isolate_id"].astype(str) + "|" + pred["antibiotic"].astype(str))
                ps[convention][lo:hi] = key.map(m).to_numpy(dtype=float)  # type: ignore[index]
            else:
                ps[convention][lo:hi] = normalise(pred).p[T.cell[lo:hi]]  # type: ignore[index]
    out: dict[str, WindowP | None] = {}
    for convention, p in ps.items():
        if p is None:
            out[convention] = None
            continue
        miss = np.isnan(p)
        if miss.any():
            if baseline is None:
                raise ValueError("the baseline itself gave no estimate for a cell")
            p = np.where(miss, baseline[convention], p)
        out[convention] = WindowP(p, int(miss.sum()))
    return out


@lru_cache(maxsize=1)
def _baseline_window_ps() -> dict[str, np.ndarray]:
    res = _window_ps(hospital_365, ("left_out", "counted"), None)
    return {c: _need(r, c).p for c, r in res.items()}


def _baseline_window_p(convention: str) -> np.ndarray:
    return _baseline_window_ps()[convention]


def _sums(T: WindowTargets, p: np.ndarray, convention: str, mask: np.ndarray | None = None) -> dict[str, np.ndarray]:
    y = T.y[convention]
    ok = ~np.isnan(y)
    if mask is not None:
        ok &= mask
    w, pp, yy = T.window[ok], p[ok], y[ok]
    pc = np.clip(pp, *CLIP)
    return {
        "n": np.bincount(w, minlength=T.nwin).astype(float),
        "brier": np.bincount(w, weights=(pp - yy) ** 2, minlength=T.nwin),
        "logloss": np.bincount(w, weights=-np.where(yy == 1, np.log(pc), np.log(1 - pc)), minlength=T.nwin),
    }


def window_subsets(T: WindowTargets, convention: str) -> dict[str, np.ndarray | None]:
    """The subsets 0004 scores: all, small (under 30 results in the unit's cell in the 28 days before), no URO."""
    return {"all": None, "small": T.small, "no URO": ~T.ward_uro}


def c1_c2_table(
    estimator: object,
    convention: str = "left_out",
    subsets: Sequence[str] = ("all", "small", "no URO"),
    boots: int = BOOTSTRAPS,
) -> dict[str, dict[str, dict]]:
    """Brier and log loss of an estimator against the hospital-365 baseline, as 0004's tables: for each subset and metric
    {"n", "value", "diff", "ci", "diff_ci"} with 95 % bootstrap intervals over target windows (mulberry32(2026)).

        table["all"]["brier"]["value"], table["small"]["logloss"]["diff_ci"], ...
    """
    T = window_targets()
    base_p = _baseline_window_p(convention)
    res = _run(estimator).window_p(convention)
    if res is None:
        raise NotImplementedError(convention)
    idx = boot_indices(T.nwin, boots)
    out: dict[str, dict[str, dict]] = {}
    for name in subsets:
        mask = window_subsets(T, convention)[name]
        e, b = _sums(T, res.p, convention, mask), _sums(T, base_p, convention, mask)
        out[name] = {}
        for metric in ("brier", "logloss"):
            n = e["n"]
            diff_boot = _boot_ratio(e[metric] - b[metric], n, idx)
            out[name][metric] = {
                "n": int(n.sum()),
                "value": _ratio(e[metric], n),
                "diff": _ratio(e[metric], n) - _ratio(b[metric], n),
                "ci": _ci(_boot_ratio(e[metric], n, idx)),
                "diff_ci": _ci(diff_boot),
                "fallback": res.fallback,
            }
    return out


def fit_logit(x: np.ndarray, n1: np.ndarray, n: np.ndarray, weights: np.ndarray | None = None, start: Sequence[float] = (0.0, 1.0)) -> tuple[float, float]:
    """Intercept and slope of the logistic regression of outcomes on x, from groups with n trials and n1 successes (and
    optional multiplicities), by Newton's method with step halving. NaN when x does not vary."""
    w = np.ones_like(x) if weights is None else weights
    X = np.stack([np.ones_like(x), x], axis=1)
    beta = np.array(start, dtype=float)

    def loglik(bt: np.ndarray) -> float:
        eta = X @ bt
        return float(np.sum(w * (n1 * eta - n * np.logaddexp(0, eta))))

    ll = loglik(beta)
    for _ in range(100):
        eta = X @ beta
        mu = 1 / (1 + np.exp(-eta))
        grad = X.T @ (w * (n1 - n * mu))
        hess = (X * (w * n * mu * (1 - mu))[:, None]).T @ X
        try:
            step = np.linalg.solve(hess, grad)
        except np.linalg.LinAlgError:
            return math.nan, math.nan
        t = 1.0
        while t > 1e-8:
            new = beta + t * step
            ll_new = loglik(new)
            if ll_new >= ll - 1e-12:
                break
            t /= 2
        beta, done = new, float(np.max(np.abs(t * step))) < 1e-10
        ll = ll_new
        if done:
            break
    return float(beta[0]), float(beta[1])


def c3a(estimator: object, boots: int = BOOTSTRAPS) -> tuple[dict, dict]:
    """C3(a): intercept and slope of the logistic regression of the isolate x antibiotic outcome on logit(p clipped),
    all windows pooled (left_out). The interval is a bootstrap over target windows (as C1), refitting grouped counts;
    not a Wald interval, which would treat the 13 results of an isolate as independent."""
    T = window_targets()
    res = _need(_run(estimator).window_p("left_out"), "left_out")
    y = T.y["left_out"]
    ok = ~np.isnan(y)
    x = np.log(np.clip(res.p[ok], *CLIP) / (1 - np.clip(res.p[ok], *CLIP)))
    xs, inv = np.unique(np.round(x, 12), return_inverse=True)
    gid = T.window[ok] * len(xs) + inv
    u, ginv = np.unique(gid, return_inverse=True)
    n_g = np.bincount(ginv).astype(float)
    n1_g = np.bincount(ginv, weights=y[ok])
    win_g = u // len(xs)
    x_g = xs[u % len(xs)]
    b0, b1 = fit_logit(x_g, n1_g, n_g)
    idx = boot_indices(T.nwin, boots)
    draws = np.array([fit_logit(x_g, n1_g, n_g, np.bincount(i, minlength=T.nwin)[win_g].astype(float), (b0, b1)) for i in idx])
    return {"slope": b1, "intercept": b0}, {"slope": _ci(draws[:, 1]), "intercept": _ci(draws[:, 0])}


def c5(estimator: object) -> tuple[dict[str, float], dict[str, int]]:
    """C5: Brier by organism x antibiotic over all windows (left_out), keys "<organism>|<antibiotic>"."""
    T = window_targets()
    res = _need(_run(estimator).window_p("left_out"), "left_out")
    y = T.y["left_out"]
    ok = ~np.isnan(y)
    k = T.org[ok] * NABX + T.abx[ok]
    n = np.bincount(k, minlength=len(data().organisms) * NABX)
    s = np.bincount(k, weights=(res.p[ok] - y[ok]) ** 2, minlength=len(n))
    out, cnt = {}, {}
    for j in np.nonzero(n)[0]:
        key = f"{data().organisms[j // NABX]}|{ANTIBIOTICS[j % NABX]}"
        out[key] = float(s[j] / n[j])
        cnt[key] = int(n[j])
    return out, cnt


def _c1_c2_metrics(estimator: object, boots: int) -> tuple[dict, dict, dict]:
    """C1, C1_diff, C2, C2_diff over the four keys all, small, all_counted, small_counted."""
    metrics: dict = {"C1": {}, "C1_diff": {}, "C2": {}, "C2_diff": {}}
    intervals: dict = {"C1": {}, "C1_diff": {}, "C2": {}, "C2_diff": {}}
    n: dict = {"C1": {}}
    for convention, suffix in (("left_out", ""), ("counted", "_counted")):
        try:
            tab = c1_c2_table(estimator, convention, ("all", "small"), boots)
        except NotImplementedError:
            continue
        for subset in ("all", "small"):
            key = subset + suffix
            for metric, name in (("brier", "C1"), ("logloss", "C2")):
                r = tab[subset][metric]
                metrics[name][key] = r["value"]
                metrics[name + "_diff"][key] = r["diff"]
                intervals[name][key] = r["ci"]
                intervals[name + "_diff"][key] = r["diff_ci"]
            n["C1"][key] = r["n"]
        n["C1"]["fallback" + suffix] = r["fallback"]
    n["C2"] = dict(n["C1"])
    return metrics, intervals, n


def _c8_c1(estimator: object, boots: int) -> tuple[dict, dict, dict]:
    """C8 (C1 part): Brier on the target isolates of the outbreak unit-months, URO 2025-06 to 08 and ICU 2026-02 to 04."""
    T = window_targets()
    base_p = _baseline_window_p("left_out")
    res = _need(_run(estimator).window_p("left_out"), "left_out")
    e, b = _sums(T, res.p, "left_out", T.outbreak), _sums(T, base_p, "left_out", T.outbreak)
    idx = boot_indices(T.nwin, boots)
    n = e["n"]
    v, vb = _ratio(e["brier"], n), _ratio(b["brier"], n)
    return (
        {"C1": v, "C1_diff": v - vb},
        {"C1": _ci(_boot_ratio(e["brier"], n, idx)), "C1_diff": _ci(_boot_ratio(e["brier"] - b["brier"], n, idx))},
        {"C1": int(n.sum())},
    )


# --- the month targets: C3(b), C4, C7, C8 (C4) --------------------------------------------------------------------------


@dataclass
class MonthP:
    """An estimator's cell arrays for every target month and the two conventions the list uses."""

    left_out: list[Cells]
    spectrum: list[Cells] | None


def month_predictions(estimator: object) -> MonthP:
    """The estimator's cell arrays for every target month: left_out and (if it supports it) spectrum."""
    return _run(estimator).month_p()


def _month_predictions(estimator: object) -> MonthP:
    mt = month_targets()
    out: dict[str, list[Cells] | None] = {"left_out": [], "spectrum": []}
    for _, _, start, end in mt.months:
        view = View(start, end=end, grid=OFFERED_GRID)
        for convention in ("left_out", "spectrum"):
            if out[convention] is None:
                continue
            pred = _predict(estimator, view, convention)
            if pred is None:
                out[convention] = None
            else:
                out[convention].append(normalise(pred))  # type: ignore[union-attr]
    if out["left_out"] is None:
        raise NotImplementedError("left_out")
    return MonthP(out["left_out"], out["spectrum"])


def _interval(c: Cells, i: int, level95: bool = True) -> tuple[float, float] | None:
    lo, hi = (c.lo95[i], c.hi95[i]) if level95 else (c.lo90[i], c.hi90[i])
    return (float(lo), float(hi)) if np.isfinite(lo) and np.isfinite(hi) else None


def _row(c_all: Cells, c_spec: Cells | None, i: int, antibiotic: str, untested: float) -> cl.Row:
    def share(c: Cells | None) -> float | None:
        if c is None or not np.isfinite(c.p[i]):
            return None
        if np.isfinite(c.n[i]) and c.n[i] < MIN_TESTED:
            return None
        return float(c.p[i])

    sa, ss = share(c_all), share(c_spec)
    return cl.Row(
        antibiotic,
        sa,
        _interval(c_all, i) if sa is not None else None,
        ss,
        _interval(c_spec, i) if ss is not None else None,
        untested,
    )


RANK_COLUMNS = [
    "m", "month", "ward", "specimen", "severity", "rank", "antibiotic", "standing", "share", "lower", "upper", "pa", "pb", "all_share",
    "covered", "known", "all_known", "n_target", "untested_n", "nobp_n", "level", "pool",
]  # fmt: skip


def rank_queries(estimator: object, mp: MonthP | None = None) -> pd.DataFrame:
    """Every query-month's suggestion list under the shipped rules, with the estimator's shares (harness-spec.md, C4):
    one row per (query-month, severity, suggested antibiotic), `rank` 0 the top pick, with the realised counts of the
    unit's own first isolates of the month on the basis the standing rests on (`covered`, `known`), over all organisms
    (`all_known`), the target isolates (`n_target`) and those untested (`untested_n`) or without breakpoint
    (`nobp_n`) for the antibiotic. Queries are unit x specimen x month with at least one target isolate, as 0010."""
    mp = mp or month_predictions(estimator)
    mt = month_targets()
    gate = shipped_gate()
    rows: list[tuple] = []
    for mi, label, ward, specimen in _queries(mt):
        c_all = mp.left_out[mi]
        c_spec = mp.spectrum[mi] if mp.spectrum else None
        q = WARD_INDEX[ward] * NSPEC + SPEC_INDEX[specimen]
        cl_rows = [_row(c_all, c_spec, cell_id(ward, specimen, a), a, float(gate.untested[mi, cell_id(ward, specimen, a)])) for a in cl.offered(specimen)]
        for severity in ("mild", "severe"):
            if severity == "mild" and c_spec is None:
                continue
            spec = severity == "mild"
            cb = c_spec if spec else c_all
            assert cb is not None
            for rank, s in enumerate(cl.suggest_rows(cl_rows, severity)):
                i = cell_id(ward, specimen, s.antibiotic)
                known_all = mt.known_all[mi, i]
                rows.append(
                    (
                        mi, label, ward, specimen, severity, rank, s.antibiotic, s.standing,
                        s.share if s.share is not None else math.nan,
                        s.interval[0] if s.interval else math.nan,
                        s.interval[1] if s.interval else math.nan,
                        cb.a[i], cb.b[i],
                        s.all_share if s.all_share is not None else math.nan,
                        mt.covered[mi, i],
                        mt.known_spec[mi, i] if spec else known_all,
                        known_all,
                        mt.n_target[mi, i],
                        mt.n_target[mi, i] - known_all,
                        known_all - mt.known_spec[mi, i],
                        gate.level[mi, q],
                        gate.pool[mi, q],
                    )
                )  # fmt: skip
    return pd.DataFrame(rows, columns=RANK_COLUMNS)


def _outbreak_unit_month(df: pd.DataFrame) -> np.ndarray:
    out = np.zeros(len(df), dtype=bool)
    for ward, months in OUTBREAKS.items():
        out |= ((df["ward"] == ward) & df["month"].isin(months)).to_numpy()
    return out


def c4_parts(ranked: pd.DataFrame, nm: int, mask: np.ndarray | None = None) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """C4's six figures as (covered, denominator) per target month, so pooled values and bootstrap draws come from them.

    mild_spectrum, severe: the top pick over the query-months where it "clears" (the list's own claim), realised within
    spectrum (mild) or over all organisms (severe), untested left out (0010 table 1). mild_all: the mild top pick over all
    query-months, all organisms, untested left out (0010 table 3: 75.4 %). The `_counted` figures use the same
    query-months and numerators and count the untested: over every target isolate (all organisms: mild_all, severe), or
    over every target isolate that has a breakpoint for the pick (mild_spectrum: no-breakpoint isolates are outside
    the spectrum, untested ones are not covered). Ours: 0010's untested-as-not-covered columns cover all organisms only.
    """
    top = (ranked if mask is None else ranked[mask])
    top = top[top["rank"] == 0]
    out: dict[str, tuple[np.ndarray, np.ndarray]] = {}

    def part(sel: pd.DataFrame, num: str, den: pd.Series) -> tuple[np.ndarray, np.ndarray]:
        m = sel["m"].to_numpy()
        return np.bincount(m, weights=sel[num].to_numpy(), minlength=nm), np.bincount(m, weights=den.to_numpy(), minlength=nm)

    mild = top[top["severity"] == "mild"]
    mild_c = mild[mild["standing"] == "clears"]
    severe_c = top[(top["severity"] == "severe") & (top["standing"] == "clears")]
    out["mild_spectrum"] = part(mild_c, "covered", mild_c["known"])
    out["mild_spectrum_counted"] = part(mild_c, "covered", mild_c["n_target"] - mild_c["nobp_n"])
    out["mild_all"] = part(mild, "covered", mild["all_known"])
    out["mild_all_counted"] = part(mild, "covered", mild["n_target"])
    out["severe"] = part(severe_c, "covered", severe_c["known"])
    out["severe_counted"] = part(severe_c, "covered", severe_c["n_target"])
    return out


def c4(ranked: pd.DataFrame, boots: int = BOOTSTRAPS, mask: np.ndarray | None = None, keys: Sequence[str] | None = None) -> tuple[dict, dict, dict]:
    """C4 values, 95 % bootstrap intervals over target months (mulberry32(2026)) and the isolates each rests on."""
    nm = len(month_targets().months)
    parts = c4_parts(ranked, nm, mask)
    idx = boot_indices(nm, boots)
    vals, cis, ns = {}, {}, {}
    for k, (num, den) in parts.items():
        if keys is not None and k not in keys:
            continue
        if den.sum() == 0:
            continue
        vals[k] = _ratio(num, den)
        cis[k] = _ci(_boot_ratio(num, den, idx))
        ns[k] = int(den.sum())
    return vals, cis, ns


def _expected_below(n: np.ndarray, p: np.ndarray, bar: np.ndarray, a: np.ndarray | None = None, b: np.ndarray | None = None) -> float:
    """Sum over cells of P(realised share < bar) for n isolates: Binomial(n, p), or Beta-binomial(n, a, b) (0010's rule
    `ceil(bar * n - 1e-9) - 1` for the largest count below the bar)."""
    kmax = np.ceil(bar * n - 1e-9).astype(int) - 1
    if a is None or b is None:
        return float(stats.binom.cdf(kmax, n, p).sum())
    return float(stats.betabinom.cdf(kmax, n, a, b).sum())


def _betas(rows: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """The Beta belief of each ranked row: the method's (a, b) where it gave them, else moment-matched to its 95 % interval."""
    a, b = rows["pa"].to_numpy(dtype=float), rows["pb"].to_numpy(dtype=float)
    ma, mb = beta_from_interval(rows["share"].to_numpy(dtype=float), rows["lower"].to_numpy(dtype=float), rows["upper"].to_numpy(dtype=float), Z95)
    use = ~(np.isfinite(a) & np.isfinite(b))
    return np.where(use, ma, a), np.where(use, mb, b)


def c3b(ranked: pd.DataFrame) -> tuple[dict, dict]:
    """C3(b): among query-months whose top pick clears and that have at least 10 target isolates with a result on its
    basis, those whose realised share fell below the threshold, against the number expected from the binomial at the
    predicted share (0010; Choices 2). Returns the metrics and, beside them, the Beta-binomial variant (the method's
    Beta, else one moment-matched to its interval). `pass`: both ratios at most 1.5 (None if a severity has no
    query-month to judge)."""
    out: dict = {}
    bb: dict = {}
    judged = {"binomial": [], "betabinomial": []}
    for severity in ("mild", "severe"):
        t = ranked[(ranked["rank"] == 0) & (ranked["severity"] == severity) & (ranked["standing"] == "clears") & (ranked["known"] >= MIN_TARGET)]
        thr = np.full(len(t), cl.THRESHOLDS[severity])
        n = t["known"].to_numpy(dtype=int)
        obs = int(((t["covered"] / t["known"]) < thr).sum())
        exp = _expected_below(n, t["share"].to_numpy(), thr)
        a, b = _betas(t)
        exp_bb = _expected_below(n, t["share"].to_numpy(), thr, a, b) if len(t) else 0.0
        out.update({f"{severity}_obs": obs, f"{severity}_exp": exp, f"{severity}_ratio": obs / exp if exp > 0 else None, f"{severity}_queries": len(t)})
        bb.update({f"{severity}_obs": obs, f"{severity}_exp": exp_bb, f"{severity}_ratio": obs / exp_bb if exp_bb > 0 else None})
        judged["binomial"].append(len(t) > 0 and obs <= PASS_RATIO * exp + 1e-12)
        judged["betabinomial"].append(len(t) > 0 and obs <= PASS_RATIO * exp_bb + 1e-12)
        out[f"_n_{severity}"] = len(t)
    have = out.pop("_n_mild") > 0 and out.pop("_n_severe") > 0
    out["pass"] = bool(all(judged["binomial"])) if have else None
    bb["pass"] = bool(all(judged["betabinomial"])) if have else None
    return out, bb


def lower_bound_check(ranked: pd.DataFrame) -> dict:
    """0010's second calibration row: every suggested antibiotic with an interval (both severities), query-months with at
    least 10 results on the basis, realised share below the interval's lower bound against the number expected from the
    binomial at the predicted share (0010: 959 of 4,285 against 1,079.0)."""
    t = ranked[ranked["lower"].notna() & (ranked["known"] >= MIN_TARGET)]
    n = t["known"].to_numpy(dtype=int)
    obs = int(((t["covered"] / t["known"]) < t["lower"]).sum())
    exp = _expected_below(n, t["share"].to_numpy(), t["lower"].to_numpy())
    a, b = _betas(t)
    exp_bb = _expected_below(n, t["share"].to_numpy(), t["lower"].to_numpy(), a, b) if len(t) else 0.0
    return {"cells": len(t), "obs": obs, "exp": exp, "ratio": obs / exp if exp > 0 else None, "exp_bb": exp_bb, "ratio_bb": obs / exp_bb if exp_bb > 0 else None}


def mid_pit(k: np.ndarray, n: np.ndarray, a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Mid-p probability integral transform of the realised count k under Beta-binomial(n, a, b):
    u = F(k - 1) + f(k) / 2."""
    return stats.betabinom.cdf(k - 1, n, a, b) + stats.betabinom.pmf(k, n, a, b) / 2


def _queries(mt: MonthTargets) -> list[tuple[int, str, str, str]]:
    """The query-months: (month index, month label, unit, specimen) with at least one target isolate (0010)."""
    return [
        (mi, label, ward, specimen)
        for mi, (_, label, _, _) in enumerate(mt.months)
        for ward in UNITS
        for specimen in SPECIMENS
        if mt.n_iso[mi, WARD_INDEX[ward] * NSPEC + SPEC_INDEX[specimen]] > 0
    ]


def c7(mp: MonthP, boots: int = BOOTSTRAPS) -> tuple[dict, dict, dict]:
    """C7: interval honesty over blocks of unit x specimen x antibiotic x target month with at least 20 target isolates
    with a result (left_out, offered antibiotics). (a) all blocks, (b) the outbreak unit-months. `a`, `b`: the realised
    count lies inside the method's 90 % predictive interval for the count at the block's n, from the mid-p PIT u with
    0.05 <= u <= 0.95 (Choices 1; the Beta-binomial of the method's Beta, else of a Beta moment-matched to its 90 %
    interval). `a_literal`, `b_literal`: the 90 % interval for p contains the realised share. `pass_a`: `a` within 0.85 to
    0.95 (proposed). Empty if the estimator gave no 90 % interval or Beta."""
    mt = month_targets()
    nm = len(mt.months)
    blocks = []  # (month index, month label, unit, cell, c)
    for mi, label, ward, specimen in _queries(mt):
        c = mp.left_out[mi]
        for a_ in cl.offered(specimen):
            i = cell_id(ward, specimen, a_)
            if mt.known_all[mi, i] >= MIN_BLOCK and np.isfinite(c.p[i]) and np.isfinite(c.lo90[i]) and np.isfinite(c.hi90[i]):
                blocks.append((mi, label, ward, i))
    if not blocks:
        return {}, {}, {}
    m = np.array([b[0] for b in blocks])
    cid = np.array([b[3] for b in blocks])
    df = pd.DataFrame({"month": [b[1] for b in blocks], "ward": [b[2] for b in blocks]})
    p, a, b, lo, hi = (np.array([getattr(mp.left_out[mi], f)[i] for mi, i in zip(m, cid, strict=True)]) for f in ("p", "a", "b", "lo90", "hi90"))
    ma, mb = beta_from_interval(p, lo, hi, Z90)
    use = ~(np.isfinite(a) & np.isfinite(b))
    a, b = np.where(use, ma, a), np.where(use, mb, b)
    k, n = mt.covered[m, cid], mt.known_all[m, cid]
    u = mid_pit(k, n, a, b)
    inside = (u >= 0.05) & (u <= 0.95)
    literal = (k / n >= lo) & (k / n <= hi)
    in_outbreak = _outbreak_unit_month(df)
    metrics, intervals, ns = {}, {}, {}
    idx = boot_indices(nm, boots)
    for suffix, flags in (("", inside), ("_literal", literal)):
        for tag, mask in (("a", np.ones(len(df), dtype=bool)), ("b", in_outbreak)):
            key = tag + suffix
            metrics[key] = float(flags[mask].mean()) if mask.any() else None
            ns[key] = int(mask.sum())
            if tag == "a":
                num = np.bincount(m[mask], weights=flags[mask].astype(float), minlength=nm)
                den = np.bincount(m[mask], minlength=nm).astype(float)
                intervals[key] = _ci(_boot_ratio(num, den, idx))
    metrics["pass_a"] = bool(PASS_BAND[0] <= metrics["a"] <= PASS_BAND[1])
    return metrics, intervals, ns


# --- C6: responsiveness ---------------------------------------------------------------------------------------------


@lru_cache(maxsize=1)
def e2_specimen() -> str:
    """The specimen with most ICU MRSA isolates in March 2026 (harness-spec.md: E2's cell)."""
    iso = data().iso
    sel = iso[(iso["ward"] == "ICU") & iso["date"].str.startswith("2026-03") & iso["mrsa"]]
    return str(sel["specimen"].value_counts().idxmax())


def _event(name: str) -> dict:
    e = dict(EVENTS[name])
    if e["specimen"] is None:
        e["specimen"] = e2_specimen()
    return e


def c6_estimates(estimator: object, event: str, days: Sequence[str], convention: str = "left_out") -> pd.DataFrame:
    """Daily as-of estimates for an event's cells: one row per day and antibiotic with p and the 90 % interval, from
    records dated up to and including that day. An estimator without 90 % intervals gives NaN."""
    e = _event(event)
    grid = make_grid([(e["ward"], e["specimen"], a) for a in e["antibiotics"]])
    rows = []
    for day in days:
        view = View(add_days(day, 1), end=add_days(day, 1), grid=grid)
        pred = _predict(estimator, view, convention)
        if pred is None:
            raise NotImplementedError(convention)
        c = normalise(pred)
        for a in e["antibiotics"]:
            i = cell_id(e["ward"], e["specimen"], a)
            rows.append((day, a, c.p[i], c.lo90[i], c.hi90[i]))
    return pd.DataFrame(rows, columns=["date", "antibiotic", "p", "lo90", "hi90"])


def c6_series(estimator: object, event: str, convention: str = "left_out") -> pd.DataFrame:
    """The daily estimates of C6's displayed period (E1 2025-04-01 to 2025-09-30; E2 2026-01-01 to 2026-05-31)."""
    start, end = _event(event)["period"]
    days = [add_days(start, i) for i in range(days_between(start, end) + 1)]
    return c6_estimates(estimator, event, days, convention)


def c6(estimator: object, max_days: int = C6_MAX_DAYS) -> dict[str, int | None]:
    """C6: for each event cell, days from the event's onset until the estimate's 90 % interval excludes the estimate of
    the day before onset ("not reached", None, if that does not happen within 120 days). Keys E1_CRO, E1_CXM, E2_CXM.
    Empty when the estimator gives no 90 % interval."""
    out: dict[str, int | None] = {}
    for event in ("E1", "E2"):
        e = _event(event)
        ref = c6_estimates(estimator, event, [add_days(e["onset"], -1)])
        if not (np.isfinite(ref["lo90"]).all() and np.isfinite(ref["hi90"]).all()):
            return {}
        p0 = dict(zip(ref["antibiotic"], ref["p"], strict=True))
        pending = set(e["antibiotics"])
        for a in e["antibiotics"]:
            out[f"{event}_{a}"] = None
        for d in range(0, max_days + 1):
            day = add_days(e["onset"], d)
            est = c6_estimates(estimator, event, [day])
            for _, r in est.iterrows():
                a = r["antibiotic"]
                if a in pending and (p0[a] < r["lo90"] or p0[a] > r["hi90"]):
                    out[f"{event}_{a}"] = d
                    pending.discard(a)
            if not pending:
                break
    return out


# --- the whole scoring ------------------------------------------------------------------------------------------------


@contextmanager
def _timed(label: str, timings: dict | None, verbose: bool):
    t0 = time.process_time()
    yield
    dt = time.process_time() - t0
    if timings is not None:
        timings[label] = dt
    if verbose:
        print(f"  {label}: {dt:.1f} s CPU", flush=True)


def score_estimator(
    estimator: object,
    *,
    with_c6: bool = True,
    extras: bool = True,
    boots: int = BOOTSTRAPS,
    verbose: bool = True,
    timings: dict | None = None,
) -> tuple[dict, dict, dict]:
    """Every coverage metric of harness-spec.md for one estimator: (metrics, intervals, n), ready for
    `aei.harness.write_metrics`, with exactly the keys of the spec's "Metric keys" block (coverage). A metric the estimator
    cannot produce is left out. `extras=True` adds, beside them, `C3b_bb` (C3(b) with the Beta-binomial expectation) and
    `C7_lower_bound` (0010's below-the-lower-bound check). `with_c6=False` skips the daily estimates of C6 (the slowest
    part for an expensive estimator). Prints the CPU seconds of each part; `timings` collects them. Pass a `Run` to reuse
    one estimator's predictions across `score_estimator` and the single-metric functions."""
    estimator = _run(estimator)
    if verbose:
        print(f"score_estimator({estimator.name})", flush=True)
    metrics: dict = {}
    intervals: dict = {}
    n: dict = {}
    t_all = time.process_time()
    with _timed("data and targets", timings, verbose):
        data()
        window_targets()
        month_targets()
        shipped_gate()
        _baseline_window_p("left_out")
        _baseline_window_p("counted")
    with _timed("C1 C2 (26 windows, two conventions)", timings, verbose):
        m, i, nn = _c1_c2_metrics(estimator, boots)
        metrics.update(m), intervals.update(i), n.update(nn)
    with _timed("C3a C5 C8-C1", timings, verbose):
        metrics["C3a"], intervals["C3a"] = c3a(estimator, boots)
        metrics["C5"], n["C5"] = c5(estimator)
        metrics["C8"], intervals["C8"], n["C8"] = _c8_c1(estimator, boots)
    with _timed("month predictions, C3b C4 C7 C8-C4", timings, verbose):
        try:
            mp = month_predictions(estimator)
        except NotImplementedError:
            mp = None
        if mp is not None and mp.left_out[0].has_interval:
            ranked = rank_queries(estimator, mp)
            vals, cis, ns = c4(ranked, boots)
            if vals:
                metrics["C4"], intervals["C4"], n["C4"] = vals, cis, ns
            if mp.spectrum is not None:
                c3, bb = c3b(ranked)
                metrics["C3b"] = {k: v for k, v in c3.items() if k != "mild_queries" and k != "severe_queries"}
                n["C3b"] = {"mild": c3["mild_queries"], "severe": c3["severe_queries"]}
                if extras:
                    metrics["C3b_bb"] = bb
                    metrics["C7_lower_bound"] = lower_bound_check(ranked)
            ov = _outbreak_unit_month(ranked)
            ov_vals, ov_cis, ov_ns = c4(ranked, boots, mask=ov, keys=("mild_spectrum", "severe"))
            for k, key in (("mild_spectrum", "C4_mild_spectrum"), ("severe", "C4_severe")):
                if k in ov_vals:
                    metrics["C8"][key] = ov_vals[k]
                    intervals["C8"][key] = ov_cis[k]
                    n["C8"][key] = ov_ns[k]
        if mp is not None:
            m7, i7, n7 = c7(mp, boots)
            if m7:
                metrics["C7"], intervals["C7"], n["C7"] = m7, i7, n7
    if with_c6:
        with _timed("C6 (daily estimates over two events)", timings, verbose):
            try:
                m6 = c6(estimator.estimator)
            except NotImplementedError:
                m6 = {}
            if m6:
                metrics["C6"] = m6
    if verbose:
        print(f"  total: {time.process_time() - t_all:.1f} s CPU", flush=True)
    return metrics, intervals, n


# --- baseline estimators ------------------------------------------------------------------------------------------------


def _frame(view: View, **cols: np.ndarray) -> pd.DataFrame:
    """The view's grid with columns taken from per-cell arrays (indexed by cell_id)."""
    out = view.grid[["ward", "specimen", "antibiotic", "cell_id"]].copy()
    cid = out["cell_id"].to_numpy()
    for k, v in cols.items():
        out[k] = v[cid] if len(v) == NCELL else v
    return out


class Hospital365:
    """0004's estimator 3, the baseline: the hospital's last 365 days, same specimen, all units, first isolates per
    365-day window. p = k / n (0.5 for an empty cell). For intervals, the Jeffreys interval of the hospital cell, the
    Beta(k + 0.5, n - k + 0.5) (a choice of the harness: 0004 has no interval); `a`, `b` are those parameters."""

    name = "hospital_365"

    def predict(self, view: View, convention: str) -> pd.DataFrame:
        k, n = view.counts(365, convention, "hospital")
        p = np.where(n > 0, k / np.where(n > 0, n, 1), 0.5)
        a, b = k + 0.5, n - k + 0.5
        lo95, hi95 = beta_interval(a, b, 0.95)
        lo90, hi90 = beta_interval(a, b, 0.90)
        return _frame(view, p=p, a=a, b=b, lo95=lo95, hi95=hi95, lo90=lo90, hi90=hi90, n=n)


class Shipped:
    """The coverage list as shipped (D-023, D-033): per query the unit's last 365 days of first isolates if it has 30 of
    them, else the ward type's, else the hospital's; the share is covered / known at that level with the 95 % Wilson
    interval (and Wilson at z = 1.644854 for 90 %); no estimate (NaN) with fewer than 30 results. Computed by
    `aei.coverage_list.coverage`, the mirror of the TypeScript. The convention picks the counts: left_out is the list's
    `counts`, spectrum its `spectrum.counts`, counted covered over the level's whole pool."""

    name = "shipped"

    def _result(self, view: View, ward: str, specimen: str) -> cl.CoverageResult:
        key = ("shipped", ward, specimen)
        if key not in view.memo:
            codes = [a for a in ANTIBIOTICS if suits_specimen(a, specimen)]
            view.memo[key] = cl.coverage(view.records, as_of=view.as_of, ward=ward, specimen=specimen, codes=codes)
        return view.memo[key]

    def predict(self, view: View, convention: str) -> pd.DataFrame:
        cols = {c: np.full(NCELL, np.nan) for c in ("p", "lo95", "hi95", "lo90", "hi90", "n")}
        level = np.full(NCELL, "", dtype=object)
        for (ward, specimen), g in view.grid.groupby(["ward", "specimen"], observed=True):
            res = self._result(view, str(ward), str(specimen))
            by = {c.antibiotic: c for c in res.antibiotics}
            for a in g["antibiotic"]:
                c = by[str(a)]
                if convention == "left_out":
                    k, n = c.counts.covered, c.counts.known
                elif convention == "spectrum":
                    k, n = c.spectrum.counts.covered, c.spectrum.counts.known
                elif convention == "counted":
                    k, n = c.counts.covered, res.isolates
                else:
                    raise ValueError(convention)
                i = cell_id(str(ward), str(specimen), str(a))
                level[i] = res.level
                cols["n"][i] = n
                if n >= MIN_TESTED:
                    cols["p"][i] = k / n
                    cols["lo95"][i], cols["hi95"][i] = wilson(k, n, Z95)
                    cols["lo90"][i], cols["hi90"][i] = wilson(k, n, Z90)
        out = _frame(view, **cols)
        out["level"] = level[out["cell_id"].to_numpy()]
        return out


hospital_365 = Hospital365()
shipped = Shipped()


# --- 0004's eight estimators through the protocol ---------------------------------------------------------------------------


class _Estimator0004:
    """One of 0004's estimators of the covered share (experiments/0004-coverage-estimators/README.md): raw or shrunk
    unit or hospital figures over 28 or 365 days. An empty cell falls back to the hospital's 365 days (0.5 if empty)."""

    def __init__(self, name: str, kind: str, m: int | None = None) -> None:
        self.name, self.kind, self.m = name, kind, m

    def predict(self, view: View, convention: str) -> pd.DataFrame:
        k365h, n365h = view.counts(365, convention, "hospital")
        p_hosp = np.where(n365h > 0, k365h / np.where(n365h > 0, n365h, 1), 0.5)

        def raw(days: int, level: str) -> np.ndarray:
            k, n = view.counts(days, convention, level)
            return np.where(n > 0, k / np.where(n > 0, n, 1), p_hosp)

        def shrunk(days: int, prior: np.ndarray, m: int) -> np.ndarray:
            k, n = view.counts(days, convention, "unit")
            return (k + m * prior) / (n + m)

        if self.kind == "unit28":
            p = raw(28, "unit")
        elif self.kind == "unit365":
            p = raw(365, "unit")
        elif self.kind == "hospital365":
            p = p_hosp
        elif self.kind == "hospital28":
            p = raw(28, "hospital")
        elif self.kind == "shrunk365":
            p = shrunk(365, p_hosp, 20)
        elif self.kind == "shrunk28":
            assert self.m is not None
            p = shrunk(28, shrunk(365, p_hosp, 20), self.m)
        else:
            raise ValueError(self.kind)
        return _frame(view, p=p)


def estimators_0004() -> list[tuple[str, Estimator]]:
    """0004's eight estimators in its order, with the names its tables use; the baseline is the third."""
    return [
        ("1 unit 28 d raw", _Estimator0004("unit_28", "unit28")),
        ("2 unit 365 d raw", _Estimator0004("unit_365", "unit365")),
        ("3 hospital 365 d (baseline)", _Estimator0004("hospital_365", "hospital365")),
        ("4 hospital 28 d", _Estimator0004("hospital_28", "hospital28")),
        ("5 unit 365 d shrunk to hospital (M 20)", _Estimator0004("unit_365_shrunk_20", "shrunk365")),
        *((f"6 unit 28 d shrunk to 5 (M {m})", _Estimator0004(f"unit_28_shrunk_{m}", "shrunk28", m)) for m in (5, 20, 50)),
    ]
