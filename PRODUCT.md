# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript on the web: React + Vite, pnpm workspaces (DECISIONS.md D-003,
D-004). Rust is planned for some gears, not yet chosen which. The iPhone
app is deferred, leaning Expo or a PWA. The data store is undecided.

## Users

Two users, served equally, probably in two sections of one tool:

- **Doctor choosing treatment** (empirical antibiotic) for a patient on
  their own ward, before the patient's own lab result is back. Has a minute
  or less, on a ward computer or a phone. The most needed answer must be one
  click away.
- **Epidemiology and AMR researchers, and infection control**, who want
  early signals: at one hospital unit, across regional hospitals, and
  nationwide. Later possibly continental and worldwide data (a patient
  arriving from abroad, where local resistance looks different).

Planned by the team's data side, not decided: patient profile risk factors
(e.g. a logistic regression on embeddings of profile text) joined to the
surveillance data. Hospital management is a secondary audience.

## Product Purpose

The Antibiotic Efficacy Indicator (AEI) for Tyks Laboratories. It shows,
continuously updated, which antibiotics still work against the bacteria in
one ward: the previous four weeks next to the annual figure, filterable by
the dataset's parameters. Today the same report is compiled once a year for
the whole hospital. Success is a clinician trusting a ward-level number
enough to act on it, and the infection control team hearing about a
deviation before the annual report would have shown it.

## Positioning

Not a BI dashboard over lab data (the organiser calls that too easy). Four
mechanisms together:

1. **Live deviation alerts.** The tool notices changes and brings them to
   the user, as results arrive.
2. **Honest small numbers.** A four-week ward figure usually has fewer
   than 30 first isolates; the tool says so and shows what it falls back
   to, instead of hiding the gap or showing a misleading percentage.
3. **Ward against hospital.** Every figure sits next to its hospital and
   annual baseline, so "is this ward different?" is answered at a glance.
4. **Units are connected.** Patients move between units (6,477 of the
   8,829 sampled patients appear in more than one, computed), so a
   resistant phenotype found in one unit is a warning for the units its
   patients go to next. The tool models these relations (patient flow,
   phenotype trail; D-009) and shows them as the home screen.
5. **Ask in plain language.** A question like "what works for E. coli in
   urine in Urology this month?" is answered from the data, with the
   numbers it rests on.

## Operating Context

- Results arrive from the laboratory over time. The demo replays the
  synthetic dataset day by day as if new results came in, and the server
  pushes updates to open clients (D-005).
- Clinical vocabulary: culture, isolate, susceptibility (S/R), first
  isolate, antibiogram, ESBL / MRSA / VRE / CPE, hospital-acquired (sample
  on day 3 of the stay or later), WHONET antibiotic codes, EUCAST.
- Units: ED, MED-A, MED-B, SURG, URO, ICU, GER, PHC-N, PHC-S. Specimens:
  urine, blood, wound. 13 antibiotics, 9 organisms.

## Capabilities and Constraints

- Counting rules the organiser points to: first isolate per patient, per
  species, per specimen type, per period; a percentage only from 30
  isolates. What "period" means, and how deviations are detected, is not
  decided (CONTEXT.md questions 8 and 11).
- S/R only; no I category, MIC, diagnoses or medication.
- The tool informs; whether it may suggest a treatment is open
  (CONTEXT.md question 6, medical-device regulation).
- Open: data store, which gears are Rust, iPhone app form, the AI model
  behind plain-language questions, how the relation layers are modelled.

## Brand Commitments

- UI language: Finnish and English with a toggle, from the start. The
  dataset carries Finnish names (`ward_fi`, `antibiotic_fi`,
  `specimen_fi`).
- Visual direction pinned by the team: white and clinical, a hospital
  feel, partly glass and blur, modern; light mode only for now (dark kept
  switchable for later). Utility for hospital staff comes before effect.

## Evidence on Hand

- The fully synthetic dataset in `data/synthetic_microbiology_dataset/`:
  10,000 patients, 46,792 cultures, 24,571 isolates, 172,381
  susceptibility results, 2023-10-02 to 2026-09-27.
- No real patients, users, testimonials or clinical validation exist. Any
  figure shown must come from the dataset or be labelled as an example.

## Product Principles

1. The number a clinician acts on states how much data it rests on.
2. Deviations come to the user; the user does not hunt for them.
3. Local first, with the wider picture one glance away.
4. Every view is current: it shows when it was last updated.
5. Inform, don't prescribe, until the judges say otherwise.

## Accessibility & Inclusion

Used on shared ward computers and phones under clinical lighting:
legible at a glance, WCAG AA contrast, S/R and alert state never carried
by color alone.
