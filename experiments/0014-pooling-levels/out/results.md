# 0014 results: coverage pooled at hospital, inpatient/outpatient, ward class or unit

Command: `uv run python experiments/0014-pooling-levels/run.py`. Every number is computed by that run unless tagged (measured:
counted in the data; derived: calculated from numbers here). Deterministic; bootstrap draws are the harness's (seed 2026, 1,000
resamples of 26 windows or 24 months). Data: synthetic_microbiology_dataset, seed 2026, as received 2026-10-09.

Run time 73.1 s CPU of the 600 s budget.

## Row chosen on TUNE only

Ten 28-day windows 2023-12-25 to 2024-09-29, 61,847 isolate x antibiotic predictions, Brier in `left_out` (the isolate-level
credit for the S rows). Lowest wins, exact ties to the coarser level, then to no split. Never reported as C1.

| row | TUNE Brier | difference to the lowest |
|---|---|---|
| P-H (hospital, unsplit) **(chosen)** | 0.13681 | +0.00000 |
| P-IO (inpatient/outpatient, unsplit) | 0.13689 | +0.00008 |
| P-WC (ward class, unsplit) | 0.13699 | +0.00018 |
| P-U (unit, unsplit) | 0.13748 | +0.00067 |
| S-H (hospital, split) | 0.13693 | +0.00012 |
| S-IO (inpatient/outpatient, split) | 0.13708 | +0.00027 |
| S-WC (ward class, split) | 0.13718 | +0.00037 |
| S-U (unit, split) | 0.13801 | +0.00120 |

## Metrics: chosen row P-H against both baseline rows (95 % bootstrap intervals; 26 windows for C1 to C3(a) and C8 C1, 24 months for C3(b), C4, C7, C8 C4)

