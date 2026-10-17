---
status: accepted
by: Claude Code, operated by Artem (overnight run)
data: [synthetic_microbiology_dataset, seed 2026, as received 2026-10-09]
parent: 0016
---

# 0022 Do the re-tuned live set and the 0016 CUSUM add up: rank product and a year-1 stacked logistic against the live set at 5 episodes a year

## Goal

Establish whether combining tonight's two best detectors by D5, the year-1 re-tuned live set
(D5 rare 0.92, common ESBL 0.75 at 3.0 episodes a year; measured, baseline row) and the 0016
CUSUM union (0.665 and 0.485 at 3.5 a year; measured, 0016), gives a higher D5 at the same
noise than the live set alone. The answer decides whether method 21 earns a place in the
morning table and whether a CUSUM module belongs in `libs/utils` at all: if neither
combination beats the reference row, the CUSUM stays an experiment and the live set stands.

## Hypothesis

Exploratory, in so many words: no combination rule has been tried on this data and the
overlap of the two detectors' detections has not been measured, so this plan describes a
curve and states a direction, not a confirmed effect. The yardstick is D5 at 5 episodes a
year against `live-set-retuned-year1`: the headline (loosest level with cluster-and-sentinel
noise at most 5 a year) for the rare and the common ESBL family, and beside it the rate
interpolated at exactly 5 a year between the bracketing levels (harness review finding 12;
proposed (overnight), pending Artem), because the reference's grid lands at 3.0 a year and
its next point at 6.0 a year reads rare 0.98, common ESBL 0.88 (measured, 0016 table), so
its interpolated values at 5 a year are about 0.96 and 0.84 (computed, linear).

Direction with a number. The CUSUM's Bernoulli part watches resistant proportions per unit
and surveillance pair and found 66 of its 97 common ESBL detections alone (measured, 0016),
a signal the live set's phenotype-excess count test does not read, so the rank product is
expected to add to common ESBL and leave rare where it is: common ESBL at 5 a year at least
0.05 above the reference's interpolated 0.84, rare within 0.03 of its 0.96; two-unit at
k = 4 at the operating level not below the reference's 0.565 (measured, baseline row at
level 1), since both components key on one unit and the CUSUM's own two-unit rate is 0.19.
The stacked logistic is expected within 0.05 of the rank product on both families (few
training events, three features). The references: the intersection below both components
on D5 with D4 under 2 a year; the union no better than the reference once its noise is
matched. If the rank product reads below the reference's interval on either headline family,
combination has cost sensitivity for no noise gain and the result is negative; the primary
row is the rank product, named here before the run, so that choosing the better of the two
ensembles afterwards is seen for the selection it is.

## Experiment

**Data and split.** The synthetic dataset as received, isolates and cultures, first-isolate
rules as the harness. Tuning year 2023-10-02 to 2024-09-30; scoring 2024-10-01 to
2026-09-27; nothing below reads a scoring-period number before the harness does.

**Components.**

- A: the year-1 re-tuned live set, `retune_live_set` with the harness defaults (Choices 5),
  its cluster and sentinel signals only (profile excess, phenotype excess, new-in-unit); the
  trend and data signals are left out, as D5's noise is (Choices 3). Level 1 = the re-tuned
  alphas (profile 1e-3, phenotype 1e-2; measured, baseline row). A is run at its loosest
  level (100 × alphas), so its score field is dense.
- B: the 0016 union, Poisson weekly θ 8 no guard band plus Bernoulli θ 8 guard band 4 weeks,
  equalised mapping p = 1/A(S_t) per series, run at 0016's loosest level. The implementer
  copies `experiments/0016-cusum/cusum.py` into a new module `libs/utils/py/aei/cusum.py`
  (public: `World`, `real_world`, `Cusum`, `level_of_years`; no import from `experiments/`),
  leaves 0016's files untouched, and adds `libs/utils/py/tests/test_cusum.py`: on the real
  data the union at L = 72.1 years raises 7 fixed-key episodes over the scoring period and
  100, 14, 4 at L = 10, 30, 100 years (measured, 0016); the year-1 `tune_curve` rows for the
  parts at L = 100 reproduce rare 14/40 (Poisson) and 19/40 (Bernoulli); and, marked slow,
  `score_detector` reproduces 0016's headline 0.665 and 0.485 at 3.52 a year.

**Join key and the score field.** The harness's fixed key: cell c = unit × organism-or-
phenotype (a Bernoulli pair maps to its organism, a live profile signal to its organism,
specimen dropped), day t. Each component's score is s_j(c, t) = min p over its signals in
c dated in (t − 6, t], so a weekly Poisson signal and a daily live signal of the same week
meet (proposed (overnight), pending Artem; the exact-day join is reported beside it as a
sensitivity row of the D5 curve). A silent component scores 1. New-in-unit, a rule without
p, scores as p = 1e-6 (below every tested p; proposed, pending Artem).

