# 0019 results

Run time 86.8 s (CPU). Seed 2026; injection seed 2026 only. Every number below is computed by `run.py` from the data (tag: computed).

## Source episodes (version A)

The rule (4 weeks against the preceding 26, Poisson p < 0.05, at least 2 patients, weeks within 28 days merged, onset the first Sunday) finds 31 episodes in the whole data from the first Sunday with a 26-week baseline (24 ESBL *E. coli*, 7 MRSA). 24 have onset in 2024-10-01 to 2026-09-27 and 56 days of data after it (onset up to 2026-08-03; data end 2026-09-27): 18 ESBL *E. coli*, 6 MRSA. The plan expected 12 to 20 in the scoring period. Causality check of the rule: on the data cut at 2025-03-01, 2025-09-01, 2026-03-01 the onsets are those of all the data up to the cut (asserted by `run.py`: passed).

| # | Phenotype | Unit | Onset | Weeks fired | Patients 4 wk / baseline 26 wk at onset | Rule p | Planted |
|---|---|---|---|---|---|---|---|
| 1 | ESBL E. coli | SURG | 2025-01-12 | 2 | 2 / 1 | 0.0229 |  |
| 2 | ESBL E. coli | MED-A | 2025-01-19 | 3 | 4 / 6 | 0.0190 |  |
| 3 | ESBL E. coli | ED | 2025-03-23 | 2 | 4 / 8 | 0.0439 |  |
| 4 | MRSA | GER | 2025-04-20 | 4 | 2 / 1 | 0.0229 |  |
| 5 | ESBL E. coli | MED-A | 2025-05-04 | 2 | 5 / 9 | 0.0168 |  |
| 6 | ESBL E. coli | ED | 2025-05-18 | 3 | 5 / 9 | 0.0168 |  |
| 7 | ESBL E. coli | MED-B | 2025-05-18 | 2 | 3 / 4 | 0.0332 |  |
| 8 | ESBL E. coli | PHC-S | 2025-06-08 | 1 | 5 / 9 | 0.0168 |  |
| 9 | ESBL E. coli | URO | 2025-06-08 | 7 | 6 / 6 | 0.0006 | E1 |
| 10 | MRSA | PHC-S | 2025-06-15 | 3 | 2 / 1 | 0.0229 |  |
| 11 | ESBL E. coli | PHC-S | 2025-07-13 | 2 | 5 / 12 | 0.0460 |  |
| 12 | MRSA | SURG | 2025-08-03 | 1 | 3 / 4 | 0.0332 |  |
| 13 | ESBL E. coli | PHC-N | 2025-10-05 | 4 | 5 / 10 | 0.0245 |  |
| 14 | ESBL E. coli | SURG | 2025-10-05 | 1 | 2 / 1 | 0.0229 |  |
| 15 | ESBL E. coli | MED-A | 2025-12-14 | 3 | 3 / 1 | 0.0017 |  |
| 16 | ESBL E. coli | ED | 2026-01-04 | 1 | 4 / 6 | 0.0190 |  |
| 17 | ESBL E. coli | ICU | 2026-01-04 | 2 | 2 / 1 | 0.0229 |  |
| 18 | ESBL E. coli | ED | 2026-02-15 | 1 | 5 / 9 | 0.0168 |  |
| 19 | ESBL E. coli | MED-A | 2026-02-15 | 3 | 3 / 4 | 0.0332 |  |
| 20 | MRSA | SURG | 2026-02-22 | 2 | 3 / 2 | 0.0071 |  |
| 21 | MRSA | ICU | 2026-03-08 | 6 | 3 / 0 | 0.0001 | E2 |
| 22 | MRSA | ED | 2026-06-21 | 2 | 2 / 1 | 0.0229 |  |
| 23 | ESBL E. coli | PHC-N | 2026-07-26 | 1 | 4 / 8 | 0.0439 |  |
| 24 | ESBL E. coli | PHC-S | 2026-07-26 | 1 | 5 / 12 | 0.0460 |  |

## Per event: P1 with the harness outcome

AUC over the eight other units; a dash where there is no positive (or no negative) unit. p: rewiring p at 1,000 permutations. rho: Spearman correlation with the continuous excess (observed + 0.5) / expected, with its rewiring p. Pos new: positives at 0.05 of the stricter new-finds outcome.

