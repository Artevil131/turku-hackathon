# 0022 results

Reproduce: `uv run python experiments/0022-ensemble/run.py` (seed 2026 only; every number measured or computed by that run unless said otherwise; baseline and 0016 numbers are read from their committed `metrics.json`).

Run time 153.1 s (wall).

Run time 151.4 s (CPU); budget 10 minutes of CPU, no cut made. Components run 6624 times, 40441 cache hits.

## 1. Operating levels, chosen on the tuning year (tune_curve)

`tune_curve`: 40 rare and 40 common ESBL clusters of k = 4 injected 2024-04-01 to 2024-08-15, noise over 2024-04-01 to 2024-09-30 scaled to a year. The operating level is the loosest with noise at most 5 a year. The ranks, weights and ECDF map are frozen at 2024-09-30 and were fitted on the same year, so this noise is in-sample.

**rank product (live set A, CUSUM B, 7-day join)**: operating level p = 3e-05

| level p | noise a year (episodes) | rare k=4 | common ESBL k=4 |
| --- | --- | --- | --- |
| 0.3 | 173.6 (87) | 40/40 | 40/40 |
| 0.1 | 101.8 (51) | 40/40 | 40/40 |
| 0.03 | 55.9 (28) | 40/40 | 40/40 |
| 0.01 | 37.9 (19) | 38/40 | 40/40 |
| 0.003 | 25.9 (13) | 37/40 | 40/40 |
| 0.001 | 18.0 (9) | 35/40 | 38/40 |
| 0.0003 | 8.0 (4) | 33/40 | 36/40 |
| 0.0001 | 6.0 (3) | 27/40 | 35/40 |
| 3e-05 | 0.0 (0) | 23/40 | 27/40 |
| 1e-05 | 0.0 (0) | 13/40 | 19/40 |
| 3e-06 | 0.0 (0) | 8/40 | 14/40 |
| 1e-06 | 0.0 (0) | 6/40 | 9/40 |

**stacked logistic (A, B; year-1 injections)**: operating level p = 0.0003

| level p | noise a year (episodes) | rare k=4 | common ESBL k=4 |
| --- | --- | --- | --- |
| 0.3 | 197.6 (99) | 40/40 | 40/40 |
| 0.1 | 153.7 (77) | 40/40 | 40/40 |
| 0.03 | 89.8 (45) | 40/40 | 40/40 |
| 0.01 | 39.9 (20) | 40/40 | 40/40 |
| 0.003 | 20.0 (10) | 39/40 | 40/40 |
| 0.001 | 8.0 (4) | 18/40 | 23/40 |
| 0.0003 | 0.0 (0) | 18/40 | 21/40 |
| 0.0001 | 0.0 (0) | 13/40 | 17/40 |
| 3e-05 | 0.0 (0) | 0/40 | 0/40 |
| 1e-05 | 0.0 (0) | 0/40 | 0/40 |
| 3e-06 | 0.0 (0) | 0/40 | 0/40 |
| 1e-06 | 0.0 (0) | 0/40 | 0/40 |

**rank product, exact-day join (sensitivity)**: operating level p = 3e-05

| level p | noise a year (episodes) | rare k=4 | common ESBL k=4 |
| --- | --- | --- | --- |
| 0.3 | 211.6 (106) | 40/40 | 40/40 |
| 0.1 | 147.7 (74) | 40/40 | 40/40 |
| 0.03 | 103.8 (52) | 40/40 | 40/40 |
| 0.01 | 47.9 (24) | 40/40 | 40/40 |
| 0.003 | 31.9 (16) | 39/40 | 40/40 |
| 0.001 | 22.0 (11) | 37/40 | 40/40 |
| 0.0003 | 12.0 (6) | 36/40 | 38/40 |
| 0.0001 | 6.0 (3) | 33/40 | 37/40 |
| 3e-05 | 4.0 (2) | 32/40 | 35/40 |
| 1e-05 | 2.0 (1) | 22/40 | 32/40 |
| 3e-06 | 0.0 (0) | 19/40 | 22/40 |
| 1e-06 | 0.0 (0) | 7/40 | 11/40 |

## 2. The independence null against the background (dependence check)

