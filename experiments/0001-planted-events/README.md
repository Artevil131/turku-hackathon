---
status: accepted    # proposed, then accepted, rejected or superseded
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

Run with `node experiments/0001-planted-events/scan.ts` (about 35 s on a
laptop); tables in `out/1-weekly.md` to `out/5-carriers.md`. All isolates,
no first-isolate rule. Counts are measured, percentages computed.

Four patterns stand out from their series; everything else looks like
steady noise around a fixed level.

1. **Urology, ESBL *E. coli* outbreak, June–July 2025.** One full profile
   (R to ampicillin, cefuroxime, ceftriaxone, ciprofloxacin and
   trimethoprim; S to mecillinam, piperacillin-tazobactam, meropenem,
   nitrofurantoin) is held by 76 *E. coli* isolates in three years, 0.66 %
   of all *E. coli*. 25 of them are in Urology in June–July 2025 (20 in
   June); every other unit-month has at most 3. 21 distinct patients
   within 28 days from 2025-06-04, 10 of them on day 3 or later of their
   stay. Urology ESBL isolates run at 6 a week in 2025-W25 to W27 against
   a median of 0; Urology *E. coli* ciprofloxacin R is 24 % in 2025-Q2
   against 7–14 % in the other quarters (`out/4`, `out/1`, `out/3`).
2. **ICU, MRSA outbreak, March 2026.** *S. aureus* resistant to cefoxitin
   and clindamycin, susceptible to vancomycin: 25 isolates in three years,
   12 of them in the ICU in March 2026 (12 patients within 28 days from
   2026-03-03, 9 on day 3+ of their stay). ICU *S. aureus* cefoxitin R is
   42 % (n = 31) in 2026-Q1 against 0–11 % in other quarters; 10 of the 17
   ICU MRSA isolates fall in 2026-W10 to W13.
3. **Health centre South, no samples for a week, 2025-12-08 to
   2025-12-14.** Zero cultures for seven consecutive days in a unit whose
   median week has 55; the days before and after look normal. No other
   unit has an empty week.
4. **Trimethoprim resistance in urinary *E. coli* rises steadily:**
   14.7 % (2023, Oct–Dec), 17.4 % (2024), 19.2 % (2025), 20.0 % (2026,
   Jan–Sep), with n 875 to 3,572 per year. *P. aeruginosa*
   piperacillin-tazobactam R also rises (5.4, 8.3, 8.8, 11.1 %, n 149 to
   554); the other pairs in `out/3` stay flat.

Not found: no burst of CPE or VRE (12 CPE and 5 VRE isolates, at most one
per unit in any 28 days, all different patients). Carriage is barely
modelled: a carrier's next isolate of the same organism within 90 days
carries the phenotype again in 4 of 59 ESBL cases (6.8 %, against 3.7 %
of all isolates of those organisms), so carrier links (D-012) show where
patients go, not where bacteria persist. Around 1 January the version in
`guideline` changes; *E. coli* cefuroxime R is 1.7–2.6 points higher in
the eight weeks after each 1 January than before, but winter and the
guideline change cannot be told apart here and the counts are small
(about 500 per window), so nothing is claimed.

Deviations from plan: none.

## Interpretation

The dataset contains at least three deliberate events, each of a
different kind from Artem's taxonomy (README "Deviations and anomalies"):
a clonal ward cluster (Urology ESBL *E. coli*), a ward outbreak of an
MDRO (ICU MRSA), and a data artefact (a week without samples from one
health centre), plus a slow rising trend (trimethoprim). They are far
outside their series, so the answer to CONTEXT.md question 13 is very
likely yes, though only the organiser can confirm it. The strongest
alternative, chance, is implausible for the first three (for example,
20 of 76 isolates of one rare profile landing in one unit-month).

The demo replay should cover these events: the default start (eight
weeks before the end) misses all of them. Each detector the team chooses
should be tested against them in a follow-up experiment: does it flag
Urology in June 2025, the ICU in March 2026 and the empty week at
Health centre South, how early, and how many other alerts it raises.
