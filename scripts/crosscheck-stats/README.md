# Cross-check the TypeScript statistics

The live tool computes its tests in TypeScript (`libs/utils/detect`,
`coverage`, `logistic`), written by hand. This compares them on a fixed
grid of inputs (seed 2026) with scipy and statsmodels:

    uv run python scripts/crosscheck-stats/check.py

Poisson tails, the one-sided mid-p Fisher test (hypergeometric), the
normal tail, Cochran-Armitage for a rise (independent numpy version), the
Wilson interval and an unpenalised logistic regression (statsmodels Logit).
Exits non-zero on any difference beyond tolerance.
