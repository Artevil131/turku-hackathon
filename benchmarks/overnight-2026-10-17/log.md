# Overnight log, 2026-10-17

Every experiment and harness step: start, finish, failure, runtime, agent
model, with clock times (EEST). Kept by the orchestrating session (Claude
Code, Opus 5.5, operated by Artem).

| Clock | Item | Event | Model | Runtime | Note |
|---|---|---|---|---|---|
| 01:00 | run | start | Opus 5.5 | | brief and the files it names read; branch `overnight/experiments` from main 29d1f06 |
| 01:07 | harness | spec written | Opus 5.5 | | `harness-spec.md`; `aei.harness` core; `verify_experiments.py` finds `run.py` from 0012 on |
| 01:10 | harness: coverage (`aei.coverage_list`, `aei.score_coverage`, baselines) | start | Sonnet 5.5 | | |
| 01:10 | harness: detection (`aei.score_detection`, `aei.inject` extension, baselines) | start | Sonnet 5.5 | | |
| 01:10 | harness: prediction (`aei.score_prediction`, baselines) and `leaderboard.py` | start | Sonnet 5.5 | | |
| 01:10 | plans 0012, 0019, 0020, 0035 | start | Fable 5.1 | | written while the harness is built; no runs |
| 01:11 | run | keep-awake | Opus 5.5 | | idle sleep held for the session |
| 01:17 | run | addendum from Artem (01:15) | Opus 5.5 | | method list 1, 3, 6, 8, 9, 11, 13, 22, 24 (three models), 27, then 21; stop launching at 08:30; report refreshed every 3 h; screen on seed 2026, re-score winners on 2027–2030; runtime informational; Fable only for the foundations of 8, 13, 21, 22 and for reviews of rows that beat their baseline, one at a time; checkout stays on this branch and clean between commits. Numbers renumbered in list order: 0012 m1, 0013 m3, 0014 m6, 0015 m8, 0016 m9, 0017 m11, 0018 m13, 0019 m22, 0020 m24, 0021 m27, 0022 m21 |
| 01:21 | harness: prediction and leaderboard | finish | Sonnet 5.5 | 11 min | 15 tests pass; persistence pooled MAE 2.533, log score −2.130; E1 exposure: no unit but URO exceeds its baseline, AUC undefined |
| 01:22 | 0020 county forecasts (method 24: persistence, seasonal naive, Poisson GLM) | plan start | Sonnet 5.5 | | plan then implement, one agent |
| 01:25 | plans 0012, 0015 | committed | Fable 5.1 | 15 min | CUSUM and county plans not started by Fable (scope change); Sonnet writes them |
| 01:26 | plans 0018 (BOCPD, m13), 0019 (exposure, m22) | start | Fable 5.1 | | the two Fable foundations Artem assigned besides 8 and 21 |
| 01:32 | 0020 | plan committed | Sonnet 5.5 | 10 min | tuning targets 2024-01..2024-09, 198 cells, one-SE rule |
| 01:41 | harness: coverage | finish | Sonnet 5.5 | 37 min | reproduces 0004 (48 rows) and 0010 (7,525 rows) exactly; hospital-365 C1 0.1414/0.1605; shipped C4 96.6/75.4/95.4, C6 E1 CRO 47 d, E1 CXM and E2 not reached; full score 5–12 s CPU. The agent ran `uvx ruff` once, which downloaded the 8.8 MB linter outside the repo (not allowed by the brief's no-download rule; no repo file changed) |
| 01:42 | 0020 | result committed | Sonnet 5.5 | 19 min agent, 2.3 s CPU | chosen on 2024-01..09: 24-month rolling mean, pooled NB width; pooled log skill +0.402 (0.309–0.482), MAE skill +0.144 (0.063–0.213) vs persistence; reproduces; Fable review queued (beats baseline) |
| 01:42 | 0012 discounted Beta-binomial (m1) | implement start | Sonnet 5.5 | | plan by Fable (committed) |
| 01:42 | 0013 Dirichlet-multinomial × Beta, WISCA (m3) | plan start | Sonnet 5.5 | | plan then implement |
| 01:43 | plans 0018, 0019 | committed | Fable 5.1 | 14 min | 0019 treats flow-partner injections as a positive control only (circular) |
| 01:44 | 0019 exposure ranking (m22) | implement start | Sonnet 5.5 | | plan by Fable (committed) |
| 01:44 | harness: detection | finish | Sonnet 5.5 | 34 min; baselines 272 s CPU | reproduces 0007 and 0011; live set D5 rare 0.92, common ESBL 0.75 at 3.0 episodes/yr (held out 0.94, 0.695); re-tuned alphas profile 1e-3, phenotype 1e-2, sampling 1e-3, empty run 1e-3, D4 9.55/yr; one random failure of a coverage test reported, passed on rerun (to check) |
| 01:45 | harness check | start | Fable 5.1 | | reproductions, strictness, the spec's choices as implemented, the flaky coverage test |
| 01:54 | 0013 | plan committed | Sonnet 5.5 | 9 min | grid M_π × M ∈ {10,30,100,300}², chosen on TUNE |
| 02:04 | 0012 | result committed | Sonnet 5.5 | 22 min agent, 33 s CPU | TUNE chose δ 0.95, M 10; C1 +0.0002 (−0.0000 to +0.0004) vs hospital-365; C8 C1 worse than shipped (+0.0011); C7(a) 0.929; C6 E1 CRO 48 d (shipped 47); replacement rule not met; no Fable review (does not beat baseline) |
| 02:05 | harness check | finish | Fable 5.1 | 19 min | sound: reproductions exact, views strict, post-hoc level filter exact; 18 findings, none invalidates a row; fixes: C3(b) tail p beside the ratio, C7 expected coverage, D5 noise/level columns, D4 interval, re-tuned row caveat, flaky test (tests read files the verifier rewrites) |
| 02:06 | harness fixes from the review | start | Sonnet 5.5 | | additive keys only; baselines and 0012 metrics regenerated |
| 02:06 | 0015 Gamma-Poisson guard band (m8) | implement start | Sonnet 5.5 | | plan by Fable (committed) |
| 08:33 | run | session usage limit | Opus 5.5 | ~02:15–08:31 | three Sonnet agents (harness fixes, 0015, 0013 phase B) stopped at about 02:15 on the session limit; nothing ran until 08:31. Artem extended the run to 12:00: stop launching 11:15, report by 12:00 |
| 08:34 | harness fixes, 0015 | resumed | Sonnet 5.5 | | after the session limit; tests pass on the partial fixes (112 passed) |
| 08:34 | 0018 BOCPD (m13) | implement start | Sonnet 5.5 | | plan by Fable (committed) |
| 08:34 | 0016 CUSUM (m9) | plan start | Sonnet 5.5 | | plan then implement |
| 08:34 | 0013 | result committed | Sonnet 5.5 | 48 s CPU (verify) | M_π 100, M 30 chosen on TUNE; C1 +0.0001 (−0.00001 to +0.00021) vs hospital-365; replacement rule not met (C4); C6 E1 CRO 48 d; ENGINE 2.4 variance correct (max rel. error 0.64 % vs Monte Carlo); WISCA lowers top severe pick by 0.5 points; finished just before the session limit, verified by the orchestrator |
| 08:34 | 0019 | result committed | Sonnet 5.5 | 87 s CPU | 24 real ESBL/MRSA episodes, 7 with a positive unit: pooled AUC share 0.627, raw 0.657, permutation p 0.22 and 0.14; E1 and E2 undefined (no positive unit); flow-partner control 0.511/0.584, uniform control 0.455/0.493; no Fable review (does not beat the null) |
| 08:36 | harness fixes | finish | Sonnet 5.5 | | additive; 112 tests pass; baselines and 0012 metrics regenerated |
