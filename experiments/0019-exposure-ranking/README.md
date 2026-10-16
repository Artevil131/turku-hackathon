---
status: proposed    # proposed, then accepted, rejected or superseded
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

## Interpretation
