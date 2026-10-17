---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem (overnight run)
data: [synthetic_microbiology_dataset, seed 2026, as received 2026-10-09]
parent: 0001
---

# 0019 Does exposure on the patient-flow graph rank the units where a phenotype appears next, on more than one event and without circularity?

## Goal

OBJECTIVES.md objective 2 asks, inside the hospital, whether the
shared-patient graph's exposure score orders the units at risk after an
event, the claim held to "a useful ordering", never a forecast.
METRICS.md P1 scores it as an AUC against 1,000 degree-preserving
rewirings, after E1 and after every injected two-unit cluster. The
harness's baseline row (`baselines/exposure-e1.json`) shows the first
half cannot be scored: after E1 no unit but URO exceeded its own
26-week baseline at α 0.05 (URO 29 patients against 1.7 expected; the
nearest other unit PHC-S, 6 against 3.5, p 0.15; computed), so there is
no positive to rank and the AUC is undefined. The second half has a
trap: `aei.inject.two_unit_hits` draws the partner B from A's
patient-flow neighbours weighted by the patients moved between them, so
exposure from A ranks B high by construction, and an AUC over those
trials measures the injection's draw, not the data. This experiment
designs P1 so it rests on more than one event and says, per version,
what it can and cannot show; its row holds the P1 keys of
harness-spec.md and everything else sits in separate fields. Artem
decides from the table whether "units at risk next" can appear on the
researcher's network view with a measured basis, or only as a
description of the graph.

## Hypothesis

This experiment is exploratory in PROTOCOL.md's sense: it describes how
exposure ranks units against the rewiring null on the real phenotype
episodes of the scoring period and on two injected controls, and
supports no claim beyond its table. The yardstick is METRICS.md P1: AUC
against chance 0.5 and against the rewiring distribution, one-sided at
0.05, pooled over events; one event is a description, not a claim.

Described: per real episode (ESBL *E. coli* and MRSA sources, E1 and
E2 among them) the exposure share and raw exposure of the other eight
units, their outcome at α 0.05 and 0.001, the AUC where defined and the
rank correlation with the continuous excess; the pooled AUC with its
rewiring p; E1 and E2 alone; the two injected controls.

Directional expectation, stated so the table can contradict it: the
pooled AUC over real episodes lies in 0.40 to 0.60 with rewiring p
above 0.05, because nothing in the dataset's README says the generator
moves phenotypes along patient flows (0011's review read the background
as drawn independently per unit and day), and D-022 found 4 of 320
carrier moves re-found in the receiving unit (computed, D-022). The
flow-partner control gives a pooled AUC near 0.63 on raw exposure and
0.57 on share (computed here under the injection's draw, averaged over
the nine sources, with the partner the only positive; the graph is
flat), a check of the pipeline and not evidence. The uniform-partner
control gives 0.5 ± 0.1 with p uniform. If the pooled real-episode AUC
exceeds 0.65 with p below 0.05, the data carry flow structure the
README does not mention; that is then the finding, reported with the
planted events removed to see whether it survives.

## Experiment

**Data.** `synthetic_microbiology_dataset` through `aei.harness.data()`:
all cultures, negative ones too (D-011), for the graph; isolate records
with phenotypes for sources and outcomes.

**Graph and exposure** as the harness defines them
(`aei.score_prediction.flow_matrix`, `exposure`; harness-spec.md P1):
over the 365 days before an onset, w(A→B) is the sum over patients with
a culture in A followed by one in B within 30 days of 1 / (units the
patient was sampled in): directed, time-ordered, nothing dated at or
after onset. Exposure of B from source S: share w(S→B) / Σ_A w(A→B), and
raw w(S→B). Both ranked.

**Outcome** as the harness defines it (`unit_outcome`): per unit other
than the source, distinct patients with the phenotype in the 8 weeks
from onset against the unit's 26 weeks before, Poisson upper tail with
mean (baseline + 0.5) × 56 / 182, positive at α 0.05 and 0.001. A second
outcome, proposed (overnight), pending Artem: the same with patients
already found with the phenotype in any unit before onset left out
(`flt` as a record predicate over the carriers known at onset), so a
known carrier sampled again in B is not B's "new appearance". Both
reported; the spec keys use the harness's.

