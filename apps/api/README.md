# apps/api

Development server for the AEI contract (`libs/utils/contract`, D-006). It
loads the synthetic dataset, replays it day by day (D-005) and pushes
arrivals to clients over server-sent events. Wiring only; the logic is in
the gears.

    pnpm dev:api

Configuration (environment):

| Variable | Default | Meaning |
|---|---|---|
| `AEI_PORT` | 8787 | Port |
| `AEI_DATA_DIR` | `../../data/synthetic_microbiology_dataset` | Unzipped dataset |
| `AEI_REPLAY_START` | `2025-05-12` | Where the clock starts (D-015): three weeks before the Urology outbreak. `2026-02-10` shows the ICU MRSA cluster, `2025-11-17` the week without samples at Health centre South |
| `AEI_TICK_MS` | 2000 | Real milliseconds per tick while playing |
| `AEI_DAYS_PER_TICK` | 1 | Days the clock moves per tick |

| `AEI_REGIONAL` | `../../data/external/thl/regional.json` | THL county series and signals for `/api/regional`, written by `scripts/fetch_thl_ttr.py` (D-037) |
| `AEI_COUNTIES` | `../../data/external/statfi/counties.geojson` | County polygons for `/api/counties` (the regional map), written by `scripts/fetch_county_geometry.py`; 404 without it. Proposed by Claude Code, pending Artem |
| `AEI_LLM_URL` | unset | Optional llama-server URL; unset disables Ask |
| `AEI_LLM_MODEL` | empty | Served model name |
| `AEI_LLM_ACCESS_ID` | unset | Cloudflare Access service-token client ID |
| `AEI_LLM_ACCESS_SECRET` | unset | Cloudflare Access service-token secret (set together with ID) |

See [the myy LLM deployment](../../deploy/myy-llm/README.md) for the model
server and Cloudflare Access setup. Credentials stay on the API server;
startup logs only whether AI is enabled and the model name. Optional
`AEI_LLM_KEY` supplies a bearer token when the upstream needs one.

`/api/ask` validates plain-language filters against the metadata vocabulary,
using the replay date (503 without an LLM, 502 on upstream failures).
`/api/explain` serves released CPE/carrier alerts, cached by alert and language,
with a deterministic template when no LLM is configured or generation fails.
