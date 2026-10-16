---
status: accepted    # proposed, then accepted, rejected or superseded
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

`uv run python experiments/0008-regional-signals/analysis.py` (about 25 s)
writes `out/results.md`. Counts from THL are measured; expected counts,
tails and correlations computed.

1. **10 signals** in 33 months across 250 series (8,250 series-months;
   1,413 of them had at least 5 cases and could signal at all). Strongest
   first: VRE carriage, Länsi-Uusimaa, 2026-07 (15 cases, 1.9 expected,
   p 2.4e-9); CPE *E. coli* carriage, **Varsinais-Suomi**, 2025-09 (8 vs
   0.6, p 1.7e-7); MRSA carriage, Keski-Suomi, 2025-07 and 2025-08 (12 vs
   2.1, 18 vs 5.0); MRSA carriage, Päijät-Häme, 2024-02; ESBL *K.
   pneumoniae* carriage, Itä-Uusimaa, 2024-02; CPE *E. coli*, Helsinki,
   2026-03; ESBL *E. coli* carriage, Pohjois-Karjala, 2025-08; MRSA in
   blood, **Varsinais-Suomi**, 2025-06 (5 vs 0.6); ESBL *E. coli* in blood,
   Pohjois-Pohjanmaa, 2026-02. The national series raised none.
2. **Synthetic hospital against Varsinais-Suomi**: ESBL *E. coli* 11.0
   first isolates a month against 26.5 county carriage cases (ratio 0.41),
   Pearson r −0.03 (p 0.85); MRSA 3.1 against 18.4 (ratio 0.17), r −0.08
   (p 0.63); 36 months.

Deviations from plan: none.

## Interpretation

On real Finnish data the regional detector raises about 3.6 signals a
year for the whole country, a volume a researcher can read. If the
tails were exact, chance would give about 1.4 signals among the 1,413
series-months that could signal; 10 is more, so some are likely real
surges, but the model probably underestimates variability for sparse
series (dispersion fitted as 1 in 8 of the 10), so the weaker signals
(p near 1e-3) may be noise. The strongest ones (VRE in Länsi-Uusimaa,
CPE *E. coli* in Varsinais-Suomi, MRSA in Keski-Suomi over two months)
are far outside chance. These are statistical signals in public
notification counts, not confirmed outbreaks; recent months can also
still grow as late notifications arrive.

The synthetic hospital does not follow its county's real series (r near
0), as expected for generated data. The two can be shown side by side
for context (the hospital's own signals next to the county's), but no
claim may link them, and the planted events (0001) have no counterpart in
the real data. The demo can say: Tyks's own county had a real CPE *E.
coli* carriage signal in September 2025, which the regional view would
have raised.

Next: show these county signals in the network view (one row per signal
with cases, expected and the month), and decide with Artem whether to
down-weight past outbreaks in the baseline (full Farrington) and to
fit a negative binomial for sparse series.

## Code moved to the shared package (2026-10-16, after close)

The regional test now lives in `aei.regional` and the THL fetch in
`aei.thl` (with a test in `libs/utils/py/tests/test_regional.py`);
`analysis.py` and `scripts/fetch_thl_ttr.py` call them. Rerun after the
move: every table identical, only the run time differs; the fetched data
is identical up to 2026-09.

## Notes from review round 2 (2026-10-16, after close)

- Chance level: the 1.4 expected signals counted only months with 5 or
  more cases. Over all 8,250 series-months about 6.7 are expected by
  chance under the fitted model, so most of the 10 could be chance; 3
  survive a Bonferroni correction. Only the strongest (VRE in
  Länsi-Uusimaa, CPE *E. coli* in Varsinais-Suomi) should be quoted.
- The test leaves out the uncertainty of the fitted mean; with it, the
  Varsinais-Suomi MRSA-in-blood signal (June 2025) drops out.
- The last months are incomplete (national MRSA carriage 94 in
  2026-09 against 166 in 2026-08), and THL revises recent months, so a
  re-fetch can change results.
- The Varsinais-Suomi CPE *E. coli* claim checks out: 1, 3, 1, 8, 3
  cases for June to October 2025.