**Version A, the test: real phenotype episodes as sources.** For ESBL
*E. coli* and for MRSA, per unit, weekly: distinct patients in the 4
weeks ending the week against the preceding 26, the same Poisson rule
as the outcome, p < 0.05 and at least 2 patients; weeks within 28 days
merge into one episode; the onset is the Sunday the rule first fires,
when the tool would have raised the alert (ENGINE.md 4, active_A).
Episodes with onset in SCORE and 56 days of data after it are the
events; a rough count over the whole data gives 21 ESBL and 7 MRSA
episodes at 0.05 (computed here; the run measures the number inside
SCORE, expected 12 to 20). Per event `score_exposure(cultures,
records, source, onset, flt)` at 1,000 permutations, seed 2026. Pooled:
U = Σ_e U_e / Σ_e n_pos,e · n_neg,e over events with at least one
positive and one negative unit, the Mann-Whitney statistic over
within-event pairs, so shares are never compared across sources; the
null pools replicate j of every event (the same seed per event, so
replicate j is the j-th rewiring of each graph), p = (1 + #{null ≥
U}) / 1,001. The same for raw exposure, both alphas, both outcomes,
ESBL and MRSA apart, and with E1 and E2 removed. The harness's
`excess_corr` (rank correlation with (observed + 0.5) / expected) is
averaged over events with its permutation null, because positives are
rare and the AUC may be undefined on most events.

**Version B, two controls with injected two-unit clusters.** Rare
clones split over two units, ceil(k/2) patients in A and floor(k/2) in
B within 14 days of a start, k ∈ {4, 6}, 200 trials per cell from one
`mulberry32(2026)` stream, clone and start drawn as
`aei.inject.rare_hits` draws them, planted events avoided
(`draw_start`). (B1) flow partner: B drawn as `two_unit_hits` draws it,
weighted by the patients moved between A and B in the 365 days before
the start. (B2) uniform partner: B uniform over the eight other units.
Per trial the outcome is computed on the injected records (the
experiment copies the clone as new patients by the harness's rule,
because a trial passes a detector 28 days of data and the outcome needs
56; noted under "Deviations from plan" if a harness hook makes the copy
unnecessary), exposure from A over the 365 days before the start, AUC
over the eight non-source units at α 0.05, 200 permutations per trial.
Reported per control: pooled AUC, the share of trials with rewiring
p < 0.05, the share where B is a positive at all, B's mean rank by
share and by raw.

What each shows. B1 is a positive control: exposure must rank B high
because B was drawn by the flows exposure reads, so a pipeline failing
it is broken and one passing it has shown nothing about the data. B2
is a negative control: B is independent of flow, the true AUC is 0.5,
and the share of trials with p < 0.05 should be about 5 %; it checks
that the rewiring null is calibrated and says nothing about flow
either. No injection can test whether flows predict spread: one that
places outcomes by flow is circular, one that does not is
uninformative. Only version A, or real data, can.

**E1 and E2.** `score_exposure` with `EVENTS["E1"]` (URO, 2025-05-30)
and `EVENTS["E2"]` (ICU, 2026-03-03), as descriptions: E1 reproduces
the baseline row (AUC undefined); E2 is new.

**Seeds.** Screening on seed 2026 only; seeds 2027 to 2030 are held out
and not used here. Spread: the null's 2.5th and 97.5th percentiles
around each AUC, and per-event rows.

**Baselines.** `baselines/exposure-e1.json`; chance 0.5 and the
rewiring distribution (METRICS.md P1); B2 as the null's calibration.

**Budget.** 10 minutes of CPU for `run.py` (`aei.harness.Clock`),
informational. The E1 baseline took 0.3 s of CPU with 1,000
permutations (computed, baseline file), so version A is about 20 × 1 s
and the controls 800 trials × 200 permutations, about 800 × 0.3 s.
Cuts in order, under "Deviations from plan": (1) control permutations
200 → 100; (2) control trials 200 → 100 per cell; (3) k = 4 dropped
from the controls; (4) version A permutations 1,000 → 500.

**Command and outputs.**

    uv run python experiments/0019-exposure-ranking/run.py

writes `out/results.md` (event list with onsets, per-event tables, the
pooled table over exposures, alphas and outcomes, E1 and E2, the two
controls), `out/metrics.json` through `aei.harness.write_metrics`,
family "prediction", `tuned_on` "none (no fitted parameters)",
`tuned_on_test` false, `metrics.P1` exactly the spec keys for the pooled
version-A test (harness outcome; `positives_*` summed over events;
`n.P1` with events, units ranked, positives, replicates), and at top
level `P1_events` (per event), `P1_variants` (new-finds outcome, per
phenotype, without E1 and E2, excess correlation), `P1_planted` (E1,
E2), `P1_controls` (B1, B2); `out/figure.png` (the sketch below, under
1 MB, `metadata={"Software": None}`). numpy, pandas, scipy only; the
copy helper and the episode finder stay in the experiment directory.

