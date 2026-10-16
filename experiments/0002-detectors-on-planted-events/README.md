---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent: 0001
---

# 0002 Which simple detectors find the planted events, how early, at what cost?

## Goal

Give the team a measured starting point for deviation detection (the
fourth judging criterion, CONTEXT.md question 11) before the methods are
settled. Candidate detectors from Artem's notes (section C) are run day by
day over the three years, using only data up to each day, and scored on
the four events found in 0001. The team then picks detectors and
thresholds from this table instead of from first principles (D-016).

## Hypothesis

Exploratory comparison; no single prediction is tested. Described for
each detector and threshold:

- whether it signals each planted event, and the delay in days from the
  event's first case (or first missing day) to the first signal;
- how many other signal episodes it raises in the three years (a signal
  episode: signals for the same detector key within 28 days of each
  other). Other episodes may be noise or events 0001 did not find; they
  are listed so they can be checked by hand.

Planted events (from 0001): E1 Urology ESBL *E. coli* cluster, first case
2025-06-04 (or the first case in Urology in June 2025); E2 ICU MRSA
cluster, first case 2026-03-03; E3 no cultures at Health centre South,
2025-12-08 to 2025-12-14; E4 urinary *E. coli* trimethoprim resistance
rising over the whole period (no start date; the first signal date is
reported).

## Experiment

Detectors (D-016), all causal: the signal on day t uses only samples
dated on or before t, and every baseline excludes the window being tested.

1. **Profile rule** (Artem's cluster definition): at least k distinct
   patients in one unit with the same organism and the same S/R profile
   over the 13 antibiotics within W days, the profile holding at least one
   acquired R (not intrinsic, `@aei/eucast`). k in {3, 4}, W in {14, 28},
   all patients or only those sampled on day 3+ of their stay.
2. **Profile excess (Poisson):** the same count, compared with the count
   expected from the unit's isolates of that organism in the window times
   the profile's share hospital-wide in the 365 days before the window.
   Signal when P(X ≥ observed) < alpha and observed ≥ 3.
3. **Phenotype excess (Poisson):** ESBL, MRSA, VRE and CPE isolates in a
   unit within 28 days against the unit's share of that phenotype among
   its isolates in the 365 days before, times its isolates in the window.
   Signal when P(X ≥ observed) < alpha and observed ≥ 2.
4. **Sampling drop (Poisson):** cultures in a unit over the last 7 days
   against 7 times its daily mean over the 56 days before. Signal when
   P(X ≤ observed) < alpha.
5. **Resistance shift:** per unit and for the 22 organism and antibiotic
   pairs of 0001, % R in the last 28 days against the same unit's 336
   days before (non-overlapping), one-sided mid-p Fisher exact test,
   evaluated weekly. Signal when p < alpha and at least 3 R in the window.
6. **Rising trend:** hospital-wide per pair, Cochran-Armitage test for a
   trend over 28-day bins from the start of the data to t (at least 13
   bins), one-sided, evaluated every 28 days. Signal when p < alpha.

Alpha in {0.01, 0.001, 0.0001} for 2 to 6. All isolates are counted (the
first-isolate rule removes almost nothing within 28 days in one unit,
0001 follow-up); a patient counts once per detector window.

Code: reusable detectors in `libs/utils/detect` (TypeScript, tested),
the sweep in `sweep.ts` here: `node experiments/0002-detectors-on-planted-events/sweep.ts`.
Deterministic, no seeds. Output: Markdown tables in `out/`. Budget: a
few minutes on a laptop; if a sweep takes longer than a minute it moves
to chili.

## Result

## Interpretation
