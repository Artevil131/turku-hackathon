---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem (overnight run)
data: [synthetic_microbiology_dataset, seed 2026, as received 2026-10-09]
parent: 0008
---

# 0017 Does the improved Farrington algorithm on weekly counts, with and without down-weighting past outbreaks, find injected clusters at the live set's noise?

## Goal

0008 ran a simplified monthly Farrington test on THL's county counts and asked
whether to down-weight past outbreaks and fit a negative binomial. Method 11
of the brief is the improved algorithm (Noufaily et al. 2013) on weekly counts.
This runs it on the synthetic hospital and scores it on D1 to D7 and I1 beside
the live set as shipped and as re-tuned on year 1, with and without
Anscombe-residual down-weighting. Two limits, stated plainly. D2's matcher
credits only a signal for the injected unit, so a hospital-wide signal (ward
None) can never detect an injected cluster: the method runs on unit-level
series (unit × phenotype, unit × organism) for D1 to D7 and I1, and on
hospital-wide series per organism and phenotype for D4 and I1 only, D1 listed.
And the data hold three years, never the 3 to 5 reference years the method
assumes: adapted below.

## Hypothesis

This experiment is exploratory in PROTOCOL.md's sense: it describes how the
algorithm scores and supports no claim beyond its table. The yardstick is
METRICS.md "Decision rules": D5 at 5 episodes a year for the rare and the
common ESBL family, with D2's median delay at k = 4, against
`live-set-retuned-year1` (the reference: 0.92 and 0.75 at 3.0 episodes a year,
delay 6 and 6 days, computed, baseline row) and `live-set-shipped` (same D5,
tuned on test).

Directional expectation, so the table can contradict it. Weekly bins dilute a
14-day cluster: of 4 isolates, 3 or more share an ISO week in 0.50 of draws,
all 4 in 0.09 (derived, 50,000 simulated). A throwaway Poisson simulation with
known weekly means per unit and phenotype gives rare k = 4 at 0.76, 0.47, 0.29
and common ESBL k = 4 at 0.56, 0.29, 0.11 for tail levels 1e-2, 1e-3, 1e-4
(derived); fitted means and dispersions only fatten the tail. So:

1. At 5 episodes a year D5 is rare 0.30 to 0.60, common ESBL 0.10 to 0.40
   (assumed range), below the reference, intervals apart. Refuted if rare is
   0.80 or more or common ESBL 0.65 or more at 5 a year or less.
2. Median delay at k = 4 is 7 to 14 days (a week closes on its Sunday), against
   6 (assumed).
3. Down-weighting moves D2 and D5 by at most 0.02 and D4 by at most 1 episode a
   year: an injected trial's reference weeks hold no outbreak except E1 and E2
   (derived), so no gain is expected on these scores.
4. Common resistant and wild type at k = 4 stay at or below 0.05 (live 0.01 and
   0.00, computed, baseline row).

Described only: D1 to D7 and I1 per row, the year-1 table, hospital-wide D4,
the tail's calibration.

## Experiment

**Series.** Weekly counts per ISO week (Monday to Sunday); an event is a
patient's first isolate of the series in the trailing 365 days (as 0015 and
0016; proposed (overnight), pending Artem). *Unit scope* (D1 to D7, I1): unit ×
phenotype (esbl, mrsa, vre, cpe; 36, about 28 with events, weekly means 0.06
to 0.7, measured) and unit × organism (9 organisms, 81); at most 117.
*Hospital scope* (D1 listing, D4, I1): the 9 organisms and 4 phenotypes
hospital-wide, 13 series (weekly means *E. coli* 73, *S. aureus* 19, ESBL 3.3,
MRSA 0.7, measured). A week closes when the data hold a row dated its Sunday
or later; the signal is dated that Sunday, kind cluster, with `organism` or
`phenotype` set for D2's matcher.

