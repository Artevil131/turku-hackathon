---
status: accepted    # proposed, then accepted, rejected or superseded
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

Command: `uv run python experiments/0013-dirichlet-organism-mix/run.py`; it
writes `out/results.md`, `out/metrics.json`, `out/grid.json` and
`out/figure.png`. Tags: computed (by that run), measured (counted in the
data), derived (calculated from numbers given here); every number below is
computed unless tagged. The estimator and the checks are deterministic;
bootstrap draws are the harness's (seed 2026, 1,000 resamples of 26 windows
or 24 months), the Monte Carlo checks use seed 2026. CPU time 28 to 45 s
over the runs (measured with `aei.harness.Clock`, on a shared laptop; the
committed outputs record 45.2 s) against the 600 s budget; 20 estimators
were scored in full (16 settings, 4 controls) and no cut from the plan's
list was needed. `uv run python scripts/verify_experiments.py --only 0013`
says "reproduces".

**Setting chosen on TUNE only** (10 windows, 61,847 isolate × antibiotic
predictions, Brier in `left_out`). At M = 30 the TUNE Brier falls with M_π:
0.13718, 0.13708, 0.13698, 0.13692 for M_π = 10, 30, 100, 300. The minimum
(0.13692) lies on the M_π = 300 edge (M = 10 and 30 tie) and is reported as
such; nothing beyond 300 was run. Eight settings (M_π ≥ 100, any M) are
within 0.0001 of it, (30, 30) is not among them, so the rule took the one
nearest to (30, 30): **M_π = 100, M = 30**. The one-layer control's TUNE
Brier is 0.13719, 0.13705, 0.13692, 0.13686 for M = 10 to 300; 100 and 300
tie, so **M = 100**. `tuned_on_test` false.

**Metrics against both baseline rows** (95 % bootstrap intervals; 26 windows
for C1 to C3(a), C8 C1, 24 months for C4, C3(b), C7, C8 C4):

| metric | two-layer (100, 30) | one-layer control (M 100) | hospital-365 | shipped |
|---|---|---|---|---|
| C1 all | 0.1415 (0.1399 to 0.1432) | 0.1415 (0.1399 to 0.1432) | 0.1414 (0.1398 to 0.1431) | 0.1417 (0.1401 to 0.1435) |
| C1 small | 0.1607 (0.1577 to 0.1637) | 0.1607 (0.1577 to 0.1638) | 0.1605 (0.1576 to 0.1635) | 0.1614 (0.1582 to 0.1646) |
| C1 all, counted | 0.1454 (0.1439 to 0.1470) | 0.1454 (0.1439 to 0.1470) | 0.1453 (0.1437 to 0.1469) | 0.1456 (0.1440 to 0.1472) |
| C1 small, counted | 0.1418 (0.1394 to 0.1445) | 0.1419 (0.1393 to 0.1445) | 0.1417 (0.1393 to 0.1443) | 0.1424 (0.1399 to 0.1452) |
| C1 diff to hospital-365, all | +0.00010 (−0.00001 to +0.00021) | +0.00010 (−0.00001 to +0.00020) | 0 | +0.00030 (+0.00014 to +0.00046) |
| C1 diff to hospital-365, small | +0.00015 (−0.00010 to +0.00038) | +0.00015 (−0.00008 to +0.00037) | 0 | +0.00084 (+0.00035 to +0.00130) |
| C1 diff to hospital-365, all, counted | +0.00012 (+0.00001 to +0.00024) | +0.00012 (+0.00001 to +0.00024) | 0 | +0.00033 (+0.00017 to +0.00051) |
| C2 all | 0.4437 (0.4396 to 0.4479) | 0.4437 | 0.4433 (0.4393 to 0.4476) | 0.4445 (0.4403 to 0.4488) |
| C3(a) slope, intercept | 1.036, 0.026 | 1.035, 0.024 | 1.038, 0.023 | 1.026, 0.031 |
| C3(b) mild, severe (observed of expected) | 0 of 0.22; 29 of 27.8 | 0 of 0.21; 29 of 26.3 | 0 of 0.13; 29 of 26.2 | 0 of 0.31; 23 of 19.6 |
| C4 mild, spectrum | 0.9661 (0.9626 to 0.9697) | 0.9661 (0.9626 to 0.9697) | 0.9661 (0.9626 to 0.9697) | 0.9656 (0.9621 to 0.9693) |
| C4 mild, all organisms | 0.7542 (0.7471 to 0.7605) | 0.7542 (0.7471 to 0.7605) | 0.7542 (0.7471 to 0.7605) | 0.7543 (0.7471 to 0.7606) |
| C4 severe | 0.9536 (0.9504 to 0.9563) | 0.9533 (0.9499 to 0.9561) | 0.9532 (0.9499 to 0.9559) | 0.9545 (0.9514 to 0.9572) |
| C4 severe, counted | 0.9381 (0.9353 to 0.9408) | 0.9383 (0.9351 to 0.9412) | 0.9383 (0.9353 to 0.9412) | 0.9386 (0.9356 to 0.9412) |
| C6 E1 ceftriaxone, E1 cefuroxime, E2 cefuroxime (days) | 48, 117, not reached | 49, not reached, not reached | not reached ×3 | 47, not reached, not reached |
| C7(a) | 0.905 (0.884 to 0.926) | 0.907 (0.884 to 0.928) | 0.899 (0.875 to 0.923) | 0.902 (0.877 to 0.925) |
| C7(b) (27 blocks) | 0.741 | 0.741 | 0.556 | 0.741 |
| C8 C1 (2,692 isolates) | 0.1653 (0.1528 to 0.1923) | 0.1655 (0.1527 to 0.1931) | 0.1669 (0.1538 to 0.1931) | 0.1656 (0.1531 to 0.1928) |
| C8 C1 diff to hospital-365 | −0.00158 (−0.00349 to +0.00049) | −0.00143 (−0.00320 to +0.00052) | 0 | −0.00131 (−0.00405 to +0.00260) |
| C8 C4 severe | 0.920 (0.784 to 0.980) | 0.903 (0.723 to 0.980) | 0.906 (0.743 to 0.981) | 0.915 (0.756 to 0.973) |

