---
status: accepted    # proposed, then accepted, rejected or superseded
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

Command, from the repository root:

    uv run python experiments/0015-gamma-poisson-guard-band/run.py

Outputs in `out/`: `results.md` (every table of this section and more:
all 64 tuning-year rows, every D2 cell with its blocks of 40, the D5
curve of every row, the noise episodes, the checks), `metrics.json` (the
chosen setting, no budget; family `detection`; `tuned_on_test` false;
`tuned_on` 2024-04-01..2024-09-30; `D5_curve` at top level),
`metrics-budget.json` (the same setting with the weekly budget),
`grid.json` (all ten settings, marked exploratory), `figure.png` (the
card of "Proposed visualisation"), `d5-curves.png` (sensitivity against
noise) and `card.json` (the numbers printed on the card). `uv run python
scripts/verify_experiments.py --only 0015` says "reproduces". CPU time
320 s for the final run (measured, `aei.harness.Clock`; 262 s to 336 s
over the three runs that included the controls, the spread being other
jobs on the laptop); the budget was 10 minutes and nothing was cut.
Seed 2026 only (seeds 2027 to 2030 are held out and were not touched),
200 trials per injection cell from
one `mulberry32(2026)` stream, rates with 95 % Wilson intervals, D4 with
exact Poisson intervals, the five blocks of 40 trials of each cell in
`results.md` as a descriptive spread (not independent runs). Everything
below is computed by this run through `aei.score_detection`, except the
two baseline rows, which are the committed rows of
`benchmarks/overnight-2026-10-17/baselines/` computed by the same
harness. `tuned_on_test` is false: the setting and its level were chosen
on the tuning year alone. After the first full run I added things that
feed no setting: the two controls, the diagnostics, the noise-episode
list, the second figure and the card's layout.

**Choice on the tuning year** (computed; 40 rare and 40 common ESBL
*E. coli* clusters of 4 injected 2024-04-01 to 2024-08-15, noise over
2024-04-01 to 2024-09-30 scaled to a year, so one episode is 2.0 a year;
operating level = the loosest level with noise at most 5 a year):

| rank | setting (S, g, L weeks) | level q below | noise a year (episodes) | rare, k 4 | common ESBL, k 4 |
|---|---|---|---|---|---|
| 1 | 26, 0, 1 | 0.005 | 3.99 (2) | 15/40 | 19/40 |
| 2 | 13, 0, 1 | 0.001 | 2.00 (1) | 8/40 | 11/40 |
| 3 | 26, 4, 4 | 0.01 | 3.99 (2) | 8/40 | 11/40 |
| 4 | 26, 0, 4 | 0.005 | 3.99 (2) | 7/40 | 13/40 |
| 5 | 26, 4, 1 | 0.001 | 2.00 (1) | 7/40 | 10/40 |
| 6 | 13, 0, 4 | 0.001 | 0.00 (0) | 4/40 | 5/40 |
| 7 | 13, 4, 1 | 0.0001 | 0.00 (0) | 4/40 | 3/40 |
| 8 | 13, 4, 4 | 0.001 | 2.00 (1) | 2/40 | 2/40 |

The plan's rule picks **S 26 weeks, no guard band, window 1 week, at
q < 0.005**. QUESTIONS C3's proposal (26, 4, 4) is third: 8/40 and 11/40
at q < 0.01. The margin between ranks is thin: noise on the tuning year
is 0, 1, 2 or 3 episodes, so a setting jumps a whole level on one
episode.

**The chosen setting against the two baseline rows** (computed; D1 to
D4, D6, D7 and I1 read at the chosen q < 0.005, D5 at its own headline
level as the harness defines it; n 200 trials for each D5 rate, 1,000
for D6; the live rows are read at their operating levels):

