---
status: proposed    # proposed, then accepted, rejected or superseded
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

## Interpretation
