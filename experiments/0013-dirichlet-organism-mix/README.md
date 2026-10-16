---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem (overnight run)
data: [synthetic_microbiology_dataset, seed 2026, as received 2026-10-09]
parent: 0004
---

# 0013 Does splitting coverage into organism mix and per-organism susceptibility improve the doctor's number, and does counting polymicrobial cultures as episodes change it?

## Goal

D-038 accepted Beta pseudo-counts from the level above (ENGINE.md 2.1) and,
for the organism, a Dirichlet mix (2.3) combined into one coverage number
with a closed-form variance (2.4); M (QUESTIONS B1) and M_π (B4) are open.
The shipped list (D-023, D-033) pools all organisms into one share per
drug, and 0004 found the hospital's pooled last year as good as any blend
(every unit-level or recent estimate was +0.0002 to +0.0058 Brier worse,
computed, 0004). This experiment scores Σ_o E[π_o]·E[p_o,d] through the
overnight harness on C1 to C8 against both baseline rows and the
replacement rule of METRICS.md "Decision rules", so Artem can decide
whether separating organism mix from susceptibility earns a place in the
list and at which M_π and M. A second part scores WISCA (weighted-incidence
syndromic combination antibiogram) at episode level, where a culture
growing two organisms (10.7 % of positive cultures, measured below) is one
episode a drug covers only if it covers both.

## Hypothesis

This experiment is exploratory in PROTOCOL.md's sense: it describes how the
two-layer estimate and the episode-level WISCA score and supports no claim
beyond its tables. The yardstick is the replacement rule: a method replaces
the shipped estimate only if it is not worse on C1 by more than 0.002, not
worse on C4 in either untested convention, better on C8, and passing C3(b)
and C7(a); C6 is reported beside it. The rule does not say which row C1 is
differenced against, so both the shipped row and hospital-365 are reported.

Directional expectations, stated so the tables can contradict them. They
rest on rows dated up to 2024-09-30 only (the scoring period was not looked
at). Within each specimen the organism mix is the same in every unit
(chi-square homogeneity across units: p = 0.89 urine, 6,214 isolates; 0.90
blood, 300; 0.36 wound, 1,663; measured), while urinary *E. coli*
susceptibility differs by unit for some drugs (ciprofloxacin p = 0.0005,
trimethoprim 0.0045, ampicillin 0.009, mecillinam 0.015; cefuroxime 0.47,
ceftriaxone 0.81; measured).

1. The setting chosen on TUNE has M_π ≥ 100: the mix layer has no unit
   signal to keep (assumed from the p-values). M is not predicted.
2. The point estimate of C1 (all cells, `left_out`) differs from
   hospital-365 (0.1414, computed, baseline row) by −0.0003 to +0.0003 and
   from the one-layer control (below) by at most 0.0002 in absolute value
   (assumed; 0004's nearest estimator, unit year shrunk to the hospital,
   was +0.0002). No gain or loss a doctor would notice; the C1 guard passes.
3. Not replaced. C8 is not better than the shipped row (C1 on outbreak
   unit-months 0.1656, computed, baseline row): shrinking to the hospital
   keeps the estimate where outbreaks inside one organism (ESBL *E. coli*,
   MRSA) barely move it, and C6 for E1 ceftriaxone is 47 days or more or
   not reached (the shipped row: 47 days, computed). C3(b) passes and C7(a)
   lies in 0.90 to 0.95 (hospital-365 and shipped: 0.899 and 0.902,
   computed; the mix adds organism uncertainty to the interval).
4. WISCA: on the episode target its Brier is lower than the isolate-level
   two-layer estimate's by 0.0001 to 0.0005, and the realised coverage of
   the top pick is 0.5 to 2 points below its isolate-level figure (derived:
   a two-organism episode is covered with probability about p² instead of p,
   so a 10.7 % share costs 0.5 points at p = 0.95 and 1.7 at p = 0.80).

