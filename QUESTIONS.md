# Open questions about the machinery

Everything the engine (ENGINE.md) and the prototypes still need the team
to decide. Each item has a proposal; answering "accept" moves it to
DECISIONS.md, anything else replaces the proposal. Numbering is stable so
answers can refer to it.

**Status (2026-10-17):** D-044 and D-046 settle every item in A to F;
only A2's onset wording, asked of the organisers, and the questions to
the judges and organiser in G remain open. The tables below keep the
original proposals for the record.

## A. Counting

| # | Question | Proposal |
|---|---|---|
| A1 | First-isolate lookback: the display window itself, or a fixed period? | Fixed 365 days, same at every level, so counts add up across levels. |
| A2 | Hospital-acquired cutoff: day 3 of stay (README) or GLASS's "more than 2 calendar days"? | Day 3 of stay; confirm with the organiser that it is the same thing. |
| A3 | Which (organism, drug) pairs are intrinsically resistant? | EUCAST Expected Resistant Phenotypes v1.2, as the README says the data follows. |
| A4 | Selective-testing flag threshold. | Flag when a drug is tested on under 85% of an organism's isolates. |

## B. Estimation (doctor)

| # | Question | Proposal |
|---|---|---|
| B1 | Prior strength M for ward → hospital. | 30, so "half own data" coincides with the 30-isolate rule. |
| B2 | Prior strength M_ext for hospital → Finres national figure. | 30. Jeffreys Beta(0.5, 0.5) where Finres has no matching cell. |
| B3 | Recency: the discounted Beta-binomial (ENGINE 2.2) with which weekly discount δ, or hard windows? | Discounted filter for the ranking: δ = 0.95 for organism × drug cells, 0.90 for flags; raw 28-day and 365-day counts displayed beside it. |
| B4 | Organism-mix prior strength M_π. | 30. |
| B5 | Coverage threshold τ per syndrome. | 0.80 community urine; 0.90 blood and hospital-acquired. |
| B6 | Prior resistant finding of the patient: change the number or annotate? | Annotate and move affected drugs below unaffected ones; do not change the number in v1. |
| B7 | Active cluster in a connected unit: change the doctor's number or annotate? | Annotate in v1 with the exposure score shown. |
| B8 | Covariate model (logistic regression per organism-drug) in scope? | Not in v1; only after the count model is validated in replay. |
| B9 | How the ranking is shown: tiers by τ then AWaRe tier then coverage, or plain coverage sort? | Tiers, with a toggle to plain sort. |
| B10 | The doctor's screen shows the unit's four-week figure beside the annual one: when is the difference flagged, on counts this small? | No proposal (Artem asked for options with costs, not a pick): see "B10 and B11: options" below. |
| B11 | What plain-language reliability label goes with every number sent to the app (with its isolate count and period)? | No proposal: options below. Only the 30-isolate floor (D-023) is decided. |


### B10 and B11: options (overnight run, 2026-10-17)

Added by Claude Code, operated by Artem, at his request; nothing here is
chosen. Numbers are computed on the synthetic data's scoring period
(2024-10-01 to 2026-09-27) unless marked derived.

**How small the four-week figure is.** Tested results per unit × specimen
× antibiotic in a 28-day window (first isolates): median 27 in urine, 6 in
wound, 2 in blood; 59 % of cells have under 10 and 77 % under 30
(computed). Most four-week figures rest on fewer results than the 30 the
organiser asks for (D-023).

**B10, when to flag "the four weeks differ from the year".** Costs below
use a year share of 85 % on 300 results and a true four-week share of
70 % (derived, exact binomial). A screen shows up to 10 drugs, so a
per-drug false-flag rate α gives a chance 1 − (1 − α)^10 of at least one
false flag per screen: 0.40 at α = 0.05, 0.10 at α = 0.01 (derived).

| Option | Rule | False flags per drug, n = 10 / 20 / 40 | Power at 70 %, n = 10 / 20 / 40 | Other costs |
|---|---|---|---|---|
| O1 | One-sided exact binomial (or Beta-binomial predictive, D-038) test of the four-week count against the year's share, α = 0.05 | 0.050 / 0.022 / 0.030 | 0.35 / 0.39 / 0.69 | Many flags per screen at α = 0.05; needs α decided; the Beta-binomial version needs M and δ (B1, B3) |
| O1′ | O1 at α = 0.01 | 0.010 / 0.006 / 0.004 | 0.15 / 0.23 / 0.42 | Rarely fires on blood or wound cells at all |
| O2 | O1 with Benjamini-Hochberg across the drugs on one screen | below O1's | below O1's | Flags depend on which drugs are shown; harder to explain |
| O3 | Flag when the two 95 % intervals (Wilson) do not overlap | 0.010 / 0.006 / 0.006 | 0.15 / 0.23 / 0.42 | The easiest to explain ("the ranges do not overlap"), about as strict as O1′ |
| O4 | Flag when the difference is at least 10 points and the four weeks have at least 10 results | 0.377 / 0.106 / 0.042 | 0.65 / 0.58 / 0.69 | Ignores sampling noise: at 10 results it flags 38 % of unchanged cells |
| O5 | Flag when the posterior probability (D-038 Beta-binomial) that the four-week share is lower than the year's by Δ is at least 0.9 | depends on M, δ, Δ | depends | Reads as "probably lower"; needs M, δ (B1, B3) and Δ |
| O6 | No flag on the doctor's screen: both figures shown with their counts; real changes reach infection control through the detectors (D-039) | 0 | 0 | The doctor must judge two numbers; nothing to tune |