| metric | P-H | hospital-365 | shipped |
|---|---|---|---|
| C1 all | 0.1414 (0.1398 to 0.1431) | 0.1414 (0.1398 to 0.1431) | 0.1417 (0.1401 to 0.1435) |
| C1 small | 0.1605 (0.1576 to 0.1635) | 0.1605 (0.1576 to 0.1635) | 0.1614 (0.1582 to 0.1646) |
| C1 all, counted | 0.1453 (0.1437 to 0.1469) | 0.1453 (0.1437 to 0.1469) | 0.1456 (0.1440 to 0.1472) |
| C1 small, counted | 0.1417 (0.1393 to 0.1443) | 0.1417 (0.1393 to 0.1443) | 0.1424 (0.1399 to 0.1452) |
| C1 diff to hospital-365, all | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | +0.0003 (+0.0001 to +0.0005) |
| C1 diff, small | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | +0.0008 (+0.0004 to +0.0013) |
| C1 diff, all, counted | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | +0.0003 (+0.0002 to +0.0005) |
| C1 diff, small, counted | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | +0.0007 (+0.0003 to +0.0011) |
| C2 all | 0.4433 (0.4393 to 0.4476) | 0.4433 (0.4393 to 0.4476) | 0.4445 (0.4403 to 0.4488) |
| C2 diff, all | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | +0.0011 (+0.0006 to +0.0017) |
| C3(a) slope | 1.038 (1.025 to 1.053) | 1.038 (1.025 to 1.053) | 1.026 (1.012 to 1.041) |
| C3(a) intercept | 0.023 (0.005 to 0.039) | 0.023 (0.005 to 0.039) | 0.031 (0.014 to 0.047) |
| C4 mild, spectrum | 0.9661 (0.9626 to 0.9697) | 0.9661 (0.9626 to 0.9697) | 0.9656 (0.9621 to 0.9693) |
| C4 mild, all organisms | 0.7542 (0.7471 to 0.7605) | 0.7542 (0.7471 to 0.7605) | 0.7543 (0.7471 to 0.7606) |
| C4 severe | 0.9532 (0.9499 to 0.9559) | 0.9532 (0.9499 to 0.9559) | 0.9545 (0.9514 to 0.9572) |
| C4 mild, spectrum, counted | 0.9661 (0.9626 to 0.9697) | 0.9661 (0.9626 to 0.9697) | 0.9656 (0.9621 to 0.9693) |
| C4 mild, all, counted | 0.7542 (0.7471 to 0.7605) | 0.7542 (0.7471 to 0.7605) | 0.7543 (0.7471 to 0.7606) |
| C4 severe, counted | 0.9383 (0.9353 to 0.9412) | 0.9383 (0.9353 to 0.9412) | 0.9386 (0.9356 to 0.9412) |
| C7(a) share inside the 90 % band | 0.899 (0.875 to 0.923) | 0.899 (0.875 to 0.923) | 0.902 (0.877 to 0.925) |
| C7(a) expected under the method's own predictive | 0.907 | 0.907 | 0.907 |
| C7(a) minus expected | -0.008 (-0.032 to +0.016) | -0.008 (-0.032 to +0.016) | -0.005 (-0.030 to +0.018) |
| C7(a), literal | 0.147 (0.130 to 0.165) | 0.147 (0.130 to 0.165) | 0.343 (0.319 to 0.370) |
| C7(b), outbreak unit-months | 0.556 | 0.556 | 0.741 |
| C8 C1 (outbreak unit-months) | 0.1669 (0.1538 to 0.1931) | 0.1669 (0.1538 to 0.1931) | 0.1656 (0.1531 to 0.1928) |
| C8 C1 diff to hospital-365 | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | -0.0013 (-0.0040 to +0.0026) |
| C8 C4 mild, spectrum | 0.9643 (0.9091 to 0.9833) | 0.9643 (0.9091 to 0.9833) | 0.9643 (0.9091 to 0.9833) |
| C8 C4 severe | 0.9059 (0.7427 to 0.9813) | 0.9059 (0.7427 to 0.9813) | 0.9148 (0.7558 to 0.9726) |
| C3(b) mild, observed of expected | 0 of 0.1 (ratio 0.00, pass overall) | 0 of 0.1 (ratio 0.00, pass overall) | 0 of 0.3 (ratio 0.00, pass overall) |
| C3(b) severe, observed of expected | 29 of 26.2 (ratio 1.11, pass overall) | 29 of 26.2 (ratio 1.11, pass overall) | 23 of 19.6 (ratio 1.17, pass overall) |
| C6 E1 ceftriaxone, E1 cefuroxime, E2 cefuroxime (days) | not reached, not reached, not reached | not reached, not reached, not reached | 47, not reached, not reached |

n (chosen row): C1 all 163,666; C1 small 36,588; C4 severe picks 15,785; C7(a) blocks 1,993; C8 C1 2,692.

## Grid: all twelve rows, exploratory (every row scored on the scoring period)

C1 and C2 as differences to hospital-365, 95 % bootstrap intervals over 26 windows. P unsplit, S split (isolate-level on C1 to C3(a), C5, C8 C1; folded elsewhere), F folded everywhere.

