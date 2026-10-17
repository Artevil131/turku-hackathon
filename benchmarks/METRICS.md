# Metrics

How every method is scored, so experiments can be compared on one table.
Proposed by Artem on 2026-10-17 for the overnight runs; becomes a
DECISIONS.md entry when the team accepts it. OBJECTIVES.md says why these
and not others; ENGINE.md says what is being scored.

Revised the same day after a critical review (Claude Code, operated by
Artem). Numbers introduced by the revision that the team has not yet
chosen are marked *proposed*; they are open until accepted, like the
rest of this file. Metric IDs are unchanged so the overnight briefs still
refer to the right rows.

## Protocol that every metric assumes

- **Strict as-of.** A prediction or alert for day t uses only rows with
  sample date ≤ t (D-005: results arrive on their sample date). This
  includes the first-isolate rule and every baseline. Because results
  arrive on their sample date, every delay here understates a real
  deployment's delay by the laboratory turnaround (assumed 2 to 3 days for
  a culture, not in the data); the pitch says so.
- **Split.** Scoring on 2024-10-01 to 2026-09-27. Tuning on data up to
  2024-09-30, with what that first year can support stated per family:

  | Family | What year 1 can tune | What it cannot |
  |---|---|---|
  | Cluster, profile, phenotype excess | about 6 months after the 26-week baseline and 4-week guard band fill | anything needing a full year of baseline |
  | Sampling drop, empty run | the whole year | — |
  | Trend (24-month window) | nothing; its window does not fit | must use injected trends on year 1 or be marked `tuned-on-test` |
  | Coverage estimators | the whole year as targets, with a shorter lookback for the first months | — |

- **Tuned on test, defined.** A method is `tuned-on-test` if any
  threshold, alpha, window or detector choice was set after looking at a
  number computed on the scoring period. Such a method is reported, but
  ranks below untuned methods.
- **The live set is tuned on test.** D-020, D-021 and D-031 chose
  detectors and alphas from experiments 0002 and 0009, which ran over all
  three years and picked settings by their delay on E1 to E4, all of
  which fall in the scoring period. The live set therefore appears twice
  in the table: as shipped (`tuned-on-test`), and re-tuned on year 1 only
  by the same procedure. The re-tuned row is the reference that new
  methods are compared against.
- **Data.** `synthetic_microbiology_dataset`, seed 2026, as received
  2026-10-09; THL series as fetched by `scripts/fetch_thl_ttr.py` with
  the fetch date recorded.
- **Spread.** Anything with randomness reports the seed and, where it
  matters, a bootstrap or repeated-run interval. A difference smaller
  than the interval is not claimed (PROTOCOL.md).
- **Baselines** are fixed and named below; every metric is reported as a
  value and as a difference to its baseline with an interval, and with
  the n it rests on.

## D. Detection: does it see the signal

The honest statement of detection quality is D2 and D3 against D4,
summarised in D5. D1 is a demonstration: the four planted events were
found by inspection and every live detector was chosen to find them, so
D1 cannot rank methods.

**Candidate events.** Episodes that look like more than noise but are not
on the planted list (0002: PIP/TZP-only *E. coli* and ESBL at PHC-S,
ampicillin-trimethoprim *E. coli* in MED-A, and any later ones) are kept
on a quarantine list in benchmarks/planted-events. They count neither as
found nor as noise until the organiser answers CONTEXT.md question 13.

| ID | Metric | Definition | Baseline (live set, D-020 to D-034) |
|---|---|---|---|
| D1 | Planted events found (demonstration) | For E1 to E4 (benchmarks/planted-events): found yes/no, delay in days from the first isolate of the event to the first alert (E3: from the first empty day; E4: first signal date). Not used to rank methods | E1 0 d, E2 4 d, E3 3 d, E4 first signal 2025-09-28 (experiments/0002, as shipped, `tuned-on-test`) |
| D2 | Injected cluster sensitivity and delay | Detection rate with 95 % Wilson interval and median delay (days from the first injected isolate) for k ∈ {2, 3, 4, 6} patients sharing one profile within 14 days, injected at random unit-weeks of the scoring period. Three families, reported separately: rare resistant profile (as 0007), common profiles (as 0011), and clusters split across two units linked by patient flow (new). *Proposed:* at least 200 trials per cell pooled over seeds 2026 to 2030, per-seed counts as spread (0007 ran 40 trials in 66 s) | rare: 5/40, 22/40, 38/40, 40/40, median delay 6, 8, 5, 4 d; common resistant 4+: 1/180; common ESBL *E. coli* 4+: 149/180 (0007, 0011; 40 and 60 trials) |
| D3 | Injected gap sensitivity and delay | Detection rate and median delay for d ∈ {2, 3, 5, 7} silent days and a halved week, as 0007 and 0009, same trial count as D2 | 3 d 37/40 (80–97 %), median 1 d, with the empty-run rule (0009) |
| D4 | Noise | Signal episodes per year over the scoring period at the same thresholds, excluding planted and quarantined events. The episode key is fixed for every method, not the method's own key: unit × organism-or-phenotype, or unit for data-quality signals, merged within 28 days. Also alerts per week | about 5 episodes a year over all three years (0002); to be recomputed on the scoring period with the fixed key |
| D5 | Sensitivity against noise | D2 rate at k = 4 plotted against D4 across the method's threshold range, one curve per injection family. Headline value: the rate at the loosest threshold whose D4 is at most 5 episodes a year, given for the rare and the common ESBL family side by side | rare 95 %, common ESBL 83 %, common resistant 1 % (0007, 0011), each at the live thresholds |
| D6 | Attribution | E3 and injected gaps raised as data problems, not resistance; resistance alerts in that unit-week suppressed or annotated. Reported as the share of injected gaps with any resistance alert in the gap unit-week | yes (sampling drop and empty-run rules); share not measured yet |
| D7 | Named right | Share of planted and injected events whose kind (sentinel, cluster, trend, divergence, data) matches the injection | not measured yet |

