---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem (overnight run)
data: [synthetic_microbiology_dataset, seed 2026, as received 2026-10-09]
parent: 0004
---

# 0012 Does the discounted Beta-binomial give the doctor a number that reacts to an outbreak without losing accuracy?

## Goal

D-038 accepted the Beta-binomial with pseudo-counts from the level above
and a weekly discount (ENGINE.md 2.1 and 2.2) as the estimation method,
but left its constants open: the prior strength M (QUESTIONS B1) and the
weekly discount δ (B3). 0004 found that every estimate leaning on the
unit's recent isolates predicted the next 28 days slightly worse than
the hospital's last 365 days (Brier +0.0002 to +0.0058, computed, 0004),
and the shipped list rests on that year (D-023, D-033). 0004 never
measured how long each estimate takes to notice an outbreak. This
experiment runs the discounted filter over the grid δ × M, scores it on
C1 to C8 through the overnight harness, and reports it against the
replacement rule of METRICS.md "Decision rules", so Artem can decide in
the morning whether the filter can replace the shipped estimate and at
which constants, or whether B1 and B3 need a different kind of answer.

## Hypothesis

This experiment is exploratory in PROTOCOL.md's sense: it describes how
the twelve settings of the discounted Beta-binomial score on the
coverage metrics and supports no claim beyond its table. The yardstick is
the replacement rule of METRICS.md "Decision rules": a setting replaces
the shipped estimate only if it is not worse than the hospital-365 row on
C1 by more than 0.002, not worse on C4 in either untested convention,
better on C8, and passing C3(b) and C7(a); C6 is reported beside it.

What is described: C1 to C8 for each (δ, M), the setting chosen on the
tuning year, and the days each setting took to react to E1 and E2 (C6).

Directional expectation, stated so the table can contradict it: the
slow settings (δ = 0.98 and 1.0) land within 0.002 of the hospital-365
row on C1 (0004's unit-365-shrunk estimator was +0.0002, computed, 0004)
and the fastest (δ = 0.90) lands 0.001 to 0.003 worse (0004's
28-day-shrunk estimators were +0.0011 to +0.0026); δ = 0.90 reaches C6
on E1 within 21 days and δ = 1.0 takes over 35 days (assumed; derived
below under "Where it breaks"). Whether any setting is better on C8 is
the open question; nothing in 0004 or 0010 predicts it.

## Experiment

**Data.** `synthetic_microbiology_dataset` (seed 2026, received
2026-10-09) through `aei.harness.data()`. Targets, cells and outcome
conventions are the harness's (harness-spec.md "Coverage"): per target
first isolate × antibiotic suited to the specimen, covered if the
effective result is S; `left_out` and `counted` conventions both scored.
All organisms together per cell, as 0004.

**The estimator.** One filter per cell (unit, specimen, onset,
antibiotic), where onset is hospital-acquired (sample on day 3 of the
stay or later, ENGINE.md 1) or community; outpatient units are community
only. Weekly steps on ISO weeks (Monday to Sunday). Inside the current,
partial week counts are added without discount; the discount is applied
when the week turns, so a daily as-of estimate exists for C6. Counts
s_t, r_t are the week's first isolates (0004's rule, `aei.counting`)
with a known effective result; untested isolates do not enter the
filter in either convention (the conventions are about the outcome, not
the fit; a variant that fits with untested as R is not run and is noted
as a gap). The recursion and the parent p0 are given under "Mathematical
foundation".

**Parent p0, proposed (overnight), pending Artem.** For the cell's
specimen and onset at week t: the hospital's results over the 52 weeks
ending the week before t, with the unit's own isolates left out
(leave-one-unit-out) so that a large unit is not shrunk toward itself
(PHC-S holds 5,070 of 24,571 isolates, measured); Jeffreys-smoothed,
p0 = (S_h + 0.5) / (N_h + 1). ENGINE.md 2.1 says "preceding period"
without fixing it; the 52 weeks before the current week are the reading
used here.

**Grid.** δ ∈ {0.90, 0.95, 0.98, 1.0} × M ∈ {10, 30, 100}, 12 settings.
δ = 1.0 is not 0004's 365-day window: it accumulates every week since
the data start, shrunk to the hospital's preceding year with weight M.

