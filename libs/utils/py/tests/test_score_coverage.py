"""`aei.score_coverage` scores coverage estimators on C1 to C8 (benchmarks/METRICS.md, harness-spec.md).

Acceptance, on the full dataset (skipped without it):

- the hospital-365 baseline gives C1 0.1414 (all) and 0.1605 (small), and the eight estimators of experiments/0004, run
  through the estimator protocol, give every row of 0004's `out/results.md`: Brier score and log loss, all cells, small
  cells and cells outside Urology, the difference to the baseline and its 95 % bootstrap interval, to 4 decimals;
- the `shipped` estimator, ranked by the shipped list's rules, gives experiments/0010's tables: mild "clears" 96.6 %
  realised within spectrum, all mild top picks 75.4 % over all organisms, severe 95.4 %; 0 of 175 query-months below 80 %
  (0.3 expected) and 23 of 269 below 90 % (19.6 expected); 959 of 4,285 cells below the Wilson lower bound against
  1,079 expected; and every ranked row of the month loop (what `backtest.ts` writes) is the row the protocol gives.

The rest are properties of the pieces: first isolates against `aei.counting`, the outcome conventions, the bootstrap
draws, the logistic fit against statsmodels, the mid-p PIT, C6's rule on a made-up estimator.

Everything slow sits in session-scoped fixtures: the two baselines are scored once (about 25 s of CPU together).
"""

from __future__ import annotations

import json
import math
import os
import re
import subprocess
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from scipy import stats

from aei import coverage_list as cl
from aei import harness
from aei import score_coverage as sc
from aei.counting import first_isolates
from aei.coverage import wilson
from aei.dates import add_days, days_between
from aei.eucast import effective_result, suits_specimen
from aei.jscompat import mulberry32, to_fixed

ROOT = Path(__file__).resolve().parents[4]
RESULTS_0004 = "experiments/0004-coverage-estimators/out/results.md"


@lru_cache(maxsize=None)
def committed(rel_path: str) -> str:
    """A reference file as committed (`git show HEAD:<path>`), not as the working tree has it: `verify_experiments.py`
    rewrites results files in place while it checks them, and a test that read one then saw it half written (harness
    review, finding 17). Skips the test when the file is not in HEAD."""
    run = subprocess.run(["git", "-C", str(ROOT), "show", f"HEAD:{rel_path}"], capture_output=True, text=True, encoding="utf-8")
    if run.returncode != 0:
        pytest.skip(f"{rel_path} is not committed at HEAD")
    return run.stdout


@pytest.fixture(scope="session")
def scored(dataset):
    """score_estimator for the two baselines: {name: (metrics, intervals, n, timings)}."""
    out = {}
    for est in (sc.hospital_365, sc.shipped):
        timings: dict = {}
        out[est.name] = (*sc.score_estimator(est, verbose=False, timings=timings), timings)
    return out


@pytest.fixture(scope="session")
def shipped_ranked(dataset):
    return sc.rank_queries(sc.shipped)


@pytest.fixture(scope="session")
def loop_rows(dataset):
    records, _ = dataset
    return cl.month_loop(records, current_app=False)[0]  # 0010's committed figures, not today's live ordering.


# --- the baseline and 0004 ---------------------------------------------------------------------------------------------------


def test_hospital_365_reproduces_0004_headline(scored):
    metrics, intervals, n, _ = scored["hospital_365"]
    assert round(metrics["C1"]["all"], 4) == 0.1414 and round(metrics["C1"]["small"], 4) == 0.1605
    assert round(metrics["C2"]["all"], 4) == 0.4433 and round(metrics["C2"]["small"], 4) == 0.4894
    assert n["C1"]["all"] == 163666 and n["C1"]["small"] == 36588 and n["C1"]["all_counted"] == 182367
    # the baseline against itself: zero difference, zero-width interval
    for key in ("all", "small", "all_counted", "small_counted"):
        assert metrics["C1_diff"][key] == 0 and intervals["C1_diff"][key] == [0, 0]
        assert metrics["C2_diff"][key] == 0