C4 mild, spectrum and all organisms are the same in every row because the
mild top pick is the same cell (urinary mecillinam); in C4 severe the
two-layer row's top pick clears in 431 query-months, hospital-365's in 500,
so the pooled figures rest on different query-months (15,475 and 15,785
isolates, measured).

**The value of the separation: two-layer minus one-layer control**, C1,
paired over the 26 windows: all +0.000003 (−0.000013 to +0.000019), small
−0.000003 (−0.000053 to +0.000046), all counted −0.000001 (−0.000016 to
+0.000015), small counted −0.000008 (−0.000048 to +0.000035).

**Replacement rule, line by line** (two-layer, chosen setting; the control
gets the same verdicts):

1. C1 not worse than the shipped row by more than 0.002: 0.1415 against
   0.1417, −0.0002. Passes. Against hospital-365: +0.00010 (−0.00001 to
   +0.00021).
2. C4 not worse than the shipped row on all six figures (point estimate not
   below): mild spectrum +0.0005, mild all organisms −0.0001, severe −0.0009,
   and the counted figures +0.0005, −0.0001, −0.0004. Four figures lie below,
   each far inside the shipped row's interval (about ±0.003 or more). **Fails
   under the literal reading.** The hospital-365 row fails the same line
   (severe 0.9532 against 0.9545).
3. C8 better than the shipped row (lower C8 C1): 0.1653 against 0.1656, lower
   by 0.0003, inside an interval of 0.1528 to 0.1923. Passes under the
   literal reading; not a difference beyond its interval.
4. C3(b): mild 0 of 0.22 expected, severe 29 of 27.8 (ratio 1.04). Passes.
5. C7(a): 0.905 (0.884 to 0.926). Passes (band 0.85 to 0.95).

The rule is not met (line 2). C6 is in the table: 48 days for E1
ceftriaxone, 117 for E1 cefuroxime, E2 not reached.