Background: 117 cells x 274 days = 32058 cell-days, 2024-01-01 to 2024-09-30 (7-day join). Fired cell-days: A 1566, B 3498. Analytic p of the rank product is the independence null RP^2 (1 - 2 ln RP); the empirical tail is the share of the background's cell-days with p below the level. Ratio analytic / empirical below 1 means the formula is anti-conservative (more pass than it promises).

| level p (analytic) | background cell-days below | empirical tail | analytic / empirical |
| --- | --- | --- | --- |
| 0.3 | 4096 | 0.128 | 2.35 |
| 0.1 | 1320 | 0.0412 | 2.43 |
| 0.03 | 524 | 0.0163 | 1.84 |
| 0.01 | 291 | 0.00908 | 1.1 |
| 0.003 | 138 | 0.0043 | 0.697 |
| 0.001 | 78 | 0.00243 | 0.411 |
| 0.0003 | 28 | 0.000873 | 0.343 |
| 0.0001 | 18 | 0.000561 | 0.178 |
| 3e-05 | 0 | 0 | - |
| 1e-05 | 0 | 0 | - |
| 3e-06 | 0 | 0 | - |
| 1e-06 | 0 | 0 | - |

At the operating level 3e-05: 0 background cell-days below, empirical tail 0, analytic / empirical -.

## 3. The stack

Training rows: 21394 positives (18983 with a component signal) from 200 rare + 200 common ESBL injected clusters of 4 (2024-04-01 to 2024-08-15; seed 2026), 21411 negatives (3687 with a component signal), the real cell-days 2024-04-01 to 2024-09-30. L2 lambda = 1 on the slopes, intercept free. Features scaled by their standard deviation over the training rows.

| term | weight | scale (sd) |
| --- | --- | --- |
| intercept | -1.790 | - |
| -log10 s_A | 3.687 | 1.81 |
| -log10 s_B | 1.564 | 2.06 |
| both fired | -0.639 | 0.403 |

## 4. D5, the headline at 5 episodes a year (k = 4, Wilson 95 %)

Rows read at their loosest level with noise at most 5 a year (cluster and sentinel signals only, Choices 3). 'At 5 a year' is the rate interpolated linearly in noise between the two bracketing levels (harness review finding 12; proposed (overnight), pending Artem), computed from the curve.

| row | level | noise a year (episodes) | rare | rare at 5/yr | common ESBL | common ESBL at 5/yr | delay rare / common |
| --- | --- | --- | --- | --- | --- | --- | --- |
| live re-tuned year 1 (reference) | 0.3 | 3.01 (6) | 0.920 [0.874, 0.950] | 0.960 | 0.750 [0.686, 0.805] | 0.836 | 6 / 6 |
| live shipped (tuned on test) | 3 | 3.01 (6) | 0.920 [0.874, 0.950] | 0.960 | 0.750 [0.686, 0.805] | 0.836 | 6 / 6 |
| CUSUM union 0016 | 3.8e-05 | 3.52 (7) | 0.665 [0.597, 0.727] | 0.707 | 0.485 [0.417, 0.554] | 0.571 | 7 / 6 |
| rank product (live set A, CUSUM B, 7-day join) | 0.001 | 4.52 (9) | 0.940 [0.898, 0.965] | 0.942 | 0.830 [0.772, 0.876] | 0.834 | 5 / 6 |
| stacked logistic (A, B; year-1 injections) | 0.003 | 3.01 (6) | 0.990 [0.964, 0.997] | 0.991 | 0.850 [0.794, 0.893] | 0.865 | 5 / 6 |
| union (min p) | 3e-05 | 3.52 (7) | 0.840 [0.783, 0.884] | 0.856 | 0.555 [0.486, 0.622] | 0.599 | 6 / 6 |
| intersection (max p) | 0.003 | 4.52 (9) | 0.970 [0.936, 0.986] | 0.971 | 0.850 [0.794, 0.893] | 0.857 | 5 / 6 |
| rank product, exact-day join (sensitivity) | 0.0001 | 2.01 (4) | 0.895 [0.845, 0.930] | 0.937 | 0.775 [0.712, 0.827] | 0.826 | 5 / 6 |

Reference levels are multiples of the live alphas (profile 1e-3, phenotype 1e-2 at multiple 1), 0016's a per-series run length as a p, the ensembles' a p of the rule.

