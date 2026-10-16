---
status: accepted    # proposed, then accepted, rejected or superseded
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

`uv run python experiments/0011-common-profile-injections/run.py` (15 s
of CPU on the laptop) writes `out/results.md`. All computed; seeds 2026,
2027, 2028; 60 trials per cell (20 per seed, 10 per stratum per seed);
pooled rate with 95 % Wilson interval, per-seed counts as spread.

| arm | k | detected | per seed (of 20) | large units | other units | strict | median delay (days) |
|---|---|---|---|---|---|---|---|
| common resistant | control | 0/60 (0–6 %) | 0 / 0 / 0 | 0/30 | 0/30 | 0/60 | – |
| common resistant | 3 | 0/60 (0–6 %) | 0 / 0 / 0 | 0/30 | 0/30 | 0/60 | – |
| common resistant | 4 | 1/60 (0–9 %) | 0 / 0 / 1 | 0/30 | 1/30 | 1/60 | 9 |
| common resistant | 6 | 0/60 (0–6 %) | 0 / 0 / 0 | 0/30 | 0/30 | 0/60 | – |
| common resistant | 8 | 0/60 (0–6 %) | 0 / 0 / 0 | 0/30 | 0/30 | 0/60 | – |
| wild type | control | 0/60 (0–6 %) | 0 / 0 / 0 | 0/30 | 0/30 | 0/60 | – |
| wild type | 3, 4, 8 | 0/60 each | 0 / 0 / 0 | 0/30 | 0/30 | 0/60 | – |
| wild type | 6 | 1/60 (0–9 %) | 0 / 0 / 1 | 0/30 | 1/30 | 0/60 | 7 |
| common ESBL *E. coli* | control | 1/60 (0–9 %) | 0 / 1 / 0 | 0/30 | 1/30 | 0/60 | 22 |
| common ESBL *E. coli* | 3 | 19/60 (21–44 %) | 9 / 3 / 7 | 2/30 | 17/30 | 14/60 | 7 |
| common ESBL *E. coli* | 4 | 33/60 (42–67 %) | 10 / 10 / 13 | 12/30 | 21/30 | 24/60 | 7 |
| common ESBL *E. coli* | 6 | 56/60 (84–97 %) | 17 / 19 / 20 | 26/30 | 30/30 | 54/60 | 6 |
| common ESBL *E. coli* | 8 | 60/60 (94–100 %) | 20 / 20 / 20 | 30/30 | 30/30 | 60/60 | 6 |

Clusters of 4 or more (k = 4, 6, 8 pooled, 180 trials per arm):

| arm | all units | large units | other units |
|---|---|---|---|
| common resistant | 1/180 (0–3 %) | 0/90 (0–4 %) | 1/90 (0–6 %) |
| wild type | 1/180 (0–3 %) | 0/90 (0–4 %) | 1/90 (0–6 %) |
| common ESBL *E. coli* | 149/180 (77–88 %) | 68/90 (66–83 %) | 81/90 (82–95 %) |

What was injected (measured from the draws, k = 4): the common resistant
source was urinary *E. coli* resistant to ampicillin only in 56 of 60
trials (the rest *E. coli* wound, *S. aureus* wound); the wild type
source was fully susceptible urinary *E. coli* in 47 and *S. aureus*
wound in 13; the common ESBL source was urinary *E. coli* R to
ampicillin, cefuroxime, ceftriaxone, ciprofloxacin and trimethoprim in
42 of 60. Over the whole dataset, these profiles are 21.6 %, 44.5 % and
0.7 % of urinary *E. coli* (measured).

Deviations from plan: to fit the one-minute budget, `profile_excess` in
`aei.detect` gained an optional `only` filter that limits the days tested
to the drawn unit and the 28-day window (Python only; the signals for
those days are unchanged, and the parity tests, including 0007's trials
on three seeds, still pass). The list of sources was extended to both
strata after the first run; the second run gave identical tables. No
other deviations.

## Interpretation

All three predictions held.

1. **An outbreak of the hospital's commonest resistant strain is not
   detected**: 1 of 180 clusters of 4 to 8 patients, 0 of 90 in the large
   units, no better than the controls. The strain the tool picked is
   ampicillin-only-resistant urinary *E. coli*, a fifth of all urinary
   *E. coli*. The profile-excess test compares a unit's count with its
   *E. coli* patients times the profile's hospital-wide share; with a 22 %
   share and alpha 1e-4, even 8 extra patients in a unit seeing about 40
   urinary *E. coli* patients a month give an expected count near 10 and
   an observed near 17, p about 0.04 (derived), far from the threshold.
2. **Fully susceptible strains are invisible by design**:
   `profile_excess` skips isolates without acquired resistance
   (`libs/utils/py/aei/detect.py:224`, `libs/utils/detect/src/detectors.ts:136`)
   and they carry no phenotype. No strict match in 240 trials; the single
   loose match was another profile of the same organism.
3. **A common ESBL *E. coli* strain is still caught when it reaches 6**
   (56/60, 93 %), carried by phenotype excess, but at 4 patients only 33
   of 60 (55 %; 12 of 30 in the large units), against 0007's 38 of 40 for
   random ESBL or MRSA strains. The pooled 83 % for 4 or more rests on
   the larger clusters.

So the sensitivity claim from 0007 must be quoted with its scope: "4
patients sharing a rare resistant strain (ESBL, MRSA) within two weeks:
95 %; a common ESBL *E. coli* strain needs about 6 patients; outbreaks of
ordinary strains (ampicillin-resistant or fully susceptible *E. coli*,
*S. aureus*) are not detected by counts". This is a limit of any
count-based surveillance without typing: an outbreak of the most common
strain looks like ordinary traffic unless isolates are typed (WGS, or
at least an antibiogram finer than S/R). It is not a tuning problem; at
the 21.6 % share no alpha that keeps 0002's false-alarm rate would reach
it.

Strongest alternative explanation: the synthetic data draws profiles
independently per unit and day, so the background of common strains is
smoother than in a real hospital; a real background would only make
common-strain clusters harder to see.

Next: state this scope wherever the 95 % is quoted (README, pitch,
explanations), and ask Artem whether the ESBL k = 4 drop (55 %) in large
units warrants a unit-specific phenotype baseline for ED and the health
centres.