| row | predictions with under 30 results in the pool of their level | C1 diff, all | C1 diff, small | C1 diff, all, counted | C1 diff, small, counted | C2 diff, all |
|---|---|---|---|---|---|---|
| P-H | 0.0 % | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) |
| P-IO | 0.0 % | -0.0000 (-0.0001 to +0.0000) | +0.0001 (-0.0002 to +0.0003) | -0.0000 (-0.0001 to +0.0000) | +0.0001 (-0.0001 to +0.0003) | -0.0001 (-0.0003 to +0.0000) |
| P-WC | 0.0 % | +0.0000 (-0.0001 to +0.0001) | +0.0002 (-0.0001 to +0.0004) | +0.0000 (-0.0000 to +0.0001) | +0.0001 (-0.0001 to +0.0004) | +0.0001 (-0.0001 to +0.0003) |
| P-U | 0.7 % | +0.0004 (+0.0002 to +0.0005) | +0.0011 (+0.0006 to +0.0016) | +0.0004 (+0.0002 to +0.0005) | +0.0008 (+0.0004 to +0.0012) | +0.0015 (+0.0009 to +0.0020) |
| S-H | 0.0 % | -0.0000 (-0.0001 to +0.0000) | +0.0000 (-0.0002 to +0.0002) | -0.0000 (-0.0001 to +0.0000) | +0.0000 (-0.0002 to +0.0002) | -0.0000 (-0.0001 to +0.0001) |
| S-IO | 0.0 % | +0.0000 (-0.0001 to +0.0001) | +0.0002 (-0.0001 to +0.0005) | +0.0000 (-0.0001 to +0.0001) | +0.0002 (-0.0000 to +0.0004) | +0.0001 (-0.0001 to +0.0003) |
| S-WC | 0.0 % | +0.0001 (-0.0000 to +0.0002) | +0.0003 (-0.0000 to +0.0006) | +0.0001 (-0.0000 to +0.0002) | +0.0002 (-0.0000 to +0.0005) | +0.0003 (+0.0001 to +0.0005) |
| S-U | 0.7 % | +0.0007 (+0.0006 to +0.0009) | +0.0024 (+0.0018 to +0.0030) | +0.0007 (+0.0005 to +0.0009) | +0.0017 (+0.0013 to +0.0022) | +0.0038 (+0.0030 to +0.0047) |
| F-H | 0.0 % | -0.0001 (-0.0001 to -0.0000) | -0.0000 (-0.0002 to +0.0001) | -0.0000 (-0.0001 to +0.0000) | -0.0000 (-0.0002 to +0.0001) | -0.0002 (-0.0003 to -0.0001) |
| F-IO | 0.0 % | -0.0000 (-0.0001 to +0.0000) | +0.0000 (-0.0002 to +0.0003) | -0.0000 (-0.0001 to +0.0000) | +0.0001 (-0.0001 to +0.0003) | -0.0001 (-0.0003 to +0.0000) |
| F-WC | 0.0 % | +0.0000 (-0.0001 to +0.0001) | +0.0001 (-0.0001 to +0.0004) | +0.0000 (-0.0000 to +0.0001) | +0.0001 (-0.0001 to +0.0004) | +0.0001 (-0.0001 to +0.0003) |
| F-U | 0.7 % | +0.0004 (+0.0002 to +0.0005) | +0.0011 (+0.0006 to +0.0016) | +0.0004 (+0.0002 to +0.0005) | +0.0008 (+0.0004 to +0.0012) | +0.0015 (+0.0009 to +0.0021) |

| row | C3(a) slope, intercept | C3(b) severe obs / exp | C4 mild spectrum | C4 mild all | C4 severe | C4 severe, counted | C7(a) | C7(b) |
|---|---|---|---|---|---|---|---|---|
| P-H | 1.038, 0.023 | 29 / 26.2 | 0.9661 | 0.7542 | 0.9532 | 0.9383 | 0.899 | 0.556 |
| P-IO | 1.037, 0.023 | 28 / 27.1 | 0.9656 | 0.7542 | 0.9537 | 0.9386 | 0.903 | 0.704 |
| P-WC | 1.036, 0.025 | 28 / 27.2 | 0.9656 | 0.7542 | 0.9537 | 0.9386 | 0.905 | 0.704 |
| P-U | 1.024, 0.032 | 25 / 20.4 | 0.9656 | 0.7543 | 0.9541 | 0.9380 | 0.902 | 0.741 |
| S-H | 1.037, 0.024 | 29 / 27.8 | 0.9654 | 0.7542 | 0.9537 | 0.9387 | 0.898 | 0.593 |
| S-IO | 1.035, 0.025 | 28 / 27.1 | 0.9656 | 0.7542 | 0.9537 | 0.9386 | 0.902 | 0.704 |
| S-WC | 1.034, 0.026 | 28 / 27.2 | 0.9656 | 0.7542 | 0.9537 | 0.9386 | 0.904 | 0.704 |
| S-U | 1.007, 0.043 | 23 / 19.9 | 0.9656 | 0.7543 | 0.9545 | 0.9386 | 0.903 | 0.741 |
| F-H | 1.038, 0.023 | 29 / 27.8 | 0.9654 | 0.7542 | 0.9537 | 0.9387 | 0.898 | 0.593 |
| F-IO | 1.037, 0.023 | 28 / 27.1 | 0.9656 | 0.7542 | 0.9537 | 0.9386 | 0.902 | 0.704 |
| F-WC | 1.036, 0.025 | 28 / 27.2 | 0.9656 | 0.7542 | 0.9537 | 0.9386 | 0.904 | 0.704 |
| F-U | 1.024, 0.032 | 23 / 19.9 | 0.9656 | 0.7543 | 0.9545 | 0.9386 | 0.903 | 0.741 |

