---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem (overnight run)
data: [synthetic_microbiology_dataset, seed 2026, as received 2026-10-09]
parent: 0011
---

# 0016 Does a Poisson and Bernoulli CUSUM with run-length-calibrated limits find injected clusters at the live set's noise?

## Goal

The live cluster tests compare a 28-day count with a 365-day Poisson mean
and signal on a snapshot (D-020). ENGINE.md 3.3 adds a Poisson CUSUM "for
the slow drip the weekly test misses"; QUESTIONS C5 leaves θ and h open
(proposal θ = 2.5, h set by replay to meet B). This runs that CUSUM per
unit × phenotype and unit × organism × specimen, and a Bernoulli CUSUM
(Reynolds and Stoumbos 1999) on the resistant-or-not isolates per unit ×
surveillance pair, with h calibrated to an in-control run length two ways,
Siegmund's approximation and simulation, both on year 1, and scores them on
D1 to D7 and I1 beside the live set as shipped and as re-tuned on year 1,
so Artem can answer C5 from numbers. The harness injects bursts, not a
drip, so what the CUSUM is for stays unscored; the record proposes the
missing family.

## Hypothesis

This experiment is exploratory in PROTOCOL.md's sense: it describes how the
two CUSUMs score and supports no claim beyond its table. The yardstick is
METRICS.md "Decision rules": D5 at 5 episodes a year for the rare and the
common ESBL family, with D2's median delay at k = 4, against
`live-set-retuned-year1` (the reference: 0.92 and 0.75 at 3.0 episodes a
year, delay 6 and 6 days, computed, baseline row) and `live-set-shipped`
(same D5, tuned on test). Described: D1 to D7 and I1, every setting's
year-1 row, and Siegmund's approximation against simulation and real data.

Directional expectation, derived by hand from the formulas below, so the
table can contradict it:

1. A burst of k patients lifts S by at most k ln θ: for k = 4, 3.7, 5.5, 8.3
   at θ = 2.5, 4, 8. Siegmund puts a 95-year limit for a series of 0.1
   events a week near 5.5, 6.5, 7.5 (derived). So the Poisson θ chosen on
   year 1 is 4 or 8, not C5's 2.5, and θ = 8 cannot see k = 3 (6.2).
2. At the loosest level with D4 at most 5 a year the rare family at k = 4
   reaches 0.75 to 0.95, no more than the reference, and the common ESBL
   family stays below 0.75: a large unit runs ESBL near 0.6 a week
   (measured, 0015 plan); at θ = 4 the reference value drains 3.6 of S in
   14 days, leaving it near 3.6 against a limit near 8 (derived).
3. Common resistant and wild type stay at or below 0.05 (live 0.01 and
   0.00, computed, baseline row). Delay at k = 4 is within 3 days of 6 for
   daily updates, up to 7 days longer for weekly.

## Experiment

**Data and series.** `synthetic_microbiology_dataset` through
`aei.harness.data()`, no row dropped; raw counts and S/R outcomes only
(D-039). m = 477 series at most: (1) Poisson, unit × phenotype (ESBL, MRSA,
VRE, CPE), 36; (2) Poisson, unit × organism × specimen, at most 243;
(3) Bernoulli, unit × the 22 `SURVEILLANCE_PAIRS` of `aei.detect`, 198. An
event in (1), (2) is a patient's first isolate of the series in that unit
in the trailing 365 days (as 0015; proposed (overnight), pending Artem), by
sample date; an observation in (3) is the same for the pair's organism (and
specimen) with a result for the antibiotic, R as in `rising_trend`.

**Statistics**, per series, resolution u = 1 day or 7 days (ISO weeks,
evaluated on their Sunday); derivation under "Mathematical foundation":

- Poisson: S_t = max(0, S_(t−u) + y_t ln θ − (θ − 1) λ̂_t), λ̂_t per period.
  Bernoulli: S_t = max(0, S_(t−1) + r_t ln θ − n_t ln(1 + (θ − 1) p̂_t)), r_t
  of day t's n_t isolates resistant, θ an odds ratio (proposed (overnight),
  pending Artem; C5 gives θ for the Poisson chart only).
