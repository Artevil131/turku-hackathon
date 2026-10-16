# 0012 discounted Beta-binomial: results

All numbers are computed by this run through `aei.score_coverage`, except the two baseline rows, which are the committed rows
(`benchmarks/overnight-2026-10-17/baselines/coverage-hospital-365.json`, `coverage-shipped.json`, computed by the same harness).
Intervals are 95 % bootstrap intervals over target windows (C1, C2, C3(a), C8) or target months (C4, C7), 1,000 resamples, seed 2026.
Exploratory (PROTOCOL.md): every grid row was scored on the scoring period; only the chosen row was chosen without it.

Run time 32.5 s CPU (computed, `aei.harness.Clock`).

## Choosing a setting on the TUNE windows

Ten 28-day windows 2023-12-25 to 2024-09-29, 61,847 isolate x antibiotic targets, left_out, local Brier (used only to choose; not C1).
Hospital-365 on the same targets, for reference: 0.1368.

| δ per week | M 10 | M 30 | M 100 |
|---|---|---|---|
| 0.90 | 0.1376 | 0.1376 | 0.1379 |
| 0.95 | 0.1377 * | 0.1382 | 0.1398 |
| 0.98 | 0.1382 | 0.1397 | 0.1440 |
| 1.00 | 0.1389 | 0.1421 | 0.1515 |

Best 0.1376; settings within 0.0005 of it: δ 0.90 M 10, δ 0.90 M 30, δ 0.90 M 100, δ 0.95 M 10. Chosen by the plan's rule: **δ 0.95, M 10** (*).

## The grid on the scoring period (exploratory)

C1 and C2 as value, then difference to hospital-365 (negative is better) with the 95 % interval of the difference. Hospital-365 and shipped rows first.

