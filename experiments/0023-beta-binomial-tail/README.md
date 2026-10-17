---
status: proposed    # proposed, then accepted, rejected or superseded
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

Filled in at close.

## Interpretation

Filled in at close.
