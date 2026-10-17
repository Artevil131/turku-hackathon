"""Source episodes for version A of experiment 0019: when would the tool have raised a cluster alert for a phenotype
in a unit, from real data only. The rule is the plan's (README.md, "Version A"):

    every Sunday d, per unit and phenotype: c = distinct patients with the phenotype in the 4 weeks ending d
    (d - 27 .. d), b = distinct patients in the 26 weeks before those (d - 209 .. d - 28), mu = (b + 0.5) * 28 / 182,
    fires when c >= 2 and P(X >= c | Poisson(mu)) < 0.05;
    Sundays that fire with at most 28 days between one and the next are one episode; its onset is its first Sunday.

The count of patients is the harness's (`aei.score_prediction.unit_outcome`) with a 4-week horizon in place of 8; the
function below reads only records dated up to d, so an onset uses nothing from after it.
"""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from collections import defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from scipy import stats

from aei.dataset import IsolateRecord
from aei.dates import add_days
from aei.domain import UNITS

CURRENT_WEEKS, BASELINE_WEEKS = 4, 26
ALPHA, MIN_PATIENTS, MERGE_DAYS = 0.05, 2, 28


@dataclass(frozen=True)
class Episode:
    phenotype: str  # "ESBL E. coli" or "MRSA"
    unit: str
    onset: str  # the first Sunday on which the rule fires
    last: str  # the last Sunday of the episode on which it fires
    weeks_fired: int
    current: int  # distinct patients in the 4 weeks ending at onset
    baseline: int
    p: float


def sundays(first: str, last: str) -> list[str]:
    d = date.fromisoformat(first)
    d += timedelta(days=(6 - d.weekday()) % 7)
    out = []
    while d.isoformat() <= last:
        out.append(d.isoformat())
        d += timedelta(days=7)
    return out


def _distinct(dates: list[str], patients: list[str], lo: str, hi: str) -> int:
    return len(set(patients[bisect_left(dates, lo) : bisect_right(dates, hi)]))


def find_episodes(records: Sequence[IsolateRecord], name: str, ok: Callable[[IsolateRecord], bool], *, first_data: str, last_data: str, units: Sequence[str] = UNITS) -> list[Episode]:
    """All episodes of the phenotype `name` (records passing `ok`) over the data, in order of onset then unit. Sundays
    are only used from the first one with a full 26-week baseline (30 weeks of data)."""
    by_unit: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for r in records:
        if r.ward in units and ok(r):
            by_unit[r.ward].append((r.sample_date, r.patient_id))
    first_sunday = sundays(add_days(first_data, 7 * (CURRENT_WEEKS + BASELINE_WEEKS) - 1), last_data)
    out: list[Episode] = []
    for unit in units:
        rows = sorted(by_unit.get(unit, []))
        dates, patients = [r[0] for r in rows], [r[1] for r in rows]
        fired: list[tuple[str, int, int, float]] = []
        for d in first_sunday:
            c = _distinct(dates, patients, add_days(d, -7 * CURRENT_WEEKS + 1), d)
            if c < MIN_PATIENTS:
                continue
            b = _distinct(dates, patients, add_days(d, -7 * (CURRENT_WEEKS + BASELINE_WEEKS) + 1), add_days(d, -7 * CURRENT_WEEKS))
            mu = (b + 0.5) * (7 * CURRENT_WEEKS) / (7 * BASELINE_WEEKS)
            p = float(stats.poisson.sf(c - 1, mu))
            if p < ALPHA:
                fired.append((d, c, b, p))
        group: list[tuple[str, int, int, float]] = []
        for f in fired:
            if group and (date.fromisoformat(f[0]) - date.fromisoformat(group[-1][0])).days > MERGE_DAYS:
                out.append(_episode(name, unit, group))
                group = []
            group.append(f)
        if group:
            out.append(_episode(name, unit, group))
    return sorted(out, key=lambda e: (e.onset, e.unit, e.phenotype))


def _episode(name: str, unit: str, group: list[tuple[str, int, int, float]]) -> Episode:
    d, c, b, p = group[0]
    return Episode(name, unit, d, group[-1][0], len(group), c, b, p)