| setting | C1 all | C1 diff, all | C1 diff, small | C1 diff, all counted | C2 diff, all |
|---|---|---|---|---|---|
| hospital 365 d (baseline) | 0.1414 | 0 | 0 | 0 | 0 |
| shipped list | 0.1417 | +0.0003 (+0.0001 to +0.0005) | +0.0008 (+0.0004 to +0.0013) | +0.0003 (+0.0002 to +0.0005) | +0.0011 (+0.0006 to +0.0017) |
| δ 0.90, M 10 | 0.1419 | +0.0005 (+0.0002 to +0.0007) | +0.0014 (+0.0008 to +0.0019) | +0.0094 (+0.0090 to +0.0099) | +0.0018 (+0.0011 to +0.0024) |
| δ 0.90, M 30 | 0.1416 | +0.0001 (-0.0000 to +0.0003) | +0.0006 (+0.0002 to +0.0009) | +0.0089 (+0.0085 to +0.0094) | +0.0007 (+0.0001 to +0.0011) |
| δ 0.90, M 100 | 0.1413 | -0.0001 (-0.0002 to +0.0001) | +0.0002 (-0.0001 to +0.0004) | +0.0086 (+0.0081 to +0.0091) | -0.0001 (-0.0005 to +0.0003) |
| δ 0.95, M 10 | 0.1416 | +0.0002 (-0.0000 to +0.0004) | +0.0009 (+0.0004 to +0.0013) | +0.0091 (+0.0086 to +0.0096) | +0.0008 (+0.0002 to +0.0013) |
| δ 0.95, M 30 | 0.1414 | +0.0000 (-0.0002 to +0.0002) | +0.0003 (-0.0000 to +0.0007) | +0.0088 (+0.0083 to +0.0093) | +0.0002 (-0.0003 to +0.0007) |
| δ 0.95, M 100 | 0.1413 | -0.0001 (-0.0002 to +0.0000) | +0.0001 (-0.0002 to +0.0003) | +0.0085 (+0.0080 to +0.0090) | -0.0003 (-0.0007 to +0.0001) |
| δ 0.98, M 10 | 0.1414 | +0.0000 (-0.0002 to +0.0002) | +0.0006 (+0.0002 to +0.0011) | +0.0087 (+0.0083 to +0.0092) | +0.0002 (-0.0004 to +0.0008) |
| δ 0.98, M 30 | 0.1414 | -0.0000 (-0.0002 to +0.0001) | +0.0005 (+0.0001 to +0.0008) | +0.0085 (+0.0081 to +0.0090) | +0.0001 (-0.0004 to +0.0007) |
| δ 0.98, M 100 | 0.1415 | +0.0001 (-0.0001 to +0.0003) | +0.0007 (+0.0003 to +0.0012) | +0.0083 (+0.0079 to +0.0088) | +0.0008 (+0.0000 to +0.0016) |
| δ 1.00, M 10 | 0.1416 | +0.0002 (+0.0000 to +0.0004) | +0.0017 (+0.0012 to +0.0023) | +0.0087 (+0.0082 to +0.0091) | +0.0008 (+0.0002 to +0.0014) |
| δ 1.00, M 30 | 0.1424 | +0.0010 (+0.0007 to +0.0012) | +0.0045 (+0.0036 to +0.0054) | +0.0091 (+0.0087 to +0.0095) | +0.0032 (+0.0024 to +0.0042) |
| δ 1.00, M 100 | 0.1453 | +0.0039 (+0.0033 to +0.0045) | +0.0136 (+0.0117 to +0.0155) | +0.0115 (+0.0109 to +0.0121) | +0.0123 (+0.0106 to +0.0144) |
| δ 0.95, M 10 (no onset split) | 0.1415 | +0.0001 (-0.0001 to +0.0003) | +0.0008 (+0.0003 to +0.0013) | +0.0090 (+0.0085 to +0.0095) | +0.0004 (-0.0003 to +0.0010) |
| δ 1.00, M 10 (tracked prior) | 0.1414 | -0.0000 (-0.0002 to +0.0002) | +0.0007 (+0.0002 to +0.0011) | +0.0087 (+0.0082 to +0.0092) | +0.0001 (-0.0006 to +0.0007) |
| δ 1.00, M 30 (tracked prior) | 0.1413 | -0.0001 (-0.0003 to +0.0001) | +0.0004 (-0.0000 to +0.0008) | +0.0086 (+0.0082 to +0.0092) | -0.0002 (-0.0008 to +0.0004) |
| δ 1.00, M 100 (tracked prior) | 0.1413 | -0.0001 (-0.0003 to +0.0000) | +0.0002 (-0.0002 to +0.0005) | +0.0086 (+0.0081 to +0.0091) | -0.0004 (-0.0009 to +0.0001) |

The `counted` column is worse for every setting because the filter is fitted on tested results only (README, "Experiment"), so its share says nothing about the untested part of an antibiotic that is tested on few isolates; hospital-365 in that convention counts untested as not covered.

