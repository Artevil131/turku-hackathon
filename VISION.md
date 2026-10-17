# Vision: a full research tool

Written 2026-10-17, after talking to a judge. This is where we are going,
not what is built. The near-term fixes from the same conversation are in
JUDGE-FEEDBACK.md and RESEARCH-PLAN.md; this file is the longer direction
they should point towards.

## What changed

The judge made it clear that the researcher side is not a dashboard with a
few charts. It is a full research tool. A researcher should be able to do
their actual work in it, from first look to finished numbers, and leave
with something they can put in a paper, a report or their own analysis.

So the goal moves from "show the signals well" to "be the best tool for
studying antibiotic resistance on the data we provide".

## Who it is for

Researchers and infection-control analysts (AUDIENCE.md) who work on a
question for days or months, not minutes. Some questions are continuous
(watch this ward, keep updating). Some are a fixed piece of work (study
the spring 2025 ESBL cluster, then stop). The tool has to serve both.

## The pieces

### 1. Projects

Everything a researcher does lives in a project.

- A project pins a scope: a time frame, units or hospitals, organisms,
  phenotypes, filters. Open the project and you are back in that scope.
- A project is either **continuous** (new data flows in and every view,
  number and note stays current) or **frozen** (a snapshot: the data as
  it was on a date, so results do not move under you and can be
  reproduced later).
- A researcher can keep several projects and switch between them.

### 2. Notes

- Free notes inside a project, attached to the project, a date, a unit or
  a signal, so a note shows up where it is relevant.
- Statistical notes: a researcher writes down a hypothesis, a method or a
  result next to the data it is about.
- Import their own notes and material (documents, earlier analyses) into
  a project, so it holds everything about the question in one place.

### 3. Tools: the core of the vision

The tool set has to be really good. This is where we should spend most of
the effort. The data we provide is continuous; the tools let a researcher
derive their own data and their own answers from it, not only read ours.

Kinds of tools we want, to be refined with the team:

- **Selecting and slicing**: stackable filters on any field (time, unit,
  organism, antibiotic, phenotype, patient flow), saved as part of the
  project.
- **Data manipulation**: group, aggregate, pivot, join, derive new columns
  (rates per bed-day, rolling windows, resistance profiles), compare
  periods or units side by side.
- **Inference**: run the detectors we already measured on the researcher's
  own selection, and further statistical methods on top, with every number
  explained (how it is calculated, what it assumes). Which methods go in
  is a team decision (AGENTS.md).
- **Views**: timeline, map, unit grid, patient flow, the signal card, and
  charts built from the researcher's own derived data, all following one
  selection (RESEARCH-PLAN.md section 2).

### 4. Export

What a researcher finds has to leave the tool cleanly.

- **Diagrams**: any chart or view, for example a unit's timeline over the
  chosen frame, as an image fit for a paper or a slide.
- **Data**: the raw rows behind a view, and the researcher's derived data.
- **Analysis and numbers**: the results, with the method and parameters
  that produced them, so they can be checked and reproduced.
- **Targets**: something a researcher can open in Word, and something they
  can load into R (or Python, or a spreadsheet) to keep working. The exact
  formats are an open question below.

## The workbench (added 2026-10-17, evening)

The researcher page becomes a workbench, not a dashboard with a notes
field. Two measures decide every choice in it:

1. **Clear and intuitive**: a tool is understood and used without a
   manual, and every number it shows says how it was made.
2. **Useful**: a researcher gets something out of it they could not get
   as quickly otherwise.

What the workbench does:

- **Notebook-style cells.** A project is a sequence of cells the researcher
  arranges: a note, a pinned view (the timeline at a frame, a map month, a
  signal card, a chart), a table, a computation. Cells keep their inputs,
  re-run when the data changes in a continuous project, and stay fixed in a
  frozen one. Pin anything on screen into the notebook with one action.
- **Compare frames.** Lock two (or more) time frames, units or hospitals
  side by side and examine their differences: the same view twice, the
  difference as its own view, and our tests of the difference with the
  method stated. This is the first real tool, because it is what the
  annual report cannot do.
- **Operate freely.** We propose our metrics and our mathematics (the
  measured detectors, the coverage model, the tests), but the researcher
  can filter, group, derive and compute on the data without us in the way.
  What they compute with is open (below): the judge said they do not use R.
- **Inject data.** A project can take in more data: the hospital's live
  feed (already `/api/ingest`, per site D-051), and the researcher's own
  tables (a CSV of bed-days, a list of patients under study, an earlier
  analysis) joined on date, unit or patient, so a derived rate such as
  isolates per 100 bed-days is possible.
- **Export anything pinned.** Every cell exports (image, table, numbers
  with method), and the notebook as a whole becomes the report.

The judge's near-term points (JUDGE-FEEDBACK.md) are the first cells of
this: a signal selected anywhere is the pinned signal card.

## What stays the same

- The current researcher UI is good; the judge did not ask to replace it.
  We extend it into projects, notes, tools and export.
- Every claim is measured and explained (PROTOCOL.md). A research tool
  that hides how a number was made is worse than none.
- Gears and mechanisms (README.md): projects, notes, the tools and the
  exporters are reusable logic and go in `libs/utils`; the website only
  presents them.

## Where it is being built

RESEARCH-TOOL-DESIGN.md is the design of the first slice (projects, notes,
export, a minimal tools layer), with Artem's decisions of 2026-10-17 in its
section 0 and the open team decisions in its section 8.

## Open questions for the team

None of these are decided. Each one goes into DECISIONS.md when it is.

- Where projects and notes are stored (browser, our API, a database), and
  whether projects are per person or shared in a team.
- How a frozen project is pinned: a copy of the data, or a date cut-off
  replayed on the live data.
- Which export formats: for Word (.docx, or a report others convert), for
  R (CSV, Parquet, an .rds file, or a ready R script with the data), for
  diagrams (SVG, PNG, PDF).
- Which data manipulations and statistical methods make up the first tool
  set, and how far they go before a researcher should switch to R.
- What "import their own notes" accepts: text, Markdown, Word, PDF,
  their own data tables.
- What we can show in the hackathon demo, and what stays in this vision.
- What a computation cell runs: a fixed menu of our tools with parameters
  (no code), a small expression language over the tables, JavaScript in a
  browser sandbox, or Python in the browser (Pyodide, pandas, about 10 MB
  to load). Which statistics the researchers actually use is unknown (not
  R, per the judge); ask them before choosing.
- How a researcher's own table joins the data (keys: date, unit, patient
  id), what it may contain, and whether it is stored with the project.
