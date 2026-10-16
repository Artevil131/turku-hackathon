# Objectives and system design

What we are trying to prove with the data, how we measure it, and how the
result reaches people. ENGINE.md says how the numbers are computed;
QUESTIONS.md lists what the team still has to decide; this file says why
we compute them and what counts as success.

## Objective 1: infer, interpret and name the signal

The tool must notice a deviation in the laboratory data by itself, say
what kind of deviation it is, and show the evidence. The four planted
events in benchmarks/planted-events/README.md are the first test:

| Event | Kind | Must be named as |
|---|---|---|
| E1 ESBL *E. coli* in Urology, June 2025 | cluster | "ESBL *E. coli* in Urology: N isolates in 4 weeks, usual 1" |
| E2 MRSA in the ICU, March 2026 | sentinel, then cluster | "First MRSA in ICU in 12 months", then the cluster line |
| E3 Health centre South, week 50 of 2025 | data problem | "Health centre South: no samples week 50", never as a resistance change |
| E4 TMP in urinary *E. coli*, TZP in *Pseudomonas* | trend | "… resistance rising: 15% → 20% over 3 years" |

Measured in a day-by-day replay that uses only data before each day:

- **Found**: yes or no, per event and per method.
- **Delay**: days from onset to the first alert.
- **Named right**: the kind and the sentence match the table.
- **Noise**: alerts per week across the whole three years at the same
  thresholds. A method that fires constantly gets no credit for finding
  the four.
- **Not fooled**: E3 is raised as a data problem and suppresses
  resistance alerts for that unit that week.

Then beyond the four: clusters of 2, 3, 5 and 8 isolates injected at
random unit-weeks, for a curve of sensitivity and delay against alerts
per week. That curve, not the four events, is the honest statement of
how good the detection is.

The doctor's side is measured in the same replay: for every culture,
the drug probabilities before its result against the result itself.
Brier score, calibration slope, how often the top-ranked drug was
susceptible; baselines are the hospital's yearly antibiogram and the
raw ward four-week proportion.

## Objective 2: predict spread

Two levels, two different claims.

**Inside the hospital.** When a phenotype appears in unit A, which units
are at risk next? The shared-patient graph gives an exposure score per
unit. Test: after the Urology ESBL cluster, did exposure rank the units
where ESBL *E. coli* appeared in the following weeks above the others,
and better than rewired graphs with the same volumes? That is a
retrospective check on one event, so the claim stays "exposure is a
useful ordering", not "we forecast outbreaks".

**Across Finland.** Monthly county counts of MRSA, ESBL, VRE and CPE from
THL, 23 counties, 46 months. Candidate models in order of ambition:
importation pressure along the referral tree (no fitting), diffusion
along the tree (one parameter), the endemic-epidemic count model (fitted,
gives a forecast with an interval). Test: one-month-ahead forecasts for
the last 24 months scored against the actual counts, baseline "next
month equals this month". We ship a forecast only if it beats the
baseline; otherwise we ship pressure and the diffusion arrows and call
them pressure, not prediction.

Caveat that goes on the slide: these are detected carriers, driven partly
by how much each county screens; the forecastable part is modest.

## System design: compute, store, present, distribute

```
laboratory rows ──▶ ingest(day) ──▶ as-of table ──▶ estimate ──▶ doctor's list
   (replay or live)                  (first isolates,   │
                                      masks, counts)    └──▶ detect ──▶ signal store ──▶ feed, map, push
                                                               ▲
                                        open data (THL, Finres) ┘ priors and regional view
```

- **Ingest** is one function that takes a day's rows. The replay calls
  it with rows from the CSVs dated that day; a deployment calls it with
  rows from the laboratory system. Nothing else changes.
- **As-of table** is rebuilt or incrementally updated per day: first
  isolates per patient × organism × specimen within the lookback, with
  the masks applied, and the weekly counts per unit × organism × flag
  plus the data-quality counters. Everything downstream reads only this.
- **Estimate** turns counts into Beta and Dirichlet posteriors and the
  ranked list, on request, per doctor context. Cheap enough to compute
  live; no cache needed at this size.
- **Detect** runs once per day after ingest, writes signals to the
  signal store: kind, name, severity, counts, baseline, test, isolate
  ids, suggested first step, and the day it was raised. Signals are
  immutable records; a later day may add a follow-up, never edit.
- **Signal store** is also the audit trail: every alert the tool ever
  raised, with what it rested on, replayable.
- **Present**: the web app and the iOS app read the same estimate and
  signal interfaces. Doctor view: the list for a context. Researcher
  view: signal feed, unit grid over time, hospital network with
  exposure, flat regional map. The terraced 3D surface is the pitch
  intro only.
- **Distribute**: in the tool for the demo. For deployment, a push to
  infection control for sentinel and cluster signals, and a daily
  digest; the signal store already has what a message needs.
- **Open data** is fetched by scripts into data/external/ (D-025), used
  as priors at the hospital root and as the regional view. Refreshed
  monthly.
- **Deployment shape.** The backend (API, ingest, the as-of table,
  detection, the signal store, and the local language model) runs in its
  own container, separate from the web app; deploy/ holds its definition.
  Analysis stays in Python (D-024, D-030); what the app runs is
  TypeScript today and may move behind the same contract (D-006).

All reusable pieces live in libs/utils as ENGINE.md section 6 lays out;
apps only call them. The replay harness and the metrics above live in
benchmarks/ and are rerun whenever a method changes.

## Visualisation choices (team, 2026-10-17)

- Doctor: a list, no map.
- Researcher: signal feed first; flat stepped county map with time
  slider, uncertainty as a second view; unit grid; hospital network.
- Pitch: a terraced contour 3D surface of Finland for the opening, then
  the working screens. Pulsing hospitals and links stay in the intro
  only.
- The county-relief page is dropped.

## Order of work

1. As-of table and the first experiment: reproduce the organiser's
   README figures from our own pipeline (needs QUESTIONS A1 to A4 and
   F1).
2. Detection on the four events with alerts-per-week, then the
   injected-cluster curve (needs C1 to C7).
3. Doctor's list and its replay scores against the two baselines (needs
   B1 to B5).
4. Exposure on the Urology event; county forecast experiment (D1, D4,
   D6).
5. Signal store, feed and the apps on top.