| setting | C3(a) slope | C3(a) intercept | C3(b) mild obs / exp | C3(b) severe obs / exp | C3(b) | C7(a) | C7(b) | C7(a) literal |
|---|---|---|---|---|---|---|---|---|
| hospital 365 d (baseline) | 1.038 | +0.023 | 0 / 0.13 | 29 / 26.2 | pass | 0.899 | 0.556 | 0.147 |
| shipped list | 1.026 | +0.031 | 0 / 0.31 | 23 / 19.6 | pass | 0.902 | 0.741 | 0.343 |
| δ 0.90, M 10 | 0.968 | +0.008 | 0 / 0.20 | 9 / 2.6 | fail | 0.943 | 0.852 | 0.726 |
| δ 0.90, M 30 | 0.977 | -0.000 | 0 / 0.20 | 12 / 4.8 | fail | 0.938 | 0.815 | 0.682 |
| δ 0.90, M 100 | 0.983 | -0.007 | 0 / 0.17 | 22 / 16.6 | pass | 0.934 | 0.778 | 0.576 |
| δ 0.95, M 10 | 0.977 | +0.001 | 0 / 0.23 | 14 / 7.3 | fail | 0.929 | 0.815 | 0.612 |
| δ 0.95, M 30 | 0.985 | -0.005 | 0 / 0.22 | 14 / 10.2 | pass | 0.929 | 0.778 | 0.580 |
| δ 0.95, M 100 | 0.994 | -0.011 | 0 / 0.22 | 24 / 19.8 | pass | 0.924 | 0.778 | 0.508 |
| δ 0.98, M 10 | 0.991 | -0.011 | 0 / 0.33 | 19 / 16.2 | pass | 0.924 | 0.741 | 0.470 |
| δ 0.98, M 30 | 1.012 | -0.017 | 0 / 0.62 | 16 / 17.0 | pass | 0.923 | 0.741 | 0.451 |
| δ 0.98, M 100 | 1.052 | -0.025 | 0 / 1.76 | 12 / 15.8 | pass | 0.913 | 0.741 | 0.400 |
| δ 1.00, M 10 | 1.014 | -0.021 | 0 / 0.85 | 17 / 23.8 | pass | 0.916 | 0.667 | 0.343 |
| δ 1.00, M 30 | 1.065 | -0.024 | 0 / 2.20 | 10 / 17.2 | pass | 0.912 | 0.667 | 0.335 |
| δ 1.00, M 100 | 1.181 | -0.014 | 0 / 1.45 | 0 / 5.7 | pass | 0.849 | 0.630 | 0.289 |
| δ 0.95, M 10 (no onset split) | 0.979 | -0.001 | 0 / 0.21 | 21 / 13.3 | fail | 0.916 | 0.778 | 0.518 |
| δ 1.00, M 10 (tracked prior) | 0.975 | -0.014 | 0 / 0.19 | 28 / 22.3 | pass | 0.911 | 0.593 | 0.345 |
| δ 1.00, M 30 (tracked prior) | 0.978 | -0.016 | 0 / 0.34 | 29 / 24.4 | pass | 0.912 | 0.593 | 0.336 |
| δ 1.00, M 100 (tracked prior) | 0.980 | -0.018 | 0 / 0.50 | 29 / 26.8 | pass | 0.911 | 0.593 | 0.317 |

| setting | C4 mild spectrum | C4 mild all | C4 severe | C4 mild spectrum counted | C4 mild all counted | C4 severe counted |
|---|---|---|---|---|---|---|
| hospital 365 d (baseline) | 96.6 % | 75.4 % | 95.3 % | 96.6 % | 75.4 % | 93.8 % |
| shipped list | 96.6 % | 75.4 % | 95.4 % | 96.6 % | 75.4 % | 93.9 % |
| δ 0.90, M 10 | 96.6 % | 75.4 % | 95.7 % | 96.6 % | 75.4 % | 93.9 % |
| δ 0.90, M 30 | 96.6 % | 75.4 % | 95.6 % | 96.6 % | 75.4 % | 93.8 % |
| δ 0.90, M 100 | 96.6 % | 75.4 % | 95.5 % | 96.6 % | 75.4 % | 93.9 % |
| δ 0.95, M 10 | 96.6 % | 75.4 % | 95.5 % | 96.6 % | 75.4 % | 93.8 % |
| δ 0.95, M 30 | 96.6 % | 75.4 % | 95.5 % | 96.6 % | 75.4 % | 93.9 % |
| δ 0.95, M 100 | 96.6 % | 75.4 % | 95.4 % | 96.6 % | 75.4 % | 93.8 % |
| δ 0.98, M 10 | 96.6 % | 75.4 % | 95.4 % | 96.6 % | 75.4 % | 93.8 % |
| δ 0.98, M 30 | 96.6 % | 75.4 % | 95.5 % | 96.6 % | 75.4 % | 93.8 % |
| δ 0.98, M 100 | 96.6 % | 75.4 % | 95.5 % | 96.6 % | 75.4 % | 93.8 % |
| δ 1.00, M 10 | 96.6 % | 75.4 % | 95.5 % | 96.6 % | 75.4 % | 93.9 % |
| δ 1.00, M 30 | 96.6 % | 75.5 % | 95.6 % | 96.5 % | 75.4 % | 93.9 % |
| δ 1.00, M 100 | 96.8 % | 75.5 % | 95.8 % | 96.8 % | 75.4 % | 93.8 % |
| δ 0.95, M 10 (no onset split) | 96.6 % | 75.4 % | 95.3 % | 96.6 % | 75.4 % | 93.7 % |
| δ 1.00, M 10 (tracked prior) | 96.6 % | 75.4 % | 95.4 % | 96.6 % | 75.4 % | 93.8 % |
| δ 1.00, M 30 (tracked prior) | 96.6 % | 75.4 % | 95.4 % | 96.6 % | 75.4 % | 93.9 % |
| δ 1.00, M 100 (tracked prior) | 96.5 % | 75.4 % | 95.3 % | 96.5 % | 75.4 % | 93.8 % |