| # | Phenotype | Unit | Onset | Pos a05 | Pos a001 | AUC share a05 | AUC raw a05 | p share | p raw | AUC share a001 | AUC raw a001 | rho share (p) | rho raw (p) | Pos new a05 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ESBL E. coli | SURG | 2025-01-12 | 0 | 0 | – | – | – | – | – | – | -0.57 (0.863) | -0.43 (0.383) | 0 |
| 2 | ESBL E. coli | MED-A | 2025-01-19 | 0 | 0 | – | – | – | – | – | – | 0.24 (0.236) | 0.00 (0.099) | 0 |
| 3 | ESBL E. coli | ED | 2025-03-23 | 1 | 0 | 0.714 | 0.286 | 0.222 | 0.456 | – | – | 0.24 (0.196) | 0.08 (0.234) | 1 |
| 4 | MRSA | GER | 2025-04-20 | 0 | 0 | – | – | – | – | – | – | 0.02 (0.576) | 0.30 (0.451) | 0 |
| 5 | ESBL E. coli | MED-A | 2025-05-04 | 3 | 1 | 0.533 | 0.733 | 0.742 | 0.919 | 0.286 | 0.286 | 0.05 (0.585) | 0.31 (0.836) | 3 |
| 6 | ESBL E. coli | ED | 2025-05-18 | 2 | 1 | 0.667 | 0.833 | 0.486 | 0.345 | 0.429 | 0.571 | 0.01 (0.717) | 0.28 (0.804) | 2 |
| 7 | ESBL E. coli | MED-B | 2025-05-18 | 2 | 1 | 0.750 | 0.667 | 0.237 | 0.434 | 0.571 | 0.571 | 0.56 (0.115) | 0.54 (0.116) | 2 |
| 8 | ESBL E. coli | PHC-S | 2025-06-08 | 1 | 1 | 0.714 | 0.714 | 0.256 | 0.198 | 0.714 | 0.714 | 0.43 (0.025) | -0.17 (0.105) | 1 |
| 9 | ESBL E. coli | URO | 2025-06-08 | 0 | 0 | – | – | – | – | – | – | 0.48 (0.094) | -0.10 (0.435) | 0 |
| 10 | MRSA | PHC-S | 2025-06-15 | 0 | 0 | – | – | – | – | – | – | -0.04 (0.377) | 0.42 (0.001) | 0 |
| 11 | ESBL E. coli | PHC-S | 2025-07-13 | 0 | 0 | – | – | – | – | – | – | 0.25 (0.224) | -0.36 (0.472) | 0 |
| 12 | MRSA | SURG | 2025-08-03 | 0 | 0 | – | – | – | – | – | – | -0.03 (0.501) | -0.05 (0.812) | 0 |
| 13 | ESBL E. coli | PHC-N | 2025-10-05 | 0 | 0 | – | – | – | – | – | – | -0.62 (0.936) | -0.40 (0.738) | 0 |
| 14 | ESBL E. coli | SURG | 2025-10-05 | 0 | 0 | – | – | – | – | – | – | -0.48 (0.894) | -0.33 (0.993) | 0 |
| 15 | ESBL E. coli | MED-A | 2025-12-14 | 1 | 0 | 0.714 | 1.000 | 0.661 | 0.639 | – | – | -0.11 (0.515) | -0.23 (0.178) | 1 |
| 16 | ESBL E. coli | ED | 2026-01-04 | 0 | 0 | – | – | – | – | – | – | -0.12 (0.568) | 0.36 (0.010) | 0 |
| 17 | ESBL E. coli | ICU | 2026-01-04 | 0 | 0 | – | – | – | – | – | – | -0.40 (0.838) | -0.17 (0.723) | 0 |
| 18 | ESBL E. coli | ED | 2026-02-15 | 0 | 0 | – | – | – | – | – | – | 0.46 (0.226) | 0.28 (0.407) | 0 |
| 19 | ESBL E. coli | MED-A | 2026-02-15 | 0 | 0 | – | – | – | – | – | – | 0.51 (0.125) | 0.63 (0.076) | 0 |
| 20 | MRSA | SURG | 2026-02-22 | 1 | 1 | 0.286 | 0.143 | 0.538 | 0.235 | 0.286 | 0.143 | -0.26 (0.473) | -0.58 (0.280) | 1 |
| 21 | MRSA | ICU | 2026-03-08 | 0 | 0 | – | – | – | – | – | – | -0.10 (0.433) | -0.32 (0.273) | 0 |
| 22 | MRSA | ED | 2026-06-21 | 0 | 0 | – | – | – | – | – | – | -0.15 (0.823) | 0.18 (0.995) | 0 |
| 23 | ESBL E. coli | PHC-N | 2026-07-26 | 0 | 0 | – | – | – | – | – | – | -0.02 (0.138) | 0.05 (0.001) | 0 |
| 24 | ESBL E. coli | PHC-S | 2026-07-26 | 0 | 0 | – | – | – | – | – | – | -0.43 (0.611) | -0.26 (0.054) | 0 |

## Per event and unit

Share and raw exposure of the unit from the source (365 days before onset), then the harness outcome: patients with the phenotype in the 8 weeks from onset over the expected count from the unit's 26-week baseline, and the new-finds count (known carriers left out).

