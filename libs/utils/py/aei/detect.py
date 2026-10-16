"""Candidate deviation detectors and the live detector set (mirrors @aei/detect, D-016, D-020 to D-022).

Each detector scans a whole history and returns the days it would have signalled, in the same order as
the TypeScript, with the same keys, dates, observed and expected values. The signal on day t uses only
samples dated on or before t. Poisson and hypergeometric tails come from scipy; the normal tail of the
trend test copies the TypeScript's Abramowitz-Stegun formula, because scipy's exact tail differs from it
by up to 1.5e-7 and the trend signals must match the live tool's.

    signals = profile_excess(records, **LIVE_SETTINGS["profile_excess"])
    live = live_signals(records, cultures)
    eps = episodes(live)
"""

from __future__ import annotations

import math
from bisect import bisect_left, bisect_right
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass

import numpy as np
from scipy import special, stats

from aei.dataset import Culture, IsolateRecord
from aei.dates import add_days, days_between
from aei.domain import ANTIBIOTICS, WARD_TYPE
from aei.eucast import is_intrinsic

PROFILE_ANTIBIOTICS = ANTIBIOTICS


@dataclass(slots=True)
class Signal:
    """One day a detector signals. `key` groups signals into episodes; ward is None for hospital-wide signals."""

    detector: str
    key: str
    date: str
    ward: str | None
    observed: float
    organism: str | None = None
    antibiotic: str | None = None
    phenotype: str | None = None
    profile: str | None = None
    expected: float | None = None
    p: float | None = None

    def as_dict(self) -> dict[str, object]:
        """The fields the TypeScript Signal has set (it leaves unset ones out; ward is always there)."""
        d: dict[str, object] = {"detector": self.detector, "key": self.key, "date": self.date, "ward": self.ward}
        for k in ("organism", "antibiotic", "phenotype", "profile"):
            v = getattr(self, k)
            if v is not None:
                d[k] = v
        d["observed"] = self.observed
        for k in ("expected", "p"):
            v = getattr(self, k)
            if v is not None:
                d[k] = v
        return d


@dataclass(frozen=True, slots=True)
class Pair:
    """An organism and antibiotic, optionally one specimen and one setting ("in": inpatient units, "out": the rest)."""

    organism: str
    antibiotic: str
    specimen: str | None = None
    setting: str | None = None

    @property
    def key(self) -> str:
        return f"{self.organism}|{self.antibiotic}|{self.specimen or 'all'}" + (f"|{self.setting}" if self.setting else "")


def profile_of(r: IsolateRecord) -> str:
    """The isolate's S/R results over the 13 antibiotics, "." where not tested."""
    return "".join(r.results.get(a, ".") for a in PROFILE_ANTIBIOTICS)


def has_acquired_resistance(r: IsolateRecord) -> bool:
    """At least one R the organism does not have by nature."""
    return any(r.results.get(a) == "R" and not is_intrinsic(r.organism, a) for a in PROFILE_ANTIBIOTICS)


def is_hospital_onset(r: IsolateRecord) -> bool:
    """Sampled on day 3 or later of the stay."""
    return bool(r.admission_date) and days_between(r.admission_date, r.sample_date) >= 2


# ---------- statistics ----------


def poisson_upper(k: int, mean: float) -> float:
    """P(X >= k) for X ~ Poisson(mean)."""
    if k <= 0:
        return 1.0
    if mean <= 0:
        return 0.0
    return min(1.0, float(special.pdtrc(k - 1, mean)))  # = stats.poisson.sf(k - 1, mean)


def poisson_lower(k: int, mean: float) -> float:
    """P(X <= k) for X ~ Poisson(mean)."""
    if k < 0:
        return 0.0
    if mean <= 0:
        return 1.0
    return min(1.0, float(special.pdtr(k, mean)))  # = stats.poisson.cdf(k, mean)


def fisher_mid_p_greater(a: int, b: int, c: int, d: int) -> float:
    """One-sided mid-p Fisher test that row (a, b) has a higher event share than row (c, d): P(X > a) + P(X = a) / 2."""
    return float(_fisher_mid_p(np.array([a]), np.array([b]), np.array([c]), np.array([d]))[0])


