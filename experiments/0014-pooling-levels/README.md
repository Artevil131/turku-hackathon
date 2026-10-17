---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem (overnight run)
data: [synthetic_microbiology_dataset, seed 2026, as received 2026-10-09]
parent: 0004
---

# 0014 At which level should coverage be pooled: hospital, inpatient or outpatient, ward class or unit, with and without the onset split?

## Goal

0004's review found units differ by type (urinary *E. coli* trimethoprim R 15 to
17 % in the ED and health centres, 21 to 25 % on wards, measured) and called an
inpatient/outpatient estimator the obvious next one; 0004's raw unit year was
+0.0004 Brier worse than the hospital's (computed). The shipped list (D-023,
D-033) steps down by count, not evidence: unit at 30 results, else ward type,
else hospital. This pools at each level alone, with and without the onset split,
and scores each on C1 to C8 against both baseline rows and the replacement rule,
so Artem can decide whether the list should show a coarser pool than the unit
by default and whether onset belongs in the number.

## Hypothesis

Exploratory in PROTOCOL.md's sense: it describes how pooled levels behave on the
harness and supports no claim beyond its tables. The yardstick is METRICS.md's
replacement rule (C1 not worse than the shipped row by over 0.002, C4 not worse
in either convention, C8 better, C3(b) and C7(a) passing; C6 beside). The
expectations rest on 0004, 0012, 0013; 0004's type difference was measured on
the whole data, so it is not blind to the scoring period.

1. TUNE's lowest Brier is a row pooled at inpatient/outpatient, ward class or
   hospital; unit rows have the highest TUNE Brier of the eight selectable rows
   (assumed: TUNE sees 84 to 336 days of history, favouring coarse pools).
2. C1 (all, `left_out`) minus hospital-365: P-IO −0.0003 to +0.0001; P-WC within
   ±0.0001 of P-IO; P-U +0.0002 to +0.0006 (0004's estimator 2, +0.0004,
   computed: a reproduction). C5 for *E. coli*|TMP: P-IO below hospital-365's
   0.1666 by 0.0004 to 0.0024 (derived: π(1−π)Δ², π = 0.4 assumed, Δ = 4 to 10
   points from the review).
3. Onset: S-H minus P-H on C1 is −0.0003 to 0.0000; F-H within ±0.0001 of P-H;
   S-U and F-U within ±0.0001 of P-U (derived: at the unit level the split
   collapses to the unsplit estimate, below). 0012's no-split ablation was 0.0001
   better than its split row (computed): little onset effect is expected.
4. No row passes every line of the replacement rule against the shipped row. C8
   C1 of H, IO, WC rows exceeds the shipped 0.1656 (assumed: a pool of three or
   more units dilutes an outbreak in one) and their E1 ceftriaxone C6 is "not
   reached"; U rows land within 5 days of the shipped 47 (derived: same p,
   Jeffreys for Wilson); C7(a) is in 0.85 to 0.95 and C3(b) passes for every row.

Refuted by: a unit row or any S row being TUNE's pick; a coarser-than-unit row
whose C1 difference interval lies wholly below −0.0003 or above +0.0003; P-IO's
C5 for *E. coli*|TMP not lower than hospital-365's by 0.0002; S-U differing from
P-U by over 0.0002 on C1; a row passing every line.

## Experiment

**Data, targets.** The harness's (`aei.score_coverage`, harness-spec.md
"Coverage"): first isolates per patient × organism × specimen, cell = unit ×
specimen × antibiotic over all organisms; conventions `left_out`, `counted` (C1
and C4 report both), `spectrum` (C4 mild). 26 windows for C1, C2, C3(a), C5, C8
(C1); 24 months for C3(b), C4, C7, C8 (C4); C6 for E1, E2.