def test_the_eight_estimators_of_0004_reproduce_every_row_of_its_results(dataset):
    text = committed(RESULTS_0004)
    titles = {"All cells": "all", "Cells with under 30 first isolates in the unit's last 28 days": "small", "All units except Urology": "no URO"}
    tables = {name: sc.c1_c2_table(est) for name, est in sc.estimators_0004()}
    pattern = re.compile(r"### (.+?) · (Brier score|log loss) \(n = (\d+)\)\n\n\| estimator.*?\n\|---.*?\n((?:\|.*\n)+)")
    checked = 0
    for m in pattern.finditer(text):
        subset = titles[m.group(1)]
        metric = "brier" if m.group(2) == "Brier score" else "logloss"
        for line in m.group(4).strip().split("\n"):
            name, mean, diff, interval = (c.strip() for c in line.strip("|").split("|"))
            r = tables[name][subset][metric]
            assert r["n"] == int(m.group(3)), (name, subset)
            got_interval = "–" if name.startswith("3 ") else f"{to_fixed(r['diff_ci'][0], 4)} to {to_fixed(r['diff_ci'][1], 4)}"
            assert [to_fixed(r["value"], 4), to_fixed(r["diff"], 4), got_interval] == [mean, diff, interval], (name, subset, metric)
            checked += 1
    assert checked == 8 * 3 * 2  # eight estimators, three subsets, two metrics


# --- the shipped list and 0010 ------------------------------------------------------------------------------------------------


def test_shipped_reproduces_0010_c4(scored, shipped_ranked):
    metrics, _, n, _ = scored["shipped"]
    c4 = metrics["C4"]
    assert to_fixed(100 * c4["mild_spectrum"], 1) == "96.6" and n["C4"]["mild_spectrum"] == 9866  # mild clears, within spectrum
    assert to_fixed(100 * c4["mild_all"], 1) == "75.4" and n["C4"]["mild_all"] == 16139  # every mild top pick, all organisms
    assert to_fixed(100 * c4["severe"], 1) == "95.4" and n["C4"]["severe"] == 14473  # severe clears
    # 0010 table 3, every top pick: severe 95.3 % (untested left out) and 93.7 % (untested not covered), mild 75.4 % both ways
    top = shipped_ranked[shipped_ranked["rank"] == 0]
    sev, mild = top[top["severity"] == "severe"], top[top["severity"] == "mild"]
    assert len(sev) == len(mild) == 529
    assert to_fixed(100 * sev["covered"].sum() / sev["all_known"].sum(), 1) == "95.3"
    assert to_fixed(100 * sev["covered"].sum() / sev["n_target"].sum(), 1) == "93.7"
    assert to_fixed(100 * mild["covered"].sum() / mild["all_known"].sum(), 1) == "75.4"
    assert to_fixed(100 * mild["covered"].sum() / mild["n_target"].sum(), 1) == "75.4"
    # untested counted as not covered can only lower a share, on the same query-months
    assert c4["severe_counted"] < c4["severe"] and c4["mild_all_counted"] <= c4["mild_all"] and c4["mild_spectrum_counted"] <= c4["mild_spectrum"]


def test_shipped_reproduces_0010_c3b_and_the_lower_bound_check(scored, shipped_ranked):
    metrics, _, n, _ = scored["shipped"]
    c3 = metrics["C3b"]
    assert (n["C3b"]["mild"], c3["mild_obs"], to_fixed(c3["mild_exp"], 1)) == (175, 0, "0.3")
    assert (n["C3b"]["severe"], c3["severe_obs"], to_fixed(c3["severe_exp"], 1)) == (269, 23, "19.6")
    assert to_fixed(c3["severe_ratio"], 2) == "1.17" and c3["pass"] is True
    lb = sc.lower_bound_check(shipped_ranked)
    assert (lb["cells"], lb["obs"], to_fixed(lb["exp"], 1), to_fixed(lb["ratio"], 2)) == (4285, 959, "1079.0", "0.89")
    # the extras beside the spec's keys carry the Beta-binomial variant and the same check
    assert metrics["C7_lower_bound"]["obs"] == 959 and metrics["C3b_bb"]["severe_obs"] == 23
    assert metrics["C3b_bb"]["severe_exp"] > 0 and metrics["C3b_bb"]["pass"] is True