**Choices proposed (overnight), pending Artem:** the source-episode
rule (4 weeks against 26, p < 0.05, 2 patients, 28-day merge, onset =
first signal Sunday); pooling by within-event Mann-Whitney pairs; the
new-finds outcome; 200 permutations per control trial.

## Mathematical foundation

**Graph.** For patient j with cultures at (unit, date) inside the
window, let V_j be the units visited and L_j the ordered pairs (A, B),
A ≠ B, with a culture in A followed within 30 days by one in B. Then
w(A→B) = Σ_j 1[(A, B) ∈ L_j] / |V_j|: a patient contributes at most 1
per ordered pair, so a frequently sampled patient does not dominate
(ENGINE.md 4, D-011). Share x_B = w(S→B) / Σ_A w(A→B) is the fraction of
B's inflow from S (ENGINE.md 4 with active_S = 1); raw is w(S→B). The
graph for E1 is flat: shares from URO run from 0.069 (MED-A) to 0.140
(PHC-S), raw from 3.0 (ICU) to 15.8 (ED) (computed, baseline file);
47.5 % of the 6,364 patients sampled in that year were sampled in more
than one unit, and none in both health centres (measured here). A
ranking of eight units by numbers this close turns on small differences.

**AUC.** For one event with n_pos positives and n_neg negatives among
the eight, AUC = U / (n_pos · n_neg), U the number of (positive,
negative) pairs where the positive scores higher, ties half
(Mann-Whitney; Hanley and McNeil 1982). With one positive, AUC takes
the values 0, 1/7, …, 1: the rank of one unit, which is why one event
describes and does not claim. The pooled Σ_e U_e / Σ_e n_pos,e n_neg,e
is the probability that a positive outranks a negative of the same
event, uniformly over such pairs across events; it never compares
scores across sources.

**Null.** Permuting unit labels over the window's culture rows draws
uniformly among bipartite patient–unit multigraphs with the same
patient degrees and unit volumes and keeps every date, so the 30-day
ordered links are rebuilt per replicate (harness-spec.md Choices 7).
Outcomes are not permuted: the null is "a graph with these volumes and
no further structure" against the real outcomes; p = (1 + #{null ≥
U}) / (n + 1) (Phipson and Smyth 2010). Pooling replicate j across
events gives the null of the pooled statistic under independent
rewiring of every event's graph, the outcomes' dependence kept.

**Power.** With n_pos positives among about 160 unit-events, the
Hanley-McNeil standard error of a pooled AUC at 0.5 is about 0.095 for
n_pos = 10 and 0.13 for n_pos = 5, so the one-sided 5 % test rejects
from about 0.66 and 0.72 (derived; the permutation null is the one
used, this is the order of magnitude). The outcome is itself a noisy
detector: at α 0.05 about 8 of 160 unit-events are positive by chance
(derived), comparable to the true appearances one could hope for; if
half the positives are chance, a perfect ranking scores about 0.75
(derived, ½ · 1 + ½ · ½). α 0.001 removes the chance positives and most
real ones.

