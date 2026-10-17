---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem (overnight run)
data: [synthetic_microbiology_dataset, seed 2026, as received 2026-10-09]
parent: 0015
---

# 0018 Does Bayesian online change-point detection on weekly counts and weekly %R find injected clusters at the live set's noise?

## Goal

Every cluster test in the tool and in the night's plans compares a
fixed window with a fixed-length baseline (the live tests 28 days
against 365, D-020; 0015 L weeks against S behind a guard band), and
QUESTIONS C3 asks how long the baseline should be. Bayesian online
change-point detection (BOCPD, Adams and MacKay 2007) removes the
question: per series it keeps a posterior over the weeks since the rate
last changed, so the baseline is whatever run the data support, and it
yields the posterior probability of a recent change and a distribution
over the change date, which is what ENGINE.md 3.6's card wants. This
experiment runs BOCPD on weekly patient counts per unit × phenotype and
unit × organism (Gamma-Poisson) and on weekly %R per unit ×
surveillance pair (Beta-binomial), sweeps the constant hazard, and
scores it on D1 to D7 and I1 against the live set re-tuned on year one
and as shipped, so Artem can judge whether a change-point posterior
should join or replace the windowed tests, and whether a unit's own %R
shift is worth a signal.

## Hypothesis

This experiment is exploratory in PROTOCOL.md's sense: it describes how
BOCPD scores on the detection metrics at each hazard and signal width
and supports no claim beyond its table. The yardstick is METRICS.md
"Decision rules": the D5 headline, the D2 rate at k = 4 for the rare and
the common ESBL *E. coli* families at the loosest level whose D4 is at
most 5 episodes a year, with D2's median delay there; the live set's
year-1 re-tune is the reference row.

Described: D1 (demonstration), D2 and delay for the five injection
families, D4 by kind, the D5 curve and headline, D6, D7, I1, for the
count detector, the %R detector and both together, at the setting
chosen on the tuning year and at every setting of the grid.

Directional expectation, stated so the table can contradict it: at
5 episodes a year the combined detector reaches at least 90 % on the
rare family at k = 4 (live set 38 of 40, computed, 0007) and at least
50 % on the common ESBL family (33 of 60, computed, 0011), and beats
0015's windowed test by no more than 10 points on either, because the
harness injects bursts (k patients within 14 days) and BOCPD's edge
over a window is on changes that last. Common resistant and wild-type
stay near 0 % (1 of 180 each, computed, 0011): no typing is added. The
%R detector alone reaches at least 50 % on the rare family at k = 4
(assumed: 4 ESBL patients among about 14 *E. coli* tested in two weeks
in a unit like URO lift the ceftriaxone R share from 0.07 to about
0.25; shares measured, lift derived). E1 is found within 7 days of
2025-05-30 and E2 within March 2026 (derived from the planted counts);
E3 and E4 are not this method's kinds.

## Experiment

**Data.** `synthetic_microbiology_dataset` through `aei.harness.data()`;
raw weekly counts, never estimates (D-039).

**Series**, per unit on ISO weeks. Counts: unit × phenotype (ESBL,
MRSA, VRE, CPE), 36 series, and unit × organism, 81; an event is a
patient's first isolate of the series in the unit within the trailing
365 days (as 0015; proposed (overnight), pending Artem), by sample
date. Rates: unit × surveillance pair (the 22 of
`aei.detect.SURVEILLANCE_PAIRS`, with specimen where given), 198
series; n_t first isolates with an S or R result, r_t those with R.
Volumes are small: ESBL patients a week 0.50 in URO, 0.62 in ED, 0.06 in
the ICU; MRSA 0.12 a week in the ICU with 94 % zero weeks; *E. coli*
with a ceftriaxone result 16 a week in a health centre, 7 in URO, 1 in
the ICU (measured here, distinct patients per ISO week).

**Filter and signal** (derived below). Per series a posterior over the
run length r_t, the complete weeks since the last change, updated with
a constant hazard H and the conjugate predictive of each week. On a day
inside a week the partial week enters as an observation with exposure
e = d / 7 (counts) or as the (n, r) so far (rates); the carried state
advances only on complete weeks, so every day has a signal and a signal
dated t reads nothing after t. Signal m_t = P(r_t < w | data to t),
gated to upward changes (posterior mean rate or share over run lengths
below w exceeds that over w and above) and to at least 2 events, or 2 R
results, in the last w weeks (the live phenotype test's minimum;
proposed (overnight), pending Artem). `p` = 1 − m_t; levels, loosest
first, p < {0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005}.
`aei.detect.Signal` with `detector` "bocpd-count" or "bocpd-rate",
`ward`, `phenotype` or `organism` (the pair's organism for rates),
`observed` the last w weeks' events or r / n, `expected` the predictive
mean under run lengths w and above, `key` unit|series. `kind_fn` is
passed to the harness's `Detector` (its default map knows only the live
names): cluster for counts, divergence for rates (why: end of
"Mathematical foundation"). Three rows: counts, rates, both together
(union; the fixed episode key merges).