def test_every_ranked_row_matches_the_month_loop(shipped_ranked, loop_rows):
    """The protocol's `shipped` through `suggest_rows` and the realised counts of the targets is `suggest(coverage())`
    against the unit's own isolates of the month, row by row (what backtest.ts writes)."""
    loop = pd.DataFrame(loop_rows)
    assert len(loop) == len(shipped_ranked) == 7525
    r = shipped_ranked
    assert (loop["month"].to_numpy() == r["month"].to_numpy()).all()
    assert (loop["ward"].to_numpy() == r["ward"].to_numpy()).all() and (loop["specimen"].to_numpy() == r["specimen"].to_numpy()).all()
    for a, b in (("severity", "severity"), ("rank", "rank"), ("antibiotic", "antibiotic"), ("standing", "standing"), ("level", "level")):
        assert (loop[a].to_numpy() == r[b].to_numpy()).all(), a
    for a, b in (("pool", "pool"), ("targetIsolates", None), ("covered", "covered"), ("known", "known"), ("allKnown", "all_known"), ("allCovered", "covered")):
        if b:
            assert (loop[a].to_numpy() == r[b].to_numpy()).all(), a
    for a, b in (("share", "share"), ("lower", "lower"), ("allShare", "all_share")):
        x, y = loop[a].to_numpy(dtype=float), r[b].to_numpy(dtype=float)
        assert np.array_equal(np.isnan(x), np.isnan(y)), a
        assert np.allclose(x[~np.isnan(x)], y[~np.isnan(y)], rtol=0, atol=1e-12), a


def test_shipped_estimator_is_the_mirror_of_the_list(dataset):
    records, _ = dataset
    for as_of in ("2025-06-30", "2026-03-31"):
        view = sc.view_as_of(as_of)
        out = {c: sc.shipped.predict(view, c).set_index("cell_id") for c in ("left_out", "spectrum", "counted")}
        for ward, specimen in (("URO", "urine"), ("ICU", "blood"), ("ED", "wound"), ("PHC-N", "urine")):
            res = cl.coverage(records, as_of=as_of, ward=ward, specimen=specimen, codes=[a for a in sc.ANTIBIOTICS if suits_specimen(a, specimen)])
            for c in res.antibiotics:
                i = sc.cell_id(ward, specimen, c.antibiotic)
                assert out["left_out"].loc[i, "level"] == res.level
                for conv, share, interval in (("left_out", c.share, c.interval), ("spectrum", c.spectrum.share, c.spectrum.interval)):
                    row = out[conv].loc[i]
                    if share is None:
                        assert math.isnan(row["p"])
                    else:
                        assert (row["p"], row["lo95"], row["hi95"]) == (share, interval[0], interval[1])
                known = c.counts.known
                assert (out["counted"].loc[i, "p"] == c.counts.covered / res.isolates) if res.isolates >= 30 else math.isnan(out["counted"].loc[i, "p"])
                if known >= 30:  # the 90 % interval is Wilson at z = 1.644854
                    assert out["left_out"].loc[i, "lo90"] == pytest.approx(wilson(c.counts.covered, known, 1.644854)[0], abs=1e-15)


# --- the metric keys ---------------------------------------------------------------------------------------------------------


def test_metric_keys_are_the_specs(scored):
    for name, (metrics, intervals, _n, _) in scored.items():
        ones = {"all", "small", "all_counted", "small_counted"}
        for k in ("C1", "C1_diff", "C2", "C2_diff"):
            assert set(metrics[k]) == ones and set(intervals[k]) == ones, (name, k)
        assert set(metrics["C3a"]) == {"slope", "intercept"} and set(intervals["C3a"]) == {"slope", "intercept"}
        assert set(metrics["C3b"]) == {"mild_obs", "mild_exp", "mild_ratio", "mild_tail_p", "severe_obs", "severe_exp", "severe_ratio", "severe_tail_p", "pass"}
        assert set(metrics["C4"]) == {"mild_spectrum", "mild_all", "severe", "mild_spectrum_counted", "mild_all_counted", "severe_counted"}
        assert set(metrics["C6"]) == {"E1_CRO", "E1_CXM", "E2_CXM"}
        assert set(metrics["C7"]) == {"a", "b", "a_literal", "b_literal", "pass_a", "a_expected", "b_expected", "a_minus_expected"}
        assert set(metrics["C8"]) == {"C1", "C1_diff", "C4_mild_spectrum", "C4_severe"}
        assert all(re.fullmatch(r"[A-Z][a-z]+ [a-z]+\|[A-Z]{3}", k) for k in metrics["C5"]) and len(metrics["C5"]) > 50
        assert set(metrics) == {"C1", "C1_diff", "C2", "C2_diff", "C3a", "C3b", "C4", "C5", "C6", "C7", "C8", "C3b_bb", "C7_lower_bound"}
        for k, v in intervals.items():
            assert set(v) <= set(metrics[k]), (name, k)
            assert all(len(i) == 2 and i[0] <= i[1] for i in v.values()), (name, k)
        # every interval brackets its value (the bootstrap of a value, not of a difference), up to resampling noise
        for key in ("all", "small"):
            lo, hi = intervals["C1"][key]
            assert lo <= metrics["C1"][key] <= hi


