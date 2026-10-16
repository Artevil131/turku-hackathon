---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent: 0007
---

# 0011 Do the live detectors catch a cluster of a common profile?

## Goal

0007 measured that 4 patients sharing one strain within two weeks are
caught in 38 of 40 trials, but every injected strain copied a rare ESBL
or MRSA isolate, which stands out against any background. Its own
caveat: "a cluster of a common profile would be harder". An outbreak of
an ordinary strain, such as ampicillin-resistant *E. coli* in the
emergency department, is the case a reader of that number would assume
is covered. This measures it, so the sensitivity claim can be quoted
with its limits.

## Hypothesis

Predictions, stated before the run, with the live settings (D-020,
D-022) and 0007's detection rule:

1. **Most common resistant profile in the unit**, clusters of 4 or more:
   detected in under 60 % of trials over all units (0007: 95 % for rare
   strains), and under 30 % in the three large units (ED, PHC-N, PHC-S).
2. **Most common fully susceptible profile in the unit**: detected in 0 %
   of trials at every size beyond the control's chance rate, because the
   profile-excess detector skips isolates without acquired resistance and
   such isolates carry no phenotype.
3. **Most common ESBL *E. coli* profile in the hospital**, clusters of 4
   or more: detected in at least 80 % of trials, carried by the phenotype
   excess detector as in 0007.

Each is refuted if its rate (pooled over seeds) falls on the other side
of its threshold.

## Experiment

- Background: the real data, unchanged except for the injection, as in
  0007; the same start dates (2024-10-01 to 2026-08-15) and the same
  planted events kept clear of (`aei.inject.draw_start`).
- Units: each trial draws its unit uniformly from a stratum, half the
  trials from the large units (ED, PHC-N, PHC-S; about 4,700 to 5,100
  isolates each over the dataset) and half from the other six. Reported
  by stratum and pooled.
- "Common" is chosen per trial from data before the start only: the
  unit's isolates in the 365 days before the start, grouped by organism,
  specimen and full S/R profile over the 13 antibiotics, counted in
  distinct patients.
  - Arm *common resistant*: the largest group with at least one acquired
    resistance (`has_acquired_resistance`).
  - Arm *wild type*: the largest group without acquired resistance.
  - Arm *common ESBL E. coli*: the largest group of ESBL *E. coli* in the
    whole hospital (any unit) in the same 365 days, injected into the
    drawn unit.
  The source isolate is one random member of the chosen group. A unit
  without such a group in the year is redrawn.
- Clusters: k in {3, 4, 6, 8} new patients, each with one copy of the
  source isolate, sample dates uniform over 14 days from the start, as
  in 0007 (`aei.inject`, extended to take a chosen source). Controls,
  k = 0, per arm: the same draws with nothing injected, to measure how
  often a matching signal appears by chance in those windows.
- Detectors: the live profile excess (organism and specimen strata) and
  phenotype excess for ESBL and MRSA, on 400 days before the start to 60
  days after. Detected, as in 0007: a signal of either for the drawn
  unit and the source's organism or phenotype between the start and 28
  days after it. Also reported: a strict match, a profile-excess signal
  for the source's exact profile.
- Delay: days from the first injected case to the first matching signal.
- Runs: seeds 2026, 2027 and 2028 (mulberry32), 20 trials per seed for
  each arm and k (10 per stratum): 60 trials per cell. Reported: pooled
  detection rate with a 95 % Wilson interval (`aei.coverage.wilson`),
  the per-seed rates as spread, median delay.
- Code: `experiments/0011-common-profile-injections/run.py`, reusable
  trial code in `libs/utils/py/aei/inject.py`. Budget: under one minute
  of CPU on the laptop; if the run takes longer, trials per seed are
  halved and this is recorded as a deviation.

## Result

## Interpretation
