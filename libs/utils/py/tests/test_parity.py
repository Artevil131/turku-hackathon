"""The Python mirrors in `aei` compute what the TypeScript gears compute, on the full dataset (D-024).

Strings, dates, counts and observed values must be identical, and lists in the same order; expected values and
p-values agree within 1e-9 relative (scipy's Poisson and hypergeometric tails against the TypeScript's sums).
Run from the repository root:  uv run pytest libs/utils/py/tests
"""

from __future__ import annotations

import math

import pytest

from aei import counting, coverage, detect, eucast, inject, jscompat, logistic, relations
from aei.dates import add_days
from aei.detect import LIVE_SETTINGS, SURVEILLANCE_PAIRS, Pair, Signal
from aei.domain import ANTIBIOTICS, PHENOTYPES, SPECIMENS

REL = 1e-9
CLOSE = {"expected", "p"}  # compared within REL; everything else exactly


def same(ts: object, py: object, path: str = "", close: bool = False, rel: float = REL, abs_tol: float = 0.0) -> None:
    """Assert `py` equals the JSON `ts`: dict keys, list order and length, exact values except floats under CLOSE keys."""
    if isinstance(ts, dict):
        assert isinstance(py, dict), path
        assert sorted(ts) == sorted(py), f"{path}: keys {sorted(ts)} != {sorted(py)}"
        for k in ts:
            same(ts[k], py[k], f"{path}.{k}", close or k in CLOSE, rel, abs_tol)
    elif isinstance(ts, list):
        assert isinstance(py, (list, tuple)), path
        assert len(ts) == len(py), f"{path}: length {len(ts)} != {len(py)}"
        for i, (a, b) in enumerate(zip(ts, py, strict=True)):
            same(a, b, f"{path}[{i}]", close, rel, abs_tol)
    elif isinstance(ts, (int, float)) and not isinstance(ts, bool) and close:
        assert isinstance(py, (int, float)), path
        assert math.isclose(ts, py, rel_tol=rel, abs_tol=abs_tol), f"{path}: {ts} != {py}"
    else:
        assert ts == py, f"{path}: {ts!r} != {py!r}"


def signals(ss: list[Signal]) -> list[dict]:
    return [s.as_dict() for s in ss]


def eps(ss: list[Signal]) -> list[dict]:
    return [{"detector": e.detector, "key": e.key, "first": e.first.date, "last": e.last.date, "signals": e.signals} for e in detect.episodes(ss)]


def step(s: relations.TrailStep) -> dict:
    return {"cultureId": s.culture_id, "date": s.date, "ward": s.ward, "organisms": s.organisms, "carriedFrom": s.carried_from, "foundOn": s.found_on}


def trail(t: relations.PatientTrail) -> dict:
    return {"patientId": t.patient_id, "phenotype": t.phenotype, "steps": [step(s) for s in t.steps]}


def link(x: relations.TrailLink) -> dict:
    return {"from": x.source, "to": x.to, "phenotype": x.phenotype, "patients": x.patients, "confirmed": x.confirmed}


def arrival(a: relations.CarrierArrival) -> dict:
    return {
        "patientId": a.patient_id,
        "phenotype": a.phenotype,
        "cultureId": a.culture_id,
        "date": a.date,
        "ward": a.ward,
        "from": a.source,
        "foundOn": a.found_on,
        "confirmed": a.confirmed,
    }


def trials(records, cultures, seed: int) -> list[dict]:
    """experiments/0007's trial sequence on a seed, trimmed as in ts_dump.ts."""
    rand = jscompat.mulberry32(seed)
    sources = inject.clones(records)
    out = []
    n = 0
    for k in (0, 3, 6):
        for _ in range(2):
            out.append(inject.cluster_trial(records, sources, rand, k, n))
            n += 1
    for days, halve in ((0, False), (3, False), (7, True)):
        for _ in range(2):
            out.append(inject.gap_trial(cultures, rand, days, halve))
    return [{"setting": t.setting, "unit": t.unit, "detected": t.detected, "delay": t.delay, "first": t.first} for t in out]


