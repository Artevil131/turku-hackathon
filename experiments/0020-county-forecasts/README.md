---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem (overnight run)
data: [thl-ttr-cases fetched 2026-10-17 by scripts/fetch_thl_ttr.py, months 2021-01 to 2026-09]
parent: 0008
---

# 0020 Does a rolling Poisson GLM with annual harmonics forecast THL's county counts one month ahead better than last month's count?

## Goal

OBJECTIVES.md ("Across Finland") says a county forecast ships only if it
beats the baseline "next month equals this month"; otherwise the map
shows pressure and calls it pressure, not prediction. This is method 24
of the overnight brief (metric P2 of benchmarks/METRICS.md), cut by
Artem's addendum of 01:15 to three models: persistence and seasonal
naive (the harness baselines) and a Poisson GLM with annual harmonics,
fitted per series on a rolling window of past months, with an
over-dispersed predictive distribution. It is the simplest fitted model
that gives an interval, and it is the endemic part of the
endemic-epidemic model of OBJECTIVES.md with the neighbour term set to
zero (Mathematical foundation, assumption 7). The question is whether
it beats persistence, on 24 months of real THL data, for MRSA, ESBL, VRE
and CPE in the 23 counties.

The answer decides whether the researcher's flat county map gets a "next
month" layer with an uncertainty view, or shows last month's count only,
and it sets the rung that every later county model must beat. It changes
nothing in the live tool; Artem decides in the morning.

## Hypothesis

This experiment is exploratory in PROTOCOL.md's sense: one model family,
one scoring period of 24 months, settings tuned on nine months. It
supports no claim beyond its table. The yardstick is METRICS.md
"Decision rules" with OBJECTIVES.md: P2 skill against persistence, and
"beats the baseline" means that the 95 % bootstrap interval of the skill
lies wholly above zero.

What is described: P2 skill (MAE of the predictive median, mean log
score) against persistence and against seasonal naive, pooled, per
phenotype and for the national totals; which setting the tuning months
chose and how flat the tuning table is; whether skill comes from the
level, the seasonality or the width of the predictive (two ablations,
planned below); how often the sparse-window rule and the guards bound;
and how often the observed count falls inside the 90 % predictive
interval. THL revises recent months and the newest two months of the
fetch are incomplete, so every number is against final series, not
strictly as-of; the harness also reports skill without the last two
months (the `_no_last2` keys), and both are read.

Directional expectation, written before any run and not derived from any
run of this model (assumed; it rests on the plug-in argument in
Mathematical foundation, "What skill measures", and on the committed
baseline rows):

1. Pooled log-score skill against persistence is positive, about
   +0.2 nats per series-month, with the interval above zero. A
   persistence forecast uses one noisy count as its mean and ignores
   over-dispersion; a window estimate removes most of that noise.
2. Pooled MAE skill against persistence is positive, about +0.1, with
   the interval above zero (the stationary Poisson bound is about +0.3,
   derived; surges and level shifts take most of it away).