**D5 at fixed numbers of noise episodes over the scoring period** (3, 6 and 10 episodes = 1.5, 3.0 and 5.0 a year; the loosest level with exactly that count, else linear in the count between the bracketing levels, computed; no interval, the curve's intervals are in section 5).

| row | rare at 1.5/yr | common ESBL at 1.5/yr | rare at 3.0/yr | common ESBL at 3.0/yr | rare at 5.0/yr | common ESBL at 5.0/yr |
| --- | --- | --- | --- | --- | --- | --- |
| live re-tuned year 1 (reference) | 0.815 | 0.440 | 0.920 | 0.750 | 0.960 | 0.837 |
| live shipped (tuned on test) | 0.815 | 0.440 | 0.920 | 0.750 | 0.960 | 0.837 |
| CUSUM union 0016 | 0.530 | 0.307 | 0.655 | 0.475 | 0.708 | 0.573 |
| rank product (live set A, CUSUM B, 7-day join) | 0.880 | 0.735 | 0.910 | 0.782 | 0.942 | 0.834 |
| stacked logistic (A, B; year-1 injections) | 0.670 | 0.290 | 0.990 | 0.850 | 0.991 | 0.865 |
| union (min p) | 0.655 | 0.330 | 0.795 | 0.483 | 0.856 | 0.600 |
| intersection (max p) | 0.930 | 0.710 | 0.950 | 0.780 | 0.971 | 0.857 |
| rank product, exact-day join (sensitivity) | 0.867 | 0.720 | 0.909 | 0.792 | 0.937 | 0.826 |

## 5. D5 curves (rates at k = 4 per level)

**rank product (live set A, CUSUM B, 7-day join)**

| level p | noise a year (episodes) | rare | common ESBL | common resistant | wild type | two unit |
| --- | --- | --- | --- | --- | --- | --- |
| 0.3 | 170.82 (340) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] | 0.940 | 0.690 | 1.000 |
| 0.1 | 88.42 (176) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] | 0.740 | 0.480 | 0.960 |
| 0.03 | 42.20 (84) | 0.995 [0.972, 0.999] | 0.995 [0.972, 0.999] | 0.475 | 0.255 | 0.850 |
| 0.01 | 27.13 (54) | 0.990 [0.964, 0.997] | 0.980 [0.950, 0.992] | 0.335 | 0.180 | 0.710 |
| 0.003 | 14.07 (28) | 0.980 [0.950, 0.992] | 0.915 [0.868, 0.946] | 0.130 | 0.075 | 0.470 |
| 0.001 | 4.52 (9) | 0.940 [0.898, 0.965] | 0.830 [0.772, 0.876] | 0.050 | 0.025 | 0.330 |
| 0.0003 | 1.51 (3) | 0.880 [0.828, 0.918] | 0.735 [0.670, 0.791] | 0.035 | 0.000 | 0.170 |
| 0.0001 | 0.00 (0) | 0.810 [0.750, 0.858] | 0.540 [0.471, 0.608] | 0.005 | 0.000 | 0.100 |
| 3e-05 | 0.00 (0) | 0.685 [0.618, 0.745] | 0.355 [0.292, 0.423] | 0.005 | 0.000 | 0.040 |
| 1e-05 | 0.00 (0) | 0.445 [0.378, 0.514] | 0.215 [0.164, 0.277] | 0.005 | 0.000 | 0.005 |
| 3e-06 | 0.00 (0) | 0.320 [0.259, 0.388] | 0.135 [0.094, 0.189] | 0.005 | 0.000 | 0.005 |
| 1e-06 | 0.00 (0) | 0.220 [0.168, 0.282] | 0.060 [0.035, 0.102] | 0.000 | 0.000 | 0.005 |

**stacked logistic (A, B; year-1 injections)**

