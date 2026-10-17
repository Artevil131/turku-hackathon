# Overnight harness: specification and the choices it makes

Written by the orchestrating session (Claude Code, operated by Artem,
overnight run of 2026-10-17) before the harness was built. It turns
benchmarks/METRICS.md into code. Where METRICS.md leaves a statistical
detail open, the choice made here is listed under "Choices" with the
reason; every one is *proposed by Claude Code, pending Artem*, and none is
a DECISIONS.md entry. Every experiment of the night scores through this
harness, so a choice here applies to every row of the leaderboard alike.

## Layout

| Module | Owns |
|---|---|
| `aei.harness` | the facade: split constants, cached data loading, `write_metrics` (the METRICS.md schema), re-exports of the three scoring modules |
| `aei.coverage_list` | Python mirror of the shipped `@aei/coverage` `coverage`, `suggest`, `suggestCombinations` (D-023, D-026 to D-028, D-033), for scoring C3(b) and C4 |
| `aei.score_coverage` | coverage targets, the estimator protocol, C1 to C8, the two coverage baselines |
| `aei.score_detection` | the detector protocol, the live set as a detector (with new-in-unit, D-021), D1 to D7, I1 incidents (D-034), threshold sweeps for D5 |
| `aei.inject` (extended, existing functions unchanged) | generic cluster and gap trials that take any detector; two-unit clusters |
| `aei.score_prediction` | THL county series, P2 scoring with persistence and seasonal naive, P1 exposure with the rewiring null |

Baseline scripts: `benchmarks/overnight-2026-10-17/baselines/{coverage,detection,prediction}.py`,
each writing `baselines/<row>.json` in the METRICS.md schema.

## Common

- `TUNE = ("2023-10-02", "2024-09-30")`, `SCORE = ("2024-10-01", "2026-09-27")`.
- Data: `data/synthetic_microbiology_dataset` (seed 2026, received
  2026-10-09); THL `data/external/thl/ttr_monthly.csv`, fetched 2026-10-17.
- Strict as-of: every estimate or signal for day t is computed from records
  with sample date ≤ t (detection) or < the first target day (coverage).
  The harness passes estimators only the visible rows.
- Spread: bootstrap over target windows (coverage), over months (county),
  per-seed counts (injections).
