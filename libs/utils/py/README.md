# libs/utils/py

Python helpers for data analysis (D-024), installed into the root uv
environment as the package `aei`:

    uv sync                                   # once, from the repository root
    uv run python experiments/NNNN-slug/analysis.py

- `aei.dataset`: `load_dataset(dir)` into pandas; `join_isolates(data)`
  gives one row per isolate with culture, patient, phenotype flags,
  `hospital_onset`, `inpatient` and one S/R column per antibiotic code.

The live tool does not import these; logic the app needs is ported to the
TypeScript gears.
