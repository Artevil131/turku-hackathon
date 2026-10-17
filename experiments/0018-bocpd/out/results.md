# 0018 BOCPD: results

Run time 245.5 s (CPU; computed, `aei.harness.Clock`; informational, the budget is 10 minutes).

Tags: every number is **computed** by this run through `aei.score_detection` unless marked **measured** (counted in the data), **derived** (arithmetic on computed numbers) or **assumed** (a stated proposal). Baseline rows are the committed `baselines/live-set-*.json`, computed by the same harness. Screening seed 2026 only, 200 trials per cell; intervals are 95 % Wilson (rates) and exact Poisson (episodes a year). `tuned_on_test` is false for the chosen setting.

## Series, priors and checks

Count series 117 and rate series 198 (measured); 156 weeks from 2023-10-02 to 2026-09-27; 22,312 count events, 107,464 rate results of which 8,891 R (measured). ESBL patients a week: URO 0.50, ED 0.60, ICU 0.06; ICU MRSA 0.12 a week with 94 % zero weeks; *E. coli* ceftriaxone results a week: PHC-N 10.1, PHC-S 10.1, URO 6.8, ICU 1.3 (measured, first isolates per series within 365 days; the plan's figures count distinct patients per week). Priors from the first 26 weeks: URO ESBL mean 0.256 a week, ICU MRSA 0.020; 19 of 117 count series sit on the 0.02 floor; URO *E. coli* ceftriaxone R share prior 0.040 (computed).

Checks (computed): 
`check_causal` on 2025-03-31, 2025-12-31, 2026-06-30: no differences. 
Trial path (cached states before the trial's week, rows from the trial's week) against the unfocused run on the same rows, 8 trials (3 rare, 2 common ESBL, 1 two-unit, 2 gaps): 8 of 8 identical (dates, keys, p within 1e-9). Filter runs and cache hits: 17089 focused trials, 0 fallbacks to the full run.

**Pruning run lengths below 1e-4 posterior** (computed; whole data, signals at the loosest level p < 0.9, exact against pruned):

| H | w | signals exact | signals pruned | only in exact | only in pruned | max abs change of p |
|---|---|---|---|---|---|---|
| 1/26 | 2 | 1578 | 1578 | 0 | 0 | 2.09e-02 |
| 1/26 | 4 | 27829 | 27837 | 1 | 9 | 6.13e-02 |
| 1/52 | 2 | 309 | 309 | 0 | 0 | 5.60e-03 |
| 1/52 | 4 | 3395 | 3397 | 0 | 2 | 1.73e-02 |
| 1/104 | 2 | 99 | 99 | 0 | 0 | 1.47e-03 |
| 1/104 | 4 | 923 | 922 | 1 | 0 | 4.16e-03 |
| 1/208 | 2 | 36 | 36 | 0 | 0 | 3.33e-16 |
| 1/208 | 4 | 378 | 378 | 0 | 0 | 2.54e-03 |

At the chosen setting and level (H = 1/26, w = 2, p < 0.5): 33 signals exact, 33 pruned, 0 only in the exact run, 0 only in the pruned run (computed). The signal dates are therefore unchanged at the operating level; at the loosest level some signals appear or vanish where p sits near 0.9.

## Choice on the tuning year

Injected clusters of 4 (40 rare, 40 common ESBL *E. coli*, seed 2026, starts 2024-04-01 to 2024-08-15) and real-data noise over 2024-04-01 to 2024-09-30 scaled to a year, all episodes (counts and %R, fixed key); the detector saw no data after 2024-09-30. One episode in the half year is 2.0 a year (derived), so the noise column moves in steps of 2.

**Noise, episodes a year (computed)**; levels p < the column head, the plan's nine first and the four looser exploratory ones in front:

| H, w | 0.9 | 0.8 | 0.7 | 0.6 | 0.5 | 0.4 | 0.3 | 0.2 | 0.1 | 0.05 | 0.02 | 0.01 | 0.005 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1/26, 2 | 180 | 60 | 26 | 18 | 4 | 4 | 4 | 2 | 0 | 0 | 0 | 0 | 0 |
| 1/26, 4 | 295 | 162 | 86 | 54 | 30 | 20 | 12 | 6 | 2 | 0 | 0 | 0 | 0 |
| 1/52, 2 | 60 | 20 | 10 | 8 | 4 | 4 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 1/52, 4 | 178 | 66 | 38 | 22 | 16 | 10 | 6 | 4 | 0 | 0 | 0 | 0 | 0 |
| 1/104, 2 | 22 | 10 | 10 | 4 | 4 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1/104, 4 | 70 | 30 | 22 | 16 | 10 | 8 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1/208, 2 | 10 | 10 | 6 | 4 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1/208, 4 | 36 | 20 | 14 | 8 | 8 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Rare clusters detected of 40 (computed)**; levels p < the column head, the plan's nine first and the four looser exploratory ones in front:

| H, w | 0.9 | 0.8 | 0.7 | 0.6 | 0.5 | 0.4 | 0.3 | 0.2 | 0.1 | 0.05 | 0.02 | 0.01 | 0.005 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1/26, 2 | 34 | 29 | 17 | 10 | 8 | 4 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 1/26, 4 | 40 | 37 | 34 | 29 | 23 | 20 | 16 | 9 | 3 | 1 | 0 | 0 | 0 |
| 1/52, 2 | 30 | 14 | 9 | 7 | 3 | 2 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| 1/52, 4 | 40 | 33 | 27 | 22 | 20 | 16 | 10 | 5 | 3 | 1 | 0 | 0 | 0 |
| 1/104, 2 | 16 | 10 | 7 | 3 | 2 | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 1/104, 4 | 36 | 26 | 22 | 18 | 14 | 11 | 6 | 4 | 2 | 0 | 0 | 0 | 0 |
| 1/208, 2 | 11 | 7 | 3 | 2 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 1/208, 4 | 27 | 21 | 16 | 14 | 9 | 7 | 5 | 4 | 1 | 0 | 0 | 0 | 0 |

**Common ESBL *E. coli* clusters detected of 40 (computed)**; levels p < the column head, the plan's nine first and the four looser exploratory ones in front:

| H, w | 0.9 | 0.8 | 0.7 | 0.6 | 0.5 | 0.4 | 0.3 | 0.2 | 0.1 | 0.05 | 0.02 | 0.01 | 0.005 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1/26, 2 | 40 | 32 | 18 | 11 | 8 | 6 | 6 | 5 | 2 | 1 | 0 | 0 | 0 |
| 1/26, 4 | 40 | 40 | 38 | 36 | 33 | 28 | 21 | 11 | 5 | 4 | 3 | 2 | 0 |
| 1/52, 2 | 35 | 17 | 13 | 8 | 6 | 6 | 4 | 3 | 1 | 1 | 0 | 0 | 0 |
| 1/52, 4 | 40 | 37 | 34 | 31 | 27 | 18 | 9 | 6 | 4 | 4 | 2 | 0 | 0 |
| 1/104, 2 | 18 | 13 | 8 | 7 | 4 | 3 | 3 | 2 | 1 | 1 | 0 | 0 | 0 |
| 1/104, 4 | 39 | 34 | 30 | 23 | 16 | 7 | 6 | 5 | 4 | 4 | 0 | 0 | 0 |
| 1/208, 2 | 13 | 8 | 7 | 5 | 3 | 3 | 2 | 2 | 1 | 0 | 0 | 0 | 0 |
| 1/208, 4 | 35 | 29 | 21 | 12 | 6 | 6 | 5 | 5 | 4 | 1 | 0 | 0 | 0 |

**Chosen (plan's levels): H = 1/26, w = 2, level p < 0.5** (noise 4 a year, rare 8 of 40, common ESBL 8 of 40; no tie). The parts (counts, %R) use the same setting and level. With the four looser levels the rule would choose H = 1/26, w = 2, p < 0.5 (exploratory, below).

## Headline: D5 at the loosest level with at most 5 episodes a year

D5 reads D2 at k = 4 at the loosest level of the method's own grid whose noise (D4 over cluster and sentinel signals only, harness-spec Choices 3) is at most 5 episodes a year. %R signals are named divergence, so they do not count in that noise; the last columns read the same curve on the whole tool's noise (counts and %R episodes, derived from `D5_curve`).

| row | level | noise, episodes a year (95 % Poisson) | rare k = 4 (95 % Wilson) | common ESBL k = 4 | rare delay, days | common delay, days | same curve on whole-tool noise |
|---|---|---|---|---|---|---|---|
| BOCPD counts and %R | p < 0.5 | 1.5 (0.3 to 4.4) | 14.0 % (10 to 19) | 13.5 % (9 to 19) | 3 | 3 | p < 0.4: 2.0 a year, rare 10 %, common ESBL 10 % |
| BOCPD counts | p < 0.5 | 1.5 (0.3 to 4.4) | 1.5 % (1 to 4) | 1.0 % (0 to 4) | 4 | 1 | p < 0.5: 1.5 a year, rare 2 %, common ESBL 1 % |
| BOCPD %R | p < 0.5 | 0.0 (0.0 to 1.9) | 12.5 % (9 to 18) | 13.0 % (9 to 18) | 3 | 3 | p < 0.4: 2.0 a year, rare 8 %, common ESBL 10 % |
| live set, re-tuned on year 1 | level x0.3 | 3.0 (1.1 to 6.6) | 92.0 % (87 to 95) | 75.0 % (69 to 80) | 6 | 6 | level x0.01: 5.0 a year, rare 71 %, common ESBL 34 % |
| live set, as shipped (tuned on test) | level x3 | 3.0 (1.1 to 6.6) | 92.0 % (87 to 95) | 75.0 % (69 to 80) | 6 | 6 | level x1: 4.5 a year, rare 89 %, common ESBL 61 % |

The shipped and re-tuned live rows have the same D5 headline because level 0.3 of the re-tuned alphas is level 3 of the shipped ones (harness review, finding 12a). Delay is the median over the detected trials, days from the first injected isolate. Looser levels than the plan's, exploratory (the same setting, the curve read to p < 0.9):

| row | level | noise a year | rare k = 4 | common ESBL k = 4 | rare delay | common delay | whole-tool noise |
|---|---|---|---|---|---|---|---|
| counts and %R | p < 0.6 | 4.0 | 22.5 % (17 to 29) | 25.0 % (20 to 31) | 3 | 3 | p < 0.4: 2.0 a year, rare 10 %, common ESBL 10 % |
| counts | p < 0.6 | 4.0 | 3.5 % (2 to 7) | 5.0 % (3 to 9) | 5 | 4 | p < 0.6: 4.0 a year, rare 4 %, common ESBL 5 % |
| %R | p < 0.9 | 0.0 | 80.0 % (74 to 85) | 87.5 % (82 to 91) | 2 | 2 | p < 0.4: 2.0 a year, rare 8 %, common ESBL 10 % |

## D5 curves (plan's levels), counts and %R, counts, %R

**counts and %R** (computed; noise = cluster and sentinel episodes a year over 2024-10-01 to 2026-09-27, count in brackets; whole tool beside it; rates at k = 4, 200 trials):

| level p < | noise a year (count) | whole tool a year | rare k = 4 | rare delay | common resistant | wild type | common ESBL k = 4 | common ESBL delay | two-unit |
|---|---|---|---|---|---|---|---|---|---|
| 0.5 | 1.5 (3) | 6.5 | 14.0 % (10 to 19) | 3 | 3.0 % | 4.5 % | 13.5 % (9 to 19) | 3 | 10.5 % |
| 0.4 | 0.0 (0) | 2.0 | 10.0 % (7 to 15) | 3 | 2.0 % | 3.0 % | 10.5 % (7 to 16) | 4 | 5.5 % |
| 0.3 | 0.0 (0) | 0.5 | 4.0 % (2 to 8) | 3 | 1.5 % | 2.5 % | 6.0 % (3 to 10) | 3 | 4.0 % |
| 0.2 | 0.0 (0) | 0.0 | 1.0 % (0 to 4) | 4 | 0.0 % | 1.0 % | 3.0 % (1 to 6) | 3 | 1.5 % |
| 0.1 | 0.0 (0) | 0.0 | 1.0 % (0 to 4) | 4 | 0.0 % | 0.0 % | 1.5 % (1 to 4) | 5 | 0.0 % |
| 0.05 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.02 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.01 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.005 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |

**counts** (computed; noise = cluster and sentinel episodes a year over 2024-10-01 to 2026-09-27, count in brackets; whole tool beside it; rates at k = 4, 200 trials):

| level p < | noise a year (count) | whole tool a year | rare k = 4 | rare delay | common resistant | wild type | common ESBL k = 4 | common ESBL delay | two-unit |
|---|---|---|---|---|---|---|---|---|---|
| 0.5 | 1.5 (3) | 1.5 | 1.5 % (1 to 4) | 4 | 1.5 % | 2.5 % | 1.0 % (0 to 4) | 1 | 1.5 % |
| 0.4 | 0.0 (0) | 0.0 | 1.5 % (1 to 4) | 4 | 0.5 % | 1.5 % | 0.0 % (0 to 2) | none | 0.5 % |
| 0.3 | 0.0 (0) | 0.0 | 0.5 % (0 to 3) | 3 | 0.0 % | 1.5 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.2 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 1.0 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.1 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.05 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.02 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.01 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.005 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |

**%R** (computed; noise = cluster and sentinel episodes a year over 2024-10-01 to 2026-09-27, count in brackets; whole tool beside it; rates at k = 4, 200 trials):

| level p < | noise a year (count) | whole tool a year | rare k = 4 | rare delay | common resistant | wild type | common ESBL k = 4 | common ESBL delay | two-unit |
|---|---|---|---|---|---|---|---|---|---|
| 0.5 | 0.0 (0) | 5.0 | 12.5 % (9 to 18) | 3 | 1.5 % | 2.0 % | 13.0 % (9 to 18) | 3 | 9.5 % |
| 0.4 | 0.0 (0) | 2.0 | 8.5 % (5 to 13) | 3 | 1.5 % | 1.5 % | 10.5 % (7 to 16) | 4 | 5.0 % |
| 0.3 | 0.0 (0) | 0.5 | 3.5 % (2 to 7) | 4 | 1.5 % | 1.0 % | 6.0 % (3 to 10) | 3 | 4.0 % |
| 0.2 | 0.0 (0) | 0.0 | 1.0 % (0 to 4) | 4 | 0.0 % | 0.0 % | 3.0 % (1 to 6) | 3 | 1.5 % |
| 0.1 | 0.0 (0) | 0.0 | 1.0 % (0 to 4) | 4 | 0.0 % | 0.0 % | 1.5 % (1 to 4) | 5 | 0.0 % |
| 0.05 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.02 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.01 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |
| 0.005 | 0.0 (0) | 0.0 | 0.0 % (0 to 2) | none | 0.0 % | 0.0 % | 0.0 % (0 to 2) | none | 0.0 % |

## All metrics at the chosen setting (H = 1/26, w = 2, p < 0.5)

**D2 and its delay, counts and %R** (computed; rate with 95 % Wilson interval, median delay in days; 200 trials per cell, per-seed counts in `metrics.json`):

| family | k = 0 (control) | k = 2 | k = 3 | k = 4 | k = 6 |
|---|---|---|---|---|---|
| rare | 1.5 % (1 to 4), 17 d | 5.0 % (3 to 9), 3 d | 9.5 % (6 to 14), 3 d | 14.0 % (10 to 19), 3 d | 25.0 % (20 to 31), 3 d |
| common_resistant | 7.5 % (5 to 12), 15 d | 6.0 % (3 to 10), 4 d | 3.0 % (1 to 6), 0 d | 3.0 % (1 to 6), 5 d | 6.5 % (4 to 11), 8 d |
| wild_type | 5.0 % (3 to 9), 14 d | 3.0 % (1 to 6), 6 d | 6.0 % (3 to 10), 2 d | 4.5 % (2 to 8), 4 d | 5.5 % (3 to 10), 10 d |
| common_esbl | 4.0 % (2 to 8), 16 d | 4.0 % (2 to 8), 1 d | 12.0 % (8 to 17), 2 d | 13.5 % (9 to 19), 3 d | 29.5 % (24 to 36), 3 d |
| two_unit | 7.5 % (5 to 12), 12 d | 7.5 % (5 to 12), 3 d | 10.0 % (7 to 15), 4 d | 10.5 % (7 to 16), 4 d | 20.5 % (15 to 27), 5 d |

**D2 at k = 3 and 4, the parts and the baseline rows** (computed):

| row | rare k = 3 | rare k = 4 | common_resistant k = 3 | common_resistant k = 4 | wild_type k = 3 | wild_type k = 4 | common_esbl k = 3 | common_esbl k = 4 | two_unit k = 3 | two_unit k = 4 |
|---|---|---|---|---|---|---|---|---|---|---|
| BOCPD counts and %R | 9.5 % (6 to 14), 3 d | 14.0 % (10 to 19), 3 d | 3.0 % (1 to 6), 0 d | 3.0 % (1 to 6), 5 d | 6.0 % (3 to 10), 2 d | 4.5 % (2 to 8), 4 d | 12.0 % (8 to 17), 2 d | 13.5 % (9 to 19), 3 d | 10.0 % (7 to 15), 4 d | 10.5 % (7 to 16), 4 d |
| BOCPD counts | 1.0 % (0 to 4), 3 d | 1.5 % (1 to 4), 4 d | 0.5 % (0 to 3), 0 d | 1.5 % (1 to 4), 2 d | 2.0 % (1 to 5), 1 d | 2.5 % (1 to 6), 4 d | 1.5 % (1 to 4), 7 d | 1.0 % (0 to 4), 1 d | 3.5 % (2 to 7), 2 d | 1.5 % (1 to 4), 4 d |
| BOCPD %R | 9.0 % (6 to 14), 3 d | 12.5 % (9 to 18), 3 d | 2.5 % (1 to 6), 3 d | 1.5 % (1 to 4), 20 d | 4.0 % (2 to 8), 4 d | 2.0 % (1 to 5), 0 d | 10.5 % (7 to 16), 2 d | 13.0 % (9 to 18), 3 d | 6.5 % (4 to 11), 6 d | 9.5 % (6 to 14), 4 d |
| live set, re-tuned | 86.0 % (81 to 90), 7 d | 98.0 % (95 to 99), 5 d | 2.0 % (1 to 5), 8 d | 1.0 % (0 to 4), 6 d | 0.5 % (0 to 3), 0 d | 0.0 % (0 to 2) | 70.0 % (63 to 76), 6 d | 88.0 % (83 to 92), 6 d | 47.5 % (41 to 54), 4 d | 56.5 % (50 to 63), 7 d |
| live set, shipped | 61.5 % (55 to 68), 7 d | 89.0 % (84 to 93), 6 d | 0.5 % (0 to 3), 23 d | 0.5 % (0 to 3), 25 d | 0.0 % (0 to 2) | 0.0 % (0 to 2) | 34.5 % (28 to 41), 8 d | 61.0 % (54 to 67), 7 d | 21.0 % (16 to 27), 3 d | 24.0 % (19 to 30), 3 d |

D2 is read at the tuning-chosen level p < 0.5; the live rows at their operating level (the re-tuned alphas, the shipped ones). Rare k = 0 and two-unit controls are the false-alarm side of the same cells.

**Spread of D2 at k = 4: detections in each of the five consecutive blocks of 40 trials** (computed; one seed, so the blocks stand in for the per-seed spread):

| row | rare k = 4, blocks of 40 | common ESBL k = 4, blocks of 40 |
|---|---|---|
| BOCPD counts and %R | 6 / 5 / 6 / 4 / 7 (sum 28) | 7 / 6 / 4 / 6 / 4 (sum 27) |
| BOCPD counts | 2 / 0 / 0 / 1 / 0 (sum 3) | 1 / 0 / 0 / 1 / 0 (sum 2) |
| BOCPD %R | 4 / 5 / 6 / 3 / 7 (sum 25) | 6 / 6 / 4 / 6 / 4 (sum 26) |

**D4, episodes a year by kind, over 2024-10-01 to 2026-09-27** (computed; fixed key, planted and quarantined zones left out; counts, and 95 % exact Poisson in brackets for the total):

| row | all | cluster | sentinel | divergence | trend | data | alerts a week (alerts) |
|---|---|---|---|---|---|---|---|
| BOCPD counts and %R | 6.5 (13; 3.5 to 11.2) | 1.5 (3) | 0.0 (0) | 5.0 (10) | 0.0 (0) | 0.0 (0) | 0.125 (13) |
| BOCPD counts | 1.5 (3; 0.3 to 4.4) | 1.5 (3) | 0.0 (0) | 0.0 (0) | 0.0 (0) | 0.0 (0) | 0.029 (3) |
| BOCPD %R | 5.0 (10; 2.4 to 9.2) | 0.0 (0) | 0.0 (0) | 5.0 (10) | 0.0 (0) | 0.0 (0) | 0.096 (10) |
| live set, re-tuned | 9.5 (19; 5.7 to 14.9) | 4.5 (9) | 1.5 (3) | 0.0 (0) | 0.0 (0) | 3.5 (7) | 0.183 (19) |
| live set, shipped | 4.5 (9; 2.1 to 8.6) | 1.0 (2) | 1.5 (3) | 0.0 (0) | 0.0 (0) | 2.0 (4) | 0.087 (9) |

**D1** (demonstration only; days from the planted event's start, 'none' where the detector never raised a matching signal at the chosen level; E3 and E4 are not this method's kinds):

| row | E1 | E1 corrected | E2 | E2 corrected | E3 | E4 |
|---|---|---|---|---|---|---|
| BOCPD counts and %R | none | none | 4 | 4 | none | none |
| BOCPD counts | none | none | none | none | none | none |
| BOCPD %R | none | none | 4 | 4 | none | none |
| live set, re-tuned | 0 | 5 | 0 | 0 | 0 | 2026-02-15 |
| live set, shipped | 0 | 5 | 0 | 0 | 0 | 2026-05-10 |

**D1 by level, counts and %R** (computed; the plan's levels and the four looser ones; days from the start date, 'none' = not found):

| event | p < 0.9 | p < 0.8 | p < 0.7 | p < 0.6 | p < 0.5 | p < 0.4 | p < 0.3 | p < 0.2 | p < 0.1 | p < 0.05 | p < 0.02 | p < 0.01 | p < 0.005 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E1 | 0 | 0 | 0 | 0 | none | none | none | none | none | none | none | none | none |
| E1_corrected | 5 | 5 | 5 | 5 | none | none | none | none | none | none | none | none | none |
| E2 | 2 | 2 | 2 | 4 | 4 | none | none | none | none | none | none | none | none |
| E2_corrected | 2 | 2 | 2 | 4 | 4 | none | none | none | none | none | none | none | none |
| E3 | none | none | none | none | none | none | none | none | none | none | none | none | none |
| E4 | none | none | none | none | none | none | none | none | none | none | none | none | none |

A %R signal on *E. coli* trimethoprim exists at the chosen level (2 signals, first 2024-12-21, in ED); reported, not claimed: E4 is a hospital-wide trend and the harness's matcher accepts only a trend signal.

**D6, D7 and I1** (computed; D6 = injected gaps with any non-data signal for the unit within the gap or 7 days after, 1,000 gaps; D7 = share of detected events named right; I1 alerts per incident):

| row | D6 | D7, %R named divergence | D7, %R named cluster | I1 |
|---|---|---|---|---|
| BOCPD counts and %R | 1.2 % (1 to 2) (12 of 1000) | 17.1 % (14 to 21), n 398 | 99.7 % (99 to 100) | 14 alerts, 14 incidents, 1.00 per incident |
| BOCPD counts | 0.7 % (0 to 1) (7 of 1000) | 100.0 % (95 to 100), n 68 | same | 3 alerts, 3 incidents, 1.00 per incident |
| BOCPD %R | 0.5 % (0 to 1) (5 of 1000) | 0.0 % (0 to 1), n 345 | 99.7 % (98 to 100) | 11 alerts, 11 incidents, 1.00 per incident |
| live set, re-tuned | 2.6 % (2 to 4) (26 of 1000) | 98.7 % (98 to 99), n 2493 | n/a | 29 alerts, 26 incidents, 1.12 per incident |
| live set, shipped | 1.2 % (1 to 2) (12 of 1000) | 97.4 % (97 to 98), n 1982 | n/a | 18 alerts, 15 incidents, 1.20 per incident |

## Every setting of the grid (exploratory)

Each setting at the level its own tuning-year rule gives (the loosest with at most 5 episodes a year in the tuning window), scored on the scoring period, rare and common ESBL families only, three rows each. D5 headline: the loosest level of the plan's grid with cluster and sentinel noise at most 5 a year; 'whole tool' reads the same curve on all episodes (counts and %R). **Exploratory: every row was scored on the scoring period, so a row picked from this table was picked there.**

**counts and %R** (computed):

| H | w | tuning level p < | tuning noise a year | tuning rare / common (of 40) | rare k = 4 at that level | common ESBL k = 4 | D4 all / cluster a year | D5 headline: level, noise, rare, common | same curve, whole-tool noise <= 5: level, noise, rare, common |
|---|---|---|---|---|---|---|---|---|---|
| 1/26 | 2 | 0.5 | 4 | 8 / 8 | 14.0 % (10 to 19) | 13.5 % (9 to 19) | 6.5 / 1.5 | p < 0.5, 1.5, 14 %, 14 % | p < 0.4, 2.0, 10 %, 10 % |
| 1/26 | 4 | 0.1 | 2 | 3 / 5 | 7.0 % (4 to 11) | 7.5 % (5 to 12) | 0.5 / 0.0 | p < 0.4, 4.0, 49 %, 46 % | p < 0.3, 3.0, 32 %, 36 % |
| 1/52 | 2 | 0.5 | 4 | 3 / 6 | 8.5 % (5 to 13) | 10.0 % (7 to 15) | 0.5 / 0.0 | p < 0.5, 0.0, 8 %, 10 % | p < 0.5, 0.5, 8 %, 10 % |
| 1/52 | 4 | 0.2 | 4 | 5 / 6 | 12.0 % (8 to 17) | 13.0 % (9 to 18) | 0.0 / 0.0 | p < 0.5, 0.5, 43 %, 44 % | p < 0.5, 2.5, 43 %, 44 % |
| 1/104 | 2 | 0.5 | 4 | 2 / 4 | 6.0 % (3 to 10) | 6.5 % (4 to 11) | 0.0 / 0.0 | p < 0.5, 0.0, 6 %, 6 % | p < 0.5, 0.0, 6 %, 6 % |
| 1/104 | 4 | 0.3 | 4 | 6 / 6 | 15.0 % (11 to 21) | 13.5 % (9 to 19) | 0.0 / 0.0 | p < 0.5, 0.5, 30 %, 33 % | p < 0.5, 1.0, 30 %, 33 % |
| 1/208 | 2 | 0.5 | 2 | 1 / 3 | 2.5 % (1 to 6) | 5.5 % (3 to 10) | 0.0 / 0.0 | p < 0.5, 0.0, 2 %, 6 % | p < 0.5, 0.0, 2 %, 6 % |
| 1/208 | 4 | 0.4 | 2 | 7 / 6 | 16.5 % (12 to 22) | 12.0 % (8 to 17) | 0.0 / 0.0 | p < 0.5, 0.0, 24 %, 19 % | p < 0.5, 0.0, 24 %, 19 % |

**counts** (computed):

| H | w | tuning level p < | tuning noise a year | tuning rare / common (of 40) | rare k = 4 at that level | common ESBL k = 4 | D4 all / cluster a year | D5 headline: level, noise, rare, common | same curve, whole-tool noise <= 5: level, noise, rare, common |
|---|---|---|---|---|---|---|---|---|---|
| 1/26 | 2 | 0.5 | 4 | 8 / 8 | 1.5 % (1 to 4) | 1.0 % (0 to 4) | 1.5 / 1.5 | p < 0.5, 1.5, 2 %, 1 % | p < 0.5, 1.5, 2 %, 1 % |
| 1/26 | 4 | 0.1 | 2 | 3 / 5 | 0.0 % (0 to 2) | 0.0 % (0 to 2) | 0.0 / 0.0 | p < 0.4, 4.0, 12 %, 12 % | p < 0.4, 4.0, 12 %, 12 % |
| 1/52 | 2 | 0.5 | 4 | 3 / 6 | 1.5 % (1 to 4) | 0.0 % (0 to 2) | 0.0 / 0.0 | p < 0.5, 0.0, 2 %, 0 % | p < 0.5, 0.0, 2 %, 0 % |
| 1/52 | 4 | 0.2 | 4 | 5 / 6 | 0.5 % (0 to 3) | 0.5 % (0 to 3) | 0.0 / 0.0 | p < 0.5, 0.5, 9 %, 10 % | p < 0.5, 0.5, 9 %, 10 % |
| 1/104 | 2 | 0.5 | 4 | 2 / 4 | 0.5 % (0 to 3) | 0.0 % (0 to 2) | 0.0 / 0.0 | p < 0.5, 0.0, 0 %, 0 % | p < 0.5, 0.0, 0 %, 0 % |
| 1/104 | 4 | 0.3 | 4 | 6 / 6 | 0.5 % (0 to 3) | 1.0 % (0 to 4) | 0.0 / 0.0 | p < 0.5, 0.5, 4 %, 6 % | p < 0.5, 0.5, 4 %, 6 % |
| 1/208 | 2 | 0.5 | 2 | 1 / 3 | 0.0 % (0 to 2) | 0.0 % (0 to 2) | 0.0 / 0.0 | p < 0.5, 0.0, 0 %, 0 % | p < 0.5, 0.0, 0 %, 0 % |
| 1/208 | 4 | 0.4 | 2 | 7 / 6 | 0.5 % (0 to 3) | 1.0 % (0 to 4) | 0.0 / 0.0 | p < 0.5, 0.0, 2 %, 2 % | p < 0.5, 0.0, 2 %, 2 % |

**%R** (computed):

| H | w | tuning level p < | tuning noise a year | tuning rare / common (of 40) | rare k = 4 at that level | common ESBL k = 4 | D4 all / cluster a year | D5 headline: level, noise, rare, common | same curve, whole-tool noise <= 5: level, noise, rare, common |
|---|---|---|---|---|---|---|---|---|---|
| 1/26 | 2 | 0.5 | 4 | 8 / 8 | 12.5 % (9 to 18) | 13.0 % (9 to 18) | 5.0 / 0.0 | p < 0.5, 0.0, 12 %, 13 % | p < 0.4, 2.0, 8 %, 10 % |
| 1/26 | 4 | 0.1 | 2 | 3 / 5 | 7.0 % (4 to 11) | 7.5 % (5 to 12) | 0.5 / 0.0 | p < 0.5, 0.0, 57 %, 54 % | p < 0.3, 2.5, 30 %, 34 % |
| 1/52 | 2 | 0.5 | 4 | 3 / 6 | 7.0 % (4 to 11) | 10.0 % (7 to 15) | 0.5 / 0.0 | p < 0.5, 0.0, 7 %, 10 % | p < 0.5, 0.5, 7 %, 10 % |
| 1/52 | 4 | 0.2 | 4 | 5 / 6 | 11.5 % (8 to 17) | 12.5 % (9 to 18) | 0.0 / 0.0 | p < 0.5, 0.0, 38 %, 40 % | p < 0.5, 2.0, 38 %, 40 % |
| 1/104 | 2 | 0.5 | 4 | 2 / 4 | 5.5 % (3 to 10) | 6.5 % (4 to 11) | 0.0 / 0.0 | p < 0.5, 0.0, 6 %, 6 % | p < 0.5, 0.0, 6 %, 6 % |
| 1/104 | 4 | 0.3 | 4 | 6 / 6 | 14.5 % (10 to 20) | 12.5 % (9 to 18) | 0.0 / 0.0 | p < 0.5, 0.0, 28 %, 30 % | p < 0.5, 0.5, 28 %, 30 % |
| 1/208 | 2 | 0.5 | 2 | 1 / 3 | 2.5 % (1 to 6) | 5.5 % (3 to 10) | 0.0 / 0.0 | p < 0.5, 0.0, 2 %, 6 % | p < 0.5, 0.0, 2 %, 6 % |
| 1/208 | 4 | 0.4 | 2 | 7 / 6 | 16.0 % (12 to 22) | 11.0 % (7 to 16) | 0.0 / 0.0 | p < 0.5, 0.0, 23 %, 18 % | p < 0.5, 0.0, 23 %, 18 % |

## Beyond the plan: a broader new-segment prior (exploratory)

The plan's count prior is Gamma(1, rate 1/m): an exponential with the unit's hospital-implied weekly rate m as its mean, which gives little mass to a segment at 10 to 20 times that rate (the size of an injected cluster of 4 within 14 days, or E1). To see whether the weak counts row comes from that choice, the prior's mean is multiplied by c (shape still 1; %R priors unchanged); for each c the setting and level are chosen on the tuning year by the plan's rule and the row is scored as above. **Proposed (overnight), pending Artem; not part of the plan; c = 4 and 16 are arbitrary.**

| prior mean x c | chosen on tuning: H, w, level | tuning rare / common of 40 | row | rare k = 4 | common ESBL k = 4 | D4 all / cluster a year | D5 headline: level, noise, rare, common | whole-tool noise <= 5: level, noise, rare, common |
|---|---|---|---|---|---|---|---|---|
| 1 (the plan's) | 1/26, 2, p < 0.5 | 8 / 8 (noise 4) | counts and %R | 14.0 % (10 to 19) | 13.5 % (9 to 19) | 6.5 / 1.5 | p < 0.5, 1.5, 14 %, 14 % | p < 0.4, 2.0, 10 %, 10 % |
| 1 (the plan's) | 1/26, 2, p < 0.5 | 8 / 8 (noise 4) | counts | 1.5 % (1 to 4) | 1.0 % (0 to 4) | 1.5 / 1.5 | p < 0.5, 1.5, 2 %, 1 % | p < 0.5, 1.5, 2 %, 1 % |
| 1 (the plan's) | 1/26, 2, p < 0.5 | 8 / 8 (noise 4) | %R | 12.5 % (9 to 18) | 13.0 % (9 to 18) | 5.0 / 0.0 | p < 0.5, 0.0, 12 %, 13 % | p < 0.4, 2.0, 8 %, 10 % |
| 4 | 1/208, 4, p < 0.3 | 11 / 15 (noise 4) | counts and %R | 18.0 % (13 to 24) | 17.0 % (12 to 23) | 0.0 / 0.0 | p < 0.5, 2.0, 48 %, 32 % | p < 0.5, 2.0, 48 %, 32 % |
| 4 | 1/208, 4, p < 0.3 | 11 / 15 (noise 4) | counts | 12.5 % (9 to 18) | 14.0 % (10 to 19) | 0.0 / 0.0 | p < 0.5, 2.0, 38 %, 28 % | p < 0.5, 2.0, 38 %, 28 % |
| 4 | 1/208, 4, p < 0.3 | 11 / 15 (noise 4) | %R | 10.0 % (7 to 15) | 8.5 % (5 to 13) | 0.0 / 0.0 | p < 0.5, 0.0, 23 %, 18 % | p < 0.5, 0.0, 23 %, 18 % |
| 16 | 1/26, 4, p < 0.1 | 13 / 18 (noise 4) | counts and %R | 29.5 % (24 to 36) | 23.5 % (18 to 30) | 2.5 / 2.0 | p < 0.1, 2.0, 30 %, 24 % | p < 0.1, 2.5, 30 %, 24 % |
| 16 | 1/26, 4, p < 0.1 | 13 / 18 (noise 4) | counts | 28.0 % (22 to 35) | 21.0 % (16 to 27) | 2.0 / 2.0 | p < 0.1, 2.0, 28 %, 21 % | p < 0.1, 2.0, 28 %, 21 % |
| 16 | 1/26, 4, p < 0.1 | 13 / 18 (noise 4) | %R | 7.0 % (4 to 11) | 7.5 % (5 to 12) | 0.5 / 0.0 | p < 0.5, 0.0, 57 %, 54 % | p < 0.3, 2.5, 30 %, 34 % |

## Figures

`figure.png`: the card for E1 (URO, ESBL) at the chosen setting; as of the week ending 2025-06-15 the modal change week is index 86 (80 % interval 80 to 87), m_t = 0.04, the weekly rate since the modal change 1.74 against 0.33 before it (the gate's means over runs shorter than w and over the others, 0.34 and 1.57; at w = 2 two weeks after the change they straddle it) (computed); the first E1-matching signal (D1's matcher, to 2025-08-31) is none at the chosen level, at the loosest level p < 0.9 2025-06-04. `d5_curve.png`: detection at k = 4 against the whole tool's episodes a year, every level of the extended grid (hollow markers: the four exploratory looser levels), the three rows and the two live rows.