def _fisher_mid_p(a: np.ndarray, b: np.ndarray, c: np.ndarray, d: np.ndarray) -> np.ndarray:
    row1, col1, n = a + b, a + c, a + b + c + d
    lo, hi = np.maximum(0, col1 - (n - row1)), np.minimum(row1, col1)
    dist = stats.hypergeom(n, col1, row1)  # population, successes (events), draws (first row)
    p = np.minimum(1.0, dist.sf(a) + 0.5 * dist.pmf(a))
    return np.where(a > hi, 0.0, np.where(a < lo, 1.0, p))


def normal_upper(z: float) -> float:
    """P(Z >= z), Abramowitz and Stegun 7.1.26 on erfc as in the TypeScript (absolute error below 1.5e-7)."""
    x = abs(z) / math.sqrt(2)
    t = 1 / (1 + 0.3275911 * x)
    erfc = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * math.exp(-x * x)
    return erfc / 2 if z >= 0 else 1 - erfc / 2


def cochran_armitage_rising(groups: Sequence[tuple[int, int]]) -> float:
    """One-sided Cochran-Armitage p-value for a rising share over ordered (events, n) groups, scores 0, 1, 2, ..."""
    N = sum(n for _, n in groups)
    R = sum(e for e, _ in groups)
    if N == 0 or R == 0 or R == N:
        return 1.0
    p_bar = R / N
    t = 0.0
    sx = 0
    sxx = 0
    for i, (e, n) in enumerate(groups):
        t += i * (e - n * p_bar)
        sx += n * i
        sxx += n * i * i
    variance = p_bar * (1 - p_bar) * (sxx - (sx * sx) / N)
    return normal_upper(t / math.sqrt(variance)) if variance > 0 else 1.0


# ---------- helpers ----------


def _by_date(items: Iterable[IsolateRecord]) -> list[IsolateRecord]:
    return sorted(items, key=lambda r: r.sample_date)  # stable, like Array.prototype.sort


def _group_by(items: Iterable, key: Callable) -> dict:
    out: dict = {}
    for it in items:
        out.setdefault(key(it), []).append(it)
    return out


def _slice(items: Sequence, dates: Sequence[str], start: str, end: str) -> Sequence:
    """Items dated within [start, end] of a list sorted by date."""
    return items[bisect_left(dates, start) : bisect_right(dates, end)]


def _patients(items: Iterable[IsolateRecord]) -> int:
    return len({i.patient_id for i in items})


# ---------- 1. profile rule ----------


def profile_rule(records: Sequence[IsolateRecord], *, min_patients: int, window_days: int, hospital_onset_only: bool) -> list[Signal]:
    """At least `min_patients` patients in one unit with the same organism and resistant profile within the window."""
    pool = [r for r in records if has_acquired_resistance(r) and (not hospital_onset_only or is_hospital_onset(r))]
    signals = []
    for key, items in _group_by(pool, lambda r: f"{r.ward}|{r.organism}|{profile_of(r)}").items():
        items.sort(key=lambda r: r.sample_date)
        dates = [r.sample_date for r in items]
        for r in items:
            n = _patients(_slice(items, dates, add_days(r.sample_date, 1 - window_days), r.sample_date))
            if n >= min_patients:
                signals.append(Signal("profile-rule", key, r.sample_date, r.ward, n, organism=r.organism, profile=profile_of(r)))
    return signals


# ---------- 2. profile excess ----------