- Baseline: the 26 weeks (QUESTIONS C3) ending 7g + u days before t, g the
  guard band in weeks; λ̂ = (C + k r_hosp S_b) / (S_b (1 + k)) per week, S_b
  the weeks used, k = 0.1, r_hosp the hospital's share of the series times
  the unit's volume (as 0015); p̂ = (R + M p_hosp) / (n + M), M = 30
  (QUESTIONS B1). Never zero. A series is monitored once 13 weeks exist.
- No reset after an alarm, so thresholds nest: a signal on every period with
  S_t above the loosest limit. A run of alarm days is one episode under the
  fixed key (28-day merge), counted at its first day, as a chart that resets
  would count it. Cost: D2 reads the first signal in its window, so a run
  begun before the start is a detection at delay 0; the k = 0 controls and
  a delay-0 count per family measure it.
- Signal: `aei.detect.Signal`, `detector` "cusum-poisson" or
  "cusum-bernoulli", `ward`, `phenotype` or `organism` (and `antibiotic`)
  set for D2's matcher, kind cluster. `p` = 1 / A_i(S_t), A_i Siegmund's run
  length in days for this series on today's baseline (foundation), so the
  filter p < level means "in-control run length above 1/level days", one
  false-alarm rate for busy and quiet series alike. Levels: per-series run
  length L ∈ {1, 3, 10, 30, 100, 300, 1000, 3000, 10000} years, p =
  1 / (365.25 L); pooled episodes a year are about m / L (derived), so 5 a
  year is L ≈ 95.
- Causal: day t uses rows dated up to t, baselines rows up to t − 7g − u;
  `focus` restricts series and signals to the trial while the recursion
  runs from the data start, so focused and full signals agree (asserted
  on three trials); `check_causal` on 2025-03-31, 2025-12-31, 2026-06-30.

**Grid.** Poisson: θ ∈ {2.5, 4, 8} × {daily, weekly} × g ∈ {0, 4} weeks, 12
settings; Bernoulli: θ ∈ {2.5, 4, 8} × g ∈ {0, 4}, 6. S_b = 26, k = 0.1,
M = 30 fixed; all proposed (overnight), pending Artem. θ = 2.5 is C5's
proposal, 4 and 8 match bursts of 4 to 6 in quiet series; θ = 1.5, the
drip, is left out because no harness family can score it.

**Choosing settings on year 1 only** (`tune_curve`, as 0015): 40 rare and
40 common ESBL clusters of k = 4, seed 2026, starts 2024-04-01 to
2024-08-15, noise over 2024-04-01 to 2024-09-30 scaled to a year. Per part,
each setting's loosest level with noise at most 5 a year; the highest rare
rate wins (ties: common ESBL rate, fewer episodes, smaller θ). The two
winners together are the method ("union", shared L), `tuned_on_test` false,
`tuned_on` "2023-10-02..2024-09-30".