**Levels.** The pool of unit u: first isolates of the last 365 days
(`view.first_cells(365)`), same specimen and antibiotic, its own isolates
included as in the baseline. H: all nine units (the baseline's "hospital"). IO:
wards.csv `ward_type`, in = MED-A, MED-B, SURG, URO, ICU, GER, out = ED, PHC-N,
PHC-S (the list's "ward type"; the brief's two names for it are one level). WC,
ward class: in-wards, ED, health centres (`institution` × `ward_type`, the one
extra level the data columns give). U: the unit. **Onset** is day 3 of the stay
or later (`hospital_onset`); only inpatient units have an admission date, so ED
and health centres are community only (onset weight 0). **Rows (12):** P-H,
P-IO, P-WC, P-U unsplit; S-H, S-IO, S-WC, S-U split, scored as below; F-H, F-IO,
F-WC, F-U the split folded to one p per cell on every view (an ablation).

**Estimates.** Unsplit: p = k/n of the pool, (a, b) = (k + 0.5, n − k + 0.5)
(Jeffreys); an empty pool takes the hospital's p, 0.5 if empty (0004's rule), so
P-H is hospital-365 and P-U is 0004's estimator 2. Split: p_s = k_s/n_s per
stratum (community, onset), an empty stratum taking the hospital's, else the
hospital's unsplit; folded p = w_O p_O + w_C p_C, w the unit's onset share of its
first isolates of that specimen (all organisms, 365 days; the hospital's if it
has none), (a, b) moment-matched below. The harness takes the 95 % interval (C4)
and 90 % interval (C6, C7) from (a, b); no overdispersion correction. `n` is the
hospital's count for every row, so no row is gated at its own level and C4
differs by p and interval only; the share of predictions whose own-level pool
has under 30 results is tabled per level.

**Scoring the split.** The cell has no onset, but the harness takes isolate-level
predictions for C1, C2, C3(a), C5, C8 (C1). As in 0012, an S row returns
isolate-level p (the stratum of the target isolate's own onset, known at
sampling) when `view.grid is GRID and view.target is not None`, and the folded
cell-level Beta on month and C6 views: one object, C1 to C8. The fold loses
this: C3(b), C4, C6, C7, C8 (C4) judge one number per cell at the unit's onset
mix, so a hospital-onset patient's own number is never scored there. F rows
measure the same loss on C1.

**Choice on TUNE only.** Ten consecutive 28-day windows, 2023-12-25 to
2024-09-29 (as 0012, 0013), targets from `first_isolate_cells`, mean Brier over
all isolate × antibiotic predictions in `left_out`, by a local loop used for
selection only. The lowest of the eight P and S rows is the reported row
(`tuned_on_test` false, `tuned_on` "2023-12-25..2024-09-29"), chosen once for both
conventions; exact ties go to the coarser level, then to no split. All 12 rows
are then scored on the scoring period and tabled as exploratory
(`out/grid.json`); a row picked from that table was picked on the scoring period.

**Baselines, metrics, checks.** `coverage-hospital-365` (differenced against) and
`coverage-shipped` (the fallback rule, the reference; not re-run), from
benchmarks/overnight-2026-10-17/baselines/. `score_estimator` per row: C1, C2
(all, small, both conventions; differences with 95 % intervals, 26 windows,
1,000 resamples, `mulberry32(2026)`), C3(a), C3(b), C4 (mild spectrum, mild all,
severe, both conventions), C5 (tabled for *E. coli* TMP, CIP, AMP, MEC), C6,
C7(a), (b), C8; the replacement rule line by line. Differences between two rows
other than hospital-365 are points without an interval (the harness bootstraps
only against it); nothing is claimed inside an interval. Checks in
`out/results.md`: P-H equals `hospital_365` and P-U `estimators_0004()[1]` on
three views × three conventions; S equals P at IO, WC, U on the outpatient units
(weight 0); with w_s := n_s/n the split equals k/n to 1e-12; F and S agree on
C3(b), C4, C6, C7; every call reads only rows dated before `view.start`.

**Choices this plan makes**, each proposed (overnight), pending Artem: the 365
days and own isolates in the pool; WC; Jeffreys and k/n; the fallbacks; the
weight source; the matched Beta; `n` as the hospital's count; the TUNE windows,
"lowest Brier, no tie band" (a band toward the coarse level would make the
baseline the pick whenever differences are as small as expected) and selecting
with the isolate-level S credit; 0013's readings of the replacement rule (C1
differenced from either row; "not worse on C4" a point estimate not below the
shipped row's; "better on C8" a lower C8 C1).

**Budget, command, outputs.** Deterministic; 10 minutes of CPU
(`aei.harness.Clock`), expected about 90 s (assumed: the baseline took 4.7 s, 3.6
the data load; rows are bincounts, about 3 s each, 12 rows, plus TUNE and
checks). If over, cut in this order and record it under "Deviations from plan":
F rows but F-H and F-U; C6 for all rows but the chosen, P-H, P-U; the WC rows. No
dependency, no new `aei` module; code in `pooling.py` and `run.py` here.

    uv run python experiments/0014-pooling-levels/run.py

