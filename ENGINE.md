# The engine

What the tool computes, from the laboratory rows to the screens, and where
each number appears. Part A is the method that runs today; every rule in it
rests on a DECISIONS.md entry. Part B says where each result is shown,
including every mark on the timeline and distinguishing the earlier
Timeline screen from the now-merged `overnight/design` band. Part C describes
the shipped containers and what a backend port must keep. Part D keeps the
proposals that do not run, with what the experiments measured. Formulas are in plain notation. Numbers are
tagged measured (in the data) or computed (by a run), with the record they
come from; experiments 0012 to 0022 are in experiments/, with the
overnight report in benchmarks/overnight-2026-10-17/.

One sentence: the engine keeps one table of isolates as of a date, gives
the doctor each antibiotic's share of covered first isolates over the last
year, and tests raw counts against their own past to raise signals for the
researcher. Both read the same rows, released one day at a time.

## Status at a glance

| Part | Runs today | Gear (TypeScript) | Route | Decision | Evidence |
|---|---|---|---|---|---|
| A1 table, first isolates, masks | yes | `@aei/counting`, `@aei/eucast` | all | D-023, D-033 | 0001, 0004 |
| A2 doctor's coverage list | yes | `@aei/coverage` | `/api/coverage` | D-023, D-026 to D-028, D-033 | 0004, 0010; overnight C1–C8 |
| A3 signals | yes | `@aei/detect`, `@aei/alerts` | `/api/alerts`, `/api/live` | D-014, D-020 to D-022, D-031, D-034, D-042 | 0002, 0007, 0009, 0011; overnight D1–D7 |
| A4 flows between units | yes | `@aei/relations` | `/api/relations` | D-009, D-011 to D-013 | 0019 |
| A5 counties | yes (computed in Python, served as a file) | `aei.regional` | `/api/regional` | D-025, D-037 | 0008 |
| A1 plausibility checks on lab rows | yes | `@aei/quality` | `/api/quality` | D-038 | — |
| B web app reads alerts and the doctor's list from the server | yes | `libs/utils/contract` | all | D-039 | — |
| B2 timeline, earlier Timeline screen | before the design merge | in the browser, `screens/Timeline/aggregate.ts` | `/api/isolates`, `/api/alerts` | — | — |
| B2 timeline, the design band | yes, merged from `overnight/design` | `@aei/viz` `weeklySeries` | `/api/weekly` | D-042 | — |
| C backend container | yes | `deploy/container` | — | D-040 | — |
| D Beta-binomial, Gamma-Poisson, CUSUM, exposure, forecasts | no | — | — | D-041 accepted the Beta-binomial; D-044 keeps the live method; D-045 ships the county forecast (integration pending) | 0012 to 0022 |

Every gear the app runs has a Python twin in `libs/utils/py/aei` for
analysis; parity tests require identical output (D-030, D-032).

## 0. Notation

| Symbol | Meaning |
|---|---|
| t | the replay date; nothing sampled after t is visible |
| i | a unit (ward, ED or health centre) |
| o, d | an organism (nine species), an antibiotic (thirteen) |
| n, k | isolates with a result, isolates covered (susceptible) |
| y | a count in a window; μ its expected value |

---

# Part A. The method that runs

## A1. The table

- **As of t.** Every number for day t uses rows with sample date ≤ t. A
  result arrives on its culture's sample date (D-005), so delays here
  understate a real laboratory's by its 2 to 3 days of turnaround
  (assumed).
- **First isolate** (`@aei/counting`): within a period, the first isolate
  of each patient × organism × specimen; later ones are dropped. The
  coverage list applies it over its 365-day window. The detectors count
  distinct patients in their own windows instead.
- **Onset**: hospital-acquired when sampled on day 3 of the stay or later
  (sample date − admission date ≥ 2).