**Rank product.** Ranks are quantiles against year-1 background only: q_j(s) =
(1 + #{background cell-days of component j with s_j ≤ s}) / (N_j + 1), background = the
real data's cell-days 2024-01-01 to 2024-09-30 (13 weeks of CUSUM baseline first; proposed,
pending Artem, alternative 2024-04-01), frozen at 2024-09-30 and never updated, so the map
is causal. RP(c, t) = √(q_A q_B); the harness p is the independence null P(√(U₁U₂) ≤ RP) =
RP² (1 − 2 ln RP) (Mathematical foundation). One `Signal` per cell-day with RP below the
loosest level: detector `ensemble_rp`, key c, ward the unit, kind cluster, or sentinel when
only new-in-unit fired. Levels, loosest first: p ∈ {0.3, 0.1, 0.03, 0.01, 3e-3, 1e-3, 3e-4,
1e-4, 3e-5, 1e-5, 3e-6, 1e-6}; `default_level` = the loosest with year-1 noise (`tune_curve`
`noise_per_year`, cluster and sentinel) at most 5 a year, so D2, D4, D6, D7 and I1 are read
at a level chosen on year 1, as 0016 read them at L_sim.

**Stacked logistic.** Features per cell-day: x₁ = −log₁₀ s_A, x₂ = −log₁₀ s_B (0 when
silent), x₃ = 1 if both fired; each scaled by its year-1 standard deviation. Training rows
from year 1 only: positives = cell-days of the injected key from the first injected isolate
to start + 28 in `tune_curve`'s seed-2026 stream extended to 200 trials per family (rare,
common ESBL; starts 2024-04-01 to 2024-08-15; the first 40 per family coincide with the
events the components' settings were chosen on, Wolpert's caveat, accepted for the night;
a disjoint stream needs a seed outside 2026 to 2030, pending Artem); negatives = every real
cell-day 2024-04-01 to 2024-09-30 from the un-injected run. Fit with `aei.logistic.
fit_logistic`, L2 λ = 1 on the scaled features, intercept unpenalised (proposed, pending
Artem; a 5-fold grouped-by-trial CV over λ ∈ {0.1, 1, 10} is the first thing to add if time
remains). Output π; the harness p = share of year-1 background cell-days with π at least
this large (upper-tail ECDF, monotone, frozen), the same level grid and `default_level`
rule as the rank product; detector `ensemble_stack`. Weights, scales and λ to
`out/stack.json`.

**References.** Union: p = min(s_A, s_B), levels as the rank product; intersection:
p = max(s_A, s_B). Both through the same `Detector` surface, scored on D5 only (`parts`),
100 trials per cell, never candidates. A and B alone are the baseline rows and 0016.