writes `out/results.md`, `out/metrics.json` (the TUNE-chosen row through
`aei.harness.write_metrics`, family "coverage"), `out/grid.json` (12 rows, TUNE
Brier) and `out/figure.png` (under 1 MB, `metadata={"Software": None}`).

## Mathematical foundation

**Pooled binomial.** Unit u has share p_u; a pool G holds n_G first isolates, a
fraction π_u' from unit u', so k_G/n_G estimates p_G = Σ π_u' p_u'. Against a
target isolate of u the expected squared error is p_u(1 − p_u) + (p_G − p_u)² +
p_G(1 − p_G)/n_G (repeat patients and drift ignored): noise, bias² and variance.
The unit (bias 0, n_u) beats a pool of n_G ≫ n_u only when |p_G − p_u| >
√(p(1−p)/n_u): at p = 0.8, 4.0 points for n_u = 100, 7.3 for 30, 2.3 for 300
(derived). Pooling pays where units agree. This is Murphy's (1973) partition of
the Brier score into reliability and resolution, and the two ends of shrinkage:
a pool is a prior of infinite weight, the raw unit year of none, 0004's
estimator 5 (M = 20) a point between (Efron and Morris 1975, *Data analysis
using Stein's estimator and its generalizations*, JASA 70). Jeffreys is the
baseline's interval (Brown, Cai and DasGupta 2001, *Interval estimation for a
binomial proportion*, Statistical Science 16).

**Stratified estimate** (Cochran 1977, *Sampling Techniques*, ch. 5). With pool
stratum shares p_s and the target's weights w_s, p = Σ w_s p_s is unbiased for
the target's mixed share if each p_s is. The unsplit pool uses its own weights
w_s^G, so its bias against the unit is (w_O^G − w_O^u)(p_O − p_C) and folding
gains its square; the isolate-level split gains w_O w_C (p_O − p_C)², on
inpatient cells only. At the unit level with w_s = n_s/n (proportional
allocation) Σ w_s k_s/n_s = k/n exactly, so the split moves the unit estimate
only through the weight source and empty strata.

**Variance of the fold.** Stratum Jeffreys mean m_s = a_s/(a_s + b_s), variance
v_s = a_s b_s/((a_s + b_s)²(a_s + b_s + 1)); the weight is Beta(N_O + 0.5, N_C +
0.5) given the unit's N = N_O + N_C first isolates of the specimen, independent
of the p_s. Then m = Σ w_s m_s, Var = Σ w_s² v_s + (m_O − m_C)² w_O w_C/(N + 2)
(0013's closed form for two strata). With c = m(1 − m)/Var − 1 (floored at
10⁻³, m clipped to [0.001, 0.999] as the harness does) the matched Beta is
(mc, (1 − m)c); w_O = 0 returns the stratum's Beta unchanged.

**Where it breaks.** Units in a pool differ (bias; the interval treats the pool
as one population, too narrow for them: C7); isolates are not independent
(repeat patients, outbreaks E1, E2); a 365-day pool lags; onset exists only for
inpatients; two Betas mixed are not a Beta.

## Why this method here

- 0004's review named the in/out type difference; 0013 found the organism mix
  the same in every unit, so any signal is per-organism susceptibility by unit
  type, which the level choice tests directly. 0012's onset ablation hints a
  small effect; here it is isolated where the strata are large.
- The shipped rule gates at 30 per unit; this shows what each level alone gives,
  so Artem can see whether the gate or the level matters. For the doctor: a
  number from a coarser pool with its count, unit and onset shown only where
  they differ and counts allow.

## Proposed visualisation

One expanded row of the doctor's list (a list, no map), light mode, 7.5 × 4
inches at 120 dpi: "the ladder of pools" for one cell as of 2026-09-27, the unit
× specimen × antibiotic with the largest |p_IO − p_H| among unit cells with 30 or
more results, picked from rows dated up to 2024-09-30.

- *Axes.* Horizontal: share covered, 0 to 100 %, "Kattavuus / Coverage, %". Four
  rows top to bottom: "Sairaala / Hospital", "Vuode- tai avo-osasto / Inpatient
  or outpatient", "Osastoluokka / Ward class", "Yksikkö / Unit".
- *Marks.* Per row a filled circle at p with its 90 % Beta interval as a thick
  bar with end ticks; for S rows beside it an open triangle (community) and a
  filled square (hospital onset) with thin 90 % bars. The pool the shipped rule
  would use is bold-labelled "käytössä / used"; a dotted vertical rule at 90 %
  labelled "raja / threshold".
