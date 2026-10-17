# 0016 results

Reproduce: `uv run python experiments/0016-cusum/run.py` (seed 2026 only; every number measured or computed by that run unless said otherwise).
Run time 77.0 s (wall).

Run time 71.0 s (CPU); budget 10 minutes of CPU, no cut made.

## 1. Year-1 selection (tuning year only)

`tune_curve`: 40 rare and 40 common ESBL clusters of k = 4 injected 2024-04-01 to 2024-08-15, noise over 2024-04-01 to 2024-09-30 scaled to a year. Each setting at its loosest per-series run length L (years) with noise at most 5 a year.

**Poisson part**

| rank | setting | L (years) | noise a year (episodes) | rare k=4 | common ESBL k=4 | delay rare | delay common |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | theta 8, weekly, guard 0 wk | 100 | 4.0 (2) | 14/40 | 15/40 | 12 | 7 |
| 2 | theta 8, daily, guard 4 wk | 300 | 4.0 (2) | 14/40 | 14/40 | 10 | 5 |
| 3 | theta 8, daily, guard 0 wk | 100 | 2.0 (1) | 9/40 | 14/40 | 6 | 5 |
| 4 | theta 8, weekly, guard 4 wk | 1e+03 | 2.0 (1) | 8/40 | 13/40 | 12 | 11 |
| 5 | theta 4, daily, guard 4 wk | 300 | 4.0 (2) | 7/40 | 13/40 | 10 | 9 |
| 6 | theta 2.5, daily, guard 0 wk | 30 | 4.0 (2) | 4/40 | 9/40 | 5 | 10 |
| 7 | theta 4, weekly, guard 0 wk | 100 | 2.0 (1) | 3/40 | 10/40 | 7 | 5 |
| 8 | theta 4, daily, guard 0 wk | 100 | 2.0 (1) | 1/40 | 8/40 | 4 | 9 |
| 9 | theta 4, weekly, guard 4 wk | 1e+03 | 2.0 (1) | 1/40 | 3/40 | 13 | 14 |
| 10 | theta 2.5, daily, guard 4 wk | 1e+03 | 4.0 (2) | 0/40 | 3/40 | None | 11 |
| 11 | theta 2.5, weekly, guard 4 wk | 1e+03 | 4.0 (2) | 0/40 | 3/40 | None | 14 |
| 12 | theta 2.5, weekly, guard 0 wk | 100 | 4.0 (2) | 0/40 | 1/40 | None | 7 |

**Bernoulli part**

| rank | setting | L (years) | noise a year (episodes) | rare k=4 | common ESBL k=4 | delay rare | delay common |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | theta 8, guard 4 wk | 100 | 4.0 (2) | 19/40 | 21/40 | 7 | 7 |
| 2 | theta 2.5, guard 4 wk | 30 | 4.0 (2) | 13/40 | 14/40 | 11 | 9 |
| 3 | theta 4, guard 0 wk | 30 | 4.0 (2) | 13/40 | 13/40 | 8 | 7 |
| 4 | theta 8, guard 0 wk | 100 | 2.0 (1) | 9/40 | 12/40 | 7 | 7 |
| 5 | theta 4, guard 4 wk | 100 | 4.0 (2) | 8/40 | 10/40 | 10 | 9 |
| 6 | theta 2.5, guard 0 wk | 30 | 4.0 (2) | 4/40 | 2/40 | 5 | 3 |

Chosen Poisson setting: theta 8, weekly, guard 0 wk. Chosen Bernoulli setting: theta 8, guard 4 wk. The two together are the union; the table and every year-1 row are in `out/grid.json`.

## 2. Calibrating the operating level, on year 1

Active series (at least one event or observation in year 1): 199 Poisson + 198 Bernoulli = m 397. Siegmund with equal run lengths: L_S = m / 5 = 79.4 years. Simulation: 200 panels of 3 years from the year-1 model, episodes over the last 2.4 years (480 panel-years); L_sim = 72.07 years (the operating level). Real year-1 noise (2024-04-01 to 2024-09-30, scaled to a year) crosses 5 a year at L = 512.38 years.

