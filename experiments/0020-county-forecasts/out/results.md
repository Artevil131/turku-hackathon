# 0020 results

One-month-ahead forecasts of THL's MRSA, ESBL, VRE and CPE series, 23 counties and the national totals, scoring targets 2024-10 to 2026-09 (24 months), THL as fetched 2026-10-17 (final values, not strictly as-of; the last two months are incomplete, see the `no_last2` rows). Every number is computed by this run unless it is labelled as a committed baseline row.

Run time 2.1 s (wall)

Run time 2.1 s (CPU)

## Tuning, targets 2024-01 to 2024-09 only

Nine months, 92 county series, 198 cells. Mean log score per county series-month on these months: persistence -1.9503, seasonal naive -2.1345 (harness baselines, computed).

**R1, selected on the pooled county log score:** W24 K0 trend=off rho=0 quasi_pooled floor=0.1. Tuning score -1.5729; the best cell scored -1.5642 (W36 K0 trend=on rho=1 quasi_pooled floor=0.1); 8 of 198 cells were within one standard error of the best and eligible.

Top 12 cells by tuning score (full table in `tuning.csv`):

| rank | cell | tuning log score | se of difference to best | eligible |
|---|---|---|---|---|
| 1 | W36 K0 trend=on rho=1 quasi_pooled floor=0.1 | -1.5642 | 0.0000 | yes |
| 2 | W36 K0 trend=on rho=1 quasi_pooled floor=0.02 | -1.5664 | 0.0052 | yes |
| 3 | W36 K0 trend=on rho=1 quasi floor=0.1 | -1.5722 | 0.0060 | no |
| 4 | W24 K0 trend=off rho=0 quasi_pooled floor=0.1 | -1.5729 | 0.0169 | yes |
| 5 | W36 K0 trend=on rho=1 quasi floor=0.02 | -1.5737 | 0.0077 | no |
| 6 | W24 K0 trend=off rho=0 quasi_pooled floor=0.02 | -1.5755 | 0.0162 | yes |
| 7 | W36 K1 trend=on rho=1 quasi_pooled floor=0.1 | -1.5755 | 0.0131 | yes |
| 8 | W24 K0 trend=off rho=0 quasi floor=0.1 | -1.5773 | 0.0192 | yes |
| 9 | W36 K1 trend=on rho=1 quasi_pooled floor=0.02 | -1.5777 | 0.0178 | yes |
| 10 | W24 K0 trend=off rho=0 quasi floor=0.02 | -1.5792 | 0.0180 | yes |
| 11 | W36 K0 trend=on rho=0 quasi_pooled floor=0.1 | -1.5831 | 0.0069 | no |
| 12 | W36 K1 trend=on rho=1 quasi floor=0.1 | -1.5840 | 0.0147 | no |

Spread of the tuning table: tuning scores of the top 12 cells span -1.5840 to -1.5642; the worst of 198 cells scored -1.8598.

**R2, one cell per phenotype (same rule on its 23 counties):**

| phenotype | cell | tuning log score | eligible cells |
|---|---|---|---|
| MRSA | W24 K0 trend=off rho=0 quasi_pooled floor=0.5 | -2.2279 | 9 |
| ESBL | W24 K0 trend=off rho=0 poisson floor=0.5 | -3.1098 | 30 |
| VRE | W36 K0 trend=off rho=0 quasi floor=0.02 | -0.2916 | 24 |
| CPE | W36 K0 trend=off rho=0 poisson floor=0.1 | -0.7318 | 24 |

## R1 on the scoring targets: P2 keys

R1 = W24 K0 trend=off rho=0 quasi_pooled floor=0.1. Intervals: 95 %, 1,000 bootstrap resamples of target months, seed 2026. Skill against persistence unless named; log-score skill in nats per series-month (higher is better); MAE skill is 1 - MAE / MAE of persistence.

