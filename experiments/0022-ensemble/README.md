---
status: proposed
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

## Interpretation