- **Masks** (`@aei/eucast`): resistance by nature counts as not covered;
  an organism EUCAST gives no breakpoint for counts as not covered over all
  organisms and is left out "within spectrum"; inferred results (for
  example *S. aureus* β-lactams from cefoxitin) are used; untested
  isolates are left out; urine-only drugs are offered for urine only.
- **Plausibility checks** (`@aei/quality`, D-038): fifteen checks report
  rows that cannot be true (missing links, duplicates, impossible dates)
  and rows to verify (S to an intrinsic resistance, a result without a
  breakpoint, a phenotype on the wrong organism); they never change or drop
  a row. The server runs them on every ingest and over all rows.

## A2. The doctor's coverage list (D-023, D-033)

For a query (unit i, specimen, as of t, optional sex, age group, onset):

```
pool       first isolates of that specimen sampled in [t − 364, t], then the patient filters:
           sex; age group (D-019 table: 0–17, 18–64, 65+, 80+); onset "hospital" (day 3 or later)
level      the unit if its pool has ≥ 30 isolates, else its ward type, else the hospital
           (patient filters are dropped one at a time, age group, then onset, then sex,
           until the filtered unit has ≥ 30, when the unfiltered unit has ≥ 30;
           if the unfiltered unit has < 30, keep them all while widening the level; D-053)
per drug d offered for the specimen, on the chosen level's pool:
  known    isolates with a result (tested, by nature, inferred, or no breakpoint)
  k        those covered (effective result S)
  share    k / known, shown only when known ≥ 30
  interval 95 % Wilson:  ( p + z²/2n ± z·√( p(1−p)/n + z²/4n² ) ) / (1 + z²/n),  z = 1.96
  spectrum the same with no-breakpoint organisms left out (the basis for mild infections, D-027)
  recent   the unit's own counts over the last 28 days, context only (D-023)
```

**Suggestion order** (D-026 to D-028, D-033). Threshold 80 % for mild,
90 % for severe. A drug *clears* when its interval's lower end reaches the
threshold, is *borderline* when its share does, *below* otherwise, and *not
assessable* without 30 results or with over 20 % of the pool untested.
Clearing drugs come first, by share (no WHO AWaRe tier, D-056). Mild leaves out injection-only drugs; vancomycin and clindamycin
are not offered for urine. Pairs, for severe infections
only and only when no single drug clears: covered if either drug covers the
isolate, counted on isolates known for both; the partner must add 2 points;
never two β-lactams or a urine-only drug.

**How well it does** (computed, overnight harness, 2024-10-01 to
2026-09-27): next-28-day Brier 0.1417 against the hospital year's 0.1414
(+0.0003, +0.0001 to +0.0005); the first suggestion's realised next-month
coverage where it clears is 96.6 % mild within spectrum and 95.4 % severe
over all organisms; over all query-months the mild first suggestion covers
75.4 % over all organisms (untested isolates left out in all three).
Harness C7's 90 % predictive count coverage via mid-p PIT is 90.2 % of
blocks, not coverage of a future share by the displayed Wilson interval;
after the Urology outbreak (E1) the urinary ceftriaxone interval leaves its
pre-outbreak value after 47 days.

## A3. Signals for the researcher

All detectors read raw counts, never the estimates (D-042). Profile and
phenotype excess evaluate isolate dates; rising trend evaluates completed
28-day bins. Sampling drop and empty run evaluate daily; sentinels use
isolate sample dates. Each uses only the history up to its evaluation date.

