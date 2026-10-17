# benchmarks

Repeatable measurements of utils and apps (speed, quality, cost) that are
rerun as the code changes. An experiment answers a question once; a
benchmark keeps measuring. One directory per benchmark with a README
naming what it measures, the data version, the metric (from
docs/DECISIONS.md) and the command that runs it. Results are committed with
the commit hash they were measured on.

`METRICS.md` defines the metrics every method is scored on and the `out/metrics.json` each experiment writes.

| Benchmark | What it measures | Run |
|---|---|---|
| `planted-events/` | The four events in the synthetic dataset the tool must detect and show, with how detection is scored (delay, alert volume, attribution) | `python3 scripts/planted_events_check.py` re-measures the events |
