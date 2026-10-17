# aei: research packages and Python helpers

Install on Python 3.12 or newer directly from git (D-061):

```sh
pip install "aei @ git+https://github.com/Artevil131/turku-hackathon.git#subdirectory=libs/utils/py"
# Optional regional modelling and plotting dependencies:
pip install "aei[analysis] @ git+https://github.com/Artevil131/turku-hackathon.git#subdirectory=libs/utils/py"
```

## Read a research package

```python
import aei

pkg = aei.read_package("esbl-urology-spring-2025.zip")  # or its unpacked folder
print(pkg)                                            # tables and shapes
print(pkg.meta)                                       # scope, as-of date, fingerprint
pkg.isolates.groupby("ward").size()                   # also pkg.tables["isolates"]
print(pkg.fields["isolates"])                         # types, titles, descriptions, units
print(pkg.methods)                                   # numbers, methods and parameters
```

The D-060 package contains `datapackage.json`, UTF-8 CSVs, `methods.json`
and `README.md`. The reader applies nullable string, integer and boolean
columns, floating-point numbers and parsed dates/datetimes. Empty cells
become missing values; literal strings such as `NA` and isolate ids with
leading zeroes stay intact. Units remain in `pkg.fields`; figures and
reports are not loaded. Unsupported package versions and paths outside
the package are rejected. Zip files are read without extracting them.

## Reproduce the same data and numbers, offline

```python
pkg = aei.read_package("research-package.zip")
pkg.verify()          # ✓ Same data: … rows, fingerprint matches the frozen project.
aei.reproduce(pkg)    # number, id, shown, recomputed, match, method
```

Verification recomputes the D-058 row count and SHA-256 from `pkg.isolates`,
using fields marked `role: "result"` for antibiotic results. It never contacts
a server. The returned `VerifyResult` exposes `ok`, `rows`, `sha256`,
`expected_rows`, `expected_sha256` and `message`, and renders in notebooks.
Changed rows give `ok=False`; continuous packages or packages without a
frozen fingerprint give `ok=None`, not a claim that the data matches.

`reproduce()` checks the count and distinct recipes recorded in `methods.json`,
including equality filters in `where`. Distinct counts exclude missing cells;
a null filter selects missing cells. A wrong shown value gives `match=False`;
missing or unknown recipes give `match=None` and no recomputed value. These
are reproducibility checks, not new detector implementations or an assertion
that unsupported numbers were checked. Both root-layout zips and the writer's
single-top-folder zips are accepted.

## Connect to the live API

```python
live = aei.connect("http://localhost:8787", token=None, site="tyks")
iso = live.isolates(ward="URO", **{"from": "2025-03-01"})
# `from` is a Python keyword; query names follow the API contract, not `since`.
print(iso["phenotypes"])       # e.g. "ESBL;CPE"
print(iso["phenotype_list"])   # e.g. ["ESBL", "CPE"]
print(live.alerts())
print(live.weekly())           # one row per ward/week, cultures and phenotype counts
print(live.clock())
print(live.sites())
print(live.projects())
proj = live.project("esbl-urology-x1y2")
print(proj.drift)              # server's drift result, when provided
print(proj.verify())           # frozen only: refetch rows and compare count + SHA-256
```

`site` defaults data queries to one hospital and can be overridden per
call (including `site=None` for the route's unfiltered/default behaviour).
Project verification uses the project's own scope instead. It filters the
currently released isolates with `to` capped at the frozen `asOf`; it does
not move the shared replay clock or retrieve rows not yet released. A
replayed clock before the frozen cut may therefore fail verification.
Continuous projects cannot be verified. API failures raise
`aei.AeiApiError`, with `status` and `message` attributes. The HTTP client
uses only the Python standard library; pandas is imported when a table is
actually requested, not by `import aei`.

## Analysis helpers

The root uv workspace keeps the experiment dependencies (D-024):

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

## Parity rule (D-061)

A method becomes public only with a parity test against the TypeScript
gear on the same input. The app continues to run TypeScript; installability
does not stabilise the detectors' existing experimental interfaces. The
client fingerprint test runs `@aei/projects`' actual `fingerprintRows` on
three fixture records and compares the SHA-256 and count. Fingerprint
ordering assumes ASCII isolate ids and antibiotic codes (JavaScript uses
UTF-16 code units, Python uses Unicode code points).

## Tests

    uv run pytest -q libs/utils/py/tests     # about 30 s with the dataset and Node 22+

Package and HTTP-client tests use temporary fixtures and a local test
server. The fingerprint parity test skips only when Node is unavailable;
other dataset-dependent parity tests skip when the dataset is absent. The
offline package fixture also checks R parity when `Rscript` is on `PATH`
(or selected by `AEI_RSCRIPT`), using exactly the same exported package.

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

## Licence

Not chosen yet (the team decides; work in progress). `DESCRIPTION` says `Unlimited` and `pyproject.toml` names none only as placeholders, not as a choice.
