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
