"""Version B of experiment 0019: two controls with injected two-unit clusters.

A rare clone (ESBL *E. coli*, ESBL *K. pneumoniae* or MRSA, `aei.inject.clones`) is copied as new patients, ceil(k/2) in
unit A and floor(k/2) in unit B, each sampled within 14 days of a start. The draws are those of `aei.inject.rare_hits`
and `two_unit_hits` (unit, start by `draw_start`, clone, then a sample day and a sex per patient), written out here
from the existing helpers `clones`, `draw_start` and `CLUSTER_AVOID`, because the generic trials of `aei.inject` are being
extended and the outcome needs 56 days of data where a trial hands a detector 28.

    B1, flow partner:    B one of A's neighbours in the 365 days before the start, weighted by the patients moved
                         between A and B either way (as `two_unit_hits`); a neighbour with a planted event within 45
                         days of the start is not a candidate, and A and the start are redrawn when none is left.
    B2, uniform partner: B uniform over the units other than A, with the same planted-event exclusion.

Per trial the exposure of the other eight units from A over the 365 days before the start is scored against the
outcome on the real records plus the injected patients (`aei.score_prediction.score_exposure` at the start as onset),
at alpha 0.05, with the rewiring null of the harness at `n_null` permutations.
"""

from __future__ import annotations

import dataclasses
import math
from bisect import bisect_left, bisect_right
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from scipy import stats

from aei import score_prediction as sp
from aei.dataset import Culture, IsolateRecord
from aei.dates import add_days, days_between
from aei.domain import UNITS, WARD_TYPE
from aei.inject import CLUSTER_AVOID, _pick_int, clones, draw_start
from aei.relations import count_flows, patient_moves

# Planted events whose own patients would make a unit look positive: (unit, phenotype, first day, last day), the
# exclusion zones of harness-spec.md "Choices" 4.
PLANTED = (("URO", "esbl", "Escherichia coli", "2025-05-30", "2025-08-31"), ("ICU", "mrsa", "Staphylococcus aureus", "2026-03-01", "2026-04-30"))


class Flows:
    """Patients moved between units in a window, either direction, for the flow-partner draw."""

    def __init__(self, cultures: Sequence[Culture]):
        self.moves = patient_moves(cultures)

    def neighbours(self, unit: str, start: str) -> list[tuple[str, int]]:
        w: dict[str, int] = {}
        for f in count_flows(self.moves, (add_days(start, -365), add_days(start, -1))):
            if f.source == unit:
                w[f.to] = w.get(f.to, 0) + f.patients
            elif f.to == unit:
                w[f.source] = w.get(f.source, 0) + f.patients
        return [(u, w[u]) for u in UNITS if u in w and u != unit]


def _near_planted(unit: str, start: str) -> bool:
    return any(unit == c_u and abs(days_between(c, start)) <= 45 for c_u, c in CLUSTER_AVOID)


@dataclass
class Trial:
    control: str  # "B1" or "B2"
    k: int
    index: int  # trial number in the single stream
    a: str
    b: str
    start: str
    source: IsolateRecord
    injected: list[IsolateRecord]
    flt: dict  # the outcome's phenotype filter: the clone's organism and flag