| setting | C8 C1 | C8 C1 diff to hospital-365 | C8 C4 mild spectrum | C8 C4 severe | C6 E1 CRO | C6 E1 CXM | C6 E2 CXM |
|---|---|---|---|---|---|---|---|
| hospital 365 d (baseline) | 0.1669 | +0.0000 (+0.0000 to +0.0000) | 96.4 % | 90.6 % | not reached | not reached | not reached |
| shipped list | 0.1656 | -0.0013 (-0.0040 to +0.0026) | 96.4 % | 91.5 % | 47 | not reached | not reached |
| δ 0.90, M 10 | 0.1675 | +0.0006 (-0.0026 to +0.0049) | 96.3 % | n/a | 44 | not reached | not reached |
| δ 0.90, M 30 | 0.1665 | -0.0004 (-0.0024 to +0.0020) | 96.4 % | n/a | 48 | not reached | not reached |
| δ 0.90, M 100 | 0.1664 | -0.0005 (-0.0017 to +0.0008) | 96.4 % | 94.0 % | not reached | not reached | not reached |
| δ 0.95, M 10 | 0.1666 | -0.0003 (-0.0026 to +0.0032) | 95.8 % | n/a | 48 | not reached | not reached |
| δ 0.95, M 30 | 0.1662 | -0.0007 (-0.0024 to +0.0017) | 96.4 % | 94.0 % | 48 | not reached | not reached |
| δ 0.95, M 100 | 0.1662 | -0.0007 (-0.0018 to +0.0008) | 96.4 % | 91.5 % | not reached | not reached | not reached |
| δ 0.98, M 10 | 0.1662 | -0.0007 (-0.0021 to +0.0014) | 96.4 % | 94.2 % | not reached | not reached | not reached |
| δ 0.98, M 30 | 0.1659 | -0.0010 (-0.0023 to +0.0007) | 96.4 % | 94.2 % | not reached | not reached | not reached |
| δ 0.98, M 100 | 0.1655 | -0.0014 (-0.0027 to -0.0002) | 96.4 % | 92.7 % | not reached | not reached | not reached |
| δ 1.00, M 10 | 0.1662 | -0.0007 (-0.0016 to +0.0006) | 96.8 % | 94.2 % | not reached | not reached | not reached |
| δ 1.00, M 30 | 0.1660 | -0.0009 (-0.0029 to +0.0024) | 96.8 % | 92.7 % | not reached | not reached | not reached |
| δ 1.00, M 100 | 0.1681 | +0.0012 (-0.0027 to +0.0089) | 96.8 % | n/a | not reached | not reached | not reached |
| δ 0.95, M 10 (no onset split) | 0.1661 | -0.0008 (-0.0036 to +0.0028) | 96.4 % | 90.7 % | 25 | 34 | not reached |
| δ 1.00, M 10 (tracked prior) | 0.1669 | +0.0000 (-0.0008 to +0.0016) | 96.4 % | 91.5 % | not reached | not reached | not reached |
| δ 1.00, M 30 (tracked prior) | 0.1669 | -0.0000 (-0.0008 to +0.0014) | 96.4 % | 91.5 % | not reached | not reached | not reached |
| δ 1.00, M 100 (tracked prior) | 0.1668 | -0.0000 (-0.0007 to +0.0011) | 96.4 % | 92.2 % | not reached | not reached | not reached |