3. The log-score skill is largest for ESBL and for the national totals
   (large counts, over-dispersion that persistence's Poisson ignores)
   and smallest for VRE and CPE (mostly zero or one case a month), where
   its interval may include zero.
4. Against seasonal naive both skills are positive in every group,
   because seasonal naive is itself worse than persistence in the
   committed rows (log skill −0.391, interval −0.551 to −0.233, computed).

Supported when both pooled skills against persistence (log score and
MAE) have their interval wholly above zero, with and without the last
two months. Refuted when both intervals include zero or lie below it.
Anything else (one skill above zero and the other not, or a different
answer with and without the last two months) is reported as split, and
nothing is claimed beyond the interval. Expectations 3 and 4 are read
against their own words and do not decide the hypothesis.

## Experiment

**Data.** `data/external/thl/ttr_monthly.csv` as fetched 2026-10-17 by
`scripts/fetch_thl_ttr.py` (THL communicable disease register, CC BY
4.0, D-025). The series come from `aei.score_prediction.county_series`:
four phenotype series per region, each the sum of THL's report groups
for it (MRSA: carriage, blood/CSF; ESBL: carriage and blood/CSF for *E.
coli* and *K. pneumoniae*; VRE: carriage, blood/CSF; CPE: the three
carriage groups), for the 23 wellbeing services counties plus the
national total, 96 series, months 2021-01 to 2026-09 (69 months, the
month of the fetch left out). A report group missing for a county and
month counts as zero. No other filter. THL's years before 2021 are not
used (the harness starts at 2021-01). A forecaster receives only the
months before its target (`History`), never the file.

**Models.**

- Persistence and seasonal naive: the harness's own, Poisson at last
  month's count and at the count 12 months back, mean floored at 0.5
  (harness-spec.md, Choices 6). Not re-implemented.
- Poisson GLM, per series and target month t, fitted on the window of
  the W months before t: log mean = level + optional linear trend + K
  annual harmonics; predictive distribution a negative binomial with
  the window's dispersion (Mathematical foundation gives the formulas).
  Code: `glm_forecast.py` here, a numpy Fisher-scoring fit, checked
  against 0008's statsmodels fit (below), and `run.py`. Utils used:
  `aei.score_prediction` (series, scoring, audit), `aei.harness` (Clock,
  `write_metrics`) and `aei.regional.expected_month` (the check only).

**Grid.** Every combination, 198 cells (22 fit settings × 9 predictive
settings; the mean model is fitted once per fit setting and shared by
the 9 predictive settings):

| Setting | Values |
|---|---|
| Window W, months before the target | 24, 36 (36 is 0008's) |
| Annual harmonics K | 0, 1, 2 (K = 0 with no trend is a rolling mean) |
| Linear trend in the log mean | off, on |
| Sparse-window rule ρ | 0 (never), 1: a window averaging under 1 case a month is fitted with the level only |
| Dispersion | `poisson` (φ = 1); `quasi` (φ̂ per series); `quasi_pooled` (φ̂ pooled over the 23 counties of a phenotype; the national series keeps its own) |
| Floor f on the predictive mean | 0.02, 0.1, 0.5 (0.5 is the baselines' floor) |

(2 × 3 × 2 × 2 = 24 fit settings, 2 of them identical because ρ changes
nothing when the model is the level alone, leaving 22.)
Guards, not tuned: a fit that has not converged in 30 steps, or whose
mean for the target exceeds 3 × max(1, the window's largest count), is
replaced by the level-only fit; an empty window gives mean f and φ = 1.
Each use is counted and reported.

**Tuning (targets before 2024-10 only).** Targets 2024-01 to 2024-09,
nine months, the first with a full 36-month window from 2021-01. Every
cell is scored on them through `score_prediction.run_forecaster`; the
tuning score of a cell is the mean log score over the 92 county series
(828 county series-months, derived). Stage 1 of `run.py` touches no
month from 2024-10 on (a forecaster's history for the last tuning target
ends 2024-08) and writes `out/tuning.csv` and `out/selected.json` before
stage 2 runs.

*Selection, one-standard-error rule.* Let S(c) be the mean tuning score
of cell c and c* the best. For each cell, d(m) = S(c*, m) − S(c, m) over
the nine months m and se(c) = sd(d) / 3. A cell is eligible when
S(c*) − S(c) ≤ se(c). Among the eligible cells the simplest wins, by
this order: fewest mean parameters (1 + trend + 2K), then dispersion
(`poisson`, `quasi_pooled`, `quasi`), then ρ = 0 over 1, then the longer
window, then the larger floor. The months are not independent, so the
standard error is optimistic; the full table with the standard errors is
reported so the flatness of the surface is visible.

**Rows scored on the scoring targets, 2024-10 to 2026-09 (24 months,
2,208 county series-months, 96 national).** Fixed by this plan, not by
their scores:

| Row | Settings | Role |
|---|---|---|
| R1 | the one cell selected on the 92 county series | the record's row: `out/metrics.json` |
| R2 | one cell per phenotype, same rule on its 23 counties (its national series uses that cell) | secondary, `out/results.md` |
| R3 | R1 with K = 0 (K = 1 if R1 has K = 0) | ablation: is it seasonality or only smoothing |
| R4 | R1 with `poisson` (with `quasi_pooled` if R1 is `poisson`) | ablation: is it the mean or the predictive width |

R2 to R4 are descriptive and cannot replace R1. If any setting is
changed after a scoring-period number has been seen, `tuned_on_test` is
set true and the record says what changed.

**Baseline rows compared with.**
`benchmarks/overnight-2026-10-17/baselines/county-persistence.json`
(pooled MAE 2.533, mean log score −2.130, computed) controls for "nothing
changes", OBJECTIVES.md's baseline; `county-seasonal-naive.json` (2.774,
−2.521, computed) controls for the seasonal pattern without any fitting
or smoothing. Neither fits anything, so neither is tuned. The harness
recomputes both on the same targets; the run asserts that they equal the
committed rows to the 6 digits stored.

**Metrics and spread.** Every P2 key of harness-spec.md, from
`score_prediction.score_forecaster` (strict-as-of audit on, interval
95 % from 1,000 bootstrap resamples of target months, seed 2026):
`mae`, `log_score`, skill against persistence for MAE (1 − MAE / MAE of
persistence) and for the log score (difference in mean log score, nats
per series-month), the same against seasonal naive, per phenotype
(552 series-months each), national (96), and without the last two months
(2,024). Nothing else is reported as a P2 metric. Descriptive extras,
labelled as such, computed from the quantiles the forecaster records
(5, 50, 95 %): the share of observed counts inside the 90 % predictive
interval, overall and for series whose window mean is at least 5 cases
a month (the interval of a discrete distribution over-covers when the
mean is small); the counts of guard and fallback uses. The model itself
is deterministic (no seed); the only randomness is the bootstrap.

**Checks the run makes and records.** (1) The fitter reproduces
`aei.regional.expected_month` (0008's statsmodels fit: W = 36, linear
trend, K = 1) in mean and φ̂, before floor and guards, to 1e-6 relative
on every 50th (series, target) pair of the tuning targets whose window
has at least 20 cases.
(2) `audit_strict` passes for every row. (3) The baseline rows are
reproduced (above).

**Budget.** 10 minutes of CPU, measured with `harness.Clock`. Estimate,
not yet measured: at most 19,000 fits in tuning, 7,000 in scoring and
2,300 in the audits, at 0.3 to 1 ms each in numpy, plus about 171,000
predictive evaluations in tuning at about 0.2 ms: about 2 minutes, range
1 to 4. If the first 200 fits project over 8 minutes, cut in this order
and record it under Deviations from plan: R3 and R4, then R2, then the
K = 2 cells, then the W = 24 cells. R1, ρ and the dispersion and floor
settings are never cut.

**Out of scope tonight.** Negative binomial INGARCH, the endemic-epidemic
model with the university-hospital catchment tree, gravity and radiation
flow matrices, the Gaussian process over county × month and the
hierarchical Bayesian Poisson are not run; they appear under
Interpretation as next steps only. Horizons beyond one month are not
scored.

**Choices.** DECISIONS.md and METRICS.md fix: Python and its libraries
(D-024, D-030), the THL data (D-025), and P2 (targets, baselines, split,
bootstrap; METRICS.md, proposed by Artem 2026-10-17, and
harness-spec.md Choices 6, proposed by Claude Code, both pending). Every
other statistical choice here is proposed (overnight), pending Artem: the
model class and the numpy fitter; each grid value (W, K, trend, ρ, the
three dispersion estimators, the three floors); the Pearson estimator of
φ̂ and its pooling; the negative-binomial form of the predictive; the
two guards and their constants (30 steps, 3 times the largest count);
tuning on the pooled county log score of 2024-01 to 2024-09; the
one-standard-error rule and its tie order; rows R2 to R4; the refutation
rule; the interval-coverage extras.

**Code placement.** `run.py` and `glm_forecast.py` are in this directory
because tonight's prompt allows writes only here. The forecaster is
reusable (the app's county layer would call it), so AGENTS.md puts it in
`libs/utils/py/aei` with a test if Artem wants the forecast shipped.

**Run.** `uv run python experiments/0020-county-forecasts/run.py`, from
the repository root. Outputs in `out/`: `results.md`, `metrics.json`
(through `aei.harness.write_metrics`, family `prediction`, tuned on the
targets 2024-01 to 2024-09), `tuning.csv`, `selected.json` and one
figure, `skill_by_phenotype.png` (log-score skill against persistence
with 95 % intervals per phenotype, pooled and national, for R1 and
seasonal naive, counts in the labels). Check:
`uv run python scripts/verify_experiments.py --only 0020`.

## Mathematical foundation

**Model.** Let y(s, τ) be the count of series s (a phenotype in a county
or in the whole country) in month τ, τ = 0 for 2021-01, and t the target
month. The window is τ = t − W, …, t − 1. Working model on the window:

    y(τ) ~ Poisson(μ(τ)),   log μ(τ) = β0 + β1·(τ − t)/12
                                       + Σ k=1..K [ a_k·sin(2πkτ/12) + b_k·cos(2πkτ/12) ]

β1 is present only when the trend is on. Centring time at t makes β0 +
the harmonic terms at τ = t the log mean of the target month, so the
forecast is the fitted curve evaluated one step past the window. The
number of fitted parameters is p = 1 + trend + 2K (p = 1 for the
level-only fallback). K annual harmonics let the yearly cycle have one
(K = 1) or two peaks (K = 2); K = 0 is a rolling window mean.

**Fitting.** Maximum likelihood of the Poisson log-likelihood Σ(y log μ −
μ); the score equations are Xᵀ(y − μ) = 0. With the log link
(canonical) Fisher scoring is Newton's method:
β ← β + (Xᵀ W X)⁻¹ Xᵀ (y − μ), W = diag(μ), started at β0 = log of the
window mean and all other coefficients 0, step-halved when the deviance
rises, at most 30 steps (Nelder and Wedderburn 1972). The dispersion
does not enter the estimating equations, so Poisson and quasi-Poisson
share one β̂ (McCullagh and Nelder 1989, quasi-likelihood). The forecast
mean is μ̂(t) = exp(x_tᵀ β̂) and the predictive mean is μ* = max(μ̂(t), f).
The MLE does not exist when the window's cases all lie on one phase of
the cycle or all at its end (quasi-separation: the fitted curve runs to a
spike and the coefficients to infinity), which is what the sparse-window
rule, the 30-step limit and the 3 times largest-count guard are for. An
empty window has no MLE at all; it gets μ* = f.

**Dispersion.** Pearson statistic on the window,
χ² = Σ_τ (y(τ) − μ̂(τ))² / μ̂(τ), with W − p residual degrees of
freedom. Per series: φ̂ = max(1, χ² / (W − p)), as in 0008 (McCullagh and
Nelder 1989, section 6.2). Pooled over the series of a phenotype g (its
23 counties): φ̂_g = max(1, Σ_s χ²_s / Σ_s (W − p_s)), a degrees-of-freedom
weighted mean of the per-series estimates, taken before flooring at 1.
`poisson` sets φ = 1. φ enters only the variance of the predictive, never
the mean.

**Predictive distribution.** Y(t) ~ negative binomial with mean μ* and
variance φ·μ*. With r = μ* / (φ − 1) and q = r / (r + μ*):

    P(Y = y) = Γ(y + r) / (Γ(r)·y!) · q^r · (1 − q)^y ,   y = 0, 1, 2, …

which is a Poisson whose mean is Gamma-distributed with mean μ* and shape
r, so the variance is μ* + μ*²/r = φ·μ*. For φ ≤ 1 + 1e-9 the predictive
is Poisson(μ*), as in 0008 (`aei.regional.upper_tail`). In scipy:
`nbinom(n=r, p=q)`. Two quantities go to the harness:

- the log score of the realised count y, LS = log P(Y = y), a strictly
  proper scoring rule (Gneiting and Raftery 2007); the harness reports the
  mean over series-months and the skill as the difference to the
  baseline's mean (nats per series-month, higher is better);
- the predictive median, the smallest integer m with P(Y ≤ m) ≥ 0.5, which
  minimises the expected absolute error under the predictive, so MAE is
  scored at the point the model itself says is best (the baselines' point
  is last month's count and the count 12 months back).

The 5 % and 95 % quantiles are defined the same way and feed the
coverage extras and the picture.

**Why strictly one month ahead.** The harness gives the forecaster the
months up to t − 1 and checks by poisoning every month from t on
(`audit_strict`); the model only extrapolates its fitted curve one step.
The predictive treats Y(t) as independent of the window given μ*; there
is no autoregressive term, so information about the last months enters
only through the fitted level and trend. φ̂ is an in-window quantity: it
understates one-step-ahead error by about the leverage of the new point.
For a point inside the window the variance of the estimated mean is
μ²·x_tᵀ(XᵀWX)⁻¹x_t ≈ μ²·p / (W·μ) = p·μ / W, that is p / W of the
Poisson variance μ (derived), and more for the trend model, which
extrapolates. For horizons of two months or more the
trend term is extrapolated further and the in-window dispersion
understates error more, so the predictive is built and checked for one
month only; this record says nothing about two or three months ahead.

**What skill measures.** Log-score skill is the mean of LS(model) −
LS(persistence) over series-months. Persistence is a Poisson with mean
max(y(t−1), 0.5): it plugs one realisation of the previous month into
the mean. For a stationary Poisson series of mean λ the expected
log-score cost of that plug-in, against knowing λ, is
E[KL(Poisson(λ) ‖ Poisson(y′))] ≈ E[(y′ − λ)²]/(2λ) = ½ nat for
large λ, and about 0.2 to 0.3 nat for λ between 0.1 and 1 (derived, by
direct summation over y′ with the 0.5 floor), before any over-dispersion
persistence ignores. A GLM estimated on W months pays about p / (2W)
nats for estimating p parameters (0.014 for the level alone, 0.056 for
a trend and one harmonic at W = 36, derived). A stationary series would
therefore give a skill of about +0.2 to +0.4; real series have surges
and shifts, which is why the expectation under Hypothesis is the lower
end. MAE skill is 1 − MAE / MAE(persistence): for large λ and two
independent Poisson draws E|y − y′| ≈ 1.13 σ while E|y − median| ≈ 0.8 σ,
a ratio of 0.71 and so a stationary bound of about +0.3 (derived).

**Assumptions, and where the method breaks.**

1. Counts in a month are independent Poisson (or negative binomial with
   φ·μ variance) around a smooth log-linear mean in the window. Outbreaks
   inside the window raise μ̂ and φ̂ for the following months (0008 does
   not down-weight past outbreaks either; Farrington et al. 1996 do);
   an outbreak in the target month cannot be predicted.
2. The seasonal shape is a sum of K sinusoids with a fixed phase. A
   sharp seasonal peak, or a seasonal pattern that appears in only one of
   the two years of a 24-month window, is fitted poorly.
3. The variance is proportional to the mean (φ constant). For counts that
   vary by factors the variance usually grows faster than the mean (a
   quadratic variance, the NB2 form of Cameron and Trivedi 2013); pooling
   one φ over counties of different size then over-states the small
   counties' variance and understates the large ones'.
4. Sparse series: with a mean below about 1 case a month, p = 4 or more
   parameters are fitted on a handful of events, the MLE may not exist,
   and the Pearson χ² is dominated by single large counts where μ̂ is
   tiny (one case against a fitted 0.05 adds 18 to χ²). This is what ρ,
   the floor and the guards are for; the report counts how often they
   bind.
5. The plug-in predictive ignores the uncertainty of μ̂ (0008's review
   made the same point); its effect is about p / W of the Poisson
   variance, derived above.
6. The register counts detected carriers: it moves with screening
   volume, reporting practice and late notifications, none of which the
   GLM models. The series are THL's final values as fetched, so a real
   forecast, which would see provisional recent months, would do worse
   than this one.
7. Counties are modelled independently: no neighbour or flow term. That
   is the endemic part of the endemic-epidemic model (Held, Höhle and
   Hofmann 2005) with the epidemic and neighbour terms set to zero; a
   model that adds them has to beat this one, not only persistence.

**References, by name.** Nelder and Wedderburn (1972), "Generalized linear
models"; McCullagh and Nelder (1989), *Generalized Linear Models*, 2nd ed.
(quasi-likelihood, Pearson dispersion); Cameron and Trivedi (2013),
*Regression Analysis of Count Data*, 2nd ed. (negative binomial variance
forms); Gneiting and Raftery (2007), "Strictly proper scoring rules,
prediction, and estimation"; Farrington, Andrews, Beale and Catchpole
(1996), the quasi-Poisson surveillance algorithm that 0008 simplifies;
Held, Höhle and Hofmann (2005), the endemic-epidemic model named in
OBJECTIVES.md; Hastie, Tibshirani and Friedman, *The Elements of
Statistical Learning* (the one-standard-error rule).

## Why this method here

- 0008 already runs this model family on these series: a Poisson GLM on 36
  months with a trend and one annual harmonic, as the null of a monthly
  outbreak test over 250 series and 33 target months, in 16 s (computed,
  0008). Its fitted mean for the next month is a forecast it throws away
  after testing; this experiment keeps it, adds a predictive distribution
  and scores it. 0008 also found the dispersion fitted as 1 in 8 of its
  10 signal series and 1.2 and 1.6 in the other two (computed, among
  signal series only), and its Interpretation said the model probably
  understates the variability of sparse series; the over-dispersed
  predictive and the pooled φ test that directly.
- The committed baseline rows show that the single-month baselines are
  noisy: seasonal naive is worse than persistence by 0.391 nats per
  series-month (computed), and persistence itself plugs one count into a
  Poisson. A window estimate is the cheapest improvement on both, and the
  K = 0 ablation separates "smoothing helps" from "seasonality helps".
- OBJECTIVES.md lists the fitted endemic-epidemic model as the most
  ambitious county candidate and ships a forecast only if it beats
  persistence. This is that model's endemic part, with no neighbours:
  the smallest fitted step, and the floor against which neighbour
  coupling or flow matrices have to justify themselves.
- The caveat on the slide (detected carriers, driven partly by screening;
  the forecastable part is modest) becomes a number: the skill here is
  the share of next month's count that a county's own level and
  seasonality predict, with the screening confound left in.

For the researcher's flat county map the result changes one thing. If the
GLM beats persistence for a phenotype, that phenotype's map can show
next month's expected count with an interval, and the uncertainty view
has data behind it; an observed count outside the predictive band is the
same kind of event that 0008's test calls a signal, so the map and the
signal feed can agree. If it does not, the map shows last month's count and
calls it pressure, as OBJECTIVES.md says, and the design question is
settled with a number.

## Proposed visualisation

One picture on the researcher's board, following OBJECTIVES.md
"Visualisation choices": the flat stepped county map with a time slider,
the uncertainty as a second view, with one forecast month after the
observed ones.

- **Marks.** The 23 counties as flat polygons (Finland, no relief), one
  phenotype at a time (chips: MRSA, ESBL, VRE, CPE). Fill: the month's
  expected incidence per 100,000 residents (forecast median divided by
  the population that THL's own cases and incidence columns imply),
  in 5 steps with breaks fixed per phenotype from the quintiles of
  2021 to 2025 monthly county incidence and printed in the legend; one
  hue, light to dark, on a light background. Inside each polygon, or
  outside it on a leader line for the small southern counties and Åland:
  the expected count and under it the 80 % predictive interval, "12" over
  "7–18". The count behind the rate and the uncertainty therefore sit in
  the same element.
- **Time.** A slider under the map, one tick per month from 2024-01 to the
  forecast month. Observed months show observed counts with no interval.
  The last tick is the forecast: dotted polygon outlines and the label
  Forecast / Ennuste, so it is never read as an observation.
- **Second view, "Uncertainty / Epävarmuus".** A toggle recolours the same
  polygons by the width of the 80 % interval in cases (upper minus lower,
  steps 0–1, 2–3, 4–7, 8–15, 16 and over), with diagonal hatching on
  counties whose fit fell back to the level-only model (a window under 1
  case a month), so thin information shows without colour.
- **Detail.** Clicking a county opens a strip under the map: its last 24
  observed counts as bars; next month's forecast as an interval bar with
  a dot at the median; one line, "Last month 14 · forecast 12 (7–18)".
- **The ship rule drawn in.** A phenotype gets the forecast layer only if
  its back-test skill interval against persistence is above zero (this
  record's table). Otherwise its layer shows last month's count and the
  label "Pressure, not forecast / Paine, ei ennuste". The panel always
  states its basis: "Back-test 2024-10 to 2026-09, 552 county-months,
  skill +x.xx (95 % interval a to b)", the numbers coming from
  `out/metrics.json`.
- **Contrast and meaning.** Light mode only; text at least 4.5:1 against
  its fill (dark text on the three lightest steps, white on the two
  darkest); colour is never the only carrier: the numbers in the
  polygons, the hatching and the dotted outline say the same; tap
  targets at least 44 px on the phone.
- **Labels, English / Finnish, each short.** Expected cases next month /
  Odotettu tapausmäärä ensi kuussa; 80 % interval / 80 %:n väli; Last
  month / Viime kuussa; Forecast / Ennuste; Uncertainty / Epävarmuus;
  Cases per 100,000 / Tapausta 100 000 asukasta kohti; Fewer than 1 case a
  month / Alle 1 tapaus kuukaudessa; Pressure, not forecast / Paine, ei
  ennuste.

## Result

Command, from the repository root: `uv run python
experiments/0020-county-forecasts/run.py`. Outputs in `out/`: `results.md`
(everything below and more), `metrics.json` (R1, family `prediction`),
`tuning.csv` (all 198 cells), `selected.json`, `skill_by_phenotype.svg`.
`uv run python scripts/verify_experiments.py --only 0020` says
"reproduces". CPU time 2.3 s, wall 2.4 s (measured, `harness.Clock`; the
plan estimated about 2 minutes). Seeds: none in the model (the fit is
deterministic); the bootstrap is 1,000 resamples of target months, seed
2026. Every number below is computed by this run, except those marked
as committed baseline rows (computed by the harness, and reproduced here
to the 6 digits the rows store). `tuned_on_test` is false: no setting was
chosen or changed after a scoring-period number had been seen (after the
first full run I added the table of differences between rows and changed
the figure format; neither is a model setting).

**Tuning, targets 2024-01 to 2024-09** (828 county series-months). The best
of the 198 cells scored −1.5642 nats per series-month (window 36, K = 0,
trend on, ρ = 1, pooled quasi-Poisson, floor 0.1); 8 cells were within one
standard error of it, and the rule chose **R1 = window 24, K = 0, no trend,
ρ = 0, pooled quasi-Poisson, floor 0.1** (tuning score −1.5729). On the same
months persistence scored −1.9503 and seasonal naive −2.1345. The table
is flat: the top 12 cells span 0.020 nats. Best cell by K: K = 0 −1.5642,
K = 1 −1.5755, K = 2 −1.5914; by dispersion: pooled −1.5642, per series
−1.5722, Poisson −1.6059. R2, the per-phenotype cells: MRSA window 24, K = 0,
pooled quasi, floor 0.5; ESBL window 24, K = 0, Poisson, floor 0.5; VRE
window 36, K = 0, per-series quasi, floor 0.02; CPE window 36, K = 0,
Poisson, floor 0.1 (9, 30, 24 and 24 eligible cells). No cell with
harmonics or a trend was chosen anywhere.

**P2 on the scoring targets 2024-10 to 2026-09, R1.** Skill against
persistence (MAE: 1 − MAE / MAE of persistence; log score: difference in
mean log score, nats per series-month; 95 % interval over target months).
The seasonal naive columns are the committed baseline row's own skill
against persistence; persistence is 0 by construction.

| group | n | R1 MAE skill | R1 log-score skill | seasonal naive MAE skill | seasonal naive log-score skill |
|---|---|---|---|---|---|
| pooled | 2,208 | +0.144 (+0.063 to +0.213) | +0.402 (+0.309 to +0.482) | −0.095 (−0.183 to −0.014) | −0.391 (−0.551 to −0.233) |
| MRSA | 552 | +0.217 (+0.145 to +0.276) | +0.620 (+0.453 to +0.804) | −0.030 (−0.134 to +0.056) | −0.237 (−0.469 to −0.000) |
| ESBL | 552 | +0.092 (−0.034 to +0.189) | +0.519 (+0.280 to +0.742) | −0.135 (−0.268 to −0.014) | −1.211 (−1.859 to −0.602) |
| VRE | 552 | +0.200 (−0.007 to +0.429) | +0.250 (+0.165 to +0.332) | +0.000 (−0.224 to +0.242) | −0.077 (−0.226 to +0.038) |
| CPE | 552 | +0.286 (+0.192 to +0.376) | +0.219 (+0.160 to +0.276) | −0.075 (−0.176 to +0.031) | −0.037 (−0.090 to +0.016) |
| national | 96 | −0.126 (−0.489 to +0.134) | +1.548 (+0.809 to +2.335) | −0.397 (−0.887 to −0.071) | −1.972 (−3.126 to −0.872) |
| pooled without 2026-08 and 2026-09 | 2,024 | +0.150 (+0.064 to +0.226) | +0.408 (+0.313 to +0.501) | −0.065 (−0.150 to +0.010) | −0.370 (−0.550 to −0.207) |

R1 against seasonal naive, pooled: MAE skill +0.219 (+0.158 to +0.272),
log-score skill +0.793 (+0.660 to +0.933). Raw scores (MAE of the
predictive median; mean log score per series-month), R1 against the two
baselines:

| group | n | MAE R1 | MAE persistence | MAE seasonal naive | log R1 | log persistence | log seasonal naive |
|---|---|---|---|---|---|---|---|
| pooled | 2,208 | 2.167 | 2.533 | 2.774 | −1.728 | −2.130 | −2.521 |
| MRSA | 552 | 2.538 | 3.241 | 3.339 | −2.335 | −2.955 | −3.192 |
| ESBL | 552 | 5.551 | 6.112 | 6.938 | −3.375 | −3.894 | −5.105 |
| VRE | 552 | 0.217 | 0.272 | 0.272 | −0.477 | −0.728 | −0.805 |
| CPE | 552 | 0.362 | 0.507 | 0.545 | −0.725 | −0.943 | −0.981 |
| national | 96 | 24.010 | 21.323 | 29.792 | −4.160 | −5.708 | −7.679 |

The pooled interval of both skills is above zero, with and without the
last two months. R1 has the better raw MAE and log score than both
baselines in every group except national MAE (24.0 against persistence's
21.3).

**Secondary rows** (descriptive; R1 is the record's row). Differences are
R1 minus the row on the 92 county series, mean over the 24 target months
with a 95 % bootstrap over months (seed 2026), computed here from the
harness's per-series scores and not a P2 key.

| row | pooled log-score skill | pooled MAE skill | log score, R1 minus row | MAE, R1 minus row |
|---|---|---|---|---|
| R1 | +0.402 (+0.309 to +0.482) | +0.144 (+0.063 to +0.213) | | |
| R2 per-phenotype cells | +0.301 (+0.180 to +0.394) | +0.149 (+0.070 to +0.220) | +0.102 (+0.063 to +0.144) | +0.010 (−0.009 to +0.029) |
| R3 R1 with K = 1 | +0.339 (+0.245 to +0.419) | +0.130 (+0.051 to +0.195) | +0.063 (+0.035 to +0.094) | −0.037 (−0.119 to +0.051) |
| R4 R1 with Poisson predictive | +0.262 (+0.148 to +0.357) | +0.152 (+0.072 to +0.222) | +0.140 (+0.102 to +0.186) | +0.019 (−0.002 to +0.039) |

Log-score skill by phenotype (MRSA, ESBL, VRE, CPE, national): R2 +0.618,
+0.119, +0.253, +0.211, +0.328; R3 +0.573, +0.407, +0.194, +0.182,
+1.483; R4 +0.513, +0.119, +0.199, +0.215, −0.342.

**Diagnostics for R1** (descriptive, not P2 metrics). Share of observed
counts inside the 90 % predictive interval: 0.939 over all county
series-months, and 0.884 over the 691 whose window mean is at least 5
cases a month (MRSA 0.867 of 173, ESBL 0.890 of 518; national 0.885,
0.890 of 73); VRE and CPE 0.966 and 0.980, where the discrete interval
over-covers because the mean is small. Fit status: in R1 (K = 0, no trend)
there is nothing to fail; 134 of 2,208 county series-months had an empty
window (114 VRE, 20 CPE) and took the floor 0.1. In R3 (K = 1), the
harmonic fit did not converge in 167 county series-months (120 VRE, 47
CPE, none in MRSA or ESBL) and fell back to the level; the 3-times-largest-
count guard never fired in R3.

**Checks.** The numpy fitter reproduces `aei.regional.expected_month`
(statsmodels, W = 36, trend, K = 1) on 488 (series, target) pairs, to
2.2e-10 relative in the forecast mean and 2.6e-10 in φ̂. The harness's
baselines equal the committed rows (largest relative difference 2.3e-6
against 6 significant digits stored). `audit_strict` passed for R1 to R4.

**Deviations from plan.**

1. CPU: 2.3 s against the estimate of about 2 minutes. The plan assumed one
   Python-level fit per series at 0.3 to 1 ms; the Newton steps run
   batched over the 24 series of a phenotype and the fits are shared
   between the 9 predictive settings by a cache, which made the run about
   50 times faster than the estimate. Nothing was cut, nothing was skipped.
2. The figure is `skill_by_phenotype.svg`, not `.png`. `scripts/verify_experiments.py` decodes every
   file in `out/` as UTF-8 and stops with a `UnicodeDecodeError` on a PNG,
   so a PNG would make the record impossible to verify. The SVG has fixed
   ids and no date, so reruns compare equal. Content as planned: log-score
   skill against persistence with 95 % intervals per phenotype, pooled and
   national, R1 and seasonal naive, n in the labels (national on its own
   axis, its scale being larger).
3. Check (1) ran on every qualifying pair (488), not on every 50th, since
   it costs about a second.
4. The pooled φ̂ leaves out series whose window is empty (they have no
   residuals); the plan said "pooled over the 23 counties". Empty-window
   series keep φ = 1 as planned.
5. The baseline reproduction check is relative (3e-6), because the
   committed rows keep 6 significant digits, not 6 decimals.
6. Added, descriptive only: the persistence and seasonal naive scores on
   the tuning months, the differences between rows, and the fit-status
   table for R3. None feeds back into any setting.

## Interpretation

**Against the hypothesis.** Supported, as an exploratory description: the
pooled interval of log-score skill (+0.402, +0.309 to +0.482) and of MAE
skill (+0.144, +0.063 to +0.213) against persistence lies wholly above
zero, with and without the last two months. By the yardstick of
METRICS.md "Decision rules" and OBJECTIVES.md, R1 beats the baseline on
the 92 county series pooled. Per phenotype the log-score skill is above
zero in all four and nationally; the MAE skill is above zero for MRSA and
CPE and its interval includes zero for ESBL (−0.034 to +0.189) and VRE
(−0.007 to +0.429); the national MAE is worse than persistence in the
point estimate (−0.126, interval −0.489 to +0.134). Of the four
expectations: the pooled log skill came out at twice the guessed +0.2
(+0.40, the top of the stationary range derived in the plan); MAE +0.14
against about +0.1; national had the largest log skill (+1.55) but ESBL
(+0.52) fell below MRSA (+0.62), so the order guessed for ESBL was
wrong; VRE and CPE had the smallest skill (+0.25, +0.22) and their
intervals do not include zero, which the plan only allowed. R1 beats
seasonal naive on both raw scores in every group, and pooled with the
interval above zero. Nothing here is decided; Artem decides whether any
phenotype's map layer ships.

**What the skill is made of.** Not the harmonics. No cell with harmonics
or a trend was chosen for R1 or for any phenotype; the selected cell is a
24-month rolling mean with a pooled quasi-Poisson negative binomial
predictive. With K = 1 (R3) the pooled log score is worse by 0.063 nats
(0.035 to 0.094, R1 minus R3), the MAE difference is not distinguishable
from zero, and in R3 the harmonic fit failed to converge in 167 sparse
VRE and CPE series-months. The tuning table does not rule seasonality out
(the best K = 1 cell is 0.011 nats behind the best cell, well inside the
noise of nine months), but two years of counts per county are little to estimate
a yearly cycle from, so this record cannot say whether annual seasonality
is worth modelling here. The width of the predictive matters for
the log score and not for MAE: with a Poisson predictive (R4) the pooled
log skill falls by 0.140 (0.102 to 0.186), almost all of it in ESBL (+0.52
to +0.12) and the national totals (+1.55 to −0.34), while the MAE
difference is +0.019 (−0.002 to +0.039). So the MAE gain comes from the
smoothed mean, and the log-score gain from the smoothed mean and the
over-dispersed predictive together. Letting each phenotype pick its own
cell (R2) was worse than one cell by 0.102 nats (0.063 to 0.144): on nine
tuning months the parsimony rule chose a Poisson predictive for ESBL and
CPE where over 20 cells were within one standard error, and ESBL paid for
it. That is a statement about this rule on this amount of tuning data,
not about per-phenotype tuning.

**Strongest alternative explanation.** The baseline is weak, not the model
strong. Persistence plugs one noisy count into a Poisson that ignores
over-dispersion, and seasonal naive does the same with a count a year
old; any smoother with any over-dispersion should beat both, and the
winning cell is exactly that: a rolling mean. The result is "a 24-month
mean with a pooled over-dispersed predictive beats last month's count",
and it does not show that a seasonal GLM, or any structure beyond a
level, forecasts these series. The plan's plug-in argument predicts most
of the gain from this alone (+0.2 to +0.4 for stationary series). Other
readings that this record cannot exclude: the series are THL's final
values, while a real forecaster sees provisional recent months, which
would hurt persistence and the window mean in different ways; the 24
scoring months share their events across all series, so the bootstrap
over months is the honest spread but 24 months is few; the tuning months
(2024-01 to 2024-09) had a Poisson predictive nearly as good as the
over-dispersed one (−1.6059 against −1.5642) while the scoring months did
not (R4's 0.140), so the dispersion setting was chosen on a stretch where
it mattered less than where it was scored; and the national totals, 4 series
over 24 months, drive the largest numbers on the page and should not be
read as county results.

**What it means for the researcher's county map.** On this evidence a "next
month" layer with a predictive interval is better than showing last month's
count for MRSA and CPE on both measures, and on the log score for ESBL
and VRE; for ESBL and VRE the expected count itself is not shown to be
closer to the truth (MAE interval includes zero); the better log score
credits the mean and the stated uncertainty together. The 90 % interval covered 0.88 to 0.89
of the counts in series with a window mean of at least 5 a month, close
to its nominal level, so it can be drawn as stated; for VRE and CPE it
covers 0.97 to 0.98 and is conservative. The layer is a smoothed level,
so it will never show a coming surge, and says so.

**Next, named only, not run tonight.** Negative binomial INGARCH (an
autoregressive term, so a surge in the last month can carry over, which a
rolling mean cannot); the endemic-epidemic model with the
university-hospital catchment tree as the neighbourhood, and gravity or
radiation flow matrices as alternatives (the first test of whether
neighbours add anything to this level); a hierarchical Bayesian Poisson
with county random effects (partial pooling of the level and of the
dispersion, the principled version of the pooled φ̂ and of the sparse VRE
and CPE series); a Gaussian process over county × month with a separable
kernel. Two things to run first, both cheap: the same grid with
exponentially weighted levels and horizons of 2 and 3 months, and the
same tuning with far more months, since the THL file holds years before
the harness's 2021-01 start (earlier screening practice differs, so that
is a question for Artem). Also worth one run: the harness's persistence
baseline replaced by a trailing mean of the previous 12 months, so that
"beats last month" and "beats a rolling mean" are separated by the
scoring, not by an ablation.