**Grid.** H ∈ {1/26, 1/52, 1/104, 1/208} × w ∈ {2, 4}: 8 settings. The
new-segment prior is fixed, proposed (overnight), pending Artem:
counts Gamma(1, 1 / m), m the series' hospital-implied weekly rate in
the unit (hospital events per isolate times the unit's isolates a week
over the first 26 weeks the detector receives, floor 0.02); rates Beta
of strength 2 with mean the pair's hospital R share over the same
weeks, Jeffreys-smoothed. The first 26 weeks raise no signal.

**Choosing a setting on the tuning year only**, as 0015 and
harness-spec.md Choices 5: inject 40 rare and 40 common ESBL *E. coli*
clusters of k = 4 with starts 2024-04-01 to 2024-08-15, seed 2026;
count other episodes (fixed key) over 2024-04-01 to 2024-09-30 scaled to
a year at every level; per setting take the loosest level with at most
5 a year; choose the highest rare rate there, ties by the common ESBL
rate, then fewer episodes, then the smaller H. Chosen on the combined
row; the parts use the same setting. `tuned_on`
"2024-04-01..2024-09-30", `tuned_on_test` false.

**Seeds.** Screening on seed 2026 only: 200 trials per cell from one
`mulberry32(2026)` stream as `aei.inject.seed_trials` draws them; seeds
2027 to 2030 are held out and not used here. Spread: the 95 % Wilson
interval per cell and the five consecutive blocks of 40 trials.

**Baselines** (benchmarks/overnight-2026-10-17/baselines/):
`live-set-retuned-year1`, the reference; `live-set-shipped`, flagged
`tuned-on-test`; 0015's row beside them if closed.

**Metrics** through `aei.score_detection.score_detector`: D1 (E3, E4
not found by construction; a %R signal on urinary *E. coli*
trimethoprim is reported, not claimed); D2 and delay for the five
families at k ∈ {2, 3, 4, 6} plus controls; D4 by kind and alerts per
week; the D5 curve and headline (Choices 3); D6 on the injected gaps
(D3 left out, no data signals; the upward gate should keep gap-week
signals at zero); D7 twice, rates as divergence and rates as cluster,
so the naming's cost is visible; I1. `check_causal` on 2025-03-31,
2025-12-31, 2026-06-30.

**Budget.** 10 minutes of CPU for `run.py` (`aei.harness.Clock`),
informational. The full run, 315 series × 1,092 days × at most 157 run
lengths, is vectorised over run lengths (seconds); the 5,000 trials
(5 families × 5 cells × 200) on the focus unit's 35 series plus 8 × 80
tuning trials dominate; the three rows share one run per trial. Cuts
in order, each under "Deviations from plan": (1) `wild_type` and
`two_unit` to 100 trials per cell; (2) w = 2 dropped; (3) H to {1/52,
1/208}; (4) k = 2 and 6 to 100 trials; (5) rate series restricted to
the pairs a phenotype touches (CRO, CXM, CIP; FOX, CLI; VAN).

**Command and outputs.**

    uv run python experiments/0018-bocpd/run.py

writes `out/results.md` (tuning table, chosen setting, D1 to D7 and I1
for the three rows against the baselines with intervals, D5 curves, D7
both ways, whether pruning run lengths below 1e-4 posterior changes any
signal date), `out/metrics.json` (the combined row through
`aei.harness.write_metrics`, `D5_curve` at top level),
`out/metrics-counts.json`, `out/metrics-rates.json` (the parts),
`out/grid.json` (every setting, exploratory), `out/figure.png` (the
sketch below, under 1 MB, `metadata={"Software": None}`). numpy and
scipy only; nothing new in `libs/utils` unless the orchestrator asks.

## Mathematical foundation

**Model.** A series is piecewise constant: within a segment the weekly
observations share one parameter (a Poisson rate λ, or an R share π);
at each week boundary a new segment starts with probability H, the
hazard, independently of the past, so segment lengths are geometric
with mean 1 / H. The run length r_t is the number of complete weeks
since the current segment began (Adams and MacKay 2007; the same filter
as Fearnhead and Liu 2007 and Barry and Hartigan 1993).

**Recursion.** With x_t week t's observation and π_t^{(r)} = P(x_t |
r_{t−1} = r, the last r observations) the predictive from that run's
conjugate posterior (r = 0: the prior),

    growth        P(r_t = r + 1, x_{1:t}) = P(r_{t−1} = r, x_{1:t−1}) · π_t^{(r)} · (1 − H)
    change point  P(r_t = 0,     x_{1:t}) = Σ_r P(r_{t−1} = r, x_{1:t−1}) · π_t^{(r)} · H
    posterior     P(r_t | x_{1:t}) = P(r_t, x_{1:t}) / Σ_r P(r_t = r, x_{1:t})

from P(r_0 = 0) = 1, in log space, one vector of run lengths per series
per step.

