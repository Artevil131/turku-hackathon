---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent:
---

# 0004 Which estimate of a ward's antibiotic coverage predicts the next four weeks best?

Numbering: planned and first committed as 0003 (commit a9dfb81); renumbered to 0004 because `0003-small-llm-bakeoff` on ui/web-app took 0003 first.

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
  `@aei/eucast`. `node experiments/0004-coverage-estimators/backtest.ts`.
  Output: Markdown tables in `out/`. Budget: under a minute on a laptop.
- Known confounder: the planted Urology outbreak (June–July 2025, 0001)
  sits in the target period; results are also reported without Urology.

## Result

`node experiments/0004-coverage-estimators/backtest.ts` (about 11 s on a
laptop) writes `out/results.md`. 26 target windows, 163,666 predictions
(first isolate × antibiotic). The unit's 28-day cell was empty for 0.2 %
of predictions (raw estimator 1 then used the baseline). All computed;
deterministic, bootstrap seed 2026.

Mean Brier score, lower is better (difference to the baseline, 95 %
bootstrap interval over target windows):

| estimator | all cells | cells with under 30 in the unit's 28 days |
|---|---|---|
| 3 hospital, 365 days (baseline) | 0.1414 | 0.1605 |
| 5 unit 365 d shrunk to hospital | +0.0002 (0.0001 to 0.0004) | +0.0006 (0.0002 to 0.0009) |
| 2 unit, 365 days, raw | +0.0004 (0.0002 to 0.0005) | +0.0011 (0.0006 to 0.0016) |
| 4 hospital, 28 days | +0.0005 (0.0003 to 0.0007) | +0.0020 (0.0015 to 0.0026) |
| 6 unit 28 d shrunk, M 50 | +0.0005 (0.0003 to 0.0008) | +0.0012 (0.0006 to 0.0018) |
| 6 unit 28 d shrunk, M 20 | +0.0011 (0.0008 to 0.0015) | +0.0025 (0.0017 to 0.0034) |
| 6 unit 28 d shrunk, M 5 | +0.0026 (0.0021 to 0.0030) | +0.0071 (0.0057 to 0.0085) |
| 1 unit, 28 days, raw | +0.0058 (0.0051 to 0.0065) | +0.0206 (0.0177 to 0.0234) |

Log loss ranks the estimators the same way; leaving out Urology changes
nothing (`out/results.md`).

Deviations from plan: none.

## Interpretation

The hypothesis is refuted. No estimator beats the hospital's last year;
every step toward the unit or toward the last 28 days makes the
prediction slightly worse, and the more weight on the unit's 28 days, the
worse. The differences among the year-long estimators are tiny (0.0002 to
0.0005 Brier); the raw 28-day unit figure is clearly worse, most of all
where it rests on fewer than 30 isolates, which is the organiser's reason
for the 30-isolate rule.

The likeliest explanation is the data: apart from the planted events, the
generator seems to give units little lasting difference in coverage, so
local and recent data add noise, not signal. Real hospital data may
differ. The strongest alternative within this design is that the score is
dominated by common, rarely resistant pairs, which hides gains on the few
pairs where units differ; a per-antibiotic breakdown would show it.

For the tool this suggests: the doctor's coverage number should rest on
the long baseline (hospital or unit year, shrunk), and the four-week unit
data should feed the deviation alerts (0002) rather than the number
itself: "this unit's last four weeks differ" is a signal, not a better
estimate. Next experiments: the per-antibiotic breakdown; and patient
factors (sex, age, day 3+ of stay, earlier resistant finds), which the
dataset README says matter (urinary *E. coli* differs by sex) and which
the team's planned logistic regression would use.

## Notes from the review (2026-10-16, after close)

- The outcome leaves untested pairs out, which drops whole organism
  groups for some antibiotics: urinary ceftazidime "coverage" (21.8 %)
  counts no Enterobacterales, and clindamycin and vancomycin count as
  urine options. The comparison between estimators shares this outcome,
  but no absolute number here is clinical coverage. A later version needs
  a target organism group per antibiotic and per-antibiotic results.
- Units do differ by type: urinary *E. coli* trimethoprim R is about
  15 to 17 % in the emergency department and health centres and 21 to
  25 % on the wards. An inpatient/outpatient estimator was not tested and
  is the obvious next one.

## Port to Python (2026-10-16)

`backtest.ts` was ported to `backtest.py` (D-024), with the Python mirrors
of `@aei/counting` and `@aei/eucast` and the same mulberry32 generator
(`aei.jscompat`), so the bootstrap draws are the same:

    uv run python experiments/0004-coverage-estimators/backtest.py

It reproduces `out/results.md` byte for byte (about 27 s on the laptop). The
parity tests (`uv run pytest libs/utils/py/tests`) check the Python mirrors
in `libs/utils/py/aei` against the TypeScript gears on the full dataset.

## Note from review round 2 (2026-10-16, after close)

The coverage list as shipped (D-023, D-033: the unit's year if it has 30
isolates, else ward type, else hospital) was not itself backtested here;
this experiment found the unit's raw year 0.0004 Brier worse than the
hospital's (interval 0.0002–0.0005). The fair reading is that the
differences are too small to matter on this data; a backtest of
`coverage()` as shipped would settle it. Coverage is also counted per
isolate, not per infection episode (15 % of wound and 10 % of urine
cultures grow two organisms), and the Wilson interval assumes
independent isolates.