def test_the_metrics_write_through_the_harness(scored, tmp_path):
    metrics, intervals, n, _ = scored["shipped"]
    doc = harness.write_metrics(
        tmp_path / "metrics.json",
        experiment="baseline-coverage-shipped",
        method="test",
        family="coverage",
        metrics=metrics,
        intervals=intervals,
        n=n,
        runtime_s=1.0,
        seeds=[2026],
    )
    assert json.loads((tmp_path / "metrics.json").read_text()) == doc
    assert doc["metrics"]["C6"]["E1_CXM"] is None or isinstance(doc["metrics"]["C6"]["E1_CXM"], int)


def test_differences_are_values_minus_baseline(scored):
    base, shipped = scored["hospital_365"][0], scored["shipped"][0]
    for k in ("all", "small", "all_counted", "small_counted"):
        assert shipped["C1_diff"][k] == pytest.approx(shipped["C1"][k] - base["C1"][k], abs=1e-12)
        assert shipped["C2_diff"][k] == pytest.approx(shipped["C2"][k] - base["C2"][k], abs=1e-12)


@pytest.mark.skipif(not os.getenv("AEI_PERF"), reason="CPU time depends on the load of the machine; set AEI_PERF=1 to assert it")
def test_cheap_estimators_score_in_a_few_seconds_of_cpu(scored):
    for name in ("hospital_365", "shipped"):
        assert sum(scored[name][3].values()) < 180, name  # the brief: well under 3 minutes
    assert sum(scored["hospital_365"][3].values()) < 60


def test_shipped_c7_reads_the_interval_as_a_predictive_interval(scored):
    metrics, _, n, _ = scored["shipped"]
    c7 = metrics["C7"]
    assert 0.85 <= c7["a"] <= 0.95 and c7["pass_a"] is True  # about nine in ten counts fall inside the 90 % predictive interval
    assert c7["a_literal"] < 0.5  # the interval for p alone rarely contains a realised share over 20 or more isolates
    assert n["C7"]["a"] > 1500 and 0 < n["C7"]["b"] < 100


def test_shipped_and_hospital_c7_expectation_is_the_methods_own_predictive_coverage(scored):
    """Harness review, finding 8: the band's nominal coverage over these blocks is about 0.907, not 0.90, because the count
    is discrete; `a_minus_expected` is the observed share minus it, with a bootstrap interval over target months."""
    for name in ("hospital_365", "shipped"):
        metrics, intervals, n, _ = scored[name]
        c7 = metrics["C7"]
        assert 0.90 < c7["a_expected"] < 0.915 and 0.85 < c7["b_expected"] < 0.95, name
        assert c7["a_minus_expected"] == pytest.approx(c7["a"] - c7["a_expected"], abs=1e-12)
        lo, hi = intervals["C7"]["a_minus_expected"]
        assert lo <= c7["a_minus_expected"] <= hi and lo < 0 < hi, name  # both baselines are honest (the review)
        assert n["C7"]["a_expected"] == n["C7"]["a_minus_expected"] == n["C7"]["a"] and n["C7"]["b_expected"] == n["C7"]["b"]
        assert 0.85 <= c7["a"] <= 0.95 and c7["pass_a"] is True  # the band and its verdict are unchanged


def test_inside_probability_sums_the_counts_whose_mid_p_is_in_the_band():
    def brute(n: int, a: float, b: float) -> float:
        f = stats.betabinom.pmf(np.arange(n + 1), n, a, b)
        u = np.cumsum(f) - f / 2  # F(k - 1) + f(k) / 2
        return float(f[(u >= 0.05) & (u <= 0.95)].sum())

    cases = [(20, 3.0, 2.0), (7, 0.8, 0.3), (40, 8.0, 8.0), (25, 6.0, 1.5), (60, 40.0, 1.1)]
    got = sc.inside_probability(np.array([c[0] for c in cases]), np.array([c[1] for c in cases]), np.array([c[2] for c in cases]))
    assert got == pytest.approx([brute(*c) for c in cases], abs=1e-9)
    assert (got > 0.8).all() and (got < 1.0).all()
    # it is what a correct method shows: draws from the Beta-binomial itself fall inside the band that often
    rng = np.random.default_rng(11)
    for n, a, b in ((30, 5.0, 1.0), (50, 12.0, 3.0)):
        k = stats.betabinom.rvs(n, a, b, size=60000, random_state=rng)
        u = sc.mid_pit(k, np.full(k.shape, n), np.full(k.shape, a), np.full(k.shape, b))
        share = float(((u >= 0.05) & (u <= 0.95)).mean())
        assert share == pytest.approx(float(sc.inside_probability(np.array([n]), np.array([a]), np.array([b]))[0]), abs=0.01)


