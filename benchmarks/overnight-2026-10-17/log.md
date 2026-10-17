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
| 08:36 | 0020 review | start | Fable 5.1 | | beats its baseline (P2 log skill +0.40) |
| 08:43 | 0020 review | finish | Fable 5.1 | 6 min | stands with caveats: pooled skill robust (+0.378 at persistence's best floor 0.25); VRE log skill mostly the floor (+0.06 at floor 0.1), VRE/CPE MAE skill is forecasting zero; ship rule should not fire for VRE; method line and data field corrected by the orchestrator, one rounding slip fixed |
| 08:43 | 0014 pooling levels (m6) | plan start | Sonnet 5.5 | | plan then implement |
| 08:49 | 0016 | plan committed | Sonnet 5.5 | 9 min | Poisson θ {2.5,4,8} × daily/weekly × guard {0,4}; Bernoulli θ {2.5,4,8} × guard; p = 1/ARL(S_t) per series |
| 08:52 | 0014 | plan committed | Sonnet 5.5 | 9 min | 4 levels × {unsplit, onset-split, folded}; chosen on TUNE |
| 09:08 | 0014 | result committed | Sonnet 5.5 | 60–73 s CPU | TUNE chose the hospital pool (= hospital-365); in/out pool C1 −0.00005 (−0.00011 to +0.00001), unit +0.00036; no row passes the replacement rule (all fail C8); no Fable review |
| 09:08 | 0017 Farrington-Noufaily (m11) | plan start | Sonnet 5.5 | | plan then implement; unit series added so D2 can match |
| 09:10 | 0016 | result committed | Sonnet 5.5 | 71 s CPU | year 1 chose θ 8 (not C5's 2.5); D5 rare 0.665 (0.597–0.727), common ESBL 0.485 at 3.52 episodes/yr vs live set 0.92 / 0.75; Siegmund/simulation ARL ratio 0.91; Bernoulli part carries 123 of 133 rare hits; no Fable review |
| 09:11 | 0022 ensemble (m21) | plan start | Fable 5.1 | | the two best by D5: live set (re-tuned) and the 0016 CUSUM union |
| 09:17 | 0022 | plan committed | Fable 5.1 | 8 min | primary row rank product; stack and union/intersection as references; calibration frozen at 2024-09-30 |
| 09:17 | 0017 | plan committed | Sonnet 5.5 | 9 min | trailing window {26,52} × guard {0,4} × down-weighting; unit scope for D2/D5, hospital scope for D4/I1 |
| 09:17 | 0022 ensemble | implement start | Sonnet 5.5 | | moves the CUSUM into aei.cusum with a reproduction test |
| 09:20 | 0021 naming step (m27) | plan start | Sonnet 5.5 | | moves 0015's detector into aei.gamma_poisson in phase B |
| 09:24 | 0015 | result committed | Sonnet 5.5 | 262–336 s CPU | year 1 chose S 26, g 0, L 1, q<0.005; D5 rare 0.205 (0.155–0.266), common ESBL 0.095 at 1.0 episode/yr (level 0.001; 0.005 sits at 5.02/yr, knife-edge); refuted; noise all from 243 organism × specimen series; on the 36 phenotype series alone 0.715 / 0.65 at 3.0/yr, level with live phenotype Poisson; budget never binds; no Fable review |
| 09:25 | 0021 | plan committed | Sonnet 5.5 | 5 min | 7-row naming table, incident rules R1–R7 (R1 = D-034 reproduction) |
| 09:25 | 0016 held-out re-score | start | Sonnet 5.5 | | Artem's winner's-curse rule; seeds 2027–2030 |
| 09:27 | 0016 held-out re-score | finish | Sonnet 5.5 | 16 s CPU | seeds 2027–2030, 200 per cell: CUSUM D5 rare 0.660, common ESBL 0.435 (screening 0.665, 0.485); live set 0.940, 0.695 (0.920, 0.750); gap stays, intervals do not overlap |
| 09:30 | 0018 | result committed | Sonnet 5.5 | 245–330 s CPU | year 1 chose H 1/26, w 2; D5 rare 0.14 (0.10–0.19), common ESBL 0.135 at 1.5 cluster episodes/yr; %R signals named divergence add 5.0 episodes/yr that D5's cluster+sentinel noise (Choices 3) leaves out; refuted; no Fable review |
| 09:32 | records check | finish | Haiku 5.5 | | 8 closed records: template, frontmatter, exploratory, command, metrics.json, figure sizes all pass; sentence-level tag check flags 11–32 sentences each, mostly tagged by the paragraph or a section-level statement (spot-checked) |
| 09:37 | 0017 | result committed | Sonnet 5.5 | 50 s CPU | year 1 chose trailing 26 wk, guard 4, plain, tail 1e-4 (10× too strict on SCORE); D5 rare 0.310 (0.250–0.377), common ESBL 0.240 at 4.52/yr; down-weighting never acted; refuted; no Fable review |
| 09:37 | run | Artem's closing instructions | Opus 5.5 | | no new detector or estimator experiments; finish 0017, 0021, 0022 (all nearly done); pitch summary; D-020 checklist; QUESTIONS B10, B11; engine-port plan before any code |
| 09:43 | 0022 | result committed | Sonnet 5.5 | 151 s CPU | rank product D5 0.940 (0.898–0.965) rare, 0.830 (0.772–0.876) ESBL at 4.52/yr vs live 0.92/0.75 at 3.01/yr; interpolated at 5/yr 0.942/0.834 vs live 0.960/0.837: no gain at the yardstick; at 1.5/yr ESBL 0.735 vs 0.440; year-1 operating level p 3e-5 gives D4 0; CUSUM moved to aei.cusum (test passes); held-out re-score and Fable review next (headline reads higher) |
