---
status: accepted    # proposed, then accepted, rejected or superseded
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

Command, from the repository root:

    uv run python experiments/0012-discounted-beta-binomial/run.py

Outputs in `out/`: `results.md` (every table of this section and more),
`metrics.json` (the chosen setting, family `coverage`, `tuned_on_test`
false, `tuned_on` 2023-12-25..2024-09-29), `grid.json` (all 16 rows,
marked exploratory), `figure.png` (the sketch of the proposed
visualisation) and `c1_grid.png`. `uv run python
scripts/verify_experiments.py --only 0012` says "reproduces". CPU time
about 33 s (measured, `aei.harness.Clock`; 32 to 35 s over four runs;
the budget was 10 minutes and nothing was cut). The estimator is
deterministic, so there are no seeds to vary; the only random element is
the harness's bootstrap (1,000 resamples of target windows for C1, C2,
C3(a) and C8, of target months for C4 and C7, `mulberry32(2026)`), and
every interval below is its 95 % interval. Every number is computed by
this run through `aei.score_coverage`, except the two baseline rows,
which are the committed rows of `benchmarks/overnight-2026-10-17/baselines/`
computed by the same harness, and the counts tagged measured. `tuned_on_test`
is false: the setting was chosen on the TUNE windows alone. After the
first full run I added things that do not feed any setting (the paired
differences to the shipped row, the Beta-binomial line of C3(b), the
reference row, three of the five checks and the label layout of the
second figure).

**Choice on TUNE.** Ten 28-day windows 2023-12-25 to 2024-09-29, 61,847
isolate × antibiotic targets, local Brier, `left_out` (computed). The
hospital-365 estimate scores 0.1368 on the same targets.

| δ per week | M 10 | M 30 | M 100 |
|---|---|---|---|
| 0.90 | 0.1376 | 0.1376 | 0.1379 |
| 0.95 | **0.1377** | 0.1382 | 0.1398 |
| 0.98 | 0.1382 | 0.1397 | 0.1440 |
| 1.00 | 0.1389 | 0.1421 | 0.1515 |

The best cell is 0.1376; four settings lie within 0.0005 of it (δ 0.90 at
M 10, 30, 100 and δ 0.95 at M 10). The plan's rule (larger δ first) gives
**δ 0.95, M 10**, which is the reported row. No setting beats hospital-365
on TUNE.

**The chosen setting against the two baseline rows** (computed; the
baseline rows are the committed ones; n 163,666 predictions for C1 over
26 windows, 36,588 in small cells; C8 2,692; C4 pick counts 9,834 to
16,139; C7(a) 1,993 blocks):

| | hospital 365 d | shipped list | δ 0.95, M 10 |
|---|---|---|---|
| C1, all cells | 0.1414 (0.1398 to 0.1431) | 0.1417 (0.1401 to 0.1435) | 0.1416 (0.1399 to 0.1434) |
| C1 minus hospital-365, all | 0 | +0.0003 (+0.0001 to +0.0005) | +0.0002 (−0.0000 to +0.0004) |
| C1, small cells | 0.1605 (0.1576 to 0.1635) | 0.1614 (0.1582 to 0.1646) | 0.1614 (0.1584 to 0.1647) |
| C1 minus hospital-365, small | 0 | +0.0008 (+0.0004 to +0.0013) | +0.0009 (+0.0004 to +0.0013) |
| C1, all, counted | 0.1453 (0.1437 to 0.1469) | 0.1456 (0.1440 to 0.1472) | 0.1543 (0.1525 to 0.1562) |
| C2 minus hospital-365, all | 0 | +0.0011 (+0.0006 to +0.0017) | +0.0008 (+0.0002 to +0.0013) |
| C3(a) slope, intercept | 1.038, +0.023 | 1.026, +0.031 | 0.977 (0.964 to 0.990), +0.001 (−0.018 to +0.016) |
| C3(b) severe, below 0.9: observed / expected | 29 / 26.2 | 23 / 19.6 | 14 / 7.3 (binomial); 14 / 9.6 (Beta-binomial) |
| C4 mild, spectrum | 96.6 % | 96.6 % | 96.6 % (96.3 to 97.0) |
| C4 mild, all organisms | 75.4 % | 75.4 % | 75.4 % (74.7 to 76.0) |
| C4 severe | 95.3 % | 95.4 % | 95.5 % (95.1 to 95.8) |
| C4 severe, counted | 93.8 % | 93.9 % | 93.8 % (93.5 to 94.1) |
| C7(a), share inside the 90 % predictive interval | 0.899 (0.875 to 0.923) | 0.902 (0.877 to 0.925) | 0.929 (0.908 to 0.948) |
| C7(b), outbreak blocks (27) | 0.556 | 0.741 | 0.815 |
| C8 C1 (Brier, outbreak unit-months) | 0.1669 (0.1538 to 0.1931) | 0.1656 (0.1531 to 0.1928) | 0.1666 (0.1540 to 0.1937) |
| C8 C4, mild spectrum / severe | 96.4 % / 90.6 % | 96.4 % / 91.5 % | 95.8 % / none cleared |
| C6, days: E1 ceftriaxone / E1 cefuroxime / E2 cefuroxime | not reached / not reached / not reached | 47 / not reached / not reached | 48 / not reached / not reached |