def _ranked(rows: list[tuple]) -> pd.DataFrame:
    """A minimal `rank_queries` frame: (severity, share, known, covered) of top picks that clear."""
    cols = ["severity", "share", "known", "covered"]
    df = pd.DataFrame(rows, columns=cols)
    return df.assign(rank=0, standing="clears", pa=math.nan, pb=math.nan, lower=df["share"] - 0.05, upper=np.minimum(df["share"] + 0.04, 1.0))


def test_c3b_reports_the_poisson_tail_beside_a_pass_that_is_unchanged():
    """Harness review, finding 6: 26 sure mild picks (expected 0.30 below 80 %) and one unlucky month fail the ratio rule
    (1 > 1.5 x 0.30) although chance gives one or more 26 % of the time; `pass` stays the ratio's verdict."""
    mild = [("mild", 0.95, 10, 10)] * 25 + [("mild", 0.95, 10, 7)]
    severe = [("severe", 0.97, 10, 10)] * 40
    c3, bb = sc.c3b(_ranked(mild + severe))
    exp = float(26 * stats.binom.cdf(7, 10, 0.95))
    assert c3["mild_obs"] == 1 and c3["mild_exp"] == pytest.approx(exp) and 0.29 < exp < 0.31
    assert c3["mild_ratio"] > sc.PASS_RATIO and c3["pass"] is False  # the spec's rule, untouched
    assert c3["mild_tail_p"] == pytest.approx(1 - math.exp(-exp)) and 0.25 < c3["mild_tail_p"] < 0.27
    assert c3["severe_obs"] == 0 and c3["severe_tail_p"] == 1.0
    assert bb["mild_tail_p"] == pytest.approx(1 - math.exp(-bb["mild_exp"]))
    # no query-month to judge in a severity: no tail, no verdict
    c3, _ = sc.c3b(_ranked(mild))
    assert c3["severe_tail_p"] is None and c3["pass"] is None
    assert sc.poisson_upper_tail(0, 3.0) == 1.0 and sc.poisson_upper_tail(23, 19.5907706) == pytest.approx(float(stats.poisson.sf(22, 19.5907706)))


def test_shipped_c3b_tails(scored):
    for name in ("hospital_365", "shipped"):
        c3 = scored[name][0]["C3b"]
        for sev in ("mild", "severe"):
            assert c3[f"{sev}_tail_p"] == pytest.approx(float(stats.poisson.sf(c3[f"{sev}_obs"] - 1, c3[f"{sev}_exp"])) if c3[f"{sev}_obs"] else 1.0)
    assert to_fixed(scored["shipped"][0]["C3b"]["severe_tail_p"], 2) == "0.25"  # 23 of 269 against 19.6 expected


# --- targets, conventions, first isolates ---------------------------------------------------------------------------------------


def test_window_targets_are_0004s(dataset):
    ws = sc.windows()
    assert len(ws) == 26 and ws[0] == ("2024-09-30", "2024-10-27") and ws[-1][1] == "2026-09-27"
    assert all(add_days(end, 1) == nxt for (_, end), (nxt, _) in zip(ws[:-1], ws[1:], strict=True))  # consecutive, 28 days each
    assert all(add_days(a, 27) == b for a, b in ws)
    T = sc.window_targets()
    assert (~np.isnan(T.y["left_out"])).sum() == 163666 and int(T.small[~np.isnan(T.y["left_out"])].sum()) == 36588
    assert len(T.y["counted"]) == 182367


def test_first_isolates_match_counting(dataset):
    records, _ = dataset
    first_day = min(r.sample_date for r in records)
    for start in ("2025-03-01", "2026-01-15"):
        view = sc.View(start)
        hi = add_days(start, -1)
        for days in (28, 365, None):
            lo = first_day if days is None else add_days(start, -days)
            expected = [r.isolate_id for r in first_isolates([r for r in records if lo <= r.sample_date <= hi], (lo, hi))]
            assert view.first_isolates(days)["isolate_id"].tolist() == expected, (start, days)
            assert view.first_cells(days)["isolate_id"].drop_duplicates().tolist() == expected, (start, days)
        # only records dated before the first target day are visible
        assert view.isolates["date"].max() < start and view.cells["date"].max() < start and view.records[-1].sample_date < start
    # a window of the middle of the data, by dates
    ids = sc.first_isolate_cells("2025-02-03", "2025-03-02")["isolate_id"].drop_duplicates().tolist()
    assert ids == [r.isolate_id for r in first_isolates(records, ("2025-02-03", "2025-03-02"))]


