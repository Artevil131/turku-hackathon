# 0015 Gamma-Poisson surprise with a guard band: results

All numbers computed by this run (`aei.score_detection`), seed 2026, 200 trials per injection cell, scoring period 2024-10-01 to 2026-09-27 (727 days, 1.99 years), unless tagged otherwise. Baseline rows are the committed ones of `benchmarks/overnight-2026-10-17/baselines/` (same harness).

Run time 320.0 s CPU.

Sweep time: 328.1 s wall.

## Tuning year: one row per setting at its operating level

Injected on the tuning year (seed 2026, 40 rare and 40 common ESBL E. coli clusters of k = 4, starts 2024-04-01 to 2024-08-15, the detector sees nothing after 2024-09-30), noise over 2024-04-01 to 2024-09-30 scaled to a year (one episode is 2.0 a year). Operating level: the loosest level with noise at most 5 a year. Ranked by the plan's rule.

| rank | setting | level q < | noise a year (episodes) | rare k 4 | common ESBL k 4 |
|---|---|---|---|---|---|
| 1 | S 26 g 0 L 1 | 0.005 | 3.99 (2) | 15/40, 4 d | 19/40, 4 d |
| 2 | S 13 g 0 L 1 | 0.001 | 2.00 (1) | 8/40, 4 d | 11/40, 4 d |
| 3 | S 26 g 4 L 4 | 0.01 | 3.99 (2) | 8/40, 12 d | 11/40, 12 d |
| 4 | S 26 g 0 L 4 | 0.005 | 3.99 (2) | 7/40, 8 d | 13/40, 12 d |
| 5 | S 26 g 4 L 1 | 0.001 | 2.00 (1) | 7/40, 5 d | 10/40, 4 d |
| 6 | S 13 g 0 L 4 | 0.001 | 0.00 (0) | 4/40, 16 d | 5/40, 11 d |
| 7 | S 13 g 4 L 1 | 0.0001 | 0.00 (0) | 4/40, 5 d | 3/40, 4 d |
| 8 | S 13 g 4 L 4 | 0.001 | 2.00 (1) | 2/40, 3 d | 2/40, 3 d |

Chosen: **S 26 g 0 L 1** at q < 0.005.

## Tuning year: every setting at every level