**Conjugate predictives.** Counts: prior Gamma(α0, β0); a run holding
S_r events over r weeks gives λ ~ Gamma(α0 + S_r, β0 + r), and a week
with exposure e has

    π(y) = NB( y ; α0 + S_r ,  (β0 + r) / (β0 + r + e) ),   E[y] = e (α0 + S_r) / (β0 + r)

(Gelman et al., BDA ch. 2); e = d / 7 is exact for a Poisson process
seen for part of the week. Rates: prior Beta(a0, b0); a run holding R_r
of N_r gives the Beta-binomial with (a0 + R_r, b0 + N_r − R_r); a week
with n = 0 has π = 1 and moves the posterior only by the hazard. Shape 1
for counts is an exponential prior on λ, so a new segment at twice or
half the usual rate is not improbable a priori; strength 2 for the Beta
plays the same part. Inside a week the filter takes one provisional
step from the last complete week's posterior; on Sunday the step is
redone with the full week and carried.

**Truncation.** Over 156 weeks there are at most 157 run lengths, so
the recursion is run exactly. A deployment drops run lengths whose
posterior mass is below 1e-4 and renormalises (Adams and MacKay); the
run reports whether that changes any signal date (expected: none).

**Signal, threshold, p.** Under the prior, P(r < w) = 1 − (1 − H)^w:
7.5 % for H = 1/52, w = 4, prior odds 0.081 (derived), so m_t ≥ 0.5
means the data raised the odds of a recent change by a Bayes factor of
about 12, and m_t ≥ 0.95 by about 235 (derived). The direction gate
compares E[λ | r_t < w] with E[λ | r_t ≥ w], posterior-weighted over run
lengths, so a sampling drop is never a cluster. p = 1 − m_t is monotone
in m_t, which is all the harness's post-hoc sweep needs; it is not a
frequentist p-value, and the levels are calibrated by D4, not by a
nominal error rate. Series run independently with no multiplicity
correction: posterior probabilities are not p-values and the noise
level is the control; a shared hazard across series is the extension.

**Hazard and prior on year 1.** H and w are the only free settings and
are chosen by the tuning-year injections above. The prior's mean is
read from the first 26 weeks the detector receives and never revised;
its strength (1 week, 2 isolates) is fixed by proposal.

**Causality.** P(r_t | x_{1:t}) reads x_{1:t} only; the partial-week
observation on day t holds rows dated ≤ t; events are dated by sample
date (D-005). `check_causal` at three cut dates verifies it.

**Where it breaks.** A slow rise (E4) is absorbed by the long run or
split into small changes that never reach m_t ≥ 0.5: BOCPD is not a
trend detector. A single spike week raises m_t and the next normal week
lowers it (one short signal, merged by the 28-day rule); a change that
lasts keeps m_t high for w weeks and then fades as the new level
becomes the run, one episode per change, but a second rise inside a
long outbreak is measured against the outbreak's level. Sparse series
(ICU MRSA, 94 % zero weeks) sit near the prior, so the second patient
within w weeks can already signal: a soft "new in unit" that may double
D-021's alerts; I1 shows it. The constant hazard is a convenience with
no meaning in the ward. The predictives carry the run's uncertainty,
not sampling surges (E2 came with a jump in total *S. aureus*,
measured): a surge can signal on the organism series while %R stays
flat, which the card shows side by side. Organism series carry the
organism's volume, so the common families cannot be caught by them.

**Kind of the %R signals: divergence, not cluster.** The harness's
fixed kind map already names the one unit-level %R shift the tool has
had (0002's resistance shift) a divergence, and the leaderboard
compares kinds across methods, so the same object must carry the same
name. ENGINE.md 3.6's cluster sentence ("N isolates in 4 weeks, usual
1") is written from a patient count with the isolates behind it; a
share has no such count, while the divergence sentence has a
share-shaped sibling ("Urology ceftriaxone resistance above its own
past: 45 %, usual 7 %"). And a %R step has more causes than a clone (a
breakpoint change, a sampling shift, a drift of the unit's flora), so
"cluster" would claim more than the test knows. The cost is measured:
D7 scores a cluster found only by the %R detector as misnamed, hence
D7 both ways.

**References.** Adams and MacKay (2007, arXiv:0710.3742); Fearnhead and
Liu (2007, JRSS B); Barry and Hartigan (1993, JASA); Gelman et al., BDA
(3rd ed., ch. 2); Knoblauch and Damoulas (2018, ICML) on hazards.

## Why this method here

- The live tests and 0015 fix the baseline's length by decision
  (QUESTIONS C3); BOCPD makes it a posterior and adds the change date.
  E1's weekly counts 0, 0, 1, 5, 5, 6, 6, 5 (measured, planted events)
  are one segment ending and another starting.
- ENGINE.md 3.3 wants a CUSUM beside the weekly test for the slow drip.
  BOCPD integrates evidence over the whole new segment, so three weeks
  of one extra case each add up as in a CUSUM, with a posterior in
  place of h; 0016 (CUSUM) and this record are the pair to read
  together.
- The live set has had no unit-level %R signal since D-032; E1 is
  visible in URO's ceftriaxone and cefuroxime %R (5 to 6 ESBL *E. coli*
  a week against 7 tested, measured). The rate rows measure what such a
  signal costs in episodes.
- Honest limit: the D2 families are bursts, where a window is the
  natural test. A drip family (one case a week for 4 to 6 weeks) is
  not in the harness; it is the follow-up where this method should
  part from 0015, and the record will say so if the table shows no gap.
- For the researcher: "changed, probably in week 23" with a probability
  and the old and new rates, and a %R card for the unit's own shift.
  For the doctor: nothing directly; a signal in the unit annotates the
  list (B7).

## Proposed visualisation

One card of the researcher's signal feed, light mode, drawn for E1:
URO, ESBL, as of 2025-06-15.

- Header: "ESBL · Urologia / Urology — muutos todennäköisesti viikolla
  23 (2.6.) / change most likely in week 23 (2 June) · 5 potilasta
  viikossa, ennen 0.4 / 5 patients a week, before 0.4 · todennäköisyys
  0.97 / probability 0.97"; each number a field of the signal (modal
  change week, posterior means over short and long runs, m_t).