def test_outcome_conventions(dataset):
    c = sc.cells()
    yl, yc, ys = c["y_left_out"].to_numpy(), c["y_counted"].to_numpy(), c["y_spectrum"].to_numpy()
    basis, result = c["basis"].astype(str).to_numpy(), c["result"].astype(object).to_numpy()
    sel = basis == "untested"
    assert sel.any() and np.isnan(yl[sel]).all() and (yc[sel] == 0).all() and np.isnan(ys[sel]).all()
    sel = basis == "no-breakpoint"
    assert sel.any() and (yl[sel] == 0).all() and (yc[sel] == 0).all() and np.isnan(ys[sel]).all()
    sel = basis == "intrinsic"
    assert sel.any() and (yl[sel] == 0).all() and (yc[sel] == 0).all() and (ys[sel] == 0).all()
    for res, y in (("S", 1.0), ("R", 0.0)):
        sel = np.isin(basis, ["tested", "inferred"]) & (result == res)
        assert sel.any() and (yl[sel] == y).all() and (yc[sel] == y).all() and (ys[sel] == y).all()
    # the same as the effective result of the records, for a sample of isolates
    records, _ = dataset
    by_id = {r.isolate_id: r for r in records}
    sample = c.iloc[::997]
    for row in sample.itertuples():
        e = effective_result(by_id[row.isolate_id], row.antibiotic)
        assert e.basis == row.basis and (e.result == "S") == (row.y_counted == 1.0)
    # the cefoxitin screen is never a cell
    assert "FOX" not in set(c["antibiotic"].astype(str))
    assert len(c) == sum(1 for r in records for a in sc.ANTIBIOTICS if suits_specimen(a, r.specimen))


def test_cells_carry_what_an_estimator_may_condition_on(dataset):
    c = sc.cells()
    for col in ("isolate_id", "patient_id", "date", "ward", "ward_type", "specimen", "organism", "sex", "age_years", "hospital_onset", "inpatient",
                "phenotypes", "esbl", "mrsa", "vre", "cpe", "antibiotic", "y_left_out", "y_counted", "y_spectrum"):  # fmt: skip
        assert col in c.columns, col
    assert set(c["ward_type"].astype(str)) == {"in", "out"}
    assert (c["inpatient"] == c["ward"].isin(["MED-A", "MED-B", "SURG", "URO", "ICU", "GER"])).all()
    # onset as aei.dataset.join_isolates defines it: two or more days between admission and sample
    records, _ = dataset
    by_id = {r.isolate_id: r for r in records}
    for row in c.iloc[::1499].itertuples():
        r = by_id[row.isolate_id]
        assert row.hospital_onset == (r.admission_date is not None and days_between(r.admission_date, r.sample_date) >= 2)
        assert row.phenotypes == r.phenotypes and row.sex == r.sex and row.age_years == r.age_years and row.patient_id == r.patient_id
    assert c["hospital_onset"].any() and not c["hospital_onset"].all()
    target = sc.View("2025-01-01", end="2025-01-28").target
    assert target is not None and "organism" not in target.columns and len(target) > 100


def test_first_cells_and_counts_agree(dataset):
    view = sc.view_as_of("2025-06-30")
    for convention in ("left_out", "counted", "spectrum"):
        for level in ("unit", "hospital"):
            k, n = view.counts(365, convention, level)
            k2, n2 = sc.cell_counts(view.first_cells(365), convention, level)
            assert (k == k2).all() and (n == n2).all()
    # the hospital level adds the units: the same figure for the same specimen and antibiotic in every unit
    k, n = view.counts(365, "left_out", "hospital")
    cid = sc.cell_id
    assert n[cid("ED", "urine", "AMP")] == n[cid("ICU", "urine", "AMP")] > 1000


# --- helpers ----------------------------------------------------------------------------------------------------------------------


def test_bootstrap_draws_are_0004s():
    idx = sc.boot_indices(26)
    assert idx.shape == (1000, 26)
    rand = mulberry32(2026)
    assert idx[0].tolist() == [math.floor(rand() * 26) for _ in range(26)]
    assert idx[1].tolist() == [math.floor(rand() * 26) for _ in range(26)]  # one stream across resamples
    assert sc.boot_indices(24).shape == (1000, 24) and sc.boot_indices(24)[0, 0] == math.floor(mulberry32(2026)() * 24)