**Calibrating the operating level two ways, on year 1.** (a) Siegmund:
equal run lengths over m series at 5 a year give L_S = m / 5 years; each
series' limit solves A_i(h_i) = L_S. (b) Simulation: fit the in-control
model to year 1 (rates λ_i, ν_i, p_i, shrunk as above; independent Poisson
counts and Bernoulli outcomes), simulate 200 panels of 3 years (numpy
`default_rng(2026)`), run the same statistic code, estimation included,
count fixed-key episodes (`group_signals`, `fixed_key`) over the last 2.4
years at every L, interpolate log episodes on log L to 5 a year: L_sim, the
operating level. Beside it: L_S, the L where real year-1 noise scales to 5
a year, and real against simulated episodes at L_sim (departure from
independence). **Common-limit ablation** (the brief's p = exp(−S_t)): the
chosen setting with one h for all series, h ∈ {3, 4, 5, 6, 7, 8, 9, 10, 12},
calibrated the same two ways; D2, D4, D5 only.

**Seeds, baselines, metrics.** Seed 2026 only: the union gets 200 trials
per cell from one `mulberry32(2026)` stream as the harness draws them; each
part alone and the ablation 100 per cell (another stream, wider intervals).
Seeds 2027 to 2030 are held out, never used. Baseline rows
(benchmarks/overnight-2026-10-17/baselines/): `live-set-retuned-year1`, the
reference, and `live-set-shipped`, `tuned-on-test`. Through `score_detector`:
D1, D2 with delay (five families, k = 0, 2, 3, 4, 6), D4, D5, D6 on the
gaps (no data signals, so D3 is left out), D7, I1; Wilson 95 % per cell,
exact Poisson interval for D4.

**Budget.** 10 minutes of CPU (`aei.harness.Clock`), informational.
Estimate about 6 minutes (assumed): a trial is the harness's cut and insert
plus the first-isolate pass, at 0011's 19 ms (computed, 0011): 15,140 trials
(union 5,000 + 1,200 gap, parts 2 × 2,500, ablation 2,500, selection
18 × 80) × 20 ms ≈ 300 s, plus about 50 s for full runs, simulation and
causal cuts. Cut in this order, recorded under "Deviations from plan": the
ablation; parts to 50 trials; weekly resolution; 100 panels; g = 0; gaps.

**Command and outputs.**

    uv run python experiments/0016-cusum/run.py

writes `out/results.md`, `out/metrics.json` (union at L_sim, through
`aei.harness.write_metrics`, `D5_curve` at top level), `metrics-poisson`,
`metrics-bernoulli`, `metrics-common-limit` `.json`, `out/grid.json` (year-1
rows of 18 settings) and `out/figure.png`. numpy, scipy, pandas only; the
statistic is `cusum.py` beside `run.py` (reusable: to `libs/utils/py/aei`
with tests if Artem keeps it). No new dependency.

## Mathematical foundation

**Statistic.** A one-sided CUSUM (Page 1954) adds the log-likelihood ratio
x_t of "shifted by θ" against "as baseline" and resets at zero: S_t =
max(0, S_(t−1) + x_t), alarm S_t > h. Poisson, baseline λ per period, shift
to θλ: x = y ln θ − (θ − 1) λ. Bernoulli, baseline p, shift to odds
θ · p / (1 − p): x = r ln θ − n ln(1 + (θ − 1) p). Dividing by ln θ gives
ENGINE.md's S + y − k_ref, k_ref = (θ − 1) λ / ln θ (Lucas 1985). Under the
baseline E x = −λ (θ − 1 − ln θ) < 0, so S sits near 0; an event adds ln θ,
a period drains (θ − 1) λ, so n events lift S by at most n ln θ. S_t = C_t −
min_(j ≤ t) C_j, C the cumulative sum of x (Lindley), so all series and
days come from one cumulative sum and one running minimum.

**Run length.** For log-likelihood-ratio increments E_0 e^x = 1, so the
Lundberg root is ω = 1. Lorden (1971): ARL0 ≥ e^h for a known predictable
baseline, a conservative anchor. Siegmund (1985, corrected diffusion): A ≈
(e^b − b − 1) / |μ|, b = h + 1.166 σ, μ = E_0 x, σ² = Var_0 x per period
(Poisson: |μ| = λ (θ − 1 − ln θ), σ² = λ (ln θ)²; Bernoulli per isolate:
|μ| = ln(1 + (θ − 1) p) − p ln θ, σ² = p (1 − p) (ln θ)², scaled by the
unit's isolates a day). The 1.166 is normal-theory overshoot; counts are
lattice and a sparse series overshoots by about ln θ / 2, so A should err
low there, the safe side (derived; the simulation is the arbiter, because
the formula ignores the estimated baseline, shrinkage and the episode
merge; 200 panels give about 2,400 episodes at the target, a Poisson error
near 2 %). The p of the signals is the formula read backwards: the run
length at which today's S sits on the limit. It is a monotone score, not a
probability: Ville's inequality bounds a likelihood ratio from a fixed
start, not a maximum over starts, so there is no p-value and no
Benjamini-Hochberg step.

**Assumptions and where it breaks.** (1) Independent draws given the
baseline: repeat cultures are removed by the first-isolate rule;
overdispersion or a weekday or seasonal pattern would raise real false
alarms above simulated (the model check measures it), but the synthetic
data has none (0002's review, measured), so the grid says less about real
data than it appears to. (2) A known baseline: a few events in a quiet
series make λ̂ noisy and shorten ARL0 (Jensen et al. 2006); the simulation
includes it, the formula does not. (3) A trend in the baseline:
the trailing mean lags a rise and S climbs; the guard band stops a growing
outbreak raising its own baseline (Farrington et al. 1996), as in E1's
weekly counts 0, 0, 1, 5, 5, 6, 6, 5 (measured). (4) No reset: S lingers,
long in sparse series (θ = 2.5, 0.1 events a week drains 0.15 a week, so an
event takes 6 weeks); the fixed key makes a run one episode, D2 suffers as
stated. (5) Optimality (Moustakides 1986) needs the real shift to be θ; a
burst of 4 is a shift of 5 to 40 by unit, a drip 1.5 to 2, and the chosen θ
is tuned to bursts of 4.

**References.** Page 1954 (Biometrika); Lorden 1971 (Ann. Math. Statist.);
Siegmund 1985 (Sequential Analysis); Lucas 1985 (Technometrics);
Moustakides 1986 (Ann. Statist.); Reynolds and Stoumbos 1999 (J. Quality
Technology); Hawkins and Olwell 1998 (Cumulative Sum Charts); Jensen,
Jones-Farmer, Champ and Woodall 2006 (J. Quality Technology).

## Why this method here

- ENGINE.md 3.3 proposes it for what a window cannot see: three weeks of
  one case each in the ICU, every week under the weekly test's y ≥ 2 filter,
  add 3 ln θ with little drain. 0007 and 0011 scored the windows on bursts
  only (rare clones of 4 in 95 %, common ESBL *E. coli* in 55 %, computed);
  this scores the CUSUM on the same bursts, where no advantage is expected,
  and names the test of its purpose: one case a week for 8 weeks, next.
- QUESTIONS C5 asks for θ and h; one run length in years replaces a
  hand-set alpha per test (0002's review: alphas chosen while looking at
  E1 to E4), and the never-zero baseline addresses 0002's other episodes,
  which fell where the baseline was short.
- For the researcher: a card shows the running sum and its start, the last
  day S was 0 (Page's estimate of when the change began, which windowed
  tests lack), and "one false alarm per about 95 years per series". For the
  doctor: nothing directly (B7 annotates the list).

## Proposed visualisation

One card of the researcher's signal feed (OBJECTIVES.md: signal feed
first), light mode, for E1: URO, ESBL, as of 2025-06-15, 30 weeks
(2025-03 to 2025-09), two panels on one date axis.

- Header: "ESBL · Urologia / Urology — kertymä S, raja h / sum S, limit h",
  S and h the alert's fields (the sketch prints the real ones).
- Top, bars: weekly new patients (grey, count above each bar), a step line
  for the baseline's weekly expectation ("odotettu / expected") with a band
  at its 2.5th to 97.5th Poisson percentile; the guard band hatched under
  the axis.
- Bottom: S_t as a line (axis "kertymä, ln-uskottavuus / evidence, log
  likelihood ratio") with a band from re-running S at the baseline rate's
  2.5th and 97.5th Gamma percentile (the baseline's own uncertainty, which
  the plain chart ignores); the limit a dashed line; alarm days filled
  squares; the run's start a rule "alkoi / began"; E1's onset 2025-05-30
  dotted; the as-of date a solid rule at the right edge.
- Footer: "θ · vertailu 26 vk, suojaväli g vk / baseline 26 wk, guard g wk
  · väärä hälytys kerran ~L v / one false alarm in ~L yr", all fields of the
  signal. Height carries counts, bands uncertainty, hatching the guard band,
  squares the alarms; colour carries nothing alone. Labels bilingual,
  Finnish first; unit names from `wards.csv`.

The sketch `out/figure.png` draws it from the chosen setting.

## Result

`uv run python experiments/0016-cusum/run.py` ran in 77 s wall and 71 s of CPU
(measured; budget 10 minutes, estimate about 6 minutes, assumed in the plan).
No cut was made. A trial cost about 3 ms, not 20 ms (computed: about 20,000
trials, 15,140 planned plus 5,000 for the delay-0 table, in about 60 s of the
71), because the statistic is a cumulative sum and a running minimum on
arrays of the real data and a trial only adds its rows. Seed 2026 only, 200
trials per cell for the union, 100 for the parts and the ablation; seeds 2027
to 2030 not used. Everything below is measured or computed by that run;
`out/results.md` has every table, `out/metrics.json` the union.

**Settings chosen on year 1 (measured, 40 + 40 injected clusters, 2024-04-01
to 2024-08-15, noise 2024-04-01 to 2024-09-30).** Poisson: theta 8, weekly,
no guard band (rare 14/40, common ESBL 15/40 at L = 100 years, 2 episodes in
the half year); Bernoulli: theta 8, guard band 4 weeks (19/40 and 21/40 at
L = 100, 2 episodes). The C5 proposal theta = 2.5 ranked 6th, 10th, 11th and
12th of 12 for the Poisson part (rare 4/40 at best) and 2nd (guard band 4
weeks, 13/40) and 6th of 6 (4/40) for the Bernoulli part. At every
resolution and guard band theta = 8 beats theta = 2.5 on the rare count
(Poisson 9 against 4, 14 against 0, 14 against 0, 8 against 0; Bernoulli 9
against 4, 19 against 13).

**Calibration on year 1 (computed).** Active series 199 + 198 = 397
(not 477), so Siegmund's equal run length is L_S = 79.4 years; the simulation
(200 panels, 480 panel-years) gives L_sim = 72.1 years, L_sim / L_S = 0.91,
the operating level. For the common limit h_S = 7.25, h_sim = 7.11.

| L (years) | Siegmund m / L | simulated, a year | real year 1 (count) | real scoring period (count) |
|---|---|---|---|---|
| 10 | 39.7 | 42.8 | 47.9 (24) | 50.2 (100) |
| 30 | 13.2 | 11.2 | 18.0 (9) | 7.0 (14) |
| 72.1 (L_sim) | 5.5 | 5.0 | 10.0 (interpolated) | 3.5 (7) |
| 100 | 4.0 | 3.7 | 8.0 (4) | 2.0 (4) |

Siegmund's approximation is within 20 % of the simulation from L = 10 to
3,000 years and too high below (397 against 156 a year at L = 1, 132 against
96 at L = 3: the 28-day merge caps the episode count). Real year-1 episodes
are 1.1 to 2.2 times the simulated at L = 10 to 100; real scoring-period
episodes (zones excluded) are 1.0 to 1.2 times at L of 1 to 10 and 0.5 to 0.9
at L of 30 to 300, on 2 to 100 episodes, so no consistent overdispersion
shows.

**D5 at about 5 episodes a year (k = 4; Wilson 95 %).**

| row | level | noise a year (episodes) | rare | delay | common ESBL | delay |
|---|---|---|---|---|---|---|
| union (0016) | L = 72.1 years | 3.52 (7) | 0.665 [0.597, 0.727] | 7 | 0.485 [0.417, 0.554] | 6 |
| live re-tuned year 1 (reference) | 0.3 x alphas | 3.01 (6) | 0.920 [0.874, 0.950] | 6 | 0.750 [0.686, 0.805] | 6 |
| live shipped (tuned on test) | 3 x alphas | 3.01 (6) | 0.920 [0.874, 0.950] | 6 | 0.750 [0.686, 0.805] | 6 |

Along the curve the union reaches rare 0.765 and common ESBL 0.690 at 7.0
episodes a year (L = 30), 0.890 and 0.800 at 50 (L = 10); the reference
reaches 0.980 and 0.880 at 6.0. The intervals at the headline do not overlap.

**D2 at k = 3 and 4, with median delay in days (union / re-tuned / shipped).**

| family | k = 3 | k = 4 |
|---|---|---|
| rare | 0.345 (8 d) / 0.860 (7) / 0.615 (7) | 0.665 (7) / 0.980 (5) / 0.890 (6) |
| common resistant | 0.025 (8) / 0.020 (8) / 0.005 (23) | 0.040 (5) / 0.010 (6) / 0.005 (25) |
| wild type | 0.025 (0) / 0.005 (0) / 0.000 (-) | 0.025 (0) / 0.000 (-) / 0.000 (-) |
| common ESBL | 0.230 (7) / 0.700 (6) / 0.345 (8) | 0.485 (6) / 0.880 (6) / 0.610 (7) |
| two unit | 0.130 (8) / 0.475 (4) / 0.210 (3) | 0.190 (7) / 0.565 (7) / 0.240 (3) |

Intervals for every cell are in `out/results.md` (union k = 4: rare [0.597,
0.727], common resistant [0.020, 0.077], wild type [0.011, 0.057], common ESBL
[0.417, 0.554], two unit [0.142, 0.250]). Controls (k = 0): 0.005 to 0.035
for the union, 0.000 to 0.075 for the references.

**D4 by kind, D6, D7, I1, D1 (union / re-tuned / shipped).** D4 episodes a
year over 2024-10-01 to 2026-09-27: all 3.52 [1.41, 7.25] / 9.55 / 4.52,
cluster 3.52 / 4.52 / 1.00, sentinel 0 / 1.51 / 1.51, data 0 / 3.52 / 2.01 (the
union raises no data or sentinel signals), 0.067 alerts a week. D6 0.071
[0.057, 0.089] / 0.026 / 0.012 (the lingering runs raise cluster signals in
gap weeks more often). D7 0.999 / 0.987 / 0.974. I1 16 alerts in 9
incidents (1.78 a incident) / 29 in 26 / 18 in 15. D1 (demonstration): E1 4
days (corrected onset 9), E2 4 days, E3 and E4 not found (data and trend
kinds, not this method's).

**Parts and the ablation (100 trials per cell, D5 headline).** Poisson part
alone: 2.51 a year, rare 0.460 [0.366, 0.557], common ESBL 0.180 [0.117,
0.267]. Bernoulli part alone: 4.52 a year, rare 0.660 [0.563, 0.745], common
ESBL 0.570 [0.472, 0.663]. Union with one common limit (h = 7, p = exp(-S)):
4.52 a year, rare 0.670 [0.573, 0.754], common ESBL 0.580 [0.482, 0.672]; its
operating limit h_sim = 7.11 gives 3.01 a year. Where the union's detections
come from at k = 4 (200 trials): rare 133 detected, 10 by the Poisson part
only, 70 by the Bernoulli part only, 53 by both; common ESBL 97, 6, 66, 25. A
detection at delay 0, which a run begun before the start would give, is 2 of
133 (rare) and 4 of 97 (common ESBL); at most 7 of 200 in any cell.

**Checks (all passed).** `check_causal` on 2025-03-31, 2025-12-31 and
2026-06-30 on the detector built from the rows it is given: no differences.
The trial fast path against that from-scratch computation: 96 trials, 1,638
signals, no differences (p equal). Focused against full signals on the real
data: 3 cases, 160 signals, no mismatch. The vectorised statistic against
loops from the definition on three Poisson and two Bernoulli series: largest
difference in S 9e-14. The slow fallback was used 0 times in 20,263 runs.

**Deviations from plan.**

- Floors where "never zero" does not hold: the weekly baseline rate is at
  least 0.001 events, the proportion is clipped to [0.001, 0.999], the
  arrival rate in the run length is at least 0.001 a week.
- Hospital totals for the shrinkage prior are read from the real data's
  cumulative arrays, only up to the last row's date; injected rows are added
  to them (exact); removed rows of a gap trial are taken out without
  re-flagging a patient's later isolate as a first one (the check against
  the from-scratch computation, which includes gap trials, found no
  difference).
- m is the active series (199 + 198 = 397), not the plan's upper bound 477, so
  L_S is 79.4 years, not 95; the simulation uses the same 397 series.
- The sweep levels include L_S, L_sim and the run length at which real year-1
  noise reaches 5 a year (512 years), as extra rows of the D5 curve.
- The picture shows 30 weeks ending at the as-of date 2025-06-15 (the plan
  also said 2025-03 to 2025-09, which cannot both hold), for the Poisson
  part's URO ESBL series at the chosen setting (weekly, theta 8, no guard
  band, so no hatched strip); the union's first E1 alarm (2025-06-08, 4 days
  after 0002's start) came from the Bernoulli part, the card's own alarm is
  dated the as-of day.
- No run length was cut; trial counts, grid and panels are as planned.

## Interpretation

Against METRICS.md "Decision rules" the CUSUM does not reach the live set on
the headline: at about 3 to 3.5 episodes a year the rare family is 0.665
against 0.920 and the common ESBL family 0.485 against 0.750, intervals
apart. In the rare, common ESBL and two-unit families every D2 cell from
k = 3 up is below the reference, and below the shipped row too (the two-unit
k = 4 gap, 0.190 against 0.240, is inside the intervals). In the two families
no count test can see it is no better: common resistant and wild type at k = 4
are 0.040 and 0.025 (live 0.01 and 0.00; the upper bound for common resistant
is 0.077). Delays are within 3 days of the reference (7 and 6 against 5 and
6). Its D4 noise is lower (3.52 a year all kinds against 9.55 and 4.52) only
because it raises no data or sentinel signals, which is a coverage gap, not a
gain. This is screening, not selection: one seed, held-out seeds unused, not
a winner in its family.

Hypotheses (exploratory, as written in the plan). (1) Held for theta and failed
in detail: both parts chose theta = 8, not 2.5, but "theta = 8 cannot see
k = 3" is wrong, 0.345 of rare clusters of 3 were caught (the limit is per
series and lower in quiet ones, and the Bernoulli part was in 65 of the 69
detections). (2) Half held: the
common ESBL rate is below 0.75 as predicted; the rare rate, expected 0.75 to
0.95, is 0.665 [0.597, 0.727] and below the range. (3) Held: common resistant
0.040 and wild type 0.025 at k = 4 (point values; the interval for common
resistant reaches 0.077), delay within 3 days. Whether equal run lengths pay:
no difference at this size, the common-limit ablation reaches 0.670 and
0.580 at 4.52 a year, the union about 0.7 and 0.55 at that noise by
interpolating its curve (derived, between L = 30 and L = 72; the ablation
has 100 trials per cell). Bernoulli against Poisson: at equal noise the
Bernoulli part is far ahead (0.570 against 0.180 for common ESBL at 4.5 and
2.5 a year); the plan made no prediction for the parts.

The calibration is the part that worked. Siegmund's formula with equal run
lengths put the 5-a-year level at 79 years and the simulation at 72 (0.91),
and the real scoring period then gave 3.5 episodes a year at the simulated
level, under the target: the approximation is usable from L = 10 years up,
and the 28-day episode merge, not the formula, caps the count at short run
lengths. Real year-1 noise was above the simulation (up to 2.2 times) and the
scoring period below it from L = 30 up (0.5 to 0.9), on 2 to 14 episodes
there, so no overdispersion is established; year 1's shorter baselines and
over-counted first isolates are the likelier reason for its excess.

Strongest alternative explanation of the gap to the live set: information, not
the CUSUM. The live profile-excess test sees the exact 13-drug profile, whose
expected count for a rare clone is near zero; the CUSUMs here see a
phenotype, an organism with a specimen, or one drug as R or not. The Bernoulli
part, closest to profile information, carries 123 of the 133 rare k = 4
detections, and the plan named profile series as the extension and did not
run it. Second, the setting choice rests on 2 to 4 year-1 episodes and 40 + 40
trials, with ties (theta 8 daily with a guard band scored 14/40 and 14/40
as well), so the choice among the theta = 8 settings is within noise. Third,
the D5 headline sits at different grid points and noise (3.52 against
3.01), which cannot explain 0.665 against 0.920.

Next. (1) The experiment the plan names: a drip family, one case a week for 8
weeks in a unit, injected like the others and scored on the same
curve, since this run scored only bursts. (2) A CUSUM on profile series (unit
x organism x specimen x profile) or on the per-isolate likelihood of the exact
profile against the unit's history, to test the information explanation. (3)
Combine with the live tests (method 21): the CUSUM's lower noise and the
live tests' sensitivity may stack, and the two-unit family (0.19 against
0.565 at k = 4) argues for the live set's side. (4) QUESTIONS C5: this table
says theta of 8, not 2.5, for bursts of 4, and a per-series run length of
about 70 years (h near 7 for one common limit), to be re-checked on a drip
family before it answers C5; nothing here changes the live tool.

