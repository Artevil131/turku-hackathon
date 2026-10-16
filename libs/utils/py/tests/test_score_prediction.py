"""aei.score_prediction: THL county series, P2 scoring with the two baselines and the strictness audit, and the P1
exposure pieces (flow graph, exposure, outcome, AUC, rewiring null)."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest
from scipy import stats

from aei import harness
from aei import score_prediction as sp
from aei.dataset import Culture, IsolateRecord
from aei.domain import UNITS
from aei.regional import NATIONAL

needs_thl = pytest.mark.skipif(not harness.THL.exists(), reason="THL series not fetched")


# ---------------------------------------------------------------------------------------------------------------------
# P2
# ---------------------------------------------------------------------------------------------------------------------


@needs_thl
def test_county_series_shape_and_sums():
    cs = sp.county_series()
    assert cs.values.shape == (96, 69)
    assert cs.months[0] == "2021-01" and cs.months[-1] == "2026-09"  # the fetch month 2026-10 is left out
    assert len(cs.frame()) == 96 * 69 and not cs.frame().isna().any().any()
    assert (cs.values >= 0).all()
    for ph in sp.PHENOTYPES:
        counties = np.vstack([cs.series((ph, k[1])) for k in cs.keys if k[0] == ph and k[1] != NATIONAL])
        assert counties.shape == (23, 69)
        np.testing.assert_array_equal(counties.sum(axis=0), cs.series((ph, NATIONAL)))
    # a series is the sum of its report groups, checked against the CSV
    thl = pd.read_csv(harness.THL)
    for ph, groups in sp.PHENOTYPE_GROUPS.items():
        want = thl[thl["group"].isin(groups) & (thl["month"] == "2026-08")]["cases"].sum()
        assert cs.series((ph, NATIONAL))[cs.months.index("2026-08")] == want


@needs_thl
def test_baselines_are_finite_and_have_the_spec_keys():
    for baseline in (sp.persistence, sp.seasonal_naive):
        metrics, intervals, n = sp.score_forecaster(baseline)
        assert list(metrics["P2"]) == list(sp.P2_KEYS) == list(intervals["P2"]) == list(n["P2"])
        assert len(sp.P2_KEYS) == 6 + 8 + 2 + 2
        assert all(math.isfinite(v) for v in metrics["P2"].values())
        assert all(math.isfinite(x) and lo <= hi for lo, hi in intervals["P2"].values() for x in (lo, hi))
        assert n["P2"]["mae"] == 92 * 24 and n["P2"]["national_mae_skill"] == 4 * 24 and n["P2"]["MRSA_log_skill"] == 23 * 24
        assert n["P2"]["mae_skill_no_last2"] == 92 * 22


@needs_thl
def test_persistence_matches_a_direct_computation_and_has_zero_skill_against_itself():
    cs = sp.county_series()
    metrics, intervals, _ = sp.score_forecaster(sp.persistence)
    m = metrics["P2"]
    counties = [i for i, k in enumerate(cs.keys) if k[1] != NATIONAL]
    cols = [cs.months.index(t) for t in sp.TARGETS]
    y = cs.values[np.ix_(counties, cols)]
    prev = cs.values[np.ix_(counties, [c - 1 for c in cols])]
    assert m["mae"] == pytest.approx(np.abs(y - prev).mean())
    assert m["log_score"] == pytest.approx(stats.poisson.logpmf(y, np.maximum(prev, 0.5)).mean())
    assert m["mae_skill"] == 0 and m["log_skill"] == 0 and intervals["P2"]["mae_skill"] == [0.0, 0.0]
    # seasonal naive's skill against persistence is the mirror of persistence's against seasonal naive
    s_metrics, _, _ = sp.score_forecaster(sp.seasonal_naive)
    assert s_metrics["P2"]["mae_skill"] == pytest.approx(1 - s_metrics["P2"]["mae"] / m["mae"])
    assert m["mae_skill_seasonal"] == pytest.approx(1 - m["mae"] / s_metrics["P2"]["mae"])
    assert s_metrics["P2"]["log_skill_seasonal"] == 0
    assert m["log_skill_seasonal"] == pytest.approx(-s_metrics["P2"]["log_skill"])


@needs_thl
def test_bootstrap_is_reproducible_and_brackets_the_estimate():
    a = sp.score_forecaster(sp.seasonal_naive)
    b = sp.score_forecaster(sp.seasonal_naive)
    assert a == b
    lo, hi = a[1]["P2"]["log_skill"]
    assert lo < a[0]["P2"]["log_skill"] < hi


@needs_thl
def test_forecaster_sees_only_months_before_the_target():
    seen = []

    def spy(history, target):
        seen.append((target, history.target, history.months[-1], history.values.shape[1]))
        assert not history.values.flags.writeable
        return sp.persistence(history, target)

    sp.evaluate(spy, audit=False)
    assert [s[0] for s in seen] == list(sp.TARGETS) and len(seen) == 24
    for target, htarget, last, width in seen:
        assert htarget == target and last == sp.month_add(target, -1) and width == sp.county_series().months.index(target)


@needs_thl
def test_a_forecaster_that_peeks_is_caught():
    def peeker(history, target):
        cs = sp.county_series()  # reads the whole series, target month included
        j = cs.months.index(target)
        return {key: stats.poisson(max(float(cs.values[i, j]), 0.5)) for i, key in enumerate(cs.keys)}

    with pytest.raises(sp.PeekingError):
        sp.evaluate(peeker)
    # an honest forecaster passes the same audit, and so does a frozen scipy distribution built from the history only
    sp.audit_strict(sp.persistence)

    def honest(history, target):
        return {key: stats.nbinom(5, 5 / (5 + max(history.series(key)[-12:].mean(), 0.5))) for key in history.keys}

    metrics, _, _ = sp.score_forecaster(honest)
    assert math.isfinite(metrics["P2"]["log_skill"]) and math.isfinite(metrics["P2"]["mae"])


@needs_thl
def test_missing_series_is_an_error():
    def partial(history, target):
        return dict(list(sp.persistence(history, target).items())[:5])

    with pytest.raises(ValueError):
        sp.evaluate(partial, audit=False)


# ---------------------------------------------------------------------------------------------------------------------
# P1 on small hand-made worlds
# ---------------------------------------------------------------------------------------------------------------------

_n = 0


def cul(patient: str, date: str, ward: str, result: str = "positive") -> Culture:
    global _n
    _n += 1
    return Culture(f"C{_n:07d}", patient, date, ward, "in", None, "urine", result, 2025, 1, 50)


def rec(patient: str, date: str, ward: str, organism: str = "Escherichia coli", phenotypes=("esbl",)) -> IsolateRecord:
    global _n
    _n += 1
    return IsolateRecord(f"I{_n:07d}", f"C{_n:07d}", patient, date, None, ward, "urine", organism, "F", 50, "South", tuple(phenotypes))


def test_flow_matrix_weights_patients_by_units_visited():
    cultures = [
        cul("P1", "2025-01-01", "ED"), cul("P1", "2025-01-11", "URO"),  # one link, two units: 1/2
        cul("P2", "2025-01-01", "ED"), cul("P2", "2025-01-05", "URO"), cul("P2", "2025-01-09", "ICU"),  # ED->URO, ED->ICU, URO->ICU at 1/3
        cul("P3", "2025-01-01", "ED"), cul("P3", "2025-03-01", "URO"),  # 59 days apart: no link, but two units visited
        cul("P4", "2025-01-01", "ED"), cul("P4", "2025-01-02", "ED", "negative"),  # same unit twice: no link
        cul("P5", "2025-01-01", "ED"), cul("P5", "2025-01-02", "URO"), cul("P5", "2025-01-03", "ED"), cul("P5", "2025-01-04", "URO"),  # ED->URO once, URO->ED once, at 1/2
        cul("P6", "2024-06-01", "ED"), cul("P6", "2025-01-05", "URO"),  # the first culture is outside the window
    ]
    f = sp.flow_matrix(cultures, ("2025-01-01", "2025-12-31"))
    assert list(f.index) == list(UNITS) and list(f.columns) == list(UNITS)
    assert f.loc["ED", "URO"] == pytest.approx(1 / 2 + 1 / 3 + 1 / 2)
    assert f.loc["ED", "ICU"] == pytest.approx(1 / 3) and f.loc["URO", "ICU"] == pytest.approx(1 / 3)
    assert f.loc["URO", "ED"] == pytest.approx(1 / 2)
    assert f.to_numpy().trace() == 0
    assert f.to_numpy().sum() == pytest.approx(1 / 2 + 3 / 3 + 2 / 2)  # P1, P2, P5


def test_exposure_share_and_raw():
    cultures = [cul("P1", "2025-01-01", "URO"), cul("P1", "2025-01-02", "ICU"), cul("P2", "2025-01-01", "ED"), cul("P2", "2025-01-02", "ICU")]
    f = sp.flow_matrix(cultures, ("2025-01-01", "2025-01-31"))
    e = sp.exposure(f, "URO")
    assert e.loc["ICU", "raw"] == pytest.approx(0.5) and e.loc["ICU", "share"] == pytest.approx(0.5)  # URO and ED feed ICU equally
    assert e.loc["ED", "raw"] == 0 and e.loc["ED", "share"] == 0
    assert e.loc["MED-A", "share"] == 0  # nothing flows in
    assert e.loc["URO"].isna().all()
    both = sp.exposure(f, ["URO", "ED"])
    assert both.loc["ICU", "share"] == pytest.approx(1.0) and both.loc["URO"].isna().all() and both.loc["ED"].isna().all()


def test_unit_outcome_counts_distinct_patients_and_uses_smoothed_poisson_tail():
    onset = "2025-06-01"
    records = [rec(f"B{i}", "2025-03-01", "URO") for i in range(3)]  # three baseline patients in the 26 weeks before
    records += [rec("B0", "2025-04-01", "URO")]  # the same patient again: still three
    records += [rec(f"A{i}", "2025-06-10", "URO") for i in range(9)] + [rec("A0", "2025-06-12", "URO")]  # nine patients after
    records += [rec("X", "2025-06-10", "ICU", organism="Klebsiella pneumoniae"), rec("Y", "2025-06-10", "ICU", phenotypes=())]  # filtered out
    records += [rec("Z", "2025-08-05", "ICU")]  # day 65 after onset: beyond the 8 weeks
    out = sp.unit_outcome(records, sp.E1_FILTER, onset, 0.001)
    assert out.loc["URO", "baseline"] == 3 and out.loc["URO", "observed"] == 9
    mu = 3.5 * 56 / 182
    assert out.loc["URO", "expected"] == pytest.approx(mu)
    assert out.loc["URO", "p"] == pytest.approx(stats.poisson.sf(8, mu)) and bool(out.loc["URO", "positive"])
    assert out.loc["ICU", "observed"] == 0 and out.loc["ICU", "p"] == 1.0 and not out.loc["ICU", "positive"]
    assert len(out) == len(UNITS)
    # a phenotype name alone, and a function, are accepted filters
    assert sp.unit_outcome(records, "esbl", onset).loc["URO", "observed"] == 9
    assert sp.unit_outcome(records, lambda r: r.organism == "Klebsiella pneumoniae", onset).loc["ICU", "observed"] == 1
    # a lone patient against an empty baseline is not significant at 0.05 (the +0.5), two are
    one = sp.unit_outcome([rec("A", "2025-06-02", "GER")], "esbl", onset)
    two = sp.unit_outcome([rec("A", "2025-06-02", "GER"), rec("B", "2025-06-03", "GER")], "esbl", onset)
    assert not one.loc["GER", "positive"] and two.loc["GER", "positive"]


def test_auc_sanity():
    assert sp.auc([3, 2, 1, 0], [True, True, False, False]) == 1.0
    assert sp.auc([0, 1, 2, 3], [True, True, False, False]) == 0.0
    assert sp.auc([5, 5, 5, 5], [True, False, True, False]) == 0.5  # all ties count half
    assert sp.auc([2, 1, 1, 0], [True, True, False, False]) == pytest.approx((1 + 1 + 0.5 + 1) / 4)
    assert math.isnan(sp.auc([1, 2, 3], [False, False, False])) and math.isnan(sp.auc([1, 2, 3], [True, True, True]))
    rng = np.random.default_rng(1)
    s, y = rng.normal(size=40), rng.random(40) < 0.3
    u = stats.mannwhitneyu(s[y], s[~y]).statistic
    assert sp.auc(s, y) == pytest.approx(u / (y.sum() * (~y).sum()))
    many = rng.integers(0, 4, size=(5, 40))
    np.testing.assert_allclose(sp.auc(many, y), [sp.auc(row, y) for row in many])


def _world(seed: int = 3) -> tuple[list[Culture], list[IsolateRecord]]:
    """A year of cultures in which URO patients are followed within days by MED-A, MED-B and SURG cultures (the
    ESBL outcome appears in those three units after the onset), over a noisy background of unrelated patients."""
    rng = np.random.default_rng(seed)
    cultures: list[Culture] = []
    day0 = pd.Timestamp("2024-01-05")
    date = lambda k: (day0 + pd.Timedelta(days=int(k))).strftime("%Y-%m-%d")
    for target, count in (("MED-A", 30), ("MED-B", 30), ("SURG", 30)):
        for i in range(count):
            d = rng.integers(0, 300)
            cultures += [cul(f"L{target}{i}", date(d), "URO"), cul(f"L{target}{i}", date(d + 5), target)]
    for i in range(400):
        d = rng.integers(0, 340)
        a, b = rng.choice([u for u in UNITS if u != "URO"], 2)
        cultures += [cul(f"N{i}", date(d), a), cul(f"N{i}", date(d + rng.integers(0, 10)), b)]
    for i in range(300):
        cultures.append(cul(f"S{i}", date(rng.integers(0, 340)), str(rng.choice(UNITS))))
    records = [rec(f"R{u}{i}", "2025-01-20", u) for u in ("MED-A", "MED-B", "SURG", "URO") for i in range(8)]
    return cultures, records


def test_permutation_keeps_unit_volumes_and_patient_degrees():
    cultures, _ = _world()
    rows = sp._prepare(cultures, ("2024-01-01", "2024-12-31"))
    rng = np.random.default_rng(0)
    for _ in range(5):
        u = sp._permuted_unit(rows, rng)
        np.testing.assert_array_equal(np.bincount(u, minlength=9), np.bincount(rows.unit, minlength=9))  # unit volumes
        assert (u != rows.unit).any()
        # the rows (and with them every patient's number of cultures and their dates) are untouched
        assert len(u) == len(rows.unit) == sum(1 for c in cultures if "2024-01-01" <= c.sample_date <= "2024-12-31")
    np.testing.assert_allclose(sp._flows(rows, rows.unit), sp.flow_matrix(cultures, ("2024-01-01", "2024-12-31")).to_numpy())


def test_rewired_null_finds_the_planted_flow_and_is_fast():
    import time

    cultures, records = _world()
    t0 = time.perf_counter()
    res = sp.rewired_auc_null(cultures, records, "URO", "2025-01-01", sp.E1_FILTER, 0.05, n=1000, seed=2026)
    assert time.perf_counter() - t0 < 30
    assert res["positives"] == 3 and res["units"] == 8
    assert res["auc_share"] == 1.0 and res["auc_raw"] == 1.0  # the three units URO feeds are the three positives
    assert len(res["null_share"]) == 1000 and 0.3 < np.nanmean(res["null_share"]) < 0.7
    assert res["p_share"] < 0.05 and res["p_raw"] < 0.05
    again = sp.rewired_auc_null(cultures, records, "URO", "2025-01-01", sp.E1_FILTER, 0.05, n=1000, seed=2026)
    np.testing.assert_array_equal(res["null_share"], again["null_share"])
    # a whole-run wrapper gives the spec's keys
    full = sp.score_exposure(cultures, records, "URO", "2025-01-01", n_null=200)
    assert set(full.metrics["P1"]) == {"auc_share_a05", "auc_raw_a05", "auc_share_a001", "auc_raw_a001", "null_p_share_a05", "null_p_raw_a05", "positives_a05", "positives_a001"}
    assert full.metrics["P1"]["positives_a05"] == 3 and full.metrics["P1"]["auc_share_a05"] == 1.0


def test_no_positive_unit_gives_undefined_auc_not_an_error():
    cultures, _ = _world()
    only_source = [rec(f"R{i}", "2025-01-20", "URO") for i in range(8)] + [rec("Q", "2025-01-21", "MED-A")]  # one patient: not positive
    res = sp.score_exposure(cultures, only_source, "URO", "2025-01-01", n_null=50)
    p1 = res.metrics["P1"]
    assert p1["positives_a05"] == 0 and math.isnan(p1["auc_share_a05"]) and math.isnan(p1["null_p_share_a05"])
    assert not math.isnan(res.excess_corr["share"])  # the continuous description is still defined


def test_flows_match_a_brute_force_count_on_the_dataset(dataset):
    _, cultures = dataset
    window = ("2025-01-01", "2025-02-28")
    by_patient: dict[str, list[Culture]] = {}
    for c in cultures:
        if window[0] <= c.sample_date <= window[1]:
            by_patient.setdefault(c.patient_id, []).append(c)
    brute = pd.DataFrame(0.0, index=list(UNITS), columns=list(UNITS))
    for items in by_patient.values():
        items.sort(key=lambda c: (c.sample_date, c.culture_id))
        visited = {c.ward for c in items}
        pairs = set()
        for i, a in enumerate(items):
            for b in items[i + 1 :]:
                gap = (pd.Timestamp(b.sample_date) - pd.Timestamp(a.sample_date)).days
                if a.ward != b.ward and gap <= 30:
                    pairs.add((a.ward, b.ward))
        for a, b in pairs:
            brute.loc[a, b] += 1 / len(visited)
    np.testing.assert_allclose(sp.flow_matrix(cultures, window).to_numpy(), brute.to_numpy())
