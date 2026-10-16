---
status: accepted    # proposed, then accepted, rejected or superseded
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

`node experiments/0010-coverage-as-shipped/backtest.ts && uv run python
experiments/0010-coverage-as-shipped/analysis.py` (10 s and 5 s on a
laptop) writes `out/results.md`; `out/rows.json` (2.5 MB, one row per
query-month and antibiotic) is regenerated, not committed. 24 target
months, 529 unit × specimen × month queries with target isolates (each
judged mild and severe), 16,139 target first isolates. Realised shares are
measured on the dataset; predicted shares, intervals and bootstrap
intervals computed; deterministic (bootstrap seed 2026, 1,000 resamples of
target months).

1. **Claims hold on the list's own basis.** Top pick "clears": mild 218
   query-months, predicted 95.8 % on average, realised 96.6 % within
   spectrum (9,866 isolates; monthly 95.2 / 96.2 / 98.1 % min / median /
   max); severe 327 query-months, predicted 95.6 %, realised 95.4 %
   (14,473 isolates; monthly 93.6 / 95.6 / 96.8 %). Both above their
   thresholds (80 %, 90 %). Mild clears is almost only urinary mecillinam
   (214 of 218; ciprofloxacin also cleared in 204 of those but is Watch,
   so mecillinam came first as designed); severe clears is
   piperacillin-tazobactam (all 327 but 5).
   **But the mild pick covers far less of what actually grows:** over all
   organisms the realised share of mild "clears" picks is 77.4 %, below
   80 % (urinary mecillinam misses the organisms it has no breakpoint for).
   Over all mild top picks it is 75.4 %: urine 77.4 %, blood 73.9 %,
   wound 68.2 % (cefuroxime in blood and wound).
2. **Calibration holds.** Query-months with ≥ 10 target isolates whose
   realised share fell below the threshold: mild 0 of 175 (0.3 expected
   from binomial sampling at the predicted share), severe 23 of 269
   (19.6 expected, ratio 1.17, within the 1.5 allowed). Every antibiotic
   with an interval: 959 of 4,285 cells realised below the Wilson lower
   bound against 1,079 expected (0.89; the bounds are slightly
   conservative).
3. **Against the hospital antibiogram (on the planned metric):** severe:
   the same pick in 94 % of query-months, shipped − baseline −0.1 points
   (−0.1 to −0.0): not worse. **Mild: refuted,** shipped 88.9 % against
   91.6 %, −2.7 points (−3.6 to −1.9). The baseline picks ciprofloxacin
   (Watch) everywhere for mild; the list picks mecillinam for urine and
   cefuroxime for blood and wound (41 % Access against 0 %).
   That metric favours the baseline: ciprofloxacin has a result for only
   85 % of urinary, 60 % of blood and 46 % of wound target isolates, and
   untested isolates are left out of its realised share. Dividing by
   every target isolate instead (untested as not covered), mild shipped
   75.4 % against baseline 69.7 %; severe 93.7 % against 93.9 %.
4. Context: blood fell back to the ward type in 49 of 145 unit-months;
   urine and wound always had the unit. No single antibiotic clears in
   58.8 % of mild and 38.2 % of severe query-months. When none clears for
   severe, the first pair (191 query-months) is meropenem + vancomycin in
   144; pairs that clear realised 99.3 % against 99.6 % predicted (1,216
   isolates). Without the planted outbreak months (URO 2025-06/07, ICU
   2026-02/03) every figure moves by at most 0.3 points (mild − baseline
   −2.9, −3.6 to −2.2).

Deviations from plan: the "untested as not covered" columns in table 3
and the tested shares of the baseline's ciprofloxacin were added after the
first run, once the planned metric turned out to leave out up to half of
the baseline's isolates. The planned metric and its verdict are reported
unchanged. The month loop in `backtest.ts` was rewritten for the linter
after the first run; the output was byte-identical.

## Interpretation

Hypotheses 1 and 2 hold: when the list says an antibiotic clears, the next
month's patients bear it out on the list's own terms, and the interval is
honest (if anything cautious). Hypothesis 3 holds for severe infections
and is refuted for mild ones as planned, by 2.7 points against the
antibiogram's ciprofloxacin. That loss buys Access drugs (mecillinam) in
41 % of mild picks, and it reverses when untested isolates count against
ciprofloxacin, so the comparison does not show the antibiogram is better;
it shows the two are close and the answer turns on how untested results
are counted.

The finding that matters for the tool is the gap between the mild basis
and reality: "clears 80 %" for a mild infection is a statement about the
organisms the drug is meant for (D-027), and the patients' actual
organisms were covered 77 % of the time by the clearing pick and 68–74 %
for blood and wound picks. A doctor reading "clears" will take it as
"covers four in five patients" unless the all-organism share beside it
(D-033) is prominent. Options for the team: show the all-organism share
as the headline for mild too; or judge mild on all organisms, which would
make the list's mild suggestions match the baseline's broader drugs.
Mild blood is not a real clinical query; the doctor view could offer only
severe for blood.

Two shipped behaviours to review: for severe infections Access never
leads (no Access drug clears 90 %), and the combination order puts
coverage before Access, so the first pair is usually meropenem +
vancomycin, two reserve-type Watch drugs, where a narrower pair might
also clear.

Strongest alternative explanation: synthetic data. The generator gives
units little lasting difference (0004), so the list's level choice and
interval have little to beat; real data may reward or punish them more.
The realised counts share the dataset's testing patterns (untested left
out), so "realised" here inherits the same blind spots as "predicted".
Next: per-antibiotic realised coverage of the mild list over all
organisms with the organism mix shown, and the combination order with
Access before coverage among pairs that clear.