Whichever is chosen, the flag would be a detection-like signal on raw
counts (D-039), and the experiments 0004 and 0012 found that the
four-week figure itself predicts the next four weeks worse than the
year (0004: +0.0058 Brier for the unit's raw 28 days).

**B11, the reliability label.**

| Option | Label from | Example | Costs |
|---|---|---|---|
| L1 | The decided 30-result floor (D-023) only | "30 or more results" / "under 30 results: indicative" | Rests on a decided number; ignores interval width (31 results at 50 % have a 95 % interval about ±17 points, derived) |
| L2 | Width of the 95 % interval | "precise" (half-width ≤ 5 points), "approximate" (≤ 10), "uncertain" (> 10) | New thresholds; width is narrow near 0 % and 100 % even at small counts |
| L3 | Own-data weight w = n / (n + M) (ENGINE.md 2.1) | "mostly this unit's data" / "half" / "mostly hospital data" | Needs M (B1); meaningful only once D-038 replaces D-023 |
| L4 | The fallback level (D-033, decided) plus the count | "Hospital figure: the unit has 12 results" | Longer text; rests only on decided rules; combines with L1 or L2 |

## C. Detection (researcher)

| # | Question | Proposal |
|---|---|---|
| C1 | Data-quality thresholds: sampling drop, surge, testing fraction, guideline change. | Drop < 25% of trailing median; surge > 2×; testing < 85%; any guideline-version shift. |
| C2 | Sentinel rules and their day counts. | Any CPE; first MRSA/VRE in a unit in 90 days; first of any flag hospital-wide in 365 days; 2+ identical rare 13-drug profiles in a unit within 14 days. |
| C3 | Cluster test: baseline length, guard band, shrink toward hospital. | 26 weeks, 4-week guard band, k = 0.1. |
| C4 | Multiplicity: FDR level q and weekly alert budget B. | q = 0.05 after Tarone's filter; B = 3 per week hospital-wide. |
| C5 | CUSUM parameters θ and h. | θ = 2.5; h set by replay to meet B. |
| C6 | Trend test window and minimum change. | 24 months; 3 percentage points over 12 months. |
| C7 | Thresholds tuned on which data? | Year 1 of the replay; judged on years 2 and 3. |
| C8 | Connected-unit clusters: which unit sets are tested? | Pairs and triples connected by significant edges. |

## D. Network and open data

| # | Question | Proposal |
|---|---|---|
| D1 | Within-hospital edge: window for "A then B". | 30 days, divided by the number of units the patient visited. |
| D2 | Null model for edges. | Degree-preserving rewiring of the patient–unit graph, 1,000 replicates. |
| D3 | Catchment assignment of Åland. | TYKS, with a note. |
| D4 | Flow matrix between counties for diffusion and arrows. | Catchment tree edges weight 1; gravity term pop_A·pop_B/dist² scaled to 0.3 of the tree weight for the five strongest non-tree pairs. |
| D5 | Smoothing bandwidth for the surface view. | 120 km Gaussian; the surface is labelled cosmetic, numbers come from the stepped map. |
| D6 | Forecast model across counties: pressure only, diffusion, or the endemic-epidemic (hhh4) model? | Fit hhh4 as an experiment; ship pressure and diffusion arrows; ship the forecast only if it beats "next month = this month" in replay. |
| D7 | Which hospitals appear on the map. | The five university hospitals and one central hospital per county. |

## E. Evaluation

| # | Question | Proposal |
|---|---|---|
| E1 | Doctor metrics. | Brier, calibration slope, top-1 coverage; baselines: hospital 12-month antibiogram and raw ward 4-week proportion. |
| E2 | Alert metrics. | Detection and delay on the four planted events; alerts per week; injected clusters of 2, 3, 5, 8 for the sensitivity curve. |
| E3 | Does the organiser confirm the planted events list? | Ask (CONTEXT.md question 13). |

## F. Product and stack

| # | Question | Proposal |
|---|---|---|
| F1 | Language and libraries for libs/utils. | Decided upstream: TypeScript for what the app runs, Python with uv for analysis (D-003, D-004, D-024, D-032). |
| F2 | Local language model for the doctor's brief analysis and the researcher's signal prose: which model, which container runtime, what latency budget? | A small instruction-tuned model served from a container beside the engine, generated with the list so it is on screen within 2 s. Fixed requirements, not choices: it reads only the structured fields, every number in its text must match a field or the sentence is dropped, it never reorders or adds drugs, and the wording is "covers" and "clears the bar", never "give". Deterministic template reasons are always shown underneath. |
| F3 | Storage for the as-of table and replay. | Open; today the API holds the dataset in memory and replays it (D-005). |
| F4 | How "continuously updated" is demonstrated. | Day-by-day replay with a date control; confirm with the judges (CONTEXT.md question 10). |
| F5 | Where the researcher's signals are delivered: in the tool, or pushed? | In the tool for the demo; say in the pitch that a push to infection control is the deployment step. |

## G. Asked of the judges or organiser, not the team

CONTEXT.md questions 2, 4 to 14, plus: is the day-3 onset rule the same as GLASS's 48 hours (A2); is the planted-events list complete (E3); may replay stand for live updating (F4).