**Scoring.** `aei.score_detection.score_detector` for both ensembles: seed 2026, 200
trials per cell, five families, k ∈ {0, 2, 3, 4, 6}, gaps; `tuned_on_test` false;
`partly_tuned_on_test` inherited from the reference (new-in-unit's 180 days). Seeds 2027 to
2030 are not read by `run.py`; the orchestrator's `confirm` re-scores a winner on them.
`check_causal` on 2025-03-31, 2025-12-31 and 2026-06-30 with B built from the rows given
(`Cusum(rebuild=True)`), on the ensemble as a whole. Intervals: Wilson per cell, exact
Poisson on D4. Beside the headline: D5 noise and level, the interpolated rate at 5 a year,
and the year-1 ratio of the analytic rank-product p to its empirical tail at the operating
level (the dependence check). Also reported: of the ensemble's rare and common ESBL
detections at k = 4, how many A alone, B alone and both would have given at their own
operating levels, as 0016's parts table.

**Budget.** 10 minutes of CPU, `aei.harness.Clock`. Estimate: a trial costs about 10 ms
for A (93 s for the reference's whole scoring; measured, baseline row) and 3 ms for B
(0016), so an ensemble trial about 15 ms; two ensembles at about 6,000 trials each plus
two references at D5 only, about 4 minutes, plus year-1 runs under 1 minute (assumed). The
implementer may run A and B once per trial and derive all four rules from the cached
signals, since `seed_trials` fixes the stream. Cuts, in order, each recorded under
Deviations: (1) drop the exact-day sensitivity row; (2) references to 50 trials per cell;
(3) drop the intersection; (4) wild type and common resistant to 100 trials for the stack;
(5) the stack's training stream to 100 trials per family. Never the rank product's 200.

**Command and outputs.** `uv run python experiments/0022-ensemble/run.py`. `out/results.md`
(every table), `out/metrics.json` through `aei.harness.write_metrics` for the rank product,
`out/metrics-stack.json`, `out/metrics-union.json`, `out/metrics-intersection.json`,
`out/ranks.json` (background sizes, the quantile maps' knots), `out/stack.json`,
`out/figure.png` (Proposed visualisation; `metadata={"Software": None}`, under 1 MB).
`uv run python scripts/verify_experiments.py --only 0022` must say "reproduces".

## Mathematical foundation

**Rank product.** Breitling, Armengaud, Gentleman and Herzyk (2004, FEBS Letters) rank each
item within each of k lists and score it by the geometric mean of its ranks, RP =
(∏ r_i)^{1/k}, with significance by permutation; Eisinga, Breitling and Heskes (2013, FEBS
Letters) give the exact null distribution of the rank product, Heskes, Eisinga and Breitling
(2014, BMC Bioinformatics) a fast approximation. Here the lists are the two components'
scores over cell-days, and the ranks are quantiles against a frozen background, so under
the null "a background cell-day" each q_j is uniform on (0, 1] up to ties. For independent
uniforms the product ∏ U_i is distributed as e^{−G}, G ~ Gamma(k, 1), so P(∏ U_i ≤ z) =
z Σ_{j<k} (−ln z)^j / j!; with k = 2, P(U₁U₂ ≤ z) = z (1 − ln z), and with z = RP²,
p(RP) = RP² (1 − 2 ln RP), a monotone map, so `passes` reads the sweep from one run.

**Where the null is wrong, and what repairs it.** The two components read the same
isolates (the CUSUM's Poisson series and the live set's phenotype excess count the same
first isolates), so q_A and q_B are positively dependent, the product sits lower under the
null than independence says, and p(RP) is anti-conservative: more background cell-days
pass a given level than the formula promises. This is why a combined threshold must be
re-swept on measured noise and cannot be set from the formula: the harness's D4 at each
level is the calibration, and the year-1 empirical tail of RP measures the gap. The
multiplicity a combined threshold carries is the sweep's: twelve levels, the headline the
loosest with noise under 5 a year, a selection on a Poisson count of about ten episodes
(finding 12b), the same as every row; plus, for this record, the choice among combination
rules, which is why the primary rule is fixed above. A silent component (q = 1) does not
veto: RP = √q_A, so A alone passes level x when q_A ≤ x², a diluted but open route; the
intersection is the rule that vetoes, the union the rule that never does, which is why
both are the references.

**Stacking.** Wolpert (1992, Neural Networks) and Breiman (1996, Machine Learning): a
level-1 model learns to combine level-0 predictions, and must be trained on predictions
made for data the level-0 models were not fitted to, or it learns their overfit. Here the
level-0 settings (alphas, θ, guard bands) were chosen on 40 year-1 events of the same
stream the stack trains on; the stack is three weights on scaled log scores, so what can
leak is small, and the scoring period is untouched. Logistic regression: logit π = β₀ +
βᵀx, Bernoulli likelihood, penalty λ‖β‖²/2 on the slopes, Newton's method
(`aei.logistic`); the fit exists for any separable training set because of the penalty.
Any monotone map of βᵀx is a valid harness score, so π's calibration does not matter,
only its order; the year-1 tail ECDF gives it the same meaning as the rank product's p
(share of background cell-days at least this extreme) before the harness re-sweeps both.

**Causality.** A signal at t uses A's and B's signals dated in (t − 6, t], each causal
(`check_causal` passed for both in their records), and maps frozen at 2024-09-30 (quantile
knots, β, scales), so the ensemble is causal by construction; the check on three cut dates
guards the implementation, not the argument.

**Assumptions and where it breaks.** (1) The fixed key loses the live set's specimen and
profile resolution: two specimens' signals in one unit-organism-day merge at min p, as D4
already merges them. (2) Ranks assume year 1 is a fair background for the scoring period;
the cluster detectors' baselines are shorter in year 1 (finding 13), so year-1 p-values run
larger and the quantile map is looser than a full-year background would give, in the same
direction for both components. (3) With about 400 positive training rows and three
features the stack is stable, but if B is silent on most positives x₂ carries little and
the stack reduces to A. (4) The 7-day carry-forward can date a combined signal up to 6 days
after the component's, which lengthens D2's delay by at most that.

**References.** Breitling et al. 2004 (FEBS Letters 573:83); Eisinga, Breitling, Heskes
2013 (FEBS Letters 587:677); Heskes, Eisinga, Breitling 2014 (BMC Bioinformatics 15:367);
Wolpert 1992 (Neural Networks 5:241); Breiman 1996 (Machine Learning 24:49); Hastie,
Tibshirani, Friedman 2009 (Elements of Statistical Learning, 4.4 and 8.8).

## Why this method here

0016 closed with the combination as its third next step: the CUSUM's noise at L_sim is
lower than the reference's at its operating level (3.5 against 9.5 episodes a year over
all kinds; measured) and the live set's sensitivity is higher, and the two look at
different things, counts of a profile within a specimen against a running proportion by
pair. 0016's parts table showed the two CUSUM parts were complementary (70 and 10 of 133
rare detections from one part alone), which is the pattern a rank product rewards. For
the researcher it would mean one feed where agreement between two unlike tests is the
ranking, and a card can say which test spoke; for the doctor nothing changes tonight, the
live thresholds are Artem's to move. If the result is negative, it says the live set's
misses are not the CUSUM's finds, and the next method should look elsewhere, at a drip
family or at profile-level likelihoods (0016's next steps 1 and 2).

## Proposed visualisation

One card of the researcher's signal feed, matplotlib, light background, 12 by 5 inches
at 120 dpi. Three stacked panels sharing a weekly x-axis of 16 weeks ending at the as-of
date 2025-06-15 for the cell URO × ESBL (E1's weeks), labelled "Week starting" with dates
every two weeks. Top panel, "Live set": stems from 0 to −log₁₀ p for each day with a
cluster or sentinel signal, circle markers, the re-tuned operating alpha as a dashed line.
Middle panel, "CUSUM": the same with square markers for the Bernoulli part and triangles
for the Poisson part, the L_sim limit dashed. Bottom panel, "Combined (rank product)": a
step line of −log₁₀ p(RP) by day, the operating level dashed, the first crossing marked
with a vertical line and its date in text; weeks where both components fired are shaded
light grey behind all three panels and labelled "both" once. Under the x-axis a row of
small integers: first ESBL isolates in URO that week. Legend by shape and label, never
colour alone; the y-axis labelled "−log10 p"; texts short ("Live set", "CUSUM", "Combined",
"both", "limit", "first alarm") for Finnish. Saved as `out/figure.png` with
`metadata={"Software": None}`.

## Result

`uv run python experiments/0022-ensemble/run.py` ran in 153 s wall and 151 s of CPU on the last run (measured, 166 s on an earlier one; budget 10
minutes, plan estimate about 5; no cut made). Seed 2026 only, 200 trials per cell for every row (the plan's
cut 2, references at 50 or 100 trials, was not needed: component A and B are run once per trial and cached, so the
two references and the exact-day sensitivity row cost 11 to 14 s each at 200 trials); seeds 2027 to 2030 not used;
`tuned_on_test` false for the primary rows, `partly_tuned_on_test` ["rising-trend", "new-in-unit"] inherited.
Everything below is measured by that run unless tagged computed; `out/results.md` has every table, `out/metrics.json`
the rank product (primary), `metrics-stack.json`, `metrics-union.json`, `metrics-intersection.json`,
`metrics-rp-exact.json` the others, `ranks.json`, `stack.json`, `grid.json` the curves, `figure.png` the card.
`libs/utils/py/aei/cusum.py` (the 0016 CUSUM, behaviour unchanged) and `libs/utils/py/tests/test_cusum.py` are new; the
test reproduces 0016's 7, 100, 14, 4 episodes at L = 72.1, 10, 30, 100 years and the year-1 rows rare 14/40 (Poisson) and
19/40 (Bernoulli), and, with `AEI_PERF=1`, the headline 0.665 and 0.485 at 3.52 a year.

**Year-1 settings (measured).** Operating level = the loosest with `tune_curve` noise at most 5 a year: rank product
p = 3e-5 (noise 0 in the half year, rare 23/40, common ESBL 27/40), stack p = 3e-4 (0 episodes, 18/40 and 21/40),
exact-day rank product p = 3e-5. Stack: 21,394 positive rows (18,983 with a component signal) from 200 + 200
injected clusters of 4 and 21,411 negative real cell-days (3,687 with a signal); intercept -1.79, weights 3.69 on
-log10 s_A, 1.56 on -log10 s_B, -0.64 on "both fired" (scales 1.81, 2.06, 0.40; `out/stack.json`). Background for
the ranks: 117 cells x 274 days = 32,058 cell-days, fired in A 1,566 and in B 3,498.

**Dependence check (measured, year-1 background).** Analytic p of the independence null against the share of
background cell-days with p below it: ratio analytic / empirical 2.35 at 0.3, 1.1 at 0.01, 0.41 at 1e-3, 0.34 at 3e-4,
0.18 at 1e-4 (empirical tail 2.4, 2.9 and 5.6 times the nominal), and 0 cell-days below 3e-5, so the ratio at the
operating level is undefined (0 of 32,058). The formula is conservative at loose levels (most cell-days are silent,
q = 1) and anti-conservative in the tail, as the plan said; the D4 sweep is the calibration.

**D5 at about 5 episodes a year (k = 4; Wilson 95 %; level is a p of the rule, the reference's a multiple of its alphas).**

| row | level | noise a year (episodes) | rare | common ESBL | at 5.0/yr rare / common ESBL (computed) |
|---|---|---|---|---|---|
| live re-tuned year 1 (reference) | x0.3 | 3.01 (6) | 0.920 [0.874, 0.950] | 0.750 [0.686, 0.805] | 0.960 / 0.837 |
| CUSUM union 0016 | L = 72.1 y | 3.52 (7) | 0.665 [0.597, 0.727] | 0.485 [0.417, 0.554] | 0.708 / 0.573 |
| rank product (primary) | 1e-3 | 4.52 (9) | 0.940 [0.898, 0.965] | 0.830 [0.772, 0.876] | 0.942 / 0.834 |
| stack | 3e-3 | 3.01 (6) | 0.990 [0.964, 0.997] | 0.850 [0.794, 0.893] | 0.991 / 0.865 |
| union (min p) | 3e-5 | 3.52 (7) | 0.840 [0.783, 0.884] | 0.555 [0.486, 0.622] | 0.856 / 0.600 |
| intersection (max p) | 3e-3 | 4.52 (9) | 0.970 [0.936, 0.986] | 0.850 [0.794, 0.893] | 0.971 / 0.857 |
| rank product, exact-day join | 1e-4 | 2.01 (4) | 0.895 [0.845, 0.930] | 0.775 [0.712, 0.827] | 0.937 / 0.826 |

Delays at the headline (median days, rare / common ESBL): reference 6 / 6, rank product 5 / 6, stack 5 / 6, union 6 / 6,
intersection 5 / 6, 0016 7 / 6. The headline rows sit at different noise (3.0, 3.5, 4.5 a year; finding 12b), so the
fixed-noise reading is the fairer one (computed, linear in the episode count between bracketing levels; exact where a
level has that count; no interval, the curve rows in `out/results.md` carry them):

| row | rare / common ESBL at 1.5 a year (3 episodes) | at 3.0 a year (6) | at 5.0 a year (10) |
|---|---|---|---|
| live re-tuned year 1 | 0.815 / 0.440 | 0.920 / 0.750 | 0.960 / 0.837 |
| rank product | 0.880 / 0.735 | 0.910 / 0.782 | 0.942 / 0.834 |
| stack | 0.670 / 0.290 | 0.990 / 0.850 | 0.991 / 0.865 |
| union | 0.655 / 0.330 | 0.795 / 0.483 | 0.856 / 0.600 |
| intersection | 0.930 / 0.710 | 0.950 / 0.780 | 0.971 / 0.857 |
| CUSUM union 0016 | 0.530 / 0.307 | 0.655 / 0.475 | 0.708 / 0.573 |

At exactly 3 episodes the rank product's common ESBL 0.735 [0.670, 0.791] is clear of the reference's 0.440 [0.373, 0.509]
and its rare 0.880 [0.828, 0.918] overlaps the reference's 0.815 [0.755, 0.863]. The rank product reaches 0.81 rare and
0.54 common ESBL at 0 episodes in the scoring period (level 1e-4; Poisson 95 % upper bound 1.85 a year), the reference's
grid stops at 1.5 a year. At 5 a year the rank product and the reference are the same (0.942 and 0.960, 0.834 and 0.837).

**D2 at the year-1 operating level, k = 4, with median delay (200 trials per cell).** Operating levels are far
stricter than the headline (scoring-period D4 0 and 1.0 episodes a year), so these cells are not noise-matched to
the reference's level 1 (D4 9.5 a year all kinds, 4.5 cluster).

| family, k = 4 | live re-tuned (level 1) | 0016 union | rank product (3e-5) | stack (3e-4) |
|---|---|---|---|---|
| rare | 0.980 [0.950, 0.992], 5 d | 0.665 [0.597, 0.727], 7 d | 0.685 [0.618, 0.745], 8 d | 0.620 [0.551, 0.684], 7 d |
| common ESBL | 0.880 [0.828, 0.918], 6 d | 0.485 [0.417, 0.554], 6 d | 0.355 [0.292, 0.423], 7 d | 0.230 [0.177, 0.293], 8 d |
| two unit | 0.565 [0.496, 0.632], 7 d | 0.190 [0.142, 0.250], 7 d | 0.040 [0.020, 0.077], 7 d | 0.070 [0.042, 0.114], 6 d |
| common resistant | 0.010 [0.003, 0.036] | 0.040 [0.020, 0.077] | 0.005 [0.001, 0.028] | 0.000 [0.000, 0.019] |
| wild type | 0.000 [0.000, 0.019] | 0.025 [0.011, 0.057] | 0.000 [0.000, 0.019] | 0.000 [0.000, 0.019] |

The same two ensembles read at D5's headline level (extra rows, `metrics-rp-headline.json` and
`metrics-stack-headline.json`, `tuned_on_test` true because that level comes from the scoring-period noise curve):
rank product at 1e-3: D4 4.52 [2.07, 8.58] a year, rare 0.940, common ESBL 0.830, two unit 0.330 [0.269, 0.398], rare
k = 3 0.800, common ESBL k = 3 0.580, common resistant 0.050, wild type 0.025; stack at 3e-3: D4 3.01 [1.11, 6.56],
0.990, 0.850, two unit 0.325, rare k = 3 0.840, common ESBL k = 3 0.565.

**D4, D6, D7, I1, D1 at the operating level.** D4 episodes a year (exact Poisson 95 %): rank product 0.00 [0.00, 1.85] (0
episodes), stack 1.00 [0.12, 3.63] (2), reference 9.55 [5.75, 14.91], 0016 3.52 [1.41, 7.25]. D6: 0.015 [0.009, 0.025],
0.016 [0.010, 0.026], 0.026 [0.018, 0.038], 0.071 [0.057, 0.089]. D7: 0.999, 0.998, 0.987, 0.999. I1 (alerts, incidents):
4 in 2, 6 in 4, 29 in 26, 16 in 9; at the headline level 14 in 12 (rank product) and 14 in 9 (stack). D3 is 0 for both
ensembles (no data-kind signals; the live set's data rules are not in A, as D5's noise leaves them out); the reference
holds gaps of 3 days at 0.95. D1 (demonstration): rank product E1 4 d (corrected 9), E2 5 d; stack 3 d (8), 5 d; E3 and
E4 not found (data and trend kinds).

**Where the rank product's detections come from (k = 4, operating level, 200 trials).** Rare: 137 detected, 16 with A
alone at its own level 1, 0 with B alone, 121 with both, 0 with neither (A alone would have detected 196, B alone 133).
Common ESBL: 71 detected, 5 A alone, 1 B alone, 65 both (A 176, B 97). At 3e-5 the rank product is in effect an AND of the two.

**Checks (all passed).** `check_causal` on the whole rank product and the whole stack on 2025-03-31, 2025-12-31 and
2026-06-30 with B rebuilt from the rows given: no differences. Cached trial path against the from-scratch computation
(components with `rebuild`, no cache): 48 trials, 1,280 signals, 0 differ. Focused against full ensemble signals on the real
data: 3 cases, 0 mismatches (see `out/results.md`, section 9). `uv run pytest -q libs/utils/py/tests/test_cusum.py`:
passes (the D5 headline test runs with `AEI_PERF=1`).

**Deviations from plan.**

- References (union, intersection) and the exact-day row at 200 trials per cell, not 100 (cache made it free); nothing cut.
- Two extra reads, not in the plan: D5 at fixed episode counts (3, 6, 10), and the rank product and stack read at D5's
  headline level (flagged `tuned_on_test`).
- Stack: the harness p is the upper-tail share of the 117 x 274 background cell-days with (1 + count) / (N + 1) on the
  linear predictor (logit of pi, monotone in pi, avoids ties at pi = 1); so p is at least 3.1e-5 and the stack's
  levels at 3e-5 and below are empty (0/40, 0/200). Features scaled by their sd over the training rows. The
  5-fold CV over lambda was not done (time); lambda = 1 as planned.
- Stack training rows: positives are all cell-days (silent or not) of the injected cells (the source's organism and
  its monitored phenotypes, in the unit) from the first injected isolate to start + 28, with carry-forward only
  from signals the trial returns (dated start or later). The plan says the first 40 training events per family coincide with the tuning events:
  true for rare only; the common ESBL stream of 200 starts at a different stream position, so none of its events is one of the 40.
- Components see a trial's focus widened by 6 days at the start, so the signals of the days before the window carry
  forward as in a full run; the harness still counts signals dated start to start + 28.
- Cells are the 9 units x (4 phenotypes + 9 organisms) = 117, including cells that never signal; kind sentinel means
  only new-in-unit fired (detector name suffix `_sentinel`).
- The figure draws the cell URO x ESBL: B's Bernoulli alarms belong to the organism cell (E. coli), so only the
  Poisson part (triangles) appears in the middle panel.
- Component A is `retune_live_set`'s own output, re-run in `run.py` (asserted equal to the baseline row's alphas).

## Interpretation

Against METRICS.md "Decision rules" and the plan's yardstick the answer is mixed, and screening, not selection (one seed,
held-out seeds unused). The primary row, the rank product, does not beat the re-tuned live set at 5 episodes a year: 0.942
against 0.960 rare and 0.834 against 0.837 common ESBL at 5.0 a year (computed), inside each other's intervals. Its
higher headline numbers (rare 0.940, common ESBL 0.830 against 0.920 and 0.750) are read at 4.5 a year against 3.0 and are a
grid effect (finding 12b), not a gain. Hypothesis check (exploratory): common ESBL at 5 a year at least 0.05 above
0.84 did not hold (0.834); rare within 0.03 of 0.96 held (0.942); two-unit k = 4 not below 0.565 did not hold (0.040 at
the operating level, 0.330 at the headline level); the stack within 0.05 of the rank product held at the headline rows as read
(0.050 and 0.020) but not at equal noise (3.0 a year: 0.990 and 0.850 against 0.910 and 0.782); the intersection below both
components did not hold (see below); the union below the reference at matched noise held (0.795 and 0.483 against
0.920 and 0.750 at 3.0 a year). The result is not "negative" by the plan's rule (the rank product is not below the
reference's interval), and not positive at the yardstick.

What the combination does buy is low noise: at 3 episodes (1.5 a year) the rank product reads common ESBL 0.735 against
0.440 and rare 0.880 against 0.815, and it keeps 0.81 and 0.54 at no scoring-period episode, a region the live set's
grid does not reach. The intersection is as good or better on rare at every count and within 0.03 on common ESBL (0.930 and 0.710 at 1.5 a
year against the rank product's 0.880 and 0.735; 0.971 and 0.857 at 5), so the AND of two unlike tests, not the rank product's soft version, carries the gain; the stack is highest at
3.0 a year (0.990 and 0.850; rare interval [0.964, 0.997] clear of the reference's [0.874, 0.950], common ESBL
[0.794, 0.893] against [0.686, 0.805] overlapping) but falls to 0.670 and 0.290 at 1.5 a year, where its tail ECDF has
few distinct values. These are reads of references and of the non-primary stack, chosen after seeing the curves: the
plan fixed the rank product as primary precisely so that preferring the intersection or the stack now is seen as a
selection; both need the held-out seeds before any claim. The cost is breadth: at the operating level the ensembles
lose the two-unit family (0.040 and 0.070 against 0.565), common ESBL (0.355 and 0.230 against 0.880) and the live set's
data-quality rules (D3 0); at the headline level two-unit is 0.33 (reference 0.565 at level 1, not at equal noise).

The dependence check says why a sweep, not the formula, sets the level: the independence null is anti-conservative by
a factor 2.4 to 5.6 from 1e-3 down to 1e-4 and conservative at loose levels. The year-1 operating level rule did not work as
intended: the noise on year 1 is in-sample (the ranks were fitted on it), no background cell-day is below 3e-5, so the rule
picked 3e-5 (D4 0 in the scoring period, rare k = 4 0.685) when the scoring-period headline sits at 1e-3 (4.5 a year,
0.940). D2, D4, D6, D7 and I1 at the operating level are therefore a strict-end read, and the extra headline-level
reads (flagged `tuned_on_test`) are the comparable ones: I1 14 alerts in 12 incidents (rank product) and 14 in 9
(stack) against 29 in 26 for the reference. The 7-day join matters: the exact-day join gives 0.895 and 0.775 at 2.0 a year
(0.937 and 0.826 at 5.0, computed), within noise of the carry-forward at 5 a year.

Strongest alternative explanation: the stack is trained on the evaluation's own generator (rare and common ESBL clusters of 4,
the D5 yardstick, from the same simulator, year 1), so its edge is the most flattering reading; and A and B share the same
isolates, so the AND of them removes noise that is partly the same noise (the dependence check). With 2 to 9 scoring-period episodes behind
every noise value, the curve is coarse (the stack drops from 20 to 3 episodes between two levels) and a different
grid would move the headline rows; the interpolation is linear across such steps. What to run next: (1) `confirm` on seeds 2027 to 2030 for the
intersection, the stack and the rank product against the reference, at equal episode counts (3 and 6); (2) a stack
trained on a disjoint stream (a seed outside 2026 to 2030, pending Artem) and with the 5-fold CV over lambda; (3) the AND
as a rule of its own, with B's loosest run length and A's phenotype alpha on a finer grid, since both components' levels
were fixed by their own settings; (4) the CUSUM module's place in `libs/utils` is settled for now (it is there and tested),
but a live use needs the held-out result first; nothing here changes the live tool.

## Held-out re-score (orchestrator's request, after close)

Artem's winner's-curse rule: the screening headlines above (seed 2026) re-scored on the held-out injection seeds 2027 to 2030
(50 trials per seed, 200 per cell) with `aei.score_detection.confirm`, each ensemble at its D5 headline level from the screening
run (the level comes from the scoring-period noise curve, so `tuned_on_test` is true in `out/heldout.json`; the noise does not
depend on the seed), the live set's `_heldout` keys read from `baselines/live-set-retuned-year1.json`. Command:
`uv run python experiments/0022-ensemble/heldout.py` (60 s CPU, computed); outputs `out/heldout.json`, `out/heldout.md`.
Nothing above this section was changed. D5 at k = 4, Wilson 95 %; every number computed. "At 5/yr" is the rate interpolated
linearly in noise at 5.0 a year on the same seeds' curve.

| row | level, noise a year (episodes) | screening rare / common ESBL | held-out rare | held-out common ESBL | at 5/yr screening rare / common | at 5/yr held-out rare / common |
|---|---|---|---|---|---|---|
| live set re-tuned year 1 | x0.3, 3.01 (6) | 0.920 / 0.750 | 0.940 [0.898, 0.965] | 0.695 [0.628, 0.755] | 0.960 / 0.836 | 0.960 / 0.817 |
| rank product (primary) | 1e-3, 4.52 (9) | 0.940 / 0.830 | 0.965 [0.930, 0.983] | 0.765 [0.702, 0.818] | 0.942 / 0.834 | 0.966 / 0.772 |
| intersection | 3e-3, 4.52 (9) | 0.970 / 0.850 | 0.970 [0.936, 0.986] | 0.805 [0.745, 0.854] | 0.971 / 0.857 | 0.971 / 0.816 |
| stack | 3e-3, 3.01 (6) | 0.990 / 0.850 | 0.965 [0.930, 0.983] | 0.800 [0.739, 0.850] | 0.991 / 0.865 | 0.969 / 0.822 |

Reading (computed differences, no new analysis). Common ESBL fell from screening to held-out in every row, the live set too
(0.750 to 0.695; rank product 0.830 to 0.765, intersection 0.850 to 0.805, stack 0.850 to 0.800); the stack's rare rate fell
from 0.990 to 0.965, the others' rare rates moved by 0.025 or less. At 5 a year on the held-out seeds no ensemble is above the
live set (rare 0.966, 0.971, 0.969 against 0.960; common ESBL 0.772, 0.816, 0.822 against 0.817), as at screening, and the
rank product's common ESBL (0.772) is below it. The headline rows still differ in noise (3.0 and 4.5 a year), and every
held-out interval of an ensemble overlaps the live set's. The screening edge of the stack at 3.0 a year (common ESBL 0.850 against 0.750)
shrinks to 0.800 against 0.695 with overlapping intervals ([0.739, 0.850] and [0.628, 0.755]); the low-noise reads at 1.5 a year
were not re-scored. Nothing is established beyond the screening conclusion: the rank product does not beat the live set at 5 a year.

## Notes from review (overnight)

Reviewer: Claude Code (Fable 5.1), review agent of the overnight run, operated by Artem. Read against agent-rules.md, METRICS.md
(D5, Decision rules), harness-spec.md (Choices 3 and 5), the code, `out/*.json`, `out/heldout.md` and the reference row. Small
recomputations in the scratchpad; no file but this one edited, nothing above this heading changed.

**Causality and year-1-only maps: passes (no finding).** `Background` takes the components' real-data signals and keeps only
cell-days dated 2024-01-01 to 2024-09-30 (`score_map` with `lo`, `hi`), so the quantile knots (`ranks.json`: N = 32,058 cell-days,
1,566 fired in A, 3,498 in B; measured) are frozen at the end of the tuning year; the stack's ECDF reads the same background,
its weights come from year-1 injections (positives from a stream whose detector sees no row after 2024-09-30,
`training_stream`) and year-1 real cell-days (negatives, 2024-04-01 to 2024-09-30). `RankProduct.score` is p = RP² (1 − 2 ln RP)
as stated, monotone; `Stack.score` is a monotone upper-tail share. `check_causal` on three cut dates passed (measured, section
Checks). The components themselves were run once over all data and cut by date, which is causal only because each component is
(both passed `check_causal` in their own records); no new check was run here. Severity: none.

**Stack trained on the yardstick's own generator: stated, but the headline table does not carry the flag.** The stack's positives
are 200 rare and 200 common ESBL clusters of 4 (`training_stream`, `base.sources` and `common_group("common ESBL E. coli")`),
the two D5 families at D5's k, from the same `cluster_hits` path as the scoring trials, under the same seed 2026 (a different
draw order, so not the same events; measured, `stack.json`). No other family is in the training set. So the stack is the one row
built to maximise exactly the two numbers D5 reports; its screening edge at 3.0 a year (0.990 / 0.850 against the live set's
0.920 / 0.750; measured) is the most flattering reading, and it is the row that fell most on the held-out seeds (rare 0.990 to
0.965, common ESBL 0.850 to 0.800; computed). The record says this under "Strongest alternative explanation" and the stack is
not the primary row, so the claim is not misled, but a reader of the D5 table alone sees `tuned_on_test` false for the stack.
Suggested reading: treat the stack's D5 as a within-generator result until a stack trained on a disjoint stream (seed outside
2026 to 2030, pending Artem) and on more than two families exists. Severity: medium for any pitch that names the stack; low
for the record as written.

