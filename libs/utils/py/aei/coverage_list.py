"""The doctor's coverage list: a Python mirror of `@aei/coverage` (`coverage`, `suggest`, `suggestCombinations`).

D-023, D-026 to D-028 and D-033 define the list; libs/utils/coverage/src/index.ts is the source this file copies,
with the same orderings and the same ties (JavaScript's sort is stable, so is Python's). The overnight scoring
harness (benchmarks/overnight-2026-10-17/harness-spec.md) uses it to rank another estimator's shares by the shipped
rules (C3(b), C4):

    result = coverage(records, as_of="2025-06-30", ward="URO", specimen="urine")
    suggest(result, "mild")[0]            # the list's first suggestion, as the server gives it

    rows = [Row("MEC", 0.96, (0.94, 0.97), 0.96, (0.94, 0.97), untested=0.03), ...]    # any estimator's shares
    suggest_rows(rows, "mild")            # the same rules, applied to those shares

`month_loop(records)` runs experiments/0010's month loop (backtest.ts) and returns the rows it writes to
out/rows.json, to test this mirror against the TypeScript. Floats are computed with the same arithmetic in the same
order as the TypeScript (sums are explicit loops: Python's `sum` is compensated since 3.12 and would differ).
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date
from functools import cmp_to_key

import numpy as np

from aei.counting import first_isolates
from aei.coverage import wilson
from aei.dataset import IsolateRecord
from aei.dates import add_days
from aei.domain import ANTIBIOTICS, SPECIMENS, UNITS, WARD_TYPE
from aei.eucast import Effective, effective_result, suits_specimen

# --- constants of the shipped list -------------------------------------------------------------------------------

#: Antibiotics not offered for a specimen although EUCAST reports them (no clinical use there).
NOT_OFFERED: dict[str, tuple[str, ...]] = {"urine": ("VAN", "CLI")}

#: WHO AWaRe classification (2023): Access first, Watch kept for when Access falls short.
AWARE: dict[str, str] = {
    "AMP": "Access",
    "MEC": "Access",
    "TMP": "Access",
    "NIT": "Access",
    "CLI": "Access",
    "TZP": "Watch",
    "FOX": "Watch",
    "CXM": "Watch",
    "CRO": "Watch",
    "CAZ": "Watch",
    "MEM": "Watch",
    "CIP": "Watch",
    "VAN": "Watch",
}

#: Expected coverage a choice should reach: 80 % for mild or moderate infections, 90 % for severe ones.
THRESHOLDS: dict[str, float] = {"mild": 0.8, "severe": 0.9}
#: Given only by injection: left out of suggestions for mild infections (D-033).
IV_ONLY: tuple[str, ...] = ("TZP", "FOX", "CRO", "CAZ", "MEM", "VAN")
#: Beta-lactams: a pair of two adds little beyond one of them, so such pairs are not suggested.
BETA_LACTAMS: tuple[str, ...] = ("AMP", "MEC", "TZP", "FOX", "CXM", "CRO", "CAZ", "MEM")
#: Urine-only agents reach no useful level in blood or tissue: not for severe infections.
URINE_ONLY: tuple[str, ...] = ("MEC", "TMP", "NIT")
#: A partner must cover at least this much more than the better antibiotic of a pair alone.
MIN_PARTNER_GAIN = 0.02
#: Share of the level's pool with no result for an antibiotic above which it is not assessed.
MAX_UNTESTED = 0.2

LEVELS = ("unit", "ward type", "hospital")
_RANK = {"clears": 0, "borderline": 1, "below": 2, "not assessable": 3}


def offered(specimen: str) -> list[str]:
    """The antibiotics the list offers for a specimen, in `@aei/domain` order: suited to it, minus NOT_OFFERED."""
    return [a for a in ANTIBIOTICS if suits_specimen(a, specimen) and a not in NOT_OFFERED.get(specimen, ())]


# --- data structures ----------------------------------------------------------------------------------------------


@dataclass(slots=True)
class Counts:
    covered: int
    #: Isolates with a known result: tested, intrinsic, inferred, or no breakpoint (counts as not covered).
    known: int


@dataclass(slots=True)
class Share:
    #: Share covered, or None when fewer than `min_tested` isolates have a known result at the level.
    share: float | None
    #: 95 % Wilson interval of `share`.
    interval: tuple[float, float] | None
    counts: Counts


@dataclass(slots=True)
class AntibioticCoverage:
    antibiotic: str
    #: All organisms: S counts as covered; intrinsic resistance and "no breakpoint" count as not covered.
    share: float | None
    interval: tuple[float, float] | None
    counts: Counts
    #: Within the antibiotic's intended spectrum (D-027): "no breakpoint" isolates are left out.
    spectrum: Share
    #: The unit's last 28 days, for context only.
    recent: Counts
    #: Organisms in the level's pool with no result for this antibiotic, as shares of that pool, largest first.
    untested: list[tuple[str, float]]
    not_covering: list[tuple[str, float]]
    outside_spectrum: list[tuple[str, float]]

    @property
    def untested_share(self) -> float:
        """Sum of the untested shares, added in list order as `suggest` does."""
        return _sum_in_order(s for _, s in self.untested)


@dataclass(slots=True)
class CombinationCoverage:
    antibiotics: tuple[str, str]
    share: float | None
    interval: tuple[float, float] | None
    counts: Counts
    #: Isolates covered by each antibiotic alone, among those the pair counts.
    alone: tuple[int, int]
    #: Share of the level's pool where either antibiotic has no result.
    untested: float


@dataclass(slots=True)
class CoverageResult:
    query: dict
    level: str
    isolates: int
    sex_applied: bool
    from_: str
    organisms: list[tuple[str, int, float]]
    antibiotics: list[AntibioticCoverage]
    combinations: list[CombinationCoverage] = field(default_factory=list)


# --- coverage -----------------------------------------------------------------------------------------------------


def _sum_in_order(xs: Iterable[float]) -> float:
    """Left-to-right float addition from 0, like `Array.prototype.reduce((s, x) => s + x, 0)`."""
    s = 0.0
    for x in xs:
        s += x
    return s


def organism_shares(organisms: Iterable[str], n_pool: int) -> list[tuple[str, float]]:
    """Organisms of the isolates a predicate selected (in pool order) as shares of the pool, largest first, ties in order
    of first appearance (a JavaScript Map keeps insertion order, and its sort is stable)."""
    by: dict[str, int] = {}
    for o in organisms:
        by[o] = by.get(o, 0) + 1
    items = [(o, c / n_pool) for o, c in by.items()]
    items.sort(key=lambda t: -t[1])
    return items


def _share(c: Counts, min_tested: int) -> Share:
    if c.known >= min_tested:
        return Share(c.covered / c.known, wilson(c.covered, c.known), c)
    return Share(None, None, c)


def _count(effs: Sequence[Effective], in_spectrum_only: bool = False) -> Counts:
    covered = known = 0
    for e in effs:
        if e.basis == "untested" or (in_spectrum_only and e.basis == "no-breakpoint"):
            continue
        known += 1
        if e.result == "S":
            covered += 1
    return Counts(covered, known)


def coverage(
    records: Sequence[IsolateRecord],
    *,
    as_of: str,
    ward: str,
    specimen: str,
    sex: str | None = None,
    window_days: int = 365,
    min_tested: int = 30,
    codes: Sequence[str] | None = None,
) -> CoverageResult:
    """`coverage(records, { asOf, ward, specimen, sex?, windowDays?, minTested? })` of `@aei/coverage`. `codes` is an
    extension for scoring: the antibiotics to compute (default: the ones the list offers for the specimen, as the
    TypeScript does); it changes no figure of the others, but adds pairs."""
    from_ = add_days(as_of, 1 - window_days)
    all_ = first_isolates([r for r in records if from_ <= r.sample_date <= as_of and r.specimen == specimen], (from_, as_of))
    ward_type = WARD_TYPE[ward]
    in_level = {
        "unit": lambda r: r.ward == ward,
        "ward type": lambda r: WARD_TYPE[r.ward] == ward_type,
        "hospital": lambda r: True,
    }
    # The sex filter is dropped before the unit is (D-033).
    by_sex = [r for r in all_ if r.sex == sex] if sex else all_
    unit_with_sex = sum(1 for r in by_sex if in_level["unit"](r))
    sex_applied = bool(sex) and (unit_with_sex >= min_tested or sum(1 for r in all_ if in_level["unit"](r)) < min_tested)
    base = by_sex if sex_applied else all_
    level = "hospital"
    for lv in ("unit", "ward type"):
        if sum(1 for r in base if in_level[lv](r)) >= min_tested:
            level = lv
            break
    pool = [r for r in base if in_level[level](r)]
    recent_from = add_days(as_of, -27)
    recent_pool = first_isolates(
        [
            r
            for r in records
            if recent_from <= r.sample_date <= as_of and r.specimen == specimen and r.ward == ward and (not sex_applied or r.sex == sex)
        ],
        (recent_from, as_of),
    )

    codes = list(codes) if codes is not None else offered(specimen)
    n = len(pool)
    effs = {a: [effective_result(r, a) for r in pool] for a in codes}  # one pass per antibiotic, reused below
    antibiotics: list[AntibioticCoverage] = []
    for a in codes:
        col = effs[a]
        c = _count(col)
        sh = _share(c, min_tested)
        antibiotics.append(
            AntibioticCoverage(
                antibiotic=a,
                share=sh.share,
                interval=sh.interval,
                counts=c,
                spectrum=_share(_count(col, True), min_tested),
                recent=_count([effective_result(r, a) for r in recent_pool]),
                untested=organism_shares((r.organism for r, e in zip(pool, col, strict=True) if e.basis == "untested"), n),
                not_covering=organism_shares(
                    (r.organism for r, e in zip(pool, col, strict=True) if e.basis in ("intrinsic", "no-breakpoint")), n
                ),
                outside_spectrum=organism_shares((r.organism for r, e in zip(pool, col, strict=True) if e.basis == "no-breakpoint"), n),
            )
        )

    # A pair covers an isolate if either antibiotic does, counted only on isolates with a known result for both; how
    # many isolates lack one of them is kept, since that dropout is not random by organism.
    combinations: list[CombinationCoverage] = []
    if n:
        untested_m = np.array([[e.basis == "untested" for e in effs[a]] for a in codes], dtype=bool)
        s_m = np.array([[e.result == "S" for e in effs[a]] for a in codes], dtype=bool)
    for i in range(len(codes)):
        for j in range(i + 1, len(codes)):
            if n:
                ok = ~(untested_m[i] | untested_m[j])
                known = int(ok.sum())
                a_ = int((s_m[i] & ok).sum())
                b_ = int((s_m[j] & ok).sum())
                covered = int(((s_m[i] | s_m[j]) & ok).sum())
            else:
                known = covered = a_ = b_ = 0
            sh = _share(Counts(covered, known), min_tested)
            combinations.append(
                CombinationCoverage((codes[i], codes[j]), sh.share, sh.interval, sh.counts, (a_, b_), 1 - known / n if n else 0)
            )
    combinations.sort(key=lambda c: -(c.share if c.share is not None else -1))

    by_org: dict[str, int] = {}
    for r in pool:
        by_org[r.organism] = by_org.get(r.organism, 0) + 1
    organisms = [(o, c, c / n if n else 0) for o, c in by_org.items()]
    organisms.sort(key=lambda t: -t[1])
    antibiotics.sort(key=lambda c: -(c.share if c.share is not None else -1))
    return CoverageResult(
        query={"asOf": as_of, "ward": ward, "specimen": specimen, "sex": sex, "windowDays": window_days, "minTested": min_tested},
        level=level,
        isolates=n,
        sex_applied=sex_applied,
        from_=from_,
        organisms=organisms,
        antibiotics=antibiotics,
        combinations=combinations,
    )


# --- suggestion order (D-026, provisional) ------------------------------------------------------------------------


@dataclass(slots=True)
class Row:
    """What `suggest_rows` needs about one antibiotic at one query: an estimator's shares on the two bases and the share
    of the level's pool without a result (the gate for "not assessable"). A share of None means no estimate."""

    antibiotic: str
    all_share: float | None
    all_interval: tuple[float, float] | None
    spectrum_share: float | None
    spectrum_interval: tuple[float, float] | None
    untested: float


