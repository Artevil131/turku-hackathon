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
- `weeklyPatients(records, ward, phenotype, from, to)`: distinct patients
  per 7-day week anchored at `from` (not Monday), whole weeks only, so a
  window can end on the as-of date. Raw counts (D-039).
- `addDaysIso(date, n)`: date arithmetic on ISO dates.
- `poissonPmf(k, mean)`: P(X = k), log space (ENGINE.md 3.2, 3.3).
- `poissonTailMass(tail, k, mean)`: the shaded tail, X >= k (`upper`) or
  X <= k (`lower`); reuses `@aei/detect` `poissonUpper` / `poissonLower`,
  so it is the alert's own p (D-020).
- `poissonPlan(detector, observed, expected)`: bars, shaded mass and
  marked count for each live detector; the empty run is P(X = 0 | Poisson(lambda L)) (D-020, D-031). Null for the rising trend.
- `logGamma(x)`: ln of the gamma function, Lanczos (g = 7, n = 9).
- `betaDensity(x, a, b)`: Beta density in log space (ENGINE.md 0).
- `betaGrid(covered, known, steps)`: Beta(covered + 1, known - covered + 1)
  on 0..1, the flat-prior curve behind a share (ENGINE.md 2.1).
- `surprise(p, cap)`: -log10 p clipped at `cap`.
- `ALPHA`: alert levels per live detector (D-020, D-031).
- `formatP`, `formatPSup`, `formatNum`: number display for p values and
  counts, locale aware.
