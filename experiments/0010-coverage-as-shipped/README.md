---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent: 0004
---

# 0010 Does the coverage list as shipped deliver the coverage it claims in the following month?

## Goal

0004 chose the estimate (the year, not the last four weeks), but the list
the doctor sees adds rules that were never backtested: one level per
query (unit, else ward type, else hospital, at 30 isolates), the 95 %
Wilson interval, the spectrum basis for mild infections, Access before
Watch, the 80 % and 90 % thresholds, the IV-only and urine-only rules and
the combinations for severe infections (D-023, D-026, D-027, D-028,
D-033). This backtest runs that code (`@aei/coverage` `coverage`,
`suggest`, `suggestCombinations`, exactly as `GET /api/coverage` calls
them) month by month and checks what the next month's patients actually
grew. The answer decides whether the list's "clears" wording can be shown
as it is, and whether its top pick is at least as good as the hospital
antibiogram it would replace.

## Hypothesis

Predictions, stated before the run:

1. **Claims hold.** Pooled over every query-month whose top suggestion
   "clears", the realised next-month coverage of that antibiotic, on the
   basis the list used (within spectrum for mild, all organisms for
   severe), is at least the threshold: 80 % for mild, 90 % for severe.
   Refuted for a severity if its pooled realised share is below its
   threshold.
2. **Calibration.** Among those query-months with at least 10 target
   isolates with a result, the number whose realised share falls below
   the threshold is at most 1.5 times the number expected from binomial
   sampling alone at the predicted share. Refuted if more.
3. **Not worse than the antibiogram.** The top pick's pooled realised
   coverage (on the same basis) is no more than 2 points below the
   baseline's on the same query-months: the lower end of the 95 %
   bootstrap interval of (shipped − baseline) is above −0.02. Refuted
   otherwise.

## Experiment

- Data: the synthetic dataset as received (seed 2026), all units, all
  three specimens, records joined by `@aei/dataset` `joinIsolates` as the
  server does.
- As-of dates: the last day of each month from 2024-09-30 (a full year
  of history) to 2026-08-31; target month = the month after, 2024-10 to
  2026-09 (24 months; September 2026 ends on 2026-09-27).
- Queries: every unit (9) × specimen (3) × severity (mild, severe), no
  sex filter, default window (365 days) and minimum (30), from records
  dated up to the as-of date, as the server does at that clock date.
  Severity is not in the data; both are judged on the same patients.
- Target: the unit's own first isolates (per patient, organism and
  specimen, `@aei/counting`) sampled in the target month, whatever level
  the list fell back to. Realised counts are taken by running `coverage`
  on the target month with the unit as the level (window = the month,
  minimum 1), so they use the same `effectiveResult` rules: untested left
  out, intrinsic resistance counts as not covered, no-breakpoint left out
  within spectrum (mild) and counted as not covered over all organisms
  (severe). The realised all-organism share of the mild pick is also
  reported, since a mild infection can be caused by an organism outside
  the pick's spectrum.
- Top pick: the first entry of `suggest(result, severity)`. Metric 1
  pools covered / known over query-months whose top pick "clears";
  reported also for "borderline" and per specimen.
- Calibration (metric 2): for each query-month in metric 1 with known
  ≥ 10, P(realised < threshold) under Binomial(known, predicted share);
  the sum is the expected number of misses, compared with the observed.
  Also: share of all (query-month, antibiotic) cells whose realised
  share falls below the Wilson lower bound, against the same binomial
  expectation.
- Baseline (metric 3): the hospital antibiogram as the annual report
  gives it: same specimen, hospital level, last 365 days, all organisms;
  the antibiotic with the highest share among the ones the list may
  suggest for that severity (mild: IV-only removed). It differs from the
  shipped list in level choice, interval-based ordering, Access first
  and the spectrum basis. Reported per severity: pooled realised share
  (shipped basis, and all organisms), the share of Access picks, and the
  difference shipped − baseline with a 95 % interval from 1,000
  bootstrap resamples of target months (seed 2026, numpy).
- Combinations (severe): when `suggestCombinations` returns pairs, the
  first pair's realised share (either antibiotic covers) against 90 %.
- Also reported: levels used, how often nothing clears, the spread of
  monthly realised shares (min, median, max). Sensitivity: results
  without the planted Urology ESBL outbreak (URO, 2025-06 and 2025-07)
  and ICU MRSA cluster (ICU, 2026-02 and 2026-03) query-months (0001).
- Code: `backtest.ts` here runs the shipped TypeScript and writes
  `out/rows.json` (one row per query-month and antibiotic);
  `analysis.py` here computes the metrics into `out/results.md`.
  `node experiments/0010-coverage-as-shipped/backtest.ts && uv run python
  experiments/0010-coverage-as-shipped/analysis.py`. Budget: under a
  minute of CPU on a laptop; if more, stop and report.

## Result

## Interpretation
