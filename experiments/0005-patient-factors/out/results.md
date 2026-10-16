# 0005 results

Target windows: 26; predictions: 163666; model fits: 2340, not converged: 0. Lower is better; difference to the baseline with a 95 % interval from 1000 bootstrap resamples of target windows (seed 2026). All computed.

### Brier score

| model | mean | minus baseline | 95 % interval |
|---|---|---|---|
| baseline: hospital 365 d | 0.1412 | 0.0000 | – |
| logistic A all | 0.1413 | 0.0001 | 0.0000 to 0.0002 |
| logistic B earlier resistance | 0.1413 | 0.0001 | 0.0000 to 0.0001 |
| logistic C demographics and stay | 0.1412 | 0.0000 | -0.0001 to 0.0001 |

### Log loss

| model | mean | minus baseline | 95 % interval |
|---|---|---|---|
| baseline: hospital 365 d | 0.4427 | 0.0000 | – |
| logistic A all | 0.4431 | 0.0004 | -0.0000 to 0.0007 |
| logistic B earlier resistance | 0.4430 | 0.0003 | 0.0001 to 0.0005 |
| logistic C demographics and stay | 0.4428 | 0.0000 | -0.0003 to 0.0004 |

### Odds ratios for NOT being covered, model A, fitted on the last 364 days (penalised, so shrunk toward 1)

| specimen | antibiotic | covered (hospital) | male | age (per decade) | inpatient | day 3+ of stay | earlier isolate not covered | earlier ESBL/MRSA/VRE/CPE |
|---|---|---|---|---|---|---|---|---|
| urine | AMP | 54 % | 1.08 | 1.01 | 1.16 | 1.01 | 1.10 | 0.88 |
| urine | MEC | 77 % | 0.99 | 1.02 | 0.97 | 1.10 | 1.05 | 0.90 |
| urine | TZP | 96 % | 0.93 | 1.03 | 1.24 | 0.91 | 0.52 | 1.04 |
| urine | CXM | 77 % | 1.18 | 1.02 | 0.99 | 0.96 | 1.06 | 0.88 |
| urine | CRO | 81 % | 1.17 | 1.02 | 0.97 | 1.00 | 1.14 | 0.85 |
| urine | CAZ | 23 % | 0.85 | 0.94 | 1.35 | 0.89 | 1.16 | 1.25 |
| urine | MEM | 89 % | 0.91 | 1.00 | 0.87 | 1.12 | 0.91 | 0.98 |
| urine | CIP | 92 % | 1.93 | 1.00 | 1.22 | 0.99 | 0.89 | 0.99 |
| urine | TMP | 70 % | 1.02 | 1.00 | 1.13 | 1.14 | 1.01 | 1.05 |
| urine | NIT | 84 % | 1.11 | 1.01 | 0.99 | 1.08 | 1.19 | 0.83 |
| urine | VAN | 14 % | 1.12 | 0.99 | 1.15 | 0.85 | 0.97 | 1.02 |
| urine | CLI | 3 % | 1.26 | 0.93 | 1.30 | 0.80 | 1.11 | 1.00 |
| blood | AMP | 44 % | 0.63 | 1.00 | 1.33 | 0.98 | 1.32 | 0.72 |
| blood | TZP | 93 % | 0.99 | 0.91 | 1.32 | 1.61 | 2.34 | 1.11 |
| blood | CXM | 75 % | 0.68 | 0.97 | 0.78 | 1.27 | 0.52 | 1.64 |
| blood | CRO | 80 % | 0.81 | 0.95 | 0.82 | 1.34 | 0.65 | 1.79 |
| blood | CAZ | 11 % | 1.32 | 0.93 | 1.30 | 1.09 | 1.34 | 1.63 |
| blood | MEM | 89 % | 0.83 | 0.96 | 1.21 | 1.28 | 1.05 | 2.17 |
| blood | CIP | 92 % | 1.55 | 1.29 | 1.12 | 1.16 | 1.22 | 1.30 |
| blood | VAN | 40 % | 0.91 | 1.00 | 1.33 | 0.78 | 1.11 | 0.62 |
| blood | CLI | 27 % | 0.77 | 1.00 | 1.62 | 0.80 | 0.74 | 1.10 |
| wound | AMP | 42 % | 0.79 | 1.01 | 1.08 | 0.98 | 0.94 | 1.44 |
| wound | TZP | 94 % | 0.65 | 0.94 | 1.50 | 1.13 | 0.91 | 1.22 |
| wound | CXM | 68 % | 0.74 | 1.01 | 0.81 | 1.34 | 1.10 | 1.06 |
| wound | CRO | 70 % | 0.75 | 1.01 | 0.83 | 1.24 | 1.04 | 0.99 |
| wound | CAZ | 21 % | 1.17 | 0.97 | 1.18 | 1.01 | 1.16 | 0.65 |
| wound | MEM | 86 % | 0.72 | 1.00 | 0.88 | 1.42 | 1.27 | 0.82 |
| wound | CIP | 91 % | 1.19 | 0.97 | 1.79 | 0.89 | 1.10 | 1.02 |
| wound | VAN | 54 % | 0.94 | 1.01 | 1.05 | 0.87 | 0.98 | 1.16 |
| wound | CLI | 42 % | 0.87 | 1.00 | 1.02 | 0.99 | 0.99 | 1.02 |