- *Counts and encoding.* Right of each row "k 1,480 / n 1,812" (covered /
  results; a layout example) and, for S rows, the two stratum counts; cell and
  as-of date in the title. Position and bar length carry the numbers, marker
  shape the stratum, text the counts; colour (one blue, greys) carries nothing
  the shapes and labels do not.

## Result

Command: `uv run python experiments/0014-pooling-levels/run.py` (writes
`out/results.md`, `out/metrics.json`, `out/grid.json`, `out/figure.png`).
Tags: computed (by that run), measured (counted in the data), derived
(calculated from numbers given here), assumed; every number is computed unless
tagged. Deterministic; bootstrap draws are the harness's (seed 2026, 1,000
resamples of 26 windows or 24 months). CPU time 59.8 s and 73.1 s in two runs
(`aei.harness.Clock`, shared laptop; the committed outputs record the last) of
the 600 s budget; all 12 rows scored in full, no cut.
`uv run python scripts/verify_experiments.py --only 0014` says "reproduces".

**Row chosen on TUNE only** (10 windows, 61,847 isolate × antibiotic predictions,
Brier in `left_out`; difference to the lowest): P-H 0.13681 (chosen), P-IO
+0.00008, S-H +0.00012, P-WC +0.00018, S-IO +0.00027, S-WC +0.00037, P-U
+0.00067, S-U +0.00120. No tie. `tuned_on_test` false. The chosen row is P-H,
which is hospital-365: its metrics equal `coverage-hospital-365.json` on all 150
numbers compared (difference 0), so `out/metrics.json` repeats the baseline row.
The finer rows are in `out/grid.json`, exploratory (scored on the scoring period).

**Metrics** (95 % bootstrap intervals; 26 windows for C1 to C3(a) and C8 C1, 24
months for C3(b), C4, C7, C8 C4). P-IO and P-U are shown beside the chosen row;
all 12 rows are in `out/results.md`.

| metric | P-H (chosen = hospital-365) | shipped | P-IO | P-U |
|---|---|---|---|---|
| C1 all | 0.1414 (0.1398 to 0.1431) | 0.1417 (0.1401 to 0.1435) | 0.1414 | 0.1418 |
| C1 diff to hospital-365, all | 0 | +0.0003 (+0.0001 to +0.0005) | −0.00005 (−0.00011 to +0.00001) | +0.00036 (+0.00019 to +0.00053) |
| C1 diff, small | 0 | +0.0008 (+0.0004 to +0.0013) | +0.00005 (−0.00017 to +0.00027) | +0.0011 (+0.0006 to +0.0016) |
| C1 diff, all, counted | 0 | +0.0003 (+0.0002 to +0.0005) | −0.00003 (−0.00010 to +0.00003) | +0.00036 (+0.00018 to +0.00054) |
| C2 diff, all | 0 | +0.0011 (+0.0006 to +0.0017) | −0.00011 (−0.00027 to +0.00005) | +0.0015 (+0.0009 to +0.0020) |
| C3(a) slope, intercept | 1.038, 0.023 | 1.026, 0.031 | 1.037, 0.023 | 1.024, 0.032 |
| C3(b) severe, observed of expected | 29 of 26.2 | 23 of 19.6 | 28 of 27.1 | 25 of 20.4 |
| C4 mild spectrum | 0.9661 (0.9626 to 0.9697) | 0.9656 (0.9621 to 0.9693) | 0.9656 (0.9621 to 0.9693) | 0.9656 (0.9621 to 0.9693) |
| C4 mild all organisms | 0.7542 (0.7471 to 0.7605) | 0.7543 (0.7471 to 0.7606) | 0.7542 | 0.7543 |
| C4 severe | 0.9532 (0.9499 to 0.9559) | 0.9545 (0.9514 to 0.9572) | 0.9537 (0.9505 to 0.9564) | 0.9541 (0.9508 to 0.9568) |
| C4 severe, counted | 0.9383 (0.9353 to 0.9412) | 0.9386 (0.9356 to 0.9412) | 0.9386 (0.9357 to 0.9413) | 0.9380 (0.9349 to 0.9409) |
| C6 E1 CRO, E1 CXM, E2 CXM (days) | not reached ×3 | 47, not reached, not reached | not reached ×3 | 47, not reached, not reached |
| C7(a), expected 0.907 | 0.899 (0.875 to 0.923) | 0.902 (0.877 to 0.925) | 0.903 (0.879 to 0.926) | 0.902 (0.877 to 0.925) |
| C8 C1 | 0.1669 (0.1538 to 0.1931) | 0.1656 (0.1531 to 0.1928) | 0.1656 (0.1530 to 0.1919) | 0.1656 (0.1532 to 0.1930) |
| C8 C1 diff to hospital-365 | 0 | −0.0013 (−0.0040 to +0.0026) | −0.0013 (−0.0025 to −0.0002) | −0.0013 (−0.0040 to +0.0027) |

