"""Prediction baseline rows of the overnight run (harness-spec.md): county forecasts by persistence and by seasonal
naive (P2), and the exposure ranking for E1 (P1). Writes, next to this file,

    county-persistence.json, county-seasonal-naive.json, exposure-e1.json

in METRICS.md's schema (metrics, intervals, n, runtime_s, cpu_s). Run from the repository root:

    uv run python benchmarks/overnight-2026-10-17/baselines/prediction.py

Nothing here is fitted, so nothing is tuned on the scoring period (`tuned_on_test` false).
"""

from __future__ import annotations

from pathlib import Path

from aei import harness, score_prediction as sp

HERE = Path(__file__).resolve().parent
NO_FIT = "none (no fitted parameters)"

P2_METHODS = {
    "county-persistence": (
        sp.persistence,
        "County forecast baseline: Poisson at last month's count (floor 0.5), one month ahead, 4 phenotypes x 23 counties + national, targets 2024-10 to 2026-09",
    ),
    "county-seasonal-naive": (
        sp.seasonal_naive,
        "County forecast baseline: Poisson at the same month last year's count (floor 0.5), one month ahead, 4 phenotypes x 23 counties + national, targets 2024-10 to 2026-09",
    ),
}


def run_p2() -> None:
    for name, (forecaster, method) in P2_METHODS.items():
        clock = harness.Clock()
        ev = sp.evaluate(forecaster)
        detail = ev.table().round(6).reset_index().to_dict(orient="records")
        harness.write_metrics(
            HERE / f"{name}.json",
            experiment=f"baseline-{name}",
            method=method,
            family="prediction",
            data="thl-ttr-cases fetched 2026-10-17 by scripts/fetch_thl_ttr.py, months 2021-01 to 2026-09",
            metrics={"P2": ev.metrics},
            intervals={"P2": ev.intervals},
            n={"P2": ev.n},
            runtime_s=clock.wall,
            cpu_s=clock.cpu,
            seeds=[2026],
            tuned_on_test=False,
            tuned_on=NO_FIT,
            notes=(
                f"THL series as fetched {harness.THL_FETCHED}, final values for every target month, so not strictly as-of; the last two months "
                "(2026-08, 2026-09) are still incomplete at fetch time (see the _no_last2 keys). Skill is against persistence unless named; "
                "a baseline scored against itself has skill 0 by construction. Bootstrap: 1,000 resamples of target months, seed 2026."
            ),
            detail=detail,
        )


def run_p1() -> None:
    records, cultures = harness.data()
    event = sp.EVENTS["E1"]
    clock = harness.Clock()
    res = sp.score_exposure(cultures, records, **event)
    table = res.table.round(4).reset_index().rename(columns={"index": "unit"})
    harness.write_metrics(
        HERE / "exposure-e1.json",
        experiment="baseline-exposure-e1",
        method="Exposure ranking after E1 (ESBL E. coli in URO, onset 2025-05-30): time-ordered patient-flow graph over the 365 days before onset, exposure of the other eight units from URO as share and raw, AUC against units whose ESBL E. coli patients in the 8 weeks from onset exceed their 26-week baseline, 1,000 label-permutation rewirings",
        family="prediction",
        metrics=res.metrics,
        intervals=res.intervals,
        n=res.n,
        runtime_s=clock.wall,
        cpu_s=clock.cpu,
        seeds=[2026],
        tuned_on_test=False,
        tuned_on=NO_FIT,
        notes=(
            "One planted event gives a description, not a claim (METRICS.md P1). No unit other than URO exceeded its baseline at either alpha, "
            "so there is no positive to rank: the AUCs and null p-values are undefined (null), not zero. The supplementary rank correlation "
            "(detail.excess_corr) uses the continuous outcome (observed + 0.5) / expected over the eight units and is not a spec key."
        ),
        detail={"event": event["source"] + " " + event["onset"], "excess_corr": res.excess_corr, "units": table.to_dict(orient="records")},
    )


if __name__ == "__main__":
    run_p2()
    run_p1()
    for p in sorted(HERE.glob("*.json")):
        print(p.name)