Refuted by: a C1 difference to hospital-365 whose 95 % interval lies wholly
above +0.0005 or below −0.0003; a chosen M_π ≤ 30; C7(a) outside 0.90 to
0.95; a WISCA Brier difference whose interval includes zero.

## Experiment

**Data.** `synthetic_microbiology_dataset` (seed 2026, received 2026-10-09)
through `aei.harness.data()`. Targets, windows and outcome conventions
(`left_out`, `counted`, `spectrum`) are the harness's (harness-spec.md
"Coverage"): first isolates per patient × organism × specimen, one
prediction per unit × specimen × antibiotic cell, the same p for every
target isolate of the cell since the organism is not yet known. No onset,
sex or age split (onset is 0012's), so the structure is the one thing that
differs from the baseline rows.

**The estimator.** Per cell and drug d, from the unit's first isolates of
the last 365 days and, as parent, the hospital's same specimen over the same
365 days with the unit's own isolates left out (as 0012). Layer 1: a
Dirichlet over the organisms with an outcome for d, prior M_π·π0 (π0 the
parent's mix), counts the unit's isolates per organism. Layer 2: per
organism a Beta with prior M·p0 (the parent's share), counts the unit's
covered and counted. Formulas, support and masks: "Mathematical
foundation". No discount (0012), no ward-type level (method 6). `n` is not
returned, so no cell is gated as not assessable, as for the baseline row; a
gate on the unit's own count would undo the shrinkage. The `a`, `b` of the
matched Beta are returned (C7 uses them), intervals are its quantiles.

**Choices this plan makes** that METRICS.md and DECISIONS.md do not fix, each
proposed (overnight), pending Artem: the 365-day windows, leave-one-unit-out,
the hospital as only parent, no onset split; Jeffreys smoothing (p0 =
(k + 0.5)/(n + 1); 0.5 per organism in the mix); one Dirichlet per drug over
the organisms with an outcome for it and exact zeros for intrinsic and
no-breakpoint pairs (a departure from ENGINE.md 2.3, reasons below); the grid
M_π × M ∈ {10, 30, 100, 300}², 16 settings (the QUESTIONS candidates 30
inside, a wide top end because the hypothesis puts the optimum there; the
limit beyond 300 is the pooled hospital share, the baseline row); the TUNE
windows and tie rule; the one-layer control; the episode definition,
independence within an episode and the severe-only episode C4-style; the
readings of the replacement rule (C1 differenced from either row; "not worse
on C4" as the point estimate not below the shipped row's, intervals beside it;
"better on C8" as a lower C8 C1).

**Choosing a setting on TUNE only.** Ten consecutive 28-day windows from
2023-12-25 to 2024-09-29 (as 0012; early ones see under 365 days, the data
start 2023-10-02), targets built as the harness does
(`aei.score_coverage.first_isolate_cells`, `View(start)`), mean Brier over
all isolate × antibiotic predictions in `left_out`, by a local loop used for
selection only and never reported as C1. The lowest TUNE Brier is the
reported row (`tuned_on_test` false, `tuned_on` "2023-12-25..2024-09-29").
Settings within 0.0001 of the lowest (half of 0004's smallest reported gap,
computed) go to (30, 30) if among them, else to the smallest
|ln(M_π/30)| + |ln(M/30)|. A minimum on the 300 edge is reported as such. All
16 settings are then scored on the scoring period and tabled as exploratory
(`out/grid.json`); a row picked from that table was picked on the scoring
period and must carry `tuned-on-test` if promoted.

**Baselines and control.** `coverage-hospital-365` (0004's baseline; the row
every C-metric is differenced against) and `coverage-shipped` (what a
replacement replaces), from benchmarks/overnight-2026-10-17/baselines/. The
**one-layer control** in this experiment: same unit year and parent with the
organism layer collapsed, p = (k_d + M·p0,d)/(n_d + M) over all organisms,
`a`, `b` = (k + M·p0, n − k + M·(1 − p0)), M ∈ {10, 30, 100, 300} chosen on
TUNE by the same rule. It differs from the two-layer estimate only in the
thing credited, so their difference is the value of the separation.

**Metrics.** C1 to C8 through `aei.score_coverage.score_estimator` for the
chosen row, the control and the grid: C1 and C2 with differences and 95 %
bootstrap intervals over the 26 target windows (1,000 resamples,
`mulberry32(2026)`), all and small cells, `left_out` and `counted`; C3(a);
C3(b); C4 mild (spectrum, all organisms) and severe in both conventions; C5;
C6 for E1 (URO urine, ceftriaxone and cefuroxime, onset 2025-05-30) and E2
(ICU, cefuroxime, onset 2026-03-03); C7(a) and (b) with the literal share
beside; C8. The replacement-rule checklist goes line by line into
`out/results.md`.

**WISCA at episode level.** Experiment-local: the harness scores isolates.
It is not a harness metric, is not on the leaderboard, and its numbers are
not comparable with the leaderboard's C1 or C4 (different targets and
denominators).

- *Episode.* A positive culture: 22,192, of which 2,379 grow two organisms
  (10.7 %; blood 5.1 %, urine 9.9 %, wound 15.2 %) and none more, measured.
  Negative and mixed-growth cultures have no isolates. A 28-day window's
  targets are, per patient × specimen, the first positive culture dated in
  the window (the culture-level counterpart of the first-isolate rule; the
  same 26 windows as C1).
- *Outcome* per episode × antibiotic suiting the specimen: covered iff every
  isolate has effective result S (`aei.eucast.effective_result`; intrinsic
  and no breakpoint are not S). `left_out`: the pair is in the target iff
  every isolate has a known effective result, so membership depends on the
  organism set and never on the outcome. `counted`: every episode, untested
  is not S. A one-organism episode has the harness's isolate outcome.
- *Predictors*, one p per cell, scored on the same episodes: E0 the
  hospital-365 isolate-level p; E1 the chosen two-layer isolate-level p; E2
  WISCA: a Dirichlet over episode types (organism sets) times the same
  per-organism Betas, independent within an episode, at the chosen (M_π, M),
  so nothing is chosen on the episode target; E3 the episode-level hospital
  share (covered over eligible episodes, same specimen, first positive
  culture per patient × specimen in the last 365 days, 0.5 if empty,
  Jeffreys intervals), the baseline's counterpart.
- *Scores.* Brier over all episode × antibiotic predictions of the 26
  windows, both conventions, as a difference to E3 with 95 % bootstrap over
  windows (`aei.score_coverage.boot_indices`), overall and on two-organism
  episodes alone. C4-style: for C4's 24 target months, per unit × specimen,
  the shipped severe-basis order (`aei.coverage_list.suggest_rows`, threshold
  0.90, untested gate from the shipped pool) on each predictor's shares and
  95 % intervals; the realised episode-level coverage of the first pick that
  clears, pooled, bootstrap over months, beside the isolate-level realised
  coverage of the same picks. Severe only: the mild basis is organism-level
  (D-027) and has no episode counterpart. Descriptive: per drug,
  isolate-level against episode-level realised coverage; for two-organism
  episodes the realised covered share against the product of the two
  organisms' realised shares (how wrong independence is). Numbers go in the
  extra field `wisca` of `out/metrics.json`.

**Checks before any number is used**, printed in `out/results.md`: (1) the
closed-form variance of 2.4 against 200,000-draw Monte Carlo on 20 cells at
one as-of date, relative error under 1 %, and the largest gap between the
matched-Beta 90 % interval and the Monte Carlo quantiles (reported, not a
pass condition); (2) the WISCA variance against Monte Carlo on 20
two-organism cells, and equal to (1) with one-organism types only; (3) M_π =
M = 0 reproduces 0004's unit 365-day raw estimator (`estimators_0004()`,
same p on every cell with results); (4) the whole hospital as parent with
huge M_π and M reproduces hospital-365's p; (5) every call reads only rows
dated before `view.start` (asserted on the frame it reads).

**Seeds and budget.** Deterministic; bootstrap draws are the harness's (seed
2026), Monte Carlo checks use seed 2026. 10 minutes of CPU
(`aei.harness.Clock`); expected about 3 minutes (assumed: the baseline rows
took 5.2 s each, 4 s of it the shared data load; the new cost is counting
organism × drug cells once per as-of date, about 300 dates at an assumed
0.1 s, cached across settings, then about 5 s of scoring for each of about
21 estimators). If over, cut in this order and record each cut under
"Deviations from plan": (1) C6 for grid rows other than the chosen one; (2)
M_π and M = 300; (3) the control's grid to the M nearest the chosen one; (4)
the WISCA C4-style (Brier kept).