| row | C8 C1 | C8 C1 diff to hospital-365 | C8 C4 mild spectrum | C8 C4 severe | C6 E1 CRO | C6 E1 CXM | C6 E2 CXM |
|---|---|---|---|---|---|---|---|
| P-H | 0.1669 (0.1538 to 0.1931) | +0.0000 (+0.0000 to +0.0000) | 0.9643 | 0.9059 | not reached | not reached | not reached |
| P-IO | 0.1656 (0.1530 to 0.1919) | -0.0013 (-0.0025 to -0.0002) | 0.9643 | 0.9224 | not reached | not reached | not reached |
| P-WC | 0.1656 (0.1530 to 0.1919) | -0.0013 (-0.0025 to -0.0002) | 0.9643 | 0.9224 | not reached | not reached | not reached |
| P-U | 0.1656 (0.1532 to 0.1930) | -0.0013 (-0.0040 to +0.0027) | 0.9643 | 0.9145 | 47 | not reached | not reached |
| S-H | 0.1663 (0.1533 to 0.1924) | -0.0006 (-0.0016 to +0.0003) | 0.9643 | 0.9224 | not reached | not reached | not reached |
| S-IO | 0.1660 (0.1531 to 0.1922) | -0.0009 (-0.0021 to +0.0002) | 0.9643 | 0.9224 | not reached | not reached | not reached |
| S-WC | 0.1660 (0.1531 to 0.1922) | -0.0009 (-0.0021 to +0.0002) | 0.9643 | 0.9224 | not reached | not reached | not reached |
| S-U | 0.1663 (0.1526 to 0.1948) | -0.0006 (-0.0032 to +0.0036) | 0.9643 | 0.9148 | 46 | not reached | not reached |
| F-H | 0.1659 (0.1532 to 0.1922) | -0.0010 (-0.0019 to -0.0000) | 0.9643 | 0.9224 | not reached | not reached | not reached |
| F-IO | 0.1656 (0.1530 to 0.1919) | -0.0013 (-0.0025 to -0.0001) | 0.9643 | 0.9224 | not reached | not reached | not reached |
| F-WC | 0.1656 (0.1530 to 0.1919) | -0.0013 (-0.0025 to -0.0001) | 0.9643 | 0.9224 | not reached | not reached | not reached |
| F-U | 0.1656 (0.1532 to 0.1929) | -0.0013 (-0.0040 to +0.0027) | 0.9643 | 0.9148 | 46 | not reached | not reached |

### C5: Brier of the pairs where units differ, `left_out` (no interval; the harness gives C5 as a point value)

| row | E. coli TMP | E. coli CIP | E. coli AMP | E. coli MEC |
|---|---|---|---|---|
| hospital-365 (baseline) | 0.1666 | 0.0751 | 0.2452 | 0.0757 |
| shipped (baseline) | 0.1662 | 0.0751 | 0.2438 | 0.0764 |
| P-H | 0.1666 | 0.0751 | 0.2452 | 0.0757 |
| P-IO | 0.1657 | 0.0750 | 0.2438 | 0.0758 |
| P-WC | 0.1658 | 0.0749 | 0.2438 | 0.0759 |
| P-U | 0.1662 | 0.0752 | 0.2438 | 0.0764 |
| S-H | 0.1659 | 0.0750 | 0.2442 | 0.0758 |
| S-IO | 0.1657 | 0.0750 | 0.2438 | 0.0759 |
| S-WC | 0.1658 | 0.0750 | 0.2439 | 0.0760 |
| S-U | 0.1663 | 0.0756 | 0.2443 | 0.0764 |
| F-H | 0.1658 | 0.0750 | 0.2442 | 0.0758 |
| F-IO | 0.1657 | 0.0750 | 0.2437 | 0.0758 |
| F-WC | 0.1658 | 0.0749 | 0.2438 | 0.0759 |
| F-U | 0.1662 | 0.0752 | 0.2438 | 0.0764 |

