"""The Python mirrors in `aei` compute what the TypeScript gears the app runs compute, on the full dataset (D-024,
D-030). Python-only analysis code (profile rule, resistance shift, logistic regression, injected trials) has no
TypeScript copy and is not compared (D-032).

Strings, dates, counts and observed values must be identical, and lists in the same order; expected values and
p-values agree within 1e-9 relative (scipy's Poisson and hypergeometric tails against the TypeScript's sums).
Run from the repository root:  uv run pytest libs/utils/py/tests
"""

from __future__ import annotations

import math

import pytest

from aei import counting, coverage, detect, eucast, jscompat, relations
from aei.dates import add_days
from aei.detect import SURVEILLANCE_PAIRS, Signal
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


@pytest.fixture(scope="session")
def py(dataset) -> dict:
    """The Python mirrors' output, shaped like ts_dump.ts's."""
    records, cultures = dataset
    live = detect.live_signals(records, cultures)
    excess = detect.profile_excess(records, window_days=28, baseline_days=365, alpha=0.01, min_observed=3)
    window = ("2025-01-01", "2025-06-30")
    all_trails = relations.phenotype_trails(cultures, records)
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
            "profileExcess": signals(excess),
            "profileExcessSpecimen": signals(
                detect.profile_excess(records, window_days=28, baseline_days=365, alpha=0.01, min_observed=3, same_specimen=True)
            ),
            "phenotypeExcess": signals(detect.phenotype_excess(records, PHENOTYPES, window_days=28, baseline_days=365, alpha=0.01, min_observed=2)),
            "samplingDrop": signals(detect.sampling_drop(cultures, window_days=7, baseline_days=56, alpha=0.01)),
            "emptyRun": signals(detect.empty_run(cultures, baseline_days=56, alpha=0.05)),
            "risingTrend": signals(detect.rising_trend(records, SURVEILLANCE_PAIRS, bin_days=28, min_bins=13, alpha=0.01)),
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
        "profileExcess",
        "profileExcessSpecimen",
        "phenotypeExcess",
        "samplingDrop",
        "emptyRun",
        "risingTrend",
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


def test_statistics(ts):
    s = ts["stats"]
    grid = [(k, m) for k in (0, 1, 2, 3, 5, 9, 20) for m in (0, 0.01, 0.4, 2.5, 11)]
    same(s["poissonUpper"], [detect.poisson_upper(k, m) for k, m in grid], "poissonUpper", close=True)
    same(s["poissonLower"], [detect.poisson_lower(k, m) for k, m in grid], "poissonLower", close=True)
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