| setting | level | noise a year (episodes) | rare k 4 | delay d | common ESBL k 4 | delay d |
|---|---|---|---|---|---|---|
| S 13 g 0 L 1 | 0.2 | 233.52 (117) | 40/40 | 2 | 40/40 | 2 |
| S 13 g 0 L 1 | 0.1 | 119.75 (60) | 35/40 | 3 | 36/40 | 3 |
| S 13 g 0 L 1 | 0.05 | 41.91 (21) | 28/40 | 3 | 33/40 | 4 |
| S 13 g 0 L 1 | 0.02 | 21.95 (11) | 20/40 | 2 | 23/40 | 3 |
| S 13 g 0 L 1 | 0.01 | 15.97 (8) | 18/40 | 4 | 19/40 | 3 |
| S 13 g 0 L 1 | 0.005 | 9.98 (5) | 13/40 | 4 | 15/40 | 3 |
| S 13 g 0 L 1 | 0.001 | 2.00 (1) | 8/40 | 4 | 11/40 | 4 |
| S 13 g 0 L 1 | 0.0001 | 0.00 (0) | 3/40 | 5 | 5/40 | 5 |
| S 13 g 0 L 4 | 0.2 | 95.80 (48) | 31/40 | 7 | 35/40 | 6 |
| S 13 g 0 L 4 | 0.1 | 43.91 (22) | 28/40 | 9 | 33/40 | 6 |
| S 13 g 0 L 4 | 0.05 | 25.95 (13) | 24/40 | 10 | 26/40 | 10 |
| S 13 g 0 L 4 | 0.02 | 17.96 (9) | 16/40 | 11 | 17/40 | 8 |
| S 13 g 0 L 4 | 0.01 | 11.98 (6) | 14/40 | 11 | 16/40 | 9 |
| S 13 g 0 L 4 | 0.005 | 9.98 (5) | 10/40 | 12 | 10/40 | 9 |
| S 13 g 0 L 4 | 0.001 | 0.00 (0) | 4/40 | 16 | 5/40 | 11 |
| S 13 g 0 L 4 | 0.0001 | 0.00 (0) | 0/40 | not found | 0/40 | not found |
| S 13 g 4 L 1 | 0.2 | 245.50 (123) | 39/40 | 2 | 40/40 | 2 |
| S 13 g 4 L 1 | 0.1 | 123.75 (62) | 35/40 | 3 | 35/40 | 3 |
| S 13 g 4 L 1 | 0.05 | 67.86 (34) | 28/40 | 3 | 32/40 | 3 |
| S 13 g 4 L 1 | 0.02 | 27.94 (14) | 24/40 | 3 | 29/40 | 4 |
| S 13 g 4 L 1 | 0.01 | 19.96 (10) | 19/40 | 4 | 23/40 | 4 |
| S 13 g 4 L 1 | 0.005 | 13.97 (7) | 11/40 | 4 | 19/40 | 4 |
| S 13 g 4 L 1 | 0.001 | 7.98 (4) | 10/40 | 6 | 17/40 | 5 |
| S 13 g 4 L 1 | 0.0001 | 0.00 (0) | 4/40 | 5 | 3/40 | 4 |
| S 13 g 4 L 4 | 0.2 | 75.84 (38) | 32/40 | 6 | 34/40 | 4 |
| S 13 g 4 L 4 | 0.1 | 43.91 (22) | 25/40 | 10 | 27/40 | 7 |
| S 13 g 4 L 4 | 0.05 | 15.97 (8) | 18/40 | 10 | 23/40 | 8 |
| S 13 g 4 L 4 | 0.02 | 9.98 (5) | 14/40 | 11 | 19/40 | 8 |
| S 13 g 4 L 4 | 0.01 | 5.99 (3) | 9/40 | 11 | 15/40 | 11 |
| S 13 g 4 L 4 | 0.005 | 5.99 (3) | 9/40 | 11 | 11/40 | 11 |
| S 13 g 4 L 4 | 0.001 | 2.00 (1) | 2/40 | 3 | 2/40 | 3 |
| S 13 g 4 L 4 | 0.0001 | 2.00 (1) | 0/40 | not found | 0/40 | not found |
| S 26 g 0 L 1 | 0.2 | 237.51 (119) | 40/40 | 2 | 40/40 | 2 |
| S 26 g 0 L 1 | 0.1 | 131.73 (66) | 36/40 | 3 | 36/40 | 3 |
| S 26 g 0 L 1 | 0.05 | 79.84 (40) | 29/40 | 4 | 33/40 | 3 |
| S 26 g 0 L 1 | 0.02 | 17.96 (9) | 21/40 | 4 | 27/40 | 3 |
| S 26 g 0 L 1 | 0.01 | 15.97 (8) | 17/40 | 4 | 23/40 | 3 |
| S 26 g 0 L 1 | 0.005 | 3.99 (2) | 15/40 | 4 | 19/40 | 4 |
| S 26 g 0 L 1 | 0.001 | 2.00 (1) | 5/40 | 4 | 10/40 | 4 |
| S 26 g 0 L 1 | 0.0001 | 0.00 (0) | 3/40 | 5 | 8/40 | 5 |
| S 26 g 0 L 4 | 0.2 | 73.85 (37) | 33/40 | 9 | 33/40 | 6 |
| S 26 g 0 L 4 | 0.1 | 39.92 (20) | 22/40 | 8 | 29/40 | 7 |
| S 26 g 0 L 4 | 0.05 | 23.95 (12) | 19/40 | 8 | 22/40 | 10 |
| S 26 g 0 L 4 | 0.02 | 5.99 (3) | 13/40 | 8 | 18/40 | 10 |
| S 26 g 0 L 4 | 0.01 | 5.99 (3) | 8/40 | 8 | 14/40 | 12 |
| S 26 g 0 L 4 | 0.005 | 3.99 (2) | 7/40 | 8 | 13/40 | 12 |
| S 26 g 0 L 4 | 0.001 | 2.00 (1) | 3/40 | 15 | 5/40 | 9 |
| S 26 g 0 L 4 | 0.0001 | 0.00 (0) | 0/40 | not found | 2/40 | 9 |
| S 26 g 4 L 1 | 0.2 | 209.57 (105) | 29/40 | 1 | 34/40 | 2 |
| S 26 g 4 L 1 | 0.1 | 131.73 (66) | 28/40 | 3 | 30/40 | 3 |
| S 26 g 4 L 1 | 0.05 | 79.84 (40) | 21/40 | 3 | 28/40 | 3 |
| S 26 g 4 L 1 | 0.02 | 15.97 (8) | 17/40 | 4 | 22/40 | 3 |
| S 26 g 4 L 1 | 0.01 | 11.98 (6) | 15/40 | 4 | 18/40 | 3 |
| S 26 g 4 L 1 | 0.005 | 5.99 (3) | 14/40 | 5 | 17/40 | 4 |
| S 26 g 4 L 1 | 0.001 | 2.00 (1) | 7/40 | 5 | 10/40 | 4 |
| S 26 g 4 L 1 | 0.0001 | 0.00 (0) | 3/40 | 5 | 4/40 | 5 |
| S 26 g 4 L 4 | 0.2 | 73.85 (37) | 23/40 | 7 | 26/40 | 4 |
| S 26 g 4 L 4 | 0.1 | 39.92 (20) | 17/40 | 6 | 25/40 | 8 |
| S 26 g 4 L 4 | 0.05 | 17.96 (9) | 15/40 | 8 | 19/40 | 10 |
| S 26 g 4 L 4 | 0.02 | 5.99 (3) | 9/40 | 8 | 13/40 | 12 |
| S 26 g 4 L 4 | 0.01 | 3.99 (2) | 8/40 | 12 | 11/40 | 12 |
| S 26 g 4 L 4 | 0.005 | 2.00 (1) | 4/40 | 8 | 7/40 | 8 |
| S 26 g 4 L 4 | 0.001 | 2.00 (1) | 1/40 | 10 | 4/40 | 9 |
| S 26 g 4 L 4 | 0.0001 | 0.00 (0) | 0/40 | not found | 2/40 | 9 |

## S 26 g 0 L 1 against the two live-set rows