| # | Source | Unit | Share | Raw | Baseline pts | Observed / expected | p | Pos a05 | Pos a001 | New-finds pts | Pos new a05 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | SURG | ED | 0.109 | 17.4 | 8 | 3 / 2.62 | 0.485 |  |  | 3 |  |
| 1 | SURG | MED-A | 0.059 | 4.8 | 7 | 4 / 2.31 | 0.202 |  |  | 4 |  |
| 1 | SURG | MED-B | 0.096 | 5.4 | 6 | 1 / 2.00 | 0.865 |  |  | 1 |  |
| 1 | SURG | URO | 0.079 | 5.9 | 6 | 2 / 2.00 | 0.594 |  |  | 2 |  |
| 1 | SURG | ICU | 0.070 | 2.2 | 1 | 1 / 0.46 | 0.370 |  |  | 1 |  |
| 1 | SURG | GER | 0.085 | 6.5 | 5 | 3 / 1.69 | 0.241 |  |  | 2 |  |
| 1 | SURG | PHC-N | 0.091 | 8.1 | 11 | 2 / 3.54 | 0.868 |  |  | 2 |  |
| 1 | SURG | PHC-S | 0.143 | 14.0 | 21 | 5 / 6.62 | 0.789 |  |  | 5 |  |
| 2 | MED-A | ED | 0.086 | 13.6 | 7 | 3 / 2.31 | 0.406 |  |  | 3 |  |
| 2 | MED-A | MED-B | 0.083 | 4.5 | 6 | 1 / 2.00 | 0.865 |  |  | 1 |  |
| 2 | MED-A | SURG | 0.096 | 6.1 | 3 | 0 / 1.08 | 1.000 |  |  | 0 |  |
| 2 | MED-A | URO | 0.088 | 6.5 | 6 | 2 / 2.00 | 0.594 |  |  | 2 |  |
| 2 | MED-A | ICU | 0.108 | 3.4 | 1 | 1 / 0.46 | 0.370 |  |  | 1 |  |
| 2 | MED-A | GER | 0.127 | 9.6 | 5 | 3 / 1.69 | 0.241 |  |  | 2 |  |
| 2 | MED-A | PHC-N | 0.154 | 13.7 | 9 | 3 / 2.92 | 0.559 |  |  | 3 |  |
| 2 | MED-A | PHC-S | 0.117 | 11.5 | 21 | 5 / 6.62 | 0.789 |  |  | 5 |  |
| 3 | ED | MED-A | 0.248 | 19.1 | 9 | 5 / 2.92 | 0.172 |  |  | 5 |  |
| 3 | ED | MED-B | 0.258 | 14.0 | 3 | 4 / 1.08 | 0.024 | yes |  | 4 | yes |
| 3 | ED | SURG | 0.204 | 13.0 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |  |
| 3 | ED | URO | 0.242 | 18.4 | 4 | 2 / 1.38 | 0.403 |  |  | 2 |  |
| 3 | ED | ICU | 0.252 | 8.7 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |  |
| 3 | ED | GER | 0.245 | 18.4 | 7 | 2 / 2.31 | 0.671 |  |  | 2 |  |
| 3 | ED | PHC-N | 0.345 | 29.8 | 7 | 5 / 2.31 | 0.085 |  |  | 5 |  |
| 3 | ED | PHC-S | 0.309 | 31.1 | 15 | 1 / 4.77 | 0.992 |  |  | 1 |  |
| 4 | GER | ED | 0.138 | 21.1 | 2 | 1 / 0.77 | 0.537 |  |  | 1 |  |
| 4 | GER | MED-A | 0.120 | 8.7 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 4 | GER | MED-B | 0.103 | 6.1 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 4 | GER | SURG | 0.107 | 7.1 | 4 | 1 / 1.38 | 0.750 |  |  | 1 |  |
| 4 | GER | URO | 0.110 | 8.5 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 4 | GER | ICU | 0.110 | 3.8 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |  |
| 4 | GER | PHC-N | 0.128 | 10.6 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |  |
| 4 | GER | PHC-S | 0.137 | 14.1 | 2 | 2 / 0.77 | 0.180 |  |  | 2 |  |
| 5 | MED-A | ED | 0.114 | 17.4 | 10 | 7 / 3.23 | 0.047 | yes |  | 7 | yes |
| 5 | MED-A | MED-B | 0.071 | 4.1 | 5 | 2 / 1.69 | 0.504 |  |  | 2 |  |
| 5 | MED-A | SURG | 0.105 | 7.0 | 2 | 1 / 0.77 | 0.537 |  |  | 1 |  |
| 5 | MED-A | URO | 0.082 | 6.3 | 6 | 21 / 2.00 | 0.000 | yes | yes | 18 | yes |
| 5 | MED-A | ICU | 0.080 | 2.9 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |  |
| 5 | MED-A | GER | 0.143 | 10.3 | 7 | 3 / 2.31 | 0.406 |  |  | 3 |  |
| 5 | MED-A | PHC-N | 0.145 | 12.1 | 9 | 3 / 2.92 | 0.559 |  |  | 3 |  |
| 5 | MED-A | PHC-S | 0.113 | 11.3 | 11 | 8 / 3.54 | 0.028 | yes |  | 8 | yes |
| 6 | ED | MED-A | 0.278 | 20.0 | 12 | 1 / 3.85 | 0.979 |  |  | 1 |  |
| 6 | ED | MED-B | 0.248 | 14.3 | 6 | 1 / 2.00 | 0.865 |  |  | 1 |  |
| 6 | ED | SURG | 0.181 | 12.0 | 2 | 1 / 0.77 | 0.537 |  |  | 1 |  |
| 6 | ED | URO | 0.249 | 19.1 | 6 | 28 / 2.00 | 0.000 | yes | yes | 25 | yes |
| 6 | ED | ICU | 0.253 | 9.2 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |  |
| 6 | ED | GER | 0.246 | 17.4 | 7 | 1 / 2.31 | 0.901 |  |  | 1 |  |
| 6 | ED | PHC-N | 0.349 | 29.5 | 10 | 2 / 3.23 | 0.833 |  |  | 2 |  |
| 6 | ED | PHC-S | 0.305 | 30.6 | 9 | 9 / 2.92 | 0.003 | yes |  | 9 | yes |
| 7 | MED-B | ED | 0.076 | 11.8 | 13 | 3 / 4.15 | 0.784 |  |  | 3 |  |
| 7 | MED-B | MED-A | 0.062 | 4.5 | 12 | 1 / 3.85 | 0.979 |  |  | 1 |  |
| 7 | MED-B | SURG | 0.068 | 4.5 | 2 | 1 / 0.77 | 0.537 |  |  | 1 |  |
| 7 | MED-B | URO | 0.070 | 5.3 | 6 | 28 / 2.00 | 0.000 | yes | yes | 25 | yes |
| 7 | MED-B | ICU | 0.033 | 1.2 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |  |
| 7 | MED-B | GER | 0.060 | 4.3 | 7 | 1 / 2.31 | 0.901 |  |  | 1 |  |
| 7 | MED-B | PHC-N | 0.118 | 10.0 | 10 | 2 / 3.23 | 0.833 |  |  | 2 |  |
| 7 | MED-B | PHC-S | 0.096 | 9.7 | 9 | 9 / 2.92 | 0.003 | yes |  | 9 | yes |
| 8 | PHC-S | ED | 0.178 | 28.0 | 15 | 1 / 4.77 | 0.992 |  |  | 1 |  |
| 8 | PHC-S | MED-A | 0.176 | 12.7 | 12 | 1 / 3.85 | 0.979 |  |  | 1 |  |
| 8 | PHC-S | MED-B | 0.153 | 8.7 | 6 | 2 / 2.00 | 0.594 |  |  | 1 |  |
| 8 | PHC-S | SURG | 0.234 | 15.6 | 3 | 0 / 1.08 | 1.000 |  |  | 0 |  |
| 8 | PHC-S | URO | 0.199 | 15.2 | 10 | 26 / 3.23 | 0.000 | yes | yes | 23 | yes |
| 8 | PHC-S | ICU | 0.238 | 8.4 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 8 | PHC-S | GER | 0.131 | 9.8 | 8 | 0 / 2.62 | 1.000 |  |  | 0 |  |
| 8 | PHC-S | PHC-N | 0.000 | 0.0 | 11 | 1 / 3.54 | 0.971 |  |  | 1 |  |
| 9 | URO | ED | 0.100 | 15.7 | 15 | 1 / 4.77 | 0.992 |  |  | 1 |  |
| 9 | URO | MED-A | 0.063 | 4.5 | 12 | 1 / 3.85 | 0.979 |  |  | 1 |  |
| 9 | URO | MED-B | 0.094 | 5.4 | 6 | 2 / 2.00 | 0.594 |  |  | 1 |  |
| 9 | URO | SURG | 0.093 | 6.2 | 3 | 0 / 1.08 | 1.000 |  |  | 0 |  |
| 9 | URO | ICU | 0.083 | 2.9 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 9 | URO | GER | 0.078 | 5.8 | 8 | 0 / 2.62 | 1.000 |  |  | 0 |  |
| 9 | URO | PHC-N | 0.131 | 11.7 | 11 | 1 / 3.54 | 0.971 |  |  | 1 |  |
| 9 | URO | PHC-S | 0.144 | 14.2 | 12 | 5 / 3.85 | 0.341 |  |  | 5 |  |
| 10 | PHC-S | ED | 0.180 | 28.2 | 2 | 1 / 0.77 | 0.537 |  |  | 1 |  |
| 10 | PHC-S | MED-A | 0.171 | 12.3 | 1 | 1 / 0.46 | 0.370 |  |  | 1 |  |
| 10 | PHC-S | MED-B | 0.153 | 8.7 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 10 | PHC-S | SURG | 0.238 | 15.7 | 4 | 3 / 1.38 | 0.163 |  |  | 3 |  |
| 10 | PHC-S | URO | 0.197 | 15.1 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 10 | PHC-S | ICU | 0.239 | 8.4 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |  |
| 10 | PHC-S | GER | 0.136 | 10.5 | 2 | 1 / 0.77 | 0.537 |  |  | 1 |  |
| 10 | PHC-S | PHC-N | 0.000 | 0.0 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 11 | PHC-S | ED | 0.177 | 27.8 | 14 | 2 / 4.46 | 0.937 |  |  | 2 |  |
| 11 | PHC-S | MED-A | 0.175 | 12.8 | 10 | 0 / 3.23 | 1.000 |  |  | 0 |  |
| 11 | PHC-S | MED-B | 0.170 | 9.6 | 6 | 2 / 2.00 | 0.594 |  |  | 1 |  |
| 11 | PHC-S | SURG | 0.223 | 14.8 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 11 | PHC-S | URO | 0.210 | 16.1 | 32 | 3 / 10.00 | 0.997 |  |  | 3 |  |
| 11 | PHC-S | ICU | 0.246 | 9.6 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 11 | PHC-S | GER | 0.136 | 10.5 | 7 | 0 / 2.31 | 1.000 |  |  | 0 |  |
| 11 | PHC-S | PHC-N | 0.000 | 0.0 | 10 | 2 / 3.23 | 0.833 |  |  | 2 |  |
| 12 | SURG | ED | 0.119 | 18.9 | 3 | 2 / 1.08 | 0.293 |  |  | 2 |  |
| 12 | SURG | MED-A | 0.064 | 4.8 | 1 | 1 / 0.46 | 0.370 |  |  | 1 |  |
| 12 | SURG | MED-B | 0.090 | 4.9 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 12 | SURG | URO | 0.083 | 6.3 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 12 | SURG | ICU | 0.063 | 2.5 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 12 | SURG | GER | 0.069 | 5.3 | 2 | 1 / 0.77 | 0.537 |  |  | 1 |  |
| 12 | SURG | PHC-N | 0.080 | 7.2 | 1 | 1 / 0.46 | 0.370 |  |  | 1 |  |
| 12 | SURG | PHC-S | 0.153 | 15.2 | 4 | 1 / 1.38 | 0.750 |  |  | 1 |  |
| 13 | PHC-N | ED | 0.245 | 39.0 | 13 | 1 / 4.15 | 0.984 |  |  | 1 |  |
| 13 | PHC-N | MED-A | 0.171 | 12.1 | 6 | 1 / 2.00 | 0.865 |  |  | 1 |  |
| 13 | PHC-N | MED-B | 0.200 | 10.2 | 6 | 0 / 2.00 | 1.000 |  |  | 0 |  |
| 13 | PHC-N | SURG | 0.192 | 12.5 | 3 | 1 / 1.08 | 0.659 |  |  | 1 |  |
| 13 | PHC-N | URO | 0.193 | 14.7 | 32 | 1 / 10.00 | 1.000 |  |  | 1 |  |
| 13 | PHC-N | ICU | 0.112 | 4.2 | 0 | 1 / 0.15 | 0.143 |  |  | 1 |  |
| 13 | PHC-N | GER | 0.173 | 13.5 | 4 | 1 / 1.38 | 0.750 |  |  | 1 |  |
| 13 | PHC-N | PHC-S | 0.000 | 0.0 | 13 | 3 / 4.15 | 0.784 |  |  | 3 |  |
| 14 | SURG | ED | 0.110 | 17.5 | 13 | 1 / 4.15 | 0.984 |  |  | 1 |  |
| 14 | SURG | MED-A | 0.072 | 5.1 | 6 | 1 / 2.00 | 0.865 |  |  | 1 |  |
| 14 | SURG | MED-B | 0.077 | 3.9 | 6 | 0 / 2.00 | 1.000 |  |  | 0 |  |
| 14 | SURG | URO | 0.106 | 8.0 | 32 | 1 / 10.00 | 1.000 |  |  | 1 |  |
| 14 | SURG | ICU | 0.062 | 2.3 | 0 | 1 / 0.15 | 0.143 |  |  | 1 |  |
| 14 | SURG | GER | 0.069 | 5.4 | 4 | 1 / 1.38 | 0.750 |  |  | 1 |  |
| 14 | SURG | PHC-N | 0.080 | 7.4 | 12 | 4 / 3.85 | 0.536 |  |  | 4 |  |
| 14 | SURG | PHC-S | 0.137 | 13.9 | 13 | 3 / 4.15 | 0.784 |  |  | 3 |  |
| 15 | MED-A | ED | 0.117 | 18.8 | 5 | 7 / 1.69 | 0.002 | yes |  | 5 | yes |
| 15 | MED-A | MED-B | 0.084 | 3.9 | 3 | 1 / 1.08 | 0.659 |  |  | 1 |  |
| 15 | MED-A | SURG | 0.063 | 3.9 | 3 | 1 / 1.08 | 0.659 |  |  | 1 |  |
| 15 | MED-A | URO | 0.068 | 5.2 | 24 | 4 / 7.54 | 0.942 |  |  | 4 |  |
| 15 | MED-A | ICU | 0.069 | 3.0 | 1 | 2 / 0.46 | 0.079 |  |  | 2 |  |
| 15 | MED-A | GER | 0.152 | 12.0 | 2 | 1 / 0.77 | 0.537 |  |  | 1 |  |
| 15 | MED-A | PHC-N | 0.116 | 11.3 | 11 | 4 / 3.54 | 0.472 |  |  | 4 |  |
| 15 | MED-A | PHC-S | 0.168 | 17.5 | 13 | 1 / 4.15 | 0.984 |  |  | 1 |  |
| 16 | ED | MED-A | 0.211 | 16.2 | 4 | 3 / 1.38 | 0.163 |  |  | 3 |  |
| 16 | ED | MED-B | 0.194 | 8.9 | 4 | 0 / 1.38 | 1.000 |  |  | 0 |  |
| 16 | ED | SURG | 0.204 | 12.7 | 3 | 1 / 1.08 | 0.659 |  |  | 1 |  |
| 16 | ED | URO | 0.218 | 16.0 | 8 | 2 / 2.62 | 0.736 |  |  | 2 |  |
| 16 | ED | ICU | 0.282 | 12.4 | 3 | 0 / 1.08 | 1.000 |  |  | 0 |  |
| 16 | ED | GER | 0.245 | 18.6 | 2 | 2 / 0.77 | 0.180 |  |  | 2 |  |
| 16 | ED | PHC-N | 0.331 | 33.8 | 14 | 1 / 4.46 | 0.988 |  |  | 1 |  |
| 16 | ED | PHC-S | 0.321 | 34.4 | 10 | 4 / 3.23 | 0.404 |  |  | 4 |  |
| 17 | ICU | ED | 0.055 | 8.6 | 8 | 6 / 2.62 | 0.050 |  |  | 6 |  |
| 17 | ICU | MED-A | 0.049 | 3.7 | 4 | 3 / 1.38 | 0.163 |  |  | 3 |  |
| 17 | ICU | MED-B | 0.030 | 1.4 | 4 | 0 / 1.38 | 1.000 |  |  | 0 |  |
| 17 | ICU | SURG | 0.061 | 3.8 | 3 | 1 / 1.08 | 0.659 |  |  | 1 |  |
| 17 | ICU | URO | 0.079 | 5.8 | 8 | 2 / 2.62 | 0.736 |  |  | 2 |  |
| 17 | ICU | GER | 0.060 | 4.5 | 2 | 2 / 0.77 | 0.180 |  |  | 2 |  |
| 17 | ICU | PHC-N | 0.085 | 8.6 | 14 | 1 / 4.46 | 0.988 |  |  | 1 |  |
| 17 | ICU | PHC-S | 0.075 | 8.0 | 10 | 4 / 3.23 | 0.404 |  |  | 4 |  |
| 18 | ED | MED-A | 0.211 | 17.3 | 7 | 0 / 2.31 | 1.000 |  |  | 0 |  |
| 18 | ED | MED-B | 0.212 | 10.3 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |  |
| 18 | ED | SURG | 0.234 | 14.7 | 4 | 0 / 1.38 | 1.000 |  |  | 0 |  |
| 18 | ED | URO | 0.239 | 16.9 | 7 | 2 / 2.31 | 0.671 |  |  | 2 |  |
| 18 | ED | ICU | 0.290 | 12.8 | 3 | 0 / 1.08 | 1.000 |  |  | 0 |  |
| 18 | ED | GER | 0.233 | 17.2 | 4 | 1 / 1.38 | 0.750 |  |  | 1 |  |
| 18 | ED | PHC-N | 0.306 | 31.3 | 14 | 2 / 4.46 | 0.937 |  |  | 2 |  |
| 18 | ED | PHC-S | 0.323 | 35.5 | 10 | 5 / 3.23 | 0.225 |  |  | 5 |  |
| 19 | MED-A | ED | 0.107 | 16.5 | 14 | 4 / 4.46 | 0.651 |  |  | 4 |  |
| 19 | MED-A | MED-B | 0.092 | 4.4 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |  |
| 19 | MED-A | SURG | 0.094 | 5.9 | 4 | 0 / 1.38 | 1.000 |  |  | 0 |  |
| 19 | MED-A | URO | 0.085 | 6.0 | 7 | 2 / 2.31 | 0.671 |  |  | 2 |  |
| 19 | MED-A | ICU | 0.079 | 3.5 | 3 | 0 / 1.08 | 1.000 |  |  | 0 |  |
| 19 | MED-A | GER | 0.154 | 11.4 | 4 | 1 / 1.38 | 0.750 |  |  | 1 |  |
| 19 | MED-A | PHC-N | 0.115 | 11.8 | 14 | 2 / 4.46 | 0.937 |  |  | 2 |  |
| 19 | MED-A | PHC-S | 0.162 | 17.9 | 10 | 5 / 3.23 | 0.225 |  |  | 5 |  |
| 20 | SURG | ED | 0.110 | 17.2 | 6 | 0 / 2.00 | 1.000 |  |  | 0 |  |
| 20 | SURG | MED-A | 0.074 | 6.1 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 20 | SURG | MED-B | 0.053 | 2.5 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 20 | SURG | URO | 0.096 | 6.8 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 20 | SURG | ICU | 0.062 | 2.7 | 0 | 13 / 0.15 | 0.000 | yes | yes | 13 | yes |
| 20 | SURG | GER | 0.049 | 3.5 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 20 | SURG | PHC-N | 0.120 | 12.5 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 20 | SURG | PHC-S | 0.110 | 12.0 | 3 | 0 / 1.08 | 1.000 |  |  | 0 |  |
| 21 | ICU | ED | 0.057 | 9.1 | 6 | 0 / 2.00 | 1.000 |  |  | 0 |  |
| 21 | ICU | MED-A | 0.051 | 4.2 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 21 | ICU | MED-B | 0.023 | 1.1 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 21 | ICU | SURG | 0.051 | 3.1 | 3 | 2 / 1.08 | 0.293 |  |  | 2 |  |
| 21 | ICU | URO | 0.073 | 5.1 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 21 | ICU | GER | 0.059 | 4.4 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 21 | ICU | PHC-N | 0.094 | 9.9 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 21 | ICU | PHC-S | 0.081 | 8.5 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |  |
| 22 | ED | MED-A | 0.213 | 17.0 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 22 | ED | MED-B | 0.262 | 12.2 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 22 | ED | SURG | 0.304 | 18.2 | 6 | 2 / 2.00 | 0.594 |  |  | 2 |  |
| 22 | ED | URO | 0.227 | 15.0 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 22 | ED | ICU | 0.310 | 13.0 | 13 | 1 / 4.15 | 0.984 |  |  | 1 |  |
| 22 | ED | GER | 0.259 | 19.9 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |  |
| 22 | ED | PHC-N | 0.324 | 33.2 | 0 | 1 / 0.15 | 0.143 |  |  | 1 |  |
| 22 | ED | PHC-S | 0.315 | 33.6 | 2 | 1 / 0.77 | 0.537 |  |  | 1 |  |
| 23 | PHC-N | ED | 0.235 | 36.6 | 19 | 3 / 6.00 | 0.938 |  |  | 3 |  |
| 23 | PHC-N | MED-A | 0.197 | 15.7 | 6 | 1 / 2.00 | 0.865 |  |  | 1 |  |
| 23 | PHC-N | MED-B | 0.203 | 8.9 | 3 | 1 / 1.08 | 0.659 |  |  | 1 |  |
| 23 | PHC-N | SURG | 0.182 | 11.2 | 2 | 1 / 0.77 | 0.537 |  |  | 1 |  |
| 23 | PHC-N | URO | 0.153 | 9.5 | 3 | 2 / 1.08 | 0.293 |  |  | 1 |  |
| 23 | PHC-N | ICU | 0.152 | 6.0 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 23 | PHC-N | GER | 0.168 | 13.0 | 5 | 2 / 1.69 | 0.504 |  |  | 1 |  |
| 23 | PHC-N | PHC-S | 0.000 | 0.0 | 16 | 2 / 5.08 | 0.962 |  |  | 2 |  |
| 24 | PHC-S | ED | 0.188 | 29.3 | 19 | 3 / 6.00 | 0.938 |  |  | 3 |  |
| 24 | PHC-S | MED-A | 0.198 | 15.8 | 6 | 1 / 2.00 | 0.865 |  |  | 1 |  |
| 24 | PHC-S | MED-B | 0.142 | 6.2 | 3 | 1 / 1.08 | 0.659 |  |  | 1 |  |
| 24 | PHC-S | SURG | 0.179 | 11.1 | 2 | 1 / 0.77 | 0.537 |  |  | 1 |  |
| 24 | PHC-S | URO | 0.142 | 8.8 | 3 | 2 / 1.08 | 0.293 |  |  | 1 |  |
| 24 | PHC-S | ICU | 0.151 | 5.9 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |  |
| 24 | PHC-S | GER | 0.185 | 14.4 | 5 | 2 / 1.69 | 0.504 |  |  | 1 |  |
| 24 | PHC-S | PHC-N | 0.000 | 0.0 | 12 | 3 / 3.85 | 0.738 |  |  | 2 |  |

