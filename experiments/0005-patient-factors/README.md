---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent: 0004
---

# 0005 Do patient factors predict coverage better than the hospital's last year?

Numbering: planned and first committed as 0004 (commit 4e0021d); renumbered to 0005 when 0003 had to move to 0004 (collision with `0003-small-llm-bakeoff`).

## Goal

0004 found that no unit- or time-local estimate beats the hospital's last
year at predicting whether an antibiotic covers the next isolate. Artem's
notes (section A4) rank patient factors as stronger predictors than the
unit: earlier resistant findings first, then hospital onset, unit type,
sex and age. The team planned a logistic regression on patient profiles
(PRODUCT.md, Users). This measures whether the factors the dataset has
improve the prediction, and which carry the gain, so the doctor's view
knows which inputs are worth asking for.

## Hypothesis

A logistic regression with all patient factors beats the baseline
(hospital, last 365 days, 0004 estimator 3) on mean Brier score over the
next 28 days, with a 95 % bootstrap interval of the difference that
excludes zero; and the earlier-findings features carry more than half of
the gain. Refuted if the interval includes zero or favours the baseline.

## Experiment

- Target and windows exactly as in 0004: first isolates per 28-day target
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
- Baseline: 0004 estimator 3 (hospital, last 365 days, same specimen).
- Metrics: mean Brier score and log loss (p clipped to [0.001, 0.999]);
  difference to the baseline with a 95 % interval from 1,000 bootstrap
  resamples of target windows (seed 2026). Odds ratios of model A fitted
  on the last 365 days of data are reported for interpretation.
- Code: the logistic regression in `libs/utils/logistic` (tested), the
  backtest in `backtest.ts` here:
  `node experiments/0005-patient-factors/backtest.ts`. Budget: under a
  minute on a laptop, else chili.

## Result

`node experiments/0005-patient-factors/backtest.ts` (about 34 s on a
laptop) writes `out/results.md`. 26 target windows, 163,666 predictions,
2,340 model fits, all converged. All computed; bootstrap seed 2026.

| model | Brier | minus baseline (95 % interval) | log loss minus baseline |
|---|---|---|---|
| baseline: hospital, 365 days | 0.1412 | – | – |
| A all patient factors | 0.1413 | +0.0001 (0.0000 to 0.0002) | +0.0004 (−0.0000 to 0.0007) |
| B earlier resistance only | 0.1413 | +0.0001 (0.0000 to 0.0001) | +0.0004 (0.0001 to 0.0005) |
| C sex, age, inpatient, day 3+ | 0.1412 | +0.0000 (−0.0001 to 0.0001) | +0.0000 (−0.0004 to 0.0004) |

Odds ratios of model A for not being covered (fitted on the last 364
days, penalised, `out/results.md`) are close to 1 for almost every
specimen and antibiotic. The clearest exception is ciprofloxacin in
urine, men 1.93 against women; a few blood-culture ratios reach about 2
(piperacillin-tazobactam after an earlier non-covered isolate 2.34,
meropenem after an earlier flagged phenotype 2.17) on few isolates.

Deviations from plan: the training data are 13 periods of 28 days (364
days), not 365, so the periods line up with the target windows. One
problem with the outcome definition (shared with 0004) showed in the
table: untested pairs are left out, and ceftazidime is tested only on
*P. aeruginosa*, so its "coverage" in urine (23 %) counts only
*Pseudomonas* and organisms resistant by nature, not *E. coli*. The same
selective-testing bias affects any antibiotic tested on a subset of
organisms; it does not change the comparison between estimators, which
share the outcome, but the absolute numbers for those antibiotics are not
clinical coverage.

## Interpretation

The hypothesis is refuted. In this dataset, patient factors do not
predict coverage better than the hospital's last year, and earlier
resistant findings carry no gain at all. Together with 0001 (a carrier's
next isolate carries the phenotype again in 7 % of ESBL cases, against
4 % background) and 0004 (no lasting unit differences), the likeliest
explanation is that the generator draws each isolate's resistance from
its organism and specimen, with a sex effect for urinary *E. coli* and
the planted events on top, and little else. In real data earlier
resistance is the strongest known predictor (Artem's notes, A4), so this
is a property of the synthetic data, not evidence against the factor.

For the team: a patient-profile model trained on this dataset will show
nothing, however good the method, and should not be the centrepiece of
the demo. What the data does support is the hospital and unit baseline,
a sex split for urinary ciprofloxacin, and the deviation alerts. If the
tool asks the doctor for patient factors, it should say the weights come
from published studies, not from this data. Before any coverage number
reaches the screen, untested pairs need handling (inference from related
antibiotics or the organism mix, Artem's WISCA section), or antibiotics
tested on a subset of organisms must be labelled as such.

## Port to Python (2026-10-16)

`backtest.ts` was ported to `backtest.py` (D-024), with the Python mirrors
of `@aei/counting`, `@aei/eucast` and `@aei/logistic` and the same
mulberry32 generator (`aei.jscompat`):

    uv run python experiments/0005-patient-factors/backtest.py

It reproduces `out/results.md` byte for byte (about 63 s on the laptop).
The logistic fits sum through numpy rather than the TypeScript's loops, so
their weights agree with the TypeScript's to rounding (about 1e-15
relative), not bit for bit; no printed digit changes. The parity tests (`uv run pytest libs/utils/py/tests`) check the Python mirrors in `libs/utils/py/aei` against the TypeScript gears on the full dataset.