Chosen at q < 0.005 (year-1 level) for D1 to D4, D6, D7, I1; D5 at its own headline level. Intervals: Wilson 95 % for rates, exact Poisson 95 % for D4 episodes a year. D3 is a data-signal metric: this test raises no data signals, so it is 0 by construction and is not a result. D4 and D5 count every signal of this test as a cluster signal.

| metric | chosen S 26 g 0 L 1 | chosen + budget | live re-tuned year 1 | live shipped (tuned on test) |
|---|---|---|---|---|
| D1 E1, days | 6 | 6 | 0 | 0 |
| D1 E1_corrected, days | 11 | 11 | 5 | 5 |
| D1 E2, days | 2 | 2 | 0 | 0 |
| D1 E2_corrected, days | 2 | 2 | 0 | 0 |
| D1 E3, days | not found | not found | 0 | 0 |
| D1 E4, first trend signal | not found | not found | 2026-02-15 | 2026-05-10 |
| D3 gap2 | 0.0 % (0.0 to 1.9) | 0.0 % (0.0 to 1.9) | 65.5 % (58.7 to 71.7) | 64.0 % (57.1 to 70.3) |
| D3 gap3 | 0.0 % (0.0 to 1.9) | 0.0 % (0.0 to 1.9) | 95.0 % (91.0 to 97.3) | 94.5 % (90.4 to 96.9) |
| D3 gap5 | 0.0 % (0.0 to 1.9) | 0.0 % (0.0 to 1.9) | 100.0 % (98.1 to 100.0) | 100.0 % (98.1 to 100.0) |
| D3 gap7 | 0.0 % (0.0 to 1.9) | 0.0 % (0.0 to 1.9) | 100.0 % (98.1 to 100.0) | 100.0 % (98.1 to 100.0) |
| D3 half7 | 0.0 % (0.0 to 1.9) | 0.0 % (0.0 to 1.9) | 43.0 % (36.3 to 49.9) | 28.0 % (22.2 to 34.6) |
| D4 episodes a year, all | 5.02 (10 ep.; 2.41 to 9.24) | 5.02 (10 ep.; 2.41 to 9.24) | 9.55 (19 ep.; 5.75 to 14.91) | 4.52 (9 ep.; 2.07 to 8.58) |
| D4 cluster | 5.02 (10 ep.; 2.41 to 9.24) | 5.02 (10 ep.; 2.41 to 9.24) | 4.52 (9 ep.; 2.07 to 8.58) | 1.00 (2 ep.; 0.12 to 3.63) |
| D4 sentinel | 0.00 (0 ep.; 0.00 to 1.85) | 0.00 (0 ep.; 0.00 to 1.85) | 1.51 (3 ep.; 0.31 to 4.40) | 1.51 (3 ep.; 0.31 to 4.40) |
| D4 data | 0.00 (0 ep.; 0.00 to 1.85) | 0.00 (0 ep.; 0.00 to 1.85) | 3.52 (7 ep.; 1.41 to 7.25) | 2.01 (4 ep.; 0.55 to 5.15) |
| D4 trend | 0.00 (0 ep.; 0.00 to 1.85) | 0.00 (0 ep.; 0.00 to 1.85) | 0.00 (0 ep.; 0.00 to 1.85) | 0.00 (0 ep.; 0.00 to 1.85) |
| D4 divergence | 0.00 (0 ep.; 0.00 to 1.85) | 0.00 (0 ep.; 0.00 to 1.85) | 0.00 (0 ep.; 0.00 to 1.85) | 0.00 (0 ep.; 0.00 to 1.85) |
| D4 alerts a week | 0.096 (10 alerts) | 0.096 (10 alerts) | 0.183 (19 alerts) | 0.087 (9 alerts) |
| D5 level | 0.001 | 0.001 | 0.3 | 3 |
| D5 noise at headline, episodes a year | 1.00 (2 ep.) | 1.00 (2 ep.) | 3.01 (6 ep.) | 3.01 (6 ep.) |
| D5 rare, k = 4 | 20.5 % (15.5 to 26.6) | 20.5 % (15.5 to 26.6) | 92.0 % (87.4 to 95.0) | 92.0 % (87.4 to 95.0) |
| D5 rare delay, days | 5 | 5 | 6 | 6 |
| D5 common ESBL, k = 4 | 9.5 % (6.2 to 14.4) | 9.5 % (6.2 to 14.4) | 75.0 % (68.6 to 80.5) | 75.0 % (68.6 to 80.5) |
| D5 common ESBL delay, days | 5 | 5 | 6 | 6 |
| D6, injected gaps with a non-data signal | 1.90 % (1.22 to 2.95), n 1000 | 1.90 % (1.22 to 2.95), n 1000 | 2.60 % (1.78 to 3.78), n 1000 | 1.20 % (0.69 to 2.09), n 1000 |
| D7, named right | 99.8 % (99.1 to 100.0), n 617 | 99.8 % (99.1 to 100.0), n 617 | 98.7 % (98.1 to 99.1), n 2493 | 97.4 % (96.6 to 98.0), n 1982 |
| I1 alerts, incidents, per incident | 13, 12, 1.08 | 13, 12, 1.08 | 29, 26, 1.12 | 18, 15, 1.20 |

The live rows' D1 to D3, D6 and D7 are read at their operating levels (re-tuned alphas, shipped alphas).

## The noise episodes of the chosen setting