| level p | noise a year (episodes) | rare | common ESBL | common resistant | wild type | two unit |
| --- | --- | --- | --- | --- | --- | --- |
| 0.3 | 176.85 (352) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] | 0.950 | 0.715 | 1.000 |
| 0.1 | 149.21 (297) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] | 0.905 | 0.655 | 0.985 |
| 0.03 | 69.33 (138) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] | 0.690 | 0.430 | 0.945 |
| 0.01 | 20.10 (40) | 0.995 [0.972, 0.999] | 0.975 [0.943, 0.989] | 0.225 | 0.110 | 0.665 |
| 0.003 | 3.01 (6) | 0.990 [0.964, 0.997] | 0.850 [0.794, 0.893] | 0.015 | 0.005 | 0.325 |
| 0.001 | 1.51 (3) | 0.670 [0.602, 0.731] | 0.290 [0.232, 0.356] | 0.000 | 0.000 | 0.105 |
| 0.0003 | 1.00 (2) | 0.620 [0.551, 0.684] | 0.230 [0.177, 0.293] | 0.000 | 0.000 | 0.070 |
| 0.0001 | 0.00 (0) | 0.495 [0.426, 0.564] | 0.175 [0.129, 0.234] | 0.000 | 0.000 | 0.010 |
| 3e-05 | 0.00 (0) | 0.000 [0.000, 0.019] | 0.000 [0.000, 0.019] | 0.000 | 0.000 | 0.000 |
| 1e-05 | 0.00 (0) | 0.000 [0.000, 0.019] | 0.000 [0.000, 0.019] | 0.000 | 0.000 | 0.000 |
| 3e-06 | 0.00 (0) | 0.000 [0.000, 0.019] | 0.000 [0.000, 0.019] | 0.000 | 0.000 | 0.000 |
| 1e-06 | 0.00 (0) | 0.000 [0.000, 0.019] | 0.000 [0.000, 0.019] | 0.000 | 0.000 | 0.000 |

**union (min p)**

| level p | noise a year (episodes) | rare | common ESBL | common resistant | wild type | two unit |
| --- | --- | --- | --- | --- | --- | --- |
| 0.3 | 175.34 (349) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] | 0.950 | 0.715 | 1.000 |
| 0.1 | 167.80 (334) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] | 0.950 | 0.715 | 1.000 |
| 0.03 | 159.77 (318) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] | 0.785 | 0.585 | 1.000 |
| 0.01 | 155.24 (309) | 1.000 [0.981, 1.000] | 0.995 [0.972, 0.999] | 0.670 | 0.495 | 1.000 |
| 0.003 | 151.22 (301) | 1.000 [0.981, 1.000] | 0.995 [0.972, 0.999] | 0.615 | 0.455 | 0.985 |
| 0.001 | 111.53 (222) | 1.000 [0.981, 1.000] | 0.970 [0.936, 0.986] | 0.415 | 0.275 | 0.905 |
| 0.0003 | 53.76 (107) | 0.960 [0.923, 0.980] | 0.850 [0.794, 0.893] | 0.185 | 0.145 | 0.720 |
| 0.0001 | 10.05 (20) | 0.910 [0.862, 0.942] | 0.750 [0.686, 0.805] | 0.085 | 0.055 | 0.475 |
| 3e-05 | 3.52 (7) | 0.840 [0.783, 0.884] | 0.555 [0.486, 0.622] | 0.040 | 0.030 | 0.255 |
| 1e-05 | 2.51 (5) | 0.750 [0.686, 0.805] | 0.410 [0.344, 0.479] | 0.020 | 0.025 | 0.180 |
| 3e-06 | 1.51 (3) | 0.655 [0.587, 0.717] | 0.330 [0.269, 0.398] | 0.015 | 0.025 | 0.135 |
| 1e-06 | 0.00 (0) | 0.545 [0.476, 0.613] | 0.235 [0.182, 0.298] | 0.005 | 0.020 | 0.015 |

**intersection (max p)**