C8 (chosen setting) rests on 2,692 target isolate x antibiotic pairs (C1), 168 isolates (C4 mild spectrum) and n/a (C4 severe) in the six outbreak unit-months; "n/a" in the C8 C4 columns means no top pick of that setting cleared its bar in any outbreak query-month, so there is nothing to score. C6 is days from the first outbreak isolate (E1 2025-05-30, E2 2026-03-03) until the 90 % interval excludes the estimate of the day before; "not reached" is no exclusion within 120 days.

Reference, not part of the plan's grid: 0004 estimator 5 unit 365 d shrunk to hospital (M 20) (the unit's last 365 days shrunk to the hospital's, no recency): C1 diff to hospital-365 +0.0002 (+0.0001 to +0.0004) (small cells +0.0006 (+0.0002 to +0.0009)); C8 C1 0.1655, diff to hospital-365 -0.0014 (-0.0038 to +0.0017). It has no interval, so no C4, C6 or C7.

## The chosen setting, δ 0.95, M 10, against the two baseline rows

| | hospital 365 d | shipped list | chosen |
|---|---|---|---|
| C1, all cells (n 163,666) | 0.1414 (0.1398 to 0.1431) | 0.1417 (0.1401 to 0.1435) | 0.1416 (0.1399 to 0.1434) |
| C1 diff to hospital-365, all | 0 | +0.0003 (+0.0001 to +0.0005) | +0.0002 (-0.0000 to +0.0004) |
| C1, small cells (n 36,588) | 0.1605 (0.1576 to 0.1635) | 0.1614 (0.1582 to 0.1646) | 0.1614 (0.1584 to 0.1647) |
| C1 diff, small | 0 | +0.0008 (+0.0004 to +0.0013) | +0.0009 (+0.0004 to +0.0013) |
| C1, all counted | 0.1453 (0.1437 to 0.1469) | 0.1456 (0.1440 to 0.1472) | 0.1543 (0.1525 to 0.1562) |
| C2, all cells | 0.4433 (0.4393 to 0.4476) | 0.4445 (0.4403 to 0.4488) | 0.4441 (0.4397 to 0.4485) |
| C2 diff, all | 0 | +0.0011 (+0.0006 to +0.0017) | +0.0008 (+0.0002 to +0.0013) |
| C3(a) slope | 1.038 (1.025 to 1.053) | 1.026 (1.012 to 1.041) | 0.977 (0.964 to 0.990) |
| C3(a) intercept | +0.023 (+0.005 to +0.039) | +0.031 (+0.014 to +0.047) | +0.001 (-0.018 to +0.016) |
| C4 mild spectrum | 96.6 % (96.3 to 97.0) | 96.6 % (96.2 to 96.9) | 96.6 % (96.3 to 97.0) |
| C4 mild all | 75.4 % (74.7 to 76.1) | 75.4 % (74.7 to 76.1) | 75.4 % (74.7 to 76.0) |
| C4 severe | 95.3 % (95.0 to 95.6) | 95.4 % (95.1 to 95.7) | 95.5 % (95.1 to 95.8) |
| C4 mild spectrum counted | 96.6 % (96.3 to 97.0) | 96.6 % (96.2 to 96.9) | 96.6 % (96.3 to 96.9) |
| C4 mild all counted | 75.4 % (74.7 to 76.1) | 75.4 % (74.7 to 76.1) | 75.4 % (74.7 to 76.0) |
| C4 severe counted | 93.8 % (93.5 to 94.1) | 93.9 % (93.6 to 94.1) | 93.8 % (93.5 to 94.1) |
| C7(a), 90 % predictive interval (blocks 1993) | 0.899 (0.875 to 0.923) | 0.902 (0.877 to 0.925) | 0.929 (0.908 to 0.948) |
| C7(b), outbreak blocks (27) | 0.556 | 0.741 | 0.815 |
| C8 C1 (n 2,692) | 0.1669 (0.1538 to 0.1931) | 0.1656 (0.1531 to 0.1928) | 0.1666 (0.1540 to 0.1937) |
| C8 C4 mild spectrum (n 168) | 96.4 % | 96.4 % | 95.8 % |
| C8 C4 severe (n none cleared) | 90.6 % | 91.5 % | n/a |
| C6 days, E1 ceftriaxone | not reached | 47 | 48 |
| C6 days, E1 cefuroxime | not reached | not reached | not reached |
| C6 days, E2 cefuroxime | not reached | not reached | not reached |