The 10 episodes of D4 at q < 0.005 over the scoring period (fixed key, planted and quarantined zones left out), by first signal: count in the window, predictive mean, q. 0 are phenotype series and 10 organism x specimen series; 5 have a predictive mean under 0.1. Tested series per day at the chosen setting: 27.5 with both families, 0.7 with the phenotype series only.

| first signal | series | count y | predictive mean | q | signals |
|---|---|---|---|---|---|
| 2025-01-13 | SURG|Escherichia coli|blood | 4 | 0.08 | 2.3e-04 | 1 |
| 2025-02-02 | MED-A|Enterococcus faecalis|blood | 2 | 0.00 | 1.3e-03 | 3 |
| 2025-03-12 | GER|Enterococcus faecalis|blood | 2 | 0.00 | 1.5e-03 | 1 |
| 2025-05-24 | ED|Escherichia coli|urine | 25 | 10.51 | 4.2e-03 | 2 |
| 2025-06-05 | GER|Escherichia coli|blood | 3 | 0.05 | 2.6e-03 | 2 |
| 2025-07-31 | GER|Proteus mirabilis|urine | 5 | 0.44 | 4.5e-03 | 1 |
| 2025-10-06 | ED|Citrobacter freundii|blood | 2 | 0.00 | 2.6e-04 | 6 |
| 2026-03-16 | PHC-N|Klebsiella oxytoca|urine | 5 | 0.43 | 4.3e-03 | 1 |
| 2026-03-18 | ED|Klebsiella oxytoca|urine | 5 | 0.50 | 4.4e-03 | 1 |
| 2026-06-16 | PHC-N|Klebsiella pneumoniae|urine | 11 | 2.26 | 1.2e-03 | 1 |

## D2 and D2 delay, every family and k

Rate with 95 % Wilson interval, median delay in days from the first injected isolate. Blocks of 40: detections in the five consecutive blocks of 40 trials of the same stream (a descriptive spread, not independent runs).

| family | k | chosen, no budget | delay d | blocks of 40 | chosen, budget | delay d | live re-tuned | live shipped |
|---|---|---|---|---|---|---|---|---|
| rare clone | control | 1.5 % (0.5 to 4.3) | 15 | 0 / 1 / 0 / 0 / 2 | 1.5 % (0.5 to 4.3) | 15 | 5.0 % | 1.0 % |
| rare clone | 2 | 8.0 % (5.0 to 12.6) | 2 | 3 / 3 / 6 / 2 / 2 | 8.0 % (5.0 to 12.6) | 2 | 38.0 % | 16.5 % |
| rare clone | 3 | 20.0 % (15.0 to 26.1) | 4 | 9 / 8 / 9 / 7 / 7 | 20.0 % (15.0 to 26.1) | 4 | 86.0 % | 61.5 % |
| rare clone | 4 | 37.5 % (31.1 to 44.4) | 4 | 13 / 15 / 14 / 16 / 17 | 37.5 % (31.1 to 44.4) | 4 | 98.0 % | 89.0 % |
| rare clone | 6 | 67.0 % (60.2 to 73.1) | 5 | 26 / 22 / 30 / 30 / 26 | 67.0 % (60.2 to 73.1) | 5 | 100.0 % | 100.0 % |
| common resistant | control | 0.5 % (0.1 to 2.8) | 12 | 0 / 1 / 0 / 0 / 0 | 0.5 % (0.1 to 2.8) | 12 | 0.0 % | 0.0 % |
| common resistant | 2 | 0.5 % (0.1 to 2.8) | 0 | 0 / 0 / 1 / 0 / 0 | 0.5 % (0.1 to 2.8) | 0 | 1.5 % | 1.0 % |
| common resistant | 3 | 3.5 % (1.7 to 7.0) | 17 | 3 / 2 / 1 / 0 / 1 | 3.5 % (1.7 to 7.0) | 17 | 2.0 % | 0.5 % |
| common resistant | 4 | 3.5 % (1.7 to 7.0) | 3 | 3 / 1 / 1 / 0 / 2 | 3.5 % (1.7 to 7.0) | 3 | 1.0 % | 0.5 % |
| common resistant | 6 | 7.5 % (4.6 to 12.0) | 6 | 3 / 3 / 4 / 2 / 3 | 7.5 % (4.6 to 12.0) | 6 | 3.5 % | 0.0 % |
| wild type | control | 1.0 % (0.3 to 3.6) | 7 | 1 / 0 / 1 / 0 / 0 | 1.0 % (0.3 to 3.6) | 7 | 1.0 % | 0.0 % |
| wild type | 2 | 2.5 % (1.1 to 5.7) | 4 | 0 / 1 / 2 / 2 / 0 | 2.5 % (1.1 to 5.7) | 4 | 0.5 % | 0.0 % |
| wild type | 3 | 1.5 % (0.5 to 4.3) | 4 | 0 / 0 / 2 / 1 / 0 | 1.5 % (0.5 to 4.3) | 4 | 0.5 % | 0.0 % |
| wild type | 4 | 4.5 % (2.4 to 8.3) | 6 | 2 / 3 / 1 / 2 / 1 | 4.5 % (2.4 to 8.3) | 6 | 0.0 % | 0.0 % |
| wild type | 6 | 4.0 % (2.0 to 7.7) | 10 | 1 / 1 / 2 / 2 / 2 | 4.0 % (2.0 to 7.7) | 10 | 0.0 % | 0.0 % |
| common ESBL E. coli | control | 1.0 % (0.3 to 3.6) | 0 | 0 / 0 / 2 / 0 / 0 | 1.0 % (0.3 to 3.6) | 0 | 6.5 % | 0.0 % |
| common ESBL E. coli | 2 | 2.5 % (1.1 to 5.7) | 4 | 1 / 1 / 1 / 0 / 2 | 2.5 % (1.1 to 5.7) | 4 | 26.5 % | 4.5 % |
| common ESBL E. coli | 3 | 8.0 % (5.0 to 12.6) | 4 | 5 / 0 / 3 / 3 / 5 | 8.0 % (5.0 to 12.6) | 4 | 70.0 % | 34.5 % |
| common ESBL E. coli | 4 | 24.0 % (18.6 to 30.4) | 5 | 13 / 7 / 9 / 11 / 8 | 24.0 % (18.6 to 30.4) | 5 | 88.0 % | 61.0 % |
| common ESBL E. coli | 6 | 56.0 % (49.1 to 62.7) | 5 | 25 / 22 / 22 / 22 / 21 | 56.0 % (49.1 to 62.7) | 5 | 99.5 % | 94.5 % |
| two units | control | 4.5 % (2.4 to 8.3) | 9 | 1 / 4 / 3 / 0 / 1 | 4.5 % (2.4 to 8.3) | 9 | 7.5 % | 2.0 % |
| two units | 2 | 0.5 % (0.1 to 2.8) | 0 | 0 / 0 / 1 / 0 / 0 | 0.5 % (0.1 to 2.8) | 0 | 25.5 % | 13.5 % |
| two units | 3 | 12.5 % (8.6 to 17.8) | 5 | 3 / 6 / 2 / 7 / 7 | 12.5 % (8.6 to 17.8) | 5 | 47.5 % | 21.0 % |
| two units | 4 | 13.5 % (9.4 to 18.9) | 6 | 8 / 4 / 8 / 6 / 1 | 13.5 % (9.4 to 18.9) | 6 | 56.5 % | 24.0 % |
| two units | 6 | 30.5 % (24.5 to 37.2) | 7 | 15 / 14 / 12 / 9 / 11 | 30.5 % (24.5 to 37.2) | 7 | 96.5 % | 80.5 % |

