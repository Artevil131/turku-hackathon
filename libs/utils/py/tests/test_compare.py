"""Tests of aei.compare against scipy and hand-checked numbers (no dataset needed). Run from the repository root:
uv run pytest -q libs/utils/py/tests/test_compare.py"""

from __future__ import annotations

import math

import pytest
from scipy import stats

from aei import compare


def test_proportion_difference_hand_checked():
    r = compare.proportion_difference(10, 100, 20, 100)
    assert r["diff"] == pytest.approx(0.1)
    assert r["z"] == pytest.approx(0.1 / math.sqrt(0.15 * 0.85 * 0.02))
    assert r["p"] == pytest.approx(2 * stats.norm.sf(r["z"]), abs=2e-7)  # normal_upper's own error
    assert r["interval"]["lo"] == pytest.approx(0.0001, abs=1e-3)
    assert r["interval"]["hi"] == pytest.approx(0.1996, abs=1e-3)


def test_proportion_edges():
    assert math.isnan(compare.proportion_difference(0, 0, 3, 10)["diff"])
    assert compare.proportion_difference(30, 30, 40, 40)["p"] == 1.0


def test_rate_ratio_against_scipy():
    r = compare.rate_ratio(5, 4, 15, 4)
    assert r["ratio"] == 3
    ci = stats.binomtest(15, 20).proportion_ci(0.95, method="exact")
    assert r["interval"]["lo"] == pytest.approx(ci.low / (1 - ci.low), rel=1e-9)
    assert r["interval"]["hi"] == pytest.approx(ci.high / (1 - ci.high), rel=1e-9)
    assert r["p"] == pytest.approx(stats.binomtest(15, 20, 0.5).pvalue, rel=1e-9)
    u = compare.rate_ratio(12, 26, 7, 13)
    assert u["p"] == pytest.approx(stats.binomtest(7, 19, 13 / 39).pvalue, rel=1e-9)


def test_rate_ratio_edges():
    assert compare.rate_ratio(0, 4, 5, 4)["ratio"] == math.inf
    assert compare.rate_ratio(0, 4, 0, 4)["p"] == 1.0
    with pytest.raises(ValueError):
        compare.rate_ratio(1, 0, 1, 1)


def test_beta_posterior_against_scipy():
    r = compare.beta_posterior(3, 10)
    assert r["mean"] == pytest.approx(4 / 12)
    lo, hi = stats.beta(4, 8).ppf([0.025, 0.975])
    assert r["interval"]["lo"] == pytest.approx(lo, abs=1e-3)
    assert r["interval"]["hi"] == pytest.approx(hi, abs=1e-3)
    assert len(r["grid"]) == 201
    mid = r["grid"][100]
    assert mid["y"] == pytest.approx(stats.beta(4, 8).pdf(0.5), rel=1e-9)


def test_discounted_beta_delta_one_is_plain():
    d = compare.discounted_beta([(3, 5), (0, 5)], delta=1, m=4, parent_share=0.25)
    p = compare.beta_posterior(3, 10, (1, 3))
    assert (d["a"], d["b"], d["effectiveN"]) == (p["a"], p["b"], 10)
    assert d["interval"] == p["interval"]
    half = compare.discounted_beta([(3, 5), (0, 5)], delta=0.5, m=4, parent_share=0.25)
    assert half["effectiveN"] == 7.5


def test_shares_by_period():
    days = [("2025-01-01", True), ("2025-01-04", False), ("2025-01-04", True), ("2025-01-09", True)]
    out = compare.shares_by_period(days, "2025-01-01", "2025-01-10", 4, event=lambda r: r[1], date=lambda r: r[0])
    assert [(p["from"], p["to"], p["k"], p["n"]) for p in out] == [("2025-01-01", "2025-01-04", 2, 3), ("2025-01-05", "2025-01-08", 0, 0), ("2025-01-09", "2025-01-10", 1, 1)]
    assert out[1]["share"] is None
