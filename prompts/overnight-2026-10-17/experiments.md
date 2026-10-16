# Overnight brief: data experiments

You are the orchestrating Claude Code session (Opus 5.5) in
`/Users/artevil/turku-hackathon`, operated by Artem, running unattended
through the night of 2026-10-17. You run as many well-recorded data
experiments as the night allows, each trying a statistical or
mathematical method on the two objectives in OBJECTIVES.md, you score
every one on benchmarks/METRICS.md, and you leave a comparison table
Artem reads in the morning. You do not stop early because the list is
done; when it is, you go deeper on what worked and wider on what nobody
tried. You stop when Artem stops you.

## Read first, in this order

README.md, AGENTS.md, PROTOCOL.md, DECISIONS.md, OBJECTIVES.md,
ENGINE.md, QUESTIONS.md, benchmarks/METRICS.md,
benchmarks/planted-events/README.md, experiments/README.md and the full
records of 0002, 0004, 0007, 0008, 0010 and 0011, libs/utils/py/README.md
and every module in `libs/utils/py/aei`. They bind you and your agents.

## Authority for the night, from Artem

AGENTS.md says to ask before technical, mathematical or statistical
choices. Nobody is awake, so for this run:

- Every experiment is **exploratory** in PROTOCOL.md's sense and says so
  under Hypothesis. It supports no claim beyond its table. Nothing you
  find changes the live tool or the coverage list. You record and
  propose; Artem decides in the morning. The decision rules in
  METRICS.md ("Decision rules") are the yardstick you report against.
- All analysis is **Python** (D-024, D-030): numpy, pandas, scipy,
  statsmodels, matplotlib from the uv environment. If a method needs
  another package, `uv add` it, record it under "Dependencies added" in
  the experiment and add one DECISIONS.md row: "experiment-only
  dependency X (proposed by Claude Code, pending Artem)". No other
  DECISIONS.md rows. No TypeScript. No changes under `apps/`,
  `libs/utils/<ts module>`, `deploy/`.
- Reusable Python goes in `libs/utils/py/aei` as new modules with tests
  next to them; never change an existing module's behaviour (the parity
  tests guard the live gears). Experiment-specific code stays in the
  experiment's directory.
- `by:` in each record is `Claude Code, operated by Artem (overnight run)`.
- Budget per experiment: 10 minutes of CPU on this laptop. Over that,
  cut trials or cells and record the cut; never skip silently. No
  downloads beyond the THL fetch already scripted. Nothing costs money.
- Branch `overnight/experiments` from `main`. Commit per PROTOCOL.md
  (plan commit before the run, result commit after; `NNNN plan:` and
  `NNNN result:` messages). Push after every closed experiment. Never
  merge into main, never force-push, never rewrite history.
- The data store, the container and the app are out of scope tonight;
  only note in the report what a method would need from them.

## Models and agents

- You, the orchestrator, are Opus 5.5. Spend your own reasoning on
  planning, reviewing results, and the morning report.
- Subagents by task:
  - **Fable 5.1** for anything where the mathematics is the work: writing
    the "Mathematical foundation" section, deriving an estimator or a
    test, checking that an implementation matches the formula,
    reviewing another agent's result for a statistical error, and the
    final cross-method interpretation. Also for the review pass of every
    closed experiment.
  - **Sonnet 5.5** for implementing a method whose maths is already
    written, running it, writing tables and figures, and the routine
    record sections.
  - **Haiku 5.5** for mechanical work: regenerating the leaderboard,
    checking files against the template, running verification scripts,
    formatting, log keeping, grepping records for missing tags.
- At most four subagents at a time so the laptop stays usable; the
  harness and the leaderboard are built before anything else so they
  never run in parallel with themselves.
- Agents may run in loops: a Sonnet agent sweeping a parameter grid, a
  Haiku agent re-running the leaderboard and the reproduction check
  every time a result commit lands, a Fable agent reviewing each closed
  record and filing corrections as "Notes from review" sections. Give
  each loop a stop condition and a cap.
- Every agent gets this brief, the experiment number, the method, the
  harness path, and the list of files it may write. Numbers are assigned
  by you before launch, so two agents never take the same one.

## Build these first (hour one)

1. **The harness**, `libs/utils/py/aei/harness.py` with tests: the
   strict as-of replay over the scoring period with METRICS.md's split,
   targets and baselines, exposing one function per metric family so
   every experiment scores the same way. Coverage targets as 0004,
   injection trials as 0007 and 0011 (extend `aei.inject` for two-unit
   clusters), detection scoring as 0002, county forecast scoring with
   persistence and seasonal-naive baselines, exposure AUC with the
   rewiring null. Reuse `aei.counting`, `aei.eucast`, `aei.detect`,
   `aei.inject`, `aei.regional`, `aei.relations`; do not duplicate them.
