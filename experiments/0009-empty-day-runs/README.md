---
status: accepted    # proposed, then accepted, rejected or superseded
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

`uv run python experiments/0009-empty-day-runs/analysis.py` (10 s) writes
`out/results.md`. All computed; 40 trials per setting, the same gap events
as 0007 (its draws replayed exactly); 95 % Wilson intervals.

| unit sends no cultures for | 7-day rule (live) | run rule, alpha 0.001 | run rule, alpha 0.0001 |
|---|---|---|---|
| 2 days | 1/40 (0–13 %) | 22/40 (40–69 %), median 0 d | 11/40 (16–43 %) |
| 3 days | 10/40 (14–40 %) | 37/40 (80–97 %), median 1 d | 28/40 (55–82 %), median 2 d |
| 5 days | 33/40 (68–91 %) | 40/40 (91–100 %) | 37/40 (80–97 %) |
| 7 days | 40/40 | 40/40 | 40/40 |
| half the cultures for 7 days | 18/40 (31–60 %) | 0/40 | 0/40 |
| nothing removed (control) | 0/40 | 0/40 | 0/40 |

Either rule signalling equals the run rule for every silent gap and the
7-day rule for the halved week. Small units (MED-B, ICU) gain most: 3-day
gaps 6 of 9 at alpha 0.001 against 0 of 9 for the 7-day rule.

On the real data (2.99 years), signal episodes outside the two known gaps:
7-day rule 2 (0.7 a year); run rule 3 at alpha 0.001 (1.0 a year), 0 at
0.0001; either, counted without merging the two rules' episodes, 5 (1.7)
and 2 (0.7). The known gaps: PHC-S is signalled on its first empty day by
the run rule at 0.001 (day 1 at 0.0001) against day 3 for the 7-day rule;
MED-A on day 3 at 0.001 (not at 0.0001) against day 6.

Deviations from plan: none.

## Interpretation

The hypothesis holds at both thresholds: with the 7-day rule, the run
rule catches 93 % (alpha 0.001) or 70 % (0.0001) of 3-day silent gaps,
against 25 % alone, at 1.7 or 0.7 other episodes a year. The rules
complement each other: the run rule sees silence early, the 7-day rule
sees a unit sampling less but not stopping.

Two cautions before it goes live. The synthetic data has no weekday or
holiday pattern (cultures per weekday 6,524 to 6,812); real health
centres close at weekends, so the rule needs a baseline per weekday (or
to skip days a unit is normally closed) or it will fire every Monday.
And a live feed's newest days are incomplete until results arrive, so in
production the rule should run on days whose results are complete. If
adopted, it should share the 7-day rule's alert key so one gap raises one
alert, not two.