def draw_trial(control: str, k: int, index: int, rand, sources: Sequence[IsolateRecord], flows: Flows) -> Trial:
    if control == "B1":
        while True:
            a = UNITS[_pick_int(rand, len(UNITS))]
            start = draw_start(rand, a, CLUSTER_AVOID)
            cand = [(u, w) for u, w in flows.neighbours(a, start) if not _near_planted(u, start)]
            if cand:
                break
        x = rand() * sum(w for _, w in cand)
        b = cand[-1][0]
        acc = 0
        for u, w in cand:
            acc += w
            if acc > x:
                b = u
                break
    else:
        a = UNITS[_pick_int(rand, len(UNITS))]
        start = draw_start(rand, a, CLUSTER_AVOID)
        cand_u = [u for u in UNITS if u != a and not _near_planted(u, start)]
        b = cand_u[_pick_int(rand, len(cand_u))]
    source = sources[_pick_int(rand, len(sources))]
    injected = []
    for unit, n in ((a, math.ceil(k / 2)), (b, k // 2)):
        for _ in range(n):
            i = len(injected)
            sample_date = add_days(start, _pick_int(rand, 14))
            injected.append(
                dataclasses.replace(
                    source,
                    isolate_id=f"INJ{index}-{i}-1",
                    culture_id=f"INJ{index}-{i}",
                    patient_id=f"PINJ{index}-{i}",
                    sample_date=sample_date,
                    admission_date=add_days(sample_date, -5) if WARD_TYPE[unit] == "in" else None,
                    ward=unit,
                    sex="F" if rand() < 0.5 else "M",
                )
            )
    flag = "mrsa" if source.organism == "Staphylococcus aureus" else "esbl"
    return Trial(control, k, index, a, b, start, source, injected, {"organism": source.organism, "phenotype": flag})


def contaminated(t: Trial) -> bool:
    """A planted event of the clone's own organism and flag in a unit other than A has days inside the trial's
    26-week baseline or 8-week outcome window (start - 182 to start + 55): that unit's counts are not the injection's
    and it may be a baseline-inflated negative or a positive for the planted event's own reasons."""
    lo, hi = add_days(t.start, -7 * sp.BASELINE_WEEKS), add_days(t.start, 7 * sp.HORIZON_WEEKS - 1)
    return any(t.a != unit and t.flt["phenotype"] == flag and t.flt["organism"] == org and first <= hi and lo <= last for unit, flag, org, first, last in PLANTED)


def truncated(t: Trial, last_data: str) -> bool:
    return add_days(t.start, 55) > last_data


class Data:
    """Records and cultures in date order with their date lists, so a trial reads slices."""

    def __init__(self, records: Sequence[IsolateRecord], cultures: Sequence[Culture]):
        self.records = sorted(records, key=lambda r: r.sample_date)
        self.cultures = sorted(cultures, key=lambda c: c.sample_date)
        self.rdates = [r.sample_date for r in self.records]
        self.cdates = [c.sample_date for c in self.cultures]
        self.last = self.rdates[-1]

    def cultures_before(self, start: str, days: int = 365) -> list[Culture]:
        return self.cultures[bisect_left(self.cdates, add_days(start, -days)) : bisect_left(self.cdates, start)]

    def records_around(self, start: str) -> list[IsolateRecord]:
        return self.records[bisect_left(self.rdates, add_days(start, -7 * sp.BASELINE_WEEKS)) : bisect_right(self.rdates, add_days(start, 7 * sp.HORIZON_WEEKS - 1))]


def rank_desc(values: np.ndarray, i: int) -> float:
    """Rank of entry i when the values are ordered from the highest (1) down; ties share the average rank."""
    return float(stats.rankdata(-values)[i])


def score_trial(t: Trial, data: Data, n_null: int, seed: int = 2026) -> dict:
    res = sp.score_exposure(data.cultures_before(t.start), data.records_around(t.start) + t.injected, t.a, t.start, t.flt, n_null=n_null, seed=seed)
    others = [u for u in UNITS if u != t.a]
    tab = res.table.loc[others]
    i = others.index(t.b)
    m = res.metrics["P1"]
    a05 = res.null["a05"]
    return {
        "control": t.control,
        "k": t.k,
        "trial": t.index,
        "a": t.a,
        "b": t.b,
        "start": t.start,
        "clone": f"{t.flt['organism']} {t.flt['phenotype']}",
        "positives": m["positives_a05"],
        "b_positive": bool(tab.loc[t.b, "positive_a05"]),
        "b_patients": int(tab.loc[t.b, "patients"]),
        "b_expected": float(tab.loc[t.b, "expected"]),
        "auc_share": m["auc_share_a05"],
        "auc_raw": m["auc_raw_a05"],
        "p_share": m["null_p_share_a05"],
        "p_raw": m["null_p_raw_a05"],
        "rank_share": rank_desc(tab["share"].to_numpy(), i),
        "rank_raw": rank_desc(tab["raw"].to_numpy(), i),
        "share_b": float(tab.loc[t.b, "share"]),
        "raw_b": float(tab.loc[t.b, "raw"]),
        "contaminated": contaminated(t),
        "truncated": truncated(t, data.last),
        "_null_share": a05["null_share"],
        "_null_raw": a05["null_raw"],
    }
