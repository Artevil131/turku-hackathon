---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent: 0003
---

# 0004 Do patient factors predict coverage better than the hospital's last year?

## Goal

0003 found that no unit- or time-local estimate beats the hospital's last
year at predicting whether an antibiotic covers the next isolate. Artem's
notes (section A4) rank patient factors as stronger predictors than the
unit: earlier resistant findings first, then hospital onset, unit type,
sex and age. The team planned a logistic regression on patient profiles
(PRODUCT.md, Users). This measures whether the factors the dataset has
improve the prediction, and which carry the gain, so the doctor's view
knows which inputs are worth asking for.

## Hypothesis

A logistic regression with all patient factors beats the baseline
(hospital, last 365 days, 0003 estimator 3) on mean Brier score over the
next 28 days, with a 95 % bootstrap interval of the difference that
excludes zero; and the earlier-findings features carry more than half of
the gain. Refuted if the interval includes zero or favours the baseline.

## Experiment

- Target and windows exactly as in 0003: first isolates per 28-day target
  window from 2024-09-30, each antibiotic that suits the specimen,
  covered if `effectiveResult` is S, intrinsic and no-breakpoint not
  covered, untested left out.
- Features, known when the sample is taken (all from earlier data or the
  sample itself):
  - sex (male), age in decades (centred at 6), inpatient (unit type),
    hospital onset (sampled on day 3+ of the stay);
  - earlier resistance: the patient had an isolate dated before this
    sample, within 365 days, not covered by this antibiotic (any
    organism); the patient had an ESBL, MRSA, VRE or CPE isolate dated
    before this sample within 365 days.
- Models, one per specimen and antibiotic, refitted for each target
  window on first isolates (one period per 28 days) from the 365 days
  before the window; L2-penalised logistic regression (penalty 1 on
  coefficients, not the intercept), fitted by Newton's method:
  A. all features; B. earlier-resistance features only; C. sex, age,
  inpatient and hospital onset only.
- Baseline: 0003 estimator 3 (hospital, last 365 days, same specimen).
- Metrics: mean Brier score and log loss (p clipped to [0.001, 0.999]);
  difference to the baseline with a 95 % interval from 1,000 bootstrap
  resamples of target windows (seed 2026). Odds ratios of model A fitted
  on the last 365 days of data are reported for interpretation.
- Code: the logistic regression in `libs/utils/logistic` (tested), the
  backtest in `backtest.ts` here:
  `node experiments/0004-patient-factors/backtest.ts`. Budget: under a
  minute on a laptop, else chili.

## Result

## Interpretation
