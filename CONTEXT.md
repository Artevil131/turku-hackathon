# Context: Antibiotic Efficacy Indicator (AEI)

The challenge we chose, by Tyks Laboratories. This file states the problem
as we understand it, what is given, and what we still need to ask. It is
the starting point for talking to the judges. Nothing technical,
mathematical or statistical is decided here; those choices go in
DECISIONS.md after the team (and the judges' answers) settle them.

## What the judges told us (2026-10-16)

The tool is for two audiences, described in AUDIENCE.md:

- **Doctors** choosing empirical treatment: enter what they know about the
  patient and get a quick list of antibiotics likely to work.
- **Researchers** trying to stop harmful bacteria spreading: continuous
  data from one hospital, plus a network view of hospitals at regional,
  national, continental and worldwide level from open data, with odd
  signals raised for them.

This widens the brief: the tool should suggest antibiotics, not only show
percentages, and it reaches beyond the one hospital in the dataset.

## The problem in one sentence

A doctor choosing an antibiotic for a patient today has no up-to-date view
of which antibiotics still work against the bacteria in their own ward,
because resistance is reported once a year for the whole hospital.

## Why it matters

Antimicrobial resistance (AMR) is named by the WHO, the UN and the World
Economic Forum as one of the most serious global public health threats.
When an infection is treated before the lab result for that patient is
back (empirical treatment), the doctor relies on what usually works
locally. If the local picture is a year old and averaged over a whole
hospital, the choice can be wrong for this ward this month: an antibiotic
that no longer works, or a broader one than needed, which drives more
resistance.

## Today versus what is needed

|                | Today                          | Needed                                       |
|----------------|--------------------------------|----------------------------------------------|
| Frequency      | Compiled once a year           | Continuously updated                         |
| Granularity    | Hospital level                 | The doctor's own ward                        |
| Time window    | The past year                  | The previous four weeks, alongside annual    |
| Flexibility    | Fixed report                   | Filterable by the dataset's parameters       |

## What the organiser asks for

- A continuously updated tool for monitoring antimicrobial susceptibility
  ("e.g." in the brief: AMR is the example, not necessarily the only use).
- Results for the previous four weeks and annual results.
- Filtering by dataset parameters.

## What the organiser says is the hard part

The brief says explicitly that this is **not** a basic BI dashboard over
lab data; that is too easy and creates no real value. The hard part is a
tool that is **continuously updated**, **highly usable** and **versatile**
for the end user. An AI-native approach is one possible angle, not a
requirement.

So the problem we are solving is not "chart the data", but: how does the
right resistance information reach the right clinician, at the moment of
the decision, in a form they trust and can act on?

## How it is judged

Four criteria, weighted equally:

| Criterion                                                                  | Weight |
|----------------------------------------------------------------------------|--------|
| Demonstrated understanding of the challenge                                | 25%    |
| Overall suitability of the solution to the challenge description and insight | 25%  |
| Usability of the solution                                                  | 25%    |
| The solution can detect deviations and anomalies in the data               | 25%    |

The last criterion is not in the challenge text, and it is worth as much
as each of the others. Monitoring alone scores at most three quarters: the
tool must also notice when something changes or looks wrong and bring it
to the user's attention. What counts as a deviation or an anomaly, and how
it is detected, is not decided (see the questions below).

## What we are given

A fully synthetic microbiology laboratory dataset, kept locally in
`data/synthetic_microbiology_dataset/` (git ignores it). Figures below are
from its README (measured, as stated by the organiser) unless tagged.

- **Size:** 10,000 patients, 46,792 cultures, 24,571 isolates, 172,381
  susceptibility results, 2023-10-02 to 2026-09-27 (156 weeks).
- **Structure:** culture → 0–2 isolates → susceptibility results, joined on
  `patient_id`, `culture_id`, `isolate_id`. CSV, UTF-8, ISO dates.
- **Files:** `cultures.csv` (date, ISO week, age, ward, inpatient or
  outpatient, admission date, specimen, result positive / negative /
  mixed growth), `isolates.csv` (organism, quantity, ESBL / MRSA / VRE / CPE
  flags), `susceptibility.csv` (antibiotic, WHONET code, S/R, EUCAST
  guideline and year), `patients.csv` (sex, birth year, home area), and
  code lists `antibiotics.csv`, `wards.csv`.
- **Units:** nine. Hospital: emergency department (outpatient), internal
  medicine A and B, surgery, urology, ICU, geriatrics. Primary care: health
  centres North and South.
- **Specimens:** urine, blood, wound.
- **Antibiotics:** 13. Mecillinam, trimethoprim and nitrofurantoin are
  reported for urine only.
- **Organisms:** nine species, as Latin names. *E. coli* is close to half
  of all isolates (11,534 of 24,571, computed).

How the data was made: urinary and blood *E. coli* resistance and the ESBL
and MRSA shares are roughly calibrated to THL's Finres 2023 report;
intrinsic resistances follow EUCAST Expected Resistant Phenotypes v1.2;
other levels are illustrative. Generated with a fixed seed.

Simplifications: S/R only (no I category, no MIC or zone diameters), no
diagnoses, medication or other clinical data.

### Counting rules the organiser points to

Surveillance programmes (THL Finres, WHO GLASS, CLSI M39) count:

- only the **first isolate per patient, per species, per specimen type,
  per period**, since one patient appears many times;
- a percentage only when there are **at least 30 isolates**.

The README also notes two things that change the numbers:

- urinary *E. coli* resistance differs between women and men;
- a finding is often counted as **hospital-acquired** when the sample was
  taken on the third day of the stay or later (`admission_date`).

### Reference systems

- European: [EARS-Net data (ECDC)](https://www.ecdc.europa.eu/en/about-us/networks/disease-networks-and-laboratory-networks/ears-net-data)
- Finnish: [THL antimicrobial resistance data](https://thl.fi/en/data-and-statistics/infectious-diseases/antimicrobial-resistance#development-of-antimicrobial-resistance-in-finland)

## The core tension

The brief asks for two things that pull against each other: **recent and
local** (four weeks, one ward) and **reliable** (at least 30 first
isolates per figure).

Raw isolate counts per unit in a 28-day window (computed: all isolates, no
first-isolate filtering, 39 consecutive windows from 2023-10-02):

| Unit   | Median | Range    |
|--------|--------|----------|
| PHC-S  | 132    | 86–162   |
| PHC-N  | 128    | 99–165   |
| ED     | 122    | 95–168   |
| SURG   | 56     | 35–76    |
| URO    | 51     | 34–70    |
| MED-A  | 49     | 35–68    |
| GER    | 44     | 27–68    |
| MED-B  | 31     | 16–48    |
| ICU    | 17     | 9–27     |

These are totals across all organisms and specimens. Split by unit,
window, organism and specimen, only 141 of the 4,400 combinations that
have any isolate reach 30 (computed), and that is before the first-isolate
rule removes repeats. So a four-week figure for one ward and one organism
can almost never be reported under the organiser's own rule; the ICU never
reaches 30 isolates in four weeks even with everything pooled. How the
tool stays useful here, without hiding the problem or showing misleading
numbers, is the central design question.

## "Continuously updated" with a fixed dataset

The dataset is a snapshot that ends on 2026-09-27. "Rolling, real-time"
describes how the tool behaves as results keep arriving, which the
snapshot cannot show by itself. A demo has to show the tool updating as if
new results came in. The README describes the data as generated from
rules and probabilities; whether it also contains planted deviations is
not stated.

## Questions for the judges

Questions 1 (who the user is) and 3 (which decision the tool supports)
are answered by the judges (AUDIENCE.md) and removed. Numbering is kept so
earlier notes still match.

**Users and use**

2. Where and when is it used: at the bedside, on a ward computer, on a
   phone, during rounds? Is a mobile app useful here?

**Scope**

4. "e.g. antimicrobial resistance surveillance": should the tool be
   general enough for other laboratory indicators, or is AMR the focus?
5. Which organisms, antibiotics and specimens matter most to clinicians?
6. The judges want a suggested list of antibiotics. How should the tool
   present it so it stays decision support, given that a recommendation
   may count as a medical device under EU rules?

**Data and statistics**

7. Most ward-level four-week figures fall below 30 isolates. What would a
   clinician rather see there?
8. "Per period" in the first-isolate rule: is the period the display
   window (four weeks, one year), or a fixed one?

**"Continuously updated" in practice**

9. In a real deployment, how would results reach the tool from the
   laboratory information system (Mylab): a live feed, a daily export,
   something else? How fresh is fresh enough?
10. For the demo, is replaying the dataset as if results arrived over time
    an acceptable way to show "continuously updated"?

**Deviations and anomalies**

11. Which deviations matter most: resistance rising in a ward, a cluster
    or outbreak of one organism, an unusual resistance pattern in a single
    isolate (for example a new CPE), a ward differing from the rest of the
    hospital, or data problems (missing results, a sudden drop in
    sampling)?
12. Who should be told about a deviation, and how: shown in the tool, or
    pushed as an alert to the ward or the infection control team?
13. Does the synthetic dataset contain planted deviations we are expected
    to find? Inspection on 2026-10-16 found four that look planted (an
    ESBL *E. coli* cluster in urology, an MRSA outbreak in the ICU, a
    week with no samples from health centre South, and slow rises in two
    resistance series); they are measured and listed in
    `benchmarks/planted-events/README.md`. Still to confirm with the
    organiser whether that is the full list.

**Other**

14. Are AI or language-model components welcome, and under what
    constraints on data (even synthetic)?

## Glossary

- **AMR**: antimicrobial resistance, when bacteria survive antibiotics
  that used to kill them.
- **Culture**: a patient sample (urine, blood, wound) grown in the lab.
- **Isolate**: one organism identified in a culture.
- **Susceptibility testing (AST)**: testing whether an isolate is
  susceptible (S) or resistant (R) to each antibiotic.
- **First isolate**: the first isolate of a species from one specimen type
  of a patient in a period, so one patient sampled many times does not
  dominate the figure.
- **ESBL, MRSA, VRE, CPE**: resistant phenotypes flagged per isolate:
  extended-spectrum beta-lactamase producers, methicillin-resistant
  *S. aureus*, vancomycin-resistant enterococci, carbapenemase-producing
  Enterobacterales.
- **Hospital-acquired**: here, a finding from a sample taken on day 3 of
  the stay or later.
- **Antibiogram**: the table of resistance percentages per organism and
  antibiotic that hospitals publish, today yearly.
- **Empirical treatment**: antibiotics started before the patient's own
  test result is back.
