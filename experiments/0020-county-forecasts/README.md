---
status: proposed    # proposed, then accepted, rejected or superseded
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

## Interpretation