- Body, 30 weeks wide: weekly patient counts as grey bars; over them
  the filtered weekly rate E[λ_t | data to t] as a stepped line with
  its 80 % band, jumping at the change; the modal change week as a
  vertical rule with a bracket for the 80 % interval of the change
  date; the as-of date at the right edge.
- Strip under the bars: m_t per week as a grey fill from 0 to 1 with
  the alert level dashed, so the eye sees the probability cross it.
- Encodings: height for counts, band for uncertainty, position for the
  date, fill for probability; colour carries nothing. Labels bilingual,
  Finnish first, from `wards.csv`.

`out/figure.png` draws the body and the strip for E1 at the chosen
setting, 2024-11 to 2025-07, onset 2025-05-30 and first signal marked.

## Result

Command, from the repository root:

    uv run python experiments/0018-bocpd/run.py

Outputs in `out/`: `results.md` (every table of this section and more: the
tuning table at all 13 levels, the D5 curves of the three rows, the full D2
table, the grid by part, the prior-mean ablation), `metrics.json` (the
combined row, family `detection`, `tuned_on_test` false, `tuned_on`
2024-04-01..2024-09-30, `D5_curve` at top level), `metrics-counts.json`
and `metrics-rates.json` (the parts), `grid.json` (all eight settings, the
looser levels and the ablation, marked exploratory), `figure.png` (the card
of the proposed visualisation, drawn for E1) and `d5_curve.png`. `uv run
python scripts/verify_experiments.py --only 0018` says "reproduces". CPU
time 245 to 330 s over three runs of nearly the same code (measured,
`aei.harness.Clock`; it moves with the load of the shared machine; the
budget was 10 minutes and nothing was cut). Screening seed 2026 only, 200 trials per cell from one
`mulberry32(2026)` stream, seeds 2027 to 2030 not used; spread is the 95 %
Wilson interval per cell and the five consecutive blocks of 40 trials
(rare k = 4, combined: 6, 5, 6, 4, 7 detections; common ESBL: 7, 6, 4, 6,
4; computed). Every number is computed by this run through
`aei.score_detection` unless tagged measured, derived or assumed; the two
baseline rows are the committed `baselines/live-set-*.json`, computed by the
same harness (0015's row is not in the baselines yet, so it is not
compared). `tuned_on_test` is false: the setting and the level were chosen
on the tuning year alone.

