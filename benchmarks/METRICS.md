# Metrics

How every method is scored, so experiments can be compared on one table.
Proposed by Artem on 2026-10-17 for the overnight runs; becomes a
DECISIONS.md entry when the team accepts it. OBJECTIVES.md says why these
and not others; ENGINE.md says what is being scored.

## Protocol that every metric assumes

- **Strict as-of.** A prediction or alert for day t uses only rows with
  sample date ≤ t (D-005: results arrive on their sample date). This
  includes the first-isolate rule and every baseline.
- **Split.** Tuning on data up to 2024-09-30 (the first year). Scoring on
  2024-10-01 to 2026-09-27. A method tuned on the scoring period says so
  and is marked `tuned-on-test` in the table.
- **Data.** `synthetic_microbiology_dataset`, seed 2026, as received
  2026-10-09; THL series as fetched by `scripts/fetch_thl_ttr.py` with
  the fetch date recorded.
- **Spread.** Anything with randomness reports the seed and, where it
  matters, a bootstrap or repeated-run interval. A difference smaller
  than the interval is not claimed (PROTOCOL.md).
- **Baselines** are fixed and named below; every metric is reported as a
  value and as a difference to its baseline with an interval.

## D. Detection: does it see the signal

| ID | Metric | Definition | Baseline (live set, D-020 to D-034) |
|---|---|---|---|
| D1 | Planted events found | For E1 to E4 (benchmarks/planted-events): found yes/no, delay in days from onset to first alert | E1 0 d, E2 4 d, E3 3 d, E4 first signal 2025-09-28 (experiments/0002) |
| D2 | Injected cluster sensitivity | Detection rate with 95 % Wilson interval for k ∈ {2, 3, 4, 6} patients sharing one rare resistant profile within 14 days, 40 trials each, seed 2026, as experiments/0007; for common profiles as 0011; and for clusters split across two units linked by patient flow (new) | rare: 5/40, 22/40, 38/40, 40/40; common 4-patient: 1/180 (0011) |
| D3 | Injected gap sensitivity | Detection rate for d ∈ {2, 3, 5, 7} silent days and a halved week, as 0007 and 0009 | 3 d 93 % with the empty-run rule (0009) |
| D4 | Noise | Other signal episodes per year over the whole scoring period at the same thresholds (episode = same key within 28 days), as 0002; and alerts per week | about 5 episodes a year (0002), 21 alerts / 18 incidents from the demo start (D-034) |
| D5 | Sensitivity against noise | D2's 4-patient rate plotted against D4 across the method's threshold range; reported as the rate at 5 episodes a year | 95 % at 5 a year |
| D6 | Attribution | E3 and injected gaps raised as data problems, not resistance; resistance alerts in that unit-week suppressed or annotated | yes (sampling drop and empty-run rules) |
| D7 | Named right | Share of planted and injected events whose kind (sentinel, cluster, trend, divergence, data) matches the injection | not measured yet |

## C. Coverage: is the doctor's number right

Target: every first isolate in the next 28 days, per unit × specimen ×
antibiotic, covered if the effective result is S (intrinsic and
no-breakpoint count as not covered, untested left out), as experiments/0004.

| ID | Metric | Definition | Baseline |
|---|---|---|---|
| C1 | Brier | Mean squared error of the predicted share against the outcome, all cells and cells with under 30 isolates in the unit's 28 days; 95 % bootstrap over target windows | hospital, same specimen, last 365 days: 0.1414 all, 0.1605 small cells (0004) |
| C2 | Log loss | As C1 with log loss, p clipped to [0.001, 0.999] | 0004 |
| C3 | Calibration | Slope and intercept of logit(outcome rate) on logit(prediction); misses below the stated interval against the Beta-binomial expectation, as 0010 metric 2 | shipped list: 0 of 175 mild, 23 of 269 severe (0010) |
| C4 | Realised top-pick coverage | Pooled next-month coverage of the first suggestion, within spectrum and over all organisms, mild and severe, as 0010 | mild 96.6 % in spectrum, 75.4 % all organisms; severe 95.4 % (0010) |
| C5 | Per-pair Brier | C1 broken down by organism × antibiotic, so pairs where units differ are visible | not reported yet |
| C6 | Responsiveness | Days from the onset of E1 until the unit's cephalosporin coverage estimate's 90 % interval excludes its pre-onset value; same for E2 and MRSA | not measured yet; the 365-day estimate is expected to be slow |
| C7 | Interval honesty | Share of 90 % intervals that contain the realised share over blocks of 20 or more isolates | 0010: 959 of 4,285 below the Wilson lower bound against 1,079 expected |

