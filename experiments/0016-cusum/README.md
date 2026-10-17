---
status: proposed    # proposed, then accepted, rejected or superseded
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

## Interpretation