| L (years) | Siegmund: m / L | simulated episodes a year | real year 1 episodes a year (count) |
| --- | --- | --- | --- |
| 1 | 397.00 | 156.22 | 193.6 (97) |
| 3 | 132.33 | 95.92 | 125.7 (63) |
| 10 | 39.70 | 42.77 | 47.9 (24) |
| 30 | 13.23 | 11.17 | 18.0 (9) |
| 100 | 3.97 | 3.70 | 8.0 (4) |
| 300 | 1.32 | 1.14 | 6.0 (3) |
| 1000 | 0.40 | 0.39 | 4.0 (2) |
| 3000 | 0.13 | 0.15 | 2.0 (1) |
| 10000 | 0.04 | 0.05 | 0.0 (0) |

L_sim / L_S = 0.91. Episodes a year at L_S: Siegmund 5.00, simulated 4.57, real year 1 9.3; at L_sim: simulated 5.00 by construction, real year 1 10.0, real scoring period 3.52 (D4 below).

Common limit (ablation): Siegmund h_S = 7.25, simulation h_sim = 7.11.

| common limit h | simulated episodes a year |
| --- | --- |
| 3 | 115.99 |
| 4 | 61.22 |
| 5 | 29.56 |
| 6 | 12.52 |
| 7 | 5.49 |
| 8 | 2.30 |
| 9 | 0.97 |
| 10 | 0.40 |
| 12 | 0.08 |

## 3. The union against the baseline rows

Union: CUSUM, Poisson theta 8 weekly guard 0 wk + Bernoulli theta 8 guard 4 wk. Operating level L_sim = 72.07 years (p = 3.8e-05); `tuned_on_test` false. Intervals: 95 % Wilson per cell; D4 exact Poisson. Baselines: `live-set-retuned-year1` (the reference, same year-1 procedure) and `live-set-shipped` (`tuned-on-test`).

**D5, the headline at 5 episodes a year (k = 4)**

| row | level | noise a year (episodes) | rare | delay | common ESBL | delay |
| --- | --- | --- | --- | --- | --- | --- |
| union (0016) | 3.8e-05 | 3.52 (7) | 0.665 [0.597, 0.727] | 7 | 0.485 [0.417, 0.554] | 6 |
| live re-tuned year 1 | 0.3 | 3.01 (6) | 0.920 [0.874, 0.950] | 6 | 0.750 [0.686, 0.805] | 6 |
| live shipped (tuned on test) | 3 | 3.01 (6) | 0.920 [0.874, 0.950] | 6 | 0.750 [0.686, 0.805] | 6 |

The union's level is a per-series run length in years (as a p, 1 / (365.25 L)); the baselines' is a multiple of the live alphas. D5 compares rates at equal noise only where the noise values are close; the union's headline sits at its own grid point (see the curve).

**D2 and median delay in days (200 trials per cell, seed 2026)**

**rare**

| k | union (0016) | live re-tuned year 1 | live shipped (tuned on test) |
| --- | --- | --- | --- |
| 0 | 0.025 [0.011, 0.057], delay 1 | 0.050 [0.027, 0.090], delay 11 | 0.010 [0.003, 0.036], delay 1 |
| 2 | 0.085 [0.054, 0.132], delay 4 | 0.380 [0.316, 0.449], delay 3 | 0.165 [0.120, 0.223], delay 2 |
| 3 | 0.345 [0.283, 0.413], delay 8 | 0.860 [0.805, 0.901], delay 7 | 0.615 [0.546, 0.680], delay 7 |
| 4 | 0.665 [0.597, 0.727], delay 7 | 0.980 [0.950, 0.992], delay 5 | 0.890 [0.839, 0.926], delay 6 |
| 6 | 0.920 [0.874, 0.950], delay 6 | 1.000 [0.981, 1.000], delay 3 | 1.000 [0.981, 1.000], delay 4 |

**common_resistant**

| k | union (0016) | live re-tuned year 1 | live shipped (tuned on test) |
| --- | --- | --- | --- |
| 0 | 0.035 [0.017, 0.070], delay 0 | 0.000 [0.000, 0.019], delay - | 0.000 [0.000, 0.019], delay - |
| 2 | 0.025 [0.011, 0.057], delay 0 | 0.015 [0.005, 0.043], delay 8 | 0.010 [0.003, 0.036], delay 0 |
| 3 | 0.025 [0.011, 0.057], delay 8 | 0.020 [0.008, 0.050], delay 8 | 0.005 [0.001, 0.028], delay 23 |
| 4 | 0.040 [0.020, 0.077], delay 5 | 0.010 [0.003, 0.036], delay 6 | 0.005 [0.001, 0.028], delay 25 |
| 6 | 0.115 [0.078, 0.167], delay 10 | 0.035 [0.017, 0.070], delay 13 | 0.000 [0.000, 0.019], delay - |

