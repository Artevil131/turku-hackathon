"""Public live methods, parity-tested against the app's TypeScript (D-061).

Inputs are sequences of plain dictionaries in the TypeScript gear's shape,
not CSV rows: IsolateRecord has isolateId, cultureId, patientId, sampleDate
(YYYY-MM-DD), admissionDate (date or None), ward, specimen, organism, sex,
ageYears, homeArea, phenotypes (lower-case names), and results ({code: S/R}).
Culture has cultureId, patientId, sampleDate, admissionDate, ward, wardType,
specimen, result, isoYear, isoWeek, ageYears. Dates are inclusive ISO dates.
Outputs are JSON-compatible dictionaries/lists with the TypeScript field names;
missing optional signal fields are omitted, unavailable estimates are None.
Only this module stabilises the live methods; experiment modules are internal.
"""

from dataclasses import asdict

from aei import coverage_list as _coverage
from aei import detect as _detect
from aei.dataset import Culture as _Culture, IsolateRecord as _IsolateRecord
from aei.dates import add_days as _add_days, days_between as _days_between
from aei.domain import WARD_TYPE as _WARD_TYPE, by_site as _by_site

__all__ = [
    "profile_excess", "phenotype_excess", "sampling_drop", "volume_jump", "empty_run",
    "rising_trend", "resistance_shift", "live_signals", "cpe_alerts", "new_in_unit_alerts",
    "coverage", "suggest", "suggest_combinations",
]


def _snake(key):
    return "".join("_" + c.lower() if c.isupper() else c for c in key)


def _records(rows, cls=_IsolateRecord):
    return [cls(**{_snake(k): v for k, v in r.items()}) for r in rows]


def _signals(signals):
    return [s.as_dict() for s in signals]


def profile_excess(records, *, window_days=28, baseline_days=365, alpha=0.0001, min_observed=3, same_specimen=True):
    """Poisson excess of distinct patients sharing an acquired-resistant profile.

    IsolateRecord dictionaries in; signal dictionaries out (detector, key, date,
    ward, organism, profile, observed, expected, p). D-020/D-044 defaults: a
    28-day window, 365-day baseline (at least 50 isolates), p < 0.0001,
    >= 3 patients, same specimen. Baseline share is smoothed by one half.
    This low-level gear uses the supplied hospital pool; use live_signals for
    automatic per-site splitting and cluster-adjusted trends (D-051).
    """
    return _signals(_detect.profile_excess(_records(records), window_days=window_days, baseline_days=baseline_days,
        alpha=alpha, min_observed=min_observed, same_specimen=same_specimen))


def phenotype_excess(records, phenotypes=("esbl", "mrsa", "vre", "cpe"), *, window_days=28, baseline_days=365, alpha=0.001, min_observed=2):
    """Poisson excess of patients with a phenotype against the unit's baseline.

    IsolateRecord dictionaries in; signals with phenotype, observed, expected,
    p out. D-020/D-044 defaults: ESBL/MRSA/VRE/CPE; window 28 days, baseline
    365 days (at least 50 isolates), p < 0.001, >= 2 distinct patients.
    """
    return _signals(_detect.phenotype_excess(_records(records), phenotypes, window_days=window_days,
        baseline_days=baseline_days, alpha=alpha, min_observed=min_observed))


def sampling_drop(cultures, *, window_days=7, baseline_days=56, alpha=0.0001):
    """Daily Poisson lower-tail test of cultures per unit.

    Culture dictionaries in; signals with observed culture count, expected
    window count and p out. D-020/D-044 defaults: 7-day window, preceding
    56-day baseline, p < 0.0001. Scans only through the last supplied date.
    """
    return _signals(_detect.sampling_drop(_records(cultures, _Culture), window_days=window_days,
        baseline_days=baseline_days, alpha=alpha))


def volume_jump(cultures, *, window_days=7, baseline_days=56, alpha=0.0001):
    """Daily Poisson upper-tail test of cultures per unit: the twin of sampling_drop (D-081).

    Culture dictionaries in; signals with observed culture count, expected
    window count and p out. Defaults: 7-day window, preceding 56-day baseline,
    p < 0.0001. A unit with no cultures in its baseline is not tested.
    Scans only through the last supplied date.
    """
    return _signals(_detect.volume_jump(_records(cultures, _Culture), window_days=window_days,
        baseline_days=baseline_days, alpha=alpha))


def empty_run(cultures, *, baseline_days=56, alpha=0.001):
    """Consecutive empty days per unit, tested as exp(-daily_mean * run).

    Culture dictionaries in; signals with observed run length, expected daily
    mean and p out. D-031/D-044 defaults: preceding 56-day baseline, p < 0.001.
    Scans only through the last supplied culture date, not today's date.
    """
    return _signals(_detect.empty_run(_records(cultures, _Culture), baseline_days=baseline_days, alpha=alpha))