**The grid on the scoring period** (exploratory; a row picked from it is
`tuned-on-test`; every row in `out/grid.json`). C1 difference to hospital-365
(all) runs from +0.00004 at (300, 30) to +0.00027 at (10, 300) and falls with
M_π at every M (at M = 30: +0.00023, +0.00017, +0.00010, +0.00004 for M_π =
10, 30, 100, 300); 11 of 16 intervals lie wholly above zero, none below. The
one-layer control runs from +0.00003 (M 300) to +0.00026 (M 10). C7(a) is 0.900
to 0.906 and C4 severe 0.953 to 0.954 in every row. C6 for E1 ceftriaxone is 36
to 51 days or not reached; it is reached sooner at larger M_π and smaller M
(36 days at (300, 10)), and E1 cefuroxime only at M_π ≥ 100 with M ≤ 30 or
(300, 100). A larger M_π shrinks the mix term of the variance (derived: V_o
falls as α_0 grows) and METRICS.md's C6 note warns that a narrow interval
reaches C6 fastest; interval widths were not measured here.

**Checks** (all pass): (1) the variance of ENGINE.md 2.4 against
200,000-draw Monte Carlo on 20 cells: maximum relative error 0.0064, median
0.0031; largest gap between the matched-Beta 5 % and 95 % quantiles and the
Monte Carlo ones 0.0006. (2) WISCA variance on 20 two-organism cells: maximum
relative error 0.0094 (the pass line is 0.01, and Monte Carlo noise at this
size is of that order, so the margin is thin), median 0.0021; with one-organism
types only it equals the formula of 2.4 to 4.5e−16. (3) M_π = M = 0 equals
0004's unit 365-day raw estimator on 2,106 cells to 2.2e−16. (4) Whole
hospital as parent, huge M_π and M equals hospital-365 on 2,430 cells to
2.1e−11. (5) 289 as-of views built, each asserting that the latest row read is
dated before `view.start`; no assertion fired. (6) The episode C4-style loop
for E0 reproduces the baseline row's isolate-level severe figures, 0.953183
and 0.938322.

