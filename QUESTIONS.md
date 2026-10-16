# Open questions about the machinery

Everything the engine (ENGINE.md) and the prototypes still need the team
to decide. Each item has a proposal; answering "accept" moves it to
DECISIONS.md, anything else replaces the proposal. Numbering is stable so
answers can refer to it.

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