def test_quantile_is_0004s_floor_rule():
    xs = np.arange(1000, dtype=float)[::-1]
    assert sc.quantile(xs, 0.025) == 24 and sc.quantile(xs, 0.975) == 974
    assert sc.quantile(np.array([np.nan, 3.0, 1.0, 2.0]), 0.5) == 2.0  # NaN resamples dropped


def test_fit_logit_matches_statsmodels():
    import statsmodels.api as sm

    rng = np.random.default_rng(1)
    x = rng.normal(0, 1.5, 4000)
    y = (rng.random(4000) < 1 / (1 + np.exp(-(0.3 + 0.8 * x)))).astype(float)
    fit = sm.Logit(y, sm.add_constant(x)).fit(disp=0)
    xs, inv = np.unique(np.round(x, 1), return_inverse=True)  # group by the rounded value
    n = np.bincount(inv).astype(float)
    n1 = np.bincount(inv, weights=y)
    b0, b1 = sc.fit_logit(xs, n1, n)
    fit_g = sm.GLM(np.column_stack([n1, n - n1]), sm.add_constant(xs), family=sm.families.Binomial()).fit()
    assert (b0, b1) == pytest.approx(tuple(fit_g.params), abs=1e-7)
    assert b1 == pytest.approx(fit.params[1], abs=0.05)  # rounding x to one decimal moves it slightly
    # multiplicities are weights
    b0w, b1w = sc.fit_logit(xs, n1, n, weights=np.full(len(xs), 3.0))
    assert (b0w, b1w) == pytest.approx((b0, b1), abs=1e-9)


def test_mid_pit_gives_the_nominal_predictive_coverage():
    rng = np.random.default_rng(7)

    def inside(a: float, b: float, n: int, ka: float | None = None, kb: float | None = None) -> float:
        """Share of draws from Beta-binomial(n, a, b) that fall inside the 90 % band of the mid-p PIT under (ka, kb)."""
        k = stats.betabinom.rvs(n, a, b, size=40000, random_state=rng)
        u = sc.mid_pit(k, np.full(k.shape, n), np.full(k.shape, ka or a), np.full(k.shape, kb or b))
        return float(((u >= 0.05) & (u <= 0.95)).mean())

    assert inside(8, 8, 40) == pytest.approx(0.90, abs=0.015)  # a spread-out count: nominal
    assert inside(6, 1.5, 25) <= 0.91  # a lumpy one (atoms of several per cent): the mid-p reading never inflates coverage
    # u is uniform in mean: the PIT of a correct model averages 0.5
    k = stats.betabinom.rvs(25, 6, 1.5, size=40000, random_state=rng)
    assert sc.mid_pit(k, np.full(k.shape, 25), np.full(k.shape, 6.0), np.full(k.shape, 1.5)).mean() == pytest.approx(0.5, abs=0.01)
    # a method that is too sure is caught: the same draws against a much narrower Beta with the same mean
    nu = (8 + 8) * 20
    assert inside(8, 8, 40, 0.5 * nu, 0.5 * nu) < 0.75  # binomial noise alone keeps some of the coverage
    # and one that is too vague is not rewarded
    assert inside(8, 8, 40, 0.5 * 2, 0.5 * 2) > 0.97


def test_beta_from_interval_keeps_mean_and_width():
    lo, hi = cl.wilson(80, 100, 1.644854)
    a, b = sc.beta_from_interval(np.array([0.8]), np.array([lo]), np.array([hi]), 1.644854)
    assert a[0] / (a[0] + b[0]) == pytest.approx(0.8)
    sd = math.sqrt(a[0] * b[0] / ((a[0] + b[0]) ** 2 * (a[0] + b[0] + 1)))
    assert sd == pytest.approx((hi - lo) / (2 * 1.644854), rel=1e-9)
    # not finite where there is no estimate; finite and positive at the edges
    a, b = sc.beta_from_interval(np.array([1.0, 0.0, np.nan]), np.array([0.9, 0.0, 0.1]), np.array([1.0, 0.1, 0.9]), 1.644854)
    assert np.isfinite(a[:2]).all() and (a[:2] > 0).all() and (b[:2] > 0).all() and np.isnan(a[2])


# --- custom estimators ------------------------------------------------------------------------------------------------------------


def test_an_estimator_without_intervals_scores_c1_but_not_the_list_metrics(dataset):
    def p_only(view, convention):
        return sc.hospital_365.predict(view, convention)[["ward", "specimen", "antibiotic", "p"]]

    metrics, intervals, n = sc.score_estimator(p_only, with_c6=True, verbose=False)
    assert metrics["C1"]["all"] == pytest.approx(0.1414, abs=5e-5) and metrics["C1_diff"]["all"] == 0
    assert "C3a" in metrics and "C5" in metrics and set(metrics["C8"]) == {"C1", "C1_diff"}
    for absent in ("C3b", "C4", "C6", "C7", "C3b_bb", "C7_lower_bound"):
        assert absent not in metrics, absent


