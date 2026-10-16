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
