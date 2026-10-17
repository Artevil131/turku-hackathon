"""Profile excess and phenotype excess with the Beta-binomial predictive tail in place of the Poisson tail (experiment 0023).

Everything except the tail is `aei.detect`'s: window, baseline, the 50-isolate floor, observed y (distinct patients), the
minimums, the signal fields. Tail: baseline successes s and trials t (isolates, each weighted delta ** w with w the whole
weeks between it and the window's start) give a = s + m * pi, b = t - s + m * (1 - pi), pi the parent's smoothed share;
Y ~ BetaBinomial(n, a, b) for the n patients of the window, p = P(Y >= y). `BBTail` is `LiveSet` with the two cluster
functions swapped, so a run differs from the live set in that one thing.
"""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from scipy.stats import betabinom

from aei import score_detection as sd
from aei.dataset import Culture, IsolateRecord
from aei.dates import add_days
from aei.detect import (
    LIVE_SETTINGS,
    SURVEILLANCE_PAIRS,
    Signal,
    _by_date,
    _group_by,
    _patients,
    _slice,
    empty_run,
    has_acquired_resistance,
    in_detected_cluster,
    profile_of,
    rising_trend,
    sampling_drop,
)
from aei.domain import PHENOTYPES
from aei.inject import Focus

_ORD: dict[str, int] = {}


def ordinal(day: str) -> int:
    o = _ORD.get(day)
    if o is None:
        from datetime import date

        o = _ORD[day] = date.fromisoformat(day).toordinal()
    return o


def tail(y: int, n: int, a: float, b: float) -> float:
    """P(Y >= y) for Y ~ BetaBinomial(n, a, b)."""
    if y <= 0:
        return 1.0
    if y > n:
        return 0.0
    return min(1.0, float(betabinom.sf(y - 1, n, a, b)))


class Ords:
    """Sorted date ordinals of a list of dates: counts of a range, unweighted or weighted by delta ** weeks-before."""

    __slots__ = ("o",)

    def __init__(self, dates: Sequence[str]):
        self.o = np.fromiter((ordinal(d) for d in dates), dtype=np.int64, count=len(dates))

    def count(self, lo: str, hi: str, start: str, delta: float) -> float:
        i, j = np.searchsorted(self.o, [ordinal(lo), ordinal(hi)], side="left")[0], np.searchsorted(self.o, ordinal(hi), side="right")
        if delta == 1.0:
            return float(j - i)
        w = (ordinal(start) - self.o[i:j] - 1) // 7
        return float(np.power(delta, w).sum())


def _group(ordered: Sequence[IsolateRecord], key) -> dict:
    g = _group_by(ordered, key)
    return {k: (v, [r.sample_date for r in v], Ords([r.sample_date for r in v])) for k, v in g.items()}


