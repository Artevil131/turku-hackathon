# libs/utils

The gears. Each module does one job (embeddings, vector search, a
statistical method, a data loader, an API client) and can be used by any
app, benchmark, experiment or script.

Rules for a module:

- One job, one directory, a README saying what it does, its interface and
  which DECISIONS.md entries it relies on.
- Imports nothing from `apps/`, `benchmarks/`, `experiments/`, `scripts/`
  or `deploy/`.
- Takes configuration (keys, endpoints, model names) as arguments or
  environment, never hard-coded.
- Has tests next to it.

Each TypeScript module is a pnpm workspace package `@aei/<name>` exporting
TypeScript source (D-004). `py/` holds the Python helpers for analysis
(D-024), installed by `uv sync` from the root `pyproject.toml`; the app
never imports them. A Rust gear, when one comes, sits behind the same
interface or behind the API contract (D-006).

| Module | Job |
|---|---|
| `domain/` | Types and code lists of the dataset |
| `dataset/` | Load the CSVs into typed, joined records (Node) |
| `replay/` | Replay clock and release index: the dataset as a live feed |
| `contract/` | API and live-event contract, typed client |
| `i18n/` | Finnish and English copy, dataset names |
| `relations/` | Patient flow and phenotype trails between units |
| `alerts/` | Alerts: a CPE isolate, MRSA or VRE new in a unit, live detector episodes; carrier arrivals per patient |
| `eucast/` | Intrinsic resistance, breakpoint gaps, inferred results, urine-only agents |
| `counting/` | Surveillance counting: first isolate per patient, organism, specimen, period |
| `detect/` | Deviation detectors and the live set: clusters, surges, sampling drops, trends |
| `coverage/` | The doctor's coverage list: share covered per antibiotic, with fallback level and counts |
| `logistic/` | L2-penalised logistic regression (experiments/0005) |
| `feed/` | The web app's data feed: its format (types only) and the browser client `@aei/feed/http` |
| `isolates/` | Feed results: first-isolate index, ISO dates, onset and age band, the 30-isolate floor |
| `empiric/` | The web app's coverage list and report tables: 4 weeks next to 12 months, filter widening, AWaRe and EUCAST tables |
| `signals/` | The web app's deviation detection over the feed: sentinel, surge, cluster, data gap, shift, trend; episodes |
| `question-filters/` | Plain-language question to checked filters, the pure browser part (no network) |
| `py/` | Python analysis helpers, package `aei` (D-024): load the dataset into pandas. Not a pnpm package |

The coverage list (D-023) and the live detection set (D-020 to D-022) are
provisional until the team reviews experiments/0002 to 0006.

`feed`, `isolates`, `empiric`, `signals` and `question-filters` are the web
app's engines over the day-by-day feed. Each overlaps a server-side gear
(`contract`, `counting`, `coverage` and `eucast`, `detect` and `alerts`,
`ask`); its README says how they differ and why both exist until the team
picks one.