| level p | noise a year (episodes) | rare | common ESBL | common resistant | wild type | two unit |
| --- | --- | --- | --- | --- | --- | --- |
| 0.3 | 36.17 (72) | 0.980 [0.950, 0.992] | 0.980 [0.950, 0.992] | 0.450 | 0.225 | 0.785 |
| 0.1 | 34.67 (69) | 0.980 [0.950, 0.992] | 0.980 [0.950, 0.992] | 0.450 | 0.225 | 0.765 |
| 0.03 | 20.10 (40) | 0.980 [0.950, 0.992] | 0.965 [0.930, 0.983] | 0.215 | 0.080 | 0.580 |
| 0.01 | 9.55 (19) | 0.980 [0.950, 0.992] | 0.925 [0.880, 0.954] | 0.070 | 0.035 | 0.470 |
| 0.003 | 4.52 (9) | 0.970 [0.936, 0.986] | 0.850 [0.794, 0.893] | 0.030 | 0.020 | 0.350 |
| 0.001 | 1.51 (3) | 0.930 [0.886, 0.958] | 0.710 [0.644, 0.768] | 0.000 | 0.000 | 0.235 |
| 0.0003 | 1.00 (2) | 0.830 [0.772, 0.876] | 0.535 [0.466, 0.603] | 0.000 | 0.000 | 0.120 |
| 0.0001 | 0.00 (0) | 0.685 [0.618, 0.745] | 0.380 [0.316, 0.449] | 0.000 | 0.000 | 0.070 |
| 3e-05 | 0.00 (0) | 0.510 [0.441, 0.578] | 0.205 [0.155, 0.266] | 0.000 | 0.000 | 0.030 |
| 1e-05 | 0.00 (0) | 0.300 [0.241, 0.367] | 0.075 [0.046, 0.120] | 0.000 | 0.000 | 0.005 |
| 3e-06 | 0.00 (0) | 0.155 [0.111, 0.212] | 0.045 [0.024, 0.083] | 0.000 | 0.000 | 0.005 |
| 1e-06 | 0.00 (0) | 0.040 [0.020, 0.077] | 0.010 [0.003, 0.036] | 0.000 | 0.000 | 0.000 |

**rank product, exact-day join (sensitivity)**

| level p | noise a year (episodes) | rare | common ESBL | common resistant | wild type | two unit |
| --- | --- | --- | --- | --- | --- | --- |
| 0.3 | 188.91 (376) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] | 0.935 | 0.685 | 1.000 |
| 0.1 | 126.61 (252) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] | 0.885 | 0.580 | 1.000 |
| 0.03 | 80.39 (160) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] | 0.695 | 0.375 | 0.945 |
| 0.01 | 33.16 (66) | 0.995 [0.972, 0.999] | 0.985 [0.957, 0.995] | 0.340 | 0.170 | 0.720 |
| 0.003 | 24.12 (48) | 0.985 [0.957, 0.995] | 0.970 [0.936, 0.986] | 0.285 | 0.155 | 0.515 |
| 0.001 | 15.57 (31) | 0.975 [0.943, 0.989] | 0.950 [0.910, 0.973] | 0.145 | 0.075 | 0.345 |
| 0.0003 | 7.03 (14) | 0.965 [0.930, 0.983] | 0.860 [0.805, 0.901] | 0.060 | 0.010 | 0.245 |
| 0.0001 | 2.01 (4) | 0.895 [0.845, 0.930] | 0.775 [0.712, 0.827] | 0.030 | 0.000 | 0.155 |
| 3e-05 | 0.50 (1) | 0.810 [0.750, 0.858] | 0.610 [0.541, 0.675] | 0.025 | 0.000 | 0.085 |
| 1e-05 | 0.00 (0) | 0.710 [0.644, 0.768] | 0.465 [0.397, 0.534] | 0.005 | 0.000 | 0.050 |
| 3e-06 | 0.00 (0) | 0.605 [0.536, 0.670] | 0.320 [0.259, 0.388] | 0.000 | 0.000 | 0.010 |
| 1e-06 | 0.00 (0) | 0.355 [0.292, 0.423] | 0.185 [0.137, 0.245] | 0.000 | 0.000 | 0.005 |

Reference curve (`live-set-retuned-year1`, level = multiple of the live alphas):

| multiple | noise a year (episodes) | rare | common ESBL |
| --- | --- | --- | --- |
| 100 | 82.90 (165) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] |
| 30 | 60.79 (121) | 1.000 [0.981, 1.000] | 1.000 [0.981, 1.000] |
| 10 | 34.67 (69) | 1.000 [0.981, 1.000] | 0.990 [0.964, 0.997] |
| 3 | 13.56 (27) | 1.000 [0.981, 1.000] | 0.970 [0.936, 0.986] |
| 1 | 6.03 (12) | 0.980 [0.950, 0.992] | 0.880 [0.828, 0.918] |
| 0.3 | 3.01 (6) | 0.920 [0.874, 0.950] | 0.750 [0.686, 0.805] |
| 0.1 | 2.51 (5) | 0.890 [0.839, 0.926] | 0.610 [0.541, 0.675] |
| 0.03 | 1.51 (3) | 0.815 [0.755, 0.863] | 0.440 [0.373, 0.509] |
| 0.01 | 1.51 (3) | 0.710 [0.644, 0.768] | 0.340 [0.278, 0.408] |

