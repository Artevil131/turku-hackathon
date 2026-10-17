# 0021 results

Command: `uv run python experiments/0021-naming-step/run.py`. Seed 2026, 200 trials per cell, screening only. Every number computed by this run unless it says committed (baselines/, 0015).

## Feeds and operating levels

| feed | signals (loosest level) | operating level | stress level |
|---|---|---|---|
| live set as shipped | 356 | 1.0 | 10.0 |
| Gamma-Poisson (0015) | 2148 | 0.005 | 0.05 |

## Naming rule against the harness's table, every signal

**live set as shipped**, full run, signals at the loosest level (table kind -> rule kind: count): `{"cluster -> cluster": 319, "data -> data": 23, "sentinel -> sentinel": 8, "trend -> trend": 6}`  
Over every signal of every injected trial: `{"cluster -> cluster": 13627, "data -> data": 4325, "sentinel -> sentinel": 131}`

**Gamma-Poisson (0015)**, full run, signals at the loosest level (table kind -> rule kind: count): `{"cluster -> cluster": 2148}`  
Over every signal of every injected trial: `{"cluster -> cluster": 29934}`

Cells with different kinds on both sides are disagreements, and `-> unnamed` cells are signals no rule names.

## D7, the harness's definition, read with the rule's names

| feed | D7 by rule | right of detected | Wilson 95 % | committed D7 (table) |
|---|---|---|---|---|
| live set as shipped | 97.38 % | 1930 of 1982 | 96.6 % to 98.0 % | 97.38 % (n 1982) |
| Gamma-Poisson (0015) | 99.84 % | 616 of 617 | 99.1 % to 100.0 % | 99.84 % (n 617) |

D7 first, D7 over all events, and by family (E1 to E4 are in the next table). 'detected' is as the harness counts it; 'right' is some matching signal with the event's kind; 'first right' is the earliest matching signal with it (gaps: the earliest signal of any kind for the unit is a data signal).

**live set as shipped**

| event family | events | detected | right | first right | first right of detected | right of all events |
|---|---|---|---|---|---|---|
| rare | 800 | 534 | 524 | 490 | 91.8 % | 65.5 % |
| common_resistant | 800 | 4 | 4 | 4 | 100.0 % | 0.5 % |
| wild_type | 800 | 0 | 0 | 0 | n/a | 0.0 % |
| common_esbl | 800 | 389 | 389 | 389 | 100.0 % | 48.6 % |
| two_unit | 800 | 278 | 236 | 209 | 75.2 % | 29.5 % |
| gaps | 1000 | 773 | 773 | 773 | 100.0 % | 77.3 % |
| all events incl. E1 to E4 | 5004 | 1982 | 1930 | 1869 | 94.30 % | 38.57 % |

D7 first, all detected: 94.30 % (Wilson 93.2 % to 95.2 %); D7 over all events 38.57 % (a miss is not named right).

| planted | found | kinds seen | expected | right | first matching signal | first right |
|---|---|---|---|---|---|---|
| E1 | True | cluster | cluster | True | 2025-06-04 | True |
| E2 | True | cluster, sentinel | sentinel, cluster | True | 2026-03-03 | True |
| E3 | True | data | data | True | 2025-12-08 | True |
| E4 | True | trend | trend | True | 2026-05-10 | True |

**Gamma-Poisson (0015)**

| event family | events | detected | right | first right | first right of detected | right of all events |
|---|---|---|---|---|---|---|
| rare | 800 | 265 | 265 | 265 | 100.0 % | 33.1 % |
| common_resistant | 800 | 30 | 30 | 30 | 100.0 % | 3.8 % |
| wild_type | 800 | 25 | 25 | 25 | 100.0 % | 3.1 % |
| common_esbl | 800 | 181 | 181 | 181 | 100.0 % | 22.6 % |
| two_unit | 800 | 114 | 114 | 114 | 100.0 % | 14.2 % |
| gaps | 1000 | 0 | 0 | 0 | n/a | 0.0 % |
| all events incl. E1 to E4 | 5004 | 617 | 616 | 617 | 100.00 % | 12.31 % |