## Where the detections of the chosen setting come from

Cells of the same stream, read at the chosen level. Large units: ED, PHC-N, PHC-S. A detection counts through a phenotype series when an accepted signal of the trial has a phenotype, through an organism series when it has an organism (both can be true).

| family | k | detected | via phenotype series | via organism series | large units | other units | source ESBL, source MRSA |
|---|---|---|---|---|---|---|---|
| rare clone | 3 | 40/200 | 29 | 19 | 7/74 | 33/126 | 23/164, 17/36 |
| rare clone | 4 | 75/200 | 64 | 26 | 12/62 | 63/138 | 51/165, 24/35 |
| rare clone | 6 | 134/200 | 126 | 46 | 28/63 | 106/137 | 96/159, 38/41 |
| common ESBL E. coli | 3 | 16/200 | 14 | 2 | 4/100 | 12/100 |  |
| common ESBL E. coli | 4 | 48/200 | 47 | 5 | 12/100 | 36/100 |  |
| common ESBL E. coli | 6 | 112/200 | 110 | 14 | 35/100 | 77/100 |  |

## D5 curve, chosen setting, no budget

| level | noise, episodes a year (count) | whole tool | rare k 4, delay | common ESBL k 4, delay | two-unit k 4 | common resistant / wild type k 4 |
|---|---|---|---|---|---|---|
| 0.2 | 179.36 (357) | 179.36 | 195/200 (97.5 %), 2 d | 188/200 (94.0 %), 3 d | 178/200 (89.0 %) | 51.5 % / 57.5 % |
| 0.1 | 77.87 (155) | 77.87 | 174/200 (87.0 %), 4 d | 166/200 (83.0 %), 4 d | 146/200 (73.0 %) | 33.5 % / 38.0 % |
| 0.05 | 40.69 (81) | 40.69 | 148/200 (74.0 %), 4 d | 129/200 (64.5 %), 5 d | 100/200 (50.0 %) | 23.5 % / 22.5 % |
| 0.02 | 18.09 (36) | 18.09 | 109/200 (54.5 %), 4 d | 91/200 (45.5 %), 5 d | 57/200 (28.5 %) | 9.0 % / 14.0 % |
| 0.01 | 12.06 (24) | 12.06 | 91/200 (45.5 %), 4 d | 67/200 (33.5 %), 5 d | 42/200 (21.0 %) | 6.5 % / 10.0 % |
| 0.005 | 5.02 (10) | 5.02 | 75/200 (37.5 %), 4 d | 48/200 (24.0 %), 5 d | 27/200 (13.5 %) | 3.5 % / 4.5 % |
| 0.001 | 1.00 (2) | 1.00 | 41/200 (20.5 %), 5 d | 19/200 (9.5 %), 5 d | 6/200 (3.0 %) | 2.0 % / 1.5 % |
| 0.0001 | 0.00 (0) | 0.00 | 17/200 (8.5 %), 5 d | 1/200 (0.5 %), 2 d | 0/200 (0.0 %) | 1.0 % / 0.0 % |