```
profile excess (D-020)       per unit × organism × specimen × 13-drug S/R profile with ≥ 1 acquired R
  y   distinct patients in the unit with that profile in the last 28 days
  μ   patients in the unit with that organism and specimen in the 28 days
      × (profile's isolates hospital-wide + ½) / (all isolates of the organism and specimen + 1),
      both counted over the 365 days before the window (at least 50 isolates)
  signal   y ≥ 3  and  P(Y ≥ y | Poisson(μ)) < 10⁻⁴

phenotype excess (D-020)     per unit × ESBL, MRSA, VRE, CPE
  y   distinct patients with the phenotype in the unit in the last 28 days
  μ   patients in the unit in the 28 days × (unit's isolates with it + ½) / (unit's isolates + 1),
      over the 365 days before (at least 50 isolates)
  signal   y ≥ 2  and  P(Y ≥ y | Poisson(μ)) < 10⁻³

sampling drop (D-020)        per unit
  y   cultures in the last 7 days;  μ = 7 × mean daily cultures over the 56 days before
  signal   P(Y ≤ y | Poisson(μ)) < 10⁻⁴

empty run (D-031)            per unit
  L   consecutive days without a culture;  λ = mean daily cultures over the 56 days before the run
  signal   e^(−λL) < 10⁻³;  a sampling drop within 14 days after it is not raised again

rising trend (D-020, D-022)  hospital-wide, 22 organism–drug pairs
  28-day bins from the start of the data; at each bin end with ≥ 13 bins,
  one-sided Cochran-Armitage test for a rising R share, normal tail,
  signal at p < 10⁻³; isolates of a cluster already detected are left out from that day

CPE (D-014)                  every CPE isolate is an alert on its sample date
new in unit (D-021, D-034)   an MRSA or VRE isolate in an inpatient unit with none there in the 180 days before;
                            no alert during the dataset's first 180 days
```

**From signals to alerts.** Signals of the same detector and key no more
than 28 days apart form one *episode*; each episode is one alert, dated by
its first signal and carrying that signal's y, μ and p. Alerts are grouped
into *incidents* (D-034): same unit, sharing an organism or phenotype (a
phenotype implies its organisms; sampling alerts share one tag), within 28
days of the incident's latest alert. Severity by rule (D-039): high for CPE,
MRSA or VRE new on an inpatient unit, and same-profile clusters; medium for
surges, data gaps and trends; an incident takes its highest.

**Kind** (the five of Part D6, by lookup): profile and phenotype excess
are *cluster*, rising trend *trend*, sampling drop and empty run *data*,
CPE and new in unit *sentinel*. Nothing raises *divergence* today.

**How well it does** (computed, overnight harness, scoring period
2024-10-01 to 2026-09-27; injection seed 2026, 200 trials per cell):

- Planted events (a demonstration, since the thresholds were chosen on
  them): E1 Urology ESBL 5 days from its first isolate, E2 ICU MRSA on its
  first isolate (new in unit), E3 the missing week on its first empty day,
  E4 trimethoprim first signalled 2026-05-10; each named with the right
  kind.
- Noise: 4.5 signal episodes a year (2.1 to 8.6): 1.0 cluster, 1.5
  sentinel, 2.0 data, 0 trend.
- Injected clusters of 4 patients sharing one isolate's copy within 2
  weeks: rare resistant strain 89 % (84 to 93), common ESBL *E. coli* 61 %,
  split across two linked units 24 %, common resistant or fully
  susceptible strains at most 0.5 %. These rates hold for events shaped
  like the injections (identical copies), which favour the profile test.
- The causality the server relies on holds: the full-data run and runs on
  data cut at 2024-12-31, 2025-06-20, 2025-09-15, 2026-03-20 and
  2026-06-30 give identical signals up to each cut (computed with the
  Python mirror, 2026-10-17).

## A4. Between units (D-009, D-011 to D-013)

- **Flow** A → B: a patient's culture in B whose previous culture (by date)
  was in A; counted once per patient per edge in the window (D-011), dated
  by B's culture; all cultures count, negative ones too. The window follows
  the view (D-013).
- **Next units** of A (`nextUnits`): the three strongest flows out of A,
  each with patients and share = patients ÷ sum of A's outgoing flow counts.
  A patient moving from A to two destinations contributes to both edges.
- **Phenotype trail** (D-012): a patient with ESBL, MRSA, VRE or CPE found
  in A and sampled in B within 90 days; `confirmed` when B's sample shows
  it too. Kept per patient, not pushed as alerts (D-022).