n: C1 all 163,666 predictions; C7(a) 1,993 blocks; C8 C1 2,692 (all rows). The
other nine rows (computed, `out/results.md`): C1 diff all P-WC +0.00002
(−0.00005 to +0.00009), S-H −0.00001 (−0.00005 to +0.00003), S-IO +0.00001, S-WC
+0.00007, S-U +0.00075 (+0.00057 to +0.00093), F-H −0.00006 (−0.00010 to
−0.00002), F-IO −0.00005, F-WC +0.00002, F-U +0.00037 (+0.00020 to +0.00053). C5
for *E. coli* TMP, hospital-365 0.1666: P-IO 0.1657, P-WC 0.1658, P-U 0.1662
(−0.0009, −0.0008, −0.0004 against it); *E. coli* AMP 0.2452: −0.0014 for P-IO, P-WC
and P-U; CIP −0.0001 (P-IO, P-WC), +0.0001 (P-U); MEC +0.0001 (P-IO), +0.0002
(P-WC), +0.0007 (P-U).
Predictions with under 30 results in the pool of their level: 0.7 % for U, 0.0 %
for the other levels. C7(a) 0.898 to 0.905 and C3(b) passing for all 12 rows;
E1 ceftriaxone C6 reached only by the U rows (47, 46, 46 days for P-U, S-U, F-U),
E1 cefuroxime and E2 by no row.

**Replacement rule against the shipped row** (readings of 0013; "points" and
"interval" as in `out/results.md`). Chosen P-H: C1 passes (−0.0003 against the
shipped row in both conventions); C4 fails by points and by interval (severe
−0.0013, interval −0.0026 to −0.0001; mild spectrum +0.0005, −0.0000 to +0.0012;
mild all −0.0001; severe counted −0.0003, −0.0015 to +0.0009); C8 fails (C1
0.1669 against 0.1656, difference +0.0013, −0.0028 to +0.0040); C3(b) passes (29
of 26.2, ratio 1.11); C7(a) passes (0.899): 3 of 5. P-IO: C1 passes (−0.0003,
−0.0004); C4 fails by points (severe −0.0008, −0.0019 to +0.0002) and passes by
interval; C8 fails (+0.00002, −0.0029 to +0.0018); C3(b) passes (28 of 27.1);
C7(a) passes (0.903): 3 of 5 by points, 4 of 5 by interval. Across the twelve
rows no row passes all five lines: every row fails C8 by points (difference +0.00002
to +0.0013) and by interval; S-U and F-U pass C4 by points (severe +0.00006) and
reach 4 of 5, the best.

**Against the hypothesis.** (1) Held: TUNE's pick is P-H (not a unit row, not an
S row) and the unit rows have the two highest TUNE Brier. (2) Held: P-IO −0.00005
(inside −0.0003 to +0.0001), P-WC within 0.00007 of P-IO, P-U +0.00036 (a
reproduction of 0004's estimator 2: +0.0004, small +0.0011); C5 for *E. coli* TMP
0.0009 lower for P-IO (inside 0.0004 to 0.0024). (3) Held in part: S-H minus P-H
−0.00001 (inside −0.0003 to 0), F-H within 0.00006 of P-H, F-U within 0.00001 of
P-U (the identity holds); **refuted for S-U: its C1 is 0.00039 above P-U's**
(+0.00075 against +0.00036, a point difference without an interval, beyond the
0.0002 refutation line). (4) Held in part: no row passes every line and the U rows
land at 47, 46 and 46 days; but C8 C1 of P-IO and P-WC is 0.1656, 0.00002 above the
shipped row's (equal to four digits), so the dilution reading fails for IO and WC (it
holds for H: 0.1669, +0.0013); C7(a) and C3(b) hold for all rows.

