# libs/utils/py

Python helpers for data analysis (D-024), installed into the root uv
environment as the package `aei`:

    uv sync                                   # once, from the repository root
    uv run python experiments/NNNN-slug/analysis.py

- `aei.dataset`: `load_dataset(dir)` into pandas; `join_isolates(data)`
  gives one row per isolate with culture, patient, phenotype flags,
  `hospital_onset`, `inpatient` and one S/R column per antibiotic code.
  `load_records(dir)` gives isolate records and cultures as plain objects,
  as the TypeScript gears see them (for the mirrors below).

Mirrors of the TypeScript gears, computing the same thing so that
experiments in Python speak for the live tool:

- `aei.domain`: units and their type, antibiotics and the specimen they
  are reported for, phenotypes (`@aei/domain`).
- `aei.dates`: `add_days`, `days_between` on ISO dates (`@aei/replay`).
- `aei.eucast`: intrinsic resistance, no breakpoint, inference rules,
  `suits_specimen`, `effective_result` (`@aei/eucast`).
- `aei.counting`: `first_isolates` (`@aei/counting`).
- `aei.coverage`: `wilson` (`@aei/coverage`).
- `aei.detect`: `profile_of`, `has_acquired_resistance`, the live
  detectors (`profile_excess` with `same_specimen`, `phenotype_excess`,
  `sampling_drop`, `empty_run`, `rising_trend` with `exclude`),
  `episodes`, and the live set: `LIVE_SETTINGS`, `SURVEILLANCE_PAIRS`,
  `cluster_signals`, `in_detected_cluster`, `live_signals`
  (`@aei/detect`, D-016, D-020 to D-022, D-031). Poisson tails come from
  scipy; the trend test keeps the TypeScript's normal-tail approximation
  so its p-values match the live tool's.
- `aei.relations`: `patient_moves`, `patient_flows`, `phenotype_trails`,
  `trail_links`, `carrier_arrivals` (`@aei/relations`, D-011, D-012).
Python only, no TypeScript copy (D-032): in `aei.detect` the profile
rule (`profile_rule`), resistance shift (`resistance_shift`, mid-p Fisher
from scipy) and trends by ward type (`rising_trend` with `setting`), which
the experiments use and the live tool does not; and

- `aei.logistic`: `fit_logistic`, `predict` (experiments/0005).
- `aei.inject`: experiments/0007's injected clusters and sampling gaps.
- `aei.regional`: the monthly regional outbreak test of experiments/0008
  (`regional_signals`, `expected_month`, `upper_tail`) and the server's
  regional file (`regional_view`, D-037).
- `aei.thl`: THL's register cube (D-025), `fetch_ttr_monthly()`, used by
  `scripts/fetch_thl_ttr.py`.
- `aei.kanta`: THL's microbe and antimicrobial code lists from the Kanta
  code server, matched to the dataset (D-036), `thl_code_map()`, used by
  `scripts/fetch_thl_codes.py`.
- `aei.messages`: dataset cultures as HL7 v2 ORU^R01 messages, FHIR
  Bundles or a flat export in THL codes (D-035, D-036), for `scripts/send_lab_results.py` and
  the ingest round-trip test.

- `aei.jscompat`: JavaScript's `toFixed`, `toPrecision`,
  `toExponential`, `Math.round`, `String(number)`, the Markdown `table`
  the TypeScript experiments wrote, and their `mulberry32` generator, so
  ported experiments print the same tables and draw the same numbers.

The overnight scoring harness of benchmarks/METRICS.md (2026-10-17; specification and its choices in
benchmarks/overnight-2026-10-17/harness-spec.md), Python only:

- `aei.harness`: the split (`TUNE`, `SCORE`), screening and held-out injection seeds, cached `data()`,
  `Clock`, and `write_metrics` for every experiment's `out/metrics.json`.
- `aei.coverage_list`: a mirror of `@aei/coverage` `coverage`, `suggest`, `suggestCombinations` (checked against
  0010's TypeScript rows), with `suggest_rows` to rank another estimator's shares by the shipped rules.
- `aei.score_coverage`: coverage targets, the estimator protocol and C1 to C8 (`score_estimator`), baselines
  `hospital_365` and `shipped`.
- `aei.score_detection`: the detector protocol, the live set as a detector (`LiveSet`, with new-in-unit),
  D1 to D7 and I1 (`score_detector`, `confirm` for held-out seeds), `retune_live_set`, `check_causal`.
- `aei.score_prediction`: THL county series, P2 (`score_forecaster`, `persistence`, `seasonal_naive`) and P1
  exposure with the label-permutation null (`score_exposure`).
- `aei.inject` gained generic trials that take any detector (`seed_trials`, `rare_hits`, `common_hits`,
  `two_unit_hits`, `gap_hits`); its earlier functions are unchanged.

## Tests

    uv run pytest libs/utils/py/tests         # about 30 s; needs the dataset in data/ and Node 22

`tests/ts_dump.ts` runs the TypeScript gears on the full dataset through
Node (in the background while pytest computes the Python side), and
`tests/test_parity.py` requires the mirrors to give the same output:
same signals in the same order with the same keys, dates and observed
values, expected values and p-values within 1e-9 relative; the same
first isolates, EUCAST results, flows, trails, links and carrier
arrivals; the same formatted numbers and random draws. Only code the app
runs has a TypeScript side to compare with; the Python-only parts were
compared while their TypeScript existed (D-030) and stand alone since
(D-032).

The live tool does not import these; logic the app needs is ported to the
TypeScript gears.