def test_an_estimator_that_only_knows_left_out_leaves_out_what_needs_the_rest(dataset):
    def left_out_only(view, convention):
        if convention != "left_out":
            raise NotImplementedError(convention)
        return sc.hospital_365.predict(view, convention)

    metrics, _, _ = sc.score_estimator(left_out_only, verbose=False, with_c6=False)
    assert set(metrics["C1"]) == {"all", "small"} and "C7" in metrics
    assert set(metrics["C4"]) == {"severe", "severe_counted"}  # mild needs the spectrum convention
    assert "C3b" not in metrics


def test_an_isolate_level_estimator_is_scored_on_c1(dataset):
    def per_isolate(view, convention):
        base = sc.hospital_365.predict(view, convention)[["ward", "specimen", "antibiotic", "p"]]
        t = view.target[["isolate_id", "ward", "specimen"]].astype({"ward": str, "specimen": str})
        out = t.merge(base.astype({"ward": str, "specimen": str, "antibiotic": str}), on=["ward", "specimen"])
        return out[["isolate_id", "antibiotic", "p"]]

    metrics, _, n = sc.score_estimator(per_isolate, verbose=False)
    assert metrics["C1"]["all"] == pytest.approx(0.1414, abs=5e-5) and metrics["C1_diff"]["all"] == pytest.approx(0, abs=1e-12)
    assert "C4" not in metrics and "C7" not in metrics and "C6" not in metrics
    assert n["C1"]["fallback"] == 0


def test_a_missing_estimate_scores_the_baseline(dataset):
    def nan_for_ed(view, convention):
        out = sc.hospital_365.predict(view, convention)[["ward", "specimen", "antibiotic", "p"]].copy()
        out.loc[out["ward"] == "ED", "p"] = math.nan
        return out

    metrics, _, n = sc.score_estimator(nan_for_ed, verbose=False, with_c6=False)
    assert n["C1"]["fallback"] > 10000 and metrics["C1_diff"]["all"] == 0  # ED's cells took the baseline's p, so nothing moved


def test_c6_counts_days_until_the_90_percent_interval_excludes_the_day_before_onset(dataset):
    """A made-up estimator that moves from 0.5 to 0.9 (narrow 90 % interval) on the day it first sees records of the
    seventh day from onset: the event is reached on day 7."""
    switch = {"E1": add_days("2025-05-30", 7), "E2": add_days("2026-03-03", 7)}

    class Step:
        name = "step"

        def predict(self, view, convention):
            moved = view.as_of >= switch["E1"] if view.as_of < "2026-01-01" else view.as_of >= switch["E2"]
            p = 0.9 if moved else 0.5
            return view.grid[["ward", "specimen", "antibiotic"]].assign(p=p, lo90=p - 0.05, hi90=p + 0.05)

    assert sc.c6(Step()) == {"E1_CRO": 7, "E1_CXM": 7, "E2_CXM": 7}

    class Never(Step):
        def predict(self, view, convention):
            return view.grid[["ward", "specimen", "antibiotic"]].assign(p=0.5, lo90=0.45, hi90=0.55)

    assert sc.c6(Never()) == {"E1_CRO": None, "E1_CXM": None, "E2_CXM": None}  # not reached within 120 days
    assert sc.c6(lambda view, convention: sc.hospital_365.predict(view, convention).drop(columns=["lo90", "hi90", "a", "b"])) == {}


def test_c6_events_and_baselines(scored):
    assert sc.e2_specimen() == "wound"  # most ICU MRSA in March 2026
    shipped = scored["shipped"][0]["C6"]
    assert set(shipped) == {"E1_CRO", "E1_CXM", "E2_CXM"} and all(v is None or 0 <= v <= 120 for v in shipped.values())
    assert shipped["E1_CRO"] == 47 and shipped["E1_CXM"] is None and shipped["E2_CXM"] is None  # measured; regression
    hospital = scored["hospital_365"][0]["C6"]
    assert all(v is None for v in hospital.values())  # the 365-day hospital estimate does not react
    series = sc.c6_series(sc.hospital_365, "E1")
    assert series["date"].min() == "2025-04-01" and series["date"].max() == "2025-09-30" and len(series) == 183 * 2