| key | value | 95 % interval | n |
|---|---|---|---|
| mae | 2.1671 | 1.9964 to 2.3759 | 2,208 |
| log_score | -1.7279 | -1.7985 to -1.6677 | 2,208 |
| mae_skill | 0.144 | 0.063 to 0.213 | 2,208 |
| log_skill | 0.402 | 0.309 to 0.482 | 2,208 |
| mae_skill_seasonal | 0.219 | 0.159 to 0.272 | 2,208 |
| log_skill_seasonal | 0.793 | 0.660 to 0.933 | 2,208 |
| MRSA_mae_skill | 0.217 | 0.145 to 0.276 | 552 |
| MRSA_log_skill | 0.620 | 0.453 to 0.804 | 552 |
| ESBL_mae_skill | 0.092 | -0.034 to 0.189 | 552 |
| ESBL_log_skill | 0.519 | 0.280 to 0.742 | 552 |
| VRE_mae_skill | 0.200 | -0.007 to 0.429 | 552 |
| VRE_log_skill | 0.250 | 0.165 to 0.332 | 552 |
| CPE_mae_skill | 0.286 | 0.192 to 0.376 | 552 |
| CPE_log_skill | 0.219 | 0.160 to 0.276 | 552 |
| national_mae_skill | -0.126 | -0.489 to 0.134 | 96 |
| national_log_skill | 1.548 | 0.809 to 2.335 | 96 |
| mae_skill_no_last2 | 0.150 | 0.064 to 0.226 | 2,024 |
| log_skill_no_last2 | 0.408 | 0.313 to 0.501 | 2,024 |

### Raw scores against the two baseline rows

MAE of the predictive median and mean log score per series-month, R1 against the harness's persistence and seasonal naive (equal to the committed baseline rows to 6 digits, checked).

| group | n | MAE R1 | MAE persistence | MAE seasonal naive | log R1 | log persistence | log seasonal naive |
|---|---|---|---|---|---|---|---|
| pooled | 2,208 | 2.167 | 2.533 | 2.774 | -1.728 | -2.130 | -2.521 |
| MRSA | 552 | 2.538 | 3.241 | 3.339 | -2.335 | -2.955 | -3.192 |
| ESBL | 552 | 5.551 | 6.112 | 6.938 | -3.375 | -3.894 | -5.105 |
| VRE | 552 | 0.217 | 0.272 | 0.272 | -0.477 | -0.728 | -0.805 |
| CPE | 552 | 0.362 | 0.507 | 0.545 | -0.725 | -0.943 | -0.981 |
| national | 96 | 24.010 | 21.323 | 29.792 | -4.160 | -5.708 | -7.679 |

Seasonal naive's own skill against persistence (committed row, log score): pooled -0.391 (-0.551 to -0.233); persistence's pooled MAE 2.5331, log score -2.1300.

## Secondary rows (descriptive; none can replace R1)

| row | setting | MAE skill pooled | log skill pooled | log skill without the last 2 months | log skill MRSA | ESBL | VRE | CPE | national |
|---|---|---|---|---|---|---|---|---|---|
| R1 | W24 K0 trend=off rho=0 quasi_pooled floor=0.1 | +0.144 (+0.063 to +0.213) | +0.402 (+0.309 to +0.482) | +0.408 (+0.313 to +0.501) | +0.620 | +0.519 | +0.250 | +0.219 | +1.548 |
| R2 | MRSA: W24 K0 trend=off rho=0 quasi_pooled floor=0.5; ESBL: W24 K0 trend=off rho=0 poisson floor=0.5; VRE: W36 K0 trend=off rho=0 quasi floor=0.02; CPE: W36 K0 trend=off rho=0 poisson floor=0.1 | +0.149 (+0.070 to +0.220) | +0.301 (+0.180 to +0.394) | +0.309 (+0.187 to +0.414) | +0.618 | +0.119 | +0.253 | +0.211 | +0.328 |
| R3 | W24 K1 trend=off rho=0 quasi_pooled floor=0.1 | +0.130 (+0.051 to +0.195) | +0.339 (+0.245 to +0.419) | +0.350 (+0.260 to +0.440) | +0.573 | +0.407 | +0.194 | +0.182 | +1.483 |
| R4 | W24 K0 trend=off rho=0 poisson floor=0.1 | +0.152 (+0.072 to +0.222) | +0.262 (+0.148 to +0.357) | +0.274 (+0.168 to +0.381) | +0.513 | +0.119 | +0.199 | +0.215 | -0.342 |