**Cell-level and isolate-level predictions.** The harness takes
isolate-level predictions keyed by `isolate_id` for C1, C2, C3(a), C5
and the C1 part of C8: each target isolate gets the p of its own onset
stratum (the admission date is known when the sample is taken, so this
is as-of). For C3(b), C4, C6, C7 and the C4 part of C8 the harness needs
one Beta per (unit, specimen, antibiotic): the two onset strata are
mixed with weights proportional to their effective own counts n_eff
(ENGINE.md 2.2) and the mixture is moment-matched to one Beta (formulas
below). `lo90`, `hi90`, `lo95`, `hi95` are Beta percentiles. One extra
row at the chosen (δ, M) runs without the onset split (parent hospital ×
specimen only) as an ablation.

**Choosing a setting without touching the scoring period.** The
reported row is chosen on TUNE windows only: 10 consecutive 28-day
target windows from 2023-12-25 to 2024-09-29 (12 weeks of history before
the first; proposed (overnight), pending Artem), targets built by the
same rule as the harness's, Brier over all isolate × antibiotic
predictions in the `left_out` convention, through `aei.score_coverage`
if its target builder takes a period, else by a local Brier over the
same targets used for selection only and never reported as C1. The
setting with the lowest TUNE Brier is `out/metrics.json`, `tuned_on_test`
false, `tuned_on` "2023-12-25..2024-09-29". Ties within 0.0005 go to the
larger δ, then to M = 30 (QUESTIONS B1). The whole grid is then scored on
SCORE and reported in `out/results.md` and `out/grid.json` as an
exploratory table; any row a reader would pick from that table was
picked on the scoring period and must carry `tuned-on-test` if it is
ever promoted.

**Baseline rows** (benchmarks/overnight-2026-10-17/baselines/):
`coverage-hospital-365` (0004's baseline, the reference every C-metric
is differenced against) and `coverage-shipped` (the list as shipped,
D-023 and D-033, 0010's tables). The first controls for everything but
the estimator; the second is what a replacement would replace.

**Metrics.** C1 to C8 as the harness computes them: C1, C2 with
`C1_diff`, `C2_diff` and 95 % bootstrap intervals over target windows
(1,000 resamples, `mulberry32(2026)`); C3(a) slope and intercept; C3(b)
through the Python mirror of `suggest`; C4 both conventions; C5 per
organism × antibiotic; C6 days to react for E1 (URO, urine, ceftriaxone
and cefuroxime, onset 2025-05-30) and E2 (ICU, cefuroxime, onset
2026-03-03); C7 predictive honesty (a) and (b) with the literal share
beside it; C8 on the outbreak unit-months.

**Seeds.** The estimator is deterministic. Bootstrap draws are the
harness's (seed 2026).

**Budget.** 10 minutes of CPU, measured with `aei.harness.Clock`. The
filter is a vectorised recursion over about 9 × 3 × 2 × 13 cells and 156
weeks and costs seconds per setting; the harness scoring dominates. If
the run does not fit, cut in this order and record each cut under
"Deviations from plan": (1) the grid rows other than the chosen one are
scored on C1, C6 and C7 only; (2) the no-split ablation is dropped;
(3) M = 100 is dropped from the grid.

**Command and outputs.**

    uv run python experiments/0012-discounted-beta-binomial/run.py

writes `out/results.md` (the grid table with intervals, the TUNE Brier
per setting, the chosen setting and the replacement-rule checklist),
`out/metrics.json` (the chosen setting, through
`aei.harness.write_metrics`), `out/grid.json` (every setting in the same
schema, marked exploratory) and `out/figure.png` (the sketch under
"Proposed visualisation", under 1 MB, `metadata={"Software": None}`).
Causality is checked by recomputing the estimate at three as-of dates
from truncated data and requiring identical numbers. Implementable with
numpy, pandas and scipy; nothing new in `libs/utils`.

## Mathematical foundation

**Belief and count.** For one cell, p is the share of isolates the
antibiotic covers. The belief about p is Beta(a, b); the count of
covered isolates among n is Beta-binomial(n, a, b). Updating by a
week's s covered and r not covered adds the counts: Beta(a + s, b + r).
This is the conjugate pair (Gelman et al., Bayesian Data Analysis, ch. 2).

**The discounted filter** (ENGINE.md 2.2), per cell and ISO week t, with
the parent share p0,t of the hospital for the same specimen and onset:

    a_t = δ · a_{t−1} + s_t + (1 − δ) · M · p0,t
    b_t = δ · b_{t−1} + r_t + (1 − δ) · M · (1 − p0,t)

    E[p]      = a_t / (a_t + b_t)
    Var[p]    = E[p] (1 − E[p]) / (a_t + b_t + 1)
    interval  = 5th and 95th percentiles of Beta(a_t, b_t)   (90 %)
    n_eff     = a_t + b_t − M            effective own count
    w         = n_eff / (n_eff + M)      own-data weight

Start: a_0 = M p0,1, b_0 = M (1 − p0,1).

**What the recursion does.** Unrolling it, an isolate k weeks old
carries weight δ^k, and the floor term keeps the prior alive: with no
data, a_t → M p0 and b_t → M (1 − p0), the fixed point of a = δ a +
(1 − δ) M p0. With a steady weekly count n, a_t + b_t → M + n / (1 − δ),
so the filter behaves like a window of 1 / (1 − δ) weeks of own data
plus M pseudo-isolates:

| δ per week | half-life, weeks | effective window, weeks |
|---|---|---|
| 0.90 | 6.6 | 10 |
| 0.95 | 13.5 | 20 |
| 0.98 | 34.3 | 50 |
| 1.0 | none | all history |

(derived: half-life = ln 0.5 / ln δ; window = 1 / (1 − δ).) So δ = 0.98
is close to 0004's unit-365-shrunk estimator (0004's estimator 5, with
exponential instead of hard edges), δ = 0.95 to a 20-week window, and
δ = 0.90 to a 10-week window; none is 0004's raw 28 days, which was the
clearly worse one.