**The circularity of B1, quantified.** B is drawn in proportion to the
either-way moves between A and B over the same year exposure reads, so
E[AUC] with B the only positive is Σ_B P(draw B) · (units ranked below
B) / 7: 0.64 on raw and 0.56 on share for URO at E1, 0.59 and 0.55 for
the ICU at E2, 0.63 and 0.57 averaged over the nine sources at
2025-09-01 (computed here from `aei.relations.patient_flows` and the
harness's exposure). Even the circular test sits close to chance,
because flows are spread over all eight units; chance positives
elsewhere and a B that fails to exceed its baseline pull it lower.

**Where it breaks.** A hospital-wide rise (a season, a breakpoint
change) makes several units positive with no flow behind it; exposure
then ranks at chance, correctly. Two source episodes overlapping in
time: each event reads its own source only, so an outcome caused by the
other counts against it; a multi-source exposure summed over active
sources is the follow-up. The graph ends at onset; flows during the 8
weeks after, which carry the actual spread, are not read, by the
harness's definition. Known carriers sampled again in B are B's
positives in the harness outcome; the new-finds outcome is the stricter
reading.

**References.** Hanley and McNeil (1982, Radiology); Mann and Whitney
(1947); Phipson and Smyth (2010, Stat. Appl. Genet. Mol. Biol.) for the
permutation p; Newman (2010, Networks, ch. 13) on degree-preserving
nulls; ENGINE.md 4.

## Why this method here

- D-009 and D-011 built the relation layers because the team wants
  findings in one unit to inform treatment in another, and the
  researcher's network view is meant to show "units at risk next".
  Nothing has measured whether the graph predicts anything; the E1
  baseline row says the one planned test has no positive to rank.
  Before the view claims risk it needs a number, and one event is not
  one.
- The night's D2 `two_unit` family draws partners by flow. Its rates
  will sit on the leaderboard next to P1, and a reader could take
  "exposure ranks the partner" as support for the flow model; this
  record blocks that reading in writing, with the circular AUC shown,
  quantified and labelled a positive control.
- D-022 measured 320 carrier moves and 4 re-found: the patient-carried
  path is thin here, so the honest prior is no effect. A null result is
  a result: the demo must then call the network view "patients
  shared", not "risk", and this is the test to rerun on real data,
  where the graph is the mechanism.
- For the researcher: after an alert in S, the other units by share
  with the count behind it and the rewiring band, so a share inside its
  band reads "no more than the volumes predict". For the doctor: B7's
  annotation rests on this ordering.

## Proposed visualisation

The hospital network view (OBJECTIVES.md "Visualisation choices"),
light mode, drawn for E1 as of 2025-06-15: a horizontal bar list, not a
node-link drawing, because eight bars read in five seconds and a
nine-node graph does not.

- Header: "ESBL · Urologia / Urology — mistä potilaat ovat tulleet /
  where patients came from, 12 kk / months".
- Eight rows, one per other unit, ordered by share from URO: a bar for
  the share (axis 0 to 0.2), the raw count as text at its end ("14
  potilasta / patients"), and a thin grey band behind the bar from the
  2.5th to the 97.5th percentile of the share under the 1,000
  rewirings, so a bar inside its band is visibly no more than the
  unit's volume predicts. At the row's right edge, for the
  retrospective view, the 8-week outcome as observed against expected
  ("6 / 3.5"), filled when positive.
- Footer: "osuus yksikön potilasvirrasta / share of the unit's inflow ·
  vertailu: 1 000 satunnaistettua verkkoa / 1,000 rewired graphs".
- Encodings: length for share, text for count, band for the null, fill
  for outcome; colour carries nothing. Labels bilingual, Finnish first,
  from `wards.csv`.

`out/figure.png` draws it for E1 from the baseline row's numbers and
the run's rewiring bands.

## Result

Command, from the repository root: `uv run python
experiments/0019-exposure-ranking/run.py`. Outputs in `out/`: `results.md`
(every table, per event and per unit), `metrics.json` (family `prediction`,
`metrics.P1` the pooled version-A test, then `P1_events`, `P1_variants`,
`P1_planted`, `P1_controls`), `figure.png` (the sketch, 94 KiB).
`uv run python scripts/verify_experiments.py --only 0019` says
"reproduces". CPU time 86.8 s, wall 87.5 s (measured, `harness.Clock`; the
plan's estimate was about 260 s). Nothing was cut: version A at 1,000
permutations, the controls at 200 trials per cell, k in {4, 6}, 200
permutations per trial. Seeds: rewirings seed 2026 for every event and
trial; injections one `mulberry32(2026)` stream (held-out seeds not used);
the bootstraps are 1,000 resamples, seed 2026. `tuned_on_test` false: the
episode rule and every setting are the plan's, none was changed after a
number was seen. Every number is computed by this run (tag: computed)
unless marked measured (a count read from the data), derived (arithmetic on
computed numbers) or assumed. "Usable events" are those with at least one
positive and one negative unit.

**Version A: the episodes (measured).** The plan's rule finds 31 episodes
in the whole data from the first Sunday with a 26-week baseline (24 ESBL
*E. coli*, 7 MRSA; the plan's rough count was 21 and 7). In the scoring
period with 56 days of data after the onset there are **24 events**: 18
ESBL *E. coli* and 6 MRSA, against the 12 to 20 the plan expected. E1 is
event 9 (URO, onset 2025-06-08, the first Sunday the rule fires; the
harness's E1 onset is 2025-05-30) and E2 is event 21 (ICU, 2026-03-08).
The rule is causal: on data cut at 2025-03-01, 2025-09-01 and 2026-03-01 its
onsets equal those of all the data up to the cut (asserted in `run.py`).

**Pooled P1, harness outcome** (Poisson upper tail against the unit's
26-week baseline; the null is 1,000 rewirings of every event's graph,
replicate j pooled over events; the interval is a bootstrap over the usable
events, an addition):

| exposure, alpha | usable events | positives | pairs | pooled AUC (95 % bootstrap) | null mean [2.5, 97.5] | rewiring p |
|---|---|---|---|---|---|---|
| share, 0.05 | 7 of 24 | 11 | 67 | **0.627** (0.52 to 0.72) | 0.544 [0.358, 0.731] | **0.218** |
| raw, 0.05 | 7 of 24 | 11 | 67 | **0.657** (0.45 to 0.81) | 0.602 [0.522, 0.687] | **0.143** |
| share, 0.001 | 5 of 24 | 5 | 35 | 0.457 (0.31 to 0.60) | 0.413 [0.143, 0.686] | 0.410 |
| raw, 0.001 | 5 of 24 | 5 | 35 | 0.457 (0.26 to 0.63) | 0.365 [0.229, 0.486] | 0.120 |

Baseline rows (`baselines/exposure-e1.json` for one event, chance and the
null): chance is 0.5; the rewiring null's mean is 0.544 and 0.602 for share
and raw at 0.05, not 0.5, because the rewired exposures follow unit volume
and so do the positives. Neither pooled AUC is above its null at 0.05.

The 17 events without a usable ranking have no positive unit at 0.05. The
seven that do (positive units at 0.05, all derived from `results.md`):

| # | source, phenotype, onset | positives at 0.05 | AUC share / raw |
|---|---|---|---|
| 3 | ED, ESBL, 2025-03-23 | MED-B | 0.714 / 0.286 |
| 5 | MED-A, ESBL, 2025-05-04 | ED, **URO**, PHC-S | 0.533 / 0.733 |
| 6 | ED, ESBL, 2025-05-18 | **URO**, PHC-S | 0.667 / 0.833 |
| 7 | MED-B, ESBL, 2025-05-18 | **URO**, PHC-S | 0.750 / 0.667 |
| 8 | PHC-S, ESBL, 2025-06-08 | **URO** | 0.714 / 0.714 |
| 15 | MED-A, ESBL, 2025-12-14 | ED | 0.714 / 1.000 |
| 20 | SURG, MRSA, 2026-02-22 | **ICU** | 0.286 / 0.143 |

No per-event rewiring p is below 0.05 (smallest 0.198, event 8 raw). The
bold units are the planted E1 and E2 outbreaks seen through other
sources' 8-week windows (URO had 21 to 28 ESBL *E. coli* patients in those
windows, ICU 13 MRSA patients): **5 of the 11 positives at 0.05 and all 5
at 0.001 are planted units.**

**Variants** (pooled AUC, rewiring p; share / raw, alpha 0.05 unless
named):

| variant | usable events, positives, pairs | share | raw |
|---|---|---|---|
| ESBL *E. coli* sources only | 6, 10, 60 | 0.667 (0.59 to 0.73), p 0.191 | 0.717 (0.57 to 0.85), p 0.197 |
| MRSA sources only | 1, 1, 7 | 0.286, p 0.538 | 0.143, p 0.235 |
| without E1 and E2 as sources | 7, 11, 67 | 0.627, p 0.218 | 0.657, p 0.143 (the same as all: neither has a positive) |
| new-finds outcome (known carriers left out after the onset) | 7, 11, 67 | 0.627, p 0.218 | 0.657, p 0.143 (the same: no positive changes; 15 of 192 unit counts fall) |
| without E1, E2 **and their units' cells** (added) | 5, 6, 35 | 0.714 (0.64 to 0.81), null 0.637 [0.400, 0.857], p 0.283 | 0.771 (0.51 to 0.97), null 0.759 [0.657, 0.857], p 0.519 |
| the same, alpha 0.001 | 0 usable events | none | none |
| ESBL, alpha 0.001 | 4, 4, 28 | 0.500, p 0.346 | 0.536, p 0.186 |

"Their units' cells": for an event whose baseline or outcome window (onset
minus 182 days to onset plus 55) touches a planted zone of the same
phenotype, URO (E1, ESBL *E. coli*) or ICU (E2, MRSA) is left out of that
event's ranking, 14 cells in all; the other 162 cells hold 6 positives
(3.7 %, derived) against the nominal 5 %.

**Rank correlation with the continuous excess**, mean over the 24 events,
with its rewiring null: share −0.003 (null [−0.185, 0.080], p 0.204); raw
**0.001 (null [−0.144, −0.030], p 0.002)**. By phenotype: ESBL share 0.026
(p 0.158), raw 0.004 (p 0.001); MRSA share −0.092 (p 0.579), raw −0.009
(p 0.165); without E1 and E2 share −0.020 (p 0.322), raw 0.020 (p 0.003).
The raw p-values are small because the null's centre is below zero, not
because the correlation is high. Mean Spearman correlation with the unit's
number of culture rows in the window (the quantity the null keeps): the
continuous excess −0.092, real raw exposure 0.748, rewired raw exposure
0.895, real share 0.387, rewired share 0.379.

**E1 and E2 alone (descriptions, not claims).** E1 (URO, 2025-05-30)
reproduces `baselines/exposure-e1.json`: no unit but URO above its baseline
at 0.05 or 0.001, the AUC undefined (a dash, not zero); excess correlation
share 0.619 (p 0.052), raw 0.048 (p 0.560), as the baseline row. E2 (ICU,
MRSA, 2026-03-03) is new: no unit above its baseline at either alpha (SURG
2 patients against 1.08 expected, p 0.293, the nearest), the AUC undefined;
excess correlation share −0.165 (p 0.492), raw −0.292 (p 0.228). The
new-finds outcome has no positive either. The two planted events give no
ranking to score.

**Controls (version B), 400 trials each, labelled as controls.** B1 draws B
by the flows exposure reads (a positive control: a pipeline that fails it
is broken, one that passes shows nothing about the data); B2 draws B
uniformly (a negative control: the true AUC is 0.5). "B alone" is
(8 − mean rank of B) / 7, the AUC if B were the only positive, from the
rank of B by exposure, derived. 223 of 400 B1 trials and 229 of 400 B2
trials have a defined AUC (77 % to 78 % of those have exactly one positive).

| control, cell | pooled AUC share (95 % bootstrap; rewiring p) | pooled AUC raw | B alone share / raw | B mean rank share / raw (chance 4.5) | B positive | p < 0.05 share / raw, of trials with AUC |
|---|---|---|---|---|---|---|
| B1 flow partner, k = 4 | 0.487 (0.43 to 0.54; 0.990) | 0.557 (0.51 to 0.61; 1.000) | 0.581 / 0.636 | 3.94 / 3.55 | 0.350 | 0.009 / 0.057 |
| B1, k = 6 | 0.535 (0.48 to 0.58; 0.488) | 0.611 (0.56 to 0.66; 0.010) | 0.567 / 0.650 | 4.03 / 3.45 | 0.435 | 0.000 / 0.077 |
| **B1, both k** | **0.511** (0.47 to 0.55; 0.900) | **0.584** (0.55 to 0.62; 0.642) | 0.574 / 0.643 | 3.98 / 3.50 | 0.393 | 0.004 / 0.067 |
| B2 uniform partner, k = 4 | 0.432 (0.38 to 0.49; 1.000) | 0.494 (0.44 to 0.56; 0.970) | 0.489 / 0.504 | 4.58 / 4.47 | 0.300 | 0.000 / 0.061 |
| B2, k = 6 | 0.473 (0.43 to 0.52; 0.876) | 0.492 (0.44 to 0.54; 0.766) | 0.514 / 0.512 | 4.41 / 4.42 | 0.540 | 0.000 / 0.038 |
| **B2, both k** | **0.455** (0.41 to 0.49; 0.995) | **0.493** (0.45 to 0.53; 0.955) | 0.501 / 0.508 | 4.49 / 4.44 | 0.420 | 0.000 / 0.048 |

The pooled nulls (means, bands) are 0.534 [0.498, 0.563] (share) and 0.586
[0.570, 0.601] (raw) for B1 and 0.504 [0.466, 0.540] and 0.507 [0.492,
0.523] for B2. With the 125 (B1) and 109 (B2) trials whose baseline or
outcome window holds days of a planted event of the clone's own organism
and flag in a unit other than A, and the 6 and 11 trials whose 56-day
window runs past the end of the data, left out (269 and 284 trials left):
B1 share 0.532 (null 0.538), raw 0.590 (null 0.584); B2 share 0.443 (null
0.495), raw 0.462 (null 0.484); B alone within 0.011 of its
all-trials value (B1 0.575 / 0.637, B2 0.490 / 0.501; `results.md`, last
rows of the controls table).

**Figure.** `out/figure.png` draws E1 as the plan describes: eight bars
ordered by share from URO (PHC-S 0.140 at the top, MED-A 0.069 at the
bottom), raw count as text, the 2.5th to 97.5th percentile band of the
share under the 1,000 rewirings, and the observed over expected count at the
right edge with an open marker for every unit (no unit above its
baseline).

**Deviations from plan.**

1. The event count is 24, not the plan's 12 to 20, and 31 over the whole
   data, not 28. The rule is the plan's; I did not investigate the
   difference from the plan's rough count (the first Sunday used here is
   the first with 30 weeks of data behind it, 4 plus 26, and "weeks within 28 days
   merge" is read as a gap of at most 28 days between firing Sundays).
2. The new-finds outcome is a record predicate that passes every record
   dated before the onset and, from the onset on, only records whose patient
   was not already found with the phenotype. The plan's wording ("patients
   already found before onset left out") applied to every record would
   empty the 26-week baseline, since every baseline patient is a known
   carrier; the harness's `unit_outcome` applies one predicate to both
   windows.
3. The outcome phenotype of an injected clone is its own organism and flag
   (ESBL *E. coli*, ESBL *K. pneumoniae* or MRSA, as `E1_FILTER` and
   `E2_FILTER` are); the plan does not say. The outcome is computed on the
   real records of the 26 weeks before and 8 weeks from the start plus the
   injected patients, copied by `aei.inject`'s rule (a new patient and
   culture id, the sample day within 14 days of the start, sex and
   admission date as `inject_cluster`). The injected patients have one
   culture each and lie after the graph window, so they change no flow.
4. B2 applies B1's exclusion: a unit with a planted event within 45 days of
   the start is not a candidate for B, so B2 draws uniformly over the other
   units that remain (eight, or seven in a few trials). The cells run in
   the order B1 k = 4, B1 k = 6, B2 k = 4, B2 k = 6 from one stream.
5. The B1 and B2 draws are written in `controls.py` from `aei.inject`'s
   existing helpers (`clones`, `draw_start`, `CLUSTER_AVOID`) and
   `aei.relations`, not taken from the new generic trials. I checked by
   hand, outside `run.py`, that the first 30 B1 trials equal
   `aei.inject.two_unit_hits(None, ...)`'s draws (unit, partner, start,
   onset); `run.py` does not depend on that function.
6. The figure shows E1 at the harness's onset 2025-05-30 (the baseline row's
   numbers), not "as of 2025-06-15" which the plan's header names for the
   view; the figure says "as of 2025-05-30". Labels are bilingual from
   `wards.csv`.
7. The excess-correlation null, the figure's bands and the p formula use
   the harness's private helpers (`_setup`, `_null_exposures`, `_p_upper`,
   `_predicate`), because `score_exposure` returns only the correlation's
   p-value; `run.py` asserts that its recomputed p-values equal
   `score_exposure`'s to 1e-12 for every event.
