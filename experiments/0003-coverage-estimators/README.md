---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent:
---

# 0003 Which estimate of a ward's antibiotic coverage predicts the next four weeks best?

## Goal

The doctor's view needs, per unit, specimen and antibiotic, the chance
that the antibiotic covers whatever grows from the next sample. A
four-week unit figure rests on few isolates (CONTEXT.md, "The core
tension"); the alternatives are longer windows, the whole hospital, or a
blend. Artem's notes (section B) list these options without choosing.
This backtest measures which estimate best predicts what the next 28 days
actually show, so the team can choose from numbers (CONTEXT.md questions
7 and 8).

## Hypothesis

Prediction, stated before the run: a blend of the unit's last 28 days
shrunk toward its own last year (itself shrunk toward the hospital) beats
the hospital's last year, the baseline the annual report gives today, on
mean Brier score over the next 28 days, and the 95 % bootstrap interval of
the difference excludes zero. The raw 28-day unit figure is worse than the
baseline. Refuted if the blend's interval includes zero or favours the
baseline.

## Experiment

- Target: every first isolate (`@aei/counting`, period = the 28-day target
  window) in each target window, for each antibiotic that suits its
  specimen (`@aei/eucast` `suitsSpecimen`; the cefoxitin screen excluded).
  Outcome: covered if `effectiveResult` is S; intrinsic and no-breakpoint
  count as not covered (Artem's Rule 4); untested pairs are left out.
- Cell: unit × specimen × antibiotic, all organisms together (the
  syndromic question the doctor has before the organism is known).
- Target windows: consecutive 28-day windows from 2024-09-30 (after a
  full year of history) to the end of the data. Estimates use only
  isolates dated before the window, first isolates per 28-day or 365-day
  feature window.
- Estimators of the covered share p:
  1. unit, last 28 days, raw (k/n);
  2. unit, last 365 days, raw;
  3. hospital, last 365 days, same specimen (baseline: today's annual
     report, hospital level);
  4. hospital, last 28 days, same specimen;
  5. unit, last 365 days shrunk toward the hospital's 365 days,
     (k + 20·p_hosp) / (n + 20);
  6. unit, last 28 days shrunk toward estimator 5, (k + M·p5) / (n + M),
     M in {5, 20, 50}.
  A raw estimator with n = 0 falls back to estimator 3; how often is
  reported.
- Metrics: mean Brier score and mean log loss (p clipped to [0.001,
  0.999]) per outcome, overall and for cells with fewer than 30 first
  isolates in the unit's last 28 days. Difference to the baseline with a
  95 % interval from 1,000 bootstrap resamples of target windows (seed
  2026).
- Code: `backtest.ts` here, using `@aei/dataset`, `@aei/counting`,
  `@aei/eucast`. `node experiments/0003-coverage-estimators/backtest.ts`.
  Output: Markdown tables in `out/`. Budget: under a minute on a laptop.
- Known confounder: the planted Urology outbreak (June–July 2025, 0001)
  sits in the target period; results are also reported without Urology.

## Result

## Interpretation