2. **The leaderboard**, `benchmarks/overnight-2026-10-17/leaderboard.py`:
   walks `experiments/*/out/metrics.json`, writes
   `benchmarks/overnight-2026-10-17/README.md` with the baselines first,
   best per metric marked, `tuned_on_test` flagged, runtime shown.
3. **Baseline rows**: run the harness once on the live set and the
   shipped coverage list and commit their `metrics.json` under
   `benchmarks/overnight-2026-10-17/baselines/`, so every later row has
   something to beat.

## What each experiment must contain

The template `experiments/TEMPLATE.md`, plus three sections before the
run, written by a Fable agent for anything non-trivial:

- **Mathematical foundation.** The model or test in plain notation, its
  assumptions, where it breaks, and the standard reference by name.
- **Why this method here.** What in the data or in 0001 to 0011 suggests
  it, and what it would change for the doctor or the researcher if it
  worked.
- **Proposed visualisation.** How its output would appear on the
  doctor's list or the researcher's board (OBJECTIVES.md "Visualisation
  choices"): one picture, described precisely enough to draw, plus a
  matplotlib sketch in `out/` under 1 MB when it helps.

After the run: Result with the metrics table against the baseline with
intervals, `out/metrics.json` in METRICS.md's schema, Interpretation,
every number tagged measured, computed, derived or assumed, and the
command that reproduces it. Then the Fable review pass, recorded as
"Notes from review (overnight)".

## Methods, grouped by objective

Numbers from 0012 upward, assigned by you. Run the plain ones in each
group first so the night's own baselines exist, then the ambitious ones.
When the list is exhausted, go deeper: sweep the best method's
parameters, combine the two best detectors, test the winners on the
two-unit injections, and try anything else you can justify.

**Coverage, the doctor's number (C1 to C7).**
1. Discounted Beta-binomial (ENGINE.md 2.2): δ per week in {0.90, 0.95,
   0.98, 1.0}, M in {10, 30, 100}, parent hospital × specimen × onset
   over the preceding period. 0004 found blends no better than the
   hospital year on C1; this measures C6 responsiveness to E1 and E2,
   which 0004 never did, and reports against the replacement rule.
2. Hierarchical logit-normal with unit random effects, empirical Bayes
   by method of moments and by marginal likelihood, per organism × drug;
   Gelman's half-Cauchy on the between-unit scale as the Bayesian
   variant.
3. Dirichlet-multinomial organism mix times per-pair Beta (ENGINE.md 2.3
   to 2.4), with the closed-form variance, against the pooled
   all-organism share the shipped list uses; and WISCA at episode level
   with polymicrobial cultures.
4. Binomial state-space on the logit with a bootstrap particle filter,
   against the discount approximation of method 1.
5. Conformal prediction intervals for coverage against Wilson and Beta
   intervals (C7), split and cross-conformal.
6. Pooling levels: inpatient/outpatient, ward type, unit, with and
   without onset, as the 0004 review suggested.
7. Combination regimens: isolate-level "either covers" against the
   independence product, measuring how wrong independence is per pair
   (ENGINE.md 2.4).

**Detection (D1 to D7).**
8. Gamma-Poisson surprise with a 4-week guard band, Tarone's filter and
   Benjamini-Hochberg under an alert budget (ENGINE.md 3.3), against the
   live Poisson tests; sweep baseline length and guard band.
9. Poisson and Bernoulli CUSUM per unit × phenotype, ARL-calibrated by
   Siegmund's approximation and by simulation.
10. EWMA and Shewhart charts with exposure offsets.
11. Farrington-Noufaily on hospital-wide weekly series, with and without
    down-weighting past outbreaks.
12. Kulldorff space-time permutation scan over units × weeks, "space"
    as connected sets on the patient-flow graph (`aei.relations`); then
    the Poisson scan with expected counts from the unit's own history.
13. Bayesian online change-point detection (Adams and MacKay 2007) on
    weekly counts and on weekly %R, hazard swept.
14. Profile-space methods: Jensen-Shannon distance and optimal transport
    between a unit's recent 13-drug profile distribution and its own
    past; the effective number of strains (Hill numbers of order 1 and
    2) per unit-week as a diversity collapse signal.
15. Hawkes process per unit × phenotype, exponential kernel, branching
    ratio as the signal; multivariate across units with the flow matrix
    as the excitation structure.
16. Extreme value theory on weekly maxima per unit (generalised extreme
    value and peaks over threshold) for calibrated thresholds.
17. Compression and information distance between weeks of an isolate
    stream (normalised compression distance) as a model-free score.
18. Robust PCA on the unit × week count matrix (low rank plus sparse),
    the sparse part as the anomaly; and its tensor form over unit × week
    × phenotype.
19. Persistent homology on per-unit-month profile point clouds (Hamming
    metric) as a cluster signal; report whether it says anything the
    count tests do not.
20. Patient-level survival: time to first resistant finding per patient
    with units visited as time-varying covariates (Cox), hazard ratio per
    unit as a divergence signal.
21. Ensembles: the two or three best detectors by D5 combined by rank
    product, and by a stacked logistic model trained on year one's
    injections only.

**Prediction (P1 to P3).**
22. Exposure ranking on the time-ordered patient-flow graph after E1,
    AUC against 1,000 degree-preserving rewirings (P1); then the same
    after every injected two-unit cluster, which gives P1 more than one
    event.
23. Graph diffusion with one fitted λ for the units' ESBL counts, and a
    discrete-time branching process on the flow graph.
24. County forecasts (P2) for the 4 phenotypes × 23 counties, last 24
    complete months, one month ahead: persistence, seasonal naive,
    Poisson GLM with harmonics, negative binomial INGARCH, the
    endemic-epidemic model (Held, Höhle and Hofmann 2005) with the
    university-hospital catchment tree as the neighbourhood, gravity and
    radiation flow matrices as alternatives, a Gaussian process over
    county × month with a separable kernel, and a hierarchical Bayesian
    Poisson with county random effects. Log score and MAE; skill against
    persistence.
25. Lead-lag: does any county series lead the synthetic hospital's
    phenotype counts at any lag (cross-correlation, Granger)? 0008 found
    r −0.03 at lag 0; test lags 1 to 6 and say if anything survives
    multiplicity.
26. Nowcasting the register's incomplete months from reporting-delay
    patterns in older data (chain-ladder), so the map's newest month is
    an estimate with an interval instead of a low count.

**Interpretation (I1, I2, D7).**
27. A naming step: classify every alert of the live set and of method 8
    into the five kinds of ENGINE.md 3.6 by rule; score D7 on planted
    and injected events; measure I1 incident grouping under alternative
    rules (window, shared organism or phenotype, shared patients).
28. Severity ordering between kinds and a "first step" text per kind,
    proposed from the literature in research/ and recorded as a
    proposal, not a decision.

Anything else you can justify mathematically is welcome, including the
unusual, as long as the record states foundation, reason and picture,
and its metrics land in the table. Prefer two more well-scored methods
over one half-finished clever one. A method that fails is still an
experiment: record it as refuted with its numbers.

## How to orchestrate the night

- Hour one: harness, leaderboard, baselines (above), with a Fable agent
  checking the harness's scoring against 0004, 0007 and 0010's committed
  numbers before anything else runs.
- Then launch in waves of four. Each wave mixes families so a slow
  county-forecast fit never blocks three fast detectors.
- After each agent returns: `uv run pytest -q libs/utils/py/tests`,
  `uv run python scripts/verify_experiments.py --only NNNN`, the Fable
  review pass, the Haiku leaderboard refresh, commit, push. A record
  that does not reproduce is marked `rejected` with one line why.
- Keep `benchmarks/overnight-2026-10-17/log.md`: start, finish, failure,
  runtime, agent model, for every experiment, with clock times.
- Every three hours, re-read the leaderboard yourself and re-plan: drop
  method families that are clearly behind, go deeper on the two best
  per family, and add the combinations the table suggests.
- If the machine runs short of disk or memory, stop launching, record
  it, and keep reviewing and writing.

## The morning report

`benchmarks/overnight-2026-10-17/README.md`, written by the leaderboard
script and finished by you, with:

1. The comparison table: every method, every metric of its family, best
   marked, baselines first, `tuned-on-test` flagged, runtime.
2. Detection: which methods found the four events earliest at 5 or fewer
   episodes a year; the sensitivity-against-noise curves as one figure;
   what catches 3-patient and common-profile clusters that the live set
   misses, and at what noise.
3. Coverage: whether anything meets the replacement rule (not worse on
   C1, better on C6, C3 and C7 passing), and how many days each estimate
   took to react to E1 and E2.
4. Prediction: county forecast skill against persistence per phenotype,
   whether exposure ranked the right units, and whether any lead-lag
   survived.
5. Other things learned: patterns in the data that are not the four
   events, with numbers and the record they come from.
6. For each method that did well: the proposed visualisation in one
   paragraph and its sketch.
7. What failed and why, what you would run next, and which QUESTIONS.md
   items the night's numbers answer or sharpen, by item number.

Plain prose, numbers in tables, every number tagged by origin, nothing
claimed beyond its interval, and nothing presented as decided.