R3 changes K only (R1's K = 0, or K = 1 if R1 has none); R4 changes the dispersion only (Poisson, or pooled quasi-Poisson if R1 is Poisson). Per-phenotype MAE skill of R1: MRSA +0.217, ESBL +0.092, VRE +0.200, CPE +0.286, national -0.126.

Differences between rows, pooled over the 92 county series (R1 minus the row; mean over the 24 target months, 95 % bootstrap interval over months, seed 2026; computed here from the harness's per-series scores, not a P2 key). Log score: positive favours R1; MAE: negative favours R1.

| comparison | log score difference | MAE difference |
|---|---|---|
| R1 minus R2 | +0.102 (+0.063 to +0.144) | +0.010 (-0.009 to +0.029) |
| R1 minus R3 | +0.063 (+0.035 to +0.094) | -0.037 (-0.119 to +0.051) |
| R1 minus R4 | +0.140 (+0.102 to +0.186) | +0.019 (-0.002 to +0.039) |

## Diagnostics for R1 (descriptive, not P2 metrics)

Share of observed counts inside the 90 % predictive interval [q05, q95] (a discrete interval over-covers when the mean is small; target about 0.90 for series with a window mean of at least 5 cases a month):

| group | all series-months | n | window mean at least 5 | n |
|---|---|---|---|---|
| pooled | 0.939 | 2,208 | 0.884 | 691 |
| MRSA | 0.918 | 552 | 0.867 | 173 |
| ESBL | 0.893 | 552 | 0.890 | 518 |
| VRE | 0.966 | 552 | – | 0 |
| CPE | 0.980 | 552 | – | 0 |
| national | 0.885 | 96 | 0.890 | 73 |

Fit status over the series-months (guards and the sparse-window rule; `fit` includes the level-only model when the cell has K = 0 and no trend):

| group | fit | sparse | no_converge | explosion | empty |
|---|---|---|---|---|---|
| pooled | 2,074 | 0 | 0 | 0 | 134 |
| MRSA | 552 | 0 | 0 | 0 | 0 |
| ESBL | 552 | 0 | 0 | 0 | 0 |
| VRE | 438 | 0 | 0 | 0 | 114 |
| CPE | 532 | 0 | 0 | 0 | 20 |
| national | 96 | 0 | 0 | 0 | 0 |

The same for R3 (K = 1, no trend, window 24, rho = 0): the only scored row that fits harmonics, so the only one where non-convergence or the explosion guard can bind:

| group | fit | sparse | no_converge | explosion | empty |
|---|---|---|---|---|---|
| pooled | 1,907 | 0 | 167 | 0 | 134 |
| MRSA | 552 | 0 | 0 | 0 | 0 |
| ESBL | 552 | 0 | 0 | 0 | 0 |
| VRE | 318 | 0 | 120 | 0 | 114 |
| CPE | 485 | 0 | 47 | 0 | 20 |
| national | 96 | 0 | 0 | 0 | 0 |

## Checks

- Fitter against `aei.regional.expected_month` (statsmodels, W = 36, trend, K = 1), before floor and guards: 488 (series, target) pairs with at least 20 cases in the window on the tuning targets (0 skipped as not converged); largest relative difference 2.2e-10 in the forecast mean, 2.6e-10 in phi.
- Baseline rows reproduced: largest relative difference to the committed rows 2.3e-06 (6 significant digits stored).
- `audit_strict` (history poisoned from the target on) passed for R1 to R4.
- Mean fits: 24,768 series fitted in total (shared across cells by a cache).