def profile_excess_bb(
    records: Sequence[IsolateRecord],
    *,
    window_days: int,
    baseline_days: int,
    alpha: float,
    min_observed: int,
    m: float,
    delta: float = 1.0,
    parent: str = "stratum",
    same_specimen: bool = False,
    only=None,
) -> list[Signal]:
    """`aei.detect.profile_excess` with the Beta-binomial tail. `parent` "stratum": pi is the stratum's own smoothed share
    (the live mean, a wider tail only); "organism": the profile's share among the organism's isolates over all specimens."""
    ordered = _by_date(records)
    profile = {id(r): profile_of(r) for r in ordered}

    def stratum(r):
        return f"{r.organism}|{r.specimen}" if same_specimen else r.organism

    by_stratum = _group(ordered, stratum)
    by_profile = _group(ordered, lambda r: f"{stratum(r)}|{profile[id(r)]}")
    by_unit = _group(ordered, lambda r: f"{r.ward}|{stratum(r)}")
    by_org = _group(ordered, lambda r: r.organism) if parent == "organism" else None
    by_org_profile = _group(ordered, lambda r: f"{r.organism}|{profile[id(r)]}") if parent == "organism" else None
    signals = []
    for r in ordered:
        if (only is not None and not only(r)) or not has_acquired_resistance(r):
            continue
        prof = profile[id(r)]
        start = add_days(r.sample_date, 1 - window_days)
        base_to, base_from = add_days(start, -1), add_days(start, -baseline_days)
        s_key = stratum(r)
        unit_items, unit_dates, _ = by_unit[f"{r.ward}|{s_key}"]
        in_window = _slice(unit_items, unit_dates, start, r.sample_date)
        observed = _patients(x for x in in_window if profile[id(x)] == prof)
        if observed < min_observed:
            continue
        _, strat_dates, strat_o = by_stratum[s_key]
        if bisect_right(strat_dates, base_to) - bisect_left(strat_dates, base_from) < 50:
            continue
        t = strat_o.count(base_from, base_to, start, delta)
        s = by_profile[f"{s_key}|{prof}"][2].count(base_from, base_to, start, delta)
        if parent == "organism":
            t_o = by_org[r.organism][2].count(base_from, base_to, start, delta)
            s_o = by_org_profile[f"{r.organism}|{prof}"][2].count(base_from, base_to, start, delta)
            pi = (s_o + 0.5) / (t_o + 1)
        else:
            pi = (s + 0.5) / (t + 1)
        a, b = s + m * pi, t - s + m * (1 - pi)
        n = _patients(in_window)
        p = tail(observed, n, a, b)
        if p < alpha:
            signals.append(
                Signal("profile-excess", f"{r.ward}|{r.organism}|{prof}", r.sample_date, r.ward, observed, organism=r.organism, profile=prof, expected=n * a / (a + b), p=p)
            )
    return signals


def phenotype_excess_bb(
    records: Sequence[IsolateRecord],
    phenotypes: Sequence[str],
    *,
    window_days: int,
    baseline_days: int,
    alpha: float,
    min_observed: int,
    m: float,
    delta: float = 1.0,
    units: Sequence[str] | None = None,
) -> list[Signal]:
    """`aei.detect.phenotype_excess` with the Beta-binomial tail; the parent is the hospital's smoothed share of the phenotype
    over the same baseline, so `records` must hold every unit's rows (`units` limits the units tested)."""
    ordered = _by_date(records)
    by_unit = _group(ordered, lambda r: r.ward)
    hosp_all = Ords([r.sample_date for r in ordered])
    by_unit_ph, by_ph = {}, {}
    for ph in phenotypes:
        with_ph = [r for r in ordered if ph in r.phenotypes]
        by_ph[ph] = Ords([r.sample_date for r in with_ph])
        for ward, rs in _group_by(with_ph, lambda r: r.ward).items():
            by_unit_ph[(ward, ph)] = Ords([r.sample_date for r in rs])
    unit_set = None if units is None else set(units)
    signals = []
    for r in ordered:
        if unit_set is not None and r.ward not in unit_set:
            continue
        for ph in r.phenotypes:
            if ph not in phenotypes:
                continue
            items, dates, u_o = by_unit[r.ward]
            start = add_days(r.sample_date, 1 - window_days)
            in_window = _slice(items, dates, start, r.sample_date)
            observed = _patients(x for x in in_window if ph in x.phenotypes)
            if observed < min_observed:
                continue
            lo, hi = add_days(start, -baseline_days), add_days(start, -1)
            if len(_slice(items, dates, lo, hi)) < 50:
                continue
            t = u_o.count(lo, hi, start, delta)
            s = by_unit_ph[(r.ward, ph)].count(lo, hi, start, delta)
            pi = (by_ph[ph].count(lo, hi, start, delta) + 0.5) / (hosp_all.count(lo, hi, start, delta) + 1)
            a, b = s + m * pi, t - s + m * (1 - pi)
            n = _patients(in_window)
            p = tail(observed, n, a, b)
            if p < alpha:
                signals.append(Signal("phenotype-excess", f"{r.ward}|{ph}", r.sample_date, r.ward, observed, phenotype=ph, expected=n * a / (a + b), p=p))
    return signals


