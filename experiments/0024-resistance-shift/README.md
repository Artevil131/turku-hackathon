---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent: 0002
---

# 0024 Does the resistance-shift detector (D-080) stay within about 5 other episodes a year?

## Goal

D-080 proposes `resistanceShift` as a live detector and keeps it live only if it adds at most
about 5 other episodes a year. This measures that on the full dataset, and how quickly it finds the
planted events of 0001 and injected events. The answer decides whether D-080 stays in
`LIVE_SETTINGS`.

## Hypothesis

Stated before the run. With the D-080 settings (window 28 days, baseline the 365 days before the
window, at least 30 known results in the baseline and 3 in the window, alpha 0.01, one-sided exact
binomial, isolates of an already detected cluster left out), scanned causally over the whole
dataset:

1. it raises at most 5 other signal episodes a year (episodes: same detector and key within 28
   days; other: matching none of E1 and E2 of 0001);
2. it signals E1 (Urology *E. coli*) and E2 (ICU *S. aureus*) within 14 days of their first case.

Refuted if either fails. 0002's mid-p Fisher "resistance shift" (0.3 other episodes a year at
alpha 0.001, 11 and 12 days) is a different test on 22 pairs hospital-wide-baselined per unit; this
one covers every unit, specimen, organism and antibiotic with a result.

## Experiment

- Data: `data/synthetic_microbiology_dataset/`, all isolates (no first-isolate rule, as 0002),
  2.99 years.
- Detector: `resistance_shift_binomial` in `libs/utils/py/aei/detect.py` (mirror of
  `resistanceShift` in `@aei/detect`, parity-tested) at `LIVE_SETTINGS["resistance_shift"]`. The
  baseline share is smoothed by adding one half, as in the excess detectors (not specified in D-080;
  the neighbouring detector's pattern). Cluster exclusion: `in_detected_cluster` of the live
  profile and phenotype excess signals, as for the trend. No threshold is varied.
- Planted events (0001, matchers as 0002): E1 an episode in URO for *E. coli* between 2025-06-04 and
  2025-08-31; E2 in ICU for *S. aureus* between 2026-03-03 and 2026-05-31. Delay is days from the
  event's first case to the first signal. E3 (a sampling gap) and E4 (a hospital-wide trend) are
  not shift events; urinary *E. coli* trimethoprim episodes are listed beside the count as E4-related
  and still counted as other.
- Other episodes per year: episodes matching neither E1 nor E2, divided by 1092 / 365.25 years;
  also split by calendar year (the first year has an incomplete baseline) and without the cluster
  exclusion.
- Injected events, seed 2026 (mulberry32), 40 trials per setting: (a) 0007's clusters, k in {0, 2,
  3, 4, 6} identical clones of a real ESBL or MRSA isolate in a random unit (same draws as 0007);
  detected = a shift signal for that unit and organism within 28 days of the start, with and
  without cluster exclusion; (b) a drift without a clone: in a random unit and start (as 0007),
  one random pair of the 22 surveillance pairs and, for results of that organism and antibiotic
  in the unit within 28 days of the start, each susceptible result is turned resistant with
  probability f in {0 (control), 0.3, 0.6}; detected = a shift signal for that unit, organism and
  antibiotic within 28 days of the start (trials with fewer than 3 such results are counted, not
  dropped). Detectors run on the unit's records from 400 days before to 60 days after.
  The injection sizes (f, k) are the experimenter's, not a statistical threshold.
- Metric: detection rate with a 95 % Wilson interval, median delay, episodes per year with a Poisson
  interval is not computed (one run, deterministic scan).
- Code: `score.py` here: `uv run python experiments/0024-resistance-shift/score.py`. Budget:
  under a minute on a laptop.

## Result

`uv run python experiments/0024-resistance-shift/score.py` (10 s on a laptop, one deterministic scan,
seed 2026 for the injections) writes `out/results.md` and `out/other-episodes.md`. All computed.

Whole dataset, 2.99 years, D-080 settings, nothing varied:

| setting | E1 | E2 | episodes | other episodes | other per year |
|---|---|---|---|---|---|
| with cluster exclusion (the live setting) | not signalled | not signalled | 140 | 140 | **46.8** |
| without exclusion | 3 d (CRO) | 6 d (FOX) | 140 | 133 | 44.5 |

- **Both hypotheses are refuted.** 46.8 other episodes a year is nine times the D-080 line of about
  5. With the cluster exclusion the detector never signals E1 or E2: it first reaches three
  resistant results after the profile and phenotype excess detectors have flagged the cluster, so the
  isolates are already left out. Without the exclusion it signals them 3 and 6 days after the first
  case (counted from 2025-06-04 and 2026-03-03).
- The 140 episodes fall on 108 unit-specimen-organism-antibiotic cells, evenly across the years
  after the first (2024: 48, 2025: 49, 2026 to September: 37), so the first year's short baseline is
  not the cause. By drug: trimethoprim 26, ciprofloxacin 22, piperacillin-tazobactam, ceftriaxone and
  cefuroxime 15 each, ampicillin 14. By unit: PHC-S 29, PHC-N 24, ED 24, MED-A 17, GER 14, URO 11,
  SURG 10, MED-B 9, ICU 2. 18 of the other episodes are urinary *E. coli* trimethoprim, which is
  where 0001's E4 trend lives.
- Typical episodes are small counts against small expectations (for example 2 of 3 results resistant
  to mecillinam against 0.15 expected, p 0.0096).

Injected, 40 trials per setting (detection rate, 95 % Wilson interval):

| setting | detected, with exclusion | detected, without exclusion |
|---|---|---|
| control, nothing injected | 3/40 (3–20 %) | 2/40 (1–17 %) |
| cluster of 2 | 17/40 (29–58 %) | 18/40 (31–60 %) |
| cluster of 3 | 17/40 (29–58 %) | 27/40 (52–80 %) |
| cluster of 4 | 16/40 (26–55 %) | 31/40 (62–88 %) |
| cluster of 6 | 15/40 (24–53 %) | 30/40 (60–86 %) |

| drift without a clone (one unit, one organism and antibiotic, 28 days) | detected | median delay |
|---|---|---|
| control, nothing changed | 0/40 (0–9 %) | – |
| each S turned R with probability 0.3 | 10/40 (14–40 %) | 14 d |
| probability 0.6 | 27/40 (52–80 %) | 14 d |

The shift detector finds clusters of 4 and 6 in 75 to 78 % of trials when it sees the clone (without
exclusion); with the exclusion the clone is left out once flagged, and what remains (15 to 17 of 40)
is close to the 2-patient rate and well above the chance rate (control 3/40). The drift trials: 5 to 9 of 40 per setting had fewer
than 3 known results in the window and cannot signal.

Deviations from plan: none in method. The baseline share is smoothed by one half (the neighbouring
detectors' pattern; D-080 does not say). Run-time and trial counts as planned.

## Interpretation

The detector at the D-080 settings fails its acceptance line: about 47 other episodes a year against
about 5. Alpha 0.01 is applied to every day of about 100 correlated unit-drug cells, so a daily scan
behaves very differently from the single ten-drug screen the B10 table (10 % chance of one flag)
was computed for. The injected drift shows it does find a one-drug rise without a clone (27 of 40 at
a 60 % flip, median 14 days), and nothing in the planted events needs it (E1 and E2 are caught by the
cluster detectors, E4 by the trend).

Per D-080 it should therefore not stay in `LIVE_SETTINGS`. The decision is the team's; this
experiment did not try other alphas, windows or minimum counts. Strongest alternative explanation:
the synthetic dataset has fixed rates with no ward-level drift, so every flag here is by
construction a false alarm or an unlabelled chance cluster; real data with drift would raise the
detection side and may leave the noise side the same. The next experiment would be a settings
sweep (alpha, a multiplicity control across cells, a larger minimum window) with held-out
injections, if the team wants the detector kept.