@pytest.fixture(scope="session")
def py(dataset) -> dict:
    """The Python mirrors' output, shaped like ts_dump.ts's."""
    records, cultures = dataset
    live = detect.live_signals(records, cultures)
    clusters = [s for s in live if s.detector in ("profile-excess", "phenotype-excess")]
    excess = detect.profile_excess(records, window_days=28, baseline_days=365, alpha=0.01, min_observed=3)
    by_setting = [
        Pair(p.organism, p.antibiotic, p.specimen, setting)
        for p in SURVEILLANCE_PAIRS
        if f"{p.organism}|{p.antibiotic}" in ("Escherichia coli|TMP", "Escherichia coli|CXM", "Klebsiella pneumoniae|CRO", "Pseudomonas aeruginosa|MEM")
        for setting in (None, "in", "out")
    ]
    window = ("2025-01-01", "2025-06-30")
    all_trails = relations.phenotype_trails(cultures, records)
    rows = [r for r in records if "CIP" in r.results][:3000]
    x = [[1 if r.sex == "M" else 0, (r.age_years - 60) / 10, 1 if r.phenotypes else 0] for r in rows]
    model = logistic.fit_logistic(x, [1 if r.results["CIP"] == "R" else 0 for r in rows], l2=1)
    return {
        "eucast": {
            "effective": [",".join(f"{e.result or '-'}:{e.basis}" for e in (eucast.effective_result(r, a) for a in ANTIBIOTICS)) for r in records],
            "suits": [eucast.suits_specimen(a, s) for s in SPECIMENS for a in ANTIBIOTICS],
        },
        "counting": {
            "all": [r.isolate_id for r in counting.first_isolates(records)],
            "period": [r.isolate_id for r in counting.first_isolates(records, ("2025-03-01", "2025-05-31"))],
        },
        "detect": {
            "profile": [detect.profile_of(r) for r in records],
            "acquired": [detect.has_acquired_resistance(r) for r in records],
            "profileRule": signals(detect.profile_rule(records, min_patients=3, window_days=14, hospital_onset_only=True)),
            "profileRule4": signals(detect.profile_rule(records, min_patients=4, window_days=28, hospital_onset_only=False)),
            "profileExcess": signals(excess),
            "profileExcessSpecimen": signals(
                detect.profile_excess(records, window_days=28, baseline_days=365, alpha=0.01, min_observed=3, same_specimen=True)
            ),
            "phenotypeExcess": signals(detect.phenotype_excess(records, PHENOTYPES, window_days=28, baseline_days=365, alpha=0.01, min_observed=2)),
            "samplingDrop": signals(detect.sampling_drop(cultures, window_days=7, baseline_days=56, alpha=0.01)),
            "resistanceShift": signals(
                detect.resistance_shift(records, SURVEILLANCE_PAIRS, window_days=28, baseline_days=336, step_days=7, alpha=0.01, min_resistant=3)
            ),
            "risingTrend": signals(detect.rising_trend(records, SURVEILLANCE_PAIRS, bin_days=28, min_bins=13, alpha=0.01)),
            "risingTrendBySetting": signals(
                detect.rising_trend(
                    records, by_setting, **{**LIVE_SETTINGS["rising_trend"], "alpha": 0.01}, exclude=detect.in_detected_cluster(clusters)
                )
            ),
            "episodes": eps(excess),
            "liveSignals": signals(live),
            "liveEpisodes": eps(live),
        },
        "relations": {
            "moves": [{"patientId": m.patient_id, "from": m.source, "to": m.to, "date": m.date} for m in relations.patient_moves(cultures)],
            "flows": [{"from": f.source, "to": f.to, "patients": f.patients} for f in relations.patient_flows(cultures)],
            "flowsWindow": [{"from": f.source, "to": f.to, "patients": f.patients} for f in relations.patient_flows(cultures, window)],
            "trails": [trail(t) for t in all_trails],
            "trailsWindowed": [trail(t) for t in relations.phenotype_trails(cultures, records, window=window, max_days=60, phenotype="esbl")],
            "links": [link(x) for x in relations.trail_links(all_trails)],
            "linksWindow": [link(x) for x in relations.trail_links(all_trails, window)],
            "arrivals": [arrival(a) for a in relations.carrier_arrivals(all_trails)],
            "arrivalsWindow": [arrival(a) for a in relations.carrier_arrivals(all_trails, window)],
        },
        "logistic": {
            "weights": model.weights,
            "iterations": model.iterations,
            "predictions": [logistic.predict(model, row) for row in x[:50]],
        },
        "trials": {str(seed): trials(records, cultures, seed) for seed in (1, 7, 2026)},
    }