@dataclass(slots=True)
class Suggestion:
    antibiotic: str
    aware: str
    standing: str
    #: "spectrum" (mild) or "all organisms" (severe): the basis the standing rests on (D-027).
    basis: str
    share: float | None
    interval: tuple[float, float] | None
    #: Over all organisms, always shown next to the standing (D-033).
    all_share: float | None
    all_interval: tuple[float, float] | None
    coverage: AntibioticCoverage | None = None


def standing_of(share: float | None, interval: tuple[float, float] | None, untested: float, threshold: float) -> str:
    if share is None or interval is None or untested > MAX_UNTESTED:
        return "not assessable"
    if interval[0] >= threshold:
        return "clears"
    return "borderline" if share >= threshold else "below"


def _neg1(x: float | None) -> float:
    return -1 if x is None else x


def _suggestion_order(a: Suggestion, b: Suggestion) -> float:
    c = _RANK[a.standing] - _RANK[b.standing]
    if c:
        return c
    if a.standing == "clears" and a.aware != b.aware:
        return -1 if a.aware == "Access" else 1
    return _neg1(b.share) - _neg1(a.share)


def suggest_rows(rows: Sequence[Row], severity: str) -> list[Suggestion]:
    """`suggest` for any estimator's shares. The rows are first put in the order `coverage` gives its antibiotics (all-
    organism share, largest first, ties in input order), because that order breaks the ties of the suggestion sort.

    Antibiotics whose whole 95 % interval clears the threshold first, Access before Watch, then by coverage; then those
    whose estimate clears it but whose interval does not; then the rest. "Not assessable" when there is no estimate or
    over a fifth of the level's pool is untested. Mild infections are judged within each antibiotic's intended spectrum
    and leave out drugs given only by injection; severe ones over all organisms (D-027, D-033)."""
    threshold = THRESHOLDS[severity]
    basis = "spectrum" if severity == "mild" else "all organisms"
    out: list[Suggestion] = []
    for r in sorted(rows, key=lambda r: -_neg1(r.all_share)):
        if severity == "mild" and r.antibiotic in IV_ONLY:
            continue
        share, interval = (r.spectrum_share, r.spectrum_interval) if basis == "spectrum" else (r.all_share, r.all_interval)
        out.append(
            Suggestion(
                antibiotic=r.antibiotic,
                aware=AWARE[r.antibiotic],
                standing=standing_of(share, interval, r.untested, threshold),
                basis=basis,
                share=share,
                interval=interval,
                all_share=r.all_share,
                all_interval=r.all_interval,
            )
        )
    out.sort(key=cmp_to_key(_suggestion_order))
    return out


