---
status: accepted    # proposed, then accepted, rejected or superseded
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

`node experiments/0006-trends-by-ward-type/sweep.ts` (about 15 s) writes
`out/results.md`. 66 series. All computed.

Series signalling at least once: 9 at alpha 0.01, 1 at 0.001, 1 at
0.0001. The only series below 0.001 is urinary *E. coli* trimethoprim,
all units (smallest p 4.3e-5; first signal 2026-05-10 at 0.001, as in the
live set). Splitting by ward type weakens it (inpatient 1.3e-3,
outpatient 1.1e-3). *P. aeruginosa* piperacillin-tazobactam reaches p
3.3e-3 among inpatients (all units 2.7e-2), first below 0.01 on
2025-11-23. *K. pneumoniae* ceftriaxone among inpatients reaches 8.6e-3.
The other series below 0.01 (*E. coli* cefuroxime, *P. aeruginosa*
meropenem, *E. faecalis* ampicillin) show no visible rise in 0001 and are
consistent with chance among 66 series tested every 28 days.

Deviations from plan: none.

## Interpretation

Splitting by ward type does not find the second drift at the live
threshold. The *P. aeruginosa* piperacillin-tazobactam rise is real in
the yearly figures (0001: 5.4, 8.3, 8.8, 11.1 %) but rests on 150 to 550
isolates a year, and among inpatients on fewer; at 0.01 it would be found
together with several chance series, at 0.001 it is missed. Splitting
also costs power for the trimethoprim trend, which is spread across both
ward types. The live set stays as it is (hospital-wide, alpha 0.001).

For the benchmark (E4), the honest position is: the trimethoprim rise is
detected; the *Pseudomonas* rise is visible in the yearly comparison but
too small for this data to separate from noise with a trend test, so the
tool should show it in the yearly view (rolling twelve months against the
twelve before, with counts) rather than raise an alert. A detector with
more power for slow drifts (comparing rolling twelve-month windows, or
pooling related antibiotics) is the next thing to try if the team wants
an alert for it.

## Port to Python (2026-10-16)

`sweep.ts` was ported to `sweep.py` (D-024); the trend test and cluster
exclusion are the Python mirrors of `@aei/detect`:

    uv run python experiments/0006-trends-by-ward-type/sweep.py

It reproduces `out/results.md` byte for byte (about 15 s on the laptop).
The parity tests (`uv run pytest libs/utils/py/tests`) check the Python mirrors in `libs/utils/py/aei` against the TypeScript gears on the full dataset.