D7 first, all detected: 100.00 % (Wilson 99.4 % to 100.0 %); D7 over all events 12.31 % (a miss is not named right).

| planted | found | kinds seen | expected | right | first matching signal | first right |
|---|---|---|---|---|---|---|
| E1 | True | cluster | cluster | True | 2025-06-10 | True |
| E2 | True | cluster | sentinel, cluster | False | 2026-03-05 | True |
| E3 | False | - | data | False | - | None |
| E4 | False | - | trend | False | - | None |

## D6, injected gaps

| feed | D6 from the trials (any non-data signal) | D6 through score_detection blocks | committed D6 | D6 annotated (not preceded by a data signal within 14 d) |
|---|---|---|---|---|
| live set as shipped | 12 of 1000 = 1.2 % (0.7 % to 2.1 %) | 1.20 % | 1.20 % | 4 of 1000 = 0.4 % (0.2 % to 1.0 %) |
| Gamma-Poisson (0015) | 19 of 1000 = 1.9 % (1.2 % to 2.9 %) | 1.90 % | 1.90 % | 19 of 1000 = 1.9 % (1.2 % to 2.9 %) |

D3 (a data signal within 14 days of the start, per gap setting): live set as shipped: gap2 0.640, gap3 0.945, gap5 1.000, gap7 1.000, half7 0.280; Gamma-Poisson (0015): gap2 0.000, gap3 0.000, gap5 0.000, gap7 0.000, half7 0.000.

## I1 under the incident rules

Rules: R1 D-034: same unit and a shared organism or phenotype, 28 d; R2 as R1, 14 d; R3 as R1, 56 d; R4 same unit only, 28 d; R5 shared organism or phenotype in any unit, 28 d; R6 shared patient in any unit, 28 d; R7 R1 or R6, 28 d. Alerts over the scoring period; incidents with an exact Poisson 95 % interval; 'alerts with patients' is the number of alerts with at least one patient behind them; zones are E1 to E4 and the quarantined ones, 'zone incidents' the number of incidents their alerts fall into (one per zone is right); 'mixed' incidents hold a zone and outside alerts or two zones; 'multi-unit' over more than one unit; longest in days. The harness's I1 is the no-CPE rows at the operating level.

