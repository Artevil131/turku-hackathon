# The engine (draft)

What the tool computes, from the raw laboratory rows to the two screens.
This is a proposal: every choice marked **decision** is open until the
team records it in DECISIONS.md. Formulas are in plain notation. The
background and sources are in research/; the events the engine must find
are in benchmarks/planted-events/.

One sentence: the engine keeps one count table of first isolates as of a
date, turns it into probabilities with pseudo-counts borrowed from the
level above, and tests the same counts against their own past to raise
signals. The doctor reads the probabilities, the researcher reads the
signals, and both come from the same table so they never disagree.

## Status against the codebase (2026-10-17)

Main now carries a working tool built by Aapo's sessions. Where this
draft and the code meet:

| Section here | In the code today | Decision |
|---|---|---|
| 1 table, first-isolate rule, masks | `@aei/counting`, `@aei/eucast`; Python mirrors in `libs/utils/py/aei` | D-023, D-033 |
| 2.1–2.4 Beta-binomial, discount, Dirichlet mix | Not built. The shipped coverage list uses the raw share over 365 days at one level (unit, ward type, hospital) with a Wilson interval; experiments/0004 found blends no better than the hospital year | D-041 accepted the method; the overnight experiments test it (benchmarks/METRICS.md C1, C6) before it replaces D-023/D-033 |
| 2.6 ranking | `@aei/coverage` `suggest`: thresholds 80/90, Access first, spectrum basis for mild, pairs for severe | D-026 to D-028, D-033 |
| 3.1 data-quality | sampling-drop and empty-run detectors | D-020, D-031 |
| 3.2 sentinel rules | CPE isolate; MRSA or VRE new in an inpatient unit after 180 days | D-014, D-021, D-034 |
| 3.3 cluster test | profile excess and phenotype excess, Poisson, 365-day baseline, per-test alpha, no guard band, no multiplicity control | D-020 (provisional) |
| 3.4 trend | Cochran-Armitage hospital-wide, alpha 0.001 | D-020 |
| 3.6 naming | alerts carry a detector name and a template explanation; the five kinds are not yet a field | D-019, D-029 |
| 4 network | patient flow and phenotype trail (`@aei/relations`); exposure not built | D-009, D-011 to D-013 |
| 4 counties | THL series and a Farrington-style monthly test (`aei.regional`), served by `/api/regional` | D-025, D-037 |
| 5 replay | the API's replay clock; experiments 0004, 0007, 0010 are the backtests | D-005 |

## 0. Notation

| Symbol | Meaning |
|---|---|
| t | the clock date; nothing after t is visible |
| i | a unit (ward or health centre); later also a hospital or a county |
| o | an organism, one of nine species |
| d | an antibiotic, one of thirteen |
| x | what the doctor knows: unit, specimen, sex, age band, onset (hospital-acquired or not), optional organism, optional prior findings |
| n, s, r | isolates tested, susceptible, resistant in a cell |
| S | susceptible, R resistant, flag ∈ {ESBL, MRSA, VRE, CPE} |

### Beta, Beta-binomial, Gamma, negative binomial

| Belief about | Distribution of the unknown | Count it predicts |
|---|---|---|
| a proportion p in [0, 1] (share susceptible) | Beta(a, b) | Beta-binomial: successes in the next n draws |
| a rate λ (cases per week) | Gamma(shape, rate) | negative binomial: cases in the next period |

"Beta-binomial model" names the whole method: binomial counts with a
Beta prior, updated by adding counts. The Beta is what we maintain and
show; the Beta-binomial is what we check predictions against in replay.
Accepted as the estimation method in DECISIONS.md D-003.

## 1. The one table everything reads from

**Input rows.** Cultures (date, unit, specimen, patient, admission date),
isolates (organism, flags), susceptibility results (S/R per drug,
guideline version), patients (sex, birth year).

**As-of filter.** Keep rows with sample date ≤ t. In a replay t advances
one day at a time. The same function will later receive rows from the
laboratory system instead.

**First-isolate rule.** Within a lookback window ending at t, keep the
first isolate per (patient, organism, specimen). Every level of the
hierarchy uses the same rule and the same lookback, so counts add up
across levels. **Decision:** the lookback (candidates: the display
window itself, or a fixed 365 days).

**Onset.** Hospital-acquired if the sample was taken on day 3 of the stay
or later (sample date − admission date ≥ 2), else community. Matches the
dataset README; GLASS uses "more than two calendar days", which is the
same cutoff. Outpatient units are always community.

**Masks.** Intrinsically resistant (organism, drug) pairs are removed
before counting and never shown as data (EUCAST Expected Resistant
Phenotypes). Drugs reported only for urine are counted only for urine.
A (organism, drug) cell where fewer than 85% of that organism's isolates
were tested is flagged as selectively tested.