def rows_of(result: CoverageResult) -> list[Row]:
    """The rows of a `CoverageResult`, in its antibiotic order."""
    return [
        Row(c.antibiotic, c.share, c.interval, c.spectrum.share, c.spectrum.interval, c.untested_share) for c in result.antibiotics
    ]


def suggest(result: CoverageResult, severity: str) -> list[Suggestion]:
    """`suggest(result, severity)` of `@aei/coverage`: `suggest_rows` on the rows of `result`, with each suggestion
    carrying its `AntibioticCoverage`."""
    by_code = {c.antibiotic: c for c in result.antibiotics}
    out = suggest_rows(rows_of(result), severity)
    for s in out:
        s.coverage = by_code[s.antibiotic]
    return out


@dataclass(slots=True)
class CombinationSuggestion:
    antibiotics: tuple[str, str]
    #: Access antibiotics in the pair (0 to 2).
    access: int
    standing: str
    #: How much more the pair covers than its better antibiotic alone, on the same isolates.
    gain: float
    coverage: CombinationCoverage


def suggest_combinations(result: CoverageResult, severity: str, limit: int = 5) -> list[CombinationSuggestion]:
    """Pairs worth considering when no single antibiotic clears the threshold (D-028, D-033), over all organisms: the
    partner covers at least two points more than the better antibiotic alone, not two beta-lactams, neither a urine-only
    agent. Not assessable when over a fifth of the pool lacks a result for either. Clears before borderline, then by
    coverage, then Access count. Severe infections only."""
    if severity != "severe" or any(s.standing == "clears" for s in suggest(result, severity)):
        return []
    threshold = THRESHOLDS[severity]
    out: list[CombinationSuggestion] = []
    for c in result.combinations:
        a, b = c.antibiotics
        if (a in BETA_LACTAMS and b in BETA_LACTAMS) or a in URINE_ONLY or b in URINE_ONLY:
            continue
        gain = (c.counts.covered - max(c.alone)) / c.counts.known if c.counts.known else 0
        standing = standing_of(c.share, c.interval, c.untested, threshold)
        if standing in ("clears", "borderline") and gain >= MIN_PARTNER_GAIN:
            out.append(CombinationSuggestion(c.antibiotics, sum(1 for x in c.antibiotics if AWARE[x] == "Access"), standing, gain, c))

    def order(x: CombinationSuggestion, y: CombinationSuggestion) -> float:
        return _RANK[x.standing] - _RANK[y.standing] or _neg1(y.coverage.share) - _neg1(x.coverage.share) or y.access - x.access

    out.sort(key=cmp_to_key(order))
    return out[:limit]