def profile_excess(
    records: Sequence[IsolateRecord],
    *,
    window_days: int,
    baseline_days: int,
    alpha: float,
    min_observed: int,
    same_specimen: bool = False,
) -> list[Signal]:
    """Patients in one unit with the same organism and profile within the window, against the unit's patients with
    that organism (and specimen, with `same_specimen`) in the window times the profile's share hospital-wide over the
    baseline before the window, smoothed by adding one half."""
    ordered = _by_date(records)
    profile = {id(r): profile_of(r) for r in ordered}

    def stratum(r: IsolateRecord) -> str:
        return f"{r.organism}|{r.specimen}" if same_specimen else r.organism

    def dated(groups: dict) -> dict:
        return {k: (v, [r.sample_date for r in v]) for k, v in groups.items()}

    by_stratum = dated(_group_by(ordered, stratum))
    by_profile = dated(_group_by(ordered, lambda r: f"{stratum(r)}|{profile[id(r)]}"))
    by_unit = dated(_group_by(ordered, lambda r: f"{r.ward}|{stratum(r)}"))

    signals = []
    for r in ordered:
        if not has_acquired_resistance(r):
            continue
        prof = profile[id(r)]
        start = add_days(r.sample_date, 1 - window_days)
        base_to = add_days(start, -1)
        base_from = add_days(start, -baseline_days)
        s = stratum(r)
        unit_items, unit_dates = by_unit[f"{r.ward}|{s}"]
        in_window = _slice(unit_items, unit_dates, start, r.sample_date)
        observed = _patients(x for x in in_window if profile[id(x)] == prof)
        if observed < min_observed:
            continue
        _, strat_dates = by_stratum[s]
        base_all = bisect_right(strat_dates, base_to) - bisect_left(strat_dates, base_from)
        if base_all < 50:
            continue
        _, prof_dates = by_profile[f"{s}|{prof}"]
        base_profile = bisect_right(prof_dates, base_to) - bisect_left(prof_dates, base_from)
        expected = _patients(in_window) * ((base_profile + 0.5) / (base_all + 1))
        p = poisson_upper(observed, expected)
        if p < alpha:
            signals.append(
                Signal(
                    "profile-excess",
                    f"{r.ward}|{r.organism}|{prof}",
                    r.sample_date,
                    r.ward,
                    observed,
                    organism=r.organism,
                    profile=prof,
                    expected=expected,
                    p=p,
                )
            )
    return signals


# ---------- 3. phenotype excess ----------


def phenotype_excess(
    records: Sequence[IsolateRecord],
    phenotypes: Sequence[str],
    *,
    window_days: int,
    baseline_days: int,
    alpha: float,
    min_observed: int,
) -> list[Signal]:
    """Patients with a phenotype in one unit within the window, against the unit's share of it over the baseline."""
    ordered = _by_date(records)
    by_unit = {k: (v, [r.sample_date for r in v]) for k, v in _group_by(ordered, lambda r: r.ward).items()}
    signals = []
    for r in ordered:
        for ph in r.phenotypes:
            if ph not in phenotypes:
                continue
            items, dates = by_unit[r.ward]
            start = add_days(r.sample_date, 1 - window_days)
            in_window = _slice(items, dates, start, r.sample_date)
            observed = _patients(x for x in in_window if ph in x.phenotypes)
            if observed < min_observed:
                continue
            base = _slice(items, dates, add_days(start, -baseline_days), add_days(start, -1))
            if len(base) < 50:
                continue
            share = (sum(1 for x in base if ph in x.phenotypes) + 0.5) / (len(base) + 1)
            expected = _patients(in_window) * share
            p = poisson_upper(observed, expected)
            if p < alpha:
                signals.append(Signal("phenotype-excess", f"{r.ward}|{ph}", r.sample_date, r.ward, observed, phenotype=ph, expected=expected, p=p))
    return signals


# ---------- 4. sampling drop ----------


def sampling_drop(cultures: Sequence[Culture], *, window_days: int, baseline_days: int, alpha: float) -> list[Signal]:
    """Cultures in a unit over the window against the window's share of the unit's baseline mean, every day."""
    if not cultures:
        return []
    dates = sorted(c.sample_date for c in cultures)
    start, end = dates[0], dates[-1]
    n_days = days_between(start, end) + 1
    counts: dict[str, np.ndarray] = {}
    for c in cultures:
        arr = counts.get(c.ward)
        if arr is None:
            arr = counts[c.ward] = np.zeros(n_days, dtype=np.int64)
        arr[days_between(start, c.sample_date)] += 1
    signals = []
    first = window_days + baseline_days - 1
    if first >= n_days:
        return []
    t = np.arange(first, n_days)
    for ward, arr in counts.items():
        prefix = np.concatenate([[0], np.cumsum(arr)])
        observed = prefix[t + 1] - prefix[t + 1 - window_days]
        baseline = prefix[t + 1 - window_days] - prefix[t + 1 - window_days - baseline_days]
        expected = (baseline / baseline_days) * window_days
        p = np.where(expected > 0, np.minimum(1.0, special.pdtr(observed, np.where(expected > 0, expected, 1.0))), 1.0)
        for i in np.flatnonzero(p < alpha):
            signals.append(
                Signal("sampling-drop", ward, add_days(start, int(t[i])), ward, int(observed[i]), expected=float(expected[i]), p=float(p[i]))
            )
    return signals