- Injection seeds (Artem's addendum, 01:15): every experiment and baseline
  row screens on seed 2026 only. Seeds 2027 to 2030 are held out: a method
  is named best in its family only after it is re-scored on them, and both
  numbers are reported (keys with the suffix `_heldout`). The leaderboard
  is screening, not selection.
- Runtime is informational (the design session shares this CPU): never
  ranked, never a reason to cut, except the 10-minute CPU budget rule.

## Coverage (C1 to C8)

**Estimator protocol.** `predict(view, convention) -> DataFrame` with one
row per cell `(unit, specimen, antibiotic)` and columns `p` and optionally
`a`, `b` (a Beta belief about p) or `lo90`, `hi90`, plus `lo95`, `hi95`
for C4. `view` holds only records dated before the first target day.
Estimators may also return isolate-level predictions keyed by `isolate_id`.

**Outcome conventions.** Per target first isolate × antibiotic suiting the
specimen (`suits_specimen`, the cefoxitin screen excluded), from
`effective_result`:

| convention | S | R, intrinsic | no breakpoint | untested |
|---|---|---|---|---|
| `left_out` (0004, the default) | 1 | 0 | 0 | left out |
| `counted` (0010 table 3) | 1 | 0 | 0 | 0 |
| `spectrum` (D-027, mild basis) | 1 | 0 | left out | left out |

**Targets for C1, C2, C3(a), C5, C8.** 0004's: 26 consecutive 28-day
windows from 2024-09-30 to 2026-09-27; first isolates per patient ×
organism × specimen within each window. "Small" cells: under 30 first
isolate × antibiotic results in the unit's cell over the 28 days before
the window (0004). Windows start one day before SCORE so the 0004
baseline reproduces exactly.

- C1 Brier, C2 log loss (p clipped to [0.001, 0.999]), each for all cells
  and small cells, with the difference to the baseline (hospital, same
  specimen, last 365 days) and a 95 % interval from 1,000 bootstrap
  resamples of target windows with `mulberry32(2026)`, drawn as 0004
  draws them.
- C3(a): slope and intercept of a logistic regression of the outcome on
  logit(p clipped), all isolate × antibiotic predictions.
- C5: C1 by organism × antibiotic.
- C8 (C1 part): C1 on target isolates in URO 2025-06 to 2025-08 and ICU
  2026-02 to 2026-04.

**Targets for C3(b), C4, C7, C8 (C4 part).** 0010's: as-of the last day
of each month 2024-09 to 2026-08, target = the next calendar month, the
unit's own first isolates within the month, queries unit × specimen ×
severity. The estimator's p and 95 % interval go through the Python
mirror of `suggest`; the untested share that gates "not assessable" is
taken from the shipped level pool. The baseline row reproduces 0010's
tables (C4 mild 96.6 % in spectrum, 75.4 % all organisms; severe 95.4 %;
C3(b) 0 of 175 and 23 of 269 against 19.6 expected).

- C4: pooled realised next-month coverage of the top suggestion, mild
  (spectrum and all organisms) and severe, in `left_out` and in `counted`.
- C3(b): among query-months whose top pick clears with ≥ 10 target
  isolates, observed realised shares below the threshold against the
  expected number from the binomial at the predicted share (as 0010);
  passes when observed / expected ≤ 1.5.
- C7: blocks are unit × specimen × antibiotic × target month with ≥ 20
  target isolates with a result. (a) over all blocks, (b) over the
  outbreak unit-months. See Choices 1.
- C6: daily as-of estimates from 2025-04-01 to 2025-09-30 (E1: URO, urine,
  ceftriaxone and cefuroxime) and 2026-01-01 to 2026-05-31 (E2: ICU, the
  specimen with most March 2026 MRSA, cefuroxime, whose S. aureus result
  follows the cefoxitin screen); days from onset until the 90 % interval
  excludes the estimate of the day before onset. Onsets: the first
  outbreak isolate, 2025-05-30 (E1, corrected in 0002's review) and
  2026-03-03 (E2). "Not reached" if never within 120 days.

## Detection (D1 to D7, I1)

**Detector protocol.** `run(records, cultures, focus) -> list[Signal]`
(`aei.detect.Signal`), causal: a signal dated t depends only on rows dated
≤ t. `focus` (units, organism, phenotypes, specimen, start, end) is a
hint an injection trial passes so a detector may compute only what can
produce a matching signal; ignoring it is correct, only slower. Signals
carry `p` (smaller is stronger; a detector without a p-value maps its
statistic to a monotone score). A run at the loosest threshold, then
filtering by `passes(signal, level)` (default `p < level`), gives every
stricter threshold, so a D5 curve costs one run. Multi-unit signals set
`ward` to the units joined by `+`, sorted. `kind_of(signal)` names one of
sentinel, cluster, trend, divergence, data.

**The live set as a detector:** `live_signals` (D-020, D-022, D-031) plus
new-in-unit (D-021, D-034: MRSA or VRE in an inpatient unit with none in
the previous 180 days, silent for the first 180 days of data), a Python
re-implementation of `newInUnitAlerts` in `@aei/alerts`.

- D1: E1 to E4 with 0002's matchers and delays (from 0002's start dates)
  and, beside them, delays from the corrected onsets. Demonstration only.
- D2: injected clusters, k ∈ {2, 3, 4, 6} plus controls, 200 trials per
  cell from one seed-2026 stream (held-out: seeds 2027 to 2030 at 50 each),
  families:
  `rare` (0007's ESBL and MRSA clones, 0007's draw order: seed 2026, 40
  trials reproduces 0007), `common_resistant`, `wild_type`, `common_esbl`
  (0011's arms and draws: seeds 2026 to 2028 at 20 per seed reproduce
  0011), `two_unit` (new). Detected: a signal for the unit (or a `+` set
  containing it) and the source's organism or a phenotype of it, dated
  from the start to 28 days after (0007). Rate with 95 % Wilson interval,
  per-seed counts, median delay from the first injected isolate.
  Injected patients get a culture row each, so culture-based detectors
  see them.
- D3: gaps of d ∈ {2, 3, 5, 7} days and a halved week, 200 trials, as
  0007's `gap_trial` with any detector; the gap's isolates are removed
  with its cultures. Detected: a data-kind signal for the unit within 14
  days of the start.
- D4: episodes per year over SCORE with the fixed key of METRICS.md,
  excluding planted and quarantined events (Choices 4), in total and by
  kind; alerts per week (episodes by the detector's own key).
- D5: for each threshold level, D2 rate at k = 4 against D4; headline at
  the loosest level with D4 ≤ 5 episodes a year (Choices 3), for `rare`
  and `common_esbl`, with the median delay there.
- D6: share of injected gaps with any non-data signal for the gap unit
  dated within the gap or the 7 days after it.
- D7: among detected planted and injected events, the share where a
  matching signal has the event's kind (cluster for clusters, data for
  gaps; E2 needs both sentinel and cluster).
- I1: alerts per incident over SCORE, incidents as D-034.

**Re-tuned live set (the reference row).** See Choices 5.

## Prediction (P1, P2)

- P2: four phenotype series per county, each the sum of THL's report
  groups for it (MRSA: carriage, blood/CSF; ESBL: carriage and blood/CSF,
  *E. coli* and *K. pneumoniae*; VRE: carriage, blood/CSF; CPE: the three
  carriage groups), 23 regions, plus the national total. Targets
  2024-10 to 2026-09, one month ahead from data to the month before.
  Forecasters return a predictive distribution (anything with `logpmf`
  and `ppf`, such as a frozen scipy distribution). MAE of the predictive
  median; mean log score; skill against persistence and seasonal naive
  (Choices 6); 95 % bootstrap over target months (1,000, seed 2026); per
  phenotype, national, pooled. Also reported without the last two months
  (THL's late notifications).
- P1: flow graph per ENGINE.md section 4 (patients with a culture in A
  then in B within 30 days, each patient weighted 1 / units visited) over
  the 365 days before onset; exposure of B from source S as
  w(S→B) / Σ_A w(A→B) and as raw w(S→B); outcome per unit: the
  phenotype's patients in the 8 weeks from onset exceed the unit's
  26-week baseline at Poisson upper-tail p < α, α ∈ {0.05, 0.001}; AUC
  over the other eight units; null: 1,000 random permutations of unit
  labels over the window's culture rows (keeps every unit's volume and
  every patient's number and dates of samples), seed 2026.

## Choices (proposed by Claude Code, pending Artem)

1. **C7 interval honesty is predictive.** A 90 % interval for the
   proportion p cannot be expected to contain a realised share over 20
   isolates, which carries its own binomial noise. C7 therefore asks
   whether the realised count k lies inside the method's 90 % predictive
   interval for k at the block's n: Beta-binomial from the method's
   Beta(a, b), or from a Beta moment-matched to its interval; a mid-p
   probability integral transform u = F(k − 1) + f(k)/2, inside when
   0.05 ≤ u ≤ 0.95, so a discrete outcome does not inflate coverage.
   The literal share (interval for p contains k/n) is reported beside it.
2. **C3(b) expectation** uses the binomial at the predicted share, as
   0010 did, although METRICS.md says Beta-binomial; the Beta-binomial
   version is reported beside it.
3. **D5 noise is of the same kind.** The D5 headline reads D4 counted
   over the method's cluster and sentinel signals only, since only these
   can find an injected cluster; whole-tool D4 is reported beside it. For
   the live set the threshold level multiplies both cluster alphas
   (profile excess 1e-4, phenotype excess 1e-3) by m ∈ {100, 30, 10, 3,
   1, 0.3, 0.1, 0.03, 0.01}.
4. **Exclusion zones for D4.** Planted: E1 URO × {*E. coli*, ESBL}
   2025-05-30 to 2025-08-31; E2 ICU × {*S. aureus*, MRSA} 2026-03-01 to
   2026-04-30; E3 PHC-S data signals 2025-12-08 to 2025-12-31; E4 trend
   signals for urinary *E. coli* trimethoprim and *P. aeruginosa*
   piperacillin-tazobactam. Quarantined (0002's hand check, inside SCORE):
   MED-A data signals 2025-05-12 to 2025-05-31; MED-A × *E. coli*
   2025-08-25 to 2025-10-31. An episode is excluded when any of its
   signals falls in a zone.
5. **Re-tuning the live set on year 1, "by the same procedure".** 0002
   took, per detector, the setting with the fewest other episodes among
   those that found the planted event the detector was for. Year 1 has no
   planted event, so injected ones stand in: per detector and alpha in
   0002's grid {0.01, 0.001, 0.0001}, inject 40 events (seed 2026) with
   start dates 2024-04-01 to 2024-08-15 (after about six months of
   baseline, METRICS.md's split table) and count other episodes over
   2024-04-01 to 2024-09-30; take the alpha with the fewest episodes among
   those detecting at least 80 % (0007's bar), else the one detecting
   most. Events: rare clusters of 4 for profile and phenotype excess,
   5-day gaps for sampling drop, 3-day gaps for empty run. The trend test
   (24-month window) and new-in-unit (180 days chosen on E2) cannot be
   tuned on year 1 and keep their shipped settings; the row is marked as
   partly tuned on test for them.
6. **County baselines.** Persistence: Poisson with mean max(y(t−1), 0.5);
   seasonal naive: Poisson with mean max(y(t−12), 0.5). The floor keeps
   the log score finite after a zero month. MAE uses each forecast's
   median (persistence: y(t−1)).
7. **Rewiring null as label permutation.** Permuting unit labels over
   culture rows is a uniform draw among bipartite multigraphs with the
   same patient and unit degrees, and keeps dates, so the time-ordered
   30-day edges can be recomputed on each replicate.

## Metric keys in metrics.json

Stable names, so the leaderboard reads every row the same way. A metric a
method does not produce is left out, not set to null. `intervals` mirrors
`metrics` for the keys that have one (95 % unless named); `n` gives what
each number rests on.

```
coverage
  C1        {all, small, all_counted, small_counted}            Brier
  C1_diff   same keys, value minus the hospital-365 baseline (intervals: bootstrap of the difference)
  C2, C2_diff                                                    log loss, same keys
  C3a       {slope, intercept}
  C3b       {mild_obs, mild_exp, mild_ratio, mild_tail_p, severe_obs, severe_exp, severe_ratio, severe_tail_p, pass}
            (tail_p: Poisson upper tail P(X >= obs) at the expected count; `pass` is still ratio <= 1.5)
  C4        {mild_spectrum, mild_all, severe, mild_spectrum_counted, mild_all_counted, severe_counted}
  C5        {"<organism>|<antibiotic>": Brier}                   left_out convention
  C6        {E1_CRO, E1_CXM, E2_CXM}                             days, null when not reached
  C7        {a, b, a_literal, b_literal, pass_a, a_expected, b_expected, a_minus_expected}
            (expected: coverage the method's own Beta-binomial implies under the mid-p rule; intervals.C7.a_minus_expected)
  C8        {C1, C1_diff, C4_mild_spectrum, C4_severe}
detection
  D1        {E1, E2, E3, E1_corrected, E2_corrected, E4}         days; E4 a date
  D2        {"<family>_k<k>": rate}  families rare, common_resistant, wild_type, common_esbl, two_unit; k 0 (control), 2, 3, 4, 6
  D2_delay  same keys, median days
  D3        {gap2, gap3, gap5, gap7, half7}, D3_delay
  D4        {episodes_per_year, cluster, sentinel, data, trend, divergence, alerts_per_week}
            (intervals.D4: exact Poisson 95 % for episodes_per_year and each kind, per year; none for alerts_per_week)
  D5        {level, noise, rare, common_esbl, rare_delay, common_esbl_delay}; the curve in the top-level field "D5_curve"
  D6, D7    shares
  I1        {alerts, incidents, alerts_per_incident}
prediction
  P1        {auc_share_a05, auc_raw_a05, auc_share_a001, auc_raw_a001, null_p_share_a05, null_p_raw_a05, positives_a05, positives_a001}
  P2        {mae, log_score, mae_skill, log_skill, mae_skill_seasonal, log_skill_seasonal,
             "<phenotype>_mae_skill", "<phenotype>_log_skill" for MRSA ESBL VRE CPE, national_mae_skill, national_log_skill,
             mae_skill_no_last2, log_skill_no_last2}       skill against persistence unless named
```

## Changes after the review

Additive only (new keys, new optional arguments; defaults and the values of existing keys unchanged), after
harness-review.md; every one is *proposed by Claude Code, pending Artem*.

- C3(b), finding 6: `mild_tail_p`, `severe_tail_p` (also in `C3b_bb`), the Poisson upper tail P(X >= observed) at the expected count; `pass` is unchanged (ratio <= 1.5).
- C7, finding 8: `a_expected`, `b_expected` (coverage the method's own predictive implies under the mid-p rule, about 0.907 for the baselines) and `a_minus_expected` with a bootstrap interval over target months in `intervals`; `a` and `pass_a` unchanged.
- Leaderboard, findings 9 and 12: the C6 columns have no better direction (shown, never bold); D5.level and D5.noise columns beside the D5 headline; a line says D5 is a property of the detector's threshold sweep.
- D4, finding 11: `intervals["D4"]` holds the exact Poisson 95 % interval of `episodes_per_year` and each kind (rates per year, from the episode count over SCORE); `aei.score_detection.poisson_interval` computes it.
- Re-tuned reference row, finding 13: the notes of `baselines/detection.py` state the caveat (cluster alphas chosen on 165 to 320-day baselines with a per-detector 80 % bar, one grid step looser than shipped, D4 cluster 4.5 a year against 1.0); the procedure is unchanged.
- Tests, finding 17: reference files are read with `git show HEAD:<path>`; 0010's rows come from `backtest.ts` run with a temporary working directory (data linked, own empty `out/`); the CPU-time assertion runs only with `AEI_PERF` set.
- Baseline JSONs regenerated and 0012's `run.py` rerun so the new keys are present; no existing value changed (checked key by key), only runtime fields.