**wild_type**

| k | union (0016) | live re-tuned year 1 | live shipped (tuned on test) |
| --- | --- | --- | --- |
| 0 | 0.025 [0.011, 0.057], delay 2 | 0.010 [0.003, 0.036], delay 10 | 0.000 [0.000, 0.019], delay - |
| 2 | 0.035 [0.017, 0.070], delay 0 | 0.005 [0.001, 0.028], delay 12 | 0.000 [0.000, 0.019], delay - |
| 3 | 0.025 [0.011, 0.057], delay 0 | 0.005 [0.001, 0.028], delay 0 | 0.000 [0.000, 0.019], delay - |
| 4 | 0.025 [0.011, 0.057], delay 0 | 0.000 [0.000, 0.019], delay - | 0.000 [0.000, 0.019], delay - |
| 6 | 0.015 [0.005, 0.043], delay 0 | 0.000 [0.000, 0.019], delay - | 0.000 [0.000, 0.019], delay - |

**common_esbl**

| k | union (0016) | live re-tuned year 1 | live shipped (tuned on test) |
| --- | --- | --- | --- |
| 0 | 0.005 [0.001, 0.028], delay 0 | 0.065 [0.038, 0.108], delay 14 | 0.000 [0.000, 0.019], delay - |
| 2 | 0.055 [0.031, 0.096], delay 5 | 0.265 [0.209, 0.330], delay 7 | 0.045 [0.024, 0.083], delay 10 |
| 3 | 0.230 [0.177, 0.293], delay 7 | 0.700 [0.633, 0.759], delay 6 | 0.345 [0.283, 0.413], delay 8 |
| 4 | 0.485 [0.417, 0.554], delay 6 | 0.880 [0.828, 0.918], delay 6 | 0.610 [0.541, 0.675], delay 7 |
| 6 | 0.885 [0.833, 0.922], delay 6 | 0.995 [0.972, 0.999], delay 5 | 0.945 [0.904, 0.969], delay 7 |

**two_unit**

| k | union (0016) | live re-tuned year 1 | live shipped (tuned on test) |
| --- | --- | --- | --- |
| 0 | 0.030 [0.014, 0.064], delay 0 | 0.075 [0.046, 0.120], delay 11 | 0.020 [0.008, 0.050], delay 4 |
| 2 | 0.065 [0.038, 0.108], delay 0 | 0.255 [0.200, 0.320], delay 1 | 0.135 [0.094, 0.189], delay 0 |
| 3 | 0.130 [0.090, 0.184], delay 8 | 0.475 [0.407, 0.544], delay 4 | 0.210 [0.159, 0.272], delay 3 |
| 4 | 0.190 [0.142, 0.250], delay 7 | 0.565 [0.496, 0.632], delay 7 | 0.240 [0.186, 0.304], delay 3 |
| 6 | 0.545 [0.476, 0.613], delay 8 | 0.965 [0.930, 0.983], delay 6 | 0.805 [0.745, 0.854], delay 7 |

**D4 episodes a year over 2024-10-01 to 2026-09-27 (exact Poisson 95 %), fixed key, zones excluded**

| row | all | cluster | sentinel | data | alerts a week |
| --- | --- | --- | --- | --- | --- |
| union (0016) | 3.517 [1.414, 7.246] | 3.517 [1.414, 7.246] | 0.000 [0.000, 1.853] | 0.000 [0.000, 1.853] | 0.067 |
| live re-tuned year 1 | 9.546 [5.747, 14.907] | 4.522 [2.068, 8.584] | 1.507 [0.311, 4.405] | 3.517 [1.414, 7.246] | 0.183 |
| live shipped (tuned on test) | 4.522 [2.068, 8.584] | 1.005 [0.122, 3.630] | 1.507 [0.311, 4.405] | 2.010 [0.548, 5.145] | 0.087 |

**D1 (demonstration), D6, D7, I1**