### Differences to the shipped list, chosen setting (paired bootstrap, same resamples, seed 2026)

| figure | chosen minus shipped | 95 % interval | shipped | n chosen / shipped |
|---|---|---|---|---|
| C4 mild spectrum | +0.040 points | (-0.019 to +0.115) | 96.6 % | 9,834 / 9,866 |
| C4 mild all | -0.008 points | (-0.021 to +0.000) | 75.4 % | 16,138 / 16,139 |
| C4 severe | +0.038 points | (-0.157 to +0.223) | 95.4 % | 10,674 / 14,473 |
| C4 mild spectrum counted | +0.030 points | (-0.044 to +0.113) | 96.6 % | 9,835 / 9,866 |
| C4 mild all counted | -0.012 points | (-0.031 to +0.000) | 75.4 % | 16,139 / 16,139 |
| C4 severe counted | -0.043 points | (-0.266 to +0.158) | 93.9 % | 10,864 / 14,718 |
| C8 C1 (Brier) | +0.0011 | (+0.0002 to +0.0021) | 0.1656 | 2,692 |

## Replacement rule of METRICS.md "Decision rules", chosen setting, line by line

"Not worse" and "better" are read two ways, both proposed (overnight), pending Artem: by point values, and by what the paired 95 % interval allows (C4 not credibly worse: no figure whose interval lies wholly below zero; C8 credibly better: the interval lies wholly below zero).