## Pooled over events (the test)

U = Σ U_e / Σ n_pos · n_neg over events with at least one positive and one negative unit (within-event Mann-Whitney pairs). Null: replicate j of every event's graph pooled the same way (1,000 replicates); band: its 2.5th and 97.5th percentiles; p = (1 + #{null ≥ U}) / 1,001. The interval is a 95 % bootstrap over the events used (1,000 resamples, seed 2026), an addition of this run.

### Harness outcome

| Subset | Exposure | Alpha | Events used / all | Positives | Pairs | Pooled AUC (95 % bootstrap over events) | Null mean [2.5, 97.5] | p |
|---|---|---|---|---|---|---|---|---|
| all | share | 0.05 | 7 / 24 | 11 | 67 | 0.627 (0.52 to 0.72) | 0.544 [0.358, 0.731] | 0.218 |
| all | raw | 0.05 | 7 / 24 | 11 | 67 | 0.657 (0.45 to 0.81) | 0.602 [0.522, 0.687] | 0.143 |
| all | share | 0.001 | 5 / 24 | 5 | 35 | 0.457 (0.31 to 0.60) | 0.413 [0.143, 0.686] | 0.410 |
| all | raw | 0.001 | 5 / 24 | 5 | 35 | 0.457 (0.26 to 0.63) | 0.365 [0.229, 0.486] | 0.120 |
| ESBL E. coli | share | 0.05 | 6 / 18 | 10 | 60 | 0.667 (0.59 to 0.73) | 0.566 [0.383, 0.750] | 0.191 |
| ESBL E. coli | raw | 0.05 | 6 / 18 | 10 | 60 | 0.717 (0.57 to 0.85) | 0.667 [0.567, 0.750] | 0.197 |
| ESBL E. coli | share | 0.001 | 4 / 18 | 4 | 28 | 0.500 (0.36 to 0.64) | 0.427 [0.143, 0.714] | 0.346 |
| ESBL E. coli | raw | 0.001 | 4 / 18 | 4 | 28 | 0.536 (0.39 to 0.68) | 0.445 [0.286, 0.607] | 0.186 |
| MRSA | share | 0.05 | 1 / 6 | 1 | 7 | 0.286 (–) | 0.356 [0.000, 1.000] | 0.538 |
| MRSA | raw | 0.05 | 1 / 6 | 1 | 7 | 0.143 (–) | 0.044 [0.000, 0.286] | 0.235 |
| MRSA | share | 0.001 | 1 / 6 | 1 | 7 | 0.286 (–) | 0.356 [0.000, 1.000] | 0.538 |
| MRSA | raw | 0.001 | 1 / 6 | 1 | 7 | 0.143 (–) | 0.044 [0.000, 0.286] | 0.235 |
| without E1 and E2 | share | 0.05 | 7 / 22 | 11 | 67 | 0.627 (0.52 to 0.72) | 0.544 [0.358, 0.731] | 0.218 |
| without E1 and E2 | raw | 0.05 | 7 / 22 | 11 | 67 | 0.657 (0.45 to 0.81) | 0.602 [0.522, 0.687] | 0.143 |
| without E1 and E2 | share | 0.001 | 5 / 22 | 5 | 35 | 0.457 (0.31 to 0.60) | 0.413 [0.143, 0.686] | 0.410 |
| without E1 and E2 | raw | 0.001 | 5 / 22 | 5 | 35 | 0.457 (0.26 to 0.63) | 0.365 [0.229, 0.486] | 0.120 |
| without E1, E2 and their units' cells | share | 0.05 | 5 / 22 | 6 | 35 | 0.714 (0.64 to 0.81) | 0.637 [0.400, 0.857] | 0.283 |
| without E1, E2 and their units' cells | raw | 0.05 | 5 / 22 | 6 | 35 | 0.771 (0.51 to 0.97) | 0.759 [0.657, 0.857] | 0.519 |
| without E1, E2 and their units' cells | share | 0.001 | 0 / 22 | 0 | 0 | – | – | – |
| without E1, E2 and their units' cells | raw | 0.001 | 0 / 22 | 0 | 0 | – | – | – |