**Matched-noise comparison and the 5-a-year interpolation: correct, with one asymmetry to say aloud.** `at_noise` interpolates
linearly in episodes a year between the two bracketing levels and recomputes to the record's values (rank product 0.942 /
0.834, stack 0.991 / 0.865, intersection 0.971 / 0.857, live set 0.960 / 0.836; held-out rank product 0.966 / 0.772, live set
0.960 / 0.817; computed). Two small inconsistencies: the Result's first table prints the live set's common ESBL at 5.0 a year
as 0.837, which is `at_count(10)` (10 episodes = 5.02 a year, 0.8367), while `out/results.md` and the held-out table print
`at_noise(5.0)` = 0.836 (9.95 episodes); and the second table's header "at 5.0 a year (10)" treats the two as one. The
difference is 0.001 and changes nothing. The asymmetry: the live set's 5-a-year value sits 66 % of the way from its 3.01 point
to its 6.03 point (common ESBL 0.750 to 0.880, a 0.13 step), while the rank product's sits 5 % of the way from 4.52 to 14.07, so
at 5 a year a nearly measured ensemble number is compared with a mostly interpolated live-set number, and a convex curve
would put the live set lower. Read the other way, at the rank product's own 4.52 a year the live set interpolates to
0.950 / 0.815 (screening) and 0.955 / 0.788 (held-out) against the rank product's measured 0.940 / 0.830 and 0.965 / 0.765 and
the intersection's 0.970 / 0.805 (computed): every gap is inside the Wilson intervals whichever noise point is matched, so the
conclusion does not hang on the interpolation. Noise is matched on the total of cluster and sentinel episodes (Choices 3); note
the live set's total always holds 1.5 a year of new-in-unit sentinel episodes that no multiplier removes, while the rank
product at 1e-3 passes no sentinel signal at all (`metrics-rp-headline.json` D4 sentinel 0.0; measured), so the ensemble buys
its noise budget entirely with cluster signals and gives up the sentinel route. Severity: low.