def rising_trend(records, pairs=None, *, bin_days=28, min_bins=13, alpha=0.001):
    """One-sided Cochran-Armitage test of rising hospital resistance shares.

    IsolateRecord dictionaries and optional pair dictionaries (organism,
    antibiotic, optional specimen) in; signals with ward=None, organism,
    antibiotic, observed last-bin R share and p out. D-020/D-022/D-044 defaults:
    the app's 22 surveillance pairs, complete 28-day bins, >= 13 bins,
    p < 0.001, app normal-tail approximation. This raw gear does not exclude
    clusters; live_signals applies the app's causal cluster exclusion.
    """
    pairs = _detect.SURVEILLANCE_PAIRS if pairs is None else [_detect.Pair(**p) for p in pairs]
    return _signals(_detect.rising_trend(_records(records), pairs, bin_days=bin_days, min_bins=min_bins, alpha=alpha))


def resistance_shift(records, *, window_days=28, baseline_days=365, alpha=0.01, min_baseline=30, min_window=3):
    """Exact binomial excess of resistant results against the unit's own year (D-080).

    IsolateRecord dictionaries in; signals with ward, organism, antibiotic,
    observed resistant count in the window, expected and p out; the key
    carries unit, specimen, organism and antibiotic. Defaults: 28-day window,
    365-day baseline before it, baseline share smoothed by one half, >= 30
    known results in the baseline, >= 3 in the window, p < 0.01. This raw
    gear does not exclude clusters; live_signals leaves out isolates of an
    already detected cluster.
    """
    return _signals(_detect.resistance_shift_binomial(_records(records), window_days=window_days,
        baseline_days=baseline_days, alpha=alpha, min_baseline=min_baseline, min_window=min_window))


def live_signals(records, cultures):
    """Run all seven statistical detectors at the app's fixed live settings.

    IsolateRecord and Culture dictionaries in; concatenated signal dictionaries
    out (not episodes or incident alerts). D-020/D-022/D-031/D-044: defaults
    documented on each detector above; no tuning parameters. D-051: split by
    hospital, home first, and exclude detected clusters from trends causally.
    """
    return _signals(_detect.live_signals(_records(records), _records(cultures, _Culture), current_app=True))


def cpe_alerts(records, window=None):
    """An alert for every CPE isolate (D-014, ENGINE A3).

    IsolateRecord dictionaries in; alert dictionaries with kind, id, date,
    ward, patientId, isolateId, organism and specimen out, in input order.
    window defaults to None (all dates), or {from: date, to: date}, inclusive.
    """
    return [dict(kind="cpe", id=f"cpe:{r['isolateId']}", date=r["sampleDate"], ward=r["ward"],
        patientId=r["patientId"], isolateId=r["isolateId"], organism=r["organism"], specimen=r["specimen"])
        for r in records if "cpe" in r["phenotypes"] and
        (window is None or window["from"] <= r["sampleDate"] <= window["to"])]


def new_in_unit_alerts(records, phenotypes=("mrsa", "vre"), lookback_days=180, wards=None):
    """MRSA/VRE first seen after a quiet interval in an inpatient unit.

    IsolateRecord dictionaries in; alert dictionaries with kind, id, date,
    ward, phenotype, organism, patientId, isolateId, previous (date/None) out.
    D-021/D-034 defaults: MRSA/VRE, 180 days; no alert in the site's first
    180 days, subsequent gaps must be strictly > 180 days. D-051: sites
    separate. wards defaults to dataset units, or [{code, type, ...}] registry.
    """
    inpatient = {w["code"] for w in wards if w["type"] == "in"} if wards is not None else {w for w, t in _WARD_TYPE.items() if t == "in"}
    out = []
    for rows in _by_site(_records(records)).values():
        quiet_until = _add_days(min(r.sample_date for r in rows), lookback_days)
        ordered = sorted(rows, key=lambda r: (r.sample_date, r.isolate_id))
        for phenotype in phenotypes:
            last = {}
            for r in ordered:
                if phenotype not in r.phenotypes or r.ward not in inpatient:
                    continue
                previous = last.get(r.ward)
                if r.sample_date >= quiet_until and (previous is None or _days_between(previous, r.sample_date) > lookback_days):
                    out.append(dict(kind="new-in-unit", id=f"new:{phenotype}:{r.isolate_id}", date=r.sample_date,
                        ward=r.ward, phenotype=phenotype, organism=r.organism, patientId=r.patient_id,
                        isolateId=r.isolate_id, previous=previous))
                last[r.ward] = r.sample_date
    return out


