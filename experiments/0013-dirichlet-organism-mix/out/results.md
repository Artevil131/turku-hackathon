# 0013 results

Chosen on the ten TUNE windows (2023-12-25 to 2024-09-29, 61847 isolate x antibiotic predictions, `left_out`, selection only): **M_pi = 100, M = 30**; tied within 0.0001 of the lowest: (100, 10), (100, 30), (100, 100), (100, 300), (300, 10), (300, 30), (300, 100), (300, 300). One-layer control: **M = 100** (tied: 100, 300).
`tuned_on_test` false. Everything below is computed (aei.score_coverage, 26 target windows, 24 target months, bootstrap seed 2026).

## Metrics against both baseline rows

| metric | two-layer (100, 30) | one-layer control (M 100) | hospital-365 | shipped |
|---|---|---|---|---|
| C1 Brier all | 0.1415 (0.1399 to 0.1432) | 0.1415 (0.1399 to 0.1432) | 0.1414 (0.1398 to 0.1431) | 0.1417 (0.1401 to 0.1435) |
| C1 Brier small | 0.1607 (0.1577 to 0.1637) | 0.1607 (0.1577 to 0.1638) | 0.1605 (0.1576 to 0.1635) | 0.1614 (0.1582 to 0.1646) |
| C1 Brier all_counted | 0.1454 (0.1439 to 0.1470) | 0.1454 (0.1439 to 0.1470) | 0.1453 (0.1437 to 0.1469) | 0.1456 (0.1440 to 0.1472) |
| C1 Brier small_counted | 0.1418 (0.1394 to 0.1445) | 0.1419 (0.1393 to 0.1445) | 0.1417 (0.1393 to 0.1443) | 0.1424 (0.1399 to 0.1452) |
| C1 difference to hospital-365, all | 0.0001 (-0.0000 to 0.0002) | 0.0001 (-0.0000 to 0.0002) | 0.0000 (0.0000 to 0.0000) | 0.0003 (0.0001 to 0.0005) |
| C1 difference to hospital-365, small | 0.0002 (-0.0001 to 0.0004) | 0.0002 (-0.0001 to 0.0004) | 0.0000 (0.0000 to 0.0000) | 0.0008 (0.0004 to 0.0013) |
| C1 difference to hospital-365, all_counted | 0.0001 (0.0000 to 0.0002) | 0.0001 (0.0000 to 0.0002) | 0.0000 (0.0000 to 0.0000) | 0.0003 (0.0002 to 0.0005) |
| C1 difference to hospital-365, small_counted | 0.0001 (-0.0001 to 0.0003) | 0.0001 (-0.0000 to 0.0003) | 0.0000 (0.0000 to 0.0000) | 0.0007 (0.0003 to 0.0011) |
| C2 log loss all | 0.4437 (0.4396 to 0.4479) | 0.4437 (0.4396 to 0.4479) | 0.4433 (0.4393 to 0.4476) | 0.4445 (0.4403 to 0.4488) |
| C2 log loss small | 0.4898 (0.4822 to 0.4978) | 0.4899 (0.4823 to 0.4978) | 0.4894 (0.4819 to 0.4970) | 0.4925 (0.4843 to 0.5013) |
| C2 log loss all_counted | 0.4530 (0.4492 to 0.4569) | 0.4530 (0.4491 to 0.4569) | 0.4526 (0.4488 to 0.4563) | 0.4538 (0.4498 to 0.4578) |
| C2 difference, all | 0.0004 (0.0000 to 0.0007) | 0.0004 (0.0001 to 0.0007) | 0.0000 (0.0000 to 0.0000) | 0.0011 (0.0006 to 0.0017) |
| C3(a) slope | 1.037 (1.022 to 1.052) | 1.035 (1.021 to 1.050) | 1.038 (1.025 to 1.053) | 1.026 (1.012 to 1.041) |
| C3(a) intercept | 0.026 (0.008 to 0.042) | 0.024 (0.006 to 0.039) | 0.023 (0.005 to 0.039) | 0.031 (0.014 to 0.047) |
| C3(b) mild_obs | 0.00 | 0.00 | 0.00 | 0.00 |
| C3(b) mild_exp | 0.22 | 0.21 | 0.13 | 0.31 |
| C3(b) severe_obs | 29.00 | 29.00 | 29.00 | 23.00 |
| C3(b) severe_exp | 27.83 | 26.25 | 26.16 | 19.59 |
| C3(b) pass | True | True | True | True |
| C4 mild_spectrum | 0.9661 (0.9626 to 0.9697) | 0.9661 (0.9626 to 0.9697) | 0.9661 (0.9626 to 0.9697) | 0.9656 (0.9621 to 0.9693) |
| C4 mild_all | 0.7542 (0.7471 to 0.7605) | 0.7542 (0.7471 to 0.7605) | 0.7542 (0.7471 to 0.7605) | 0.7543 (0.7471 to 0.7606) |
| C4 severe | 0.9536 (0.9504 to 0.9563) | 0.9533 (0.9499 to 0.9561) | 0.9532 (0.9499 to 0.9559) | 0.9545 (0.9514 to 0.9572) |
| C4 mild_spectrum_counted | 0.9661 (0.9626 to 0.9697) | 0.9661 (0.9626 to 0.9697) | 0.9661 (0.9626 to 0.9697) | 0.9656 (0.9621 to 0.9693) |
| C4 mild_all_counted | 0.7542 (0.7471 to 0.7605) | 0.7542 (0.7471 to 0.7605) | 0.7542 (0.7471 to 0.7605) | 0.7543 (0.7471 to 0.7606) |
| C4 severe_counted | 0.9381 (0.9353 to 0.9408) | 0.9383 (0.9351 to 0.9412) | 0.9383 (0.9353 to 0.9412) | 0.9386 (0.9356 to 0.9412) |
| C6 E1_CRO (days) | 48 | 49 | not reached | 47 |
| C6 E1_CXM (days) | 117 | not reached | not reached | not reached |
| C6 E2_CXM (days) | not reached | not reached | not reached | not reached |
| C7 a | 0.905 (0.884 to 0.926) | 0.907 (0.884 to 0.928) | 0.899 (0.875 to 0.923) | 0.902 (0.877 to 0.925) |
| C7 b | 0.741 | 0.741 | 0.556 | 0.741 |
| C7 a_literal | 0.314 (0.291 to 0.339) | 0.321 (0.298 to 0.346) | 0.147 (0.130 to 0.165) | 0.343 (0.319 to 0.370) |
| C7 b_literal | 0.296 | 0.296 | 0.074 | 0.333 |
| C7 pass (a) | True | True | True | True |
| C8 C1 | 0.1653 (0.1528 to 0.1923) | 0.1655 (0.1527 to 0.1931) | 0.1669 (0.1538 to 0.1931) | 0.1656 (0.1531 to 0.1928) |
| C8 C1 difference | -0.0016 (-0.0035 to 0.0005) | -0.0014 (-0.0032 to 0.0005) | 0.0000 (0.0000 to 0.0000) | -0.0013 (-0.0040 to 0.0026) |
| C8 C4 mild_spectrum | 0.964 (0.909 to 0.983) | 0.964 (0.909 to 0.983) | 0.964 (0.909 to 0.983) | 0.964 (0.909 to 0.983) |
| C8 C4 severe | 0.920 (0.784 to 0.980) | 0.903 (0.723 to 0.980) | 0.906 (0.743 to 0.981) | 0.915 (0.756 to 0.973) |