## D5 curve, chosen setting, with the budget

| level | noise, episodes a year (count) | whole tool | rare k 4, delay | common ESBL k 4, delay | two-unit k 4 | common resistant / wild type k 4 |
|---|---|---|---|---|---|---|
| 0.2 | 106.51 (212) | 106.51 | 184/200 (92.0 %), 3 d | 174/200 (87.0 %), 4 d | 165/200 (82.5 %) | 42.5 % / 42.5 % |
| 0.1 | 66.32 (132) | 66.32 | 170/200 (85.0 %), 4 d | 159/200 (79.5 %), 4 d | 136/200 (68.0 %) | 31.0 % / 32.5 % |
| 0.05 | 37.68 (75) | 37.68 | 145/200 (72.5 %), 4 d | 126/200 (63.0 %), 5 d | 98/200 (49.0 %) | 22.0 % / 21.5 % |
| 0.02 | 18.09 (36) | 18.09 | 109/200 (54.5 %), 4 d | 90/200 (45.0 %), 5 d | 57/200 (28.5 %) | 9.0 % / 14.0 % |
| 0.01 | 12.06 (24) | 12.06 | 91/200 (45.5 %), 4 d | 66/200 (33.0 %), 5 d | 42/200 (21.0 %) | 6.5 % / 10.0 % |
| 0.005 | 5.02 (10) | 5.02 | 75/200 (37.5 %), 4 d | 48/200 (24.0 %), 5 d | 27/200 (13.5 %) | 3.5 % / 4.5 % |
| 0.001 | 1.00 (2) | 1.00 | 41/200 (20.5 %), 5 d | 19/200 (9.5 %), 5 d | 6/200 (3.0 %) | 2.0 % / 1.5 % |
| 0.0001 | 0.00 (0) | 0.00 | 17/200 (8.5 %), 5 d | 1/200 (0.5 %), 2 d | 0/200 (0.0 %) | 1.0 % / 0.0 % |

## D5 curve, live set re-tuned on year 1 (committed row)

| level | noise, episodes a year (count) | whole tool | rare k 4, delay | common ESBL k 4, delay | two-unit k 4 | common resistant / wild type k 4 |
|---|---|---|---|---|---|---|
| 100 | 82.90 (165) | 86.41 | 200/200 (100.0 %), 0 d | 200/200 (100.0 %), 0 d | 200/200 (100.0 %) | 85.5 % / 51.5 % |
| 30 | 60.79 (121) | 64.31 | 200/200 (100.0 %), 0 d | 200/200 (100.0 %), 0 d | 200/200 (100.0 %) | 45.5 % / 22.5 % |
| 10 | 34.67 (69) | 38.18 | 200/200 (100.0 %), 2 d | 198/200 (99.0 %), 2 d | 185/200 (92.5 %) | 13.5 % / 7.0 % |
| 3 | 13.56 (27) | 17.08 | 200/200 (100.0 %), 4 d | 194/200 (97.0 %), 5 d | 151/200 (75.5 %) | 4.0 % / 1.5 % |
| 1 | 6.03 (12) | 9.55 | 196/200 (98.0 %), 5 d | 176/200 (88.0 %), 6 d | 113/200 (56.5 %) | 1.0 % / 0.0 % |
| 0.3 | 3.01 (6) | 6.53 | 184/200 (92.0 %), 6 d | 150/200 (75.0 %), 6 d | 71/200 (35.5 %) | 0.5 % / 0.0 % |
| 0.1 | 2.51 (5) | 6.03 | 178/200 (89.0 %), 6 d | 122/200 (61.0 %), 7 d | 48/200 (24.0 %) | 0.5 % / 0.0 % |
| 0.03 | 1.51 (3) | 5.02 | 163/200 (81.5 %), 7 d | 88/200 (44.0 %), 7 d | 39/200 (19.5 %) | 0.0 % / 0.0 % |
| 0.01 | 1.51 (3) | 5.02 | 142/200 (71.0 %), 7 d | 68/200 (34.0 %), 8 d | 31/200 (15.5 %) | 0.0 % / 0.0 % |

## D5 curve, live set as shipped (committed row)

| level | noise, episodes a year (count) | whole tool | rare k 4, delay | common ESBL k 4, delay | two-unit k 4 | common resistant / wild type k 4 |
|---|---|---|---|---|---|---|
| 100 | 34.67 (69) | 36.68 | 200/200 (100.0 %), 2 d | 198/200 (99.0 %), 2 d | 185/200 (92.5 %) | 13.5 % / 7.0 % |
| 30 | 13.56 (27) | 15.57 | 200/200 (100.0 %), 4 d | 194/200 (97.0 %), 5 d | 151/200 (75.5 %) | 4.0 % / 1.5 % |
| 10 | 6.03 (12) | 8.04 | 196/200 (98.0 %), 5 d | 176/200 (88.0 %), 6 d | 113/200 (56.5 %) | 1.0 % / 0.0 % |
| 3 | 3.01 (6) | 5.02 | 184/200 (92.0 %), 6 d | 150/200 (75.0 %), 6 d | 71/200 (35.5 %) | 0.5 % / 0.0 % |
| 1 | 2.51 (5) | 4.52 | 178/200 (89.0 %), 6 d | 122/200 (61.0 %), 7 d | 48/200 (24.0 %) | 0.5 % / 0.0 % |
| 0.3 | 1.51 (3) | 3.52 | 163/200 (81.5 %), 7 d | 88/200 (44.0 %), 7 d | 39/200 (19.5 %) | 0.0 % / 0.0 % |
| 0.1 | 1.51 (3) | 3.52 | 142/200 (71.0 %), 7 d | 68/200 (34.0 %), 8 d | 31/200 (15.5 %) | 0.0 % / 0.0 % |
| 0.03 | 1.51 (3) | 3.52 | 124/200 (62.0 %), 7 d | 56/200 (28.0 %), 9 d | 23/200 (11.5 %) | 0.0 % / 0.0 % |
| 0.01 | 1.51 (3) | 3.52 | 105/200 (52.5 %), 7 d | 39/200 (19.5 %), 9 d | 20/200 (10.0 %) | 0.0 % / 0.0 % |