### New-finds outcome (known carriers left out after onset)

| Subset | Exposure | Alpha | Events used / all | Positives | Pairs | Pooled AUC (95 % bootstrap over events) | Null mean [2.5, 97.5] | p |
|---|---|---|---|---|---|---|---|---|
| all | share | 0.05 | 7 / 24 | 11 | 67 | 0.627 (0.52 to 0.72) | 0.544 [0.358, 0.731] | 0.218 |
| all | raw | 0.05 | 7 / 24 | 11 | 67 | 0.657 (0.45 to 0.81) | 0.602 [0.522, 0.687] | 0.143 |
| all | share | 0.001 | 5 / 24 | 5 | 35 | 0.457 (0.31 to 0.60) | 0.413 [0.143, 0.686] | 0.410 |
| all | raw | 0.001 | 5 / 24 | 5 | 35 | 0.457 (0.26 to 0.63) | 0.365 [0.229, 0.486] | 0.120 |
| ESBL E. coli | share | 0.05 | 6 / 18 | 10 | 60 | 0.667 (0.59 to 0.73) | 0.566 [0.383, 0.750] | 0.191 |
| ESBL E. coli | raw | 0.05 | 6 / 18 | 10 | 60 | 0.717 (0.57 to 0.85) | 0.667 [0.567, 0.750] | 0.197 |
| ESBL E. coli | share | 0.001 | 4 / 18 | 4 | 28 | 0.500 (0.36 to 0.64) | 0.427 [0.143, 0.714] | 0.346 |
| ESBL E. coli | raw | 0.001 | 4 / 18 | 4 | 28 | 0.536 (0.39 to 0.68) | 0.445 [0.286, 0.607] | 0.186 |
| MRSA | share | 0.05 | 1 / 6 | 1 | 7 | 0.286 (–) | 0.356 [0.000, 1.000] | 0.538 |
| MRSA | raw | 0.05 | 1 / 6 | 1 | 7 | 0.143 (–) | 0.044 [0.000, 0.286] | 0.235 |
| MRSA | share | 0.001 | 1 / 6 | 1 | 7 | 0.286 (–) | 0.356 [0.000, 1.000] | 0.538 |
| MRSA | raw | 0.001 | 1 / 6 | 1 | 7 | 0.143 (–) | 0.044 [0.000, 0.286] | 0.235 |
| without E1 and E2 | share | 0.05 | 7 / 22 | 11 | 67 | 0.627 (0.52 to 0.72) | 0.544 [0.358, 0.731] | 0.218 |
| without E1 and E2 | raw | 0.05 | 7 / 22 | 11 | 67 | 0.657 (0.45 to 0.81) | 0.602 [0.522, 0.687] | 0.143 |
| without E1 and E2 | share | 0.001 | 5 / 22 | 5 | 35 | 0.457 (0.31 to 0.60) | 0.413 [0.143, 0.686] | 0.410 |
| without E1 and E2 | raw | 0.001 | 5 / 22 | 5 | 35 | 0.457 (0.26 to 0.63) | 0.365 [0.229, 0.486] | 0.120 |
| without E1, E2 and their units' cells | share | 0.05 | 5 / 22 | 6 | 35 | 0.714 (0.64 to 0.81) | 0.637 [0.400, 0.857] | 0.283 |
| without E1, E2 and their units' cells | raw | 0.05 | 5 / 22 | 6 | 35 | 0.771 (0.51 to 0.97) | 0.759 [0.657, 0.857] | 0.519 |
| without E1, E2 and their units' cells | share | 0.001 | 0 / 22 | 0 | 0 | – | – | – |
| without E1, E2 and their units' cells | raw | 0.001 | 0 / 22 | 0 | 0 | – | – | – |