## A5. Counties (D-025, D-037)

Monthly THL cases per wellbeing county and report group. For each month
from 2024-01: a Poisson GLM on the 36 months before (intercept, linear
time, one annual harmonic), quasi-Poisson dispersion φ = max(1, χ²/df),
signal when P(Y ≥ y) under a negative binomial with mean μ and variance φμ
is below 10⁻³ and the month has at least 5 cases; `strong` when it also
survives Bonferroni at 0.05 over all series-months tested. Computed in
Python by `scripts/fetch_thl_ttr.py` into `data/external/thl/regional.json`,
served cut at the replay date. Only complete months are released; absent
regional data returns 404.

---

# Part B. Where each number appears

## B1. The doctor's list (`/api/coverage`)

Each row is A2's share, interval, standing, level and counts for one drug;
the four-week figure is A2's `recent` counts. Whether and how to flag "the
four weeks differ from the year" was QUESTIONS B10 (options with costs);
D-044 keeps no such flag yet. The plain-language reliability label every
number should carry remains open (B11).

The web app draws every alert and the doctor's list from the server; no
analysis code is meant to live in `apps/web` (D-039). The earlier Report
screen counted locally using shared gears; the current design names the
coverage basis beside the threshold and labels synthetic-demo data.

## B2. The timeline

Two timeline designs are recorded here. **Before the design merge**, the
Timeline screen (`apps/web/src/screens/Timeline/`) read released isolates
(`/api/isolates` and the live stream) and the server's alerts, and counted
in the browser (`aggregate.ts`):

| Mark | What it is, exactly | Statistical? |
|---|---|---|
| Weekly total | Isolates sampled per ISO week, all units, up to t | No: raw counts |
| Flagged share | Per week, the first isolates (patient × organism × specimen, within that week) carrying any resistance flag, over all first isolates of the week | No: a raw share, no interval |
| Unit lane counts | Isolates per unit per week | No |
| Lane heat | The week's isolates per released day ÷ the 90th percentile of the unit's daily rate over its earlier complete weeks, capped at 1 | No: a display scale, not a test |
| Empty weeks | Complete weeks without a result since the unit's first | No (the empty-run rule, A3, is the test) |
| Signal segments | Each incident from its first to its latest released alert (A3), clipped at t | Yes: A3's alerts, causal |

Two of these were analysis in the browser, which D-039 meant to keep on
the server: `aggregate.ts` re-implemented the first-isolate rule per week
instead of calling `@aei/counting`, and the heat's 90th-percentile scale was
nowhere in DECISIONS.md. These notes describe that earlier screen, not the
current band's counts.

**From `overnight/design`, now merged into main**, the band above every
screen: a weekly stream, one lane per unit, and the alerts as pills, on an
axis that ends at the replay date. The counts come from `/api/weekly`.

| Mark | What it is, exactly | Source | Statistical? |
|---|---|---|---|
| Stacked stream (ESBL, MRSA, VRE, CPE) | Per ISO week (Monday to Sunday) up to t: for each phenotype, the sum over units of the distinct patients sampled in that unit that week with an isolate carrying it | `/api/weekly`, `@aei/viz` `weeklySeries` | No: raw counts (D-042) |
| Cultures line | Cultures sampled per week, all units, on its own scale | same | No |
| Unit lane thickness | That unit's weekly patients, summed over the four phenotypes, one scale for all lanes | same | No |
| Last week, marked partial | The week containing t, counted up to t | same | — |
| Pill "ESBL 7/1.4" | A phenotype-excess alert (A3): 7 patients in the 28 days to the first signal, against μ = 1.4 expected from the unit's past year | `/api/alerts` | Yes: Poisson tail p < 10⁻³ |
| Pill "Profile 5/0.2" | A profile-excess alert: 5 patients with one resistant profile in 28 days, against μ = 0.2 | same | Yes: p < 10⁻⁴ |
| Pill "Samples 39/70" | A sampling-drop alert: 39 cultures in 7 days against 70 expected from the 56 days before | same | Yes: p < 10⁻⁴ |
| Pill "No samples" | An empty-run alert | same | Yes: e^(−λL) < 10⁻³ |
| Pill "Trend ↗" | A rising-trend alert for one organism–drug pair, hospital-wide | same | Yes: p < 10⁻³ |
| Pill "MRSA new", "CPE" | Sentinel rules, no test | same | No: rules |
| Pill "n signals" | Pills that would overlap on a lane, merged; the tooltip lists each | timeline layout | — |
| Readout "surprise" | −log10 p of the alert's test, capped at 6 | `pillLine` | Yes, the same p |
| Pill shape and colour | The alert's kind (A3) | `pillKind` | — |

