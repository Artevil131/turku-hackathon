"""A control for the interpretation of 0015, not part of the plan's method: the live phenotype-excess test alone (Poisson,
28-day window, 365-day baseline, at least 2 patients, D-020) as a detector for `aei.score_detection`, on the same four
phenotype series per unit, so the Gamma-Poisson test can be read against a Poisson test on the same series and not only
against the whole live set, whose profile-excess test reads the exact 13-drug profile."""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from collections.abc import Sequence
from dataclasses import dataclass

from aei.dataset import Culture, IsolateRecord
from aei.dates import add_days
from aei.detect import LIVE_SETTINGS, Signal, phenotype_excess
from aei.domain import PHENOTYPES
from aei.inject import Focus
from aei.score_detection import LEVELS_LIVE, Detector


def _sample_date(x) -> str:
    return x.sample_date


@dataclass(eq=False)
class PhenotypeExcessOnly(Detector):
    """The level m multiplies the shipped alpha (1e-3); signals are made at the loosest level and read with `passes`."""

    name: str = "live phenotype excess alone (Poisson, D-020)"
    levels: tuple[float, ...] = LEVELS_LIVE
    alpha: float = LIVE_SETTINGS["phenotype_excess"]["alpha"]

    def run(self, records: Sequence[IsolateRecord], cultures: Sequence[Culture], focus: Focus | None = None) -> list[Signal]:
        kw = {**LIVE_SETTINGS["phenotype_excess"], "alpha": self.alpha * max(self.levels)}
        if focus is None or focus.start is None or focus.end is None:
            return phenotype_excess(records, PHENOTYPES, **kw)
        lo = add_days(focus.start, -400)
        rs = records[bisect_left(records, lo, key=_sample_date) : bisect_right(records, focus.end, key=_sample_date)]
        phenotypes = PHENOTYPES if focus.phenotypes is None else [p for p in PHENOTYPES if p in focus.phenotypes]
        return phenotype_excess([r for r in rs if r.ward in set(focus.units)], phenotypes, **kw) if phenotypes else []

    def passes(self, signal: Signal, level: float) -> bool:
        return signal.p is not None and signal.p < self.alpha * level

    def kind_of(self, signal: Signal) -> str:
        return "cluster"