**Output: the count table.** For every (unit, specimen, onset, sex, age
band, organism, drug) and every window: n, s, r. Plus per
(unit, organism, flag, week): the isolate count, used by detection. Plus
per (unit, week): cultures taken, positives, patients, guideline
versions, used by the data-quality checks.

## 2. From counts to probabilities (the doctor's side)

### 2.1 One proportion with borrowed strength

For a cell with n isolates, s susceptible, and a parent proportion p0
from the level above:

```
p | data  ~  Beta( M·p0 + s ,  M·(1 − p0) + r )

mean       E[p] = (M·p0 + s) / (M + n)  =  w · s/n  +  (1 − w) · p0
weight     w    = n / (n + M)
variance   Var  ≈ E[p]·(1 − E[p]) / (M + n + 1)
interval   5th and 95th percentiles of the Beta
```

M is the prior strength in pseudo-isolates. w is the share of the
estimate that comes from the cell's own data, and it is shown to the
user as the certainty badge.

**The parent p0 is always from the same specimen and onset**, one level
up, over a period that does not overlap the cell's own window:

```
ward, last 4 weeks     ← parent: hospital, same specimen and onset, preceding 12 months
ward, last 12 months   ← parent: hospital, same specimen and onset, 12 months
hospital               ← parent: Finres national figure for the same organism, drug, specimen (where it exists), strength M_ext; otherwise Jeffreys Beta(0.5, 0.5)
```

Using the preceding period for the parent avoids counting the recent
isolates twice. **Decision:** M (candidate 30, so that w = 0.5 exactly at
the 30-isolate rule) and M_ext (candidate 30).

### 2.2 Recency: the discounted Beta-binomial

The true susceptibility drifts, so old isolates should count for less.
Keep the two Beta parameters per cell and, each week, discount them
before adding the week's counts, with the hospital prior as a floor
they relax toward:

```
a_t = δ·a_{t−1} + s_t + (1 − δ)·M·p0
b_t = δ·b_{t−1} + r_t + (1 − δ)·M·(1 − p0)

E[p] = a_t / (a_t + b_t)
effective own count   n_eff = (a_t + b_t) − M
own-data weight       w = n_eff / (n_eff + M)
```

An isolate k weeks old weighs δ^k. This is the exact conjugate filter
for a log-odds that follows a random walk (West and Harrison), so it is
the Beta-binomial for a drifting proportion, not an approximation. The
four-week and twelve-month figures are then not two estimators but one
estimator plus two displayed facts: the raw isolate counts in the last
28 and 365 days are shown beside the probability so a decayed 28 is
never mistaken for 28 recent isolates.

Detection (section 3) never uses the filtered values; it works on raw
weekly counts, because smoothing hides the jump it looks for.

**Decision:** δ per week (proposal 0.95 for organism × drug cells,
half-life about 13 weeks; 0.90 for flags such as ESBL, half-life about
7 weeks). Alternative if the team prefers the brief's literal windows:
hard 28-day and 365-day windows with the parent taken from the
preceding period; simpler, but a cliff at day 365 and slower to react.

### 2.3 Which organism

For the doctor's context x (specimen, onset, unit, sex, age band), the
share of each organism among first isolates in the window:

```
π | data  ~  Dirichlet( M_π · π0 + c )        c = counts per organism in the cell
E[π_o]    = (M_π · π0_o + c_o) / (M_π + N)
```

π0 is the hospital's organism mix for the same specimen and onset over
the preceding 12 months. **Decision:** M_π (candidate 30). If the doctor
enters a suspected organism, π becomes 1 on that organism.

### 2.4 Probability that a drug works

```
coverage_d = Σ_o  E[π_o] · E[p_o,d]

Var(coverage_d) = Σ_o ( E[π_o]² + Var(π_o) ) · Var(p_o,d)
                + Σ_o E[π_o] · ( E[p_o,d] − coverage_d )²  / (M_π + N + 1)
```

The second term is uncertainty about which organism it is; it vanishes
for a drug that works equally on all organisms. Report the mean and a
90% interval from a Beta matched to these moments. Monte Carlo (2,000
draws) is used only where the interval needs to be exact.

Combination regimens: the probability that at least one of two drugs
works is counted directly per isolate (max of the two results) and put
through 2.1, never computed as 1 − (1 − p1)(1 − p2), because resistances
travel together.

### 2.5 Patient-specific adjustments

Rules, not fitted:

- An earlier isolate of this patient with ESBL, MRSA, VRE or CPE: the
  drugs that phenotype defeats are flagged "prior finding" and their
  coverage shown with the flag; the ranking moves them below any drug
  not affected. **Decision:** whether to also lower the number, and how.