## Held-out re-score (orchestrator's request, after close)

Requested by Artem's addendum: before a method is named best in its family in the report, re-score it on injection
seeds that no experiment used. Run: `uv run python experiments/0016-cusum/heldout.py` (new file; run.py and everything
above this heading are unchanged). CPU time 16.3 s (computed; wall 16.4 s; budget 10 minutes, no family, cell or trial
was cut). Seeds 2027, 2028, 2029, 2030 (the held-out seeds of `aei.score_detection.confirm`), 50 trials per seed, 200
per cell, same levels as the screening. Nothing was re-chosen: the Poisson setting (theta 8, weekly, no guard band), the
Bernoulli setting (theta 8, guard band 4 weeks) and the operating run length (L = 72.0682 years, p = 3.79897e-05) are
read from `out/metrics.json`, the sweep levels from `out/grid.json`, and the detector is built as run.py builds the union.
The live-set rows are the `_heldout` keys of `benchmarks/overnight-2026-10-17/baselines/live-set-retuned-year1.json` and
`live-set-shipped.json` (the same seeds and trials). Outputs: `out/heldout.json` (metrics, intervals, n, per-seed D2 and
the D5 curve), `out/heldout.md` (the tables below with all five families, k = 3 and 4, and Wilson intervals). Every
number below is computed by that run or read from the files named; intervals are Wilson 95 %.