# ---------- 4b. empty run ----------


def empty_run(cultures: Sequence[Culture], *, baseline_days: int, alpha: float) -> list[Signal]:
    """A run of days with no cultures from a unit (D-031): lambda is the unit's mean daily cultures over the
    `baseline_days` before the run began; signal on each empty day where exp(-lambda * run) < alpha. `observed` is
    the run length in days, `expected` lambda per day."""
    if not cultures:
        return []
    dates = sorted(c.sample_date for c in cultures)
    start = dates[0]
    n_days = days_between(start, dates[-1]) + 1
    counts: dict[str, np.ndarray] = {}
    for c in cultures:
        arr = counts.get(c.ward)
        if arr is None:
            arr = counts[c.ward] = np.zeros(n_days, dtype=np.int64)
        arr[days_between(start, c.sample_date)] += 1
    signals = []
    for ward, arr in counts.items():
        prefix = np.concatenate([[0], np.cumsum(arr)])
        run = 0
        for t in range(n_days):
            run = run + 1 if arr[t] == 0 else 0
            if run == 0:
                continue
            first_empty = t - run + 1
            if first_empty - baseline_days < 0:
                continue
            lam = float(prefix[first_empty] - prefix[first_empty - baseline_days]) / baseline_days
            p = math.exp(-lam * run)
            if p < alpha:
                signals.append(Signal("empty-run", ward, add_days(start, t), ward, run, expected=lam, p=p))
    return signals


# ---------- 5. resistance shift ----------


def _in_pair(r: IsolateRecord, pair: Pair) -> bool:
    return (
        r.organism == pair.organism
        and (not pair.specimen or r.specimen == pair.specimen)
        and (not pair.setting or WARD_TYPE.get(r.ward) == pair.setting)
        and pair.antibiotic in r.results
    )


def resistance_shift(
    records: Sequence[IsolateRecord],
    pairs: Sequence[Pair],
    *,
    window_days: int,
    baseline_days: int,
    step_days: int,
    alpha: float,
    min_resistant: int,
) -> list[Signal]:
    """Per unit and pair: % R in the window against the same unit's non-overlapping baseline, one-sided mid-p Fisher."""
    ordered = _by_date(records)
    if not ordered:
        return []
    start, end = ordered[0].sample_date, ordered[-1].sample_date
    signals = []
    for pair in pairs:
        tested = [r for r in ordered if _in_pair(r, pair)]
        for ward, items in _group_by(tested, lambda r: r.ward).items():
            dates = [r.sample_date for r in items]
            resistant = np.cumsum([0] + [r.results[pair.antibiotic] == "R" for r in items])
            cand: list[tuple[str, int, int, int, int]] = []  # date, a, window n, c, baseline n
            t = add_days(start, window_days + baseline_days - 1)
            while t <= end:
                frm = add_days(t, 1 - window_days)
                w0, w1 = bisect_left(dates, frm), bisect_right(dates, t)
                b0, b1 = bisect_left(dates, add_days(frm, -baseline_days)), bisect_right(dates, add_days(frm, -1))
                a = int(resistant[w1] - resistant[w0])
                if a >= min_resistant and b1 > b0:
                    cand.append((t, a, w1 - w0, int(resistant[b1] - resistant[b0]), b1 - b0))
                t = add_days(t, step_days)
            if not cand:
                continue
            a_, nw, c_, nb = (np.array([x[i] for x in cand]) for i in range(1, 5))
            ps = _fisher_mid_p(a_, nw - a_, c_, nb - c_)
            for (day, a, n_win, c, n_base), p in zip(cand, ps, strict=True):
                if p < alpha:
                    signals.append(
                        Signal(
                            "resistance-shift",
                            f"{ward}|{pair.key}",
                            day,
                            ward,
                            a / n_win,
                            organism=pair.organism,
                            antibiotic=pair.antibiotic,
                            expected=c / n_base,
                            p=float(p),
                        )
                    )
    return signals


