"""Detection baseline rows of the overnight run (harness-spec.md): the live set as shipped (D-020, D-021, D-022, D-031,
D-034) and the live set re-tuned on year 1 (Choices 5), each scored on D1 to D7 and I1 by `aei.score_detection`.
Writes, next to this file,

    live-set-shipped.json, live-set-retuned-year1.json

in METRICS.md's schema. Screening keys come from seed 2026 with 200 trials per cell (one mulberry32(2026) stream, cells
in a fixed order); the `_heldout` keys (D2_heldout, D2_heldout_delay, D3_heldout, D3_heldout_delay, D5_heldout) from the
held-out seeds 2027 to 2030 at 50 trials per seed, so a winner can be compared like for like (`score_detection.confirm`).
Run from the repository root:

    uv run python benchmarks/overnight-2026-10-17/baselines/detection.py
"""

from __future__ import annotations

from pathlib import Path

from aei import harness, score_detection as sd

HERE = Path(__file__).resolve().parent

SHIPPED_NOTES = (
    "The live set exactly as shipped: profile excess within specimen (alpha 1e-4), phenotype excess (alpha 1e-3), sampling drop "
    "(1e-4), empty run (1e-3), rising trend over 22 pairs (1e-3, D-022 exclusion), and new in an inpatient unit for MRSA and VRE "
    "(180 days, D-021 as revised by D-034). Tuned on test: D-020 and D-031 chose their alphas on experiments 0002 and 0009, which "
    "ran over all three years and picked the setting by delay on E1 to E4, all inside the scoring period; D-021's 180 days were "
    "chosen on E2. Level = 1 (the shipped alphas) reads D1, D2, D3, D4, D6, D7 and I1; D5 sweeps the cluster alphas by m in "
    "{100, 30, 10, 3, 1, 0.3, 0.1, 0.03, 0.01}, and its headline is the loosest level with at most 5 cluster and sentinel "
    "episodes a year (Choices 3). D2 counts a new-in-unit sentinel as a detection of an injected MRSA clone in an inpatient unit; "
    "extra.D2_cluster_signals_only gives the rates over cluster signals alone, which is what experiments 0007 and 0011 counted. "
    "D4 is episodes a year over 2024-10-01 to 2026-09-27 with the fixed key and the exclusion zones of Choices 4. I1 counts the "
    "detector alerts and new-in-unit alerts; extra.I1_full_tool adds the CPE finds the tool also pushes (D-014). Injected "
    "trials run the detectors on the unit and period around the event (the `focus` hint); profile excess is computed for the "
    "source's organism and specimen only (0007's rule), which differs from a run on all the data in about 1 of 60 trials "
    "(a background signal of another specimen of the same organism in the same unit and weeks). Seed 2026 screening, seeds "
    "2027 to 2030 held out for the _heldout keys; nothing was chosen on either."
)

RETUNED_NOTES = (
    "The live set with its cluster and data alphas re-tuned on year 1 (2023-10-02 to 2024-09-30) by 0002's procedure on "
    "injected events (Choices 5: per detector the alpha with the fewest other episodes among those detecting at least 80 % "
    "of 40 injected events from 2024-04-01 to 2024-08-15, else the one detecting most; the table is in the extra field "
    "`retune_table`). The detectors saw no data after 2024-09-30 while tuning. PARTLY tuned on test: the rising-trend test "
    "(alpha 0.001, 28-day bins, D-022 exclusion; its 24-month window cannot be tuned on year 1) and new-in-unit (180 days, "
    "chosen on E2) keep their shipped settings, which were chosen on E4 and E2 inside the scoring period (field "
    "`partly_tuned_on_test`). `tuned_on_test` is false for the cluster and data parts and the row is the reference that new "
    "methods are compared against. Read as the shipped row's notes, with level = 1 meaning the re-tuned alphas. "
    "Caveat (harness review, finding 13): the two cluster detectors use 365-day baselines, and at the injected events' dates in "
    "year 1 the baseline holds only 165 to 320 days, so the same excess has a larger p-value there. The cluster alphas were "
    "therefore chosen on those shorter baselines, with a per-detector 80 % bar that is stricter than 0002's one event per "
    "detector; the shipped alphas miss that bar here (profile 1e-4: 29 of 40, phenotype 1e-3: 20 of 40), and where no alpha "
    "reaches it the fallback takes the one detecting most (phenotype: 31 of 40 at 1e-2). The procedure lands one grid step "
    "looser than shipped on both (profile 1e-3 against 1e-4, phenotype 1e-2 against 1e-3), so on the scoring period this "
    "row's operating point is a noisier one: D4 cluster episodes 4.5 a year against 1.0 for the shipped row, D2 rare k=4 "
    "0.98 against 0.89. No procedure makes year 1 longer (METRICS.md's split table: anything needing a full year of baseline "
    "cannot be tuned on it); compare new methods with this row on D5, which is matched on noise, with D4 beside it."
)


def run_row(name: str, detector: sd.LiveSet, method: str, notes: str, tuned_on_test: bool, tuned_on: str, **extra: object) -> dict:
    clock = harness.Clock()
    records, cultures = harness.data()
    signals = detector.run(records, cultures, None)  # once, for both the screening and the held-out part
    metrics, intervals, n, ex = sd.score_detector(detector, records=records, cultures=cultures, full_signals=signals)
    h_metrics, h_intervals, h_n, h_ex = sd.confirm(detector, records=records, cultures=cultures, full_signals=signals)
    doc = harness.write_metrics(
        HERE / f"{name}.json",
        experiment=f"baseline-{name}",
        method=method,
        family="detection",
        metrics={**metrics, **h_metrics},
        intervals={**intervals, **h_intervals},
        n={**n, **h_n},
        runtime_s=clock.wall,
        cpu_s=clock.cpu,
        seeds=list(sd.SEEDS_SCREEN),
        tuned_on_test=tuned_on_test,
        tuned_on=tuned_on,
        notes=notes,
        **ex,
        **h_ex,
        **extra,
    )
    print(f"{name}: {clock.cpu:.1f} s CPU, {clock.wall:.1f} s wall")
    return doc


def main() -> None:
    records, cultures = harness.data()
    total = harness.Clock()
    run_row(
        "live-set-shipped",
        sd.LiveSet(),
        "The live detector set as shipped (D-020, D-021, D-022, D-031, D-034), scored on D1 to D7 and I1 over 2024-10-01 to 2026-09-27",
        SHIPPED_NOTES,
        True,
        f"{harness.TUNE[0]}..{harness.SCORE[1]} (0002, 0009 on E1 to E4; D-021 on E2)",
    )
    retuned, table = sd.retune_live_set(records, cultures)
    run_row(
        "live-set-retuned-year1",
        retuned,
        "The live detector set with cluster and data alphas re-tuned on year 1 (Choices 5), trend and new-in-unit as shipped",
        RETUNED_NOTES,
        False,
        f"{harness.TUNE[0]}..{harness.TUNE[1]} (cluster and data alphas); trend and new-in-unit as shipped",
        partly_tuned_on_test=["rising-trend", "new-in-unit"],
        retune_table=table,
        retuned_alphas={
            "profile_alpha": retuned.profile_alpha,
            "phenotype_alpha": retuned.phenotype_alpha,
            "sampling_alpha": retuned.sampling_alpha,
            "empty_alpha": retuned.empty_alpha,
            "trend_alpha": retuned.trend_alpha,
            "new_in_unit_days": retuned.new_in_unit_days,
        },
    )
    print(f"baseline script: {total.cpu:.1f} s CPU, {total.wall:.1f} s wall")


if __name__ == "__main__":
    main()