**Command and outputs.**

    uv run python experiments/0013-dirichlet-organism-mix/run.py

writes `out/results.md` (chosen row, control and baseline rows with intervals,
TUNE Brier per setting, exploratory grid, replacement-rule verdict line by
line, WISCA tables, checks, CPU time), `out/metrics.json` (chosen row through
`aei.harness.write_metrics`, family "coverage", extra field `wisca`),
`out/grid.json` and `out/figure.png` (the sketch below, under 1 MB,
`metadata={"Software": None}`). numpy, pandas, scipy, matplotlib; nothing
added. All code stays here because this plan allows no new `aei` module; the
estimator and WISCA are candidates for one if the result warrants it.

## Mathematical foundation

**Conjugate pairs** (Gelman et al., Bayesian Data Analysis, ch. 2). A
Dirichlet(α) prior on organism shares π with counts c from N isolates gives
Dirichlet(α + c); the next isolate is organism o with probability (α_o + c_o)
/ (α_· + N), the Dirichlet-multinomial. A Beta(a, b) prior on a
susceptibility p with k covered among n gives Beta(a + k, b + n − k), the
Beta-binomial. Each isolate contributes π_o · p_o^y (1 − p_o)^(1−y) to the
likelihood, which factorises into a part in π and a part in the p_o; with
independent priors the posteriors of π and of every p_o are exactly
independent, if isolates are exchangeable given the parameters.