# --- experiments/0010's month loop --------------------------------------------------------------------------------


def baseline_pick(records: Sequence[IsolateRecord], as_of: str, specimen: str, result: CoverageResult, severity: str) -> str | None:
    """0010's baseline, the hospital antibiogram: same specimen, last 365 days, all organisms, highest share among the
    antibiotics the list may suggest for the severity (at least 30 known results)."""
    from_ = add_days(as_of, -364)
    pool = first_isolates([r for r in records if r.specimen == specimen and from_ <= r.sample_date <= as_of], (from_, as_of))
    best: str | None = None
    best_share = -1.0
    for c in result.antibiotics:
        if severity == "mild" and c.antibiotic in IV_ONLY:
            continue
        counts = _count([effective_result(r, c.antibiotic) for r in pool])
        if counts.known >= 30 and counts.covered / counts.known > best_share:
            best_share = counts.covered / counts.known
            best = c.antibiotic
    return best


def month_ends(first_month: tuple[int, int] = (2024, 10), months: int = 24) -> list[tuple[str, str, str, int]]:
    """For each target month: (as-of day = last day of the month before, month label YYYY-MM, last day of the month, days)."""
    out = []
    y, m = first_month
    for i in range(months):
        yy, mm = y + (m - 1 + i) // 12, (m - 1 + i) % 12 + 1
        start = date(yy, mm, 1)
        nxt = date(yy + (mm == 12), mm % 12 + 1, 1)
        end = nxt.fromordinal(nxt.toordinal() - 1)
        out.append((add_days(start.isoformat(), -1), start.isoformat()[:7], end.isoformat(), end.day))
    return out


