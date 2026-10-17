"""Tests of aei.cusum, the CUSUM detector moved from experiment 0016 (experiments/0016-cusum, closed) into the shared package.

They reproduce 0016's committed numbers on the real data: the union (Poisson weekly theta 8 with no guard band plus Bernoulli
theta 8 with a guard band of 4 weeks, equalised mapping) raises 7 fixed-key episodes over the scoring period at a per-series
run length of 72.1 years and 100, 14 and 4 at 10, 30 and 100 years (0016 results.md); the year-1 `tune_curve` rows of the
parts at L = 100 years give rare 14/40 (Poisson) and 19/40 (Bernoulli); and, slow (set AEI_PERF=1), `score_detector`
reproduces 0016's D5 headline, rare 0.665 and common ESBL 0.485 at 3.52 episodes a year. Every test skips when the data
is missing. Run from the repository root:  uv run pytest -q libs/utils/py/tests/test_cusum.py
"""

from __future__ import annotations

import os

import pytest

from aei import cusum, harness
from aei import score_detection as sd

POIS = (8.0, 7, 0)
BERN = (8.0, 4)
L_SIM = 72.0682  # 0016's text says "72.1 years"; its grid.json has 72.0682


@pytest.fixture(scope="module")
def data(dataset):
    return harness.data()


@pytest.fixture(scope="module")
def union_signals(data):
    records, cultures = data
    det = cusum.Cusum(pois=POIS, bern=BERN).detector()
    return det, det.run(records, cultures, None)


def _episodes(det, signals, years: float) -> int:
    return sd.episode_counts(det, signals, cusum.level_of_years(years), ("cluster", "sentinel"))["count"]


def test_level_of_years():
    assert cusum.level_of_years(1.0) == pytest.approx(1 / 365.25)


def test_union_episode_counts_on_the_real_data_match_0016(union_signals):
    det, signals = union_signals
    got = {y: _episodes(det, signals, y) for y in (L_SIM, 10.0, 30.0, 100.0)}
    assert got == {L_SIM: 7, 10.0: 100, 30.0: 14, 100.0: 4}


def test_the_fast_path_world_is_the_real_data(data):
    records, _ = data
    world = cusum.real_world()
    assert world.D == len(cusum.calendar()[1])
    assert world.rdates[0] == records[0].sample_date and world.rdates[-1] == records[-1].sample_date


@pytest.mark.parametrize(
    ("name", "detector", "rare_hits"),
    [
        ("poisson", cusum.Cusum(pois=POIS, bern=None), 14),
        ("bernoulli", cusum.Cusum(pois=None, bern=BERN), 19),
    ],
)
def test_year1_rows_of_the_parts_at_100_years_match_0016(data, name, detector, rare_hits):
    records, cultures = data
    rows = sd.tune_curve(detector.detector(), records, cultures)
    row = next(r for r in rows if r["level"] == pytest.approx(cusum.level_of_years(100.0)))
    assert (row["rare_hit"], row["rare_n"]) == (rare_hits, 40), name


def test_causal_on_two_cut_dates(data):
    records, cultures = data
    det = cusum.Cusum(pois=POIS, bern=BERN, rebuild=True).detector()
    assert sd.check_causal(det, ["2025-03-31", "2026-06-30"], records, cultures, raise_on_error=False) == []


@pytest.mark.skipif(not os.getenv("AEI_PERF"), reason="about a minute of CPU; set AEI_PERF=1 to run the D5 headline check")
def test_d5_headline_reproduces_0016(data):
    records, cultures = data
    levels = tuple(cusum.level_of_years(y) for y in sorted({*cusum.LEVELS_YEARS, round(L_SIM, 6)}))
    det = cusum.Cusum(pois=POIS, bern=BERN).detector(levels=levels, default_level=cusum.level_of_years(L_SIM))
    metrics, intervals, n, _ = sd.score_detector(det, parts=("D5",), records=records, cultures=cultures, verbose=False)
    d5 = metrics["D5"]
    assert d5["level"] == pytest.approx(cusum.level_of_years(L_SIM), rel=1e-5)
    assert d5["noise"] == pytest.approx(3.52, abs=0.005)
    assert d5["rare"] == pytest.approx(0.665, abs=1e-9)
    assert d5["common_esbl"] == pytest.approx(0.485, abs=1e-9)
