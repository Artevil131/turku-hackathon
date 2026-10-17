# @aei/viz

The data side of the charts: pure, React-free functions that turn the
engine's counts and test results into what a chart draws (weekly series,
probability masses, densities, scales). Apps draw; this gear computes the
shapes, so the web app, the phone app and the analysis share one copy.
No statistics are decided here: each function reproduces a formula that
DECISIONS.md or ENGINE.md already fixes, and says which.

- `weeklySeries(records, cultures, from, to)`: per ISO week (Monday
  start), per unit, the distinct patients with each resistant phenotype
  and the number of cultures sampled. Raw counts (D-039: detection reads
  raw weekly counts).
