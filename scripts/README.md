# scripts

Every script: setup, data downloads, maintenance, one-off jobs. A script
is a thin entry point; logic worth reusing goes in `libs/utils` and the
script calls it. Each script states at the top what it does and how to
run it.

Run every script from the repository root.

| Script | What it does | Run |
|---|---|---|
| `explore/` | Static page for browsing the dataset (antibiogram, counts, timeline, records); a team tool, not the product | `python3 -m http.server 8765 --bind 127.0.0.1`, open `/scripts/explore/` |
| `crosscheck-stats/` | Compares the TypeScript statistics in `libs/utils` with scipy and statsmodels | `uv run python scripts/crosscheck-stats/check.py` |
| `planted_events_check.py` | Re-measures the numbers in `benchmarks/planted-events/README.md` (standard library only) | `python3 scripts/planted_events_check.py` |
| `fetch_thl_ttr.py` | Fetches THL monthly MRSA, ESBL, VRE and CPE cases by county into `data/external/thl/`, with `regional.json` (series and regional signals) for `/api/regional` (D-025, D-037) | `uv run python scripts/fetch_thl_ttr.py` |
| `fetch_thl_codes.py` | Fetches THL's organism and antibiotic codes from the Kanta code server into `libs/utils/ingest/src/thl-codes.json` (D-036) | `uv run python scripts/fetch_thl_codes.py` |
| `verify_experiments.py` | Reruns the experiments and checks each reproduces its committed `out/` files (run times ignored); under a minute in all | `uv run python scripts/verify_experiments.py [--only 0002,0009]` |
| `send_lab_results.py` | Sends dataset cultures to `/api/ingest` as HL7 v2, FHIR or CSV, day by day, for the live demo (D-035) | `uv run python scripts/send_lab_results.py --from 2025-06-02 --to 2025-06-14` |
