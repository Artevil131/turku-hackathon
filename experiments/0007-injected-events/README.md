---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent: 0002
---

# 0007 How often and how fast do the live detectors catch injected events of known size?

## Goal

0002 chose the live detectors (D-020) while looking at the four planted
events they were scored on, so its delays are optimistic (review,
2026-10-16). This measures sensitivity and delay on events the thresholds
never saw: synthetic clusters and sampling gaps of known size injected
into the real data at random units and dates. The numbers say how small an
outbreak the tool can be trusted to catch, which is what the judges'
fourth criterion asks, and they are honest to quote.

## Hypothesis

Prediction, stated before the run: with the live settings (D-020, D-022),
an injected cluster of 4 or more patients within 14 days in one unit is
detected in at least 80 % of trials within 21 days of its first case,
and a unit sending no samples for 3 or more days is detected in at least
80 % of trials. Refuted if either rate is below 80 %.

## Experiment

- Background: the real data, unchanged except for the injection.
- Clusters: k in {2, 3, 4, 6} patients, each a new patient with one
  isolate copied (organism, specimen and full S/R profile) from a
  randomly chosen real isolate flagged ESBL (*E. coli*, *K. pneumoniae*)
  or MRSA (*S. aureus*); all k copies share that one profile, as a clone
  would. Unit uniform over the nine, sample dates uniform over 14 days
  from a start drawn uniformly from 2024-10-01 to 2026-08-15, avoiding the
  Urology June–July 2025 and ICU March 2026 events. 40 trials per k.
  Detected: the profile-excess or phenotype-excess detector (live
  settings) signals for that unit and organism or phenotype between the
  start and 28 days after it.
- Sampling gaps: one unit's cultures removed for d days, d in {2, 3, 5,
  7}, or halved (every second culture removed) for 7 days; unit and start
  drawn as above. 40 trials per setting. Detected: the sampling-drop
  detector (live settings) signals for that unit between the start and 14
  days after it.
- Delay: days from the event's start to the first signal; results are
  assumed to arrive on their sample date (D-005), so 2 to 3 days of lab
  turnaround come on top in practice.
- Detectors run only on the data they need around the event (the
  organism's isolates or the unit's cultures from 400 days before the start
  to 60 days after), which gives the same signals in that span.
- Reported: detection rate with a 95 % Wilson interval and median delay
  per setting, by unit size. Seed 2026, one run of 40 trials per setting.
- Code: `inject.ts` here: `node experiments/0007-injected-events/inject.ts`,
  using `@aei/detect` and `@aei/coverage` (`wilson`). Budget: a few
  minutes on a laptop; over one minute of CPU moves it to chili.

## Result

## Interpretation