**D5 at about 3 to 3.5 episodes a year, k = 4 (computed).** The noise a year comes from the real data, not from the
seeds, so it is the same in both columns (3.52, 7 episodes for the union; 3.01, 6 for the live rows).

| row | rare, screening (seed 2026) | rare, held-out | common ESBL, screening | common ESBL, held-out |
|---|---|---|---|---|
| union (0016), L = 72.1 years | 0.665 [0.597, 0.727] | 0.660 [0.592, 0.722] | 0.485 [0.417, 0.554] | 0.435 [0.368, 0.504] |
| live re-tuned year 1 (0.3 x alphas) | 0.920 [0.874, 0.950] | 0.940 [0.898, 0.965] | 0.750 [0.686, 0.805] | 0.695 [0.628, 0.755] |
| live shipped (3 x alphas) | 0.920 [0.874, 0.950] | 0.940 [0.898, 0.965] | 0.750 [0.686, 0.805] | 0.695 [0.628, 0.755] |

Median delay in days, screening / held-out (computed): union rare 7 / 7, common ESBL 6 / 7; live rows rare 6 / 5,
common ESBL 6 / 7.

**D2 at k = 3 and 4, rate (computed), screening / held-out; the re-tuned and shipped rows are each at their own level.**

| family, k | union (0016) | live re-tuned | live shipped |
|---|---|---|---|
| rare, 3 | 0.345 / 0.400 | 0.860 / 0.885 | 0.615 / 0.680 |
| rare, 4 | 0.665 / 0.660 | 0.980 / 0.970 | 0.890 / 0.890 |
| common resistant, 3 | 0.025 / 0.030 | 0.020 / 0.030 | 0.005 / 0.005 |
| common resistant, 4 | 0.040 / 0.010 | 0.010 / 0.000 | 0.005 / 0.000 |
| wild type, 3 | 0.025 / 0.000 | 0.005 / 0.010 | 0.000 / 0.000 |
| wild type, 4 | 0.025 / 0.035 | 0.000 / 0.000 | 0.000 / 0.000 |
| common ESBL, 3 | 0.230 / 0.220 | 0.700 / 0.625 | 0.345 / 0.285 |
| common ESBL, 4 | 0.485 / 0.435 | 0.880 / 0.880 | 0.610 / 0.590 |
| two unit, 3 | 0.130 / 0.170 | 0.475 / 0.405 | 0.210 / 0.210 |
| two unit, 4 | 0.190 / 0.225 | 0.565 / 0.555 | 0.240 / 0.285 |

Reading (computed comparisons, not a new test): the headline D5 rates of the union and of the live rows all lie inside
their screening intervals. Of the 10 D2 cells (5 families, k = 3 and 4) per row, 2 held-out union rates lie outside the screening
interval of the same cell (common resistant k = 4: 0.010 against [0.020, 0.077]; wild type k = 3: 0.000 against [0.011,
0.057]), 3 of the re-tuned row (common resistant k = 4, common ESBL k = 3: 0.625 against [0.633, 0.759], two unit k = 3:
0.405 against [0.407, 0.544]) and 2 of the shipped row (rare k = 3: 0.680 just above [0.546, 0.680], common resistant
k = 4), all by under 0.02, so the screening numbers were not a lucky seed for either side. The gap on the headline stays: rare
0.660 against 0.940 and common ESBL 0.435 against 0.695, with the held-out intervals not overlapping. On this evidence the CUSUM union is not best in its family on D5 at this operating level; the
re-tuned live set is, on seed 2026 and on seeds 2027 to 2030.

## Decision numbers (2026-10-17, after close)

This record cites D-038 (the Beta-binomial method) and D-039 (detection on raw
counts) in the numbering of the overnight base. On main those two are D-041 and
D-042; D-038 and D-039 on main are other decisions.