**Series and checks** (measured and computed). 117 count series and 198
rate series over 156 weeks from 2023-10-02; 22,312 count events and
107,464 rate results of which 8,891 R. Weekly means match the plan's
volumes: ESBL patients a week URO 0.50, ED 0.60, ICU 0.06; ICU MRSA 0.12 a
week with 94 % zero weeks (measured). `check_causal` on 2025-03-31,
2025-12-31 and 2026-06-30: no difference. The trial path (cached filter
states for the weeks before a trial, rows from the trial's week) gave the
same signals, dates, keys and p to 1e-9, as the unfocused run on the same
rows in 8 of 8 trials (3 rare, 2 common ESBL, 1 two-unit, 2 gaps); no trial
fell back to the full run. The vectorised recursion equals a plain
Adams and MacKay loop (scipy `nbinom` and `betabinom`) to 1e-14 on random
series with partial weeks (checked during development, not part of the run).
**Pruning** run lengths below 1e-4 posterior: no signal differs at the
chosen setting and level (33 signals exact, 33 pruned); over the grid at the
loosest level (p < 0.9) up to 10 signals of 27,829 differ (H = 1/26, w = 4)
and p changes by up to 0.06, so the plan's "expected: none" holds at the
operating levels and not at the loosest one (table in `results.md`).

**Choice on the tuning year** (computed): 40 rare and 40 common ESBL
*E. coli* clusters of 4, seed 2026, starts 2024-04-01 to 2024-08-15; noise
over 2024-04-01 to 2024-09-30 scaled to a year, counts and %R episodes (one
episode is 2.0 a year, derived). The plan's rule chooses **H = 1/26,
w = 2, level p < 0.5**: noise 4 a year, rare 8 of 40, common ESBL 8 of 40;
the next best was H = 1/208, w = 4, p < 0.4 with 7 of 40 and 6 of 40. No
setting reached 10 of 40 on either family at 5 episodes a year or fewer.

**Headline: D5 at the loosest level of the plan's grid with at most 5
episodes a year** (D4 over cluster and sentinel signals, as the harness
reads it; computed; intervals 95 % Wilson, noise 95 % exact Poisson):

| row | level | noise, episodes a year | rare k = 4 | common ESBL k = 4 | median delay, days (rare / common) | same curve on whole-tool noise |
|---|---|---|---|---|---|---|
| BOCPD counts and %R | p < 0.5 | 1.5 (0.3 to 4.4) | 14.0 % (10 to 19) | 13.5 % (9 to 19) | 3 / 3 | p < 0.4: 2.0 a year, 10 % / 10 % |
| BOCPD counts | p < 0.5 | 1.5 (0.3 to 4.4) | 1.5 % (1 to 4) | 1.0 % (0 to 4) | 4 / 1 | p < 0.5: 1.5 a year, 2 % / 1 % |
| BOCPD %R | p < 0.5 | 0.0 (0.0 to 1.9) | 12.5 % (9 to 18) | 13.0 % (9 to 18) | 3 / 3 | p < 0.4: 2.0 a year, 8 % / 10 % |
| live set, re-tuned on year 1 | level x0.3 | 3.0 (1.1 to 6.6) | 92.0 % (87 to 95) | 75.0 % (69 to 80) | 6 / 6 | level x0.01: 5.0 a year, 71 % / 34 % |
| live set, as shipped (tuned on test) | level x3 | 3.0 (1.1 to 6.6) | 92.0 % (87 to 95) | 75.0 % (69 to 80) | 6 / 6 | level x1: 4.5 a year, 89 % / 61 % |

The plan's grid ends at p < 0.5, so the headline sits at its loosest point.
There the combined row has 3 cluster episodes (1.5 a year) but 13 episodes
in all (6.5 a year): 10 of them are %R episodes, which the harness names
divergence and leaves out of D5's noise, so the "noise 0.0" of the %R row
and the 1.5 of the combined row understate its false alarms. The last column
reads the same curve on every episode: the combined row at 2.0 a year detects
10 % (7 to 15) of rare and 10.5 % (7 to 16) of common ESBL clusters.
The delay is a median over 28 and 27 detections of 200 (BOCPD) against 184
and 150 (live set), so it is not a like-for-like comparison. The five
D5 levels of the combined row from 0.5 to 0.1 give rare 14.0, 10.0, 4.0, 1.0
and 1.0 % and common ESBL 13.5, 10.5, 6.0, 3.0 and 1.5 %; below p < 0.05
nothing is found (`results.md`).

**D2 at k = 3 and 4, every family, at the chosen level p < 0.5** (computed;
rate with 95 % Wilson interval, median delay in days; the live rows at their
operating alphas):

| row | rare k = 3 | rare k = 4 | common resistant k = 4 | wild type k = 4 | common ESBL k = 3 | common ESBL k = 4 | two-unit k = 3 | two-unit k = 4 |
|---|---|---|---|---|---|---|---|---|
| BOCPD counts and %R | 9.5 % (6 to 14), 3 d | 14.0 % (10 to 19), 3 d | 3.0 % (1 to 6), 5 d | 4.5 % (2 to 8), 4 d | 12.0 % (8 to 17), 2 d | 13.5 % (9 to 19), 3 d | 10.0 % (7 to 15), 4 d | 10.5 % (7 to 16), 4 d |
| BOCPD counts | 1.0 % (0 to 4), 3 d | 1.5 % (1 to 4), 4 d | 1.5 % (1 to 4), 2 d | 2.5 % (1 to 6), 4 d | 1.5 % (1 to 4), 7 d | 1.0 % (0 to 4), 1 d | 3.5 % (2 to 7), 2 d | 1.5 % (1 to 4), 4 d |
| BOCPD %R | 9.0 % (6 to 14), 3 d | 12.5 % (9 to 18), 3 d | 1.5 % (1 to 4), 20 d | 2.0 % (1 to 5), 0 d | 10.5 % (7 to 16), 2 d | 13.0 % (9 to 18), 3 d | 6.5 % (4 to 11), 6 d | 9.5 % (6 to 14), 4 d |
| live set, re-tuned | 86.0 % (81 to 90), 7 d | 98.0 % (95 to 99), 5 d | 1.0 % (0 to 4), 6 d | 0.0 % (0 to 2) | 70.0 % (63 to 76), 6 d | 88.0 % (83 to 92), 6 d | 47.5 % (41 to 54), 4 d | 56.5 % (50 to 63), 7 d |
| live set, shipped | 61.5 % (55 to 68), 7 d | 89.0 % (84 to 93), 6 d | 0.5 % (0 to 3), 25 d | 0.0 % (0 to 2) | 34.5 % (28 to 41), 8 d | 61.0 % (54 to 67), 7 d | 21.0 % (16 to 27), 3 d | 24.0 % (19 to 30), 3 d |

The k = 0 controls of the combined row are 1.5 % (rare), 7.5 % (common
resistant), 5.0 % (wild type), 4.0 % (common ESBL) and 7.5 % (two-unit), so
the common-resistant and wild-type cells at k = 4 (3.0 % and 4.5 %) are not
distinguishable from their controls: no typing, no detection, as expected.
The full table (k = 0, 2, 3, 4, 6, five families) and the per-block spread
are in `results.md`.

**D4, episodes a year by kind over 2024-10-01 to 2026-09-27** (computed; fixed
key, planted and quarantined zones left out; episode counts in brackets):

| row | all (95 % Poisson) | cluster | sentinel | divergence | data | alerts a week |
|---|---|---|---|---|---|---|
| BOCPD counts and %R | 6.5 (13; 3.5 to 11.2) | 1.5 (3) | 0.0 | 5.0 (10) | 0.0 | 0.125 |
| BOCPD counts | 1.5 (3; 0.3 to 4.4) | 1.5 (3) | 0.0 | 0.0 | 0.0 | 0.029 |
| BOCPD %R | 5.0 (10; 2.4 to 9.2) | 0.0 | 0.0 | 5.0 (10) | 0.0 | 0.096 |
| live set, re-tuned | 9.5 (19; 5.7 to 14.9) | 4.5 (9) | 1.5 (3) | 0.0 | 3.5 (7) | 0.183 |
| live set, shipped | 4.5 (9; 2.1 to 8.6) | 1.0 (2) | 1.5 (3) | 0.0 | 2.0 (4) | 0.087 |

**D1, D6, D7, I1** (computed; D1 is a demonstration, days from the start
date at the chosen level; D6 over 1,000 injected gaps; D7 the share of detected
events named right):

| row | E1 / E1 corrected | E2 | E3, E4 | D6 | D7, %R named divergence | D7, %R named cluster | I1 alerts, incidents, per incident |
|---|---|---|---|---|---|---|---|
| BOCPD counts and %R | none / none | 4 d | none | 1.2 % (1 to 2) | 17.1 % (14 to 21), n 398 | 99.7 % (99 to 100) | 14, 14, 1.00 |
| BOCPD counts | none / none | none | none | 0.7 % (0 to 1) | 100 % (95 to 100), n 68 | same | 3, 3, 1.00 |
| BOCPD %R | none / none | 4 d | none | 0.5 % (0 to 1) | 0.0 % (0 to 1), n 345 | 99.7 % (98 to 100) | 11, 11, 1.00 |
| live set, re-tuned | 0 d / 5 d | 0 d | 0 d, 2026-02-15 | 2.6 % (2 to 4) | 98.7 % (98 to 99), n 2,493 | n/a | 29, 26, 1.12 |
| live set, shipped | 0 d / 5 d | 0 d | 0 d, 2026-05-10 | 1.2 % (1 to 2) | 97.4 % (97 to 98), n 1,982 | n/a | 18, 15, 1.20 |

E1 is found by the combined row only at p < 0.6 and looser (delay 0 d from
2025-06-04, 5 d from the corrected onset 2025-05-30; at p < 0.5 and below it
is not found), by %R signals on *E. coli* (ceftriaxone, ciprofloxacin,
cefuroxime, ampicillin) from 2025-06-04 and by none of the count series (the
URO ESBL count series gives one signal, p = 0.89). E2 is found at 4 days at
p < 0.5 (2 days at p < 0.7 and looser), at the chosen level by %R signals on
*S. aureus* cefoxitin and clindamycin from 2026-03-05. E3 is a data signal and
E4 a trend, neither is this method's kind. A %R signal on
*E. coli* trimethoprim exists at the chosen level (2 signals, first
2024-12-21, in ED): reported, not claimed. D7's naming cost is the whole gap
between 17.1 % and 99.7 %: of 398 detected injected or planted events only 68
have a count signal, the rest are found by %R alone.

**Beyond the plan, exploratory** (nothing below enters `metrics.json`; every
row was scored on the scoring period, so none is a selection):

- *Looser levels.* Four levels in front of the plan's, p < 0.9, 0.8, 0.7,
  0.6, read from the same run. The rule would still choose H = 1/26, w = 2,
  p < 0.5 on the tuning year. On the scoring period the combined row reads
  rare / common ESBL at k = 4: p < 0.6, 22.5 % (17 to 29) / 25.0 % (20 to 31)
  at 4.0 cluster episodes a year and 10.0 on every episode; p < 0.7, 35.0 % /
  40.5 % at 15.1 a year on every episode; p < 0.8, 56.0 % / 66.0 % at 35.7;
  p < 0.9, 90.0 % / 93.5 % at 150.7 a year (computed). The %R part alone
  reaches 80.0 % / 87.5 % at p < 0.9 with 47.2 episodes a year (counts alone:
  62 % / 64 % at 128.6). 90 % of rare clusters is reached only where the whole
  tool raises about 150 episodes a year, 30 times the 5-a-year budget.
- *Every setting of the grid*, at the level its own tuning rule gives
  (`results.md`, three tables): rare k = 4 between 2.5 % and 16.5 %, common ESBL
  between 5.5 % and 13.5 % (combined row, 200 trials, intervals 5 to 10 points wide). The settings with
  w = 4 have D5 headlines of 24 to 49 % (rare) at cluster-and-sentinel noise
  of 0 to 4 a year, but their %R episodes are again outside that noise; on
  every episode the same curves read rare 24 to 43 % at 0.0 to 2.5 a year
  (H = 1/52 to 1/208) and 32 % at 3.0 a year (H = 1/26). So the setting the
  plan's rule chose on year 1 (w = 2, 14 %) is not the best row of this table,
  and no row comes near the live set; picking a row from the table would be
  tuning on the scoring period.
- *A broader new-segment prior.* The plan's count prior is an exponential with the
  unit's usual weekly rate as mean. Multiplying that mean by c, with the
  setting and level chosen again on the tuning year by the plan's rule: c = 4
  gives H = 1/208, w = 4, p < 0.3 and rare k = 4 at 18.0 % (13 to 24) for the
  combined row and 12.5 % (9 to 18) for counts alone (1.5 % at c = 1); c = 16
  gives H = 1/26, w = 4, p < 0.1 with 29.5 % (24 to 36) combined and 28.0 %
  (22 to 35) counts alone, at 2.5 and 2.0 episodes a year. Common ESBL:
  17.0 % and 23.5 % combined. The counts part moves from 1.5 % to 28.0 %, the
  live set stays far above at 92 %. c = 4 and 16 are arbitrary (proposed
  (overnight), pending Artem).

**Deviations from plan, and what was seen when.**

1. *Nothing was cut.* The plan's order of cuts was not needed (CPU 245 to
   330 s); the trial path, not the plan, is what kept it cheap (see 8).