## 6. D2 at the operating level (200 trials per cell; Wilson 95 %; median delay in days)

**rare**

| k | live re-tuned (level 1) | 0016 union (L = 72.1 y) | rank product | stack |
| --- | --- | --- | --- | --- |
| 0 | 0.050 [0.027, 0.090], 11 d | 0.025 [0.011, 0.057], 1 d | 0.000 [0.000, 0.019], - d | 0.000 [0.000, 0.019], - d |
| 2 | 0.380 [0.316, 0.449], 3 d | 0.085 [0.054, 0.132], 4 d | 0.015 [0.005, 0.043], 12 d | 0.040 [0.020, 0.077], 2 d |
| 3 | 0.860 [0.805, 0.901], 7 d | 0.345 [0.283, 0.413], 8 d | 0.270 [0.213, 0.335], 8 d | 0.205 [0.155, 0.266], 7 d |
| 4 | 0.980 [0.950, 0.992], 5 d | 0.665 [0.597, 0.727], 7 d | 0.685 [0.618, 0.745], 8 d | 0.620 [0.551, 0.684], 7 d |
| 6 | 1.000 [0.981, 1.000], 3 d | 0.920 [0.874, 0.950], 6 d | 0.940 [0.898, 0.965], 6 d | 0.920 [0.874, 0.950], 6 d |

**common_resistant**

| k | live re-tuned (level 1) | 0016 union (L = 72.1 y) | rank product | stack |
| --- | --- | --- | --- | --- |
| 0 | 0.000 [0.000, 0.019], - d | 0.035 [0.017, 0.070], 0 d | 0.015 [0.005, 0.043], 0 d | 0.000 [0.000, 0.019], - d |
| 2 | 0.015 [0.005, 0.043], 8 d | 0.025 [0.011, 0.057], 0 d | 0.000 [0.000, 0.019], - d | 0.000 [0.000, 0.019], - d |
| 3 | 0.020 [0.008, 0.050], 8 d | 0.025 [0.011, 0.057], 8 d | 0.005 [0.001, 0.028], 0 d | 0.000 [0.000, 0.019], - d |
| 4 | 0.010 [0.003, 0.036], 6 d | 0.040 [0.020, 0.077], 5 d | 0.005 [0.001, 0.028], 3 d | 0.000 [0.000, 0.019], - d |
| 6 | 0.035 [0.017, 0.070], 13 d | 0.115 [0.078, 0.167], 10 d | 0.010 [0.003, 0.036], 0 d | 0.000 [0.000, 0.019], - d |

**wild_type**

| k | live re-tuned (level 1) | 0016 union (L = 72.1 y) | rank product | stack |
| --- | --- | --- | --- | --- |
| 0 | 0.010 [0.003, 0.036], 10 d | 0.025 [0.011, 0.057], 2 d | 0.005 [0.001, 0.028], 0 d | 0.000 [0.000, 0.019], - d |
| 2 | 0.005 [0.001, 0.028], 12 d | 0.035 [0.017, 0.070], 0 d | 0.005 [0.001, 0.028], 0 d | 0.000 [0.000, 0.019], - d |
| 3 | 0.005 [0.001, 0.028], 0 d | 0.025 [0.011, 0.057], 0 d | 0.010 [0.003, 0.036], 0 d | 0.000 [0.000, 0.019], - d |
| 4 | 0.000 [0.000, 0.019], - d | 0.025 [0.011, 0.057], 0 d | 0.000 [0.000, 0.019], - d | 0.000 [0.000, 0.019], - d |
| 6 | 0.000 [0.000, 0.019], - d | 0.015 [0.005, 0.043], 0 d | 0.000 [0.000, 0.019], - d | 0.000 [0.000, 0.019], - d |

**common_esbl**

