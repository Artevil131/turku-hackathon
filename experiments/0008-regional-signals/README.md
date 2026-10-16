---
status: proposed    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [thl-ttr-cases fetched 2026-10-16 by scripts/fetch_thl_ttr.py, months 2021-01 to 2026-09; synthetic_microbiology_dataset seed 2026 for the comparison]
parent:
---

# 0008 What odd regional signals does real THL county data show, and how does the synthetic hospital compare?

## Goal

The judges want researchers to see odd signals across regions, not only
inside one hospital (AUDIENCE.md). THL's register gives monthly MRSA,
ESBL, VRE and CPE cases per wellbeing services county (D-025). This
describes what a standard regional outbreak-detection method (Farrington
family, Artem's notes C8.3, used by ECDC, RKI and THL) flags in real
Finnish data from 2024 to 2026, so the network view can show county
signals with an honest alert volume; and it checks how the synthetic
hospital's monthly counts relate to its county's, so we know whether the
two can be put side by side.

## Hypothesis

Exploratory; no prediction is tested. Described:

1. For each county (23) and the whole country, and each of the 11 report
   groups, each month from 2024-01 to 2026-09: whether the month's cases
   exceed what the previous 36 months predict, and the list of signals.
2. The synthetic hospital's monthly first-isolate ESBL *E. coli* and MRSA
   counts against Varsinais-Suomi's ESBL *E. coli* carriage and MRSA
   carriage cases: scale and correlation over 2023-10 to 2026-09.

## Experiment

- Method, per series and target month t: a Poisson GLM with log link on
  months t−36 to t−1 (intercept, linear time, one annual harmonic),
  quasi-Poisson dispersion φ = max(1, Pearson χ² / df); expected count μ
  for month t; upper tail P(X ≥ observed) under a negative binomial with
  mean μ and variance φμ (Poisson when φ = 1). Signal when that tail is
  below 0.001 and the month has at least 5 cases. Past outbreaks are not
  down-weighted (a simplification of Farrington). The partial month
  2026-10 is left out.
- Comparison: the synthetic hospital's first isolates per patient,
  organism and calendar month (`aei.dataset`), flagged ESBL *E. coli* or
  MRSA; Pearson correlation with the county series, monthly.
- Code: `analysis.py` here, Python with statsmodels (D-024):
  `uv run python experiments/0008-regional-signals/analysis.py`, after
  `uv run python scripts/fetch_thl_ttr.py`. Output: `out/results.md`.
  Budget: about a minute on a laptop.

## Result

## Interpretation
