---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem
data: [synthetic_microbiology_dataset, seed 2026, as received 2026-10-09]
parent: 0016
---

# 0023 Does the Beta-binomial predictive tail beat the Poisson tail for the excess detectors?

## Goal

The live profile-excess and phenotype-excess tests (D-020) read P(Y ≥ y) from a
Poisson with mean n × (s + ½) / (t + 1): the window's n patients times the
baseline share, smoothed by half an isolate. That is a shortcut for the
Beta-binomial predictive (D-041's model: a Beta posterior from the baseline
counts, with pseudo-counts from the level above and a weekly discount, and
the count distribution it predicts). Artem's hypothesis (2026-10-17) is that
the predictive widens the tail where the baseline is thin (the rare profiles,
the small units) and leaves rich baselines alone, so there are fewer false
episodes at the same detection, or more detection at the same noise. D-044
keeps the live method, so no change ships without this measurement. The
answer decides whether ENGINE.md A3's tail is replaced, kept, or kept with a
note.

## Hypothesis

Confirmatory for one claim, descriptive for the rest. The yardstick is
METRICS.md "Decision rules" as 0015 and 0016 used it: D5, the D2 rate at k = 4
for the rare and the common ESBL *E. coli* families at the loosest level whose
D4 (cluster and sentinel episodes) is at most 5 a year, with D2's median delay
there; the reference is the live set at the same cut. From the baseline rows
the live set reads rare 0.920 and common ESBL 0.750 at 3.0 episodes a year,
and rare 0.980 and common ESBL 0.880 at 6.0 (measured, 0016's table).

Named before the run. A variant is better if at its D5 headline, at no more
episodes a year than the live set's at its headline (the larger of the two
cuts' noise, at most 5), both hold:

1. the rare rate is at least 0.92 and the common ESBL rate at least 0.80
   (the live 0.75 plus 0.05, about the Wilson half-width of 200 trials at
   0.75 is 0.06, so 0.05 is a sign, not a proof; a gain is claimed only if
   the intervals separate), or the same two rates with episodes a year at
   most two thirds of the live set's;
2. D2 at k = 4 for common resistant and wild type is at most the live set's
   plus 0.02, and the planted events E1 and E2 are found no later than the
   live set finds them (D1), so the gain is not bought with blindness or
   new false hits.

Direction, so the table can contradict it: the Beta-binomial's variance
exceeds the Poisson's by the factor 1 + (n − 1) / (a + b + 1) with a + b the
posterior concentration, so the widening is large only when t + m is small.
A phenotype baseline is a unit's year (hundreds to thousands of isolates) and
a profile baseline's stratum is organism × specimen hospital-wide (hundreds
to tens of thousands), so for most tests a + b is in the hundreds and the
predictive is almost the Poisson (derived). The wider tail should therefore
act in the thin cases (small units, rare organisms) and I expect at most a
5-point gain in D5 and at most a one third fall in episodes, with
m = 5 closest to the live set and δ = 0.95 noisiest (a discount shrinks t, so
widens more but also lets a growing outbreak raise its own baseline). The
discount is expected to matter least on a series that is flat by
construction (the synthetic data has no trend outside the planted events).

## Experiment

**Data.** `aei.harness.data()`, no row dropped. Scoring through
`aei.score_detection` exactly as 0016: the harness's injections (families rare,
common resistant, wild type, common ESBL, two unit; k = 0, 2, 3, 4, 6), seed
2026 stream, 200 trials per cell, scoring period 2024-10-01 to 2026-09-27,
tuning year 2023-10-02 to 2024-09-30, D1 to D7 and I1. Seeds 2027 to 2030
held out and not used.

