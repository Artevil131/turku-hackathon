# Harness review (overnight 2026-10-17)

By Claude Code (Fable 5.1, review agent), operated by Artem, 01:45 to about
02:15 EEST, on branch `overnight/experiments` at 7af0328 with the harness
as committed. Checked: `harness-spec.md` (with Choices and Metric keys),
`agent-rules.md`, `benchmarks/METRICS.md`; `aei.harness`, `coverage_list`,
`score_coverage`, `score_detection`, `score_prediction`, `inject` and
`detect` (for what the scoring relies on); the four test files; the seven
baseline rows and the three scripts that wrote them; `leaderboard.py`;
the committed results of 0002, 0004, 0007, 0010 and 0011. Ran the four
test files (`uv run pytest -q -p no:cacheprovider`, 77 passed in 63 s;
`test_coverage_list` regenerated 0010's git-ignored `out/rows.json` as it
is written to) and three read-only checks in the scratchpad: C7's nominal
coverage under each baseline's own predictive, the exactness of the
post-hoc level filter on the two cluster detectors, and the baseline sizes
behind the year-1 re-tune. No repository file other than this one was
written.

**Verdict.** Nothing invalidates a row and no number in the baseline rows
is wrong: the reproductions are exact, the views are strict, and the
spec's choices are implemented as written and are statistically sound. The
findings below are caveats on how numbers will be read and a few cheap
additions; two of them (C3(b)'s pass rule, D5's comparability across
threshold grids) can flip a verdict for a new row and should be fixed
before rows are compared. The random test failure is not in the harness's
arithmetic; it comes from shared files the tests read while other agents
rewrite them (or from a module mid-edit), and there is a deterministic
fix.

## Findings