Difference to hospital-365 for the unsplit rows (negative is better): P-IO TMP -0.0009, CIP -0.0001, AMP -0.0014, MEC +0.0001; P-WC TMP -0.0008, CIP -0.0001, AMP -0.0014, MEC +0.0002; P-U TMP -0.0004, CIP +0.0001, AMP -0.0014, MEC +0.0007.

## Replacement rule, line by line, against the shipped row (readings proposed (overnight), pending Artem)

C1: the row's C1 (all cells, `left_out` and `counted`) at most 0.002 above hospital-365's and above the shipped row's. C4 "points": none of the six figures (mild spectrum, mild all, severe; both conventions) below the shipped row's; "interval": no figure whose paired 95 % interval lies wholly below zero. C8 "points": C8 C1 below the shipped row's; "interval": the paired interval lies wholly below zero. C3(b) and C7(a) as the harness passes them (C3(b) with the Beta-binomial expectation beside).

| row | C1 | C4 points | C4 interval | C8 points | C8 interval | C3(b) | C3(b) Beta-binomial | C7(a) | lines passed, points | lines passed, interval |
|---|---|---|---|---|---|---|---|---|---|---|
| P-H | pass | fail | fail | fail | fail | pass | pass | pass | 3 of 5 | 3 of 5 |
| P-IO | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| P-WC | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| P-U | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| S-H | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| S-IO | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| S-WC | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| S-U | pass | pass | pass | fail | fail | pass | pass | pass | 4 of 5 | 4 of 5 |
| F-H | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| F-IO | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| F-WC | pass | fail | pass | fail | fail | pass | pass | pass | 3 of 5 | 4 of 5 |
| F-U | pass | pass | pass | fail | fail | pass | pass | pass | 4 of 5 | 4 of 5 |

Paired differences to the shipped row (C4 over 24 months, C8 C1 over 26 windows), with 95 % intervals:

| row | C4 mild spectrum | C4 mild all | C4 severe | C4 severe, counted | C8 C1 |
|---|---|---|---|---|---|
| P-H | +0.0005 (-0.0000 to +0.0012) | -0.0001 (-0.0002 to +0.0000) | -0.0013 (-0.0026 to -0.0001) | -0.0003 (-0.0015 to +0.0009) | +0.0013 (-0.0028 to +0.0040) |
| P-IO | -0.0000 (-0.0000 to +0.0000) | -0.0001 (-0.0002 to +0.0000) | -0.0008 (-0.0019 to +0.0002) | +0.0000 (-0.0010 to +0.0011) | +0.0000 (-0.0029 to +0.0018) |
| P-WC | -0.0000 (-0.0000 to +0.0000) | -0.0001 (-0.0002 to +0.0000) | -0.0008 (-0.0019 to +0.0002) | +0.0000 (-0.0010 to +0.0011) | +0.0000 (-0.0029 to +0.0018) |
| P-U | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | -0.0004 (-0.0008 to +0.0000) | -0.0005 (-0.0012 to +0.0000) | +0.0001 (+0.0000 to +0.0002) |
| S-H | -0.0002 (-0.0006 to +0.0000) | -0.0001 (-0.0002 to +0.0000) | -0.0008 (-0.0019 to +0.0002) | +0.0001 (-0.0009 to +0.0011) | +0.0007 (-0.0027 to +0.0028) |
| S-IO | -0.0000 (-0.0000 to +0.0000) | -0.0001 (-0.0002 to +0.0000) | -0.0008 (-0.0019 to +0.0002) | +0.0000 (-0.0010 to +0.0011) | +0.0004 (-0.0027 to +0.0022) |
| S-WC | -0.0000 (-0.0000 to +0.0000) | -0.0001 (-0.0002 to +0.0000) | -0.0008 (-0.0019 to +0.0002) | +0.0000 (-0.0010 to +0.0011) | +0.0004 (-0.0027 to +0.0022) |
| S-U | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | +0.0001 (-0.0002 to +0.0003) | +0.0001 (-0.0002 to +0.0003) | +0.0007 (-0.0011 to +0.0033) |
| F-H | -0.0002 (-0.0006 to +0.0000) | -0.0001 (-0.0002 to +0.0000) | -0.0008 (-0.0019 to +0.0002) | +0.0001 (-0.0009 to +0.0011) | +0.0004 (-0.0028 to +0.0023) |
| F-IO | -0.0000 (-0.0000 to +0.0000) | -0.0001 (-0.0002 to +0.0000) | -0.0008 (-0.0019 to +0.0002) | +0.0000 (-0.0010 to +0.0011) | +0.0000 (-0.0030 to +0.0018) |
| F-WC | -0.0000 (-0.0000 to +0.0000) | -0.0001 (-0.0002 to +0.0000) | -0.0008 (-0.0019 to +0.0002) | +0.0000 (-0.0010 to +0.0011) | +0.0000 (-0.0030 to +0.0018) |
| F-U | +0.0000 (+0.0000 to +0.0000) | +0.0000 (+0.0000 to +0.0000) | +0.0001 (-0.0002 to +0.0003) | +0.0001 (-0.0002 to +0.0003) | +0.0000 (-0.0000 to +0.0002) |

