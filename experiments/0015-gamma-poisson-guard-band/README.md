---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem (overnight run)
data: [synthetic_microbiology_dataset, seed 2026, as received 2026-10-09]
parent: 0011
---

# 0015 Does a Gamma-Poisson surprise with a guard band and false-discovery control find injected clusters at the live set's noise?

## Goal

The live cluster tests (profile excess and phenotype excess, D-020)
compare a 28-day count with a Poisson mean taken from the 365 days
before, with no gap between baseline and window, one alpha per test and
no correction for the hundreds of series tested every day (ENGINE.md
"Status", row 3.3). ENGINE.md 3.3 proposes instead a baseline shrunk
toward the hospital rate so it is never zero, a negative binomial
predictive that carries the baseline's own uncertainty, a 4-week guard
band so a growing outbreak does not raise its own baseline, a filter
that drops series which cannot signal, Benjamini-Hochberg across the
active series, and a weekly alert budget. QUESTIONS C3 and C4 ask for
the baseline length, the guard band, q and B. This experiment runs that
test over a grid of baseline length, guard band and window, scores it on
D1 to D7 and I1 through the overnight harness's injection families, and
reports it against the live set as shipped and as re-tuned on year one,
so Artem can answer C3 and C4 from numbers and decide whether the test
should replace or join the live Poisson tests.

## Hypothesis

This experiment is exploratory in PROTOCOL.md's sense: it describes how
the Gamma-Poisson test scores on the detection metrics at each setting
and supports no claim beyond its table. The yardstick is METRICS.md
"Decision rules": the D5 headline, the D2 rate at k = 4 for the rare and
the common ESBL *E. coli* families at the loosest threshold whose D4 is
at most 5 episodes a year, with D2's median delay there; the live set's
year-1 re-tune is the reference row.

What is described: D1 (demonstration), D2 and D2 delay for the five
injection families, D4 by kind, the D5 curve and headline, D6, D7, I1,
for the setting chosen on the tuning year and for every setting of the
grid.

Directional expectation, stated so the table can contradict it: at
5 episodes a year the rare family reaches at least the live set's 95 %
(38 of 40, computed, 0007) and the common ESBL family rises from the
live set's 33 of 60 at k = 4 (computed, 0011) to at least 70 %, because
the negative binomial predictive and the guard band make the threshold
at a given noise level looser where the live test's Poisson is too
narrow and its baseline is diluted by the window itself. The common
resistant and wild-type families stay near 0 % (1 of 180 and 1 of 180,
computed, 0011): a count test on phenotype or organism series cannot see
a cluster of a strain that is a fifth of the unit's traffic, and this
experiment adds no typing. The two-unit family is new; no expectation.

## Experiment

**Data.** `synthetic_microbiology_dataset` (seed 2026, received
2026-10-09) through `aei.harness.data()`: isolate records with
phenotypes and cultures. Detection works on raw counts, never on
estimates (D-039).

**Series.** Two families, both per unit:

1. unit × phenotype, for ESBL, MRSA, VRE, CPE: 36 series;
2. unit × organism × specimen: at most 9 × 9 × 3 = 243 series.

An event is a patient's first isolate of the series in that unit within
the trailing 365 days (the first-isolate rule of ENGINE.md 1 applied per
patient × series × unit; proposed (overnight), pending Artem), dated by
its sample date, so a carrier screened weekly counts once. Daily event
counts per series are the only input; everything else is cumulative
sums over them.

**The test**, evaluated every day t for every series (the formulas and
their derivation are under "Mathematical foundation"):

- window: the L weeks ending at t, count y;
- guard band: g weeks before the window start, nothing counted;
- baseline: the S weeks before the guard band, count C, and the
  hospital's rate for the series over the same S weeks scaled to the
  unit's isolate volume, r_hosp;
- prior on the unit's weekly rate: Gamma(C + k · r_hosp · S, S (1 + k))
  with k = 0.1 (QUESTIONS C3);
- predictive for y: negative binomial with size C + k r_hosp S and
  probability S (1 + k) / (S (1 + k) + L);