1. **Reproduction (fine).** The tests do require the committed numbers,
   not looser ones. 0004: `test_the_eight_estimators...` parses
   `0004/out/results.md` and requires all 48 rows (8 estimators x 3
   subsets x 2 metrics) equal as strings to 4 decimals, mean, difference
   and interval alike, through `to_fixed`; the headline test requires
   0.1414/0.1605 and the row counts 163,666 / 36,588 / 182,367. 0007 and
   0011: the 13 and 20 table lines are rebuilt through the generic trials
   and compared byte for byte with the committed `results.md`. 0010: C4
   96.6/75.4/95.4 to a tenth of a point with their isolate counts (9,866,
   16,139, 14,473), C3(b) 0 of 175 (0.3) and 23 of 269 (19.6, ratio 1.17),
   the lower-bound check 959 of 4,285 against 1,079.0 (0.89), 529 query-
   months per severity, and all 7,525 ranked rows against the Python month
   loop row by row (counts exact, floats within 1e-12), which
   `test_coverage_list` in turn holds to the TypeScript `backtest.ts` and
   to 405 Node queries within 1e-12. All pass. One note: the 0011 test
   exercises held-out seeds 2027 and 2028 (0011's loop); that is a
   reproduction, nothing is chosen on them.

2. **Strictness of the coverage views (fine, one caveat).** `View` slices
   the date-sorted frames at `searchsorted(day, start)`, so `records`,
   `isolates`, `cells`, `first_isolates`, `first_cells` and `counts` hold
   only rows dated before the first target day; the month gate
   (`shipped_gate`) and `Shipped._result` get the same slice; C6 views
   hold rows up to and including the day. Targets are built apart
   (`first_rows(start, end)`), and `test_first_isolates_match_counting`
   checks the cut. Every cache (`data`, `window_targets`, `month_targets`,
   `shipped_gate`, `_baseline_window_ps`, `_first_rows`, `boot_indices`,
   `_real_county_series`, `inject._BASES`) is in-process and keyed on
   constants or dates; nothing is cached on disk. Caveat: `view.target`
   hands an estimator the dates, units, sex, age, hospital-onset and
   inpatient flags of every culture of the whole 28-day target window at
   once. That is what the doctor knows for the one isolate in front of
   them, but a cell-level estimator can read the volume and timing of
   future cultures (a unit taking three times its usual hospital-onset
   cultures next month is outbreak-correlated). No estimator tonight does
   this, so no row is affected. Fix: in `score_coverage.View.target` set
   `self._target_read = True`; in `_window_ps` and `_month_predictions`
   raise `ValueError("a cell-level estimator must not read view.target")`
   when the prediction is cell-level and the flag is set; say so in the
   protocol docstring.

3. **Strictness of the trials and detectors (fine, one caveat).** A trial
   gives the detector rows up to `until` only (start + 28 days for
   clusters, + 14 for gaps, `Base.prefix`), injected rows inserted in date
   order with a culture each; the focused live run slices start − 400 to
   end, which holds the 365 + 28-day baselines, and
   `test_focused_run_gives_the_signals_of_a_full_run` shows it equals a
   full run on the same rows (profile excess restricted to the source's
   specimen, 0007's rule, is the documented exception). The post-hoc level
   filter cannot leak: each signal's p is computed once. Caveat: inside a
   trial a non-causal detector could look up to 28 days past a signal's
   date; `check_causal` is the only guard and only experiments call it.
   Fix (cheap): `score_detector` runs
   `check_causal(detector, [one cut], records, cultures,
   raise_on_error=False)` once and writes the result to
   `extra["causal_check"]`, so the record cannot omit it. P2 is not
   strictly as-of (THL revisions; documented in the rows) and
   `audit_strict` catches a forecaster that reads the module's series
   after the target; P1 builds the graph from cultures before onset and
   the outcome from records after it.

4. **C1 and C2 bootstrap (fine).** `boot_indices` draws
   `floor(rand() * 26)` for each of 26 slots per resample from one
   `mulberry32(2026)` stream (the test matches 0004 draw by draw), the
   statistic is the ratio of sums over the resampled windows (a cluster
   bootstrap over windows, right for 13 correlated results per isolate),
   the difference is paired on the same draws, and the quantile is 0004's
   floor rule (elements 24 and 974 of 1,000; slightly inward, 0004's
   choice). Two documented choices to keep in mind: the "small" subset is
   defined on the left-out count for both conventions; and the shipped
   estimator has no estimate for 828 small-cell rows (< 30 results),
   which are scored with the baseline's p (`n.C1.fallback`), so the
   shipped row's `C1_diff.small` is partly the baseline against itself.

5. **C3(a) (fine).** Grouped logistic regression of the outcome on
   logit(p clipped to [0.001, 0.999]) by Newton with step halving (tested
   against statsmodels to 1e-7), interval from the window bootstrap
   refitted with window multiplicities as weights, not Wald. Slope 1.04
   (1.03 to 1.05) for hospital-365, 1.03 (1.01 to 1.04) shipped.

6. **C3(b) (fine as specified; the pass rule is a caveat that can flip a
   verdict).** Query-months whose top pick clears with at least 10 results
   on its basis; expected from Binomial(n, predicted share) with 0010's
   `ceil(bar n − 1e-9) − 1` rule (Choices 2); the Beta-binomial variant
   beside it uses the method's (a, b) or a Beta moment-matched to its 95 %
   interval (z = 1.96). Pass is `obs <= 1.5 x exp` in both severities. With
   `mild_exp` 0.31 (shipped) or 0.13 (hospital-365), a single query-month
   below 80 % fails the mild check (1 > 0.46): any method whose mild picks
   are sure fails C3(b) on one unlucky month, which is chance, not
   miscalibration. Fix (proposed, pending Artem): in `score_coverage.c3b`
   judge each severity as `obs <= 1.5 * exp or
   stats.poisson.sf(obs - 1, exp) >= 0.05`, and report the tail
   probability as `mild_p` and `severe_p` beside the ratio; the ratio and
   its 1.5 stay as the spec's reading.

7. **C4 subsets (fine, one reading caveat).** `mild_spectrum` and
   `severe` are the top pick over the query-months where it clears,
   realised on the standing's basis (0010 table 1); `mild_all` is every
   mild top pick over all organisms (table 3's 75.4 %); the `_counted`
   figures keep the same query-months and numerators and count untested
   isolates as not covered (within spectrum: over isolates with a
   breakpoint). Bootstrap over 24 months with the same mulberry32 draws.
   Caveat: the clears-conditional figures reward a method that clears
   rarely (wider intervals, fewer and surer picks), and the leaderboard
   shows the value without its n (218 query-months, 9,866 isolates for
   the shipped list). Fix: `leaderboard.py` `cell()` appends `n` from
   `doc["n"]` for C4 and C8 keys (flatten `doc["n"]` into `row.n` next
   to `row.flat`), so a reader sees how many query-months a 96.6 % rests
   on.

8. **C7 (fine; the band is a coarse screen).** The Beta-binomial and the
   moment matching are right: `beta_from_interval` gives mean p and sd
   (hi − lo)/(2z), which for the shipped Wilson intervals yields a Beta
   with a + b of median 470 (about the pool it came from) and for
   hospital-365's Jeffreys Beta 4,956; `mid_pit` is F(k − 1) + f(k)/2 and
   the test shows it neither inflates nor rewards vagueness. Checked the
   nominal: under each baseline's own predictive distribution the share of
   counts inside the 0.05 to 0.95 mid-p band over these 1,993 blocks is
   0.907, not 0.900, because 7 to 9 % of blocks have p at or above 0.95
   where the count distribution is lumpy (nominal 0.93 there). Observed
   0.902 (shipped) and 0.899 (hospital-365) are both inside their month
   bootstrap (about ± 0.024) of 0.907: both are honest. The 0.85 to 0.95
   band is therefore meaningful only as a screen: its half-width is twice
   the bootstrap half-width, so a method whose intervals are clearly too
   narrow (a at 0.86) still passes. Fix (proposed): in
   `score_coverage.c7` compute per block the probability of "inside" under
   the method's own Beta-binomial (sum of f(k) over the k whose mid-p lies
   in the band; the arrays are already there, about a second), report its
   mean as `C7.a_expected`, and set `pass_a` to the band and the bootstrap
   interval of `a − a_expected` containing 0. Note also that hospital-365
   passes C7(a) while giving every unit the same p: units differ too
   little in this dataset (C1_diff 0.0003) for C7(a) to see it. C7(b)
   has 27 blocks (0.56 and 0.74), too few for any band, as METRICS says.

9. **C6 (fine; leaderboard direction wrong).** Daily views of rows up to
   the day, the 90 % interval of day d against the point estimate of the
   day before onset, up to 120 days, E2's specimen chosen as the one with
   most ICU MRSA in 2026-03 (wound). Shipped: E1 CRO 47 days, the rest not
   reached; hospital-365 never. A narrow, jittery interval reaches C6 at
   day 0, which METRICS says to read with C7 and C8, but `leaderboard.py`
   marks `C6.E1_CRO` and `C6.E2_CXM` as "lower is better" and would bold
   the fastest. Fix: `COLUMNS["coverage"]`: direction `"none"` for both C6
   columns.

10. **D2 matching and intervals (fine).** Detected: a signal whose ward is
    the unit or a "+" set containing it, about the source's organism or one
    of its phenotypes, dated start to start + 28 (0007's rule); Wilson 95 %
    on 200 trials; per-seed counts in `extra.D2_per_seed`; median delay by
    0007's lower-median rule from the first injected isolate. Two readings
    to keep: a new-in-unit sentinel counts as detecting an injected MRSA
    clone in an inpatient unit at delay 0 (rare k=2 0.165 against 0.12 over
    cluster signals only, in `extra.D2_cluster_signals_only`); and trials of
    one cell overlap in units and months, so Wilson slightly understates
    the spread, which is why the held-out keys exist. The control cells
    (k = 0: 0.01 to 0.075; two-unit 0.075 on the re-tuned row) are not on
    the leaderboard. Fix: add `Col("D2.rare_k0", "D2 control k=0", "none")`
    and the same for `two_unit_k0`.

11. **D4 (fine; counts need an interval).** Fixed key unit x phenotype-or-
    organism, unit alone for data signals, "hospital|organism|antibiotic"
    for trends; merged within 28 days; an episode counts when its first
    signal is in SCORE; zones as Choices 4 (the E4 zone keys match the
    only TMP and TZP surveillance pairs, so nothing is over-excluded);
    years 727/365.25. The post-hoc level filter is exact for the two
    cluster detectors (checked: `profile_excess` run at 1e-4 and 1e-6 and
    `phenotype_excess` at 1e-3 and 1e-5 equal the loosest run filtered by
    p, signal for signal), and the trend's D-022 exclusion is held at level
    1 whatever the level (documented; the trend raises 0 episodes in SCORE
    anyway). Caveat: the counts are tiny (shipped: 9 episodes in two years,
    2 cluster, 3 sentinel, 4 data) and the leaderboard column "D4 cluster
    episodes/yr ↓" carries no interval, so one episode (0.5/yr) will be
    bolded as a win. Fix: in `score_detector` add `intervals["D4"]` with
    the exact Poisson 95 % interval of each count divided by the years
    (`chi2.ppf(0.025, 2c)/2`, `chi2.ppf(0.975, 2c + 2)/2`); the
    leaderboard prints it unchanged.

12. **D5 curve and headline (fine; comparability across rows is a caveat
    that can flip a verdict).** One run at the loosest level, the curve
    read by `passes`; noise over cluster and sentinel signals (Choices 3)
    with whole-tool D4 beside it; headline the loosest level with noise at
    most 5/yr. Two consequences for the table. (a) The shipped and the
    re-tuned live rows have identical D5 headlines (0.92 rare, 0.75 common
    ESBL at 3.01/yr) because level 0.3 of the re-tuned alphas is level 3 of
    the shipped ones: D5 cannot separate live-set variants whose alphas lie
    on the same sweep; only D2, D4, D6, D7 and I1 at the operating level
    do. (b) The headline sits wherever the method's grid lands under 5/yr
    (3.0/yr here, the next point is 6.0), and that noise is not a
    leaderboard column, so a method with a finer grid reads higher at
    nearly twice the noise, and the 6 episodes behind "3.0/yr" are a
    knife-edge Poisson count. Fix: `leaderboard.py` detection columns add
    `Col("D5.noise", "D5 noise at headline (episodes/yr)", "none")` and
    `Col("D5.level", "D5 level", "none")`; optionally `d5_headline` also
    reports the rate interpolated at exactly 5/yr between the bracketing
    levels (`rare_at_5`, `common_esbl_at_5`), proposed, pending Artem.

13. **The year-1 re-tune (as specified; caveat on the reference row).**
    `retune_live_set` does what Choices 5 says: 40 rare clusters of 4
    (seed 2026, starts 2024-04-01 to 08-15), 5-day and 3-day gaps, grid
    {1e-2, 1e-3, 1e-4}, per detector the alpha with the fewest other
    episodes among those detecting at least 80 %, else the one detecting
    most; the probe sees rows up to 2024-09-30 only (`base_of` on the cut
    lists, `Base.prefix(until)`), noise from the real year-1 signals in
    the window; the table is in `retune_table`. Chosen: profile 1e-3 (39/40,
    4 episodes), phenotype 1e-2 (31/40, no alpha reaches 80 %, fallback),
    sampling 1e-3, empty run 1e-3. Caveat: the two cluster detectors use
    365-day baselines, and at the year-1 event dates the baseline holds
    165 to 320 days (median stratum baseline 1,507 isolates against 3,581
    for the same events a year later; unit baseline 451 against 751; the
    50-isolate gate never bites), so the same excess has a larger p-value
    in year 1, and the per-detector 80 % bar (stricter than 0002's one
    event per detector) is missed at the shipped alphas (profile 29/40,
    phenotype 20/40). The procedure lands one grid step looser on both,
    and on the scoring period that is D4 cluster 4.5/yr against 1.0/yr and
    D2 rare k=4 0.98 against 0.89: the reference row's operating point is
    a noisier one, which METRICS's split table anticipates ("anything
    needing a full year of baseline" cannot be tuned on year 1). D5 is
    untouched (finding 12a). The fallback also picks the loosest grid
    point whenever the bar is missed. Fix: no procedure makes year 1
    longer; label it: `baselines/detection.py` RETUNED_NOTES and
    `partly_tuned_on_test` should say the cluster alphas were tuned on
    165 to 320-day baselines with a per-detector 80 % bar, and new methods
    compare to the reference on D5 (noise-matched) with D4 beside it.
    Optional: fallback = the strictest alpha whose detection lies inside
    the Wilson interval of the best (unchanged here: 20/40 is outside
    31/40's interval).

14. **`confirm` (fine).** Seeds 2027 to 2030 at 50 trials each (200 per
    cell), the operating level taken as in screening (the detector's
    default level, else the headline level, which comes from the full-data
    noise curve and does not depend on seeds), keys suffixed `_heldout`,
    the curve kept. Shipped held out: rare 0.94, common ESBL 0.695.

15. **P2 (fine).** Series are sums of THL report groups (the assertion in
    the module covers every group once), 23 regions plus the national
    total, 2021-01 to the month before the fetch; MAE of the predictive
    median (`PointPoisson.ppf(0.5)` returns the point, so persistence's
    MAE is that of y(t − 1), Choices 6); log score as mean log pmf; skill
    1 − MAE/MAE_base and the mean log-score difference, paired on the same
    1,000 month resamples (`default_rng(2026)`), `_no_last2` on the first
    22 months; persistence against itself is 0 with a [0, 0] interval and
    seasonal naive's skill is its mirror (−0.095 and +0.087). Reading
    caveat: the pooled keys are sums over the 92 county series, so the
    large ESBL series dominate them; the per-phenotype and national keys
    are the balanced view. 0020 declares its tuning targets as 2024-01 to
    09 and is the only untuned row, rightly bold.

16. **P1 (fine).** Flow as ENGINE.md section 4 (brute-force check on the
    dataset passes), exposure as share and raw, outcome from the Poisson
    upper tail with the baseline smoothed by + 0.5 (a harness choice beyond
    the spec's wording, in the docstring, that keeps one patient against
    an empty baseline from being significant), AUC as Mann–Whitney with
    ties half, 1,000 label permutations with `default_rng(2026)`, one-sided
    p = (1 + #≥)/(n + 1), NaN when no unit is positive or none negative.
    E1: no other unit exceeds its baseline at either alpha, so the AUC is
    null, correctly not 0. Choices 7's label permutation keeps unit volumes
    and patient degrees but not same-unit repeat sampling (the null graph
    has far more cross-unit links than the real one); it answers "does the
    ranking beat chance", which is the question, and the row names it.

17. **The random coverage test failure (caveat; deterministic fix).**
    Nothing in `test_score_coverage.py` is random by construction: every
    generator is seeded (`mulberry32(2026)`, `default_rng(1)` and `(7)`),
    no asserted value depends on BLAS summation order (bincount sums and
    picked quantiles), every cache is in-process, and the heavy fixtures
    are session-scoped. It can fail once and pass on rerun in four ways,
    all from what else was running. (a)
    `test_the_eight_estimators_of_0004_reproduce_every_row_of_its_results`
    reads `experiments/0004-coverage-estimators/out/results.md` at test
    time, and `scripts/verify_experiments.py` (which agents run before
    reporting) reruns `backtest.py`, which rewrites that file in place
    before the script restores the committed bytes; a read during the
    rewrite sees a truncated file and `checked == 48` fails. (b) The
    sister file `test_coverage_list.py` runs `node 0010/backtest.ts`,
    which rewrites `0010/out/rows.json` (2.5 MB, git-ignored) and reads it
    back; two test sessions, or a session and
    `verify_experiments.py --only 0010`, read each other's half-written
    file. (c) The coverage module was still being written when the
    failure was reported (committed 01:41, reported 01:44 by the detection
    agent, who ran the suite from the same tree): an import of a half-
    edited module or a stale `.pyc`. (d)
    `test_cheap_estimators_score_in_a_few_seconds_of_cpu` asserts CPU
    seconds (< 60 and < 180), the only load-sensitive assertion; measured
    5.2 and 11.5 s leave a tenfold margin, so this is the least likely.
    Fix: a conftest fixture `committed(rel_path)` that returns
    `git show HEAD:<rel_path>` once per session, used by the 0004, 0007
    and 0011 tests instead of reading the working tree; `backtest.ts`
    takes its output directory from `process.env.AEI_OUT` (default
    `out/`) and the `ts_rows` fixture passes `tmp_path`;
    `verify_experiments.py` reruns into a temporary copy of `out/` instead
    of in place; the CPU-time test moves behind `os.getenv("AEI_PERF")`.
    With those, two sessions and a verify run cannot touch what a test
    reads.

18. **Other readings that could mislead (caveats).** D1 differs from
    METRICS.md's baseline column (E2 4 → 0, E3 3 → 0, E4 2025-09-28 →
    2026-05-10) because the live set changed after 0002: D-021's
    new-in-unit fires on E2's onset, D-031's empty run fires on the first
    empty day, and D-022's exclusion moves the TMP trend, as 0002's README
    records ("The live set changed"); the re-tuned row's E4 (2026-02-15)
    moves again because looser cluster alphas exclude more isolates from
    the trend. Fix: one line in `FAMILY_NOTES["detection"]`. `tuned_on_test`
    is self-declared and drives the bold mark; the orchestrator's review of
    each record is the check. `C3b_bb` and `C7_lower_bound` are written
    into `metrics` beyond the spec's keys (harmless; the full table shows
    them). Runtime is reported and never ranked, as the rules say; the
    detection baselines cost 140 s CPU each, well inside the budget.
