# Planted events: what the tool must find and show

The synthetic dataset contains deviations that look deliberately planted.
Four were found by inspection on 2026-10-16 and re-measured from the CSVs
in `data/synthetic_microbiology_dataset/` (all numbers below are
measured, all isolates, no first-isolate filtering unless stated). This
file is the ground truth for the fourth judging criterion, "the solution
can detect deviations and anomalies in the data": every detection method
we consider is run against these events, and the demo shows each one
being found.

The organiser has not confirmed the list (CONTEXT.md, question 13). There
may be more events; an event found later is added here with its
measurements before any method is tuned to it.

## The events

### E1. ESBL *E. coli* cluster in Urology, June to July 2025

| | |
|---|---|
| Unit, organism, flag | URO, *Escherichia coli*, ESBL |
| Signal | ESBL *E. coli* isolates per ISO week in URO: 0, 0, 1, **5, 5, 6, 6, 5**, 1, 0, 0 for weeks 20 to 30 of 2025. Over the whole three years a URO week otherwise has 0 to 3 such isolates (1 in 26 weeks, 2 in 3 weeks, 3 in 1 week); only these five weeks reach 5 or 6. |
| Onset | Week 23 of 2025 (starts 2025-06-02). |
| Kind of signal | Cluster: a sustained count well above the unit's own baseline, one organism, one flag, one unit. Around half the patients were on day 3 or later of their stay, so it reads as hospital-acquired. |
| What the tool must show | A unit-level alert for URO naming the organism and flag, raised during week 23 or 24 at the latest, with the weekly counts and the baseline behind it, and the list of isolates. The doctor's view for URO urine in June to July 2025 must show ESBL share up and cephalosporin %S down, with the counts. |

### E2. MRSA outbreak in the ICU, March 2026

| | |
|---|---|
| Unit, organism, flag | ICU, *Staphylococcus aureus*, MRSA |
| Signal | MRSA isolates per month in ICU: 0 in every month from 2025-11 to 2026-06 except **13 in 2026-03** (of 20 *S. aureus* that month, against 4 to 6 *S. aureus* in a normal ICU month). The highest other month in the whole dataset has 1. |
| Onset | March 2026. |
| Kind of signal | Sentinel plus cluster: the first MRSA in the unit in months, then many in weeks. Also a jump in total *S. aureus*, so sampling went up with it. |
| What the tool must show | A sentinel alert on the first ICU MRSA of March 2026 (rule, not statistics), then a cluster alert within the same month. The ICU doctor's view must show MRSA share and clindamycin %S for *S. aureus* with the counts, and that the figure rests on under 30 isolates. |

### E3. Health centre South sent no samples, week 50 of 2025

| | |
|---|---|
| Unit | PHC-S |
| Signal | Cultures per ISO week in PHC-S: 64, 47, 41, 60, 51, **0**, 48, 66 for weeks 45 to 52 of 2025. It is the only unit-week with zero cultures in the whole dataset, across all nine units and 156 weeks. |
| When | 2025-12-08 to 2025-12-14. |
| Kind of signal | Data problem, not epidemiology: a feed or sampling failure. |
| What the tool must show | A data-quality alert for PHC-S in that week, separate from the epidemiological alerts, and the PHC-S four-week figures for that period flagged as resting on three weeks of data. It must not be shown as a resistance change. |

### E4. Slow rises over the whole period

| | |
|---|---|
| Series | Urinary *E. coli* resistance to trimethoprim (TMP); *Pseudomonas aeruginosa* resistance to piperacillin-tazobactam (TZP) |
| Signal | %R by calendar year, all isolates. TMP in urinary *E. coli*: **14.7, 17.4, 19.2, 20.0** for 2023 (Oct to Dec only), 2024, 2025, 2026 (to Sep). TZP in *Pseudomonas*: **5.4, 8.3, 8.8, 11.1**. |
| Kind of signal | Trend: a steady rise in a proportion, hospital-wide, over years. Invisible in any four-week window. |
| What the tool must show | A trend signal at hospital level naming the series, with the yearly or rolling-twelve-month proportions and counts. The doctor's view must show the twelve-month urinary *E. coli* TMP %S below the 80% rule of thumb by 2025 to 2026, so the ranking moves it down. |

## How detection is measured against these

For each event and each method, record in the experiment:

- **Detected**: yes or no, with the first date the method raises it in a
  day-by-day replay that uses only data before that date.
- **Delay**: days from onset (above) to the first alert.
- **Alert volume**: alerts per week across the whole hospital over the
  three years at the same threshold, so a method that finds everything
  by alerting constantly gets no credit.
- **Attribution**: whether E3 is raised as a data problem and not as an
  epidemiological event.

The method, threshold and alert budget come from DECISIONS.md, not from
this file. Tuning a method until it finds exactly these four and nothing
else is overfitting to the demo; the alert-volume line exists to catch
that.

## Showing them

The demo replays the dataset with an "as of" date. Dates that put each
event on screen:

| Event | As of | Window | Filters |
|---|---|---|---|
| E1 | 2025-07-06 | 4 weeks | URO, *E. coli*, urine |
| E2 | 2026-03-31 | 4 weeks | ICU, *S. aureus* |
| E3 | 2025-12-14 | 4 weeks | PHC-S |
| E4 | 2026-09-27 | 12 months | *E. coli*, urine, antibiotic TMP; *P. aeruginosa*, antibiotic TZP |

The data explorer in `scripts/explore/` takes the same filters and shows
the raw counts behind each one.

## Reproducing the numbers

From the repository root:

    python3 scripts/planted_events_check.py