| | chosen (26, 0, 1) | chosen + budget | live re-tuned year 1 | live shipped (tuned on test) |
|---|---|---|---|---|
| D1 E1, days (corrected onset) | 6 (11) | 6 (11) | 0 (5) | 0 (5) |
| D1 E2, days | 2 | 2 | 0 | 0 |
| D1 E3, E4 | not found, not found (not this test's kinds) | same | 0 d, first trend signal 2026-02-15 | 0 d, 2026-05-10 |
| D4 episodes a year (episodes; 95 % interval) | 5.02 (10; 2.41 to 9.24) | 5.02 (10; 2.41 to 9.24) | 9.55 (19; 5.75 to 14.91) | 4.52 (9; 2.07 to 8.58) |
| D4 by kind: cluster / sentinel / data | 5.02 / 0 / 0 | 5.02 / 0 / 0 | 4.52 / 1.51 / 3.52 | 1.00 / 1.51 / 2.01 |
| D4 alerts a week | 0.096 (10) | 0.096 (10) | 0.183 (19) | 0.087 (9) |
| **D5 headline: level, noise a year (episodes)** | 0.001, 1.00 (2) | 0.001, 1.00 (2) | 0.3, 3.01 (6) | 3, 3.01 (6) |
| **D5 rare, k 4 (delay)** | **20.5 % (15.5 to 26.6), 5 d** | same | **92.0 % (87.4 to 95.0), 6 d** | 92.0 %, 6 d |
| **D5 common ESBL, k 4 (delay)** | **9.5 % (6.2 to 14.4), 5 d** | same | **75.0 % (68.6 to 80.5), 6 d** | 75.0 %, 6 d |
| D6, injected gaps with a non-data signal | 1.9 % (1.2 to 3.0) | 1.9 % | 2.6 % (1.8 to 3.8) | 1.2 % (0.7 to 2.1) |
| D7, named right (n) | 99.8 % (99.1 to 100; 617) | same | 98.7 % (98.1 to 99.1; 2,493) | 97.4 % (96.6 to 98.0; 1,982) |
| I1 alerts, incidents | 13, 12 (1.08) | 13, 12 (1.08) | 29, 26 (1.12) | 18, 15 (1.20) |

D3 is a data-signal metric and this test raises no data signals: 0 of
200 in every cell, by construction, not a result. D7 is high because
every signal of this test is a cluster signal; it says nothing about how
well a signal is named beyond that (E2 counts as found but not named
right, since the plan's rule asks for a sentinel as well). The two live
rows have one D5 headline because the re-tuned alphas sit on the same
sweep (harness review, finding 12).

**D2 at k 3 and 4 per family** (computed; rate with Wilson interval, median
delay in days; the live columns are the committed rows at their operating
levels; k 2, 6 and the controls are in `results.md`):

| family | k | chosen | delay | live re-tuned | live shipped |
|---|---|---|---|---|---|
| rare clone | 3 | 20.0 % (15.0 to 26.1) | 4 | 86.0 % | 61.5 % |
| rare clone | 4 | 37.5 % (31.1 to 44.4) | 4 | 98.0 % | 89.0 % |
| common resistant | 3 | 3.5 % (1.7 to 7.0) | 17 | 2.0 % | 0.5 % |
| common resistant | 4 | 3.5 % (1.7 to 7.0) | 3 | 1.0 % | 0.5 % |
| wild type | 3 | 1.5 % (0.5 to 4.3) | 4 | 0.5 % | 0.0 % |
| wild type | 4 | 4.5 % (2.4 to 8.3) | 6 | 0.0 % | 0.0 % |
| common ESBL *E. coli* | 3 | 8.0 % (5.0 to 12.6) | 4 | 70.0 % | 34.5 % |
| common ESBL *E. coli* | 4 | 24.0 % (18.6 to 30.4) | 5 | 88.0 % | 61.0 % |
| two units | 3 | 12.5 % (8.6 to 17.8) | 5 | 47.5 % | 21.0 % |
| two units | 4 | 13.5 % (9.4 to 18.9) | 6 | 56.5 % | 24.0 % |

The chosen setting's operating level has 5.02 episodes a year, not the
headline's 1.00: the harness's headline takes the loosest level at or
under 5, and level 0.005 has 10 episodes in 1.99 years, 5.02 (derived),
which misses the limit by 0.02. The D5 curve around it (computed):

| level q below | noise a year (episodes) | rare, k 4 | common ESBL, k 4 | two units, k 4 |
|---|---|---|---|---|
| 0.0001 | 0.00 (0) | 8.5 % | 0.5 % | 0.0 % |
| **0.001 (headline)** | 1.00 (2) | 20.5 % (41/200), 5 d | 9.5 % (19/200), 5 d | 3.0 % |
| 0.005 (year-1 level) | 5.02 (10) | 37.5 % (75/200), 4 d | 24.0 % (48/200), 5 d | 13.5 % |
| 0.01 | 12.06 (24) | 45.5 % (91/200), 4 d | 33.5 % (67/200), 5 d | 21.0 % |
| 0.05 | 40.69 (81) | 74.0 %, 4 d | 64.5 %, 5 d | 50.0 % |
| 0.2 | 179.36 (357) | 97.5 %, 2 d | 94.0 %, 3 d | 89.0 % |

For comparison the live set re-tuned reaches 92.0 % and 75.0 % at 3.01
episodes a year and 98.0 % and 88.0 % at 6.03 (committed rows). At
about 5 episodes a year the chosen test is at 37.5 % and 24.0 %, 54.5
and 51.0 points below the live set re-tuned at 3.01 (derived). `out/d5-curves.png` draws all four curves with the
Wilson band.

**The budget** (B = 3 series per ISO week) does nothing at the chosen
level: of the 52 daily signals at q < 0.005 over the whole data, 0 are
dropped, and every D2 to I1 number equals the no-budget row. It binds at
loose levels only: at q < 0.2 the noise falls from 179.4 to 106.5
episodes a year and the rare rate at k 4 from 97.5 % to 92.0 % (D5
curve of `metrics-budget.json`); at q < 0.05 from 40.7 to 37.7 and 74.0 %
to 72.5 %; from q < 0.02 down there is no difference.

**Where the noise and the detections come from** (computed, `results.md`).
The 10 noise episodes at the chosen level are all organism x specimen
series, none a phenotype series: five are blood series with a
predictive mean under 0.1 (two to four isolates against a mean of 0.00
to 0.08, for example two *E. faecalis* in MED-A blood in a week), three
are urine series with a mean near 0.4 to 0.5 and five isolates, two are
large series (ED *E. coli* urine, 25 against 10.5; PHC-N *K. pneumoniae*
urine, 11 against 2.3). The test has 27.5 tested series a day on average
(16 to 40) with both families, so BH multiplies every p by up to 27; with
the 36 phenotype series alone it has 0.7. Of the 75 detected rare
clusters at k 4, 64 had a signal on a phenotype series and 26 on an
organism series; 12 of 62 clusters in the large units and 63 of 138 in
the others were found; 24 of 35 MRSA clusters and 51 of 165 ESBL
clusters.

**The grid on the scoring period** (computed; exploratory: every row is
scored on the scoring period and read at its own D5 headline level,
which comes from the scoring period's noise, so a row picked here is
picked on the scoring period; the S 52 rows need 60 weeks of data and
cannot be tuned on year 1; the chosen row is the same test as above read
at the headline):

| setting (S, g, L) | D5 level | noise a year (episodes) | rare, k 4, delay | common ESBL, k 4, delay | I1 alerts / incidents |
|---|---|---|---|---|---|
| 13, 0, 1 | 0.001 | 1.51 (3) | 19.0 %, 5 d | 9.5 %, 5 d | 5 / 5 |
| 13, 0, 4 | 0.005 | 3.52 (7) | 14.5 %, 10 d | 3.0 %, 13 d | 9 / 9 |
| 13, 4, 1 | 0.001 | 1.00 (2) | 22.5 %, 5 d | 13.5 %, 5 d | 4 / 4 |
| 13, 4, 4 | 0.005 | 4.52 (9) | 14.5 %, 12 d | 4.0 %, 9 d | 11 / 11 |
| 26, 0, 1 (chosen) | 0.001 | 1.00 (2) | 20.5 %, 5 d | 9.5 %, 5 d | 4 / 4 |
| 26, 0, 4 | 0.01 | 2.51 (5) | 21.0 %, 10 d | 8.0 %, 11 d | 9 / 7 |
| 26, 4, 1 | 0.001 | 1.00 (2) | 20.5 %, 5 d | 11.0 %, 5 d | 5 / 4 |
| 26, 4, 4 (C3's cell) | 0.005 | 3.01 (6) | 15.5 %, 12 d | 8.5 %, 13 d | 11 / 8 |
| 52, 0, 4 | 0.01 | 4.02 (8) | 23.5 %, 9 d | 9.0 %, 12 d | 11 / 10 |
| 52, 4, 4 | 0.01 | 4.02 (8) | 22.5 %, 10 d | 9.0 %, 13 d | 11 / 10 |

All ten rows have rare rates of 14.5 % to 23.5 % and common ESBL rates of
3.0 % to 13.5 % at 1.0 to 4.5 episodes a year. No two rare intervals are
apart; for common ESBL three of the 45 pairs are (computed from the
counts and the Wilson intervals): (13, 0, 4) at 3.0 % and (13, 4, 4) at
4.0 % against (13, 4, 1) at 13.5 %, and (13, 0, 4) against (26, 4, 1) at
11.0 %. Apart from S 13 with a 4-week window, nothing separates baseline
length, guard band or window. Windows of 4 weeks are slower (median delay
9 to 13 days against 5 for L 1). The four S 13 rows contain 150
tested cells with shape alpha exactly 0 (blood series of rare organisms
in ED and MED-A with no event in 13 weeks in the hospital), read as
p = 0; the S 26 and S 52 rows have none.

**Controls, not in the plan** (computed; both through `score_detector`
on the rare and common ESBL families only):

| test on the same phenotype series | noise a year (episodes) | rare, k 4 | common ESBL, k 4 |
|---|---|---|---|
| live phenotype excess alone (Poisson, 365-day baseline, alpha 1e-3 x m) | 1.00 (2) at m 1 | 56.0 % | 40.5 % |
| | 1.51 (3) at m 3 | 65.5 % | 53.0 % |
| | 4.02 (8) at m 10 | 78.0 % (71.8 to 83.2) | 70.0 % (63.3 to 75.9) |
| this test, 36 phenotype series only, (26, 0, 1) | 0.50 (1) at q < 0.001 | 44.5 % | 40.0 % |
| | 3.01 (6) at q < 0.005 | 71.5 % | 65.0 % |
| | 5.53 (11) at q < 0.01 | 83.0 % | 77.5 % |
| this test, both families, (26, 0, 1) | 1.00 (2) at q < 0.001 | 20.5 % | 9.5 % |
| | 5.02 (10) at q < 0.005 | 37.5 % | 24.0 % |

The other three phenotype-only settings (26, 0, 4), (26, 4, 1), (26,
4, 4) read 66.5 % to 72.5 % rare and 58.0 % to 68.0 % common ESBL at 1.5
to 2.0 episodes a year (`results.md`).

**Checks** (computed): BH agrees with `statsmodels` `fdr_bh` to 2.2e-16
on every day; p agrees with a direct sum of the negative binomial pmf to
1.5e-11 (relative, 60 random tested cells at two settings); event counts
y and C agree with a plain-Python loop of the event definition in 24 of
24 cells; the trial fast path of `gamma_poisson.py` gives the same
signals, q-values and budget flags as the from-scratch computation in
558 of 558 trials (max relative difference 0), and no trial of the run
took the fallback; `check_causal` on 2024-12-11, 2025-06-18 and
2026-03-11 (Wednesdays, so the weekly budget is cut mid-week) finds no
difference for any of the 24 detectors (ten settings with and without the
budget, four phenotype-only settings).

**The card** (`out/figure.png`, `out/card.json`): URO, ESBL, as of
2025-06-15 at the chosen setting: 5 patients in the week, usual 0.6
(predictive 95 % interval 0 to 3), p 6.9e-4, BH-adjusted 2.1e-2 with 31
tested series that day, budget 1 of 3. The adjusted value does not pass
the chosen level on that day; the series first passed q < 0.005 on
2025-06-10, 6 days after 0001's E1 start date and 11 after its first
outbreak isolate (D1 above). The card is drawn for the chosen setting
(no guard band, window 1 week) and not for (26, 4, 4), which the plan's
sketch names, so the guard-band strip is absent and the legend says so.

### Deviations from plan

1. **Event rule.** "First isolate of the series in that unit within the
   trailing 365 days" is implemented as: an isolate is an event when the
   same patient has no earlier isolate of that series in that unit in
   the 365 days before it (any earlier isolate, counted or not), at most
   one event per patient and day. Reading it as restarting the clock only
   at counted events differs for patients re-sampled over more than a
   year. Proposed (overnight), pending Artem.
2. **The alert budget is evaluated as of the day.** The plan keeps the 3
   highest scores of an ISO week, which on Tuesday would read Thursday's
   rows and fail `check_causal`. A signal of day t is kept when its series
   is among the 3 with the highest running maximum of the score over
   the ISO week up to t (ties to the series sorting first by name),
   among the signals passing the level. A series admitted early in a
   week can be bumped by a more surprising one later. Each signal carries
   its survival at every sweep level in the otherwise unused `profile`
   field, because the budget is not a monotone p.
3. **Levels.** The plan says metrics.json is the chosen setting without
   budget; the level for D2 to D4, D6, D7 and I1 is the setting's
   tuning-year operating level (q < 0.005), as the rule that chose it
   implies; D5 is read at the harness's own headline level, as the
   baseline rows are. The grid rows are all read at their D5 headline
   level and so are exploratory.
4. **Series universe and BH family.** 36 unit x phenotype series and
   9 x 9 x 3 = 243 unit x organism x specimen series, fixed whatever the
   data (a series that never occurs is never tested); one BH family per
   day over both families together, as "across the series tested on day
   t" reads.
5. **Shape alpha 0.** When neither the unit nor the hospital had an event
   of the series in the baseline the predictive is degenerate at 0 and p
   is 0, clipped to 1e-300 (150 cells, S 13 settings only, none at the
   chosen setting). No floor was added.
6. **Grid scope.** The plan expected trials for the chosen setting only;
   all ten settings were scored in full (five families, k 0 to 6, gaps)
   because the trials cost 3 ms each. None of the plan's cuts was
   needed.
7. **Additions.** The control of the live phenotype-excess test alone
   (`control.py`), the phenotype-series-only variant, the diagnostics
   (which series signal, large against other units), the list of noise
   episodes, `d5-curves.png`, the numeric checks, and the engine of
   `gamma_poisson.py` that computes a trial's tests for the days of
   its window only (exact, as checked).
8. **D3** is left as computed zeros and not read (the plan leaves D3 out).

## Interpretation

**Against METRICS.md "Decision rules".** The headline for detection is D5
for the rare and the common ESBL family at 5 episodes a year with D2's
median delay at k 4. The test as specified gives 20.5 % and 9.5 % at the
harness's headline (1.00 episodes a year) and 37.5 % and 24.0 % at
5.02, with a median delay of 4 to 5 days; the live set re-tuned on year 1
gives 92.0 % and 75.0 % at 3.01 episodes a year with a delay of 6 days.
The intervals do not touch. The directional expectation of the plan (rare
at least 95 %, common ESBL at least 70 % at 5 episodes a year) is
refuted for both families by 57 and 46 points at the nearest level. The
expectation that the common resistant and wild-type families stay near
0 % holds loosely: 3.5 % and 4.5 % at k 4 against controls of 0.5 % and
1.0 % and the live set's 1 of 180. The two-unit family, with no
expectation, is at 13.5 % at k 4 against 56.5 % (re-tuned). On these
numbers the test would not replace or join the live cluster tests; the
overnight run proposes nothing to change in D-020. The leaderboard is
screening, not selection: nothing here was re-scored on seeds 2027 to
2030, and a row so far behind its reference does not call for it.

**What the grid says about QUESTIONS C3 and C4.** Baseline length (13,
26, 52 weeks), the guard band (0 or 4) and the window (1 or 4 weeks) move
the rare rate between 14.5 % and 23.5 % at 1.0 to 4.5 episodes a year,
and the intervals overlap; no setting stands out (for common ESBL only the
two S 13 rows with a 4-week window are lower, 3.0 % and 4.0 %), and the guard band is
not the thing that matters here (chosen setting without one; (26, 4, 4)
at 15.5 % and 8.5 % in the grid). The synthetic data has no weekday or
season pattern (0002's review, measured), so a sweep over S says less
about real data than it would. q: the useful range is q of 0.001 to
0.005, which is a raw p near 1e-4 once BH has multiplied by the 27 or so
tested series. B: three per week never binds at those levels (0 of 52
signals dropped) and binds only above q of 0.05, where noise is over
38 episodes a year. The tuning rule is brittle: the tuning year has 0 to
3 noise episodes per setting and the plan's 5-a-year limit falls on the
step between two and three.

**The strongest alternative explanation: the series, not the test.**
The deficit is not caused by the Gamma-Poisson predictive, the guard band
or BH. On the same 36 phenotype series, this test (26, 0, 1) reaches
71.5 % rare and 65.0 % common ESBL at 3.01 episodes a year and 83.0 % and
77.5 % at 5.53, and the live Poisson test reaches 78.0 % and 70.0 % at
4.02: the live point lies between the two of this test, within their
Wilson intervals, so the plan's hoped gain from the negative binomial over
the Poisson is not visible (and not refuted either: any difference is
smaller than the interval).
What costs the test its sensitivity is adding the 243 organism x specimen
series. They are 10 of the 10 noise episodes at the operating level and
they raise the BH family from 0.7 to 27.5 tested series a day, which
can cost a phenotype signal up to the same factor in q (derived). Half of those noise
episodes are blood series with a predictive mean under 0.1, where two
isolates in a week against a baseline of none give p near 1e-4: the
sparse-series sentinel behaviour the plan warned of (the prior is worth
2.6 pseudo-weeks of a hospital rate that is itself near zero, and the
minimum count is 2). They are also the series that cannot see the
injected clones (26 of 75 detections of rare k 4 came through an organism
series, and 64 through a phenotype series). So the experiment says that
the plan's series mix is the wrong one for this noise budget; it does not
say that Gamma-Poisson with BH is a worse test than Poisson on the same
series. Two cautions: the control rows are screening on one seed, and
they were added after the first full run (they feed no setting); and the
noise counts are 1 to 11 episodes, so every noise value above has an
interval as wide as D4's (for example 10 episodes: 2.4 to 9.2 a year).

**What it would change for the doctor or the researcher.** Nothing now.
Had it matched the live rows at equal noise, the feed would gain "3 of 41
tested series today" and a predictive band on every cluster alert (the
card); the card is there to show that the counts are small (5 patients
in a week against 0.6 usual) and that BH moves that signal from p 6.9e-4
to q 2.1e-2; the series passed the chosen level on 2025-06-10, five days
before the card's date.

**Next.** (1) The Gamma-Poisson-with-BH test on the phenotype series
alone, tuned on year 1 by the same rule, as a like-for-like replacement
for the live phenotype-excess test (the control above is its sketch),
together with a profile series (unit x organism x specimen x 13-drug
profile) so the rare-clone family is read where the live profile test
reads it; BH within each family rather than across both. (2) A minimum
count of 3 or a floor on the prior shape, to see how much of the
organism-series noise is the 2-isolate blood pairs. (3) A literal
Tarone-type filter has nothing to remove for a count with unbounded
support (the foundation says so); a power filter that drops series whose
p at the minimum count is above the level would shrink the BH family and
is the version worth trying. (4) Only a variant that beats the live
row's D5 at equal noise should be re-scored on seeds 2027 to 2030.

## Decision numbers (2026-10-17, after close)

This record cites D-038 (the Beta-binomial method) and D-039 (detection on raw
counts) in the numbering of the overnight base. On main those two are D-041 and
D-042; D-038 and D-039 on main are other decisions.