- An active cluster alert (section 3) in this unit or in a unit that
  sends it many patients: the affected organism's share and the
  affected drugs' coverage are shown with the alert, and the exposure
  score (section 4) is displayed. **Decision:** whether the exposure
  changes the number or only annotates it. Proposal for the first
  version: annotate only.

Later, if the team wants covariates jointly: logistic regression per
(organism, drug) with sex, age, onset, prior finding, and a random
effect per unit, fitted only for cells with 40 or more resistant
isolates. Not in the first version.

### 2.6 The ranked list

1. Compute coverage, interval and w for every drug not masked for this
   organism set and specimen.
2. Mark drugs whose 10th percentile clears the syndrome threshold τ.
   **Decision:** τ per syndrome (candidates: 0.80 urine community,
   0.90 blood or hospital-acquired).
3. Order: drugs clearing τ first, within them narrow before broad
   (WHO AWaRe tier: Access, Watch, Reserve), within a tier by coverage.
   Then the rest by coverage.
4. Every row shows: coverage %, interval, n isolates behind it, which
   level it came from (ward 4 weeks, ward 12 months, hospital), w as
   "x% own data", date of the newest result, and any flag from 2.5.
5. Never a single recommendation. The screen says it supports the
   decision and names the rules it used.

## 3. From counts to signals (the researcher's side)

Signals are computed on the raw weekly counts from section 1, not on the
shrunk estimates, because shrinkage hides change.

### 3.1 Data-quality checks, run first

Per unit and week, compared with the unit's own trailing 26 weeks:

| Check | Fires when | Effect |
|---|---|---|
| Sampling drop | cultures < 25% of the trailing median | data alert; suppress 3.2 to 3.4 for the unit that week; mark the unit's 4-week figures as incomplete |
| Sampling surge | cultures > 2× trailing median | annotate any count alert with "sampling up" |
| Testing fraction | a drug tested on < 85% of an organism's isolates | mark the cell as selectively tested |
| Guideline change | share of results under a new guideline version jumps | annotate %R changes across all units in that period as possible breakpoint effects |

**Decision:** the thresholds above.

### 3.2 Sentinel rules

Per isolate on arrival, no statistics:

| Rule | Severity |
|---|---|
| any CPE | highest |
| first MRSA or VRE in a unit in 90 days | high |
| first isolate of any flag in the hospital in 365 days | high |
| two or more isolates with the same rare 13-drug profile (background frequency < 1%) in one unit within 14 days | high |

Sentinel alerts bypass every statistical filter. **Decision:** the list
and its day counts.

### 3.3 Cluster test

Per series (unit, organism or flag), per week, count y against the
unit's own baseline:

```
baseline window   the 26 weeks ending 4 weeks before this week (the 4-week gap is the guard band)
baseline counts   C over S weeks, shrunk toward the hospital rate so it is never zero:
                  rate prior Gamma(C + k·r_hosp·S, S + k·S)          k small, e.g. 0.1
predictive        y ~ NegativeBinomial from the Gamma-Poisson
surprise          p = P(Y ≥ y)   and   score = −log10 p
```

Across all series in a week:

1. Drop series that cannot reach significance this week (y ≤ 1, Tarone's
   filter), so the multiple-testing denominator is the active series
   only.
2. Benjamini-Hochberg at level q across the active series.
3. Cap: the alert budget B per week for the whole hospital; if more
   pass, keep the B highest scores and merge connected units (section 4)
   into one cluster alert.

A Poisson CUSUM runs beside it for the slow drip the weekly test misses
(three weeks of one case each in the ICU):

```
S_week = max(0, S_prev + y − k),   k = (θ − 1)/ln θ · baseline,   alarm when S > h
```

**Decision:** baseline length, guard band, q, B, θ, h. Proposal: set them
on the first year of the replay and judge them on years two and three.

### 3.4 Trend test

Per (organism, drug, specimen) at hospital level, monthly: logistic
regression of R on time over the last 24 months; signal if the slope's
95% interval excludes zero and the change over 12 months exceeds 3
percentage points. Report with the yearly proportions and counts.
**Decision:** the 3 points and the 24 months.

### 3.5 Divergence

Per (unit, organism, drug) over 12 months: a funnel plot of the unit's
%R against the hospital's, with limits that widen as n shrinks. Signal
when a unit sits outside the 99.8% limit. Report, do not alert.

### 3.6 Naming the signal

Every signal is one of five kinds by construction, so naming is a
lookup, not a model:

| Kind | From | Name shown |
|---|---|---|
| sentinel | 3.2 | "First CPE in the hospital in 14 months" |
| cluster | 3.3 | "ESBL *E. coli* in Urology: 21 isolates in 4 weeks, usual 1" |
| trend | 3.4 | "Trimethoprim resistance in urinary *E. coli* rising: 15% → 20% over 3 years" |
| divergence | 3.5 | "ICU ciprofloxacin resistance above hospital" |
| data | 3.1 | "Health centre South: no samples week 50" |