| line | criterion | chosen | reference | verdict |
|---|---|---|---|---|
| C1 within 0.002 | C1 diff to hospital-365, all cells, left_out, at most +0.002 | +0.0002 (-0.0000 to +0.0004) | limit +0.0020 | pass |
| C4 not worse, both untested conventions, by points | none of the six figures below the shipped row | mild spectrum +0.040; mild all -0.008; severe +0.038; mild spectrum counted +0.030; mild all counted -0.012; severe counted -0.043 (points) | shipped row | fail |
| C4 not worse, by interval | no paired interval wholly below zero | lowest upper bound +0.000 points | shipped row | pass |
| C8 better, by points | C8 Brier below the shipped row's | 0.1666, diff +0.0011 | shipped 0.1656 | fail |
| C8 better, by interval | paired interval wholly below zero | (+0.0002 to +0.0021) | shipped 0.1656 | fail |
| C3(b) passes (binomial expectation, the harness's, as 0010) | obs / exp at most 1.5 for mild and severe | severe 14 / 7.3 = 1.92; mild 0 / 0.23 | shipped severe 23 / 19.6 = 1.17 | fail |
| C3(b) with the Beta-binomial expectation (METRICS.md's wording), beside it | same | severe 14 / 9.6 = 1.46; mild 0 / 0.78 | shipped severe 23 / 21.3 = 1.08 | pass |
| C7(a) passes | share inside 0.85 to 0.95 (proposed band) | 0.929 (0.908 to 0.948) | shipped 0.902 | pass |

Lines passed: 2 of 5 by points, 3 of 5 by interval. All five pass: **no** by points, **no** by interval. C6 beside it: E1 ceftriaxone 48, E1 cefuroxime not reached, E2 cefuroxime not reached.

### The same lines for every row of the grid (exploratory; every row was scored on the scoring period)

| setting | C1 | C4 points | C4 interval | C8 points | C8 interval | C3(b) | C3(b) Beta-binomial | C7(a) | passed, points | passed, interval |
|---|---|---|---|---|---|---|---|---|---|---|
| δ 0.90, M 10 | pass | fail | pass | fail | fail | fail | fail | pass | 2 of 5 | 3 of 5 |
| δ 0.90, M 30 | pass | fail | pass | fail | fail | fail | fail | pass | 2 of 5 | 3 of 5 |
| δ 0.90, M 100 | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| δ 0.95, M 10 | pass | fail | pass | fail | fail | fail | pass | pass | 2 of 5 | 3 of 5 |
| δ 0.95, M 30 | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| δ 0.95, M 100 | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| δ 0.98, M 10 | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| δ 0.98, M 30 | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| δ 0.98, M 100 | pass | fail | pass | pass | fail | pass | pass | pass | 4 of 5 | 4 of 5 |
| δ 1.00, M 10 | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| δ 1.00, M 30 | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| δ 1.00, M 100 | fail | fail | pass | fail | fail | pass | pass | fail | 1 of 5 | 2 of 5 |
| δ 0.95, M 10 (no onset split) | pass | fail | fail | fail | fail | fail | pass | pass | 2 of 5 | 2 of 5 |
| δ 1.00, M 10 (tracked prior) | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| δ 1.00, M 30 (tracked prior) | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| δ 1.00, M 100 (tracked prior) | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |

## Checks

- Recursion: the vectorised filter equals a plain Python loop of the formula on URO urine ceftriaxone for three settings; largest absolute difference in E[p] 0.0e+00 (computed).
- Causality: the estimate for a target starting the day after a cut date, from a table truncated at the cut, against the full table (largest absolute difference of a and b over all cells, both strata, both outcomes): 2024-06-16 0.0e+00; 2025-07-09 0.0e+00; 2026-03-18 0.0e+00; δ 1.0, M 10 at 2024-06-16: 0.0e+00 (computed).
- Baseline: hospital-365 C1 all cells recomputed here 0.141409; committed row 0.141409 (computed).
- Weekly counts: the first-isolate covered and not covered counts of weeks 0, 70, 130 (all cells, both strata, both outcomes) equal a plain loop over `aei.counting.first_isolates` and `aei.eucast.effective_result`; largest absolute difference 0, 2,195 non-zero cell counts compared (computed).
- Mixture: for the as-of 2025-07-09 the moment-matched Beta has the mixture's mean and variance; largest absolute differences 2.2e-16 (mean) and 4.4e-16 (variance), over the 234 cells whose weights come from the effective counts and whose concentration is above the floor of 1 (computed).
- Shipped row: the per-month C4 parts and per-window C8 sums used for the paired differences reproduce the committed row's C4 (largest difference 4.3e-07) and C8 C1 (difference 1.8e-07) (computed).

## Figures

- `figure.png`: the proposed visualisation's sparkline for URO urine ceftriaxone, weekly estimate and 90 % interval for δ 0.90 and δ 1.0 at M 30, the hospital-365 share, the week's first-isolate counts, the E1 onset.
- `c1_grid.png`: C1 difference to hospital-365, all cells and small cells, per setting with 95 % intervals.