# ---------- 6. rising trend ----------

Exclude = Callable[[IsolateRecord, str], bool]


def rising_trend(
    records: Sequence[IsolateRecord],
    pairs: Sequence[Pair],
    *,
    bin_days: int,
    min_bins: int,
    alpha: float,
    exclude: Exclude | None = None,
) -> list[Signal]:
    """Hospital-wide per pair: Cochran-Armitage test for a rise over bins from the start of the data to each bin end.

    `exclude(r, as_of)` leaves an isolate out of the test made as of `as_of`. An exclude with a `since(r)` method
    (the first `as_of` from which r is left out, or None) is evaluated once per isolate instead of once per bin."""
    ordered = _by_date(records)
    if not ordered:
        return []
    start, end = ordered[0].sample_date, ordered[-1].sample_date
    n_bins = (days_between(start, end) + 1) // bin_days
    since = getattr(exclude, "since", None)
    signals = []
    for pair in pairs:
        tested = [r for r in ordered if _in_pair(r, pair)]
        day = np.array([days_between(start, r.sample_date) for r in tested], dtype=np.int64)
        bin_of = day // bin_days
        is_r = np.array([r.results[pair.antibiotic] == "R" for r in tested], dtype=bool)
        kept = bin_of < n_bins
        if since is not None:
            never = np.iinfo(np.int64).max
            out_from = np.array([never if (d := since(r)) is None else days_between(start, d) for r in tested], dtype=np.int64)

        def bins_as_of(as_of: str) -> list[tuple[int, int]]:
            if exclude is None:
                mask = kept
            elif since is not None:
                cut = days_between(start, as_of)
                mask = kept & (day <= cut) & (out_from > cut)
            else:
                mask = kept & np.array([r.sample_date <= as_of and not exclude(r, as_of) for r in tested], dtype=bool)
            n = np.bincount(bin_of[mask], minlength=n_bins)[:n_bins]
            e = np.bincount(bin_of[mask & is_r], minlength=n_bins)[:n_bins]
            return list(zip(e.tolist(), n.tolist(), strict=True))

        every = bins_as_of(end) if exclude is None else None
        for k in range(min_bins, n_bins + 1):
            as_of = add_days(start, k * bin_days - 1)
            bins = every if every is not None else bins_as_of(as_of)
            p = cochran_armitage_rising(bins[:k])
            if p < alpha:
                events, n = bins[k - 1]
                signals.append(
                    Signal(
                        "rising-trend", pair.key, as_of, None, events / n if n else 0, organism=pair.organism, antibiotic=pair.antibiotic, p=p
                    )
                )
    return signals


# ---------- episodes ----------


@dataclass(slots=True)
class Episode:
    detector: str
    key: str
    first: Signal
    last: Signal
    signals: int


def episodes(signals: Sequence[Signal], gap_days: int = 28) -> list[Episode]:
    """Signals with the same detector and key, at most `gap_days` apart, merged into one episode; by first date."""
    out: list[Episode] = []
    for items in _group_by(signals, lambda s: f"{s.detector}|{s.key}").values():
        items.sort(key=lambda s: s.date)
        current: Episode | None = None
        for s in items:
            if current is not None and days_between(current.last.date, s.date) <= gap_days:
                current.last = s
                current.signals += 1
            else:
                current = Episode(s.detector, s.key, s, s, 1)
                out.append(current)
    out.sort(key=lambda e: e.first.date)
    return out


# ---------- live set (D-020, D-022) ----------