**Statistic** per series and closed week t (derivation below): reference weeks
R_t, quasi-Poisson level, optional Anscombe down-weighting, μ0 and φ, then
p = P(Y ≥ y_t) under the negative binomial with mean μ0, variance φ μ0
(`aei.regional.upper_tail`, 0008's, reused unchanged). Tested when y_t ≥ 2
(0015's minimum count in place of Farrington's 5 cases in 4 weeks, which would
bar k = 4) and the reference has at least 13 weeks; μ0 floored at 0.5 / n_ref
(as 0008); no reset. All proposed (overnight), pending Artem.

**Reference designs** (b = 3 to 5 years cannot be had: a target needs 3 whole
years behind it and the data end at week 156; proposed (overnight), pending
Artem):

- T, trailing: the H weeks ending g weeks before t. Tunable on year 1.
- Y, year-back (Noufaily's windows): weeks t − 52j + k, |k| ≤ w = 3, j = 1 to
  b_eff, b = 2 (whole years behind t, at most 2): 7 or 14 weeks, season by
  window. First tested at week 55 (2024-10-21), so earlier-starting trials
  cannot detect; b_eff = 2 from 2025-10-13. Year 1 cannot tune it.
- S, seasonal GLM, hospital scope only: the last 104 weeks seen (at least 52),
  log μ = α + a sin(2πs/52) + b cos(2πs/52). Year 1 cannot tune it.
- No trend (Noufaily fits it only with 3 reference years).

**Year-1 grid and choice** (`tune_curve`): T with H in {26, 52} × g in {0, 4}
weeks × down-weighting {off, on, threshold 2.58}, 8 settings; Y and S fixed a
priori at b = 2, w = 3, both weightings, nothing chosen on a scoring number.
Levels (tail p): 3e-2, 1e-2, 3e-3, 1e-3, 3e-4, 1e-4, 3e-5, 1e-5, 1e-6. 40 rare
and 40 common ESBL clusters of k = 4, seed 2026, starts 2024-04-01 to
2024-08-15, the detector seeing no row after 2024-09-30 (26 to 45 weeks of
history, so H = 52 is truncated, as the live baselines were), noise over
2024-04-01 to 2024-09-30 scaled to a year (at most 2 episodes is under 5 a
year). Per setting, the loosest level with noise at most 5 a year (none: the
strictest); highest rare rate wins (ties: common ESBL, fewer episodes,
smaller H, g = 4). That setting and level are the headline row,
`tuned_on_test` false, `tuned_on` "2023-10-02..2024-09-30", `default_level`
that level, so D2 to D4, D6, D7, I1 are read there. D5's headline is the
harness's read-out of the scoring-period noise curve (no setting depends on
it), reported beside it with level and noise (review finding 12). Y and S rows
are read at the headline level.

**Seeds, baselines, metrics.** Seed 2026 only, 200 trials per cell from the
harness's stream; seeds 2027 to 2030 never used. Baselines
(benchmarks/overnight-2026-10-17/baselines/): `live-set-retuned-year1` (the
reference), `live-set-shipped` (`tuned-on-test`). Through `score_detector`:
unit-scope headline row (D1, D2, D4 to D7, I1; D3 left out, no data signals;
gap trials only here, for D6, D7); the other weighting at the same setting and
200 per cell (paired); Y, each weighting, 100 per cell (D1, D2, D4, D5, I1);
hospital scope, T at the headline setting, Y and S, each weighting, no trials
(D1, D4, I1). D1's matcher needs the unit, so a hospital-wide signal never
matches E1 or E2: the first one in each event's window is listed instead
(described, not scored); D4's zones key on a unit, so hospital-wide signals
inside E1 and E2 are listed, not excluded. Wilson 95 % per cell, exact
Poisson interval for D4.

**Checks.** `check_causal` on three midweek cuts (2025-03-26, 2025-12-31,
2026-06-30) for the headline detector, Y and hospital S; focused equals full
signals on 3 trials; closed form against `statsmodels` weighted GLM on 5
series; calibration on simulated negative binomial weeks (mean 0.1, 0.5, 5,
50, φ 1 and 2, n_ref 26 and 52, 20,000 weeks a cell) through the same code,
exceedance against α in {1e-2, 1e-3}.

**Budget.** 10 minutes of CPU (`aei.harness.Clock`), informational. Estimate
about 6 minutes (assumed): the level is closed form, a trial costs the
harness's cut and insert plus a scan of the focused series, about 18 ms
(assumed, from 0011 and 0016): 6,200 + 5,000 + 5,000 trials, 640 grid trials,
about 350 s with checks. Cut in this order, recorded under "Deviations from
plan": Y to 50 trials per cell; the pairing to 100 (pairing lost); S; the
H = 26 half of the grid.

**Command and outputs.**

    uv run python experiments/0017-farrington-noufaily/run.py

writes `out/results.md`, `out/metrics.json` (headline row, `D5_curve` top
level, `aei.harness.write_metrics`), `metrics-other-weighting`,
`metrics-yearback`, `metrics-yearback-other-weighting`, `metrics-hospital`
`.json` (hospital T row; its other five rows in `results.md`), `out/grid.json`
(year-1 rows) and `out/figure.png`. numpy, scipy,
pandas, statsmodels; the statistic is `farrington.py` beside `run.py`
(reusable: to `libs/utils/py/aei` with tests if Artem keeps it).

## Mathematical foundation

**Model.** Reference weeks s in R_t with counts Y_s: E Y_s = μ_s, Var Y_s =
φ μ_s (quasi-Poisson), log μ_s = α (T, Y) or α + a sin(2πs/52) + b cos(2πs/52)
(S). Farrington et al. (1996) add a linear trend; the level is fitted by
weighted quasi-likelihood (IRLS; for α alone μ̂ = Σωy / Σω) and φ̂ = max(1,
Σω(y − μ̂)²/μ̂ / (n − p)); the prediction for week t is μ0 = exp(α̂ at t).

**Down-weighting.** Fit with ω = 1; the standardised Anscombe residual of a
Poisson count r_s = 1.5 (y_s^(2/3) − μ̂_s^(2/3)) / (μ̂_s^(1/6) √(φ̂(1 − h_s))),
h_s the leverage (1/n at the first fit); ω_s = 1 if r_s ≤ 2.58, else
(2.58/r_s)²; refit once. As recalled (papers not re-read), Farrington et al.
use threshold 1 and scale ω to sum to n, Noufaily et al. 2.58; the unscaled
form, never raising a weight above 1, is proposed (overnight), pending Artem.
Aim: an earlier outbreak stops inflating the baseline and hiding the next
(E1's weeks 0, 0, 1, 5, 5, 6, 6, 5, measured, stay in a 52-week window until
mid-2026).

**Threshold.** y_t signals when it exceeds ν, the smallest integer with
P(Y ≤ ν) ≥ 1 − α, Y negative binomial, mean μ0, variance φ̂μ0 (size
μ0/(φ̂ − 1); Poisson at φ̂ = 1): Noufaily et al.'s quantile in place of
Farrington et al.'s 2/3-power normal limit, which needs large counts. That is
p = P(Y ≥ y_t) ≤ α, so one run gives every α. p is a monotone score, a
probability only if the model holds; the plug-in ignores the uncertainty of
μ̂; no multiplicity step.

**Assumptions and where it breaks.** (1) Poisson-like counts, one
multiplicative dispersion: the calibration check measures it. (2) Few events: 2
reference events in 52 weeks give plug-in P(Y ≥ 3) = 9.2e-6, a gamma-Poisson
with the same events 2.6e-5 (derived, 2.9 times); unit × phenotype series live
there, 0015's prior addresses it and this lacks it. Farrington's regime is
national counts of tens a week; hospital-wide series come closest. (3) φ̂ from
26 to 52 sparse points is noisy, floored at 1. (4) Season, trend: health-centre
monthly cultures run 184 to 302, peaking June to August (measured; PHC-S 2026:
201 in January, 302 in July); T lags the rise, Y and S follow it; three years
cannot support a trend. (5) An outbreak over a quarter of the window moves the
first-fit mean itself, so down-weighting removes too little. (6) No
multiplicity control: 117 series × 104 weeks is about 12,000 tests.

**References.** Farrington, Andrews, Beale and Catchpole 1996 (J. R. Stat.
Soc. A, "A statistical algorithm for the early detection of outbreaks of
infectious disease"); Noufaily, Enki, Farrington, Garthwaite, Andrews and
Charlett 2013 (Statistics in Medicine, "An improved algorithm for outbreak
detection in multiple surveillance systems"); Salmon, Schumacher and Höhle 2016
(J. Stat. Software, "Monitoring count time series in R"); McCullagh and Nelder
1989 (Generalized Linear Models); Anscombe 1953 (J. R. Stat. Soc. B).

## Why this method here

- It is public health's standard weekly detector, and 0008 used its monthly,
  simplified form on the regional map; the hospital feed would speak the same
  grammar, one expected value and one tail.
- 0008 asked for down-weighting and a negative binomial; E1's eight weeks of 5
  to 6 against 0.5 show what a plain baseline would carry afterwards.
- It is Poisson-family like the live tests but with a fitted dispersion and
  year-back windows, so it measures what those add on the same bursts; the
  hospital-wide series test whether its own regime sees what unit tests miss.
  Researcher: a weekly expected band per series. Doctor: nothing directly.

## Proposed visualisation

One card of the researcher's signal feed (OBJECTIVES.md: signal feed first),
light mode, URO × ESBL, weekly, 2025-01-06 to 2025-12-14 (as-of the last
week), one panel.

- Bars: weekly new patients, grey, count printed above; signal weeks filled
  dark with a square marker and p ("p = 3e-5").
- Step line: μ0 of each week as-of that week, a band for the Wald 95 %
  interval of μ̂ (the uncertainty the plug-in omits), and a dashed step for the
  threshold ν at the chosen level.
- Reference weeks of the last as-of shaded under the axis; those with ω < 0.5
  are hollow bars ("alipainotettu / down-weighted"): E1's weeks from
  2025-05-30, so the feature shows.
- Labels, Finnish first: "Viikkomäärä / weekly count", "Odotettu μ0 /
  expected", "Hälytysraja / alarm threshold", "Vertailuviikot / reference
  weeks"; unit names from `wards.csv`. Height carries counts, band
  uncertainty, fill and hatching alarms and weights; colour carries nothing
  alone.

The sketch `out/figure.png` draws it from the headline setting.

## Result

`uv run python experiments/0017-farrington-noufaily/run.py` ran in 51 s wall and
50 s of CPU (measured; budget 10 minutes, estimate about 6 minutes, assumed in
the plan: a trial cost 1 to 3 ms, not 18 ms, computed from about 23,000 fast-path
detector runs in about 45 s). No cut of the plan's cut order was made. Seed 2026
only, 200 trials per cell for the headline, paired and extra rows, 100 for the
year-back rows; seeds 2027 to 2030 unused. Counts, rates and episodes are
measured by the replay, intervals (Wilson 95 %, exact Poisson 95 %) computed;
anything else is tagged. `out/results.md` has every table and interval,
`out/metrics.json` the headline row, `out/figure.png` the card.

**Setting chosen on year 1 (measured; 40 rare + 40 common ESBL clusters of k = 4,
2024-04-01 to 2024-08-15, noise 2024-04-01 to 2024-09-30).** All eight settings
reached "noise at most 5 a year" only at tail level 1e-4 (1 to 2 episodes in the
half year); there rare clusters were found 4 to 6 of 40 and common ESBL 8 to 11 of
40. By the plan's rule the choice is trailing H = 26, g = 4, plain (6/40 and
11/40); the other seven are within sampling noise of it, and down-weighting
changed nothing in any of the four pairs. Year 1 was noisier than the scoring
period at the same level: the chosen setting at 1e-3 gave 9.98 episodes a year in
year 1 (5 episodes) against 4.52 on the scoring period (9 episodes), so the
year-1 level 1e-4 reads 0.50 a year (1 episode) on the scoring period, far
stricter than the 5 a year it was meant to meet. D2 to D4, D6, D7 and I1 of the
headline row are therefore at a very quiet operating point; the comparison that
matches noise is D5, and an extra row (not in the plan) reads the same setting at
D5's level 1e-3.

**D5 at about 5 episodes a year (k = 4; Wilson 95 %; delay in days).**

| row | level | noise a year (episodes) | rare | delay | common ESBL | delay |
|---|---|---|---|---|---|---|
| headline: trailing 26 wk, guard 4, plain | 1e-3 | 4.52 (9) | 0.310 [0.250, 0.377] | 6 | 0.240 [0.186, 0.304] | 6 |
| same, reweighted (paired) | 1e-3 | 4.52 (9) | 0.310 [0.250, 0.377] | 6 | 0.240 [0.186, 0.304] | 6 |
| year-back, plain (100 per cell) | 1e-3 | 3.52 (7) | 0.410 [0.319, 0.508] | 6 | 0.270 [0.193, 0.364] | 6 |
| year-back, reweighted (100 per cell) | 1e-3 | 3.52 (7) | 0.410 [0.319, 0.508] | 6 | 0.270 [0.193, 0.364] | 6 |
| live re-tuned year 1 (reference) | 0.3 x alphas | 3.01 (6) | 0.920 [0.874, 0.950] | 6 | 0.750 [0.686, 0.805] | 6 |
| live shipped (tuned on test) | 3 x alphas | 3.01 (6) | 0.920 [0.874, 0.950] | 6 | 0.750 [0.686, 0.805] | 6 |

Along the headline row's curve (noise a year, rare, common ESBL; measured): 62.8
(125 episodes) 0.825, 0.785 at 3e-2; 23.1, 0.615, 0.555 at 1e-2; 9.04, 0.420,
0.385 at 3e-3; 4.52, 0.310, 0.240 at 1e-3; 2.01, 0.230, 0.160 at 3e-4; 0.50, 0.180,
0.105 at 1e-4. Interpolated to exactly 5 a year: about 0.32 and 0.25 (derived).
The reference's common ESBL rate 0.75 is reached near 60 episodes a year; its
rare rate 0.92 is not reached at the loosest level.

**D2 at k = 3 and 4, rate (median delay in days).** Headline at its year-1 level
1e-4 (0.50 episodes a year), the same setting at D5's level 1e-3 (4.52 a year;
Wilson 95 % for k = 4), and the two live rows at their own operating levels (D4
over all kinds 9.55 and 4.52 episodes a year).

| family | k | headline 1e-4 | headline 1e-3 | live re-tuned | live shipped |
|---|---|---|---|---|---|
| rare | 3 | 0.055 (5) | 0.190 (5) | 0.860 (7) | 0.615 (7) |
| rare | 4 | 0.180 (6) | 0.310 [0.250, 0.377] (6) | 0.980 [0.950, 0.992] (5) | 0.890 [0.839, 0.926] (6) |
| common resistant | 3 | 0.000 | 0.015 | 0.020 (8) | 0.005 (23) |
| common resistant | 4 | 0.000 [0.000, 0.019] | 0.035 [0.017, 0.070] (10) | 0.010 [0.003, 0.036] (6) | 0.005 [0.001, 0.028] (25) |
| wild type | 3 | 0.005 (6) | 0.015 (1) | 0.005 (0) | 0.000 |
| wild type | 4 | 0.015 (7) | 0.035 [0.017, 0.070] (8) | 0.000 | 0.000 |
| common ESBL | 3 | 0.050 (6) | 0.125 (6) | 0.700 (6) | 0.345 (8) |
| common ESBL | 4 | 0.105 [0.070, 0.155] (6) | 0.240 [0.186, 0.304] (6) | 0.880 [0.828, 0.918] (6) | 0.610 [0.541, 0.675] (7) |
| two unit | 3 | 0.015 (4) | 0.130 (5) | 0.475 (4) | 0.210 (3) |
| two unit | 4 | 0.010 [0.003, 0.036] (6) | 0.160 [0.116, 0.217] (7) | 0.565 [0.496, 0.632] (7) | 0.240 [0.186, 0.304] (3) |

Controls (k = 0): 0.000 to 0.000 at 1e-4, 0.000 to 0.020 at 1e-3 (live: 0.000 to
0.075). The two-unit family sits near the common-resistant one: a cluster split in
two gives each unit 2 isolates, under the y of at least 2 and p filters.

**D4, D6, D7, I1, D1 (headline at 1e-4 / extra at 1e-3 / re-tuned / shipped).**
D4 episodes a year over 2024-10-01 to 2026-09-27: all 0.50 [0.01, 2.80] (1
episode, SURG) / 4.52 [2.07, 8.58] (9: ED 2, GER 3, MED-A 1, SURG 3) / 9.55
[5.75, 14.91] / 4.52 [2.07, 8.58]; the method raises only cluster signals (no
sentinel, data, trend or divergence kind), against 1.51 sentinel and 2.0 to 3.5
data episodes a year for the live rows. D6 0.004 [0.002, 0.010] / 0.014 [0.008,
0.023] / 0.026 / 0.012 (1,000 gap trials). D7 0.995 [0.974, 0.999] (218) / 0.998 /
0.987 / 0.974. I1 3 alerts in 3 incidents / 12 in 11 / 29 in 26 / 18 in 15. D1
(demonstration; delay in days from onset, at 1e-4): E1 18 (corrected onset 23), E2
5, E3 and E4 not found (data and trend kinds, not this method's); year-back E1 4
(9), E2 5; live re-tuned E1 0 (5), E2 0, E3 0; shipped E1 0 (5), E2 0, E3 0.

**Down-weighting (measured).** Plain and reweighted rows are identical in every
D2 cell, D4 count, D5 curve point at all nine levels, D1 and I1; the year-back
pair likewise. The Anscombe pass was almost never active: of 3,980 tested
unit-series windows of the real data at the headline H and g, 131 had one weight
below 1, none below 0.5, the lowest 0.642, and none of them was a URO x ESBL
window, so E1's weeks (5, 5, 6, 6, 5) were not down-weighted. At the last as-of
week of the figure (2025-12-14) the window holds those weeks with mean 1.42 and
fitted dispersion 3.33, the standardised residuals stay under 2.58, and the
threshold stays at 23 or 24 isolates a week (plain and reweighted alike), against 5
to 9 earlier in 2025 (measured, the figure).

**Year-back design (100 per cell).** D5 0.410 [0.319, 0.508] and 0.270 [0.193,
0.364] at 3.52 a year, against 0.310 and 0.240 at 4.52 a year for the trailing
headline; the intervals overlap. D4 at 1e-4 1.00 [0.12, 3.63] (SURG 1, PHC-N 1),
D1 E1 at 4 days. It is silent until week 55 (2024-10-21).

**Hospital scope (D4 and I1 only; 13 series).** Episodes a year at tail levels
1e-2 / 1e-3 / 1e-4 (count): trailing 5.53 (11) / 1.00 (2) / 1.00 (2) plain and 5.53
/ 1.51 / 1.00 reweighted; year-back 4.52 / 0.50 / 0.00; seasonal GLM 2.51 / 0.00 /
0.00. At 1e-4 the trailing design raised one E. coli signal in E1's window
(2025-06-29, p 6.4e-5, 25 days after 2025-06-04; hospital-wide signals are not
excluded by D4's zones, so it is one of its 2 episodes) and none for E2; year-back
and seasonal raised none at 1e-3. I1 2 alerts in 2 incidents (trailing), 0
otherwise. D2 and D5 are zero by construction and D1 cannot match E1 or E2 (ward
None).

**Checks (all passed).** `check_causal` at 2025-03-26, 2025-12-31 and 2026-06-30 on
the headline detector, year-back and hospital S built from the rows they are given:
no differences. Fast path against a run from the rows given, focused against
unfocused and filtered as the harness's matcher does, 3 rare, 3 two-unit and 3 gap
trials: no differences. Closed form against statsmodels weighted GLM on 9
reference windows (two with inserted outbreak weeks, 2 weights below 1): largest
differences 1.4e-14 in mu0, 1.6e-15 in phi, 2.2e-16 in weights; design S IRLS
against statsmodels, 1.1e-15 relative. Calibration on simulated negative
binomial weeks (20,000 a cell): with known Poisson counts the plug-in tail is
conservative (share with p below 1e-2: 0.0029 to 0.0075; below 1e-3: 0.0004 to
0.0012); with overdispersion 2 it is anti-conservative: 0.010 to 0.017 below 1e-2
and 0.0014 to 0.0102 below 1e-3, worst (10 times nominal) at mean 0.1 and 26
reference weeks, still 3.3 times at mean 50 and 26 weeks.

**Deviations from plan.**

- Design Y is tested from week 55 with its 7 weeks (the plan's 13-week minimum is
  for T and S), and b_eff = 2 starts at week 107, 2025-10-20; the plan's
  "2025-10-13" is a slip, the rule t - 52j - 3 >= 0 gives 107.
- Design S fits the harmonic only when the reference holds at least 20 events,
  otherwise the level alone (VRE and CPE hospital-wide).
- Extra row, not in the plan: the headline setting read at D5's level 1e-3
  (`metrics-noise-matched.json`), and the count of how often down-weighting acts,
  because the year-1 level gave 0.50 episodes a year on the scoring period.
- The statsmodels check used 9 windows, 2 with inserted outbreak weeks, not 5
  real ones: the real windows had no weight below 1, so the Anscombe step was
  untested by them.
- The headline setting is plain, so the figure (as the plan describes, drawn
  from the headline setting) shows no hollow bar: the lowest weight at the last
  as-of week is 1.00, and the threshold is clipped at the top of the axis.
- CPU far below the estimate; no cut was made.

## Interpretation

Against METRICS.md "Decision rules" the algorithm does not reach the live set. At
about 5 episodes a year (4.52, 9 episodes) D5 is rare 0.310 [0.250, 0.377] and
common ESBL 0.240 [0.186, 0.304], against 0.920 and 0.750 at 3.0 for the
reference, intervals far apart; the reference's common ESBL rate needs about 60
episodes a year from this method and its rare rate is not reached at any level
swept. In the rare, common ESBL and two-unit families every D2 cell from k = 3 up
is below the reference and below the shipped row. In the two families no count
test sees, it is no better: common resistant 0.035 and wild type 0.035 at k = 4
(live 0.010 and 0.000). Delay is the same, 6 days. It raises no data, sentinel,
trend or divergence signals, so its D4 is only the cluster kind and its D6 and I1
are not comparable with a tool that also raises them. This is screening, not
selection: one seed, held-out seeds unused, a result beside 0015 and 0016 and not
a winner.

Hypotheses (exploratory, as written in the plan). (1) Held: rare 0.310 and common
ESBL 0.240 sit inside the assumed ranges (0.30 to 0.60 and 0.10 to 0.40), rare at
the lower edge, below the reference with disjoint intervals, and not refuted (the
refutation bars were 0.80 and 0.65). (2) Refuted: median delay at k = 4 is 6 days
for both families, under the predicted 7 to 14. The delay is a median over the
trials that were detected, which are the ones where 3 or more isolates landed in
the first closed week. (3) Held in a trivial sense: down-weighting moved nothing,
because it never acted on E1 (above). The plan's reason for the feature, that E1's
five weeks of 5 to 6 would keep inflating a plain baseline, is true (the
threshold sits at 23 to 24 for months, figure) but the Anscombe step as specified
does not remove it: the outbreak is a quarter of a 26-week window, so it inflates
the dispersion that standardises its own residuals (derived: at the last as-of
week mean 1.42, dispersion 3.33, so a count of 6 has a standardised residual
under 2.58). (4) Held: common resistant 0.000 and wild type 0.015 at k = 4 at the
year-1 level, 0.035 and 0.035 at D5's level, all at or under 0.05.

Strongest alternative explanation of the gap: structure, not the Farrington
family. A cluster of 4 over 14 days puts 3 or more in one ISO week only half the
time (derived, plan), and the method sees a phenotype or an organism per unit,
never the 13-drug profile the live profile test uses (the same information
argument as 0016). A throwaway Poisson simulation with the true mean known gave
rare k = 4 0.47 at 1e-3 (plan, derived); the measured 0.310 at that level is below
it, the cost of fitting a mean and a dispersion from 26 sparse weeks, which the
calibration shows as a heavier real tail at overdispersion 2 and a lighter one
for Poisson counts. Second, the setting choice rests on 1 to 2 year-1 episodes and
40 + 40 trials: all eight settings chose the same level, 4 to 6 of 40 rare
clusters separate nothing, and year 1 was twice as noisy as the scoring period at
equal level, so the plan's operating level was too strict by a factor near 10 and
the D2 to D7 cells at 1e-4 describe a very quiet detector. D5, level-matched, is
not affected. Third, the trailing and the year-back design are not separated
(0.310 and 0.240 against 0.410 and 0.270, intervals overlapping, the latter at 100
trials a cell), and the health centres' summer volume peak shows in no unit's
episode count (ED 2, GER 3, MED-A 1, SURG 3, none for PHC at 1e-3), so the plan's
seasonal reason for design Y is untested here, not refuted.

What this says for the hospital-wide use the brief assumed: the series that suit
the algorithm (counts of tens a week) did raise 1 to 1.5 episodes a year at 1e-3
(trailing; E1 shows once, in E. coli, 25 days after its start), fewer than 1 for
year-back, 0 for the seasonal GLM, and none of this can find an injected cluster
because the harness credits a unit; a hospital-wide injection (a cluster
spread over several units, or a rise in a large organism) would be the fair test
of that scope, and the harness does not have one.

Next. (1) Put 0015's Gamma prior inside the Farrington baseline (or the delta-method
variance of the fitted mean) so the sparse unit series have an honest tail, and
compare with the 0015 result at the same noise. (2) Evaluate every day on the
trailing 7 days (reference weeks aligned to the day) to remove the Sunday-bin
dilution and the weekly delay. (3) A weight rule that can act on an 8-week
outbreak (a robust dispersion, median or 52-week, in the standardised residual)
and a test on an E1-like injected outbreak followed by a second cluster, the case
the feature is for and the harness does not inject. (4) A hospital-wide injection
family for D2, so that hospital scope can be scored. (5) Nothing here changes the
live tool.