C1 of each row minus the shipped row's, all cells (left_out, counted), point values without an interval (the harness bootstraps only against hospital-365):

| row | left_out | counted |
|---|---|---|
| P-H | -0.0003 | -0.0003 |
| P-IO | -0.0003 | -0.0004 |
| P-WC | -0.0003 | -0.0003 |
| P-U | +0.0001 | +0.0000 |
| S-H | -0.0003 | -0.0003 |
| S-IO | -0.0003 | -0.0003 |
| S-WC | -0.0002 | -0.0003 |
| S-U | +0.0004 | +0.0004 |
| F-H | -0.0004 | -0.0004 |
| F-IO | -0.0003 | -0.0004 |
| F-WC | -0.0003 | -0.0003 |
| F-U | +0.0001 | +0.0000 |

## Checks

| check | result | pass |
|---|---|---|
| P-H equals `hospital_365` (p, a, b, n; 3 views x 3 conventions) | largest absolute difference 0 | yes |
| P-U equals `estimators_0004()[1]`, 0004's unit 365-day raw estimator (p; 3 views x 3 conventions) | largest absolute difference 0 | yes |
| P-H's metrics equal `coverage-hospital-365.json` | 150 numbers compared at 6 significant digits, largest difference 0; keys in one file only: none | yes |
| S equals P at IO, WC, U on the outpatient units (onset weight 0), cells with a non-empty pool | 1404 cells compared (702 empty-pool cells left out, where the two fall back differently); largest difference in p 0, in a and b 0 | yes |
| with w_s := n_s / n the split equals k / n (unit level, cells with results) | 1404 cells, largest absolute difference 1.11e-16 | yes |
| the matched Beta of the fold has its mean and variance (cells with 0 < w_O < 1, floor inactive); w_O = 0 returns the stratum's Beta | 1872 cells, largest absolute difference in mean 1.11e-16, largest relative difference in variance 6.26e-16 | yes |
| F and S have identical C3(b), C4, C6, C7 and C8 (C4) at every level | 24 of 24 comparisons equal | yes |
| every call reads only rows dated before `view.start` and within 365 days of it | 3 views, frames' dates checked; violations: none | yes |

## The figure

`figure.png`: the ladder of pools for ED blood CXM as of 2026-09-27 (the cell chosen on rows dated up to 2024-09-30). The shipped rule would use the unit pool.

| level | k | n | covered | 90 % interval |
|---|---|---|---|---|
| hospital | 218 | 290 | 75.2 % | 70.8 % to 79.1 % |
| inpatient/outpatient | 75 | 102 | 73.5 % | 65.9 % to 80.2 % |
| ward class | 75 | 102 | 73.5 % | 65.9 % to 80.2 % |
| unit | 75 | 102 | 73.5 % | 65.9 % to 80.2 % |