**live set as shipped, operating level, without CPE finds** (18 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 18 | 15 (8.4 to 24.7) | 1.20 | 11 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R2 | 18 | 15 (8.4 to 24.7) | 1.20 | 11 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R3 | 18 | 15 (8.4 to 24.7) | 1.20 | 11 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R4 | 18 | 14 (7.7 to 23.5) | 1.29 | 11 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 0 | 15 |
| R5 | 18 | 13 (6.9 to 22.2) | 1.38 | 11 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 1 | 40 |
| R6 | 18 | 15 (8.4 to 24.7) | 1.20 | 11 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R7 | 18 | 15 (8.4 to 24.7) | 1.20 | 11 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |

**Gamma-Poisson (0015), operating level, without CPE finds** (13 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 13 | 12 (6.2 to 21.0) | 1.08 | 13 | {'E1': 1, 'E2': 1} | 0 | 0 | 13 |
| R2 | 13 | 12 (6.2 to 21.0) | 1.08 | 13 | {'E1': 1, 'E2': 1} | 0 | 0 | 13 |
| R3 | 13 | 12 (6.2 to 21.0) | 1.08 | 13 | {'E1': 1, 'E2': 1} | 0 | 0 | 13 |
| R4 | 13 | 12 (6.2 to 21.0) | 1.08 | 13 | {'E1': 1, 'E2': 1} | 0 | 0 | 13 |
| R5 | 13 | 9 (4.1 to 17.1) | 1.44 | 13 | {'E1': 1, 'E2': 1} | 1 | 2 | 17 |
| R6 | 13 | 12 (6.2 to 21.0) | 1.08 | 13 | {'E1': 1, 'E2': 1} | 0 | 0 | 13 |
| R7 | 13 | 12 (6.2 to 21.0) | 1.08 | 13 | {'E1': 1, 'E2': 1} | 0 | 0 | 13 |

**live set and Gamma-Poisson together, operating level, without CPE finds** (31 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 31 | 25 (16.2 to 36.9) | 1.24 | 24 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 15 |
| R2 | 31 | 25 (16.2 to 36.9) | 1.24 | 24 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 15 |
| R3 | 31 | 25 (16.2 to 36.9) | 1.24 | 24 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 15 |
| R4 | 31 | 23 (14.6 to 34.5) | 1.35 | 24 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 0 | 20 |
| R5 | 31 | 18 (10.7 to 28.4) | 1.72 | 24 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 4 | 41 |
| R6 | 31 | 24 (15.4 to 35.7) | 1.29 | 24 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 1 | 15 |
| R7 | 31 | 24 (15.4 to 35.7) | 1.29 | 24 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 1 | 15 |

**live set as shipped, stress level, without CPE finds** (25 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 25 | 22 (13.8 to 33.3) | 1.14 | 18 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R2 | 25 | 22 (13.8 to 33.3) | 1.14 | 18 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R3 | 25 | 22 (13.8 to 33.3) | 1.14 | 18 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R4 | 25 | 21 (13.0 to 32.1) | 1.19 | 18 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 0 | 17 |
| R5 | 25 | 17 (9.9 to 27.2) | 1.47 | 18 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 2 | 59 |
| R6 | 25 | 22 (13.8 to 33.3) | 1.14 | 18 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R7 | 25 | 22 (13.8 to 33.3) | 1.14 | 18 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |

**Gamma-Poisson (0015), stress level, without CPE finds** (88 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 88 | 82 (65.2 to 101.8) | 1.07 | 88 | {'E1': 2, 'E2': 1} | 0 | 0 | 24 |
| R2 | 88 | 85 (67.9 to 105.1) | 1.04 | 88 | {'E1': 2, 'E2': 1} | 0 | 0 | 19 |
| R3 | 88 | 75 (59.0 to 94.0) | 1.17 | 88 | {'E1': 1, 'E2': 1} | 0 | 0 | 93 |
| R4 | 88 | 63 (48.4 to 80.6) | 1.40 | 88 | {'E1': 2, 'E2': 1} | 0 | 0 | 45 |
| R5 | 88 | 50 (37.1 to 65.9) | 1.76 | 88 | {'E1': 2, 'E2': 1} | 2 | 17 | 73 |
| R6 | 88 | 63 (48.4 to 80.6) | 1.40 | 88 | {'E1': 2, 'E2': 1} | 1 | 7 | 116 |
| R7 | 88 | 63 (48.4 to 80.6) | 1.40 | 88 | {'E1': 2, 'E2': 1} | 1 | 7 | 116 |

**live set and Gamma-Poisson together, stress level, without CPE finds** (113 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 113 | 98 (79.6 to 119.4) | 1.15 | 106 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 29 |
| R2 | 113 | 102 (83.2 to 123.8) | 1.11 | 106 | {'E1': 2, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 21 |
| R3 | 113 | 87 (69.7 to 107.3) | 1.30 | 106 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 93 |
| R4 | 113 | 68 (52.8 to 86.2) | 1.66 | 106 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 2 | 0 | 94 |
| R5 | 113 | 40 (28.6 to 54.5) | 2.83 | 106 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 3 | 16 | 186 |
| R6 | 113 | 78 (61.7 to 97.3) | 1.45 | 106 | {'E1': 3, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 2 | 7 | 120 |
| R7 | 113 | 77 (60.8 to 96.2) | 1.47 | 106 | {'E1': 3, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 2 | 7 | 140 |

**live set as shipped, operating level, with CPE finds** (27 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 27 | 24 (15.4 to 35.7) | 1.12 | 20 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R2 | 27 | 24 (15.4 to 35.7) | 1.12 | 20 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R3 | 27 | 24 (15.4 to 35.7) | 1.12 | 20 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R4 | 27 | 22 (13.8 to 33.3) | 1.23 | 20 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 0 | 15 |
| R5 | 27 | 18 (10.7 to 28.4) | 1.50 | 20 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 2 | 3 | 44 |
| R6 | 27 | 24 (15.4 to 35.7) | 1.12 | 20 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R7 | 27 | 24 (15.4 to 35.7) | 1.12 | 20 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |

**Gamma-Poisson (0015), operating level, with CPE finds** (22 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 22 | 21 (13.0 to 32.1) | 1.05 | 22 | {'E1': 1, 'E2': 1} | 0 | 0 | 13 |
| R2 | 22 | 21 (13.0 to 32.1) | 1.05 | 22 | {'E1': 1, 'E2': 1} | 0 | 0 | 13 |
| R3 | 22 | 20 (12.2 to 30.9) | 1.10 | 22 | {'E1': 1, 'E2': 1} | 0 | 0 | 51 |
| R4 | 22 | 20 (12.2 to 30.9) | 1.10 | 22 | {'E1': 1, 'E2': 1} | 0 | 0 | 22 |
| R5 | 22 | 17 (9.9 to 27.2) | 1.29 | 22 | {'E1': 1, 'E2': 1} | 1 | 3 | 30 |
| R6 | 22 | 21 (13.0 to 32.1) | 1.05 | 22 | {'E1': 1, 'E2': 1} | 0 | 0 | 13 |
| R7 | 22 | 21 (13.0 to 32.1) | 1.05 | 22 | {'E1': 1, 'E2': 1} | 0 | 0 | 13 |

**live set and Gamma-Poisson together, operating level, with CPE finds** (40 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 40 | 34 (23.5 to 47.5) | 1.18 | 33 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 15 |
| R2 | 40 | 34 (23.5 to 47.5) | 1.18 | 33 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 15 |
| R3 | 40 | 33 (22.7 to 46.3) | 1.21 | 33 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 51 |
| R4 | 40 | 30 (20.2 to 42.8) | 1.33 | 33 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 0 | 42 |
| R5 | 40 | 24 (15.4 to 35.7) | 1.67 | 33 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 2 | 5 | 44 |
| R6 | 40 | 33 (22.7 to 46.3) | 1.21 | 33 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 1 | 15 |
| R7 | 40 | 33 (22.7 to 46.3) | 1.21 | 33 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 1 | 15 |

**live set as shipped, stress level, with CPE finds** (34 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 34 | 31 (21.1 to 44.0) | 1.10 | 27 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R2 | 34 | 31 (21.1 to 44.0) | 1.10 | 27 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R3 | 34 | 31 (21.1 to 44.0) | 1.10 | 27 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R4 | 34 | 29 (19.4 to 41.6) | 1.17 | 27 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 1 | 0 | 17 |
| R5 | 34 | 22 (13.8 to 33.3) | 1.55 | 27 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 2 | 4 | 65 |
| R6 | 34 | 31 (21.1 to 44.0) | 1.10 | 27 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |
| R7 | 34 | 31 (21.1 to 44.0) | 1.10 | 27 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 6 |

**Gamma-Poisson (0015), stress level, with CPE finds** (97 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 97 | 88 (70.6 to 108.4) | 1.10 | 97 | {'E1': 2, 'E2': 1} | 0 | 0 | 24 |
| R2 | 97 | 91 (73.3 to 111.7) | 1.07 | 97 | {'E1': 2, 'E2': 1} | 0 | 0 | 19 |
| R3 | 97 | 81 (64.3 to 100.7) | 1.20 | 97 | {'E1': 1, 'E2': 1} | 0 | 0 | 93 |
| R4 | 97 | 64 (49.3 to 81.7) | 1.52 | 97 | {'E1': 2, 'E2': 1} | 0 | 0 | 45 |
| R5 | 97 | 42 (30.3 to 56.8) | 2.31 | 97 | {'E1': 1, 'E2': 1} | 2 | 15 | 173 |
| R6 | 97 | 70 (54.6 to 88.4) | 1.39 | 97 | {'E1': 2, 'E2': 1} | 1 | 7 | 116 |
| R7 | 97 | 69 (53.7 to 87.3) | 1.41 | 97 | {'E1': 2, 'E2': 1} | 1 | 7 | 116 |

**live set and Gamma-Poisson together, stress level, with CPE finds** (122 alerts)

| rule | alerts | incidents (95 %) | alerts per incident | alerts with patients | zone incidents | mixed | multi-unit | longest d |
|---|---|---|---|---|---|---|---|---|
| R1 | 122 | 104 (85.0 to 126.0) | 1.17 | 115 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 29 |
| R2 | 122 | 108 (88.6 to 130.4) | 1.13 | 115 | {'E1': 2, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 21 |
| R3 | 122 | 93 (75.1 to 113.9) | 1.31 | 115 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 0 | 0 | 93 |
| R4 | 122 | 68 (52.8 to 86.2) | 1.79 | 115 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 2 | 0 | 125 |
| R5 | 122 | 42 (30.3 to 56.8) | 2.90 | 115 | {'E1': 1, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 3 | 16 | 186 |
| R6 | 122 | 85 (67.9 to 105.1) | 1.44 | 115 | {'E1': 3, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 2 | 7 | 120 |
| R7 | 122 | 83 (66.1 to 102.9) | 1.47 | 115 | {'E1': 3, 'E2': 1, 'E3': 1, 'E4': 1, 'Q-MED-A-ecoli': 1, 'Q-MED-A-gap': 1} | 2 | 7 | 140 |

## Incidents per detected injected cluster trial

**live set as shipped**: mean incidents per trial (trials with exactly one), k 2 to 6 pooled; R6 and R7 need patients, not kept for injected rows.

| family | detected trials | mean alerts | R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|---|---|
| rare | 534 | 1.59 | 1.00 (534) | 1.01 (526) | 1.00 (534) | 1.00 (534) | 1.00 (534) |
| common_resistant | 4 | 1.00 | 1.00 (4) | 1.00 (4) | 1.00 (4) | 1.00 (4) | 1.00 (4) |
| wild_type | 0 | n/a | n/a | n/a | n/a | n/a | n/a |
| common_esbl | 389 | 1.51 | 1.00 (389) | 1.03 (379) | 1.00 (389) | 1.00 (389) | 1.00 (389) |
| two_unit | 278 | 1.72 | 1.41 (165) | 1.42 (164) | 1.41 (165) | 1.41 (165) | 1.00 (278) |

**Gamma-Poisson (0015)**: mean incidents per trial (trials with exactly one), k 2 to 6 pooled; R6 and R7 need patients, not kept for injected rows.

| family | detected trials | mean alerts | R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|---|---|
| rare | 265 | 1.24 | 1.00 (265) | 1.00 (265) | 1.00 (265) | 1.00 (265) | 1.00 (265) |
| common_resistant | 30 | 1.00 | 1.00 (30) | 1.00 (30) | 1.00 (30) | 1.00 (30) | 1.00 (30) |
| wild_type | 25 | 1.00 | 1.00 (25) | 1.00 (25) | 1.00 (25) | 1.00 (25) | 1.00 (25) |
| common_esbl | 181 | 1.10 | 1.00 (181) | 1.01 (179) | 1.00 (181) | 1.00 (181) | 1.00 (181) |
| two_unit | 114 | 1.26 | 1.12 (100) | 1.13 (99) | 1.12 (100) | 1.12 (100) | 1.00 (114) |

## Slot coverage of the sentences (alerts of the scoring period, with CPE finds for the live set)

**live set as shipped**: 26 of 27 alerts have every slot filled by a field or a setting. By kind: `{"cluster": {"alerts": 7, "incomplete": 0}, "data": {"alerts": 6, "incomplete": 0}, "sentinel": {"alerts": 13, "incomplete": 0}, "trend": {"alerts": 1, "incomplete": 1}}`. Missing slots: `{"trend:span": 1, "trend:start": 1}`.

**Gamma-Poisson (0015)**: 22 of 22 alerts have every slot filled by a field or a setting. By kind: `{"cluster": {"alerts": 13, "incomplete": 0}, "sentinel": {"alerts": 9, "incomplete": 0}}`. Missing slots: `{}`.

## Checks

R1 against the committed I1 rows (alerts, incidents): R1 live: alerts, incidents against committed: (18, 15) against (18, 15); R1 gp: alerts, incidents against committed: (13, 12) against (13, 12); R1 live with CPE finds against I1_full_tool: (27, 24) against (27, 24). R1 equals `group_incidents` partition on every feed table above (asserted).

Incident grouping causal (alerts grouped alone up to a cut date get their final incident; cuts ['2025-03-31', '2026-06-30'], rules R1 to R7, disagreements): `{"live/op/no cpe": 0, "gp/op/no cpe": 0, "live/stress/no cpe": 0, "gp/stress/no cpe": 0, "live/op/cpe": 0, "gp/op/cpe": 0, "live/stress/cpe": 0, "gp/stress/cpe": 0}`.

`check_causal` on the detectors (cuts ['2025-03-31', '2026-06-30']): live causal; Gamma-Poisson causal.

Picture rows printed (`out/figure.png`): `[{"date": "2026-03-03", "kind": "sentinel", "en": "First MRSA in Intensive care unit in 180 days", "fi": "Ensimm\u00e4inen MRSA yksik\u00f6ss\u00e4 Teho-osasto 180 p\u00e4iv\u00e4\u00e4n", "missing": []}, {"date": "2026-03-07", "kind": "cluster", "en": "MRSA in Intensive care unit: 3 isolates in 4 weeks, usual 0.1", "fi": "MRSA yksik\u00f6ss\u00e4 Teho-osasto: 3 eristett\u00e4 4 viikossa, tavallisesti 0,1", "missing": []}, {"date": "2026-03-09", "kind": "cluster", "en": "Staphylococcus aureus in Intensive care unit: 3 isolates in 4 weeks, usual 0.0", "fi": "Staphylococcus aureus yksik\u00f6ss\u00e4 Teho-osasto: 3 eristett\u00e4 4 viikossa, tavallisesti 0,0", "missing": []}, {"date": "2025-06-04", "kind": "cluster", "en": "Escherichia coli in Urology: 4 isolates in 4 weeks, usual 0.2", "fi": "Escherichia coli yksik\u00f6ss\u00e4 Urologia: 4 eristett\u00e4 4 viikossa, tavallisesti 0,2", "missing": []}, {"date": "2025-12-08", "kind": "data", "en": "Health centre South: no samples for 1 day", "fi": "Terveysasema Etel\u00e4: ei n\u00e4ytteit\u00e4 1 p\u00e4iv\u00e4\u00e4n", "missing": []}, {"date": "2026-05-10", "kind": "trend", "en": "Escherichia coli TMP resistance rising: \u2014 \u2192 23% over \u2014", "fi": "Escherichia coli TMP -resistenssi nousussa: \u2014 \u2192 23 % ajalla \u2014", "missing": ["start", "span"]}]`.

## Run time

- live set as shipped: full run and trials: Run time 50.3 s
- live set as shipped: added measures: Run time 0.0 s
- Gamma-Poisson (0015): full run and trials: Run time 11.7 s
- Gamma-Poisson (0015): added measures: Run time 0.0 s
- incident rules: Run time 0.0 s
- causality checks: Run time 0.7 s

Total: Run time 63.3 s CPU, Run time 63.5 s wall (budget 600 s CPU).
