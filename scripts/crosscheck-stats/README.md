# Cross-check the TypeScript statistics

The live tool computes its tests in TypeScript (`libs/utils/detect`,
`coverage`), written by hand. This compares them on a fixed
grid of inputs (seed 2026) with scipy and statsmodels:

    uv run python scripts/crosscheck-stats/check.py

Poisson tails, the normal tail, Cochran-Armitage for a rise (independent
numpy version) and the Wilson interval: the statistics the live tool
runs. The Fisher test and logistic regression now exist only in Python
(scipy, `aei.logistic`, D-032).
Exits non-zero on any difference beyond tolerance.
