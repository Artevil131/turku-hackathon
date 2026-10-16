---
status: accepted    # proposed, then accepted, rejected or superseded
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

`node experiments/0007-injected-events/inject.ts` (66 s on a laptop, one
run, seed 2026) writes `out/results.md`. All computed; 40 trials per
setting; detection rate with 95 % Wilson interval.

| setting | detected | median delay (days) |
|---|---|---|
| control, nothing injected | 0/40 (0–9 %) | – |
| cluster of 2 patients | 5/40 (5–26 %) | 6 |
| cluster of 3 | 22/40 (40–69 %) | 8 |
| cluster of 4 | 38/40 (83–99 %) | 5 |
| cluster of 6 | 40/40 (91–100 %) | 4 |
| control, nothing removed | 0/40 (0–9 %) | – |
| no cultures for 2 days | 1/40 (0–13 %) | 3 |
| no cultures for 3 days | 10/40 (14–40 %) | 2 |
| no cultures for 5 days | 33/40 (68–91 %) | 3 |
| no cultures for 7 days | 40/40 (91–100 %) | 4 |
| half the cultures for 7 days | 18/40 (31–60 %) | 5 |

Every detected cluster of 4 or more was found within 12 days of its first
case. Short gaps are found mainly in the large units (3 days: 5 of 7
trials in ED and the health centres, 0 of 9 in MED-B and the ICU); a
halved week is found in 16 of 20 trials in large units and 2 of 20
elsewhere.

Deviations from plan: control trials (nothing injected or removed, 40
each) were added before the run to measure chance matches; they matched
0 of 40 each. The run took 66 s on the laptop, slightly over the one
minute budget, and was not moved to chili.

## Interpretation

The hypothesis is half refuted. Clusters: an outbreak of 4 or more
patients with one resistant clone in one unit within two weeks is caught
in 95 % of trials (78 of 80 for 4 and 6), median 4 to 5 days after its
first case, plus 2 to 3 days of lab turnaround in practice; 3 patients
are caught about half the time and 2 rarely. Sampling gaps: 3 days
without samples is caught in only a quarter of trials, so the 80 %
claim fails there; 5 days is caught in 83 %, 7 days always. Small units
send too few cultures for a few silent days to stand out against Poisson
noise.

These are the numbers to quote to the judges instead of 0002's delays:
"a clone reaching 4 patients in a unit within two weeks is flagged in 95
% of simulated outbreaks, about 5 days after the first case; a unit going
silent for 5 days is flagged in 83 %". Caveats: injected clones copy real
ESBL or MRSA profiles, which are rare and so easy to spot; a cluster of a
common profile would be harder. Each trial holds one event against real
background, and false alarms are measured separately (0002, about 5 other
episodes a year).

For short gaps in small units a different rule would do better: a run of
consecutive days with no cultures, compared with how often the unit has
such runs, rather than a 7-day count.

## Port to Python (2026-10-16)

`inject.ts` was ported to `inject.py` (D-024). The trials moved to
`libs/utils/py/aei/inject.py` and draw from the same mulberry32 generator in
the same order, so every trial is the same as in the original run:

    uv run python experiments/0007-injected-events/inject.py

It reproduces the table of `out/results.md` exactly. The one difference is
the measured "Run time" in the text (36.6 s in Python against the 66.0 s
recorded), so the committed file keeps the original run's line. The parity
tests (`uv run pytest libs/utils/py/tests`) check the Python mirrors in
`libs/utils/py/aei` against the TypeScript gears on the full dataset. The
tests also run the original trial code (copied into
`libs/utils/py/tests/ts_dump.ts`) and the Python trials on seeds 1, 7 and
2026 and require the same units, first signal dates and delays.

## Notes from review round 2 (2026-10-16, after close)

- What "an outbreak of 4 patients" means here: 4 identical copies of one
  rare ESBL or MRSA isolate (same organism, specimen and full S/R
  profile) within 14 days; clones differing in even one result were not
  tested. Quote it as "4 patients sharing one ESBL or MRSA strain within
  2 weeks: 38/40 (83–99 %)".
- Units were drawn uniformly, so small units are overrepresented (15 of
  40 trials against about 9 by isolate volume). In large units: 8 of 9
  for 4 patients, 5 of 14 for 3.

## Scope of the cluster result (2026-10-17, after close)

The clusters here copied isolates drawn at random from rare resistant
strains (ESBL, MRSA and the like). experiments/0011 injected the
commonest profiles instead: clusters of the unit's commonest resistant
strain (urinary *E. coli* resistant to ampicillin only) were caught in
1 of 180 trials of 4 to 8 patients, fully susceptible ones never (the
profile test skips them by design), and the hospital's commonest ESBL
*E. coli* in 33 of 60 at 4 patients and 56 of 60 at 6. "Clusters of 4
or more caught in 95 %" holds for rare strains only.