Every signal carries: the counts, the baseline, the test, the isolates
behind it, and the suggested first step (isolation and screening,
review guideline, check feed). A language model is not needed to name
or classify; if one is used it writes the prose summary from these
fields and answers questions about them, and it must never see data the
fields do not contain. **Decision:** whether to use one, and where it
runs; with synthetic data this is free, with real data it is a privacy
question.

## 4. The network

**Graph.** Nodes are units. Edge weight from A to B is the number of
patients with a culture in A and then one in B within 30 days, divided
by the number of units that patient visited (so one heavily sampled
patient does not dominate). Significance of an edge by comparing with
rewired graphs that keep every unit's volume. **Decision:** the 30 days
and the rewiring null.

**Exposure.** For unit B at week t:

```
exposure_B(t) = Σ_A  w_{A→B} · active_A(t)  /  Σ_A w_{A→B}
```

where active_A is 1 if A has a cluster alert for the phenotype in the
last 4 weeks, or the alert's score. Shown to the researcher as "units at
risk next" and to the doctor as an annotation (2.5).

**Clustering across units.** Connected sets of units are tested as one
series in 3.3, so two cases in Surgery and two in the ICU can form one
cluster of four.

**Across Finland.** Nodes are the 21 wellbeing counties, edges the five
university-hospital catchment trees. Monthly THL counts of the four
flags become rates per 100,000 and are shrunk along the tree with the
same Gamma-Poisson pseudo-counts as 2.1. Turku's hospital is a point
with its own, sharper estimate. This layer shows pressure around us; it
is a different quantity from %S and is labelled so.

## 5. Proving it

**Replay.** Clock t from the first day of year 2 to the last day. At each
t: build the table, compute every doctor list for the cultures taken on
day t, run detection. Year 1 is warm-up and tuning.

**Doctor.** For each culture on day t, the drugs' coverage before the
result, then the actual S/R. Metrics: Brier score, calibration slope,
share of episodes where the top-ranked drug was susceptible. Baselines
to beat: the hospital's 12-month antibiogram with no ward and no
shrinkage; the raw ward 4-week proportion.

**Researcher.** The four events in benchmarks/planted-events: detected
yes or no, first alert date, delay from onset, and alerts per week over
the whole replay at the same thresholds. Plus injected clusters of 2, 3,
5 and 8 isolates placed at random unit-weeks, for a curve of sensitivity
and delay against alerts per week.

## 6. Where the code goes

```
libs/utils/
  asof/          build the first-isolate table as of t          (section 1)
  estimate/      Beta, Dirichlet, coverage, intervals           (section 2)
  rank/          thresholds, tiers, the list                    (section 2.6)
  detect/        quality checks, sentinel rules, cluster test, CUSUM, trend, funnel  (section 3)
  network/       graph, exposure, rewiring null                 (section 4)
  replay/        the clock and the evaluation loop              (section 5)
apps/web, apps/ios   only call these and draw
benchmarks/          planted events and the alert-volume runs
experiments/         one directory per question below
```

## 7. First experiments

Each one follows PROTOCOL.md: plan committed before the run.

1. **The table.** Build section 1; check that the hospital 12-month
   antibiogram reproduces the organiser's README figures. No hypothesis,
   a correctness check.
2. **M.** Replay years 2 and 3 with M ∈ {10, 30, 100} and windows versus
   decay; compare Brier and calibration against the two baselines.
   Hypothesis: M around 30 beats both baselines on ward-level 4-week
   predictions.
3. **Detection.** Run 3.1 to 3.3 on the full replay; report detection
   dates for E1 to E3 and alerts per week. Hypothesis: all three found
   within 2 weeks of onset at under 2 alerts per week.
4. **Trend.** 3.4 on E4. Hypothesis: both series flagged by mid-2025.
5. **Network.** Does exposure predict where ESBL *E. coli* appears after
   the Urology cluster, against rewired graphs? Exploratory.

## 8. Decisions this draft needs

In the order the code needs them:

1. First-isolate lookback (1).
2. M and M_ext (2.1); the discount δ (2.2); M_π (2.3).
3. τ per syndrome (2.6).
4. Whether prior findings and exposure change numbers or annotate (2.5).
5. Quality thresholds (3.1); sentinel list (3.2); baseline, guard band,
   q, B, θ, h (3.3); trend thresholds (3.4).
6. Edge window and null (4).
7. Language model: yes or no, and where it runs (3.6).
8. Storage for the as-of table (the stack is D-003, D-004, D-024).
