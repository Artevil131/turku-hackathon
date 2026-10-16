# 0004 results

Lower is better. Difference to the baseline (estimator 3) with a 95 % interval from 1,000 bootstrap resamples of target windows (seed 2026). All computed.

Target windows: 26; predictions (first isolate × antibiotic): 163666. Unit 28-day cell empty (raw estimator 1 fell back to the baseline): 0.2 %; unit 365-day cell empty: 0.0 %.

### All cells · Brier score (n = 163666)

| estimator | mean | minus baseline | 95 % interval |
|---|---|---|---|
| 1 unit 28 d raw | 0.1472 | 0.0058 | 0.0051 to 0.0065 |
| 2 unit 365 d raw | 0.1418 | 0.0004 | 0.0002 to 0.0005 |
| 3 hospital 365 d (baseline) | 0.1414 | 0.0000 | – |
| 4 hospital 28 d | 0.1419 | 0.0005 | 0.0003 to 0.0007 |
| 5 unit 365 d shrunk to hospital (M 20) | 0.1416 | 0.0002 | 0.0001 to 0.0004 |
| 6 unit 28 d shrunk to 5 (M 5) | 0.1440 | 0.0026 | 0.0021 to 0.0030 |
| 6 unit 28 d shrunk to 5 (M 20) | 0.1426 | 0.0011 | 0.0008 to 0.0015 |
| 6 unit 28 d shrunk to 5 (M 50) | 0.1419 | 0.0005 | 0.0003 to 0.0008 |

### All cells · log loss (n = 163666)

| estimator | mean | minus baseline | 95 % interval |
|---|---|---|---|
| 1 unit 28 d raw | 0.4870 | 0.0437 | 0.0387 to 0.0489 |
| 2 unit 365 d raw | 0.4448 | 0.0015 | 0.0009 to 0.0020 |
| 3 hospital 365 d (baseline) | 0.4433 | 0.0000 | – |
| 4 hospital 28 d | 0.4460 | 0.0027 | 0.0018 to 0.0038 |
| 5 unit 365 d shrunk to hospital (M 20) | 0.4441 | 0.0008 | 0.0004 to 0.0013 |
| 6 unit 28 d shrunk to 5 (M 5) | 0.4533 | 0.0100 | 0.0085 to 0.0115 |
| 6 unit 28 d shrunk to 5 (M 20) | 0.4477 | 0.0044 | 0.0033 to 0.0054 |
| 6 unit 28 d shrunk to 5 (M 50) | 0.4454 | 0.0020 | 0.0012 to 0.0028 |

### Cells with under 30 first isolates in the unit's last 28 days · Brier score (n = 36588)

| estimator | mean | minus baseline | 95 % interval |
|---|---|---|---|
| 1 unit 28 d raw | 0.1811 | 0.0206 | 0.0177 to 0.0234 |
| 2 unit 365 d raw | 0.1617 | 0.0011 | 0.0006 to 0.0016 |
| 3 hospital 365 d (baseline) | 0.1605 | 0.0000 | – |
| 4 hospital 28 d | 0.1626 | 0.0020 | 0.0015 to 0.0026 |
| 5 unit 365 d shrunk to hospital (M 20) | 0.1611 | 0.0006 | 0.0002 to 0.0009 |
| 6 unit 28 d shrunk to 5 (M 5) | 0.1676 | 0.0071 | 0.0057 to 0.0085 |
| 6 unit 28 d shrunk to 5 (M 20) | 0.1631 | 0.0025 | 0.0017 to 0.0034 |
| 6 unit 28 d shrunk to 5 (M 50) | 0.1617 | 0.0012 | 0.0006 to 0.0018 |

### Cells with under 30 first isolates in the unit's last 28 days · log loss (n = 36588)

| estimator | mean | minus baseline | 95 % interval |
|---|---|---|---|
| 1 unit 28 d raw | 0.6577 | 0.1683 | 0.1473 to 0.1894 |
| 2 unit 365 d raw | 0.4941 | 0.0047 | 0.0028 to 0.0065 |
| 3 hospital 365 d (baseline) | 0.4894 | 0.0000 | – |
| 4 hospital 28 d | 0.4996 | 0.0102 | 0.0076 to 0.0133 |
| 5 unit 365 d shrunk to hospital (M 20) | 0.4913 | 0.0019 | 0.0008 to 0.0030 |
| 6 unit 28 d shrunk to 5 (M 5) | 0.5144 | 0.0250 | 0.0206 to 0.0294 |
| 6 unit 28 d shrunk to 5 (M 20) | 0.4980 | 0.0086 | 0.0060 to 0.0113 |
| 6 unit 28 d shrunk to 5 (M 50) | 0.4935 | 0.0041 | 0.0023 to 0.0060 |

### All units except Urology · Brier score (n = 149852)

| estimator | mean | minus baseline | 95 % interval |
|---|---|---|---|
| 1 unit 28 d raw | 0.1474 | 0.0059 | 0.0052 to 0.0067 |
| 2 unit 365 d raw | 0.1418 | 0.0003 | 0.0002 to 0.0005 |
| 3 hospital 365 d (baseline) | 0.1414 | 0.0000 | – |
| 4 hospital 28 d | 0.1420 | 0.0005 | 0.0003 to 0.0008 |
| 5 unit 365 d shrunk to hospital (M 20) | 0.1417 | 0.0002 | 0.0001 to 0.0003 |
| 6 unit 28 d shrunk to 5 (M 5) | 0.1440 | 0.0026 | 0.0021 to 0.0030 |
| 6 unit 28 d shrunk to 5 (M 20) | 0.1426 | 0.0011 | 0.0008 to 0.0015 |
| 6 unit 28 d shrunk to 5 (M 50) | 0.1420 | 0.0005 | 0.0003 to 0.0008 |

### All units except Urology · log loss (n = 149852)

| estimator | mean | minus baseline | 95 % interval |
|---|---|---|---|
| 1 unit 28 d raw | 0.4882 | 0.0449 | 0.0396 to 0.0505 |
| 2 unit 365 d raw | 0.4447 | 0.0014 | 0.0008 to 0.0019 |
| 3 hospital 365 d (baseline) | 0.4433 | 0.0000 | – |
| 4 hospital 28 d | 0.4461 | 0.0028 | 0.0019 to 0.0039 |
| 5 unit 365 d shrunk to hospital (M 20) | 0.4441 | 0.0008 | 0.0004 to 0.0012 |
| 6 unit 28 d shrunk to 5 (M 5) | 0.4532 | 0.0099 | 0.0084 to 0.0115 |
| 6 unit 28 d shrunk to 5 (M 20) | 0.4476 | 0.0043 | 0.0032 to 0.0054 |
| 6 unit 28 d shrunk to 5 (M 50) | 0.4453 | 0.0020 | 0.0012 to 0.0028 |

