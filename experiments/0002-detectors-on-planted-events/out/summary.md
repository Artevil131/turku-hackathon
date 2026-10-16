# 0002 summary

Delay: days from the event's start to the detector's first signal for it ("–": never). E4 has no start date, so its first signal date is shown. Other episodes: signal episodes (same detector and key, gaps of at most 28 days) that match no planted event, over 2.99 years. All computed.

- E1: Urology ESBL E. coli, from 2025-06-04
- E2: ICU MRSA, from 2026-03-03
- E3: No samples at PHC-S, 2025-12-08 to 12-14
- E4: Urinary E. coli trimethoprim rising

| detector | setting | E1 delay | E2 delay | E3 delay | E4 delay | other episodes | per year |
|---|---|---|---|---|---|---|---|
| 1 profile rule | k 3, 14 d, all patients | 0 d | 4 d | – | – | 305 | 102.0 |
| 1 profile rule | k 3, 14 d, day 3+ only | 3 d | 12 d | – | – | 106 | 35.5 |
| 1 profile rule | k 3, 28 d, all patients | 0 d | 4 d | – | – | 412 | 137.8 |
| 1 profile rule | k 3, 28 d, day 3+ only | 3 d | 12 d | – | – | 126 | 42.1 |
| 1 profile rule | k 4, 14 d, all patients | 0 d | 6 d | – | – | 152 | 50.8 |
| 1 profile rule | k 4, 14 d, day 3+ only | 6 d | 15 d | – | – | 49 | 16.4 |
| 1 profile rule | k 4, 28 d, all patients | 0 d | 6 d | – | – | 225 | 75.3 |
| 1 profile rule | k 4, 28 d, day 3+ only | 6 d | 15 d | – | – | 70 | 23.4 |
| 2 profile excess | alpha 0.01 | 0 d | 4 d | – | – | 92 | 30.8 |
| 2 profile excess | alpha 0.001 | 0 d | 4 d | – | – | 29 | 9.7 |
| 2 profile excess | alpha 0.0001 | 0 d | 4 d | – | – | 11 | 3.7 |
| 2b profile excess, share within specimen | alpha 0.01 | 0 d | 6 d | – | – | 56 | 18.7 |
| 2b profile excess, share within specimen | alpha 0.001 | 0 d | 6 d | – | – | 10 | 3.3 |
| 2b profile excess, share within specimen | alpha 0.0001 | 0 d | 6 d | – | – | 3 | 1.0 |
| 3 phenotype excess | alpha 0.01 | 3 d | 2 d | – | – | 14 | 4.7 |
| 3 phenotype excess | alpha 0.001 | 4 d | 4 d | – | – | 6 | 2.0 |
| 3 phenotype excess | alpha 0.0001 | 6 d | 6 d | – | – | 2 | 0.7 |
| 4 sampling drop | alpha 0.01 | – | – | 2 d | – | 53 | 17.7 |
| 4 sampling drop | alpha 0.001 | – | – | 2 d | – | 11 | 3.7 |
| 4 sampling drop | alpha 0.0001 | – | – | 3 d | – | 3 | 1.0 |
| 5 resistance shift | alpha 0.01 | 4 d | 5 d | – | – | 42 | 14.0 |
| 5 resistance shift | alpha 0.001 | 11 d | 12 d | – | – | 1 | 0.3 |
| 5 resistance shift | alpha 0.0001 | 11 d | 12 d | – | – | 0 | 0.0 |
| 6 rising trend | alpha 0.01 | – | – | – | 2024-09-29 | 6 | 2.0 |
| 6 rising trend | alpha 0.001 | – | – | – | 2025-09-28 | 2 | 0.7 |
| 6 rising trend | alpha 0.0001 | – | – | – | 2026-02-15 | 1 | 0.3 |

Sweep time: 15.0 s.