2. *Looser levels, the whole-tool reading of D5, the ablation, the grid by
   part and `d5_curve.png` are additions*, not in the plan, flagged
   exploratory above. I added them after seeing the plan's row on the scoring
   period (the headline sat at the loosest level of the grid and %R
   episodes were outside D5's noise); the setting of every added row is
   chosen on the tuning year by the plan's rule, and the choice of c = 4, 16
   was mine. Before the grid was fixed I printed scoring-period episode counts
   for H = 1/52 in a smoke test of the filter; nothing was chosen from them.
3. *Card (`figure.png`).* The plan's "posterior means over short and long
   runs" are replaced in the header by the posterior mean rate since the
   modal change and over everything before it (1.7 and 0.3 a week, computed),
   because at w = 2 two weeks after the change the gate's short and long
   means (0.34 and 1.57) straddle it; the gate's means are in `results.md`.
   The modal change week is the mode over run lengths of 1 to 26 weeks
   (proposed (overnight), pending Artem): week 22 (26 May), 80 % interval
   14 April to 2 June (week indices 80 to 87), not the plan's illustrative
   week 23 and 0.97; m_t at 15 June is 0.04 at w = 2
   because the change is two weeks old. The chosen setting did not signal E1,
   so the card shows no filled first-signal marker, a hollow one at the
   loosest level (p < 0.9, 2025-06-04) and says so; the axis runs 2024-11-04
   to 2025-07-06 with the as-of date inside it.
4. *Definitions the plan left open* (proposed (overnight), pending Artem): a
   patient's isolate is an event when the patient has no earlier isolate of the
   series in the unit in the previous 365 days (the clock restarts at every
   isolate); a rate series counts the isolates with an S or R result for its
   pair, first per patient in the unit; "the last w weeks" for the 2-event gate
   is the current partial week and the previous w - 1 complete weeks; the
   data end is the later of the last record and the last culture, so that a cut
   at date t has the same signals up to t; the filter runs over the first 26
   weeks with the prior read from them and raises no signal there; the counts
   prior is Gamma(shape 1, rate 1/m), mean m (the plan's "strength 1 week" in
   "Hazard and prior on year 1" and its Gamma(1, 1 / m) disagree; the
   Gamma(1, 1 / m) of "Experiment" and the exponential of "Mathematical
   foundation" are implemented).
5. *D3 left out as planned*; D6 and D7 use the 1,000 gap trials, which run
   D3's cells, and D3's rates are not reported (no data signals, so zero by
   construction).
6. *`aei.score_detection` is used unchanged*; the three rows share the filter
   runs through a cache keyed on the rows of the trial, and the D7 variant
   with %R named cluster is a second `Detector` over the same signals.
7. *The plan's expectation that pruning changes no date* holds at the
   operating levels and not at the loosest level (see above).
8. *Trial path.* With a `Focus`, the filter states of the weeks before the
   trial are taken from the run on the whole dataset (the trials change nothing
   before their start; checked by a fingerprint of the rows and, on 8 trials,
   against the unfocused run). That is what makes the 5,000 trials, the
   1,000 gap trials, the tuning trials and the ablation cheap.

## Interpretation

**Against the hypothesis.** Every directional expectation of the plan that a
number can contradict was contradicted. At the plan's headline the combined
detector reaches 14.0 % (10 to 19) of rare clusters at k = 4, not 90 %, and
13.5 % (9 to 19) of common ESBL clusters, not 50 %; the %R detector alone
reaches 12.5 % (9 to 18), not 50 %; E1 is not found at the chosen level
(found only from p < 0.6, where the combined row raises 10 episodes a year
on every episode). The live set re-tuned on year 1 reaches 92.0 % and 75.0 %
at 3.0 cluster episodes a year with a median delay of 6 days, so on the
harness's bursts the gap to the live set is about 78 and 62 points, far
outside both intervals, and no reading of the noise (cluster and sentinel,
whole tool, looser levels) closes it: 90 % of rare clusters costs about 150
episodes a year. The expectations that held: common resistant and wild type
stay at their controls (3.0 % and 4.5 % against 7.5 % and 5.0 %), E2 is found
within March 2026 (4 days, by %R), and the naming matters as the plan said
(D7 17.1 % with %R named divergence, 99.7 % named cluster). The comparison
with 0015's windowed test could not be made (0015 is not closed).

**Against METRICS.md "Decision rules".** The overnight run proposes and does
not change the live set. On the D5 headline (rare and common ESBL at 5
episodes a year, with D2's median delay at k = 4) BOCPD as specified is far
below the live set in both rows and nothing here argues for replacing the
windowed tests with it. The shorter delay (3 days against 6) is a median over
28 detections of 200 against 184, the early and extreme ones, and is not
evidence of speed. D6 is low (1.2 % against 2.6 % and 1.2 %): the upward gate
keeps gap weeks quiet, though the live rows are as quiet, so it is no
advantage. I1 is 1.00 alert per incident because the alerts are few, not
because grouping works. This row is screening: nothing was selected, so
nothing was re-scored on seeds 2027 to 2030.

**Why, as far as the table shows** (derived arithmetic on the model, not a
further experiment). With a hazard of 1/26 the prior odds of a new segment
in a given week are 0.04. A week of 5 ESBL patients in URO (about 15 times its
rate of 0.33 a week) is 12 times more probable under the new-segment prior
than under the old rate (negative binomial 2.8e-4 against Poisson 2.3e-5), so
m_t after it is about 0.32; a week of 2 patients has a Bayes factor of 0.8; two
weeks of 2 patients, the usual shape of a burst of 4 in 14 days, about 2.1 and
odds of 0.09. Evidence of a few patients against a rate of a third of a patient
a week is simply what a Gamma-Poisson filter with an exponential prior can
count, and the filter is honest about it: m_t = 0.5 needs more than a
burst. A window test compares the 28 days with the year before in one step and
puts no prior odds on the date of the change.

**The strongest alternative explanation** is that this is a result about the
new-segment prior and the burst shape, not about change-point detection. The
exponential prior with the usual rate as its mean gives little mass to a
segment at 15 times that rate, and the harness injects k patients within 14
days, not a sustained shift; BOCPD is built for changes that last (E1, 5 to 6
patients a week for 5 weeks (measured), is exactly that, and was found only at
p < 0.6 and looser). The exploratory ablation points the same way and no
further than that: widening the prior mean by 16 takes the counts part from
1.5 % to 28.0 % (22 to 35) at 2.0 episodes a year, still 64 points below the
live set, and c = 16 is an arbitrary value chosen after the plan's row was
seen. Other things this table cannot separate: 315 series run independently
with no shared hazard or multiplicity, a weak look-elsewhere control; the
tuning noise rests on 2 to 4 episodes in half a year (one episode moves it 2 a
year) and 80 trials, so the choice between settings that differ by 1 of 40 is
not a choice, and year 1 is a noisier year for this filter (at p < 0.5 the
w = 4 settings raise 8 to 30 episodes a year on year 1 against 2.5 a year or
fewer on the scoring period for H = 1/52 to 1/208, derived from the two
tables), which is why the rule picked w = 2 and tight levels; D5's noise leaves %R episodes out, which flatters the %R and
combined rows by up to 5 episodes a year; and the grid is coarse near the
budget (the next level of the combined row is 10 a year on every episode).

**Next experiment.** (1) A drip family in the harness (one patient a week for
4 to 6 weeks, injected as a sustained shift), where BOCPD should part from
the windowed tests if the explanation above holds; the plan named it as the
follow-up. (2) BOCPD as an annotator, not a detector: for the signals the
windowed tests raise, score the accuracy of the modal change date and of m_t
against the injected onset, a metric the harness does not have yet, which is
what ENGINE.md 3.6's card needs. (3) A new-segment prior learned from the
series (a hierarchical Gamma with a shared shape, or a heavy-tailed rate) and
a hazard shared across series, chosen on the tuning year; the ablation here
is only a pointer. (4) If any variant is selected on the screening seed,
re-score it on seeds 2027 to 2030 before it is named best; nothing is
selected here.
