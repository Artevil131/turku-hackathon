# 0008 results

THL cases cube as fetched, months 2024-01 to 2026-09 (33 months), 250 series (11 report groups × 23 counties and the whole country). Signal: upper tail below 0.001 and at least 5 cases. Computed in 16 s.

Signals: **10** of 8250 series-months tested.

| report group | signals |
|---|---|
| CPE carriage, E. cloacae | 0 |
| CPE carriage, E. coli | 2 |
| CPE carriage, K. pneumoniae | 0 |
| ESBL blood/CSF, E. coli | 1 |
| ESBL blood/CSF, K. pneumoniae | 0 |
| ESBL carriage, E. coli | 1 |
| ESBL carriage, K. pneumoniae | 1 |
| MRSA blood/CSF | 1 |
| MRSA carriage | 3 |
| VRE blood/CSF | 0 |
| VRE carriage | 1 |

### All signals, strongest first

| report group | region | month | cases | expected | dispersion | p |
|---|---|---|---|---|---|---|
| VRE carriage | Länsi-Uudenmaan hyvinvointialue | 2026-07 | 15 | 1.9 | 1.0 | 2.4e-09 |
| CPE carriage, E. coli | Varsinais-Suomen hyvinvointialue | 2025-09 | 8 | 0.6 | 1.0 | 1.7e-07 |
| MRSA carriage | Keski-Suomen hyvinvointialue | 2025-07 | 12 | 2.1 | 1.0 | 2.3e-06 |
| MRSA carriage | Päijät-Hämeen hyvinvointialue | 2024-02 | 10 | 2.1 | 1.0 | 6.0e-05 |
| ESBL carriage, K. pneumoniae | Itä-Uudenmaan hyvinvointialue | 2024-02 | 5 | 0.5 | 1.0 | 1.7e-04 |
| CPE carriage, E. coli | Helsingin kaupunki | 2026-03 | 6 | 0.8 | 1.0 | 1.9e-04 |
| ESBL carriage, E. coli | Pohjois-Karjalan hyvinvointialue | 2025-08 | 23 | 10.1 | 1.0 | 3.4e-04 |
| MRSA blood/CSF | Varsinais-Suomen hyvinvointialue | 2025-06 | 5 | 0.6 | 1.0 | 4.1e-04 |
| MRSA carriage | Keski-Suomen hyvinvointialue | 2025-08 | 18 | 5.0 | 1.6 | 6.1e-04 |
| ESBL blood/CSF, E. coli | Pohjois-Pohjanmaan hyvinvointialue | 2026-02 | 7 | 1.0 | 1.2 | 8.6e-04 |

### Synthetic hospital against Varsinais-Suomi, monthly, 2023-10 to 2026-09

Synthetic: first isolates per patient, organism and month with the flag. County: THL carriage cases (all specimen types reported to the register).

| synthetic series | county series | synthetic mean / month | county mean / month | ratio of totals | Pearson r | p | months |
|---|---|---|---|---|---|---|---|
| ESBL E. coli | ESBL carriage, E. coli | 11.0 | 26.5 | 0.41 | -0.03 | 0.85 | 36 |
| MRSA | MRSA carriage | 3.1 | 18.4 | 0.17 | -0.08 | 0.63 | 36 |