# The Python fixture comes first in each signature, so it is computed while Node is still running.


def test_effective_result(py, ts):
    same(ts["eucast"], py["eucast"])


def test_first_isolates(py, ts):
    same(ts["counting"], py["counting"])


def test_profiles(py, ts):
    same(ts["detect"]["profile"], py["detect"]["profile"])
    same(ts["detect"]["acquired"], py["detect"]["acquired"])


@pytest.mark.parametrize(
    "name",
    [
        "profileRule",
        "profileRule4",
        "profileExcess",
        "profileExcessSpecimen",
        "phenotypeExcess",
        "samplingDrop",
        "resistanceShift",
        "risingTrend",
        "risingTrendBySetting",
        "episodes",
        "liveSignals",
        "liveEpisodes",
    ],
)
def test_detector(py, ts, name):
    assert ts["detect"][name], f"{name}: the TypeScript gave no signals, so the comparison would prove nothing"
    same(ts["detect"][name], py["detect"][name], name)


@pytest.mark.parametrize("name", ["moves", "flows", "flowsWindow", "trails", "trailsWindowed", "links", "linksWindow", "arrivals", "arrivalsWindow"])
def test_relations(py, ts, name):
    assert ts["relations"][name]
    same(ts["relations"][name], py["relations"][name], name)


def test_injected_trials(py, ts):
    same(ts["trials"], py["trials"])
    assert any(t["detected"] for ts_trials in ts["trials"].values() for t in ts_trials)


def test_logistic(py, ts):
    assert py["logistic"]["iterations"] == ts["logistic"]["iterations"]
    # numpy sums in another order than the TypeScript loops: agreement to rounding, not to the bit.
    same(ts["logistic"]["weights"], py["logistic"]["weights"], "weights", close=True, rel=1e-9, abs_tol=1e-12)
    same(ts["logistic"]["predictions"], py["logistic"]["predictions"], "predictions", close=True)


def test_statistics(ts):
    s = ts["stats"]
    grid = [(k, m) for k in (0, 1, 2, 3, 5, 9, 20) for m in (0, 0.01, 0.4, 2.5, 11)]
    same(s["poissonUpper"], [detect.poisson_upper(k, m) for k, m in grid], "poissonUpper", close=True)
    same(s["poissonLower"], [detect.poisson_lower(k, m) for k, m in grid], "poissonLower", close=True)
    tables = [(3, 2, 1, 40), (5, 20, 30, 400), (0, 3, 3, 0), (12, 3, 2, 300), (4, 0, 0, 50)]
    same(s["fisher"], [detect.fisher_mid_p_greater(*t) for t in tables], "fisher", close=True)
    same(s["normalUpper"], [detect.normal_upper(z) for z in (-3, -1, 0, 0.7, 2, 3.5, 6)], "normalUpper", close=True)
    groups = [[(1, 10), (2, 10), (5, 12)], [(0, 5), (0, 0), (3, 4), (9, 11)]]
    same(s["trend"], [detect.cochran_armitage_rising(g) for g in groups], "trend", close=True)
    same(s["wilson"], [list(coverage.wilson(k, n)) for k, n in ((0, 0), (0, 5), (3, 7), (40, 40), (123, 456))], "wilson")


def test_js_formatting(ts):
    f = ts["format"]
    xs = [float(x) for x in f["xs"]]
    assert f["fixed1"] == [jscompat.to_fixed(x, 1) for x in xs]
    assert f["fixed4"] == [jscompat.to_fixed(x, 4) for x in xs]
    assert f["precision2"] == [jscompat.to_precision(x, 2) for x in xs]
    assert f["exponential1"] == [jscompat.to_exponential(x, 1) for x in xs]
    assert f["round"] == [jscompat.js_round(x) for x in xs]
    assert f["string"] == [jscompat.js_str(x) for x in xs]
    rand = jscompat.mulberry32(2026)
    assert f["mulberry32"] == [rand() for _ in f["mulberry32"]]


def test_dates():
    assert add_days("2024-02-28", 1) == "2024-02-29"
    assert add_days("2025-03-30", 1) == "2025-03-31"  # daylight saving does not shift a day
    assert add_days("2026-01-01", -1) == "2025-12-31"
