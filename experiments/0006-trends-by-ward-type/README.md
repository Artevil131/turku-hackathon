---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent: 0002
---

# 0006 Does testing trends separately for inpatients and outpatients find the drifts the hospital-wide test misses?

## Goal

The planted-events benchmark (`benchmarks/planted-events/README.md`, E4)
asks the tool to flag two slow rises: urinary *E. coli* trimethoprim and
*P. aeruginosa* piperacillin-tazobactam. The live trend detector (D-020,
D-022) tests each pair hospital-wide and misses the second (best p 0.027).
A review on 2026-10-16 noticed that among inpatients *P. aeruginosa*
piperacillin-tazobactam R goes from 4.5 to 13.6 % and *K. pneumoniae*
ceftriaxone from 4.2 to 10.9 %, which the hospital-wide test dilutes. This
measures what a split by ward type (inpatient units against the emergency
department and health centres) finds and what it costs in extra trend
alerts, so the team can decide whether the live set should use it.

## Hypothesis

Exploratory: the inpatient pattern was spotted on this same data, so a
detection here cannot confirm a planted drift. Described: for each of the
22 pairs (0002) and each stratum (all, inpatient, outpatient), the first
date the trend test signals at alpha 0.01, 0.001 and 0.0001, with
isolates of clusters already detected left out as in the live set
(D-022); and the number of signalling series per alpha, against the 66
series tested.

## Experiment

- Data, bins and test as in the live set: Cochran-Armitage for a rise
  over 28-day bins from the start of the data, evaluated at each bin end
  from bin 13, one-sided; all isolates; isolates of detected clusters left
  out from the day of detection.
- Strata: inpatient units (MED-A, MED-B, SURG, URO, ICU, GER), outpatient
  units (ED, PHC-N, PHC-S), and all units.
- Code: `Pair.setting` added to `libs/utils/detect` (tested); the sweep in
  `sweep.ts` here: `node experiments/0006-trends-by-ward-type/sweep.ts`.
  Output: `out/results.md`. Budget: under a minute on a laptop.
- No correction for multiple testing is applied; the count of signalling
  series against 66 tested is reported instead.

## Result

## Interpretation