8. Added, not in the plan: the bootstrap intervals over events (version A)
   and trials (version B); the variant "without E1, E2 and their units'
   cells"; the contamination and end-of-data flags and the trial subset
   without them; B alone (from the rank of B); the pooled null mean and band
   beside each pooled AUC; the volume diagnostic; the causality check of the
   episode rule. These and the other proposed choices (episode rule,
   pooling by within-event Mann-Whitney pairs, new-finds outcome, 200
   permutations per trial) are **proposed (overnight), pending Artem**; none
   is a DECISIONS.md entry.
9. 17 B trials (B1 6, B2 11) have a 56-day window past the end of the data
   (starts after 2026-08-03; the plan's `draw_start` runs to 2026-08-15).
   They stay in the primary rows, as planned, and are left out in the
   subset above.

## Interpretation

**Against the hypothesis.** Exploratory, supports no claim. The plan
expected a pooled AUC in 0.40 to 0.60 with rewiring p above 0.05: the p
part held (0.218 share, 0.143 raw); the point estimates (0.627, 0.657) sit
just above the range, with intervals (0.52 to 0.72, 0.45 to 0.81) that
overlap it, and the rewiring null itself is centred at 0.544 and 0.602, so
0.5 is not the zero of this test. The plan's trigger for "the data carry
flow structure" (pooled AUC above 0.65 with p below 0.05) was not met:
raw reached 0.657 with p 0.143. Against METRICS.md P1 ("AUC against the
rewiring distribution, pooled over events; one event describes, not
claims") the result is: not distinguishable from rewired graphs at 0.05 on
7 usable events and 11 positives, and not at 0.001 on 5 and 5. P1 is not
one of the headline numbers of the decision rules. For Artem's question the
table gives no measured basis for "units at risk next" on the researcher's
network view; what it supports is the plan's fallback, a view that says
"patients shared" and shows the share with its count and its rewiring band.
Nothing is decided here.

**What the real-episode pool can and cannot show.** It can show that after
24 episodes the other units rarely exceed their own baselines: 6 of 162
unrelated cells (3.7 %, derived) against 5 % nominal, so there is no excess
of "next" appearances to rank in the first place. It cannot show absence of
flow-driven spread. It has 6 positives at 0.05 outside the planted
outbreaks, in 5 events, and none at 0.001; the plan's own power figure puts
the one-sided 5 % test at about 0.66 to 0.72 for 5 to 10 positives
(derived), and the bootstrap half-widths here are 0.10 to 0.18. With the
planted cells removed the pooled AUC is 0.714 and 0.771, but the null's own
means are 0.637 and 0.759 and the p-values 0.283 and 0.519: the numbers
look high and mean nothing against a null that keeps volume. The pool is also thin by design
of the outcome: 17 of 24 events have no positive unit, so the ranking was
scored on 7. The MRSA part is one event.

**The controls.** B1 passes the check it can pass: B alone has AUC 0.574 on
share and 0.643 on raw, close to the 0.57 and 0.63 the plan computed under
the draw averaged over the nine sources, so the exposure computation ranks
the drawn partner high as it must. It does not pass
against the rewiring null: the pooled outcome AUC of 0.511 (share) and
0.584 (raw) lies at the null's mean (0.534, 0.586; p 0.900, 0.642), only k
= 6 raw clears it (0.611, p 0.010). Because the flows B1 draws from are
mostly volume (real raw exposure correlates with volume at 0.75) and the
rewiring null keeps volume, the circular control has almost no excess over
the null. That is a statement about the test's power: a spread proportional
to the graph's flows would score barely above the null at this sample size,
so a null result for real episodes is weak evidence against such spread.
B2 has B alone at chance (0.501 share, 0.508 raw; mean ranks 4.49 and
4.44) and pooled AUCs of 0.455 and 0.493, inside 0.5 plus or minus 0.1 as
expected. It does not confirm the 5 % calibration: the share of trials with
p below 0.05 is 0.000 on share and 0.048 on raw, because with a single
positive (77 % of trials with an AUC) the AUC takes eight values and under
an exchangeable null the smallest p-value is about 1/8 (derived; the
rewiring null is tilted by volume, so this is an order of magnitude). No
inflation of false positives is seen, but the test is conservative on
share. The pooled B2 share AUC (0.455) is below its null's lower
edge (0.466), while B alone is at chance: the shortfall comes from the
real background positives in those trials (61 of the 229 trials with an
AUC, 27 %, have no B positive: 229 defined trials less 168 B-positive
trials, derived), not from the injection, and it persists with the
planted-event trials left out (0.443 against 0.495). I do not know why real
chance positives rank below the null on share; it is flagged, not
explained.

**Strongest alternative explanation, and what looked odd.** (1) The
planted events. All 5 positives at 0.001 and 5 of 11 at 0.05 are the
planted URO and ICU outbreaks seen through other episodes' windows
(events 5 to 8 and 20), so without the plan's removal of E1 and E2 as
sources the pool is mostly the generator's own planted events; the added
variant removes them and nothing survives against the null. This is a
property of the synthetic data, not of the method. (2) Volume. Exposure
and the outcome both follow unit size: the rewired and real raw exposures
correlate with volume at 0.895 and 0.748, and a smoothed excess falls with
volume (−0.092). The raw excess correlation's p of 0.002 with a mean of
0.001 is therefore not a finding: a score uncorrelated with the excess
would also average about 0 (derived expectation, not run), and the null
sits at −0.09 because rewired exposure is more volume-bound than the real
one; I read it as "the real graph is less volume-bound than a rewired one",
not as "exposure orders the excess". A reference the plan does not have is
a volume-only ranking scored the same way; it would say how much of any
AUC here is volume. (3) Overlapping episodes: the ESBL episodes in ED,
MED-A, MED-B and PHC-S of May to July 2025 sit around E1, and each event
reads its own source only. (4) The graph ends at onset and the outcome is
a unit-level count, so patient-carried spread inside the 8 weeks is not
read; D-022 found 4 of 320 carrier moves re-found, and 0011's review read
the background as drawn independently per unit and day, in which case
there is nothing to find. The result is what that world predicts and does
not show the method works on a world that has spread.

**Next.** (a) The same pool scored against a volume-only ranking and
against exposure summed over all active sources (the plan's follow-up),
cheap on this graph. (b) The patient-level route the plan names: carrier
trails (`aei.relations.phenotype_trails`) with the 4 of 320 re-found moves
as the unit of analysis instead of unit-level exposure. (c) Rerun on real
hospital data, where the graph is the mechanism and the generator's
independence does not apply; this record's `run.py` takes the data through
`aei.harness.data()`. (d) For the demo: call the network view "patients
shared", with the count and the rewiring band, and do not hang B7's
annotation on this ordering; the plan's wording already says so.