C4 mild all, mild spectrum counted and mild all counted also match the
shipped row to within 0.1 point; `out/results.md` has every key with its
interval. "Counted" C1 is worse for every setting (+0.0083 to +0.0115
against hospital-365, computed) because the filter is fitted on tested
results only, as planned (see Deviations 3). "None cleared": no top pick
of this setting cleared 0.9 in an outbreak unit-month, so the harness has
no value.

**Replacement rule of METRICS.md "Decision rules", chosen setting, line
by line** (computed; "not worse" and "better" are read two ways, both
proposed (overnight), pending Artem: by point values, and by the paired 95 %
interval against the shipped row, same resamples):

| line | reading | δ 0.95, M 10 | verdict |
|---|---|---|---|
| C1 within 0.002 of hospital-365 | all cells, `left_out` | +0.0002 (−0.0000 to +0.0004) | pass |
| C4 not worse, both untested conventions | points: none of six figures below the shipped row | −0.008 (mild all) and −0.012 (mild all counted) and −0.043 (severe counted) points; the other three +0.030 to +0.040 | fail |
| | interval: no figure whose paired interval is wholly below zero | upper bounds +0.115, 0.000, +0.223, +0.113, 0.000, +0.158 points; "mild all" in both conventions has an upper bound of exactly 0 (the top pick differs in few months and the difference is never positive in a resample) | pass |
| C8 better | points: C8 Brier below the shipped row's | 0.1666 against 0.1656, +0.0011 | fail |
| | interval: paired interval wholly below zero | +0.0011 (+0.0002 to +0.0021), wholly above zero | fail |
| C3(b) passes | binomial expectation (the harness's primary, as 0010) | severe 14 / 7.3 = 1.92 | fail |
| | Beta-binomial expectation (METRICS.md's wording), beside it | severe 14 / 9.6 = 1.46 | pass |
| C7(a) passes | share 0.85 to 0.95 (proposed band) | 0.929 (0.908 to 0.948) | pass |

Two of five lines by points, three of five by interval (C3(b) read on
the harness's binomial expectation): **the chosen setting does not meet
the replacement rule** in either reading. With C3(b) on the Beta-binomial
expectation it would be three of five by points and four of five by
interval, still short on C8. C6 beside it: 48 days for E1 ceftriaxone,
cefuroxime and E2 not reached within 120 days.

**The grid on the scoring period** (computed; exploratory: every row
was scored on the scoring period, so a row picked from this table was
picked on the scoring period and must carry `tuned-on-test` if ever
promoted; difference to hospital-365, negative is better):

| setting | TUNE Brier | C1 diff, all (95 % interval) | C1 diff, small | C3(b) severe, obs / exp | C7(a) | C8 C1 diff (95 % interval) | C6 days E1 CRO / E1 CXM / E2 CXM |
|---|---|---|---|---|---|---|---|
| δ 0.90, M 10 | 0.1376 | +0.0005 (+0.0002 to +0.0007) | +0.0014 | 9 / 2.6 | 0.943 | +0.0006 (−0.0026 to +0.0049) | 44 / – / – |
| δ 0.90, M 30 | 0.1376 | +0.0001 (−0.0000 to +0.0003) | +0.0006 | 12 / 4.8 | 0.938 | −0.0004 (−0.0024 to +0.0020) | 48 / – / – |
| δ 0.90, M 100 | 0.1379 | −0.0001 (−0.0002 to +0.0001) | +0.0002 | 22 / 16.6 | 0.934 | −0.0005 (−0.0017 to +0.0008) | – / – / – |
| δ 0.95, M 10 (chosen) | 0.1377 | +0.0002 (−0.0000 to +0.0004) | +0.0009 | 14 / 7.3 | 0.929 | −0.0003 (−0.0026 to +0.0032) | 48 / – / – |
| δ 0.95, M 30 | 0.1382 | +0.0000 (−0.0002 to +0.0002) | +0.0003 | 14 / 10.2 | 0.929 | −0.0007 (−0.0024 to +0.0017) | 48 / – / – |
| δ 0.95, M 100 | 0.1398 | −0.0001 (−0.0002 to +0.0000) | +0.0001 | 24 / 19.8 | 0.924 | −0.0007 (−0.0018 to +0.0008) | – / – / – |
| δ 0.98, M 10 | 0.1382 | +0.0000 (−0.0002 to +0.0002) | +0.0006 | 19 / 16.2 | 0.924 | −0.0007 (−0.0021 to +0.0014) | – / – / – |
| δ 0.98, M 30 | 0.1397 | −0.0000 (−0.0002 to +0.0001) | +0.0005 | 16 / 17.0 | 0.923 | −0.0010 (−0.0023 to +0.0007) | – / – / – |
| δ 0.98, M 100 | 0.1440 | +0.0001 (−0.0001 to +0.0003) | +0.0007 | 12 / 15.8 | 0.913 | −0.0014 (−0.0027 to −0.0002) | – / – / – |
| δ 1.00, M 10 | 0.1389 | +0.0002 (+0.0000 to +0.0004) | +0.0017 | 17 / 23.8 | 0.916 | −0.0007 (−0.0016 to +0.0006) | – / – / – |
| δ 1.00, M 30 | 0.1421 | +0.0010 (+0.0007 to +0.0012) | +0.0045 | 10 / 17.2 | 0.912 | −0.0009 (−0.0029 to +0.0024) | – / – / – |
| δ 1.00, M 100 | 0.1515 | +0.0039 (+0.0033 to +0.0045) | +0.0136 | 0 / 5.7 | 0.849 | +0.0012 (−0.0027 to +0.0089) | – / – / – |
| δ 0.95, M 10, no onset split | | +0.0001 (−0.0001 to +0.0003) | +0.0008 | 21 / 13.3 | 0.916 | −0.0008 (−0.0036 to +0.0028) | 25 / 34 / – |
| δ 1.00, M 10, tracked prior | | −0.0000 (−0.0002 to +0.0002) | +0.0007 | 28 / 22.3 | 0.911 | +0.0000 (−0.0008 to +0.0016) | – / – / – |
| δ 1.00, M 30, tracked prior | | −0.0001 (−0.0003 to +0.0001) | +0.0004 | 29 / 24.4 | 0.912 | −0.0000 (−0.0008 to +0.0014) | – / – / – |
| δ 1.00, M 100, tracked prior | | −0.0001 (−0.0003 to +0.0000) | +0.0002 | 29 / 26.8 | 0.911 | −0.0000 (−0.0007 to +0.0011) | – / – / – |

("–" is "not reached" within 120 days.) For δ ≤ 0.98 the nine settings
differ from hospital-365 by −0.0001 to +0.0005 on C1; the only rows whose
C1 interval lies wholly above 0.002 are δ 1.00 at M 100 (small cells
also at M 30). No grid row passes all five lines of the replacement rule:
the most is four of five (δ 0.98 at M 100 by points, which fails C4 by
points; most rows by interval, which fail C8). The same lines for every
row are in `out/results.md`. For reference, 0004's estimator 5 (the
unit's year shrunk to the hospital's, M 20, no recency) scored C1 minus
hospital-365 +0.0002 (+0.0001 to +0.0004) and C8 C1 0.1655, −0.0014
(−0.0038 to +0.0017) against hospital-365 (computed here; the C1 numbers
equal 0004's table).

**C6 against the data** (the weekly counts are measured in the dataset):
in URO urine the weekly first isolates tested for ceftriaxone were 12.3
in the eight weeks 2025-04-07 to 2025-06-01 (onset 2025-05-30) and 15.3
in the eight weeks 2025-06-02 to 2025-07-27, the not-covered ones 3.4 and
5.4 a week, so the raw covered share fell from 0.72 to 0.65 (measured). The chosen estimate fell from
0.794 the day before onset to 0.733 on 2025-07-14 (computed). In E2's cell
(ICU, wound, cefuroxime) there are about 3 first isolates a week, 29
isolates in the nine weeks 2026-01-05 to 2026-03-08 and 21 in the eight
weeks 2026-03-09 to 2026-05-03 (measured), raw covered share 0.76 and
0.67; the 90 % interval at δ 0.90, M 30 is still 0.57 to 0.78 on
2026-04-15 against a pre-onset estimate of 0.73 (computed). The no-split
ablation, whose pooled filter has a narrower interval (90 % half-width
0.043 against 0.058 for the split estimate on 2025-05-29, computed),
reached E1 in 25 days (ceftriaxone) and 34 (cefuroxime) with nearly the
same point trajectory (no split 0.793 on 2025-05-29 and 0.729 on
2025-07-14; split 0.794 and 0.733, computed).

**Checks** (computed, in `out/results.md`): the vectorised recursion
equals a plain loop of the formula (difference 0); the estimate from a
table truncated at three cut dates (one a Sunday, two Wednesdays, so
with a partial week) is identical to the full-table estimate (difference
0, also at δ 1.0); the weekly first-isolate counts of three weeks equal a
loop over `aei.counting.first_isolates` and `aei.eucast.effective_result`
(difference 0 over 2,195 non-zero cell counts); the moment-matched
Beta has the mixture's mean and variance (2e-16); hospital-365 C1
recomputed 0.141409 against the committed 0.141409; the shipped row's C4
and C8 parts reproduce the committed row (4e-07).

**Deviations from plan.**

1. **δ = 1.0 and the floor term.** In the recursion as written the floor
   (1 − δ) M p0 has weight 0 at δ = 1.0, so the prior stays at its start
   value M p0,1, with p0,1 = 0.5 because the hospital's 52-week window is
   empty in the first week. The Experiment paragraph's "shrunk to the
   hospital's preceding year with weight M" does not hold for the
   recursion at δ = 1.0 (derived). I implemented the recursion as stated
   for the 12 grid settings, which are chosen on TUNE and reported, and
   added, exploratory and outside the choice, a "tracked prior" variant at
   δ = 1.0 for the three M: a_t = M p0,t + discounted own counts, the form
   the recursion takes for a constant p0, which keeps the prior on the
   current parent. Its rows follow the grid.
2. **Cut: none.** The 12 settings, the ablation and the three variants
   were all scored on every metric; nothing was skipped.
3. **Choices where the plan is silent**, all in `discounted_bb.py`
   (proposed (overnight), pending Artem): the week's first isolates are
   the first per patient × organism × specimen inside the ISO week (a
   patient with isolates in two weeks counts in both), for the filter and
   for p0, so p0 is not the harness's 365-day first-isolate share;
   the `spectrum` convention (C4 mild, C3(b) mild) is fitted on the
   spectrum outcome (no-breakpoint results left out), `counted` on the
   `left_out` counts as planned, so the "counted" C1 carries the cost the
   plan predicted; no `n` is returned, so there is no "fewer than 30
   results" gate and the harness scored every cell with no fallback
   (fallback count 0); separately, fewer severe top picks clear than for
   the shipped list (10,674 isolates against 14,473), which I read as the
   filter's smaller effective sample giving wider intervals (an unchecked
   reading); a cell
   with no own data in either stratum gets equal strata weights in an
   inpatient unit and the community stratum in an outpatient one; the
   tie rule "then to M = 30" is read as M = 30 if it is among the tied
   settings of the largest δ, else the lowest TUNE Brier (here only
   δ 0.95 at M 10 had that δ).
4. **TUNE Brier is local.** The harness's target builder has no period
   argument, so `run.py` builds the ten TUNE windows' targets with
   `aei.score_coverage.first_isolate_cells` (the same rule) and scores the
   isolate-level predictions itself; the plan allows this.
5. **Additions**, none a model setting: paired bootstrap differences to
   the shipped row for C4 (six figures) and C8 (computed from the harness's
   `c4_parts` and the same per-window sums), the two readings of the rule,
   the Beta-binomial line of C3(b), the reference row, the weekly-count and
   mixture checks, and a second figure.
6. **Figures.** `figure.png` draws only the right panel as planned; the
   hospital-365 share is drawn as its weekly values (dashed), not one
   horizontal line, since it moves weekly. Both figures are PNG with
   `metadata={"Software": None}`.

## Interpretation

**Against the hypothesis.** An exploratory description; nothing here is a
claim beyond the tables. Of the stated expectations, the first holds
partly: δ 0.98 at every M is within 0.002 of hospital-365 on C1 (+0.0000,
−0.0000, +0.0001) and so is δ 1.0 at M 10 and 30 (+0.0002, +0.0010), but
δ 1.0 at M 100 is not (+0.0039, +0.0033 to +0.0045). That is the frozen
prior of Deviation 1: the tracked variant at the same M gives −0.0001
(−0.0003 to +0.0000). The second was wrong in direction: δ 0.90 was
expected 0.001 to 0.003 worse and scored +0.0005, +0.0001 and −0.0001 at
M 10, 30 and 100. The third was wrong on the fast end: δ 0.90 reached E1
ceftriaxone at day 44 (M 10) and 48 (M 30), not within 21, and not at all
at M 100; cefuroxime in E1 and E2 were not reached by any of the 12
settings. δ 1.0 "over 35 days" holds (not reached in 120). The derivation
under "Where it breaks" assumed 5 to 6 resistant isolates a week
lowering the cephalosporin share by about 0.1 in two weeks at δ 0.90; the
data show about 2 more not-covered isolates a week and a raw share 0.08
lower in the eight weeks after onset than in the eight before, so the
signal was smaller than derived (measured). On
C8, the open question: no setting is credibly better than the shipped
row (the chosen one is worse, +0.0011, +0.0002 to +0.0021).

**Against the decision rules.** The chosen setting meets two of the five
lines by points and three by interval; no row of the grid meets all five
(at most four). C1 does not separate the settings for δ ≤ 0.98 (spread
−0.0001 to +0.0005), so B1 and B3 cannot be read off C1; what separates
them is C3(b) and C6. The settings that reach E1 on ceftriaxone (δ ≤ 0.95
and M ≤ 30, 44 to 48 days) are the ones with the highest severe C3(b)
ratios (observed / expected 3.5, 2.5, 1.9 and 1.4, binomial; the first
three fail the bar of 1.5); slow
and heavily shrunk settings (δ 0.98 to 1.0 with M 30 to 100) pass C3(b)
and never react within 120 days. By the Beta-binomial expectation that
METRICS.md names, the chosen row passes C3(b) (1.46), so the C3(b) line
depends on a reading the harness already flags as its own choice. The
shipped list's own C6 for E1 ceftriaxone is 47 days, so reacting at day
44 to 48 is no gain over it. C4 shows no difference larger than 0.043
points on any figure (the paired intervals all reach zero), but fewer
severe top picks clear than for the shipped list (10,674 isolates against
14,473), which C4's realised share, computed over the picks that clear,
does not show. For the doctor: nothing here says a number that reacts to
an outbreak is more accurate on the 28-day outcome, and on C1 no setting
with δ ≤ 0.98 is worse than hospital-365 by more than +0.0005 (point
values; the upper bound of an interval is +0.0007). Nothing is decided; whether the filter, and at
which constants, replaces the list stays Artem's decision.

**Strongest alternative explanation.** The C8 and C6 results are limited
by the events, not only by the method: E1 lowers the raw URO ceftriaxone
share by 0.08 and E2's cell sees three isolates a week (measured), and
C8 rests on six unit-months (2,692 pairs; the intervals of the
differences to hospital-365 have half-widths of 0.001 to 0.006), so a
difference of 0.001 is not reliably seen. Further, the only C8 difference
to hospital-365 whose interval excludes zero, δ 0.98 at M 100 (−0.0014,
−0.0027 to −0.0002), is also what 0004's recency-free unit-year estimator
scores (−0.0014), so it comes from the unit's own level, not from
responsiveness. C6 follows interval
width at least as much as the point estimate, as METRICS.md warns: the
no-split ablation moves like the split estimate but reached E1 in 25 and
34 days with a narrower interval. And the TUNE choice is weak evidence: the
filters start with 12 weeks of hospital history, every setting has a higher
(worse) Brier than hospital-365 on TUNE, and the TUNE score never decreases
with δ or M (smaller is better) while on the scoring period the nine
settings with δ ≤ 0.98 are flat, so the choice of δ 0.95, M 10 reflects
the cold start more than the steady state.

**Next experiment.** (1) Re-tune with a warm start, so TUNE does not
measure the filter's first twelve weeks, and fit the filter with untested
results as not covered (the gap the plan names), since "counted" C1 is
+0.008 to +0.012 worse for every setting. (2) Measure C6 as a rate: shift
a unit's resistance in injected cells over many unit × antibiotic cells
and seeds (the D2 machinery of the harness), so responsiveness has an
interval instead of two events. (3) The hierarchical estimate with unit
random effects (the next coverage method of the brief) as the competitor
for a unit-level number, since the unit's own level is what C8 rewarded.

## Decision numbers (2026-10-17, after close)

This record cites D-038 (the Beta-binomial method) and D-039 (detection on raw
counts) in the numbering of the overnight base. On main those two are D-041 and
D-042; D-038 and D-039 on main are other decisions.