## Control: the live phenotype-excess test alone (Poisson) on the same phenotype series

Not part of the plan. The live phenotype-excess test (28-day window, 365-day baseline, at least 2 patients, shipped alpha 1e-3, level 1) scored through the same functions on the rare and common ESBL families only; its D4 counts only its own episodes. The level m multiplies alpha. D4 at the shipped alpha: 1.00 episodes a year (2); D5 headline: level 10, noise 4.02 a year, rare 78.0 % (71.8 to 83.2), common ESBL 70.0 % (63.3 to 75.9).

| level m | noise, episodes a year (count) | rare k 4, delay | common ESBL k 4, delay |
|---|---|---|---|
| 100 | 19.09 (38) | 195/200 (97.5 %), 2 d | 191/200 (95.5 %), 2 d |
| 30 | 7.54 (15) | 180/200 (90.0 %), 4 d | 174/200 (87.0 %), 5 d |
| 10 | 4.02 (8) | 156/200 (78.0 %), 6 d | 140/200 (70.0 %), 6 d |
| 3 | 1.51 (3) | 131/200 (65.5 %), 7 d | 106/200 (53.0 %), 7 d |
| 1 | 1.00 (2) | 112/200 (56.0 %), 9 d | 81/200 (40.5 %), 8 d |
| 0.3 | 0.00 (0) | 78/200 (39.0 %), 9 d | 54/200 (27.0 %), 9 d |
| 0.1 | 0.00 (0) | 50/200 (25.0 %), 8 d | 31/200 (15.5 %), 11 d |
| 0.03 | 0.00 (0) | 32/200 (16.0 %), 8 d | 21/200 (10.5 %), 12 d |
| 0.01 | 0.00 (0) | 18/200 (9.0 %), 9 d | 11/200 (5.5 %), 10 d |

## Control: this test on the 36 phenotype series only

Not part of the plan. The same test (BH over the phenotype series tested that day only) with the organism x specimen series left out, read at its D5 headline level on the scoring period; the live phenotype-excess test above is the Poisson counterpart on the same series.

| setting | D5 level | D5 noise a year (episodes) | rare k 4, delay | common ESBL k 4, delay | both families (grid row): noise, rare / common ESBL |
|---|---|---|---|---|---|
| S 26 g 0 L 1 | 0.005 | 3.01 (6) | 143/200 (71.5 %), 4 d | 130/200 (65.0 %), 4 d | 1.00: 20.5 % / 9.5 % |
| S 26 g 0 L 4 | 0.02 | 1.51 (3) | 133/200 (66.5 %), 7 d | 116/200 (58.0 %), 8 d | 2.51: 21.0 % / 8.0 % |
| S 26 g 4 L 1 | 0.005 | 2.01 (4) | 145/200 (72.5 %), 4 d | 136/200 (68.0 %), 4 d | 1.00: 20.5 % / 11.0 % |
| S 26 g 4 L 4 | 0.02 | 1.51 (3) | 138/200 (69.0 %), 8 d | 119/200 (59.5 %), 8 d | 3.01: 15.5 % / 8.5 % |

D5 curve of the phenotype-series-only test at S 26 g 0 L 1:

| level | noise, episodes a year (count) | rare k 4, delay | common ESBL k 4, delay |
|---|---|---|---|
| 0.2 | 25.62 (51) | 200/200 (100.0 %), 2 d | 200/200 (100.0 %), 1 d |
| 0.1 | 23.11 (46) | 199/200 (99.5 %), 2 d | 195/200 (97.5 %), 2 d |
| 0.05 | 19.59 (39) | 196/200 (98.0 %), 2 d | 192/200 (96.0 %), 3 d |
| 0.02 | 8.54 (17) | 178/200 (89.0 %), 3 d | 162/200 (81.0 %), 3 d |
| 0.01 | 5.53 (11) | 166/200 (83.0 %), 4 d | 155/200 (77.5 %), 4 d |
| 0.005 | 3.01 (6) | 143/200 (71.5 %), 4 d | 130/200 (65.0 %), 4 d |
| 0.001 | 0.50 (1) | 89/200 (44.5 %), 4 d | 80/200 (40.0 %), 5 d |
| 0.0001 | 0.00 (0) | 51/200 (25.5 %), 5 d | 28/200 (14.0 %), 5 d |

## The budget run against the no-budget run