- surprise p = P(Y ≥ y), score = −log10 p; a series is tested on day t
  only when y ≥ 2 (the minimum-count rule, the reading of "Tarone's
  filter" in ENGINE.md 3.3; see the foundation);
- across the series tested on day t, Benjamini-Hochberg adjusted
  p-values (q-values); the signal carries `p` = q-value, so the
  harness's default filter `p < level` is BH at level `level`. Signals
  are emitted at the loosest level q < 0.2; the sweep levels are
  {0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.001, 0.0001};
- alert budget B = 3 per ISO week hospital-wide (QUESTIONS C4): among
  the series whose q-value passes in a week, the three with the highest
  score keep their signals, the rest are dropped. The budget cannot be
  expressed as a monotone `p`, so it is a second run of the same
  signals ("with budget") scored beside the first ("no budget").

Signals are `aei.detect.Signal` with `detector` "gamma-poisson", `ward`
the unit, `phenotype` or `organism` set so the harness's D2 matcher
(unit and the source's organism or a phenotype of it) and `kind_of`
(cluster) apply, `observed` y, `expected` the predictive mean, `p` the
q-value, and `key` unit|series. The two-unit family needs no change:
when both units signal they are two signals the fixed episode key
merges; connected-set series (ENGINE.md 4, QUESTIONS C8) are not built
here and the record says what the two-unit result would gain from them.

**Grid.** S ∈ {13, 26} weeks × g ∈ {0, 4} weeks × L ∈ {1, 4} weeks:
8 settings selectable on the tuning year; plus S = 52 at g ∈ {0, 4},
L = 4: 2 settings that need 56 weeks of history and so cannot be tuned
on year 1 (METRICS.md's split table); they are scored on SCORE and
reported as exploratory, never selected. k = 0.1 and y_min = 2 are
fixed; B = 3 is fixed. QUESTIONS C3's proposal (26 weeks, 4-week guard
band) is one cell of the grid.

**Choosing a setting without touching the scoring period.** As the
harness's own re-tuning of the live set does (harness-spec.md Choices
5): on the tuning year, inject 40 rare clusters of k = 4 and 40 common
ESBL *E. coli* clusters of k = 4 with start dates 2024-04-01 to
2024-08-15, seed 2026, and count other episodes (fixed key, D4's rule)
over 2024-04-01 to 2024-09-30 scaled to a year, at every sweep level.
For each setting take the loosest level whose scaled noise is at most 5
a year; the setting with the highest rare-family rate there is chosen,
ties broken by the common ESBL rate, then by fewer episodes, then by
the shorter S. That setting, without budget, is `out/metrics.json`,
`tuned_on_test` false, `tuned_on` "2024-04-01..2024-09-30". If the
extended `aei.inject` trial functions do not take a start-date range,
the implementer draws the starts by the same method with the dates
replaced and records it under "Deviations from plan".

**Seeds.** Screening uses seed 2026 only: every injection cell is 200
trials drawn from one `mulberry32(2026)` stream, as the harness draws
them. Seeds 2027 to 2030 are held out to re-score the night's winners
and are not used here. Spread: the 95 % Wilson interval per cell, and
the rates of the five consecutive blocks of 40 trials of the same
stream as a descriptive spread, not as independent runs. Tuning-year
trials use the same seed with their own date range.

**Baseline rows** (benchmarks/overnight-2026-10-17/baselines/):
`live-set-retuned-year1`, the reference row, which differs in the test
and its multiplicity handling but was tuned by the same year-1
procedure; and `live-set-shipped`, flagged `tuned-on-test`, which is
what the demo runs today.

**Metrics** through `aei.score_detection`: D1 for E1 to E4
(demonstration; E3 and E4 are not this test's kinds and are reported as
not found); D2 and D2 delay for `rare`, `common_resistant`, `wild_type`,
`common_esbl` and `two_unit` at k ∈ {2, 3, 4, 6} plus controls; D4
episodes per year by kind and alerts per week; the D5 curve and headline
(Choices 3: noise counted over cluster and sentinel signals, which here
is every signal); D6 on the harness's injected gaps (this test raises no
data signals, so D3 is left out and D6 reports whether it raises cluster
signals in gap unit-weeks, which it should not, counts fall); D7; I1.
Causality by `check_causal` on three cut dates.

**Budget.** 10 minutes of CPU for `run.py`, measured with
`aei.harness.Clock` and reported as information; runtime ranks nothing
and decides nothing except through this rule. The full-data run of one
setting is a vectorised pass over about 280 series × 1,092 days, well
under a second; the injection trials dominate (0011 ran about 780 trials
with the live detectors in 15 s of CPU, computed, 0011; one trial here
reruns the test on the focus unit and series over 400 days before to 60
after the start). Expected: 5 families × 5 cells × 200 trials = 5,000
trials for the chosen setting, 8 × 80 for the tuning year, plus the 10
full-data runs. If it does not fit, cut in this order and record each
cut under "Deviations from plan": (1) `wild_type` and `two_unit` to 100
trials per cell; (2) the S = 52 exploratory rows; (3) L = 1 from the
grid; (4) k = 2 and k = 6 cells to 100 trials; (5) the `with budget`
run.

**Command and outputs.**

    uv run python experiments/0015-gamma-poisson-guard-band/run.py

writes `out/results.md` (the tuning-year table per setting, the chosen
setting, D1 to D7 and I1 against both baseline rows with intervals, the
D5 curve per family, and a note that the budget run differs from the
no-budget run only by dropped signals),
`out/metrics.json` (the chosen setting, no budget, through
`aei.harness.write_metrics`, with `D5_curve` at top level),
`out/metrics-budget.json` (the same setting with budget, same schema),
`out/grid.json` (every setting, same schema, marked exploratory) and
`out/figure.png` (the sketch under "Proposed visualisation", under 1 MB,
`metadata={"Software": None}`). Implementable with numpy, scipy and
pandas; nothing new in `libs/utils` unless the orchestrator asks for
the test as a module.

## Mathematical foundation

**Model.** For one series, events in a week are Poisson with an unknown
weekly rate λ. The belief about λ is Gamma(α, β) (shape α, rate β), the
conjugate prior, with mean α / β. After observing C events over S weeks
the posterior is Gamma(α0 + C, β0 + S). ENGINE.md 3.3 chooses the prior
so that the posterior is

    λ | baseline  ~  Gamma( C + k · r_hosp · S ,  S · (1 + k) )

which is the same as starting from Gamma(k r_hosp S, k S): a prior worth
k S weeks of the hospital's rate, k = 0.1 being 2.6 pseudo-weeks at
S = 26. Its mean is (C + k r_hosp S) / (S (1 + k)) = (1 − k') C / S +
k' r_hosp with k' = k / (1 + k): a shrinkage of the unit's own rate
toward the hospital's by 9 % at k = 0.1, and never zero.

r_hosp is the series' rate the hospital as a whole would predict for
this unit: the hospital's events of the series over the baseline weeks
divided by the hospital's isolates over the same weeks, times the
unit's isolates per week over the same weeks. It is the live
phenotype-excess test's "share times volume", moved to the baseline
period. The unit's own isolates are included in the hospital's; with
k = 0.1 the double counting is small, and the record says so rather
than complicates it (proposed (overnight), pending Artem).

**Predictive.** The count Y over the next L weeks, given λ, is
Poisson(L λ). Integrating λ out of Gamma(α, β) gives the negative
binomial (Gelman et al., Bayesian Data Analysis, ch. 2):

    P(Y = y) = Γ(α + y) / (Γ(α) y!) · (β / (β + L))^α · (L / (β + L))^y

    E[Y] = α L / β          Var[Y] = α L / β · (1 + L / β)

In scipy, `nbinom(n = α, p = β / (β + L))`. The variance exceeds the
Poisson's by the factor 1 + L / β: for L = 4 and β = 26 · 1.1 = 28.6 by
14 %, for S = 13 by 28 %. This is where the live Poisson test is too
confident: it fixes the mean at the baseline's point estimate and
ignores that the estimate came from a count.

**Surprise.** p = P(Y ≥ y) = `nbinom.sf(y − 1, α, β / (β + L))`, the
upper tail, one-sided because only excess is a cluster. Score
−log10 p. Clip p at 1e-300 before the log.

**The minimum-count rule and Tarone.** Tarone (1990, Biometrics, "A
modified Bonferroni method for discrete data") counts in the
multiplicity correction only those tests whose smallest attainable
p-value is below the level, since the others can never reject. For a
count with unbounded support the smallest attainable p-value is 0 (as
y → ∞), so Tarone's rule in its literal form removes nothing. What
ENGINE.md 3.3 means by it, and what is done here, is the practical
version: a window with y ≤ 1 is never an outbreak signal under any
threshold the tool would set, so such series are not tested that day
and do not enter the BH denominator. The effect is the one Tarone
sought, a smaller family and more power; the justification is the
tool's own minimum, not Tarone's bound. Both are said in the record.
y_min = 2 is proposed (overnight), pending Artem; the live tests use 2
(phenotype) and 3 (profile).

**Benjamini-Hochberg.** With m tested series on day t and ordered
p-values p_(1) ≤ … ≤ p_(m), BH rejects the largest i with p_(i) ≤ i q / m
and everything below it (Benjamini and Hochberg 1995, JRSS B). The
adjusted p-value of the i-th is q_(i) = min_{j ≥ i} m p_(j) / j, capped
at 1, monotone in i; rejecting all with q_(i) ≤ q is the same decision
as BH at q. So a signal that carries its q-value gives every stricter q
by filtering, which is what the harness's sweep needs. BH controls the
expected share of false rejections among rejections for independent or
positively dependent tests (Benjamini and Yekutieli 2001); series in
one hospital on one day are mildly positively dependent through
shared sampling, which is the benign direction. What BH does not
correct is the daily repetition of the same test over overlapping
windows; the live tests have the same property and D4 measures its
cost as episodes.

**Budget.** The cap B keeps, per ISO week, the B series with the
highest score among those that passed. It is a rank, not a threshold,
so a stricter q does not nest inside a looser one; hence the second
run.

**Assumptions and where they break.**

- Poisson events within a week given λ: repeat samples of one carrier
  violate it, which the first-isolate rule per patient × series × unit
  removes; two outbreak patients sampled on one day do not, and are
  exactly the signal.
- λ constant over the baseline: a trend or season within S weeks
  biases the baseline; S = 13 follows drift, S = 52 averages a season.
  The synthetic data has no weekday or seasonal pattern (0002's review,
  measured), so the sweep over S says less about real data than the
  grid suggests; the record must say so.
- The guard band removes the window's own growth from its baseline,
  which matters for a cluster that builds over weeks (E1 ran five weeks
  at 5 or 6 a week, measured). It also delays the baseline by g weeks,
  so a genuine change of level g weeks ago is still "surprising"; D4
  measures this as episodes.
- The hospital prior assumes the unit's rate is near the hospital's
  share times its volume. A unit with a permanently different share
  (the ICU for MRSA, 0.12 patients a week against 0.01 in URO,
  measured from the CSVs, distinct patients per ISO week, all isolates)
  is pulled by 9 % toward the hospital, little; a series the unit has
  never seen gets a prior of k r_hosp S pseudo-events, so two cases of
  a phenotype in a unit with none in a year give a small p: this test
  behaves like a soft "new in unit" sentinel for sparse series, which
  may be wanted or may double D-021's alerts; I1 will show it.
- Organism × specimen series carry the volume of the organism: 4 added
  *E. coli* in a unit with 40 a month move y from about 37 to 41 at
  L = 4, far from any threshold, so the common families cannot be
  caught by these series. Profile series (unit × organism × specimen ×
  13-drug profile), which are what the live profile-excess test uses,
  are not in this plan; they are the obvious extension if the organism
  series add nothing.
- The negative binomial is the right predictive only if the
  overdispersion comes from not knowing λ. Extra variability from
  sampling surges (E2 came with a jump in total *S. aureus*, measured)
  is not in it; ENGINE.md 3.1's "sampling surge" annotation is the
  remedy and is not built here.

**Causality.** On day t the window is (t − 7 L + 1 … t), the guard band
the 7 g days before it, the baseline the 7 S days before that; r_hosp
is computed on the same baseline days; events are dated by sample date
(D-005) and nothing dated after t is read. The BH family on day t is
the series tested on day t. `check_causal` on three cut dates verifies
that truncating the data at a date leaves every signal up to that date
unchanged.

**References.** Gelman, Carlin, Stern, Dunson, Vehtari and Rubin,
Bayesian Data Analysis (3rd ed., ch. 2, Gamma-Poisson); Benjamini and
Hochberg (1995); Benjamini and Yekutieli (2001); Tarone (1990);
Farrington, Andrews, Beale and Catchpole (1996, JRSS A) and Noufaily et
al. (2013, Statistics in Medicine) for the baseline-with-guard-band
tradition in surveillance; Höhle (2007, Computational Statistics, the
surveillance package) for the family of count-surveillance tests this
one belongs to.

## Why this method here

- The live cluster tests are Poisson with a point-estimate mean from a
  365-day window that ends the day before the test window, per-test
  alphas chosen while looking at E1 to E4 (0002's review), and no
  correction for the roughly 280 series tested every day. 0007 and
  0011 measured the result: rare clones of 4 are caught in 95 %
  (38 of 40), a common ESBL *E. coli* clone of 4 in 55 % (33 of 60),
  common strains never (computed, 0007, 0011). The common ESBL case is
  where a better-calibrated baseline could gain: the clone is in the
  phenotype series, where the unit's expected count is about 0.5 to 0.7
  a week in the large units (measured), so 4 added patients in two
  weeks are a four- to eight-fold excess that a predictive honest about
  its own baseline should pass at a looser threshold for the same noise.
- The 4-week guard band is the standard remedy for a baseline that
  contains the outbreak's own first weeks (Farrington 1996). E1's weekly
  counts 0, 0, 1, 5, 5, 6, 6, 5 (measured, planted events) show the
  case: by the third outbreak week the live 365-day baseline has
  absorbed eleven outbreak isolates.
- 0002 found "other episodes" that fall in the first year where the
  baseline was short (PIP/TZP-only *E. coli* at PHC-S, 2023-11; ESBL at
  PHC-S, 2024-08), and 0008's review noted that a model without the
  baseline's uncertainty over-signals on sparse series. The
  Gamma-Poisson predictive carries that uncertainty; the k r_hosp S
  term keeps a short or empty baseline from giving a zero mean.
- QUESTIONS C3 and C4 ask for exactly this grid and these two
  constants. The table answers them with numbers tuned on year one, as
  C7 proposes.
- For the researcher: the signal feed would show, for every cluster
  alert, the baseline weeks, the guard band and the predictive band
  the count broke through, and "3 of 41 tests today" instead of a bare
  p-value; and the weekly budget bounds what the feed can show, which
  is the volume promise ENGINE.md 3.3 makes. For the doctor: nothing
  directly; a cluster alert in the unit annotates the list (B7).

## Proposed visualisation

One card of the researcher's signal feed (OBJECTIVES.md "Visualisation
choices": signal feed first), light mode, drawn for E1: URO, ESBL, as
of 2025-06-15.

- Header line: "ESBL · Urologia / Urology — 11 potilasta 4 viikossa,
  tavallisesti 1.2 / 11 patients in 4 weeks, usual 1.2". The count and
  the predictive mean are the alert's fields.
- Body, a bar chart 30 weeks wide: weekly event counts as grey bars;
  the baseline weeks bracketed under the axis and labelled "vertailu /
  baseline, 26 vk / wk"; the guard band as a hatched strip labelled
  "suojaväli / guard band, 4 vk / wk"; the window as the last 4 bars,
  drawn solid; over the window a horizontal predictive band from the
  2.5th to the 97.5th percentile of the negative binomial, light grey,
  with the mean as a dashed line, so the eye sees the bars rise through
  the band. The as-of date as a vertical rule at the right edge.
- Footer, small text: "p 3.1e-7 · BH-korjattu / adjusted 2.4e-5 ·
  3 / 41 testattua sarjaa tänään / tested series today · budjetti /
  budget 1 / 3". Every number is a field of the signal.
- Encodings: height for counts, band for uncertainty, hatching for the
  guard band, text for the test; colour carries nothing on its own.
  Labels bilingual, Finnish first; the unit name comes from
  `wards.csv`'s `ward_fi` and `ward_en`.

The matplotlib sketch in `out/figure.png` draws the body for E1 at the
chosen setting with S = 26, g = 4, L = 4 marked, from 2024-11 to
2025-07, with the onset 2025-05-30 and the first signal day marked.

## Result

## Interpretation