**Held-out numbers support the conclusion at 5 a year; at 3 a year they do not support "none is above".** On seeds 2027 to 2030
at 5 a year the live set reads 0.960 / 0.817 and the ensembles 0.966 / 0.772, 0.971 / 0.816, 0.969 / 0.822 (computed): nothing
above by more than 0.01 on rare, nothing above on common ESBL, the rank product below, all inside intervals; the record's
sentence is right. But the stack's headline level and the live set's happen to sit at the same noise, 3.01 a year (6 episodes
each; measured), a genuinely matched comparison with no interpolation, and there the held-out stack is above on both families:
rare 193/200 against 188/200, common ESBL 160/200 against 139/200 (0.800 [0.739, 0.850] against 0.695 [0.628, 0.755]; measured).
An unpaired two-proportion z on common ESBL is 2.4 (computed; the trials share injections, so this is indicative, not a test),
and it is a post-hoc selected row trained on the D5 generator (previous note), so it is not a claim; the record reports it with
overlapping intervals and says so. The 1.5-a-year reads (rank product 0.880 / 0.735 against 0.815 / 0.440; measured, screening)
were not re-scored on the held-out seeds, so the "low-noise gain" paragraph in Interpretation rests on seed 2026 alone.
Severity: medium for the one-line reading, see the last note.