## C. Coverage: is the doctor's number right

Target: every first isolate in the next 28 days, per unit × specimen ×
antibiotic, covered if the effective result is S (intrinsic and
no-breakpoint count as not covered), as experiments/0004. Untested
isolates are reported both ways wherever a metric depends on them: left
out (as 0004), and counted as not covered (as 0010 table 3). 0010 showed
the choice can reverse a verdict.

| ID | Metric | Definition | Baseline |
|---|---|---|---|
| C1 | Brier | Mean squared error of the predicted share against the outcome, all cells and cells with under 30 isolates in the unit's 28 days; 95 % bootstrap over target windows | hospital, same specimen, last 365 days: 0.1414 all, 0.1605 small cells (0004) |
| C2 | Log loss | As C1 with log loss, p clipped to [0.001, 0.999] | 0004 |
| C3 | Calibration | (a) Slope and intercept of the logistic regression of the isolate outcome on logit(prediction), over all isolate × antibiotic predictions. (b) Query-months with at least 10 target isolates whose realised share fell below the threshold, against the Beta-binomial expectation, as 0010 metric 2; passes when the ratio is at most 1.5 (0010) | (a) not measured yet; (b) shipped list: 0 of 175 mild (0.3 expected), 23 of 269 severe (19.6 expected) (0010) |
| C4 | Realised top-pick coverage | Pooled next-month coverage of the first suggestion, within spectrum and over all organisms, mild and severe, as 0010; untested both ways | mild 96.6 % in spectrum, 75.4 % all organisms; severe 95.4 % (0010) |
| C5 | Per-pair Brier | C1 broken down by organism × antibiotic, so pairs where units differ are visible | not reported yet |
| C6 | Responsiveness | Days from the onset of E1 until the unit's cephalosporin coverage estimate's 90 % interval excludes its pre-onset value; same for E2 and MRSA. Two events only, so reported as days per event, not as a rate. Read only together with C7 and C8: a narrow interval reaches this fastest | not measured yet; the 365-day estimate is expected to be slow |
| C7 | Interval honesty | Share of 90 % intervals that contain the realised share over blocks of 20 or more isolates, (a) over all blocks and (b) over the outbreak unit-months (URO 2025-06 to 2025-08, ICU 2026-02 to 2026-04). *Proposed* pass band: 0.85 to 0.95 in (a); (b) reported, too few blocks for a band | 0010: 959 of 4,285 below the Wilson lower bound against 1,079 expected (ratio 0.89) |
| C8 | Outbreak-window accuracy (new) | C1 and C4 restricted to target isolates in the outbreak unit-months of C7(b). Tests whether responsiveness helps the doctor where it should; 0010 found removing these months moves every pooled figure by at most 0.3 points | to be measured on the hospital 365-day estimate |

## P. Prediction: where it goes next

