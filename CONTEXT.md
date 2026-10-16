# Context: Antibiotic Efficacy Indicator (AEI)

The challenge we chose, by Tyks Laboratories. This file states the problem
as we understand it, what is given, and what we still need to ask. It is
the starting point for talking to the judges. Nothing technical,
mathematical or statistical is decided here; those choices go in
DECISIONS.md after the team (and the judges' answers) settle them.

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

A fully synthetic microbiology laboratory dataset
(`synthetic_microbiology_dataset.zip`, not yet in this repository):

- 10,000 invented patients, about 47,000 urine, blood and wound cultures,
  three years, nine wards or health centres.
- Structure: patients → cultures (samples) → isolates (organisms found) →
  susceptibility results (S/R). Joined on `patient_id`, `culture_id`,
  `isolate_id`.
- CSV, UTF-8, comma-separated. A README inside the zip has more detail;
  we have not read it yet.

Organiser's guidance, as stated in the brief:

- Compute resistance percentages from the **first isolate per patient**.
- Use **at least 30 isolates** for a percentage.

Reference surveillance systems named in the brief:

- European: [EARS-Net data (ECDC)](https://www.ecdc.europa.eu/en/about-us/networks/disease-networks-and-laboratory-networks/ears-net-data)
- Finnish: [THL antimicrobial resistance data](https://thl.fi/en/data-and-statistics/infectious-diseases/antimicrobial-resistance#development-of-antimicrobial-resistance-in-finland)

## The core tension

The brief asks for two things that pull against each other: **recent and
local** (four weeks, one ward) and **reliable** (at least 30 first
isolates per figure). As a rough order of magnitude, 47,000 cultures over
three years and nine units is about 130 cultures per unit per four weeks
(derived, assuming an even spread, which the real data will not have). Not
every culture grows an organism, the first-isolate rule removes repeats,
and the count splits again by organism, sample type and antibiotic. So
most ward × organism × antibiotic combinations will likely fall below 30
in a four-week window. How the tool behaves there, without hiding the
problem or showing misleading numbers, is a central design question, and
one we want the judges' view on before we pick an approach.

## Questions for the judges

**Users and use**

1. Who is the primary user: the ward doctor choosing treatment, the
   infection control team, the microbiologist, or hospital management?
2. Where and when is it used: at the bedside, on a ward computer, on a
   phone, during rounds? Is a mobile app useful here?
3. What decision should the tool support: choosing empirical treatment,
   spotting a rising trend or outbreak, antibiotic stewardship, or all of
   these?

**Scope**

4. "e.g. antimicrobial resistance surveillance": should the tool be
   general enough for other laboratory indicators, or is AMR the focus?
5. Which organisms, antibiotics and sample types matter most to
   clinicians?
6. Should the tool only inform, or may it suggest a treatment? (A
   suggestion may bring it under medical-device regulation.)

**Data and statistics**

7. What should be shown when a ward and time window have fewer than 30
   first isolates?
8. Is "first isolate per patient" counted per year, per window, or over the
   whole history, and per organism or per organism and sample type?
9. The brief mentions S/R. Does the data or the clinical practice use the
   "I" category (susceptible, increased exposure) too?

**"Continuously updated" in practice**

10. How would the tool get data in a real deployment: a live feed from the
    laboratory information system, a daily export, something else?
11. How fresh is fresh enough: hourly, daily?

**Deviations and anomalies**

12. Which deviations matter most: resistance rising in a ward, a cluster
    or outbreak of one organism, an unusual resistance pattern in a single
    isolate, a ward differing from the rest of the hospital, or data
    problems (missing results, implausible values, a sudden drop in
    sampling)?
13. Who should be told about a deviation, and how: shown in the tool, or
    pushed as an alert to the ward or the infection control team?
14. Does the synthetic dataset contain planted deviations we are expected
    to find?

**Judging**

15. Are AI or language-model components welcome, and under what
    constraints on data (even synthetic)?

## Glossary

- **AMR**: antimicrobial resistance, when bacteria survive antibiotics
  that used to kill them.
- **Culture**: a patient sample (urine, blood, wound) grown in the lab.
- **Isolate**: one organism identified in a culture.
- **Susceptibility testing (AST)**: testing whether an isolate is
  susceptible (S) or resistant (R) to each antibiotic.
- **First isolate**: the first isolate of an organism from a patient in a
  period, so one patient sampled many times does not dominate the figure.
- **Antibiogram**: the table of resistance percentages per organism and
  antibiotic that hospitals publish, today yearly.
- **Empirical treatment**: antibiotics started before the patient's own
  test result is back.
