# 0010 results

## All query-months

### 1. Top pick: claimed against realised next-month coverage

Basis: within spectrum for mild, all organisms for severe. Realised = covered / known over the unit's first isolates of the following month, pooled.

| severity | top pick's standing | query-months | mean predicted | realised | isolates | realised, all organisms | monthly realised min / median / max |
|---|---|---|---|---|---|---|---|
| mild | clears | 218 | 95.8 % | 96.6 % | 9866 | 77.4 % | 95.2 / 96.2 / 98.1 |
| mild | borderline | 20 | 85.4 % | 75.2 % | 125 | 75.2 % | 50.0 / 75.0 / 100.0 |
| mild | below | 291 | 70.7 % | 68.9 % | 3704 | 68.9 % | 62.8 / 68.3 / 76.7 |
| severe | clears | 327 | 95.6 % | 95.4 % | 14473 | 95.4 % | 93.6 / 95.6 / 96.8 |
| severe | borderline | 185 | 94.4 % | 93.4 % | 1342 | 93.4 % | 83.0 / 94.3 / 97.9 |
| severe | below | 17 | 87.6 % | 96.7 % | 60 | 96.7 % | 85.7 / 100.0 / 100.0 |

Top picks that clear, by specimen:

| severity | specimen | query-months | picks | mean predicted | realised | isolates |
|---|---|---|---|---|---|---|
| mild | urine | 216 | MEC 214, NIT 2 | 95.9 % | 96.6 % | 9852 |
| mild | blood | 2 | CXM 2 | 87.6 % | 64.3 % | 14 |
| severe | urine | 168 | TZP 163, CIP 5 | 95.2 % | 95.6 % | 11560 |
| severe | blood | 44 | TZP 44 | 96.9 % | 95.1 % | 163 |
| severe | wound | 115 | TZP 115 | 95.7 % | 94.8 % | 2750 |

### 2. Calibration

Query-months with at least 10 target isolates with a result. Expected = sum over them of P(realised below the bar) under Binomial(isolates, predicted share).

| check | query-months | observed below | expected below | observed / expected |
|---|---|---|---|---|
| mild: top pick clears, realised below 80 % | 175 | 0 | 0.3 | 0.00 |
| severe: top pick clears, realised below 90 % | 269 | 23 | 19.6 | 1.17 |
| every antibiotic with an interval: realised below its Wilson lower bound | 4285 | 959 | 1079.0 | 0.89 |

### 3. Against the hospital antibiogram (baseline)

Same query-months. Difference in points with a 95 % interval from 1000 bootstrap resamples of target months (seed 2026). Realised shares leave out isolates the pick was not tested on; the 'untested as not covered' columns divide by every target isolate instead (added after the run, see Deviations).

| severity | query-months | shipped realised | baseline realised | shipped − baseline | shipped, all organisms | baseline, all organisms | shipped, untested as not covered | baseline, untested as not covered | shipped Access | baseline Access | same pick |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mild | 529 | 88.9 % | 91.6 % | -2.7 (-3.6 to -1.9) | 75.4 % | 91.6 % | 75.4 % | 69.7 % | 41 % | 0 % | 0 % |
| severe | 529 | 95.3 % | 95.3 % | -0.1 (-0.1 to -0.0) | 95.3 % | 95.3 % | 93.7 % | 93.9 % | 0 % | 0 % | 94 % |

Pick against baseline pick:

| severity | shipped top pick | baseline pick | query-months |
|---|---|---|---|
| mild | CXM | CIP | 313 |
| mild | MEC | CIP | 214 |
| mild | NIT | CIP | 2 |
| severe | CIP | TZP | 16 |
| severe | MEM | TZP | 14 |
| severe | TZP | TZP | 499 |

### Levels used (per unit, specimen and month)

| specimen | unit | ward type |
|---|---|---|
| blood | 96 | 49 |
| urine | 216 | 0 |
| wound | 168 | 0 |

529 unit × specimen × month queries with target isolates.

| severity | no antibiotic clears |
|---|---|
| mild | 58.8 % |
| severe | 38.2 % |

### Combinations (severe, first pair when no single antibiotic clears)

| standing | query-months | pairs | mean predicted | realised | isolates |
|---|---|---|---|---|---|
| borderline | 22 | AMP+CIP 9, MEM+VAN 7, TZP+CIP 6 | 98.5 % | 98.8 % | 84 |
| clears | 169 | MEM+VAN 144, TZP+CIP 20, TZP+CLI 3, CRO+CIP 2 | 99.6 % | 99.3 % | 1216 |