LEVELS = sd.LEVELS_LIVE


@dataclass
class BBTail(sd.LiveSet):
    """The live set with the Beta-binomial tail for the two cluster detectors (levels multiply the live alphas)."""

    name: str = "live set with Beta-binomial tail"
    levels: tuple[float, ...] = LEVELS
    m: float = 10.0
    delta: float = 1.0
    parent: str = "stratum"

    def _bb(self) -> dict:
        return {"m": self.m, "delta": self.delta}

    def run(self, records: Sequence[IsolateRecord], cultures: Sequence[Culture], focus: Focus | None = None) -> list[Signal]:
        loosest = max(self.levels)
        prof, phen = self._cluster_args(loosest)
        if focus is None or focus.start is None or focus.end is None:
            clusters = [
                *profile_excess_bb(records, **prof, parent=self.parent, **self._bb()),
                *phenotype_excess_bb(records, PHENOTYPES, **phen, **self._bb()),
            ]
            shipped = [s for s in clusters if self.passes(s, 1.0)]
            trend = {**LIVE_SETTINGS["rising_trend"], "alpha": self.trend_alpha}
            signals = [
                *clusters,
                *sampling_drop(cultures, **{**LIVE_SETTINGS["sampling_drop"], "alpha": self.sampling_alpha}),
                *empty_run(cultures, **{**LIVE_SETTINGS["empty_run"], "alpha": self.empty_alpha}),
                *rising_trend(records, SURVEILLANCE_PAIRS, **trend, exclude=in_detected_cluster(shipped)),
            ]
            if self.new_in_unit_days is not None:
                signals += sd.new_in_unit_signals(records, lookback_days=self.new_in_unit_days)
            return signals
        return self._focused(records, cultures, focus, prof, phen)

    def _focused(self, records, cultures, focus: Focus, prof: dict, phen: dict) -> list[Signal]:
        units = set(focus.units)
        start, end = focus.start, focus.end
        lo = add_days(start, -400)
        rs = records[bisect_left(records, lo, key=sd._sample_date) : bisect_right(records, end, key=sd._sample_date)]
        cs = cultures[bisect_left(cultures, lo, key=sd._sample_date) : bisect_right(cultures, end, key=sd._sample_date)]
        if focus.organism is not None:
            keep = lambda r: r.organism == focus.organism and (focus.specimen is None or r.specimen == focus.specimen)  # noqa: E731
        else:
            strata = {(r.organism, r.specimen) for r in rs if r.ward in units and start <= r.sample_date <= end}
            keep = lambda r: (r.organism, r.specimen) in strata  # noqa: E731

        def only(r: IsolateRecord) -> bool:
            return r.ward in units and start <= r.sample_date <= end and keep(r)

        if self.parent == "organism":
            organisms = {r.organism for r in rs if only(r)}
            pool = [r for r in rs if r.organism in organisms]
        else:
            pool = [r for r in rs if keep(r)]
        signals: list[Signal] = [*profile_excess_bb(pool, **prof, parent=self.parent, only=only, **self._bb())]
        phenotypes = PHENOTYPES if focus.phenotypes is None else [p for p in PHENOTYPES if p in focus.phenotypes]
        if phenotypes:
            signals += phenotype_excess_bb(rs, phenotypes, **phen, units=units, **self._bb())
        unit_cultures = [c for c in cs if c.ward in units]
        signals += sampling_drop(unit_cultures, **{**LIVE_SETTINGS["sampling_drop"], "alpha": self.sampling_alpha})
        signals += empty_run(unit_cultures, **{**LIVE_SETTINGS["empty_run"], "alpha": self.empty_alpha})
        if self.new_in_unit_days is not None:
            data_start = focus.data_start or records[0].sample_date
            unit_records = [r for r in rs if r.ward in units]
            signals += sd.new_in_unit_signals(
                unit_records, [p for p in ("mrsa", "vre") if focus.phenotypes is None or p in focus.phenotypes], self.new_in_unit_days, data_start
            )
        return signals