def month_loop(records: Sequence[IsolateRecord]) -> tuple[list[dict], list[dict]]:
    """experiments/0010's backtest.ts in Python: the rows (one per query-month, severity and suggested antibiotic) and
    the combination rows it writes to out/rows.json, with the same field names."""
    rows: list[dict] = []
    combos: list[dict] = []
    baseline_cache: dict[tuple[str, str, str], str | None] = {}
    for as_of, month, month_end, month_days in month_ends():
        known = [r for r in records if r.sample_date <= as_of]
        for ward in UNITS:
            for specimen in SPECIMENS:
                result = coverage(known, as_of=as_of, ward=ward, specimen=specimen)
                # The unit's own first isolates of the target month, counted by the same code.
                target = coverage(records, as_of=month_end, ward=ward, specimen=specimen, window_days=month_days, min_tested=1)
                if target.level != "unit":
                    continue
                for severity in ("mild", "severe"):
                    key = (as_of, specimen, severity)
                    if key not in baseline_cache:
                        baseline_cache[key] = baseline_pick(records, as_of, specimen, result, severity)
                    baseline = baseline_cache[key]
                    for rank, s in enumerate(suggest(result, severity)):
                        t = next((a for a in target.antibiotics if a.antibiotic == s.antibiotic), None)
                        if t is None:
                            continue
                        basis = t.spectrum.counts if severity == "mild" else t.counts
                        rows.append(
                            {
                                "month": month,
                                "ward": ward,
                                "specimen": specimen,
                                "severity": severity,
                                "level": result.level,
                                "pool": result.isolates,
                                "targetIsolates": target.isolates,
                                "antibiotic": s.antibiotic,
                                "aware": AWARE[s.antibiotic],
                                "rank": rank,
                                "standing": s.standing,
                                "share": s.share,
                                "lower": s.interval[0] if s.interval else None,
                                "allShare": s.all_share,
                                "baseline": s.antibiotic == baseline,
                                "covered": basis.covered,
                                "known": basis.known,
                                "allCovered": t.counts.covered,
                                "allKnown": t.counts.known,
                            }
                        )
                    pairs = suggest_combinations(result, severity)
                    if pairs:
                        pair = pairs[0]
                        t2 = next((c for c in target.combinations if c.antibiotics == pair.antibiotics), None)
                        combos.append(
                            {
                                "month": month,
                                "ward": ward,
                                "specimen": specimen,
                                "pair": "+".join(pair.antibiotics),
                                "standing": pair.standing,
                                "share": pair.coverage.share,
                                "covered": t2.counts.covered if t2 else 0,
                                "known": t2.counts.known if t2 else 0,
                            }
                        )
    return rows, combos


__all__ = [
    "AWARE",
    "BETA_LACTAMS",
    "IV_ONLY",
    "MAX_UNTESTED",
    "MIN_PARTNER_GAIN",
    "NOT_OFFERED",
    "THRESHOLDS",
    "URINE_ONLY",
    "AntibioticCoverage",
    "CombinationCoverage",
    "CombinationSuggestion",
    "Counts",
    "CoverageResult",
    "Row",
    "Share",
    "Suggestion",
    "baseline_pick",
    "coverage",
    "month_loop",
    "offered",
    "organism_shares",
    "rows_of",
    "standing_of",
    "suggest",
    "suggest_combinations",
    "suggest_rows",
]