### Rank correlation with the continuous excess, averaged over events

| Subset | Exposure | Events | Mean rho | Null band [2.5, 97.5] | p |
|---|---|---|---|---|---|
| all | share | 24 | -0.003 | [-0.185, 0.080] | 0.204 |
| all | raw | 24 | 0.001 | [-0.144, -0.030] | 0.002 |
| ESBL E. coli | share | 18 | 0.026 | [-0.195, 0.100] | 0.158 |
| ESBL E. coli | raw | 18 | 0.004 | [-0.160, -0.025] | 0.001 |
| MRSA | share | 6 | -0.092 | [-0.327, 0.211] | 0.579 |
| MRSA | raw | 6 | -0.009 | [-0.161, 0.044] | 0.165 |
| without E1 and E2 | share | 22 | -0.020 | [-0.182, 0.086] | 0.322 |
| without E1 and E2 | raw | 22 | 0.020 | [-0.129, -0.010] | 0.003 |

Why the null band of the raw-exposure correlation sits below zero: the continuous excess (observed + 0.5) / expected falls with a unit's volume (small units have the larger ratios), and exposure under the rewiring null follows volume. Spearman correlation with the unit's number of culture rows in the graph window (the quantity the null keeps), mean over the 24 events:

| Quantity | Mean rho with unit volume |
|---|---|
| Continuous excess | -0.092 |
| Raw exposure, real graph | 0.748 |
| Raw exposure, rewired graphs (mean over replicates) | 0.895 |
| Share, real graph | 0.387 |
| Share, rewired graphs (mean over replicates) | 0.379 |

