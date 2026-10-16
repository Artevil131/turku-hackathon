---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent: 0007
---

# 0009 Does a "run of empty days" rule catch short sampling gaps that the 7-day count misses?

## Goal

0007 found the live sampling-drop detector (7-day count against the 56
days before, D-020) catches a unit going silent for 3 days in only 10 of
40 trials, and almost never in the small units. A data feed failing is
the kind of deviation Artem's notes rank as cheap to check and costly to
miss. This tests a second rule built for it: alert when a unit has had
more consecutive days with no cultures than its usual daily volume makes
plausible, and measures what it adds and what it costs in false alarms,
so the team can decide whether the live set should include it.

## Hypothesis

Prediction, stated before the run: the run rule at alpha 0.0001, combined
with the live 7-day rule (either signals), catches at least 60 % of
3-day silent gaps (against 25 % for the 7-day rule alone in 0007) while
raising at most 3 other episodes a year on the real data. Refuted if
either fails.

## Experiment

- Run rule, per unit and day t with no cultures: L is the number of
  consecutive days with none ending at t; lambda is the unit's mean daily
  cultures over the 56 days before the run began; the chance of L empty
  days in a row under Poisson sampling is exp(−lambda·L). Signal when it
  is below alpha (0.001 or 0.0001). This means a unit sending about
  9 cultures a day signals on its first empty day at either alpha, and
  one sending about 1.75 (ICU) needs 5 or 6.
- Events: the gap trials of 0007 exactly (`aei.inject`, seed 2026,
  40 trials per setting: no cultures for 0, 2, 3, 5 or 7 days; half the
  cultures for 7 days). Detected: a signal for the unit from the gap's
  first day to 14 days after it. Rules compared: the live 7-day rule
  alone, the run rule alone, and either.
- False alarms: both rules over the full real data; signal episodes (same
  unit within 28 days) that are not the two known gaps (PHC-S
  2025-12-08 to 12-14; MED-A 2025-05-12 to 05-18), per year.
- Code: `analysis.py` here, Python (D-024, D-030), using `aei.detect`
  and `aei.inject`: `uv run python experiments/0009-empty-day-runs/analysis.py`.
  Output `out/results.md`. Budget about a minute on a laptop.

## Result

## Interpretation