SURVEILLANCE_PAIRS: list[Pair] = [
    Pair("Escherichia coli", "AMP"),
    Pair("Escherichia coli", "MEC", "urine"),
    Pair("Escherichia coli", "TMP", "urine"),
    Pair("Escherichia coli", "NIT", "urine"),
    Pair("Escherichia coli", "CIP"),
    Pair("Escherichia coli", "CXM"),
    Pair("Escherichia coli", "CRO"),
    Pair("Escherichia coli", "TZP"),
    Pair("Escherichia coli", "MEM"),
    Pair("Klebsiella pneumoniae", "CRO"),
    Pair("Klebsiella pneumoniae", "CIP"),
    Pair("Klebsiella pneumoniae", "TZP"),
    Pair("Klebsiella pneumoniae", "MEM"),
    Pair("Pseudomonas aeruginosa", "CAZ"),
    Pair("Pseudomonas aeruginosa", "TZP"),
    Pair("Pseudomonas aeruginosa", "MEM"),
    Pair("Pseudomonas aeruginosa", "CIP"),
    Pair("Staphylococcus aureus", "FOX"),
    Pair("Staphylococcus aureus", "CLI"),
    Pair("Enterococcus faecalis", "AMP"),
    Pair("Enterococcus faecalis", "VAN"),
    Pair("Proteus mirabilis", "CIP"),
]

LIVE_SETTINGS: dict[str, dict] = {
    "profile_excess": {"window_days": 28, "baseline_days": 365, "alpha": 0.0001, "min_observed": 3, "same_specimen": True},
    "phenotype_excess": {"window_days": 28, "baseline_days": 365, "alpha": 0.001, "min_observed": 2},
    "sampling_drop": {"window_days": 7, "baseline_days": 56, "alpha": 0.0001},
    "empty_run": {"baseline_days": 56, "alpha": 0.001},
    "rising_trend": {"bin_days": 28, "min_bins": 13, "alpha": 0.001},
}


def cluster_signals(records: Sequence[IsolateRecord]) -> list[Signal]:
    """Profile and phenotype excess signals of the live set."""
    return [
        *profile_excess(records, **LIVE_SETTINGS["profile_excess"]),
        *phenotype_excess(records, ["esbl", "mrsa", "vre", "cpe"], **LIVE_SETTINGS["phenotype_excess"]),
    ]


class DetectedClusters:
    """`exclude` for `rising_trend`: true for an isolate inside a cluster episode already detected by `as_of`
    (its unit, organism or phenotype, and dates)."""

    def __init__(self, clusters: Sequence[Signal]):
        window = LIVE_SETTINGS["profile_excess"]["window_days"]
        self.spans = [
            (e.first.date, add_days(e.first.date, 1 - window), e.last.date, e.first.ward, e.first.organism, e.first.phenotype)
            for e in episodes(clusters)
        ]

    @staticmethod
    def _matches(r: IsolateRecord, span: tuple) -> bool:
        _, start, end, ward, organism, phenotype = span
        return (
            r.ward == ward
            and start <= r.sample_date <= end
            and (r.organism == organism if organism else (phenotype in r.phenotypes if phenotype else False))
        )

    def __call__(self, r: IsolateRecord, as_of: str) -> bool:
        return any(s[0] <= as_of and self._matches(r, s) for s in self.spans)

    def since(self, r: IsolateRecord) -> str | None:
        """The first `as_of` from which `r` is left out: the earliest detection among the spans it falls in."""
        return min((s[0] for s in self.spans if self._matches(r, s)), default=None)


def in_detected_cluster(clusters: Sequence[Signal]) -> DetectedClusters:
    return DetectedClusters(clusters)


def live_signals(records: Sequence[IsolateRecord], cultures: Sequence[Culture]) -> list[Signal]:
    """Every signal of the live detector set over a history; cluster isolates are left out of the trend test
    from the day their cluster was detected."""
    clusters = cluster_signals(records)
    return [
        *clusters,
        *sampling_drop(cultures, **LIVE_SETTINGS["sampling_drop"]),
        *empty_run(cultures, **LIVE_SETTINGS["empty_run"]),
        *rising_trend(records, SURVEILLANCE_PAIRS, **LIVE_SETTINGS["rising_trend"], exclude=in_detected_cluster(clusters)),
    ]