**What is replaced.** Only the tail. Detectors, windows (28 days), baseline
(365 days, the 50-isolate floor), observed y (distinct patients) and the
minimums (3 for profile, 2 for phenotype), the trend test, the data rules and
new-in-unit stay the live set's (`LiveSet` with its two cluster functions
swapped), so a variant differs from the reference in one thing. Beta-binomial
tail: with baseline successes s and trials t (isolates, optionally weighted
by δ^w, w the whole weeks between the isolate and the window's start), a
prior of pseudo-count m shared by the parent's smoothed share π,

    a = s + m π,   b = t − s + m (1 − π),   Y ~ BetaBinomial(n, a, b),
    p = P(Y ≥ y),

n the patients with the organism (and specimen) in the unit's window for
profile excess, the unit's patients in the window for phenotype excess.
Phenotype excess: s, t are the unit's, the parent is the hospital-wide share
over the same baseline, smoothed (s_h + ½) / (t_h + 1). Profile excess: s, t
are the stratum's hospital-wide counts as the live test reads them (the
profile's isolates and all isolates of organism × specimen), and the brief's
parent is the same stratum, so π = (s + ½) / (t + 1): the predictive then has
the live mean and only a wider tail (documented as the primary reading). A
secondary profile variant at the best (m, δ) takes the parent one level up,
the organism's hospital-wide share of the profile across specimens, so the
mean also moves. Grid: m ∈ {5, 10, 20} × δ ∈ {0.95, 0.98, 1.0}, nine
settings. All proposed (task brief), pending Artem; none is in DECISIONS.md.

**Equal noise.** The live alphas multiply by the level m' in the harness's
sweep (100 down to 0.01, extended by 300 and 1000); the Beta-binomial's p is
larger than the Poisson's, so its operating level is found the way 0016 did:
the loosest level with D4 at most 5 a year (D5 headline), read on the
scoring period, and the whole D5 curve is kept so any noise can be read
off. Settings are also chosen on year 1 only (`tune_curve`, 40 + 40 clusters of
4, rule as 0016: highest rare hit count at at most 5 episodes a year, ties
common ESBL hit count, fewer episodes, larger m, larger δ) and that choice is
the primary row; the table over all nine on the scoring period is
exploratory.

**Reference.** The live set as shipped (alphas 1e-4, 1e-3, level 1) and
`LiveSet` read at its own D5 headline, both rerun here through the same code
(so a one-thing difference), beside the baseline rows
`live-set-retuned-year1` and `live-set-shipped` as a check.

**Checks.** The tail against a direct pmf sum on random (n, y, a, b); the
variant with m → ∞ and π equal to the share against the Poisson; δ = 1
against the undiscounted counts; `check_causal` on three cut dates; the trial
fast path against from-scratch on a few trials.

**Budget.** Python, CPU only. A trial costs about 20 ms live (0011, computed),
more with the Beta-binomial; 10 grid cells plus the references at 200 trials
over D1, D2, D4, D5 is estimated at 30 to 40 minutes, from a 10-trial dry
run before the full grid. If the grid exceeds 45 minutes it drops to 50
trials per cell, said under "Deviations from plan"; over an hour asks the
operator first.

**Command and outputs.**

    uv run python experiments/0023-beta-binomial-tail/run.py

writes `out/results.md`, `out/metrics.json` (the year-1 choice, through
`aei.harness.write_metrics`), `out/metrics-live.json`, `out/grid.json`.

## Result

`uv run python experiments/0023-beta-binomial-tail/run.py` ran in 974 s wall
(942 s CPU; measured). The 10-trial dry run predicted about 17 minutes; the
plan's 30 to 40 minute estimate was high, so no cut was made: 200 trials per
cell, seed 2026 only, seeds 2027 to 2030 unused. Everything below is
measured or computed by that run; `out/results.md` has every table,
`out/metrics.json` the year-1 pick, `out/metrics-live.json` the live set rerun
through the same code, `out/metrics-organism-parent.json` the secondary
profile variant, `out/grid.json` the year-1 tables and D5 curves.

**Headline, D5 at k = 4, the loosest level with at most 5 episodes a year
(Wilson 95 %).** Every row lands on level 3 (3.01 episodes a year, 6 episodes)
except the δ = 0.95 rows (2.01, 4 episodes).

| row | rare | common ESBL | episodes a year |
|---|---|---|---|
| live set, Poisson tail | 0.920 [0.874, 0.950] | 0.750 [0.686, 0.805] | 3.01 |
| Beta-binomial, δ = 1 (m = 5, 10, 20 identical) | 0.925 [0.880, 0.954] | 0.760 [0.696, 0.814] | 3.01 |
| Beta-binomial, δ = 0.98 (year-1 pick, m = 20) | 0.915 [0.868, 0.946] | 0.735 [0.670, 0.791] | 3.01 |
| Beta-binomial, δ = 0.95 | 0.905 [0.856, 0.938] | 0.725 [0.659, 0.782] | 2.01 |

At equal noise, read off the D5 curve (linear between levels): at 5 episodes
a year the live set reads 0.960 and 0.836, the best variant (δ = 1) 0.949 and
0.815, δ = 0.98 0.939 and 0.799, δ = 0.95 0.921 and 0.773. At the live set's
own 3.01 a year the δ = 1 variant reads 0.925 and 0.760 (a gain of 0.005 and
0.010, far inside the intervals). The curves cross and re-cross within 0.03
everywhere from 2 to 40 episodes a year (`out/results.md`).

**m does nothing.** The three prior strengths give the same numbers to the
last digit in every D5 row and curve. The 50-isolate floor is the smallest
baseline the tests ever use, so a + b is at least 50 + m, and m = 5 to 20
changes the Beta-binomial's variance factor 1 + (n − 1) / (a + b + 1) by at
most a few per cent (derived); the tail moves less than the harness's
resolution.

**The discount costs.** δ = 0.98 and 0.95 lower both rates by 0.01 to 0.03
at every noise level and are the only settings that differ from δ = 1; at
δ = 0.95 the level-3 row has fewer episodes (2.01) only because the next
level up (10) is above 5 a year, so the cut falls lower on a curve that is
below the live set's everywhere (0.91 and 0.72 against 0.92 and 0.75 at
3 a year).