**Tuned-on-test flags: honest.** `metrics.json`, `metrics-stack.json`, `metrics-intersection.json`, `metrics-union.json` and
`metrics-rp-exact.json` carry `tuned_on_test` false with D2, D4, D6, D7 and I1 read at a level chosen on year-1 noise (rank
product 3e-5, stack 3e-4; measured) and the D5 headline chosen by the harness's sweep as for every row. The two headline-level
reads (`metrics-rp-headline.json`, `metrics-stack-headline.json`) and `heldout.json` carry `tuned_on_test` true because their
level comes from the scoring-period noise curve; that is stricter than the harness applies to the reference's own D5 headline
(same rule, no flag), so the flag is conservative rather than missing. The year-1 operating-level rule failed in substance (the
background is in-sample, 0 of 32,058 cell-days below 3e-5), which the record says plainly; a reader should take the
operating-level D2 and I1 rows as a strict-end read, not as the ensembles' comparable performance. Severity: low.

**On the pitch line "none of the alternatives beat the shipped set".** Two qualifiers are needed. (a) "Shipped" against
"re-tuned": the reference row is the year-1 re-tuned live set, one grid step looser than shipped on both cluster alphas; for D5
this does not matter, since the shipped row's D5 curve is the same curve read at a different "level 1" (`out/results.md`
table 1: identical rows for shipped and re-tuned at 3.01 a year, 0.920 / 0.750, and at 5 a year; measured), so a D5 statement
about the re-tuned set holds for the shipped set. (b) The noise point: the sentence is fair at 5 episodes a year, the yardstick
METRICS.md "Decision rules" fixes, on the screening seed and on the four held-out seeds, for every combination rule tried
(rank product, stack, union, intersection, exact-day join). It is not fair as a blanket "at matched noise": at 3 a year the
stack is above the live set on held-out seeds on both families with overlapping intervals (previous note), and at 1.5 a year
the rank product and the intersection are above on seed 2026 only. The defensible one line is: "at the 5-a-year yardstick
no combination of the live set and the CUSUM beats the live set, on the screening seed or the held-out seeds; the
combinations' gains appear only at lower noise, from one seed or from a stack trained on the yardstick's own generator, and
are not claims". Nothing here changes the record's verdict; nothing was done beyond writing these notes.
