---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent:
---

# 0001 Does the synthetic dataset contain planted events?

## Goal

Answer CONTEXT.md question 13 from the data itself: does the organiser's
dataset contain deviations someone put there on purpose (an outbreak, a
ward drifting, a new resistant phenotype, a sampling drop, a step at a
guideline change)? The demo, the choice of detectors (question 11) and
what we ask the judges depend on it. If events are planted, the tool must
find them; if not, the demo needs labelled example events instead.

## Hypothesis

Exploratory: no prediction is tested and nothing beyond the description
is claimed. Described, for the whole dataset:

1. Weekly counts (ISO week) per unit of cultures, positive cultures and
   isolates, and of isolates flagged ESBL, MRSA, VRE and CPE.
2. Every CPE and VRE isolate, listed with date, unit, organism and patient.
3. Resistance per year and per quarter for the common organism and
   antibiotic pairs, hospital-wide and per unit, and around each 1 January
   (when the `guideline` column changes EUCAST version).
4. Repeated identical susceptibility profiles: for each unit, organism and
   full S/R profile, the most distinct patients seen within any 28 days,
   next to how common that profile is overall.
5. The patients behind the busiest carrier links (D-012).

Each series is shown with its typical level and its most extreme points.
A pattern that looks planted becomes the hypothesis of a later
experiment with a method from DECISIONS.md.

## Experiment

- Data: `data/synthetic_microbiology_dataset/` (the organiser's CSVs,
  unchanged), loaded with `@aei/dataset`; relations from `@aei/relations`.
- Counting: all isolates, no first-isolate rule (its period is not decided,
  CONTEXT.md question 8); percentages are descriptive and shown with their
  counts. No statistical test, threshold or detector is applied (none is
  decided yet).
- Code: `scan.ts` in this directory, TypeScript run by Node (D-003, D-004):
  `node experiments/0001-planted-events/scan.ts`. Deterministic, no seeds.
- Output: Markdown tables in `out/`, under 1 MB, committed.
- Budget: seconds on a laptop.

## Result

## Interpretation