| k | live re-tuned (level 1) | 0016 union (L = 72.1 y) | rank product | stack |
| --- | --- | --- | --- | --- |
| 0 | 0.065 [0.038, 0.108], 14 d | 0.005 [0.001, 0.028], 0 d | 0.000 [0.000, 0.019], - d | 0.000 [0.000, 0.019], - d |
| 2 | 0.265 [0.209, 0.330], 7 d | 0.055 [0.031, 0.096], 5 d | 0.005 [0.001, 0.028], 10 d | 0.000 [0.000, 0.019], - d |
| 3 | 0.700 [0.633, 0.759], 6 d | 0.230 [0.177, 0.293], 7 d | 0.120 [0.082, 0.172], 8 d | 0.025 [0.011, 0.057], 11 d |
| 4 | 0.880 [0.828, 0.918], 6 d | 0.485 [0.417, 0.554], 6 d | 0.355 [0.292, 0.423], 7 d | 0.230 [0.177, 0.293], 8 d |
| 6 | 0.995 [0.972, 0.999], 5 d | 0.885 [0.833, 0.922], 6 d | 0.870 [0.816, 0.910], 8 d | 0.635 [0.566, 0.699], 9 d |

**two_unit**

| k | live re-tuned (level 1) | 0016 union (L = 72.1 y) | rank product | stack |
| --- | --- | --- | --- | --- |
| 0 | 0.075 [0.046, 0.120], 11 d | 0.030 [0.014, 0.064], 0 d | 0.005 [0.001, 0.028], 0 d | 0.000 [0.000, 0.019], - d |
| 2 | 0.255 [0.200, 0.320], 1 d | 0.065 [0.038, 0.108], 0 d | 0.020 [0.008, 0.050], 0 d | 0.055 [0.031, 0.096], 4 d |
| 3 | 0.475 [0.407, 0.544], 4 d | 0.130 [0.090, 0.184], 8 d | 0.030 [0.014, 0.064], 5 d | 0.060 [0.035, 0.102], 6 d |
| 4 | 0.565 [0.496, 0.632], 7 d | 0.190 [0.142, 0.250], 7 d | 0.040 [0.020, 0.077], 7 d | 0.070 [0.042, 0.114], 6 d |
| 6 | 0.965 [0.930, 0.983], 6 d | 0.545 [0.476, 0.613], 8 d | 0.430 [0.363, 0.499], 8 d | 0.335 [0.273, 0.403], 9 d |

## 7. D3, D4, D6, D7, I1, D1 at the operating level

D3 is 0 by construction for the ensembles (no data-kind signals; the live set's data rules are left out of A, as D5's noise leaves them out).

| row | D4 all (episodes a year) | cluster | sentinel | data | alerts a week | D6 | D7 | I1 alerts / incidents / per incident |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| live re-tuned (level 1) | 9.546 [5.747, 14.907] | 4.522 [2.068, 8.584] | 1.507 [0.311, 4.405] | 3.517 [1.414, 7.246] | 0.183 | 0.026 [0.018, 0.038] | 0.987 [0.981, 0.991] | 29 / 26 / 1.115 |
| 0016 union (L = 72.1 y) | 3.517 [1.414, 7.246] | 3.517 [1.414, 7.246] | 0.000 [0.000, 1.853] | 0.000 [0.000, 1.853] | 0.067 | 0.071 [0.057, 0.089] | 0.999 [0.994, 1.000] | 16 / 9 / 1.778 |
| rank product | 0.000 [0.000, 1.853] | 0.000 [0.000, 1.853] | 0.000 [0.000, 1.853] | 0.000 [0.000, 1.853] | 0.000 | 0.015 [0.009, 0.025] | 0.999 [0.993, 1.000] | 4 / 2 / 2.000 |
| stack | 1.005 [0.122, 3.630] | 1.005 [0.122, 3.630] | 0.000 [0.000, 1.853] | 0.000 [0.000, 1.853] | 0.019 | 0.016 [0.010, 0.026] | 0.998 [0.991, 1.000] | 6 / 4 / 1.500 |

| row | D1 (days; E4 a date) | D3 |
| --- | --- | --- |
| live re-tuned (level 1) | {"E1": 0, "E1_corrected": 5, "E2": 0, "E2_corrected": 0, "E3": 0, "E4": "2026-02-15"} | {"gap2": 0.655, "gap3": 0.95, "gap5": 1.0, "gap7": 1.0, "half7": 0.43} |
| 0016 union (L = 72.1 y) | {"E1": 4, "E1_corrected": 9, "E2": 4, "E2_corrected": 4, "E3": null, "E4": null} | null |
| rank product | {"E1": 4, "E1_corrected": 9, "E2": 5, "E2_corrected": 5, "E3": null, "E4": null} | {"gap2": 0.0, "gap3": 0.0, "gap5": 0.0, "gap7": 0.0, "half7": 0.0} |
| stack | {"E1": 3, "E1_corrected": 8, "E2": 5, "E2_corrected": 5, "E3": null, "E4": null} | {"gap2": 0.0, "gap3": 0.0, "gap5": 0.0, "gap7": 0.0, "half7": 0.0} |