## E1 and E2 as descriptions

E1 reproduces the baseline row of `baselines/exposure-e1.json` (positives, shares, raw, excess correlation): yes.

### E1: ESBL E. coli in URO, onset 2025-05-30

Positives at 0.05: 0; at 0.001: 0. AUC share / raw at 0.05: – / – (p – / –); at 0.001: – / –. rho share 0.619 (p 0.052), raw 0.048 (p 0.560). New-finds positives at 0.05: 0.

| Unit | Share | Raw | Baseline pts | Observed / expected | p | Pos a05 | Pos a001 | New-finds pts |
|---|---|---|---|---|---|---|---|---|
| ED | 0.100 | 15.8 | 15 | 1 / 4.77 | 0.992 |  |  | 1 |
| MED-A | 0.069 | 5.0 | 12 | 1 / 3.85 | 0.979 |  |  | 1 |
| MED-B | 0.091 | 5.2 | 6 | 2 / 2.00 | 0.594 |  |  | 1 |
| SURG | 0.105 | 6.9 | 3 | 0 / 1.08 | 1.000 |  |  | 0 |
| ICU | 0.084 | 3.0 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |
| GER | 0.081 | 5.9 | 8 | 0 / 2.62 | 1.000 |  |  | 0 |
| PHC-N | 0.133 | 11.7 | 9 | 2 / 2.92 | 0.789 |  |  | 2 |
| PHC-S | 0.140 | 13.9 | 11 | 6 / 3.54 | 0.148 |  |  | 6 |