**Reference and exactness.** Harvey and Fernandes (1989, Journal of
Business and Economic Statistics, "Time series models for count or
qualitative observations") derive the discounted Beta-binomial as the
exact filter for a proportion that moves each step by a Beta-distributed
multiplicative perturbation chosen so the prior stays Beta with
parameters (δ a, δ b); Smith (1979) and West and Harrison (1997, ch. 6
and 14) give the discount view of the same idea. ENGINE.md's phrase
"exact conjugate filter for a log-odds that follows a random walk" is
looser than that: a Gaussian random walk on the logit has no conjugate
Beta filter; the discount is exact under Harvey and Fernandes' step, and
an approximation of the logit walk. The floor term (1 − δ) M p0 is the
engine's addition; it is what makes the prior relax to the parent
instead of fading to the improper Beta(0, 0), and it is not in Harvey
and Fernandes.

**Mixing the onset strata** for the cell-level Beta the harness and the
`suggest` mirror need. With weights w_o ∝ n_eff,o over the two strata,
mean m = Σ w_o E_o and variance v = Σ w_o (Var_o + E_o²) − m²; the
moment-matched Beta has c = m (1 − m) / v − 1, a = m c, b = (1 − m) c.
If v ≥ m (1 − m) (which cannot happen for a mixture of proper Betas
unless the strata disagree wildly), clip c at 1.

**Where it breaks.**

- The model assumes slow drift; an outbreak is a jump. The filter
  follows a jump with lag of order 1 / (1 − δ) weeks and the interval
  during the lag is too narrow in the wrong place, which is what C7(b)
  measures.
- The interval width is governed by a_t + b_t ≈ M + n / (1 − δ). For a
  URO urine cell at about 10 first isolates a week (URO has 1,985
  isolates over 156 weeks, measured) the 90 % half-width at p = 0.85 is
  about 1.64 √(0.85 · 0.15 / 110) ≈ 0.056 at δ = 0.90 and about 0.015 at
  δ = 1.0 after 1.7 years. E1 adds 5 to 6 ESBL isolates a week for five
  weeks (measured, benchmarks/planted-events), each resistant to the
  cephalosporins. At δ = 0.90 the weighted mean falls by about 0.1 in
  two weeks and the interval excludes the pre-onset value; at δ = 1.0
  the mean moves about 0.018 in five weeks against a half-width of
  0.015, so C6 is reached late and only because the interval is narrow,
  the artefact METRICS.md's C6 note warns of. Hence the expectation
  under Hypothesis, and why C6 is read only with C7 and C8.
- The parent p0 is taken from the hospital's preceding year. During E1
  the hospital's urine cephalosporin share also falls (0002's review
  found hospital-wide cefuroxime and ceftriaxone trends raised by the
  outbreak strain), so the prior drifts toward the outbreak too; small,
  but not zero.