The two runs use the same signals; the budget only drops some. Over the whole data at the chosen setting: 2148 signals emitted at q < 0.2, 52 pass q < 0.005, 52 of those survive the budget (0 dropped). D4 episodes a year 5.02 without and 5.02 with the budget; D2 rare k 4 37.5 % and 37.5 %.

## Grid on the scoring period (exploratory)

Every setting scored on the scoring period, read at its own D5 headline level (the loosest level with scoring-period noise at most 5 a year). Exploratory: a row picked here is picked on the scoring period. S 52 rows cannot be tuned on year 1 (they need 60 weeks of data).

| setting | year-1 level | D5 level | D5 noise a year (episodes) | rare k 4, delay | common ESBL k 4, delay | two-unit k 4 | I1 alerts / incidents | D7 | D1 corrected E1, E2 |
|---|---|---|---|---|---|---|---|---|---|
| S 13 g 0 L 1 | 0.001 | 0.001 | 1.51 (3) | 38/200 (19.0 %), 5 d | 19/200 (9.5 %), 5 d | 3.5 % | 5 / 5 | 99.7 % | E1 11, E2 3 |
| S 13 g 0 L 4 | 0.001 | 0.005 | 3.52 (7) | 29/200 (14.5 %), 10 d | 6/200 (3.0 %), 13 d | 2.0 % | 9 / 9 | 99.6 % | E1 18, E2 4 |
| S 13 g 4 L 1 | 0.0001 | 0.001 | 1.00 (2) | 45/200 (22.5 %), 5 d | 27/200 (13.5 %), 5 d | 3.0 % | 4 / 4 | 99.7 % | E1 11, E2 2 |
| S 13 g 4 L 4 | 0.001 | 0.005 | 4.52 (9) | 29/200 (14.5 %), 12 d | 8/200 (4.0 %), 9 d | 2.5 % | 11 / 11 | 99.6 % | E1 20, E2 4 |
| S 26 g 0 L 1 (chosen) | 0.005 | 0.001 | 1.00 (2) | 41/200 (20.5 %), 5 d | 19/200 (9.5 %), 5 d | 3.0 % | 4 / 4 | 99.7 % | E1 11, E2 2 |
| S 26 g 0 L 4 | 0.005 | 0.01 | 2.51 (5) | 42/200 (21.0 %), 10 d | 16/200 (8.0 %), 11 d | 2.5 % | 9 / 7 | 99.7 % | E1 13, E2 4 |
| S 26 g 4 L 1 | 0.001 | 0.001 | 1.00 (2) | 41/200 (20.5 %), 5 d | 22/200 (11.0 %), 5 d | 3.5 % | 5 / 4 | 99.7 % | E1 11, E2 2 |
| S 26 g 4 L 4 | 0.01 | 0.005 | 3.01 (6) | 31/200 (15.5 %), 12 d | 17/200 (8.5 %), 13 d | 2.5 % | 11 / 8 | 99.7 % | E1 16, E2 4 |
| S 52 g 0 L 4 | - | 0.01 | 4.02 (8) | 47/200 (23.5 %), 9 d | 18/200 (9.0 %), 12 d | 5.0 % | 11 / 10 | 99.7 % | E1 11, E2 6 |
| S 52 g 4 L 4 | - | 0.01 | 4.02 (8) | 45/200 (22.5 %), 10 d | 18/200 (9.0 %), 13 d | 4.5 % | 11 / 10 | 99.7 % | E1 11, E2 6 |

## Checks

Numerics (computed): BH against `statsmodels` `fdr_bh` on every day, p against a direct sum of the negative binomial pmf on 60 random tested cells, y and C against a plain-Python loop of the event definition on 12 cells.

| setting | max abs diff BH | max rel diff p | brute-force mismatches (12 cells) | tested series a day, mean (min to max) | tested cells with alpha 0 |
|---|---|---|---|---|---|
| S 26 g 0 L 1 | 2.2e-16 | 3.1e-12 | 0 | 27.5 (16 to 40) | 0 |
| S 26 g 4 L 4 | 2.2e-16 | 1.5e-11 | 0 | 80.1 (64 to 95) | 0 |

Trial fast path against the from-scratch computation (computed; same trials, all families and gap settings, with the budget):

| setting | trials | signals | trials that differ | max relative diff of p and mean |
|---|---|---|---|---|
| S 26 g 0 L 1 | 186 | 811 | 0 | 0.0e+00 |
| S 26 g 4 L 4 | 186 | 960 | 0 | 0.0e+00 |
| S 26 g 0 L 1, phenotype series only | 186 | 690 | 0 | 0.0e+00 |

Engine paths over the run: 93291 trials by the fast path, 0 by the from-scratch fallback.

`check_causal` on the cut dates 2024-12-11, 2025-06-18, 2026-03-11 (three Wednesdays): no difference for any of the 24 detectors (10 settings, each without and with the budget, and the 4 phenotype-series-only settings).

Tested cells whose predictive had shape alpha exactly 0 (the hospital and the unit had no event of the series in the baseline; the code reads it as p = 0, clipped to 1e-300): 150 of 504056 over the ten settings; by setting: S 13 g 0 L 1 6 of 27108, S 13 g 0 L 4 67 of 77573, S 13 g 4 L 1 6 of 26368, S 13 g 4 L 4 71 of 75510.
