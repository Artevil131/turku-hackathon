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
- `aei.detect`: `profile_of`, `has_acquired_resistance`, the six
  detectors (`profile_rule`, `profile_excess` with `same_specimen`,
  `phenotype_excess`, `sampling_drop`, `resistance_shift`,
  `rising_trend` with `setting` and `exclude`), `episodes`, and the live
  set: `LIVE_SETTINGS`, `SURVEILLANCE_PAIRS`, `cluster_signals`,
  `in_detected_cluster`, `live_signals` (`@aei/detect`, D-016, D-020 to
  D-022). Poisson and hypergeometric tails come from scipy; the trend
  test keeps the TypeScript's normal-tail approximation so its p-values
  match the live tool's.
- `aei.relations`: `patient_moves`, `patient_flows`, `phenotype_trails`,
  `trail_links`, `carrier_arrivals` (`@aei/relations`, D-011, D-012).
- `aei.logistic`: `fit_logistic`, `predict` (`@aei/logistic`).

Helpers for the experiments:

- `aei.inject`: experiments/0007's injected clusters and sampling gaps.
- `aei.jscompat`: JavaScript's `toFixed`, `toPrecision`,
  `toExponential`, `Math.round`, `String(number)`, the Markdown `table`
  the TypeScript experiments wrote, and their `mulberry32` generator, so
  ported experiments print the same tables and draw the same numbers.

## Tests

    uv run pytest libs/utils/py/tests         # about 30 s; needs the dataset in data/ and Node 22

`tests/ts_dump.ts` runs the TypeScript gears on the full dataset through
Node (in the background while pytest computes the Python side), and
`tests/test_parity.py` requires the mirrors to give the same output:
same signals in the same order with the same keys, dates and observed
values, expected values and p-values within 1e-9 relative; the same
first isolates, EUCAST results, flows, trails, links and carrier
arrivals; the same 0007 trials on three seeds; the same formatted
numbers and random draws.

The live tool does not import these; logic the app needs is ported to the
TypeScript gears.