**Year-1 pick.** On the tuning year no setting, the live set included,
reaches 5 episodes a year (the floor is 7.98 a year, 4 episodes in the half
year, at every strict level), so the plan's rule had no operating row; see
deviations. At the live set's shipped-level year-1 noise (13.97 a year) the
live set detects 32 of 40 rare and 35 of 40 common ESBL clusters; the pick is
m = 20, δ = 0.98 (30 and 35; the δ = 1 settings drop to 26 and 29 because
their noise leaves them at level 0.3). The pick reads 0.915 and 0.735 on the
scoring period.

**Every part, live against the pick (200 trials per cell).** D2 at k = 4:
rare 0.890 against 0.875, common ESBL 0.610 against 0.585, two-unit 0.240
against 0.200, common resistant 0.005 and 0.005, wild type 0.000 and 0.000
(all within the intervals, which are ±0.05 to 0.07). D2 at k = 3, rare: 0.615
against 0.550. D1: E1, E2, E3 as live (E1 corrected 5 days, E2 and E3 not
found by either); E4 is found at 2026-06-07 against 2026-05-10 (the trend
test, which leaves out isolates of detected clusters, so a different cluster
set moves it). D4: 3.52 episodes a year against 4.52 (cluster 0.00 against
1.00: one live episode fewer, sentinel 1.51 and data 2.01 unchanged); alerts a
week 0.067 against 0.087; D6 0.012 both; D7 0.974 both; I1 16 alerts in 13
incidents against 18 in 15. The secondary profile variant (parent one level up,
the organism's share across specimens) gives the same D5, a rare k = 3 of
0.585 against 0.550 and nothing else different.

**Checks (all passed).** The tail against a direct sum of the pmf over 300
random (n, y, a, b): absolute error at most 1.1e-12 (scipy's `betabinom.sf`
has that floor; the alphas used are at least 1e-6, so it never decides a
signal); against the binomial as m → 10^7, relative difference 0.004. The
focused path against the full run on the real data: 3 cases, 62 signals, no
differences, at δ = 0.98 and 0.95. The trial fast path against the same
detector run on all the data: 40 trials each, no differences at levels 1 and
3 (the live set shows the same 1 to 3 differing trials at the loosest level
100, where the harness's focus leaves out other specimens of the organism;
checked on the live set too, 60 trials, 1 differing, so it is the harness's,
not the tail's). `check_causal` on 2025-03-31, 2025-12-31 and 2026-06-30:
causal, at δ = 0.98 and 0.95.

**Deviations from plan.**

- Year-1 selection: the plan's rule (loosest level with at most 5 episodes a
  year) has no row, because the tuning year's noise floor is 7.98 a year for
  every setting, the live set too (the first months have less than 365 days of
  baseline). The rule used: the loosest level whose year-1 noise is at most
  the live set's at its shipped alphas, 13.97 a year; ties and order as
  planned. The scoring-period headline keeps the 5 a year cut.
- Levels: the plan extended the sweep by 300 and 1000; it was dropped after a
  trial check found the harness's focused trials miss other-specimen signals
  at levels that loose (identically for the live set), so the sweep is the live
  set's, 100 down to 0.01. No headline reads above level 3.
- The live set is rerun here, not read from the baseline rows; it reproduces
  `live-set-retuned-year1` (0.92 and 0.75 at 3.01 a year).
- Profile excess's primary parent is the stratum itself, as the brief reads,
  so the mean is the live mean and only the tail differs; the organism-level
  parent is the secondary variant.
- The data directory is a symlink to the main checkout's `data/` (git-ignored);
  nothing in it changed.

## Interpretation

**Do not ship.** At the same noise the Beta-binomial predictive tail does not
beat the Poisson tail: the best variant (δ = 1) is +0.005 rare and +0.010
common ESBL at 3 episodes a year and −0.011 and −0.021 at 5 a year, every
difference far inside the 200-trial intervals (±0.05 to 0.07), and no
variant meets the success rule's 0.92 and 0.80. The discounted variants are
below the live set on both rates at every noise level, the pick (m = 20,
δ = 0.98) by 0.005 and 0.015 at the headline and by 0.02 and 0.04 at 5 a
year. The plan's direction, a gain of at most 5 points with fewer episodes,
is half right: no gain, as feared, and the episodes a year fell only by one
(cluster 1.00 to 0.00, one episode in two years).

Why: the hypothesis needs a thin baseline, and the live tests rarely have
one. The 50-isolate floor and a 365-day baseline give a + b of hundreds to
tens of thousands, so the predictive is the Poisson to within the sampling
noise; m, which acts only on thin baselines, changes nothing at all. Where
the baseline would be thin the test does not run (the floor) or the
observed-count minimum (3 or 2) already stops it. The strongest alternative
explanation is that the harness injects clusters of the live set's own
detectable size into rich strata; a stratum with 5 to 20 baseline isolates
would show the widening, but D-020's floor excludes it, and relaxing the
floor is a different experiment (live detector on thin strata, with the
Beta-binomial as the guard that makes it safe).

What it means for the decision: ENGINE.md A3's Poisson tail with the +½/+1
smoothing stays (D-044 unchanged). The record can say the Poisson is a sound
shortcut here (it matches the predictive to within noise) for the strata the
live set tests, which is the sentence to cite if the Beta-binomial comes up
again. Next, if the question matters: lower the 50-isolate floor and the
minimum observed count together on thin strata and score the live Poisson
against the Beta-binomial there, at equal noise; one seed here, held-out
seeds 2027 to 2030 untouched, so the finding is a screening result.
