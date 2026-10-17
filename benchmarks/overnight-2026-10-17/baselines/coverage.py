"""Coverage baselines of the overnight run: the hospital-365 estimator and the coverage list as shipped, scored on
benchmarks/METRICS.md section C through `aei.score_coverage` (harness-spec.md), written as `metrics.json` rows:

    benchmarks/overnight-2026-10-17/baselines/coverage-hospital-365.json   (not tuned on test)
    benchmarks/overnight-2026-10-17/baselines/coverage-shipped.json        (tuned on test)

Run from the repository root:
    uv run python benchmarks/overnight-2026-10-17/baselines/coverage.py
"""

from __future__ import annotations

from pathlib import Path

from aei import harness, score_coverage

OUT = Path(__file__).resolve().parent

ROWS = [
    {
        "file": "coverage-hospital-365.json",
        "experiment": "baseline-coverage-hospital-365",
        "estimator": score_coverage.hospital_365,
        "method": "Hospital, same specimen, last 365 days, first isolates per 365-day window (0004's estimator 3, the annual report); "
        "intervals are Jeffreys Beta(k + 0.5, n - k + 0.5) on the hospital cell (a harness choice)",
        "tuned_on_test": False,
        "tuned_on": "none: the annual report's hospital year was the baseline before any scoring (0004)",
        "notes": "METRICS.md C baseline. C4 and C3(b) rank this estimator's shares by the shipped list's rules (aei.coverage_list.suggest_rows) with "
        "the untested gate taken from the shipped level pool; the hospital figure is the same for every unit.",
    },
    {
        "file": "coverage-shipped.json",
        "experiment": "baseline-coverage-shipped",
        "estimator": score_coverage.shipped,
        "method": "The coverage list as shipped (D-023, D-033): unit if its pool has 30 first isolates, else ward type, else hospital; "
        "365 days; Wilson intervals (95 % for C4, z = 1.644854 for 90 %); no estimate with fewer than 30 results (scored with the "
        "baseline's p on C1 to C3(a), C5 and C8)",
        "tuned_on_test": True,
        "tuned_on": "2024-09-30..2026-09-27: D-023 chose the 365-day year from 0004's numbers over the scoring period",
        "notes": "Reproduces 0010 (C4 mild 96.6 % within spectrum, 75.4 % all organisms, severe 95.4 %; C3(b) 0 of 175 and 23 of 269; "
        "959 of 4,285 below the Wilson lower bound, in C7_lower_bound).",
    },
]


def main() -> None:
    for row in ROWS:
        clock = harness.Clock()
        timings: dict = {}
        metrics, intervals, n = score_coverage.score_estimator(row["estimator"], timings=timings)
        doc = harness.write_metrics(
            OUT / row["file"],
            experiment=row["experiment"],
            method=row["method"],
            family="coverage",
            metrics=metrics,
            intervals=intervals,
            n=n,
            runtime_s=clock.wall,
            cpu_s=clock.cpu,
            seeds=[score_coverage.SEED],
            tuned_on_test=row["tuned_on_test"],
            tuned_on=row["tuned_on"],
            notes=row["notes"],
            cpu_by_part_s={k: round(v, 1) for k, v in timings.items()},
        )
        print(f"{row['file']}: C1 {doc['metrics']['C1']['all']}, runtime {doc['runtime_s']} s, CPU {doc['cpu_s']} s")


if __name__ == "__main__":
    main()