n: C1 all 163666, small 36588, all_counted 182367; C4 mild_spectrum 9851, severe 15475; C7 blocks (a) 1993, (b) 27; C8 C1 2692; fallback (cells scored with the baseline's p) 0.

**Two-layer minus one-layer control, C1, paired over the 26 windows (95 % bootstrap): the value of separating the organism layer**

| subset | difference | 95 % interval |
|---|---|---|
| all | +0.00000 | -0.00001 to +0.00002 |
| small | -0.00000 | -0.00005 to +0.00005 |
| all_counted | -0.00000 | -0.00002 to +0.00001 |
| small_counted | -0.00001 | -0.00005 to +0.00003 |

## Replacement rule, line by line

**Two-layer, chosen setting**

| rule | value | passes |
|---|---|---|
| C1 (all, left_out) not worse than the shipped row by more than 0.002 | 0.1415 against shipped 0.1417: -0.0002; against hospital-365 0.0001 (-0.0000 to 0.0002); small cells 0.0002 (-0.0001 to 0.0004) | yes |
| C4 not worse than the shipped row, all six figures (point estimate not below) | mild_spectrum 0.9661 vs 0.9656 (+0.0005); mild_all 0.7542 vs 0.7543 (-0.0001); severe 0.9536 vs 0.9545 (-0.0009); mild_spectrum_counted 0.9661 vs 0.9656 (+0.0005); mild_all_counted 0.7542 vs 0.7543 (-0.0001); severe_counted 0.9381 vs 0.9386 (-0.0004); below: mild_all, severe, mild_all_counted, severe_counted | no |
| C8 better than the shipped row (lower C1 on the outbreak unit-months) | 0.1653 (0.1528 to 0.1923) against shipped 0.1656; C4 parts: mild_spectrum 0.964 vs 0.964, severe 0.920 vs 0.915 | yes |
| C3(b) passes (both ratios at most 1.5) | mild 0 of 0.22 expected, severe 29 of 27.83 | yes |
| C7(a) passes (0.85 to 0.95) | 0.905 (0.884 to 0.926) | yes |

Replaces the shipped estimate under this reading: **no**. C6 is reported in the metrics table.

**One-layer control**

| rule | value | passes |
|---|---|---|
| C1 (all, left_out) not worse than the shipped row by more than 0.002 | 0.1415 against shipped 0.1417: -0.0002; against hospital-365 0.0001 (-0.0000 to 0.0002); small cells 0.0002 (-0.0001 to 0.0004) | yes |
| C4 not worse than the shipped row, all six figures (point estimate not below) | mild_spectrum 0.9661 vs 0.9656 (+0.0005); mild_all 0.7542 vs 0.7543 (-0.0001); severe 0.9533 vs 0.9545 (-0.0011); mild_spectrum_counted 0.9661 vs 0.9656 (+0.0005); mild_all_counted 0.7542 vs 0.7543 (-0.0001); severe_counted 0.9383 vs 0.9386 (-0.0003); below: mild_all, severe, mild_all_counted, severe_counted | no |
| C8 better than the shipped row (lower C1 on the outbreak unit-months) | 0.1655 (0.1527 to 0.1931) against shipped 0.1656; C4 parts: mild_spectrum 0.964 vs 0.964, severe 0.903 vs 0.915 | yes |
| C3(b) passes (both ratios at most 1.5) | mild 0 of 0.21 expected, severe 29 of 26.25 | yes |
| C7(a) passes (0.85 to 0.95) | 0.907 (0.884 to 0.928) | yes |

Replaces the shipped estimate under this reading: **no**. C6 is reported in the metrics table.

## TUNE Brier per setting (selection only, not C1)

| M_pi \ M | 10 | 30 | 100 | 300 |
|---|---|---|---|---|
| 10 | 0.13719 | 0.13718 | 0.13719 | 0.13721 |
| 30 | 0.13709 | 0.13708 | 0.13709 | 0.13711 |
| 100 | 0.13698 | 0.13698 * | 0.13699 | 0.13701 |
| 300 | 0.13692 | 0.13692 | 0.13694 | 0.13696 |

One-layer control: M 10: 0.13719, M 30: 0.13705, M 100: 0.13692 *, M 300: 0.13686.

## Exploratory grid on the scoring period

Every setting scored on the scoring period. A row picked from this table was picked on the scoring period and must carry `tuned-on-test` if promoted. C1 differences are to hospital-365 with 95 % bootstrap intervals; * marks the setting chosen on TUNE.

| setting (M_pi, M) | TUNE Brier | C1 diff all | C1 diff small | C1 diff all_counted | C4 mild_spectrum | C4 mild_all | C4 severe | C7 a | C8 C1 | C6 E1_CRO |
|---|---|---|---|---|---|---|---|---|---|---|
| (10, 10) | 0.13719 | 0.00024 (0.00009 to 0.00039) | 0.00062 | 0.00025 | 0.966 | 0.754 | 0.954 | 0.905 | 0.1654 | 48 |
| (10, 30) | 0.13718 | 0.00023 (0.00009 to 0.00037) | 0.00060 | 0.00024 | 0.966 | 0.754 | 0.954 | 0.904 | 0.1655 | 51 |
| (10, 100) | 0.13719 | 0.00024 (0.00011 to 0.00037) | 0.00064 | 0.00025 | 0.966 | 0.754 | 0.954 | 0.905 | 0.1658 | not reached |
| (10, 300) | 0.13721 | 0.00027 (0.00015 to 0.00039) | 0.00070 | 0.00027 | 0.966 | 0.754 | 0.953 | 0.900 | 0.1663 | not reached |
| (30, 10) | 0.13709 | 0.00018 (0.00005 to 0.00032) | 0.00040 | 0.00020 | 0.966 | 0.754 | 0.954 | 0.906 | 0.1653 | 48 |
| (30, 30) | 0.13708 | 0.00017 (0.00005 to 0.00030) | 0.00038 | 0.00019 | 0.966 | 0.754 | 0.954 | 0.905 | 0.1654 | 49 |
| (30, 100) | 0.13709 | 0.00018 (0.00006 to 0.00030) | 0.00042 | 0.00020 | 0.966 | 0.754 | 0.954 | 0.906 | 0.1657 | not reached |
| (30, 300) | 0.13711 | 0.00021 (0.00011 to 0.00032) | 0.00048 | 0.00022 | 0.966 | 0.754 | 0.953 | 0.900 | 0.1662 | not reached |
| (100, 10) | 0.13698 | 0.00011 (-0.00000 to 0.00023) | 0.00018 | 0.00013 | 0.966 | 0.754 | 0.954 | 0.904 | 0.1652 | 44 |
| (100, 30) * | 0.13698 | 0.00010 (-0.00001 to 0.00021) | 0.00015 | 0.00012 | 0.966 | 0.754 | 0.954 | 0.905 | 0.1653 | 48 |
| (100, 100) | 0.13699 | 0.00011 (0.00001 to 0.00020) | 0.00019 | 0.00012 | 0.966 | 0.754 | 0.953 | 0.904 | 0.1656 | not reached |
| (100, 300) | 0.13701 | 0.00014 (0.00006 to 0.00022) | 0.00024 | 0.00015 | 0.966 | 0.754 | 0.953 | 0.902 | 0.1661 | not reached |
| (300, 10) | 0.13692 | 0.00005 (-0.00004 to 0.00015) | 0.00007 | 0.00007 | 0.966 | 0.754 | 0.954 | 0.905 | 0.1652 | 36 |
| (300, 30) | 0.13692 | 0.00004 (-0.00005 to 0.00012) | 0.00004 | 0.00006 | 0.966 | 0.754 | 0.954 | 0.905 | 0.1653 | 44 |
| (300, 100) | 0.13694 | 0.00004 (-0.00003 to 0.00012) | 0.00007 | 0.00006 | 0.966 | 0.754 | 0.953 | 0.904 | 0.1656 | 49 |
| (300, 300) | 0.13696 | 0.00007 (0.00002 to 0.00013) | 0.00012 | 0.00008 | 0.966 | 0.754 | 0.953 | 0.905 | 0.1661 | not reached |
| one-layer M 10 | 0.13719 | 0.00026 (0.00011 to 0.00042) | 0.00071 | 0.00028 | 0.966 | 0.754 | 0.954 | 0.902 | 0.1655 | 48 |
| one-layer M 30 | 0.13705 | 0.00019 (0.00006 to 0.00033) | 0.00042 | 0.00021 | 0.966 | 0.754 | 0.954 | 0.903 | 0.1654 | 48 |
| one-layer M 100 * | 0.13692 | 0.00010 (-0.00001 to 0.00020) | 0.00015 | 0.00012 | 0.966 | 0.754 | 0.953 | 0.907 | 0.1655 | 49 |
| one-layer M 300 | 0.13686 | 0.00003 (-0.00004 to 0.00010) | 0.00006 | 0.00005 | 0.966 | 0.754 | 0.953 | 0.906 | 0.1658 | not reached |

## WISCA at episode level (experiment-local; not a harness metric; not comparable with the leaderboard's C1 or C4)

Targets: 14246 first-positive-culture episodes in the 26 windows, 1519 with two organisms (10.7 %), computed. WISCA and the mix use the chosen setting (100, 30); nothing is tuned on the episode target. Predictors: E0 hospital-365 isolate level, E1 two-layer isolate level, E2 WISCA, E3 hospital-365 episode level (reference).

**Brier on the episode target, `left_out`** (n = 143179 episode x antibiotic outcomes, 13964 on two-organism episodes, 129215 on one-organism)

| predictor | Brier, all | diff to E3, all | Brier, two-organism | diff to E3, two-organism | Brier, one-organism |
|---|---|---|---|---|---|
| E0 hospital-365, isolate level | 0.1442 (0.1425 to 0.1461) | 0.00026 (0.00016 to 0.00036) | 0.2106 (0.2050 to 0.2161) | 0.00281 (0.00231 to 0.00338) | 0.1370 (0.1351 to 0.1392) |
| E1 two-layer mix, isolate level | 0.1443 (0.1426 to 0.1462) | 0.00037 (0.00023 to 0.00052) | 0.2107 (0.2051 to 0.2162) | 0.00285 (0.00242 to 0.00331) | 0.1372 (0.1352 to 0.1393) |
| E2 WISCA, episode types | 0.1440 (0.1422 to 0.1460) | 0.00009 (-0.00005 to 0.00021) | 0.2080 (0.2023 to 0.2137) | 0.00023 (-0.00010 to 0.00053) | 0.1371 (0.1352 to 0.1392) |
| E3 hospital-365, episode level | 0.1440 (0.1422 to 0.1458) | reference | 0.2078 (0.2021 to 0.2134) | reference | 0.1371 (0.1351 to 0.1392) |

**Brier on the episode target, `counted`** (n = 160794 episode x antibiotic outcomes, 16911 on two-organism episodes, 143883 on one-organism)

| predictor | Brier, all | diff to E3, all | Brier, two-organism | diff to E3, two-organism | Brier, one-organism |
|---|---|---|---|---|---|
| E0 hospital-365, isolate level | 0.1471 (0.1455 to 0.1488) | 0.00035 (0.00027 to 0.00045) | 0.2034 (0.1981 to 0.2089) | 0.00321 (0.00276 to 0.00372) | 0.1405 (0.1387 to 0.1425) |
| E1 two-layer mix, isolate level | 0.1473 (0.1456 to 0.1490) | 0.00049 (0.00035 to 0.00065) | 0.2036 (0.1983 to 0.2089) | 0.00337 (0.00293 to 0.00384) | 0.1407 (0.1388 to 0.1426) |
| E2 WISCA, episode types | 0.1469 (0.1452 to 0.1486) | 0.00012 (-0.00003 to 0.00026) | 0.2006 (0.1952 to 0.2061) | 0.00037 (0.00010 to 0.00061) | 0.1406 (0.1387 to 0.1426) |
| E3 hospital-365, episode level | 0.1468 (0.1451 to 0.1485) | reference | 0.2002 (0.1948 to 0.2057) | reference | 0.1405 (0.1386 to 0.1425) |

WISCA minus two-layer isolate level (E2 − E1), `left_out`: all -0.00029 (-0.00040 to -0.00018); two-organism episodes -0.00262 (-0.00320 to -0.00213). `counted`: all -0.00037 (-0.00049 to -0.00027).

**C4-style: realised coverage of the shipped list's first severe-basis pick that clears (threshold 0.90), pooled over the query-months where it clears; isolate level (what C4 reports) against episode level**

| predictor | query-months clearing | first picks | isolate level, left_out | episode level, left_out | isolate level, counted | episode level, counted |
|---|---|---|---|---|---|---|
| E0 hospital-365, isolate level | 500 | TZP 500 | 0.9532 (0.9499 to 0.9559) | 0.9483 (0.9445 to 0.9516) | 0.9383 (0.9353 to 0.9412) | 0.9320 (0.9282 to 0.9353) |
| E1 two-layer mix, isolate level | 431 | TZP 427, CIP 4 | 0.9536 (0.9504 to 0.9563) | 0.9488 (0.9451 to 0.9521) | 0.9381 (0.9353 to 0.9408) | 0.9318 (0.9281 to 0.9348) |
| E2 WISCA, episode types | 384 | TZP 380, CIP 4 | 0.9537 (0.9504 to 0.9564) | 0.9487 (0.9448 to 0.9519) | 0.9381 (0.9349 to 0.9409) | 0.9316 (0.9277 to 0.9349) |
| E3 hospital-365, episode level | 488 | TZP 488 | 0.9532 (0.9500 to 0.9559) | 0.9484 (0.9446 to 0.9517) | 0.9383 (0.9354 to 0.9411) | 0.9320 (0.9282 to 0.9352) |

Severe basis only; the mild basis is organism-level (D-027) and has no episode counterpart here. Bootstrap over the 24 target months.

**Descriptive: per antibiotic, realised covered share over the 26 windows, first isolates against first-positive-culture episodes (`left_out`)**

| antibiotic | isolate share | isolates | episode share | episodes | episode − isolate |
|---|---|---|---|---|---|
| AMP | 0.5253 | 13995 | 0.5062 | 12116 | -0.0191 |
| MEC | 0.7741 | 12312 | 0.7595 | 10860 | -0.0146 |
| TZP | 0.9532 | 15908 | 0.9486 | 14001 | -0.0046 |
| CXM | 0.7486 | 15908 | 0.7289 | 14001 | -0.0197 |
| CRO | 0.7894 | 15908 | 0.7723 | 14001 | -0.0170 |
| CAZ | 0.2087 | 4989 | 0.1895 | 3931 | -0.0191 |
| MEM | 0.8882 | 15908 | 0.8779 | 14001 | -0.0104 |
| CIP | 0.9163 | 12298 | 0.9112 | 10546 | -0.0051 |
| TMP | 0.7072 | 12312 | 0.6873 | 10860 | -0.0199 |
| NIT | 0.8386 | 12312 | 0.8272 | 10860 | -0.0114 |
| VAN | 0.2267 | 15908 | 0.2011 | 14001 | -0.0257 |
| CLI | 0.1194 | 15908 | 0.1053 | 14001 | -0.0140 |

**Descriptive: two-organism episodes, realised covered share against the product of the two organisms' realised shares among one-organism episodes of the same specimen (`left_out`; needs 10 such episodes per organism and drug).** Pooled over episode x antibiotic outcomes: observed 0.4596, independence product 0.4606, n = 13963.

| antibiotic | observed | independence product | n |
|---|---|---|---|
| AMP | 0.2257 | 0.2183 | 1050 |
| MEC | 0.4750 | 0.4721 | 1080 |
| TZP | 0.9114 | 0.9014 | 1456 |
| CXM | 0.4760 | 0.4695 | 1456 |
| CRO | 0.5316 | 0.5275 | 1456 |
| CAZ | 0.0000 | 0.0000 | 178 |
| MEM | 0.7479 | 0.7414 | 1456 |
| CIP | 0.8182 | 0.8450 | 759 |
| TMP | 0.4333 | 0.4572 | 1080 |
| NIT | 0.5889 | 0.6052 | 1080 |
| VAN | 0.0412 | 0.0411 | 1456 |
| CLI | 0.0000 | 0.0000 | 1456 |

## Checks

1. Closed-form variance of ENGINE.md 2.4 against 200,000-draw Monte Carlo on 20 cells at 2026-09-27: maximum relative error 0.0064, median 0.0031 (pass if under 0.01: **pass**); maximum error of the mean 0.00030; largest gap between the matched-Beta 5 % and 95 % quantiles and the Monte Carlo quantiles 0.0006 (reported, not a pass condition).
2. WISCA variance against Monte Carlo on 20 cells with two-organism types: maximum relative error 0.0094, median 0.0021; with one-organism types only it reduces to the formula of 2.4 (maximum absolute difference 4.5e-16): **pass**.
3. M_pi = M = 0 reproduces 0004's unit 365-day raw estimator on 2106 cells (three as-of dates, three conventions): maximum absolute difference 2.2e-16: **pass**.
4. Whole hospital as parent, M_pi = M = 1e12, no smoothing, reproduces hospital-365's p on 2430 cells: maximum absolute difference 2.1e-11: **pass**.
5. Every as-of view built 289 times asserted that the latest row read is dated before `view.start` (episodes likewise): **pass** (no assertion fired).
6. The C4-style loop for E0 reproduces the baseline row's isolate-level severe figures: left_out 0.953183 against 0.953183, counted 0.938322 against 0.938322: **pass**.

## The figure

`out/figure.png`: ICU blood TZP as of 2026-09-27, chosen setting. Coverage 90.6 % (90 % interval 86.8 to 93.9), hospital-365 share 93.4 %. Columns (organism, expected share %, expected susceptibility %, n unit / hospital): E. coli 33.4 %, 94.0 %, 15/94; S. aureus 30.9 %, 86.7 %, 12/90; E. faecalis 10.4 %, 98.1 %, 6/27; K. pneumoniae 9.4 %, 91.3 %, 3/28; P. aeruginosa 5.4 %, 85.8 %, 1/17; C. freundii 3.5 %, 73.1 %, 0/12; K. oxytoca 3.5 %, 88.5 %, 0/12; P. mirabilis 3.4 %, 95.2 %, 1/10. No organism is under 3 %, so no column is merged.

Run time 45.2 s.