**WISCA at episode level** (experiment-local; not a harness metric; not
comparable with the leaderboard's C1 or C4). Targets: 14,246
first-positive-culture episodes in the 26 windows, 1,519 with two organisms
(10.7 %); 143,179 episode × antibiotic outcomes in `left_out`, 13,964 of them
on two-organism episodes. Chosen setting (100, 30), nothing tuned on this
target. Brier, `left_out` (95 % interval over windows), and difference to E3,
the episode-level hospital-365 reference:

| predictor | all | diff to E3, all | two-organism episodes | diff to E3, two-organism |
|---|---|---|---|---|
| E0 hospital-365, isolate level | 0.1442 (0.1425 to 0.1461) | +0.00026 (+0.00016 to +0.00036) | 0.2106 (0.2050 to 0.2161) | +0.00281 (+0.00231 to +0.00338) |
| E1 two-layer mix, isolate level | 0.1443 (0.1426 to 0.1462) | +0.00037 (+0.00023 to +0.00052) | 0.2107 (0.2051 to 0.2162) | +0.00285 (+0.00242 to +0.00331) |
| E2 WISCA, episode types | 0.1440 (0.1422 to 0.1460) | +0.00009 (−0.00005 to +0.00021) | 0.2080 (0.2023 to 0.2137) | +0.00023 (−0.00010 to +0.00053) |
| E3 hospital-365, episode level | 0.1440 (0.1422 to 0.1458) | reference | 0.2078 (0.2021 to 0.2134) | reference |

WISCA minus the isolate-level two-layer (E2 − E1): all −0.00029 (−0.00040 to
−0.00018), two-organism episodes −0.00262 (−0.00320 to −0.00213); `counted`,
all −0.00037 (−0.00049 to −0.00027). C4-style, realised coverage of the first
severe-basis pick that clears, isolate level against episode level
(`left_out`; `counted` in brackets): E0 0.9532 → 0.9483 (0.9383 → 0.9320),
E1 0.9536 → 0.9488 (0.9381 → 0.9318), E2 0.9537 → 0.9487 (0.9381 → 0.9316),
E3 0.9532 → 0.9484 (0.9383 → 0.9320); the gap is 0.48 to 0.49 points
(`left_out`) and 0.63 to 0.65 (`counted`) for every predictor, because the pick
is piperacillin-tazobactam in 500, 427, 380 and 488 of the clearing
query-months (WISCA clears in 384 query-months, hospital-365 in 500). Per antibiotic over the 26 windows the episode-level realised share is
below the isolate-level one by 0.5 points (piperacillin-tazobactam,
ciprofloxacin) to 2.6 (vancomycin), 2.0 (cefuroxime, trimethoprim) and 1.9
(ampicillin). Independence within an episode: over 13,963 two-organism
episode × antibiotic outcomes the realised covered share is 0.4596 against
0.4606 for the product of the two organisms' realised shares; the largest
per-drug gaps are ciprofloxacin (0.818 against 0.845, n = 759) and trimethoprim
(0.433 against 0.457, n = 1,080).

**The directional expectations of the Hypothesis.** (1) M_π ≥ 100 chosen:
yes (100; the TUNE minimum is at 300). (2) C1 within −0.0003 to +0.0003 of
hospital-365: yes (+0.00010); within 0.0002 of the control: yes (+0.000003).
(3) C8 not better than the shipped row: contradicted at the point estimate
(0.1653 against 0.1656), inside the interval; E1 ceftriaxone at 47 days or
more: yes (48); C3(b) passes: yes; C7(a) in 0.90 to 0.95: yes (0.905); not
replaced: yes, but through C4 (line 2), not through C8. (4) WISCA Brier lower
than the isolate-level mix by 0.0001 to 0.0005: yes (−0.00029); top-pick
episode-level coverage 0.5 to 2 points below isolate level: 0.48 to 0.49
points, 0.02 below the stated lower bound (the derived value at p = 0.95 was
0.5). None of the four refutation conditions was met.

**Deviations from plan.**

- Added after the first run, none of which changes a plan section: the paired
  two-layer minus control interval (the plan names the control but gives no
  interval for the difference between the two); check 6; the one-organism
  Brier column; the layout of `results.md`; the figure's layout, reworked twice
  after I looked at it for overlapping labels (no number changed).
- Before the TUNE selection ran I scored the WISCA Brier and C4-style on the
  scoring period in a scratch script (outside the repository) at the arbitrary
  setting (100, 30) to debug the code. That is the setting TUNE chose
  afterwards by the rule; nothing was chosen or changed from those numbers
  beyond fixing a print statement.
- The plan's CPU estimate was 3 minutes (assumed); 28 to 45 s measured. C6 was
  scored for every grid row, so the plan's first cut was not used.
- The plan's rule for organisms under 3 % in the figure (merge into
  "muut / others") was not exercised: the smallest column is 3.4 %. The
  `left_out` figure is therefore drawn from eight columns and no merged interval.
- The checks 1 and 2 draw their Monte Carlo from separate generators both
  seeded 2026.

Outputs: `out/results.md` (every table with intervals), `out/metrics.json`
(the chosen row, `tuned_on_test` false, extra fields `setting`, `tune_brier`,
`control`, `vs_control`, `checks`, `wisca`), `out/grid.json`, `out/figure.png`
(49 KB, 120 dpi). Code: `run.py`, `mixture.py`, `episodes.py`, `wisca_eval.py`,
`figure.py` in this directory.

## Interpretation

**What it means for the hypothesis.** The prediction held where it was
numerical: the two-layer estimate is indistinguishable from the pooled
hospital year on C1 (+0.00010, interval −0.00001 to +0.00021), and from the
one-layer control (+0.000003, −0.000013 to +0.000019), so on this dataset
separating the organism mix from per-organism susceptibility changes the
doctor's number by nothing a doctor, or the harness, can see. The reason is
in the grid: C1 and the TUNE Brier improve at every step of more shrinkage of
the mix (M_π), and the best settings are the ones closest to the pooled
hospital year. There is no unit-specific organism signal to keep (the mix is
the same in every unit, p = 0.36 to 0.90, measured), and the unit-specific
susceptibility that exists for four urinary *E. coli* drugs (p < 0.02,
measured) appears too small to pay for the noise of a 365-day unit count; this
is 0004's finding again, now with the mix and the susceptibility each given
their own strength.

