---
status: proposed    # proposed, then accepted, rejected or superseded
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

## Interpretation