**The same ensembles read at D5's headline level** (extra, `metrics-rp-headline.json` and `metrics-stack-headline.json`; the level is the loosest with at most 5 episodes a year over the SCORING period, so these reads are tuned on test and exploratory; the reference at its own headline level, multiple 0.3, is in section 5).

| row | level p | D4 episodes a year | rare k=4 | common ESBL k=4 | two unit k=4 | common resistant k=4 | wild type k=4 | rare k=3 | common ESBL k=3 | D6 | D7 | I1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rank product (live set A, CUSUM B, 7-day join) | 0.001 | 4.522 [2.068, 8.584] | 0.940 [0.898, 0.965] | 0.830 [0.772, 0.876] | 0.330 [0.269, 0.398] | 0.050 [0.027, 0.090] | 0.025 [0.011, 0.057] | 0.800 [0.739, 0.850] | 0.580 [0.511, 0.646] | 0.056 [0.043, 0.072] | 0.999 [0.996, 1.000] | 14 / 12 / 1.167 |
| stacked logistic (A, B; year-1 injections) | 0.003 | 3.014 [1.106, 6.561] | 0.990 [0.964, 0.997] | 0.850 [0.794, 0.893] | 0.325 [0.264, 0.393] | 0.015 [0.005, 0.043] | 0.005 [0.001, 0.028] | 0.840 [0.783, 0.884] | 0.565 [0.496, 0.632] | 0.043 [0.032, 0.057] | 0.998 [0.994, 0.999] | 14 / 9 / 1.556 |

## 8. Where the rank product's detections come from (k = 4 and the other k, 200 trials per cell)

At the rank product's operating level (p = 3e-05); component A alone = the re-tuned live set at its own level 1, B alone = 0016's union at L = 72.1 years. 'neither' = the rank product detected through the join although neither component was detected at its own operating level. 'A any' and 'B any' count every trial the component detects at its own level, whatever the ensemble does.

| cell | rank product detected | A alone | B alone | both | neither | A any | B any |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rare_k0 | 0/200 | 0 | 0 | 0 | 0 | 10 | 5 |
| rare_k2 | 3/200 | 0 | 0 | 3 | 0 | 76 | 17 |
| rare_k3 | 54/200 | 5 | 0 | 49 | 0 | 172 | 69 |
| rare_k4 | 137/200 | 16 | 0 | 121 | 0 | 196 | 133 |
| rare_k6 | 188/200 | 6 | 0 | 182 | 0 | 200 | 184 |
| common_esbl_k0 | 0/200 | 0 | 0 | 0 | 0 | 13 | 1 |
| common_esbl_k2 | 1/200 | 0 | 0 | 1 | 0 | 53 | 11 |
| common_esbl_k3 | 24/200 | 0 | 2 | 22 | 0 | 140 | 46 |
| common_esbl_k4 | 71/200 | 5 | 1 | 65 | 0 | 176 | 97 |
| common_esbl_k6 | 174/200 | 5 | 0 | 169 | 0 | 199 | 177 |

## 9. Checks

- `check_causal` on the whole rp ensemble (components rebuilt from the rows given), cuts 2025-03-31, 2025-12-31, 2026-06-30: no differences.
- `check_causal` on the whole stack ensemble (components rebuilt from the rows given), cuts 2025-03-31, 2025-12-31, 2026-06-30: no differences.
- Cached trial path against the from-scratch computation (components with `rebuild`): 48 trials, 1280 signals, 0 trials differ (max relative difference in p 0.00e+00).
- Focused against full ensemble signals on the real data: 3 cases, 109 signals, 0 mismatches (URO Escherichia coli 2025-06-01: 55 focused, 55 full, same; ICU Staphylococcus aureus 2026-03-01: 54 focused, 54 full, same; ED Klebsiella pneumoniae 2025-01-15: 0 focused, 0 full, same).
- Component signals on all the data: A 1187, B 10112. Runs of B by the way the world was obtained: 6624 fast, 56 rebuilt, 0 slow fallback.

