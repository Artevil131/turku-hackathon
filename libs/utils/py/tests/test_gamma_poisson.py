"""Tests of aei.gamma_poisson, the Gamma-Poisson test moved from experiment 0015 (experiments/0015-gamma-poisson-guard-band, closed).

On the real data they reproduce 0015's committed full-data numbers at its year-1 choice (S 26 weeks, no guard band, L 1 week, no
budget, q < 0.005): 10 noise episodes over the scoring period, 5.02 a year, with 10 detector alerts and, as I1, 13 alerts in 12
incidents (0015 out/metrics.json). Two small tests need no data: Benjamini-Hochberg against statsmodels, and the negative binomial
tail against a direct sum. The data tests skip when the dataset is missing. Run from the repository root:
uv run pytest -q libs/utils/py/tests/test_gamma_poisson.py
"""

from __future__ import annotations

import math

import numpy as np
import pytest
from scipy import special
from statsmodels.stats.multitest import multipletests

from aei import gamma_poisson as gp
from aei import harness
from aei import score_detection as sd

DATA_OK = (harness.DATA / "isolates.csv").exists()
needs_data = pytest.mark.skipif(not DATA_OK, reason="dataset missing")


def test_bh_matches_statsmodels():
    rng = np.random.default_rng(7)
    p = rng.uniform(1e-6, 1.0, size=(40, 5)) ** 2
    tested = rng.uniform(size=p.shape) < 0.6
    q = gp.bh(p, tested)
    for j in range(p.shape[1]):
        t = tested[:, j]
        if t.any():
            assert np.allclose(q[t, j], multipletests(p[t, j], method="fdr_bh")[1], atol=1e-12)
        assert np.all(q[~t, j] == 1.0)


def test_negative_binomial_tail_is_the_direct_sum():
    alpha, beta, L, y = 3.4, 26 * 1.1, 4, 5
    pnb = beta / (beta + L)
    pmf = [math.exp(special.gammaln(alpha + j) - special.gammaln(alpha) - special.gammaln(j + 1) + alpha * math.log(pnb) + j * math.log1p(-pnb)) for j in range(y)]
    from scipy import stats

    assert stats.nbinom.sf(y - 1, alpha, pnb) == pytest.approx(1.0 - sum(pmf), rel=1e-9)


@needs_data
def test_reproduces_0015_full_data_episodes_at_the_year_1_choice():
    records, cultures = harness.data()
    det = gp.GammaPoisson(S=26, g=0, L=1, budget=False, engine=gp.Engine(records), default_level=0.005)
    signals = det.run(records, cultures)
    assert all(s.detector == gp.DETECTOR and s.ward and s.p < gp.LEVELS[0] for s in signals)
    d4 = sd.episode_counts(det, signals, 0.005)
    assert d4["count"] == 10
    assert d4["episodes_per_year"] == pytest.approx(5.02407, abs=1e-4)
    assert d4["cluster_count"] == 10 and d4["alerts"] == 10
    a, b = harness.SCORE
    sigs = [s for s in signals if det.passes(s, 0.005)]
    alerts = [x for x in sd.group_incidents(sd.alerts_of(det, sigs)) if a <= x.date <= b]
    assert (len(alerts), len({x.incident for x in alerts})) == (13, 12)


@needs_data
def test_budget_changes_nothing_at_the_year_1_level():
    records, cultures = harness.data()
    eng = gp.Engine(records)
    signals = gp.GammaPoisson(S=26, g=0, L=1, engine=eng).run(records, cultures)
    plain = gp.GammaPoisson(S=26, g=0, L=1, budget=False)
    capped = gp.GammaPoisson(S=26, g=0, L=1, budget=True)
    assert [s for s in signals if plain.passes(s, 0.005)] == [s for s in signals if capped.passes(s, 0.005)]