## P. Prediction: where it goes next

| ID | Metric | Definition | Baseline |
|---|---|---|---|
| P1 | Exposure ranking | After E1's onset, rank the other eight units by exposure from Urology (ENGINE.md 4); AUC of that ranking for "ESBL *E. coli* appeared in the unit within 8 weeks", against the distribution of AUCs from 1,000 degree-preserving rewirings | chance 0.5 |
| P2 | County forecast skill | One-month-ahead forecast of each THL series (4 phenotypes × 23 counties) for the last 24 complete months; mean absolute error and log score of the predictive distribution; skill = 1 − score / score of persistence | persistence ("next month = this month") and seasonal naive (same month last year) |
| P3 | Regional signal timeliness | For the 10 signals of experiments/0008, months between the method's first signal and 0008's | 0008 |

## I. Interpretation and presentation

| ID | Metric | Definition |
|---|---|---|
| I1 | Incident grouping | Alerts per incident over the scoring period (D-034); lower is better at equal D1 to D3 |
| I2 | Explanation faithfulness | Share of template or model explanations whose every number matches a field of the alert (D-019 check) |
| V1 | Visualisation rubric | For each method's proposed picture: readable in 5 seconds, shows the count behind the number, shows uncertainty, works in light mode at AA contrast, bilingual labels possible. Scored 0 to 5 by the reviewer |

## U. Usability: can people find and use it (the design run)

Checked by an agent against the running app, no human needed.

| ID | Metric | Target |
|---|---|---|
| U1 | Clicks and seconds from opening the app to the doctor's list for a named context (unit, site, sex, age, onset) | ≤ 3 clicks, ≤ 10 s on a laptop, ≤ 15 s on a phone profile |
| U2 | Clicks from the signal feed to the isolates behind an alert | 1 |
| U3 | Every number on screen carries its count and its date within one glance | yes/no per view, all yes |
| U4 | Lighthouse accessibility score; WCAG AA contrast; S/R and alert state never by colour alone | ≥ 95; pass; pass |
| U5 | Finnish and English both complete | 0 missing keys, checked over the i18n table |
| U6 | Time to first meaningful content, 4G phone profile | ≤ 2.5 s |
| U7 | The replay timeline: scrub, play, pause, jump to a date, and every panel shows the as-of date it reflects | all present |

## Decision rules (Artem, 2026-10-17)

- **Split:** tune on data up to 2024-09-30, score on 2024-10-01 to
  2026-09-27. Anything tuned on the scoring period is flagged and ranks
  below untuned methods.
- **Replacing the shipped coverage estimate (D-023/D-033):** only a
  method that is not worse on C1 within its interval and clearly better
  on C6, with C3 and C7 passing.
- **Live detector thresholds:** the overnight run proposes, it does not
  change. The live set changes after Artem reads the table.
- **Headline numbers:** detection D5 at 5 episodes a year; coverage C1
  and C6; prediction P2 skill; usability U1 and U2.

## Reporting format

Each experiment writes `out/metrics.json`:

```json
{
  "experiment": "0012-slug",
  "method": "one line",
  "family": "detection | coverage | prediction | interpretation",
  "tuned_on_test": false,
  "metrics": { "D1": {"E1": 0, "E2": 4, "E3": 3, "E4": "2025-09-28"}, "D4": 5.1, "C1": {"all": 0.1414, "small": 0.1605} },
  "intervals": { "C1": {"all": [0.1409, 0.1420]} },
  "runtime_s": 42,
  "seed": 2026
}
```

`benchmarks/overnight-2026-10-17/leaderboard.py` collects every
`out/metrics.json` into one table, best per metric marked, baselines as
the first rows.