## Without the planted outbreak months (URO 2025-06/07, ICU 2026-02/03)

### 1. Top pick: claimed against realised next-month coverage

Basis: within spectrum for mild, all organisms for severe. Realised = covered / known over the unit's first isolates of the following month, pooled.

| severity | top pick's standing | query-months | mean predicted | realised | isolates | realised, all organisms | monthly realised min / median / max |
|---|---|---|---|---|---|---|---|
| mild | clears | 214 | 95.8 % | 96.6 % | 9747 | 77.4 % | 95.2 / 96.2 / 98.5 |
| mild | borderline | 20 | 85.4 % | 75.2 % | 125 | 75.2 % | 50.0 / 75.0 / 100.0 |
| mild | below | 287 | 70.7 % | 69.0 % | 3661 | 69.0 % | 62.8 / 68.2 / 76.7 |
| severe | clears | 323 | 95.6 % | 95.5 % | 14306 | 95.5 % | 93.6 / 95.7 / 96.8 |
| severe | borderline | 181 | 94.3 % | 93.7 % | 1325 | 93.7 % | 86.8 / 94.3 / 97.9 |
| severe | below | 17 | 87.6 % | 96.7 % | 60 | 96.7 % | 85.7 / 100.0 / 100.0 |

Top picks that clear, by specimen:

| severity | specimen | query-months | picks | mean predicted | realised | isolates |
|---|---|---|---|---|---|---|
| mild | urine | 212 | MEC 210, NIT 2 | 95.9 % | 96.6 % | 9733 |
| mild | blood | 2 | CXM 2 | 87.6 % | 64.3 % | 14 |
| severe | urine | 166 | TZP 161, CIP 5 | 95.2 % | 95.6 % | 11426 |
| severe | blood | 44 | TZP 44 | 96.9 % | 95.1 % | 163 |
| severe | wound | 113 | TZP 113 | 95.7 % | 95.0 % | 2717 |

### 2. Calibration

Query-months with at least 10 target isolates with a result. Expected = sum over them of P(realised below the bar) under Binomial(isolates, predicted share).

| check | query-months | observed below | expected below | observed / expected |
|---|---|---|---|---|
| mild: top pick clears, realised below 80 % | 173 | 0 | 0.3 | 0.00 |
| severe: top pick clears, realised below 90 % | 265 | 22 | 19.2 | 1.14 |
| every antibiotic with an interval: realised below its Wilson lower bound | 4227 | 924 | 1065.9 | 0.87 |

### 3. Against the hospital antibiogram (baseline)

Same query-months. Difference in points with a 95 % interval from 1000 bootstrap resamples of target months (seed 2026). Realised shares leave out isolates the pick was not tested on; the 'untested as not covered' columns divide by every target isolate instead (added after the run, see Deviations).

| severity | query-months | shipped realised | baseline realised | shipped − baseline | shipped, all organisms | baseline, all organisms | shipped, untested as not covered | baseline, untested as not covered | shipped Access | baseline Access | same pick |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mild | 521 | 88.9 % | 91.8 % | -2.9 (-3.6 to -2.2) | 75.5 % | 91.8 % | 75.5 % | 69.9 % | 41 % | 0 % | 0 % |
| severe | 521 | 95.3 % | 95.4 % | -0.1 (-0.1 to -0.0) | 95.3 % | 95.4 % | 93.8 % | 93.9 % | 0 % | 0 % | 95 % |

Pick against baseline pick:

| severity | shipped top pick | baseline pick | query-months |
|---|---|---|---|
| mild | CXM | CIP | 309 |
| mild | MEC | CIP | 210 |
| mild | NIT | CIP | 2 |
| severe | CIP | TZP | 14 |
| severe | MEM | TZP | 14 |
| severe | TZP | TZP | 493 |

### Levels used (per unit, specimen and month)

| specimen | unit | ward type |
|---|---|---|
| blood | 94 | 49 |
| urine | 212 | 0 |
| wound | 166 | 0 |

521 unit × specimen × month queries with target isolates.

| severity | no antibiotic clears |
|---|---|
| mild | 58.9 % |
| severe | 38.0 % |

### Combinations (severe, first pair when no single antibiotic clears)

| standing | query-months | pairs | mean predicted | realised | isolates |
|---|---|---|---|---|---|
| borderline | 22 | AMP+CIP 9, MEM+VAN 7, TZP+CIP 6 | 98.5 % | 98.8 % | 84 |
| clears | 167 | MEM+VAN 142, TZP+CIP 20, TZP+CLI 3, CRO+CIP 2 | 99.6 % | 99.3 % | 1206 |