### E2: MRSA in ICU, onset 2026-03-03

Positives at 0.05: 0; at 0.001: 0. AUC share / raw at 0.05: – / – (p – / –); at 0.001: – / –. rho share -0.165 (p 0.492), raw -0.292 (p 0.228). New-finds positives at 0.05: 0.

| Unit | Share | Raw | Baseline pts | Observed / expected | p | Pos a05 | Pos a001 | New-finds pts |
|---|---|---|---|---|---|---|---|---|
| ED | 0.054 | 8.5 | 6 | 0 / 2.00 | 1.000 |  |  | 0 |
| MED-A | 0.050 | 4.2 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |
| MED-B | 0.023 | 1.1 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |
| SURG | 0.053 | 3.3 | 3 | 2 / 1.08 | 0.293 |  |  | 2 |
| URO | 0.068 | 4.8 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |
| GER | 0.057 | 4.2 | 1 | 0 / 0.46 | 1.000 |  |  | 0 |
| PHC-N | 0.093 | 9.6 | 0 | 0 / 0.15 | 1.000 |  |  | 0 |
| PHC-S | 0.085 | 9.0 | 2 | 0 / 0.77 | 1.000 |  |  | 0 |

## Controls (version B): injected two-unit clusters

These are controls. B1 (flow partner): B drawn in proportion to the patients moved between A and B in the year before the start, the quantity exposure reads, so ranking B high is built in; a pipeline that failed it would be broken, and one that passes shows nothing about the data. B2 (uniform partner): B independent of flow, so the true AUC is 0.5 and the share of trials with p < 0.05 should be about 5 %; it checks the null's calibration only. Exposure from A only; outcome on the real records plus the injected patients; 200 permutations per trial (p resolution 1/201); alpha 0.05. Pooled AUC over within-trial pairs, interval a bootstrap over trials, p the pooled rewiring p.

| Control | Cell | Trials | With AUC (one positive) | Pooled AUC share (95 % boot; null mean [band]; p) | Pooled AUC raw (95 % boot; null mean [band]; p) | B alone: AUC from rank, share / raw | B mean rank share / raw (chance 4.5) | B positive | p<0.05 share / raw, of trials with AUC | p<0.05 share / raw, of trials with 2+ positives | p<0.05 share / raw, of all trials |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 flow partner (positive control) | k = 4 | 200 | 106 (0.70) | 0.487 (0.43 to 0.54; null 0.534 [0.493, 0.582]; p 0.990) | 0.557 (0.51 to 0.61; null 0.588 [0.568, 0.611]; p 1.000) | 0.581 / 0.636 | 3.94 / 3.55 | 0.350 | 0.009 / 0.057 | 0.000 / 0.094 | 0.005 / 0.030 |
| B1 flow partner (positive control) | k = 6 | 200 | 117 (0.85) | 0.535 (0.48 to 0.58; null 0.534 [0.490, 0.576]; p 0.488) | 0.611 (0.56 to 0.66; null 0.585 [0.562, 0.606]; p 0.010) | 0.567 / 0.650 | 4.03 / 3.45 | 0.435 | 0.000 / 0.077 | 0.000 / 0.176 | 0.000 / 0.045 |
| B1 flow partner (positive control) | both k | 400 | 223 (0.78) | 0.511 (0.47 to 0.55; null 0.534 [0.498, 0.563]; p 0.900) | 0.584 (0.55 to 0.62; null 0.586 [0.570, 0.601]; p 0.642) | 0.574 / 0.643 | 3.98 / 3.50 | 0.393 | 0.004 / 0.067 | 0.000 / 0.122 | 0.003 / 0.037 |
| B1 flow partner (positive control) | both k, trials touching a planted event or the end of the data left out | 269 | 140 (0.84) | 0.532 (0.48 to 0.58; null 0.538 [0.490, 0.584]; p 0.632) | 0.590 (0.54 to 0.64; null 0.584 [0.564, 0.600]; p 0.279) | 0.575 / 0.637 | 3.97 / 3.54 | 0.446 | 0.007 / 0.050 | 0.000 / 0.087 | 0.004 / 0.026 |
| B2 uniform partner (negative control) | k = 4 | 200 | 98 (0.73) | 0.432 (0.38 to 0.49; null 0.510 [0.460, 0.563]; p 1.000) | 0.494 (0.44 to 0.56; null 0.515 [0.489, 0.539]; p 0.970) | 0.489 / 0.504 | 4.58 / 4.47 | 0.300 | 0.000 / 0.061 | 0.000 / 0.000 | 0.000 / 0.030 |
| B2 uniform partner (negative control) | k = 6 | 200 | 131 (0.79) | 0.473 (0.43 to 0.52; null 0.499 [0.446, 0.548]; p 0.876) | 0.492 (0.44 to 0.54; null 0.500 [0.481, 0.522]; p 0.766) | 0.514 / 0.512 | 4.41 / 4.42 | 0.540 | 0.000 / 0.038 | 0.000 / 0.074 | 0.000 / 0.025 |
| B2 uniform partner (negative control) | both k | 400 | 229 (0.77) | 0.455 (0.41 to 0.49; null 0.504 [0.466, 0.540]; p 0.995) | 0.493 (0.45 to 0.53; null 0.507 [0.492, 0.523]; p 0.955) | 0.501 / 0.508 | 4.49 / 4.44 | 0.420 | 0.000 / 0.048 | 0.000 / 0.038 | 0.000 / 0.028 |
| B2 uniform partner (negative control) | both k, trials touching a planted event or the end of the data left out | 284 | 153 (0.84) | 0.443 (0.40 to 0.49; null 0.495 [0.453, 0.537]; p 0.995) | 0.462 (0.41 to 0.51; null 0.484 [0.463, 0.502]; p 0.995) | 0.490 / 0.501 | 4.57 / 4.50 | 0.423 | 0.000 / 0.039 | 0.000 / 0.000 | 0.000 / 0.021 |

Trials whose baseline or outcome window (start - 182 to start + 55) holds days of a planted event of the clone's own organism and flag in a unit other than A: B1 125, B2 109 of 400 each. Trials whose 56-day window runs past the end of the data (2026-09-27): B1 6, B2 11.