**Checks** (all pass, `out/results.md`): P-H equals `hospital_365` and P-U equals
`estimators_0004()[1]` on three views × three conventions (difference 0); S equals
P at IO, WC, U on the 1,404 outpatient cells with a non-empty pool (702 empty-pool
cells left out); with w_s := n_s/n the split equals k/n (1,404 cells, 1.1e-16); the
matched Beta has the fold's mean and variance (1,872 cells, 1.1e-16 and 6.3e-16
relative); F and S agree on C3(b), C4, C6, C7, C8 (C4) (24 of 24); every call reads
only rows dated before `view.start` and within 365 days.

**Figure** (`out/figure.png`, 7.5 × 4 inches, 120 dpi, 38 KB): the ladder of pools
as of 2026-09-27 for the cell the plan's rule picked from rows up to 2024-09-30,
ED blood cefuroxime. Hospital 218 of 290 (75.2 %, 90 % interval 70.8 to 79.1 %);
inpatient/outpatient, ward class and unit all 75 of 102 (73.5 %, 65.9 to 80.2 %),
because ED is the only outpatient unit with blood isolates that year (derived from
the equal counts). The cell is outpatient, so the onset markers, drawn only for
inpatient cells, are absent from the committed picture. The shipped rule would use
the unit's pool.

**Deviations from plan:** none in method or grid. The share of predictions under 30
results is prediction-weighted, which the plan did not say.

## Interpretation

On this data the pooling level moves the doctor's number very little. Against
hospital-365, C1 differs by −0.00005 (−0.00011 to +0.00001) at inpatient/outpatient and
+0.00002 at ward class, both inside the interval of zero, and by +0.00036 at the unit,
which is 0004's finding again. The one place a level shows is the pair 0004's review
named: *E. coli* trimethoprim is 0.0009 better pooled by inpatient/outpatient (computed,
C5, no interval). By METRICS.md's decision rules no row replaces the shipped estimate:
every row fails C8. The row nearest is inpatient/outpatient: C1 0.0003 under the shipped
row (point), C3(b) and C7(a) passing, C8 equal to the shipped row (+0.00002, interval
−0.0029 to +0.0018), C4 below by points (severe −0.0008) but not by interval. Its C1
interval against hospital-365 (−0.00011 to +0.00001) and the shipped row's (+0.0001 to
+0.0005) do not overlap (derived; not a paired test), so the shipped fallback is the
costlier of the two on C1 here. Nothing is decided: a 0.0003 Brier is the size 0004
said no doctor would notice.

TUNE chose hospital-365 itself, so the reported row is the baseline; the scoring period
then puts inpatient/outpatient 0.00005 below it where TUNE had it 0.00008 above. Both
differences are under 0.0001 and inside their spread, and TUNE's windows see 84 to 336
days of history, which favours coarse pools (assumed), so the sign flip is not a finding.

Onset: the fold (F) at the hospital level is 0.00006 below P-H with an interval wholly
below zero (−0.00010 to −0.00002; C2 −0.00016, −0.00026 to −0.00005), and the
isolate-level S-H is no better (−0.00001), so knowing the patient's own onset adds
nothing the unit's onset mix does not. The size is 0.0001 of a Brier and one of 12 rows,
so it is a description, not a gain. S-U is the exception the plan did not predict: the
folded split equals the unsplit estimate at the unit level (F-U +0.00037 against P-U
+0.00036, as derived), but the isolate-level split halves the pools and costs +0.00039
(point) with no bias to repay it. The derivation covered the fold only; it said nothing
about the isolate-level split. The C8 gain of IO and WC over hospital-365 (−0.0013,
−0.0025 to −0.0002) is not outbreak response: C6 for E1 ceftriaxone is still not
reached at those levels (only the unit rows reach it, at 46 to 47 days), so the gain is
more likely the inpatient units' baseline differing from the hospital's, which
includes outpatients (assumed).

The strongest alternative explanation for how small the effects are is dilution, not
absence: the cell pools every organism, so a type difference in *E. coli* TMP or AMP is
averaged with organisms and drugs where units agree (0013: the organism mix is the same
in every unit), and the generator may give type differences in few pairs. A second is
that these data are synthetic and carry little onset signal; a third that TUNE's short
history chose the wrong level and the scoring period's ordering is noise at 0.0001.

Next, none run: (1) pool per organism × antibiotic with 0013's mix, where the *E. coli*
TMP and AMP differences are not diluted; (2) partial pooling between inpatient/outpatient
and the unit (method 2 of the brief) in place of hard levels, which would also settle the
gate at 30; (3) a harness cell with onset, so C4 can judge the numbers an onset-specific
doctor's list shows; (4) a paired row-to-row bootstrap in the harness, to give the S-U
minus P-U difference an interval.