**The estimator**, one cell and drug d, over the organisms O_d that have an
outcome for d under the convention:

    α_o = M_π·π0_o + n_o     α_0 = M_π + N     π̄_o = α_o / α_0     V_o = π̄_o (1 − π̄_o) / (α_0 + 1)
    a_o = M·p0_o + k_o   b_o = M·(1 − p0_o) + n_o − k_o   p̄_o = a_o / (a_o + b_o)   v_o = p̄_o (1 − p̄_o) / (a_o + b_o + 1)

    coverage_d = Σ_o π̄_o p̄_o
    Var        = Σ_o (π̄_o² + V_o) v_o  +  Σ_o π̄_o (p̄_o − coverage_d)² / (α_0 + 1)

n_o, k_o are the unit's isolates with an outcome and covered among them, N =
Σ n_o. π0 is the parent's mix over O_d (0.5 added per organism, normalised,
so α_0 = M_π + N), p0_o = (k + 0.5)/(n + 1) of the parent. A pair EUCAST
makes intrinsic or without breakpoint has p̄ = 0, v = 0 exactly (ENGINE.md
1: such pairs are masks, not data): it counts in the mix, never in the
covered part.

*Variance, derived.* With π independent of p, Var(π_o p_o) = (π̄_o² + V_o)
v_o + V_o p̄_o², and Cov(π_o p_o, π_o' p_o') = Cov(π_o, π_o') p̄_o p̄_o' with
Cov(π_o, π_o') = −π̄_o π̄_o' / (α_0 + 1). The V_o p̄_o² and covariance terms
together are Var(Σ π_o p̄_o) = [Σ π̄_o p̄_o² − (Σ π̄_o p̄_o)²] / (α_0 + 1) =
Σ π̄_o (p̄_o − coverage)² / (α_0 + 1). That is ENGINE.md 2.4 exactly (two
organisms, v = 0: (p_1 − p_2)² π̄_1 π̄_2 / (α_0 + 1), the variance of a Beta
weight); the formula needs no correction, and check 1 verifies it
numerically. It needs π ⟂ p and a prior that sums to M_π.

*Matched Beta.* With m = coverage_d clipped to [0.001, 0.999] (as the
harness does) and v = Var: ν = m(1 − m)/v − 1 (floored at 1e−3), a = mν,
b = (1 − m)ν; the interval is its percentiles. A convex combination of Betas
is not a Beta: where one organism of small weight has a p far from the
rest, the true law is skewed and the matched tails are off; check 1 sizes
the gap.

*Special cases.* M_π = M = 0 at the unit gives Σ_o (n_o/N)(k_o/n_o) = Σ k_o /
N, the pooled unit share (0004's estimator 2); huge M_π and M give the
parent's pooled share, and with the whole hospital as parent hospital-365. The
one-layer control is 0004's estimator 5 with a leave-one-out Jeffreys parent.
So the two-layer estimate adds only the structure of the shrinkage: mix and
per-organism susceptibility are pulled to the hospital with their own
strengths, not one strength on the pooled share.

*Support rule, and where it departs from ENGINE.md 2.3* (one mix per
context over all isolates). Testing here is by organism panel, all or
nothing: 16 organism × drug pairs have 96 to 100 % of isolates untested
(ceftazidime in the five Enterobacterales, ciprofloxacin in *E. faecalis*
and *S. aureus*, eight drugs in *S. saprophyticus*, ampicillin in *S. aureus*
bar 37 isolates inferred resistant from cefoxitin; rows up to 2024-09-30,
measured). An all-isolates mix would give *E. coli* a ceftazidime p from
nothing, or from the non-random 37. The `left_out` target is exactly the
isolates with an outcome, so per drug the Dirichlet runs over the organisms
with one: O_d, n_o, k_o come from the convention's outcome (`left_out`:
untested absent; `spectrum`: untested and no-breakpoint absent, D-027;
`counted`: every organism present, untested covered 0). Under `counted` and
for a drug tested on every organism this is ENGINE.md 2.3.

**WISCA** (Hebert et al. 2012, Infection Control and Hospital Epidemiology;
Bayesian form Bielicki et al. 2016, Journal of Antimicrobial Chemotherapy):
the coverage of a regimen for a syndrome is the incidence-weighted sum over
pathogens of the probability it covers them, with Dirichlet uncertainty on
the weights and Beta uncertainty on each pathogen × regimen susceptibility,
usually sampled by Monte Carlo. Here the weights are over episode types T,
the organism sets (one or two organisms), counted from the cell's episodes
of the last 365 days over types complete for d (every member has an outcome);
a type's coverage is the product of its members' (independence within an
episode):

    q_T = Π_{o∈T} p_o      coverage_ep,d = Σ_T π_T q_T      E = Σ_T π̄_T q̄_T
    E[c²] = Σ_{T,T'} E[π_T π_T'] · Π_o E[p_o^{m_o}],   m_o = 1[o∈T] + 1[o∈T']
    E[π_T π_T'] = π̄_T π̄_T' + (1[T=T'] π̄_T − π̄_T π̄_T') / (α_0 + 1),   E[p_o²] = p̄_o² + v_o

Var = E[c²] − E², exact under the same independence; with one-organism types
only it reduces to the formula above; the interval is a matched Beta. The
covers-every-organism rule is the brief's; I did not re-read the two papers
for how they treat polymicrobial episodes.

**Assumptions and where they break.**

- Priors on organism and resistance are independent, but in an outbreak both
  move: E1's ESBL *E. coli* raises the *E. coli* count and lowers its
  ceftriaxone share, a negative covariance the formula sets to zero, so
  intervals are too narrow there (C7(b), C8).
- Exchangeable isolates. A patient seen in several units is counted in each;
  drift and outbreaks are not modelled (the discount is 0012's). Both
  inflate the effective count.
- The Beta is a good law for a mixture; not with one heavy-tailed organism
  (check 1).
- Independence within an episode fails when the two organisms share a source
  or a patient's exposure. The descriptive comparison with the product of
  realised shares measures it; the data are synthetic and the generator may
  draw both isolates independently, in which case it says nothing about real
  hospitals.
- The per-drug mix describes the isolates tested for d, not all infections:
  "covers 84 %" for ceftazidime reads over *Pseudomonas* and the organisms
  without breakpoint (D-027; 0010's 75.4 % against 96.6 %).

## Why this method here

- 0004 found the pooled hospital year as good as any blend, which is what the
  shipped list approximates. The organism mix of a specimen is the same in
  every unit (p = 0.36 to 0.90, measured, tuning year), so the mix layer has
  little to learn at unit level and C1 should not move. If C1, C4 and C7 stay
  put while the number becomes explainable by organism, that is the finding.
- 0010: the mild pick covers 96.6 % of the organisms it is meant for and
  75.4 % of what grows (computed, 0010). Separating the mix puts that gap on
  screen per organism, which a pooled share cannot.
- Given a Gram stain or a suspected organism, π collapses onto it (ENGINE.md
  2.3) and the same Betas give the number; a pooled share has nothing to
  condition on. Not scored here (no organism-known targets in the harness);
  the natural next experiment.
- The mix term is uncertainty the pooled interval lacks; C7(a) measures
  whether it helps.
- 15 % of wound and 10 % of urine cultures grow two organisms (0004's review),
  and D-028's combinations count isolates, not episodes. WISCA shows how far
  the isolate-level number overstates what a prescriber needs for such a
  culture: "covers 90 % of isolates" against "covers 87 % of cultures".
- For the researcher: nothing directly (D-039 keeps detection on raw counts).

## Proposed visualisation

One expanded row of the doctor's list (a list, no map: OBJECTIVES.md), light
mode, 7.5 × 4 inches at 120 dpi, drawn for ICU, blood, piperacillin-
tazobactam, severe basis, as of 2026-09-27, from the chosen setting. The unit
has about 40 blood isolates a year (measured, tuning year), so organism
shares are visibly uncertain.

- *Main panel, an area chart in which area is probability.* One column per
  organism with an outcome for the drug; width = E[π_o] on an axis of 0 to
  100 % ("Osuus isolaateista / Share of isolates, %"), ordered by width,
  organisms under 3 % merged into "muut / others". Height = E[p_o] on an axis
  of 0 to 100 % ("Herkkien osuus / Share susceptible, %"): the covered part is
  a solid fill from the bottom, the rest of the full-height column hatched
  ("////", grey) for not covered; the solid areas add up to the coverage. A
  thin black whisker with end ticks at each column's centre gives the 90 %
  interval of p_o. An intrinsic or no-breakpoint pair is a full-height hatched
  column labelled "luontainen / intrinsic", no whisker.
- *Labels and counts.* Each column is named above it in italics with its share
  ("*E. coli* 33 %"); the count behind it sits under the axis, "n 14 / 160"
  (the unit's isolates / the hospital's, last 365 days). Both strings are
  layout examples, not results.
- *Right panel, narrow.* One bar "Kattavuus / Coverage", height = Σ E[π_o]
  E[p_o], with the matched Beta's 90 % interval as a whisker and the number as
  text ("86 % (79–91)"); the syndrome threshold as a dotted rule at 90 %
  labelled "raja / threshold"; the hospital-365 share as a dashed tick
  labelled "sairaala 365 vrk / hospital 365 d".
- *Encodings.* Width and height carry the numbers, hatching covered against
  not covered, whiskers uncertainty, text the counts; colour (one blue for the
  solid fill, greys otherwise) carries nothing the hatching and labels do not.
  Labels short and bilingual, Finnish first.

## Result

## Interpretation