def _antibiotic_dict(c):
    d = asdict(c)
    d["notCovering"] = d.pop("not_covering")
    d["outsideSpectrum"] = d.pop("outside_spectrum")
    for key in ("untested", "notCovering", "outsideSpectrum"):
        d[key] = [dict(organism=o, share=s) for o, s in d[key]]
    return d


def coverage(records, *, as_of, ward, specimen, sex=None, age_group=None, onset="any", window_days=365, min_tested=30, wards=None, level=None):
    """Annual first-isolate coverage list with Wilson intervals and fallback.

    IsolateRecord dictionaries in; CoverageResult dictionary out: query, level,
    isolates, sexApplied/ageGroupApplied/onsetApplied, from, organism counts,
    antibiotic shares/counts/95% intervals/28-day context, and tested-both pairs.
    Required: as_of (ISO date), ward, specimen. D-023/D-033/D-044 defaults:
    365 days, minimum 30, no sex/age filter, onset='any'; intrinsic resistance
    and no breakpoint count as not covered, untested excluded. D-049/D-053:
    filters drop age, onset, sex before widening unit → ward type → hospital.
    age_group: child/adult/older/veryOld; onset: any/community/hospital.
    D-051: hospital means ward's site only; wards is an optional registry of
    {code, type, ...}, default dataset units. Informs, does not prescribe.
    """
    r = _coverage.coverage(_records(records), as_of=as_of, ward=ward, specimen=specimen, sex=sex,
        age_group=age_group, onset=onset, window_days=window_days, min_tested=min_tested, wards=wards, current_app=True, level=level)
    return dict(query=r.query, level=r.level, isolates=r.isolates, sexApplied=r.sex_applied,
        ageGroupApplied=r.age_group_applied, onsetApplied=r.onset_applied,
        **{"from": r.from_}, organisms=[dict(organism=o, isolates=n, share=s) for o, n, s in r.organisms],
        antibiotics=[_antibiotic_dict(c) for c in r.antibiotics], combinations=[asdict(c) for c in r.combinations])


def _coverage_result(result):
    antibiotics = []
    for c in result["antibiotics"]:
        d = dict(c)
        for key in ("untested", "notCovering", "outsideSpectrum"):
            d[_snake(key)] = [(x["organism"], x["share"]) for x in d.pop(key)]
        d["counts"] = _coverage.Counts(**d["counts"])
        d["recent"] = _coverage.Counts(**d["recent"])
        d["spectrum"] = _coverage.Share(**{**d["spectrum"], "counts": _coverage.Counts(**d["spectrum"]["counts"])})
        antibiotics.append(_coverage.AntibioticCoverage(**d))
    combinations = [_coverage.CombinationCoverage(**{**c, "counts": _coverage.Counts(**c["counts"])}) for c in result["combinations"]]
    return _coverage.CoverageResult(query=result["query"], level=result["level"], isolates=result["isolates"],
        sex_applied=result["sexApplied"], age_group_applied=result["ageGroupApplied"], onset_applied=result["onsetApplied"],
        from_=result["from"], organisms=[], antibiotics=antibiotics, combinations=combinations)


def suggest(result, severity):
    """Rank a coverage() result for 'mild' or 'severe' infection.

    CoverageResult dictionary in; suggestion dictionaries out (antibiotic,
    standing, basis, share, interval, allOrganisms, coverage). D-026/D-027/D-033:
    mild uses spectrum, excludes IV-only; severe uses all organisms. Bars:
    0.8 mild/0.9 severe, always 0.9 for hospital onset (D-049); > 0.2 untested
    is not assessable (D-046). D-056: standing then coverage, no AWaRe tier.
    No other parameters or defaults; result retains the app's query settings.
    """
    return [dict(antibiotic=s.antibiotic, standing=s.standing, basis=s.basis, share=s.share, interval=s.interval,
        allOrganisms=dict(share=s.all_share, interval=s.all_interval), coverage=_antibiotic_dict(s.coverage))
        for s in _coverage.suggest(_coverage_result(result), severity, current_app=True)]


def suggest_combinations(result, severity, limit=5):
    """Rank useful tested-both antibiotic pairs from coverage().

    CoverageResult dictionary and mild/severe severity in; dictionaries with
    antibiotics, standing, gain, coverage out. D-028/D-033: severe only, no
    single agent clears, gain >= 0.02, not two beta-lactams or urine-only;
    > 0.2 untested is not assessable. Same bars as suggest (D-049), sorted
    standing then coverage without AWaRe (D-056). limit defaults to 5.
    """
    return [dict(antibiotics=s.antibiotics, standing=s.standing, gain=s.gain, coverage=asdict(s.coverage))
        for s in _coverage.suggest_combinations(_coverage_result(result), severity, limit, current_app=True)]
