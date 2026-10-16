# Rules for every agent of the overnight run

The orchestrating session (Claude Code, Opus 5.5, operated by Artem) gives
each agent an experiment number, a method, the files it may write and this
file. The brief, prompts/overnight-2026-10-17/experiments.md, binds every
agent; this file is the short form of what it asks of each one.

## Git and files

- The branch `overnight/experiments` is checked out in
  /Users/artevil/turku-hackathon. Never switch branches, commit, push,
  stash, reset or rebase; the orchestrator commits.
- Write only the files your prompt lists. Other agents work in other
  experiment directories at the same time.
- An experiment lives in `experiments/NNNN-slug/`: `README.md` (the
  record), `run.py` (the one entry point; `scripts/verify_experiments.py`
  finds it), helpers next to it, and `out/` with `results.md`,
  `metrics.json` and figures. Nothing in `out/` over 1 MB; nothing written
  outside the experiment directory at run time.
- Reusable Python goes in a NEW module in `libs/utils/py/aei` with a test
  in `libs/utils/py/tests/`, and only when the prompt allows it. Never
  change an existing module's behaviour. No TypeScript, nothing under
  `apps/`, `deploy/` or `libs/utils/<ts module>`.
- Python only: numpy, pandas, scipy, statsmodels, matplotlib from the uv
  environment (`uv run python ...`). If a method truly needs another
  package, stop and tell the orchestrator instead of installing it.

## The record

- `experiments/TEMPLATE.md` headings, plus, before Result:
  "Mathematical foundation", "Why this method here", "Proposed
  visualisation". `by: Claude Code, operated by Artem (overnight run)`.
- Every experiment is exploratory (PROTOCOL.md) and says so under
  Hypothesis. After the plan commit, Goal, Hypothesis and Experiment are
  not edited; a change of method goes under Result, "Deviations from
  plan", with the reason.
- Result: the metrics table against the baseline rows in
  `benchmarks/overnight-2026-10-17/baselines/`, with intervals; every
  number tagged measured, computed, derived or assumed; seeds and spread;
  run time; the command that reproduces it. Interpretation: what it means
  against METRICS.md "Decision rules", the strongest alternative
  explanation, what to run next. Nothing claimed beyond its interval;
  nothing presented as decided.
- `out/metrics.json` written only through `aei.harness.write_metrics`,
  with the metric keys of `harness-spec.md` ("Metric keys"). Set
  `tuned_on_test` true if any setting was chosen after seeing a number
  computed on the scoring period (2024-10-01 to 2026-09-27).
- A statistical choice METRICS.md and DECISIONS.md do not fix is named as
  "proposed (overnight), pending Artem".

## Scoring

- Score only through `aei.score_coverage`, `aei.score_detection`,
  `aei.score_prediction` (see `harness-spec.md`), so every row is scored
  the same way. Do not re-implement a metric.
- Detectors are causal: a signal dated t uses only rows dated ≤ t. Use
  `check_causal` from `aei.score_detection` on two or three cut dates.
- Budget: 10 minutes of CPU for `run.py`. Measure it (`aei.harness.Clock`).
  Over budget: cut trials, cells or grid points, record the cut under
  "Deviations from plan"; never skip silently.
- Injection seeds: screen on seed 2026 only. Seeds 2027 to 2030 are held
  out for re-scoring winners; never use them unless the prompt says so.
- Runtime is informational: report it, never rank or cut on it, except the
  10-minute CPU budget rule.
- Deterministic: fixed seeds, sorted outputs, figures saved
  with `metadata={"Software": None}` so reruns compare equal. Run
  `uv run python scripts/verify_experiments.py --only NNNN` before you
  report; it must say "reproduces".

## Figures

matplotlib, light background, one idea per figure, axis labels with
units, counts shown beside rates, uncertainty drawn (band or interval
bars), colour never the only carrier of meaning, labels short enough to
translate into Finnish. PNG at 100–150 dpi, under 1 MB.

## Review notes

A review agent appends "## Notes from review (overnight)" at the end of
the record: each finding as a short paragraph, numbers tagged, and what
was done about it. It never edits earlier sections.

## Reporting back

Under 300 words unless asked otherwise: what ran, the headline numbers
against the baselines with intervals, CPU time, deviations, anything that
looked wrong. Say plainly what failed.
