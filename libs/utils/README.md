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

No language is chosen yet (DECISIONS.md). If the website and the iPhone
app end up in different languages, a gear lives either behind a service
the apps call or once per language with the same interface; that choice
is the team's.