Reading it right:

- A pill's two numbers are the 28-day window at the alert's first signal;
  the stream under it shows weekly counts, so a "7" on a pill is not a bar
  height, and μ comes from the unit's past year (phenotype) or the
  hospital's share of the profile (profile), not from the drawn weeks.
- The stream adds per-unit counts: a patient sampled in two units in one
  week counts twice, and a patient whose isolate is both ESBL and CPE
  counts in both layers.
- Pills are causal (A3, verified): each is exactly what the detectors
  would have raised with the data up to its date, although the server
  computes them once over the whole history.
- The live set was tuned on the planted events (D-020, METRICS.md); D-044
  keeps it with that qualification, and its sensitivity has the scope given
  in A3. A pill carries its count and its window, not yet a reliability label
  (B11).

## B3. Signal feed and incidents (`/api/alerts`, `/api/live`)

One row per alert, grouped by incident (D-034); the explanation is a
template filled from the alert's fields (D-019), optional model wording
only when asked (D-029).

## B4. Unit graph and county map

- **Unit graph** (research board): edges are A4 flows over the last 28
  days, width linear in patients. A unit with a resistance alert in the
  same 28 days is lit; arrows show its next units with chips
  "share · n", for example "ED 31 % · n 41": an edge count of 41, or
  31 % of the sum of the lit unit's outgoing flow counts, not 31 % of
  unique outgoing people. These are all moving patients,
  not carriers (carriers are A4's trails), and raw volume: ranking units by
  it did not beat volume-preserving random graphs (0019: pooled AUC 0.63,
  p 0.22, computed).
- **County map**: THL cases and incidence per county per month (A5), with
  A5's signals; a county with too few cases is hatched. The county polygons
  come through `/api/counties` (D-043), which returns 404 without the file.

---

# Part C. The backend container

D-040 already ships the API and web containers. What they do, and what a
backend port must keep so that the web app, which reaches the API only
through `libs/utils/contract` over HTTP and server-sent events (D-006),
shows the same numbers.

- **Inputs.** The dataset's rows, or a laboratory feed in HL7 v2, FHIR R4
  or a flat export through `@aei/ingest` (D-035, D-036); THL's county file
  (A5) as a mounted file.
- **State.** Records released by the replay clock (D-005, D-015). Alerts:
  `buildAlerts` over the whole history once at start, released by date;
  this equals computing them as of each day because every rule is causal
  (A3). With a live feed, rebuild on the rows up to today after each day's
  ingest (`buildAlerts` over all 24,571 isolates takes about 1 s,
  computed 2026-10-17). Ingested results are held in memory and lost on
  restart; storage policy remains open (QUESTIONS F3).
- **Per request.** Coverage (A2) on the released rows; weekly counts (B2)
  on the released rows; flows (A4) for the requested window.
- **Routes** it serves: `/api/coverage`, `/api/alerts`, `/api/live`,
  `/api/relations`, `/api/isolates`, `/api/regional`, `/api/meta`,
  `/api/clock`, `/api/ingest`, `/api/quality`, `/api/explain`, `/api/ask`,
  `/api/weekly` and `/api/counties` (D-043), now merged from
  `overnight/design`. `apps/api` only wires gears to routes; logic lives in
  `libs/utils`.
- **Port only what is decided** (Part A). Part D stays out, or goes in as
  a marked placeholder naming its QUESTIONS.md item. Each result should
  carry its isolate count, period, fallback level and reliability label
  (Artem, 2026-10-17); the label's rule is QUESTIONS B11. The module and
  route list, with the decision each rests on, is
  `benchmarks/overnight-2026-10-17/engine-port-plan.md`; changes to `/api/coverage`'s shape need Artem's
  OK first.
- **The container** (`deploy/container`, D-040): an API image (Node 22
  slim running `apps/api` from TypeScript, non-root, with a health check)
  and a web image (the Vite build served by nginx, proxying `/api` and the
  unbuffered `/api/live` stream, with an optional `/llm` proxy), wired by a
  compose file for podman or docker. The dataset and THL data are mounted
  read-only, never built into an image. No auth, TLS or persistence yet;
  storage is QUESTIONS F3.

---

# Part D. Proposals that do not run

Each was tried overnight on 2026-10-17 through one scoring harness
(`benchmarks/overnight-2026-10-17/harness-spec.md`); the comparison table
is `benchmarks/overnight-2026-10-17/README.md`. All are exploratory, and
D-044 keeps Part A as the evidence recommends; D-045 approves shipping the
county forecast, whose API and screen integration is still pending. The
analysis below is retained, including the proposals not selected.

## D1. Beta-binomial with borrowed strength and a weekly discount (D-041)

```
belief about a cell's share     p ~ Beta(a, b)
borrowed strength (parent p₀,
same specimen and onset,
preceding period)               a = M·p₀ + k,   b = M·(1 − p₀) + (n − k)
each week t                     a_t = δ·a_{t−1} + (1 − δ)·M·p₀ + k_t
                                b_t = δ·b_{t−1} + (1 − δ)·M·(1 − p₀) + (n_t − k_t)
estimate and prediction         E[p] = a / (a + b);  next n isolates ~ BetaBinomial(n, a, b)
own-data weight                 w = n_eff / (n_eff + M),   n_eff = a + b − M
organism mix (Dirichlet)        coverage_d = Σ_o E[π_o]·E[p_o,d], with its closed-form variance
```

Discounting to (δa, δb) without a floor keeps the Beta mean and widens the
belief (Smith 1979; Harvey and Fernandes 1989); this is close to, not
exactly, a random walk on the log-odds. The displayed update adds a floor:
before new counts, it relaxes toward the parent p₀ rather than preserving
the posterior mean. D-041 accepted the method; D-044 keeps the annual
coverage window without a weekly discount or Finres borrowing in what is
shown (QUESTIONS B2, B3). Prior strengths remain open (B1, B4). Overnight
(computed): δ 0.95, M 10 chosen on the first year gives Brier +0.0002 (−0.0000 to
+0.0004) against the hospital year and reacts to E1 in 48 days (0012); the
organism mix changes C1 by +0.0001, and ENGINE's variance formula is right
to 0.64 % against Monte Carlo (0013); no finer pooling level beats the
hospital year (0014). None meets METRICS.md's replacement rule, so A2 stays.

## D2. Patient-specific adjustments

An earlier resistant finding of the patient, or an active cluster in a
connected unit, would flag the affected drugs; whether they change the
number or only annotate it was QUESTIONS B6, B7. D-044 keeps no
connected-unit adjustment of the doctor's number (B7); the prior-resistance
annotation (B6) remains open. A covariate model
(logistic regression per organism and drug) is out of scope (B8; 0005
found patient factors add nothing except men and urinary ciprofloxacin).

## D3. Other detectors

| Method | Record | D5: share of 4-patient clusters found at ≤ 5 episodes a year (rare strain / common ESBL) | Against the live set's 0.92 / 0.75 |
|---|---|---|---|
| Gamma-Poisson surprise, guard band, Benjamini-Hochberg (ENGINE's former 3.3) | 0015 | 0.205 / 0.095 | far behind (on phenotype series alone it matches the live phenotype test) |
| Poisson and Bernoulli CUSUM (QUESTIONS C5) | 0016 | 0.665 / 0.485 (held-out seeds 0.66 / 0.435) | behind |
| Improved Farrington on unit series | 0017 | 0.31 / 0.24 | far behind |
| Bayesian online change points | 0018 | 0.14 / 0.135 | far behind |
| Live set combined with CUSUM (rank product) | 0022 | level with the live set at matched noise (held out 0.966 / 0.772 against 0.960 / 0.817) | no gain |

The live set wins mostly on information: its profile test matches the
exact 13-drug profile the injected copies share. QUESTIONS C3, C4 (baseline,
guard band, FDR, budget) and C5 (CUSUM θ, h; the first year picks θ = 8)
were open; D-044 keeps the live settings and does not add CUSUM.

## D4. Trend over 24 months and divergence

ENGINE's former proposal for the trend: logistic regression of R on time
over the last 24 months, signal when the slope's interval excludes zero and
the change over 12 months exceeds 3 points (QUESTIONS C6; D-044 keeps the
current trend test instead). A divergence funnel (a unit's 12-month %R
against the hospital's, 99.8 % limits) is not built.

## D5. Exposure and forecasts

- **Exposure**: exposure_B = Σ_A w(A→B)·active_A / Σ_A w(A→B). Over 24
  real ESBL and MRSA episodes it is not above label-permutation nulls
  (pooled AUC 0.63, p 0.22); after E1 and E2 no other unit rises, so their
  AUC is undefined (0019). Not built (QUESTIONS D1, D2).
- **County forecast**: a 24-month rolling mean with a negative-binomial
  width forecasts THL counts one month ahead better than last month's
  count (log score +0.40, 0.31 to 0.48; MAE +0.14), not for VRE once
  persistence's floor is fair (0020 and its review). D-045 settles
  QUESTIONS D6: ship the forecast with the regional data and label it as a
  forecast in the region view, cut at the replay clock. This is approved,
  not yet integrated into the API and screen.

## D6. Naming

The five kinds (sentinel, cluster, trend, divergence, data) come from the
detector by lookup (A3); every alert of the live set and of 0015 is named
the same way by rule (0021), and the kind is right for 97.4 % of the
detected planted and injected events (computed). Whether the kind becomes a contract field
is part of the engine port.

---

# Part E. Open decisions

The previously open list in QUESTIONS.md was: A1 lookback, A2 onset, A4
selective testing; B1 to B4 prior strengths and discount; B6, B7
annotations; B10 the four-week flag; B11 the reliability label; C1 to C8
detection settings; D1, D2 edges and null; D6 the county forecast; F3
storage. D-044 settled it as the overnight evidence recommends, and
accepted D-038 to D-043: keep the 365-day lookback, the current onset rule
pending the organisers' wording, the live detectors and their settings,
no CUSUM, the current trend test, and the demo thresholds labelled as
tuned on the test events; keep the annual coverage window without a
weekly discount, no Finres borrowing, no connected-unit adjustment of the
doctor's number, no four-week flag yet, and descriptive flows. Runtime
and base images (F2) are shipped under D-040.

D-045 settles D6 separately: the county forecast ships. Its integration
with the regional data and region view remains to be implemented; the
analysis in Part D5 is not a claim that it already runs.

D-046 settles the calls D-044 left for later: no separate
selective-testing flag beyond the existing untested gate (A4); M = 30 and
M_π = 100 for the Beta-binomial analysis code (B1, B4); no patient-history
adjustment or annotation (B6); the reliability label is the level with its
count and the 30-result floor (B11); no linked-unit detector (C8); memory
storage for the demo, persistence left to pilot planning (F3). Only A2's
wording, asked of the organisers, remains open.