**Against the decision rules.** The replacement rule is not met, through C4
(four of six figures a hair below the shipped row, each far inside its
interval, so nothing is claimed beyond "no better"); the hospital-365 row and
the one-layer control fail the same line. C8 reads as better than the shipped
row by 0.0003 on 2,692 isolates and 27 blocks, an interval of 0.1528 to 0.1923:
that is noise, not responsiveness. C6 tells the same story: 48 days for E1
ceftriaxone, the shipped row's 47; the 117 days for cefuroxime (the shipped row
never reaches it) comes with a slightly narrower interval, and the grid shows
C6 improving only where the interval is narrowest. What is new for the team is
not a better number but three things that hold: the closed-form variance of
ENGINE.md 2.4 is correct (maximum relative error 0.64 % against Monte Carlo)
and its matched-Beta interval is within 0.0006 of the Monte Carlo quantiles on
20 cells; the intervals are honest (C7(a) 0.905, in the band, as the shipped
row's 0.902); and the constants asked about in QUESTIONS B1 and B4 matter
little on this data (C1 spans 0.00023 across the 16 settings, +0.00004 to
+0.00027), so the candidates (30, 30) are not worse than the best setting by
more than 0.00013, with the caveat that more shrinkage of the mix is never
worse here.

**WISCA.** Counting a polymicrobial culture as one episode lowers the realised
coverage of the list's top severe pick by 0.5 points (0.63 counting untested
as not covered), and by 0.5 to 2.6 points for individual drugs; 10.7 % of
episodes are two-organism (measured), which is as derived. The independence
product predicts two-organism episodes well (0.4596 observed against 0.4606;
the two largest per-drug gaps, 2.7 and 2.4 points, are within about two
binomial standard errors, derived, and are not claimed), so on this synthetic
data nothing is lost by building the episode number from per-organism Betas.
But the gain over a plain episode-level hospital share is nil: WISCA minus E3
is +0.00009 (−0.00005 to +0.00021), and the gain over reading the isolate-level
number as an episode probability is 0.0003 Brier (0.0026 on the two-organism
episodes). For the doctor the useful output is the gap itself, "covers 95.3 %
of isolates, 94.8 % of cultures", not a different ranking: the top pick and its
standing are unchanged except that WISCA clears piperacillin-tazobactam in 384
query-months instead of 500, which fits a wider interval (not measured).

**Strongest alternative explanation.** The data. The generator draws organisms
by specimen, not by unit, and gives units little lasting difference in
susceptibility (0004, and the p-values in the Hypothesis), so a method whose
whole point is to let unit-level mix and unit-level susceptibility differ has
nothing to find; the independence within an episode may also be built in. On
real data with a unit-specific mix (an ICU's *Pseudomonas*, an outpatient
*S. saprophyticus*) the separation could matter, and nothing here says it
would not. Two further limits: the TUNE windows see 12 to 52 weeks of history
rather than 365 days, which favours strong shrinkage (the minimum sits on the
300 edge, and larger M_π were not run; the limit is the baseline row); and the
estimator reads no onset, sex or age, so a difference those carry (urinary
*E. coli* by sex and onset, 0004's review) is not in the number.

**What to run next.** (1) The organism-known query: with π collapsed onto a
suspected organism the per-organism Betas give a number a pooled share cannot,
which needs organism-level targets in the harness. (2) A test where the
separation should matter: inject a unit-specific organism shift or a
resistance rise inside one organism (the injection harness, as 0007 and 0011)
and compare how fast the two-layer and the one-layer interval react (C6, C8),
since E1 and E2 moved one organism's susceptibility and the chosen row's
shrinkage hid it. (3) Combine with 0012's discount and onset strata, where unit
and recent data are given a chance, and with the pooling levels of method 6.
(4) If Artem wants the explainable per-organism display, the estimator and
WISCA are small enough to move into `libs/utils/py/aei` with tests; C1 and C4
say it costs nothing in accuracy and the figure says what it shows. QUESTIONS
B1 and B4 are sharpened, not settled: on this data C1 moves by 0.00013 between
M_π = 30 and 300 (at M = 30), inside the intervals.

## Decision numbers (2026-10-17, after close)

This record cites D-038 (the Beta-binomial method) and D-039 (detection on raw
counts) in the numbering of the overnight base. On main those two are D-041 and
D-042; D-038 and D-039 on main are other decisions.