| row | D1 (E1, E1 corrected, E2, E2 corrected, E3 not this method's kind, E4 date) | D6 | D7 | I1 |
| --- | --- | --- | --- | --- |
| union (0016) | {'E1': 4, 'E1_corrected': 9, 'E2': 4, 'E2_corrected': 4, 'E3': None, 'E4': None} | 0.071 [0.057, 0.089] | 0.999 [0.994, 1.000] | 16 alerts, 9 incidents, 1.78 per incident |
| live re-tuned year 1 | {'E1': 0, 'E1_corrected': 5, 'E2': 0, 'E2_corrected': 0, 'E3': 0, 'E4': '2026-02-15'} | 0.026 [0.018, 0.038] | 0.987 [0.981, 0.991] | 29 alerts, 26 incidents, 1.12 per incident |
| live shipped (tuned on test) | {'E1': 0, 'E1_corrected': 5, 'E2': 0, 'E2_corrected': 0, 'E3': 0, 'E4': '2026-05-10'} | 0.012 [0.007, 0.021] | 0.974 [0.966, 0.980] | 18 alerts, 15 incidents, 1.20 per incident |

**The union's D5 curve (level, noise, rates at k = 4 for each family, delays)**

| L (years) | noise a year (episodes) | rare | common_resistant | wild_type | common_esbl | two_unit | delay rare | delay common ESBL |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 160.27 (319) | 0.985 | 0.575 | 0.425 | 0.985 | 0.980 | 0 | 1 |
| 3 | 108.02 (215) | 0.960 | 0.350 | 0.225 | 0.925 | 0.885 | 2 | 3 |
| 10 | 50.24 (100) | 0.890 | 0.160 | 0.090 | 0.800 | 0.670 | 4 | 5 |
| 30 | 7.03 (14) | 0.765 | 0.070 | 0.030 | 0.690 | 0.360 | 6 | 7 |
| 72.1 (L_sim) | 3.52 (7) | 0.665 | 0.040 | 0.025 | 0.485 | 0.190 | 7 | 6 |
| 79.4 (L_S) | 3.01 (6) | 0.655 | 0.040 | 0.025 | 0.475 | 0.175 | 7 | 6 |
| 100 | 2.01 (4) | 0.635 | 0.040 | 0.025 | 0.410 | 0.160 | 8 | 7 |
| 300 | 1.00 (2) | 0.425 | 0.020 | 0.025 | 0.205 | 0.065 | 8 | 7 |
| 512 | 0.00 (0) | 0.360 | 0.020 | 0.020 | 0.180 | 0.050 | 8 | 7 |
| 1e+03 | 0.00 (0) | 0.235 | 0.015 | 0.020 | 0.140 | 0.040 | 10 | 8 |
| 3e+03 | 0.00 (0) | 0.105 | 0.005 | 0.020 | 0.075 | 0.005 | 12 | 10 |
| 1e+04 | 0.00 (0) | 0.035 | 0.005 | 0.010 | 0.020 | 0.005 | 6 | 9 |

Reference curve (`live-set-retuned-year1`, level = multiple of the live alphas):

| multiple | noise a year (episodes) | rare | common_resistant | wild_type | common_esbl | two_unit |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 82.90 (165) | 1.000 | 0.855 | 0.515 | 1.000 | 1.000 |
| 30 | 60.79 (121) | 1.000 | 0.455 | 0.225 | 1.000 | 1.000 |
| 10 | 34.67 (69) | 1.000 | 0.135 | 0.070 | 0.990 | 0.925 |
| 3 | 13.56 (27) | 1.000 | 0.040 | 0.015 | 0.970 | 0.755 |
| 1 | 6.03 (12) | 0.980 | 0.010 | 0.000 | 0.880 | 0.565 |
| 0.3 | 3.01 (6) | 0.920 | 0.005 | 0.000 | 0.750 | 0.355 |
| 0.1 | 2.51 (5) | 0.890 | 0.005 | 0.000 | 0.610 | 0.240 |
| 0.03 | 1.51 (3) | 0.815 | 0.000 | 0.000 | 0.440 | 0.195 |
| 0.01 | 1.51 (3) | 0.710 | 0.000 | 0.000 | 0.340 | 0.155 |

## 4. Parts alone and the common-limit ablation (D2, D4, D5, 100 trials per cell)

**Poisson part alone**: CUSUM, Poisson theta 8 weekly guard 0 wk. D5 headline level 9.13e-05, noise 2.51 a year (5 episodes), rare 0.460 [0.366, 0.557] (delay 7), common ESBL 0.180 [0.117, 0.267] (delay 7); D4 at the headline level 2.51 a year.

| L (years) | noise a year (episodes) | rare | common_resistant | wild_type | common_esbl | two_unit |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 95.96 (191) | 0.820 | 0.120 | 0.080 | 0.630 | 0.670 |
| 3 | 57.27 (114) | 0.720 | 0.080 | 0.010 | 0.540 | 0.490 |
| 10 | 32.15 (64) | 0.600 | 0.030 | 0.010 | 0.400 | 0.210 |
| 30 | 2.51 (5) | 0.460 | 0.030 | 0.000 | 0.180 | 0.080 |
| 72.1 | 1.51 (3) | 0.310 | 0.000 | 0.000 | 0.100 | 0.010 |
| 79.4 | 1.00 (2) | 0.290 | 0.000 | 0.000 | 0.100 | 0.010 |
| 100 | 0.50 (1) | 0.260 | 0.000 | 0.000 | 0.070 | 0.000 |
| 300 | 0.50 (1) | 0.090 | 0.000 | 0.000 | 0.030 | 0.000 |
| 512 | 0.00 (0) | 0.030 | 0.000 | 0.000 | 0.010 | 0.000 |
| 1e+03 | 0.00 (0) | 0.020 | 0.000 | 0.000 | 0.000 | 0.000 |
| 3e+03 | 0.00 (0) | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| 1e+04 | 0.00 (0) | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |

**Bernoulli part alone**: CUSUM, Bernoulli theta 8 guard 4 wk. D5 headline level 9.13e-05, noise 4.52 a year (9 episodes), rare 0.660 [0.563, 0.745] (delay 7), common ESBL 0.570 [0.472, 0.663] (delay 6); D4 at the headline level 4.52 a year.

| L (years) | noise a year (episodes) | rare | common_resistant | wild_type | common_esbl | two_unit |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 93.45 (186) | 0.990 | 0.520 | 0.480 | 0.960 | 0.980 |
| 3 | 58.28 (116) | 0.950 | 0.260 | 0.230 | 0.900 | 0.850 |
| 10 | 19.59 (39) | 0.830 | 0.160 | 0.090 | 0.790 | 0.660 |
| 30 | 4.52 (9) | 0.660 | 0.070 | 0.040 | 0.570 | 0.360 |
| 72.1 | 2.01 (4) | 0.550 | 0.030 | 0.040 | 0.460 | 0.190 |
| 79.4 | 2.01 (4) | 0.530 | 0.030 | 0.040 | 0.430 | 0.170 |
| 100 | 1.51 (3) | 0.480 | 0.030 | 0.040 | 0.400 | 0.170 |
| 300 | 0.50 (1) | 0.320 | 0.020 | 0.020 | 0.270 | 0.110 |
| 512 | 0.00 (0) | 0.300 | 0.020 | 0.020 | 0.220 | 0.080 |
| 1e+03 | 0.00 (0) | 0.190 | 0.020 | 0.020 | 0.190 | 0.070 |
| 3e+03 | 0.00 (0) | 0.050 | 0.020 | 0.020 | 0.090 | 0.020 |
| 1e+04 | 0.00 (0) | 0.030 | 0.020 | 0.010 | 0.030 | 0.020 |

**Union with one common limit (p = exp(-S))**: CUSUM, Poisson theta 8 weekly guard 0 wk + Bernoulli theta 8 guard 4 wk, one common limit. D5 headline level 0.000912, noise 4.52 a year (9 episodes), rare 0.670 [0.573, 0.754] (delay 7), common ESBL 0.580 [0.482, 0.672] (delay 6); D4 at the headline level 3.01 a year.

| h | noise a year (episodes) | rare | common_resistant | wild_type | common_esbl | two_unit |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 119.57 (238) | 1.000 | 0.770 | 0.610 | 0.990 | 1.000 |
| 4 | 58.28 (116) | 0.980 | 0.430 | 0.340 | 0.970 | 0.900 |
| 5 | 27.13 (54) | 0.940 | 0.300 | 0.190 | 0.920 | 0.690 |
| 6 | 13.56 (27) | 0.830 | 0.180 | 0.100 | 0.810 | 0.470 |
| 7 | 4.52 (9) | 0.670 | 0.040 | 0.040 | 0.580 | 0.210 |
| 7.11 | 3.01 (6) | 0.640 | 0.040 | 0.040 | 0.570 | 0.200 |
| 7.25 | 2.51 (5) | 0.620 | 0.040 | 0.040 | 0.530 | 0.180 |
| 8 | 1.51 (3) | 0.390 | 0.030 | 0.030 | 0.430 | 0.120 |
| 9 | 0.00 (0) | 0.200 | 0.020 | 0.020 | 0.310 | 0.090 |
| 10 | 0.00 (0) | 0.070 | 0.020 | 0.020 | 0.200 | 0.070 |
| 12 | 0.00 (0) | 0.030 | 0.020 | 0.010 | 0.070 | 0.020 |

## 5. Where the union's detections come from (seed 2026, 200 trials per cell, at the operating level)

| family | k | detected | of which delay 0 | Poisson part only | Bernoulli part only | both |
| --- | --- | --- | --- | --- | --- | --- |
| rare | 0 | 5/200 | 2 | 1 | 4 | 0 |
| rare | 2 | 17/200 | 4 | 1 | 14 | 2 |
| rare | 3 | 69/200 | 3 | 4 | 49 | 16 |
| rare | 4 | 133/200 | 2 | 10 | 70 | 53 |
| rare | 6 | 184/200 | 6 | 0 | 55 | 129 |
| common_resistant | 0 | 7/200 | 4 | 0 | 7 | 0 |
| common_resistant | 2 | 5/200 | 3 | 0 | 5 | 0 |
| common_resistant | 3 | 5/200 | 2 | 0 | 5 | 0 |
| common_resistant | 4 | 8/200 | 1 | 2 | 5 | 1 |
| common_resistant | 6 | 23/200 | 2 | 3 | 20 | 0 |
| wild_type | 0 | 5/200 | 2 | 0 | 5 | 0 |
| wild_type | 2 | 7/200 | 4 | 2 | 5 | 0 |
| wild_type | 3 | 5/200 | 4 | 1 | 4 | 0 |
| wild_type | 4 | 5/200 | 3 | 2 | 3 | 0 |
| wild_type | 6 | 3/200 | 2 | 0 | 3 | 0 |
| common_esbl | 0 | 1/200 | 1 | 0 | 1 | 0 |
| common_esbl | 2 | 11/200 | 2 | 0 | 10 | 1 |
| common_esbl | 3 | 46/200 | 3 | 4 | 37 | 5 |
| common_esbl | 4 | 97/200 | 4 | 6 | 66 | 25 |
| common_esbl | 6 | 177/200 | 5 | 2 | 79 | 96 |
| two_unit | 0 | 6/200 | 4 | 1 | 5 | 0 |
| two_unit | 2 | 13/200 | 7 | 1 | 12 | 0 |
| two_unit | 3 | 26/200 | 3 | 5 | 21 | 0 |
| two_unit | 4 | 38/200 | 5 | 6 | 30 | 2 |
| two_unit | 6 | 109/200 | 4 | 3 | 89 | 17 |

Delay 0 counts a run begun before the start (no reset) as well as a same-day detection; the k = 0 rows are the controls.

## 6. Checks

- `check_causal` (the detector built from the rows it is given), cuts 2025-03-31, 2025-12-31, 2026-06-30: no differences.
- Trial fast path against the from-scratch computation: 96 trials, 1638 signals, 0 trials differ (max relative difference in p 0.00e+00).
- Focused against full signals on the real data: 3 cases, 160 signals, 0 mismatches.
- Runs of the detector by the way the world was obtained (real-data world with the change applied / built from the rows given, the slow fallback): 20263 / 0; the `check_causal` runs use `rebuild`.
- Vectorised statistic against loops from the definition: Poisson URO|esbl: 143 periods, max |dS| 2.8e-14; Poisson ED|('Escherichia coli', 'urine'): 143 periods, max |dS| 0.0e+00; Poisson ICU|mrsa: 143 periods, max |dS| 7.1e-15; Bernoulli ED|Escherichia coli|CRO|all: 973 days, max |dS| 7.5e-14; Bernoulli MED-A|Escherichia coli|AMP|all: 973 days, max |dS| 8.7e-14; largest difference in S 8.7e-14.

## 7. Deviations from plan

- Floors added where the plan's 'never zero' does not hold: the weekly baseline rate is at least 0.001 events, the proportion is clipped to [0.001, 0.999], the arrival rate in the run length is at least 0.001 a week (the hospital share can be zero as well).
- Hospital totals for the shrinkage prior come from the real data's cumulative arrays, indexed only up to the last row's date; injected rows are added to them (exact), removed rows of a gap trial are taken out without re-flagging a patient's later isolate as a first one. `check_causal` is run on the detector built from the rows it is given.
- The simulated in-control panel uses the active series only (at least one event or observation in year 1), the same set that sets m.