- The Beta assumes independent isolates. Polymicrobial cultures and
  repeat patients within the first-isolate lookback are counted once per
  the harness's rule; residual dependence makes a_t + b_t overstate the
  information, again visible in C7.
- Counts in `counted` convention: the filter is fitted on tested
  results only, so for an antibiotic tested on half the isolates
  (ciprofloxacin in wound, 0010) its p says nothing about the untested
  half; C4 in `counted` shows the cost.

**Causality.** The harness passes only records dated before the first
target day; the recursion reads weeks in order and never a later one;
p0,t uses the 52 weeks ending the week before t. For C6 the daily
as-of estimate is the state at the end of the last complete week plus
the partial week's counts up to that day, from records dated ≤ that day.

## Why this method here

- 0004 refuted "recent and local beats the hospital year" with hard
  windows: every step toward the unit's 28 days cost Brier, the raw
  28-day unit figure the most (+0.0058 all cells, +0.0206 small cells,
  computed, 0004). Hard windows have a cliff at day 365 and a 28-day
  window throws away everything older; the discount is the smooth
  version of the same trade and its grid contains both ends. If δ = 0.98
  matches the hospital year on C1 while reacting faster on C6, the
  cliff was the problem, not recency as such.
- The shipped list falls back from unit to ward type to hospital at 30
  isolates (D-023, D-033). 0010 found blood fell back in 49 of 145
  unit-months (computed, 0010). The filter has no fallback: every cell
  has a proper Beta with a_t + b_t ≥ M, and w says on screen how much
  is own data. That removes a rule the doctor cannot see.
- 0004's review noted that units do differ by type (urinary *E. coli*
  trimethoprim R 15 to 17 % in ED and the health centres, 21 to 25 % on
  the wards, measured, 0004 review). The onset split and the unit-level
  filter are the first estimate in this repository that can carry such
  a difference without a hard window.
- C6 has never been measured. The planted events say what the doctor's
  view must show during E1 ("ESBL share up and cephalosporin %S down,
  with the counts"); the shipped 365-day estimate moves by about one
  isolate in 500 per outbreak isolate and the record will show whether
  it ever excluded its pre-outbreak value within 120 days.
- For the doctor: a coverage number that is the same estimator at every
  level, with its own-data badge, and a date-stamped "newest result"
  that is actually used, instead of a 28-day count shown beside a
  365-day share. For the researcher: nothing directly (D-039 keeps
  detection on raw counts), but the C6 numbers say whether the doctor's
  view would have shown E1 and E2 without an alert.

## Proposed visualisation

One row of the doctor's list (OBJECTIVES.md: a list, no map), light
mode, drawn for URO urine, ceftriaxone, as of 2025-07-06 (the E1 demo
date in benchmarks/planted-events).

- Left, the row as the list shows it: antibiotic name ("Keftriaksoni /
  Ceftriaxone"), a horizontal bar from 0 to 100 % whose filled length is
  E[p] (text "62 %" at its end), the 90 % interval as a thin black line
  with end ticks over the bar, and the syndrome threshold τ as a dotted
  vertical rule at 80 % labelled "raja / threshold". Under the bar, in
  small text: "n 28 vrk / 28 d: 41 · n 365 vrk / 365 d: 487 · omaa dataa
  / own data 71 %". The own-data badge is the w of the formula.
- Right, a sparkline 26 weeks wide: the weekly E[p] as a line with the
  90 % band as a light grey area; under it the weekly counts as a
  two-tone stacked tick per week (covered above the axis in solid, not
  covered below in hatched), so the five outbreak weeks read as taller
  hatched ticks. The hospital-365 value as a dashed horizontal line
  labelled "sairaala 365 vrk / hospital 365 d". The as-of date as a
  vertical rule at the right edge.
- Encodings: position and length for the share, line and band for
  uncertainty, ticks for counts, hatching for outcome; colour carries
  nothing that the hatching, the line styles and the text do not.
  Labels bilingual, Finnish first.

The matplotlib sketch in `out/figure.png` draws the right panel for
δ = 0.90 and δ = 1.0 at M = 30 and the hospital-365 baseline, with the
weekly counts, from 2025-03 to 2025-09, and the E1 onset marked.

## Result

## Interpretation