| ID | Metric | Definition | Baseline |
|---|---|---|---|
| P1 | Exposure ranking (descriptive) | After an event's onset, rank the other eight units by exposure from the source unit (ENGINE.md 4). Outcome: the unit's ESBL *E. coli* (or MRSA, for E2) count in the following 8 weeks exceeds its own 26-week baseline at the cluster test's threshold; plain "appeared" is true in nearly every unit (about 11 ESBL *E. coli* first isolates a month hospital-wide) and leaves nothing to rank. AUC against the distribution from 1,000 degree-preserving rewirings, plus the same over every injected two-unit cluster of D2. One planted event gives a description, not a claim | chance 0.5 and the rewiring distribution |
| P2 | County forecast skill | One-month-ahead forecast of each THL series (4 phenotypes × 23 counties) for the last 24 complete months. Mean absolute error, and the mean log score (or CRPS) of the predictive distribution. Skill: MAE as 1 − MAE / MAE of the baseline; log score as the difference in mean log score to the baseline, with a bootstrap interval over months. Reported per phenotype, nationally, and pooled. THL revises recent months, so scoring against the final series is not strictly as-of; the record names the fetch date and says so | persistence as a Poisson at last month's count, and seasonal naive (same month last year) likewise |
| P3 | Regional signal timeliness | For the 3 of 0008's 10 signals that survive Bonferroni (D-037), months between the method's first signal and 0008's. The other 7 are reported descriptively; being earlier than a possibly-chance signal is not timeliness | 0008 |

## I. Interpretation and presentation

| ID | Metric | Definition | Baseline |
|---|---|---|---|
| I1 | Incident grouping | Alerts per incident over the scoring period (D-034); lower is better at equal D2 to D4 | 21 alerts, 18 incidents from the demo start (D-034); to be recomputed on the scoring period |
| I2 | Explanation faithfulness | Share of template or model explanations whose every number matches a field of the alert (D-019 check) | templates 100 % (0003) |
| V1 | Visualisation rubric | For each method's proposed picture, five yes/no items: readable in 5 seconds, shows the count behind the number, shows uncertainty, AA contrast in light mode, bilingual labels possible. Score is the number of yeses, 0 to 5, with the reviewer named | — |

## U. Usability: can people find and use it (the design run)

Checked by an agent against the running app, no human needed.

| ID | Metric | Target |
|---|---|---|
| U1 | Clicks and seconds from opening the app to the doctor's list for a named context (unit, site, sex, age, onset) | ≤ 3 clicks, ≤ 10 s on a laptop, ≤ 15 s on a phone profile |
| U2 | Clicks from the signal feed to the isolates behind an alert | 1 |
| U3 | Every number on screen carries its count and its as-of date in the same element or its direct label, checked over the DOM | yes/no per view, all yes |
| U4 | Lighthouse accessibility score; WCAG AA contrast; S/R and alert state never by colour alone | ≥ 95; pass; pass |
| U5 | Finnish and English both complete | 0 missing keys, checked over the i18n table |
| U6 | Time to first meaningful content, Lighthouse 4G phone throttling against a production build (not the dev server) | ≤ 2.5 s |
| U7 | The replay timeline: scrub, play, pause, jump to a date, and every panel shows the as-of date it reflects | all present |

## Decision rules (Artem, 2026-10-17)

- **Split:** tune on data up to 2024-09-30, score on 2024-10-01 to
  2026-09-27. Anything tuned on the scoring period is flagged and ranks
  below untuned methods; the live set's own year-1 re-tune is the
  reference row.
- **Replacing the shipped coverage estimate (D-023/D-033):** C1 alone
  separates differences no doctor would notice (0004's intervals exclude
  zero at 0.0002), so it is a guard, not the bar. A method replaces the
  shipped estimate only if it is not worse on C1 by more than a minimum
  meaningful difference (*proposed:* 0.002, 0004's small-cell gap between
  the hospital year and the hospital 28 days), not worse on C4 in either
  untested convention, better on C8, and passing C3(b) and C7(a). C6 is
  reported beside it.
- **Live detector thresholds:** the overnight run proposes, it does not
  change. The live set changes after Artem reads the table.
- **Headline numbers:** detection D5 for the rare and the common ESBL
  family at 5 episodes a year, with D2's median delay at k = 4; coverage
  C1, C4 and C8, with C6; prediction P2 skill per phenotype; usability
  U1 and U2.

## Reporting format

Each experiment writes `out/metrics.json`:

```json
{
  "experiment": "0012-slug",
  "method": "one line",
  "family": "detection | coverage | prediction | interpretation",
  "tuned_on_test": false,
  "tuned_on": "2023-10-02..2024-09-30",
  "metrics": { "D1": {"E1": 0, "E2": 4, "E3": 3, "E4": "2025-09-28"}, "D4": 5.1, "C1": {"all": 0.1414, "small": 0.1605} },
  "intervals": { "C1": {"all": [0.1409, 0.1420]} },
  "n": { "C1": {"all": 163666}, "D2": {"rare_k4": 200} },
  "runtime_s": 42,
  "seeds": [2026]
}
```

`benchmarks/overnight-2026-10-17/leaderboard.py` collects every
`out/metrics.json` into one table, best per metric marked, baselines as
the first rows, `tuned-on-test` rows below the rest.
