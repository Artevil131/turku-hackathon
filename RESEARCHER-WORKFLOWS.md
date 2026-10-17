# Researcher workflows and how we fit into them

Written 2026-10-17, as a plan under VISION.md §3 and §4. Nothing here is
decided unless it names a decision; the open choices are at the end.

## What researchers in this field already do

Antimicrobial resistance work by infection-control teams, hospital
epidemiologists and surveillance researchers falls into a few recurring
workflows. Each starts from a line list of isolates and ends in a table, a
figure or a paper.

1. **Cumulative antibiogram and annual reporting.** Pull a year of lab
   results, keep the first isolate per patient, report %S per organism
   and drug, and send figures to the national network (Finres at THL, then
   EARS-Net at ECDC). Tools: WHONET, a free WHO desktop program used by
   more than 2 300 labs, with line lists, %RIS, antibiograms and outbreak
   alerts; Excel; R.
2. **Outbreak investigation.** A signal or a clinician's worry prompts a line
   list of the suspected cases, an epidemic curve by ward and week, patient
   movements and contacts, and then typing (often WGS) to confirm or rule
   out a cluster. The line list is the central artefact, and it is edited
   by hand as cases are confirmed or excluded.
3. **Trend and intervention analysis.** Weekly or monthly counts or rates
   per 1 000 bed-days, modelled with Poisson or negative-binomial
   regression, interrupted time series around a stewardship change, and
   seasonal terms. Tools: R (`glm`, `MASS`), Stata, Python (`statsmodels`).
4. **Detector and methods work.** Run aberration-detection algorithms on
   count series and compare them. The standard R tool is `surveillance`,
   whose improved Farrington method is used by public-health institutes;
   it is the same comparison we ran in experiments 0012 to 0022.
5. **Empirical-therapy evidence.** Antibiograms by syndrome and patient
   group, increasingly WISCA (weighted-incidence syndromic combination
   antibiograms). The R `AMR` package (Journal of Statistical Software,
   2022) is the common tool: `first_isolate()` with episode or phenotype
   methods, `as.sir()`, `as.mo()`, `eucast_rules()`, `antibiogram()`
   including WISCA.

What they share: **R is the main analysis language** (with `AMR`,
`surveillance`, tidyverse), Excel is everywhere for line lists and
sharing, Python is growing, and reproducible reports are written in
Quarto or R Markdown or kept in notebooks under git. A result is trusted
when the reader can see which data, cut on which date, by which method.

## Where we fit

We should not compete with R or WHONET. We should be the place where a
question starts (the signal, the live data, the scope), and hand the
researcher over to their own tools with nothing lost along the way: the
rows, the column meanings, the cut date, the method and its parameters.
Then we take their result back as notes in the project (VISION.md §2).

The rule for every hand-over: **what leaves the tool can be loaded in one
line, and says how it was made.**

## The promise: every number is reproducible

What we offer researchers is not "we also have notebooks"; it is that
**every number the tool shows can be reproduced, outside the tool, from the
same cut of the data, by the same method, and checked.** The pieces already
add up to that:

- **The same data**: a frozen project pins an as-of date and a fingerprint
  of its rows (D-058); `project.verify()` proves the rows a notebook loads are
  the rows the tool used, or says that they changed.
- **The same method**: the `aei` Python package carries our detectors and
  the coverage figure, each with a parity test against the TypeScript the
  app runs (D-061), so a recomputed number is the app's number, not an
  approximation of it.
- **The same parameters**: `methods.json` and the bundle record each
  number's method, parameters and decision ids (D-059, D-060).
- **A place to check it**: the Reproduce notebook opens in the tool
  (JupyterLite, D-062) or the researcher's own Jupyter, loads the project,
  verifies the fingerprint and recomputes the signal: "the app said 1 in
  50 000; recomputed: 1 in 50 000".

This is what the judge asked for in other words: a research tool whose
numbers can go into a paper, because a reviewer can rerun them.

## The hand-overs, from simplest to deepest

### 1. The research package (one download)

Instead of single files, one download of a zip that a researcher can unpack
anywhere and open in R, Python, Excel or Word:

```
esbl-urology-spring-2025/
  datapackage.json      tables, columns, types, units, licence (Frictionless Data Package)
  isolates.csv          the line list in scope, one row per isolate
  alerts.csv            the signals in scope
  weekly.csv            the counts behind the timeline
  methods.json          every number: method, parameters, as-of date, data fingerprint, app version
  README.md             what this is, how to load it, how it was cut
  report.docx           the same content for Word
  figures/*.svg, *.png  the views as they were on screen
  analysis.py           loads everything into pandas
  analysis.ipynb        a Jupyter starting point (also renders with Quarto)
```

`datapackage.json` is a recognised standard for describing tables, and both
R and Python have readers for it, so the column dictionary travels with the
data in a form tools understand, not just in a README. The single-format
downloads we built today (CSV, JSON, Markdown, LaTeX, Word, Python) stay;
the package bundles them.

### 2. R: not now

Aapo, 2026-10-17: we do not build for R. The CSVs and `datapackage.json`
load in R with standard readers, so an R user is not locked out; we ship no
R script or R package, and Python is where our own code is importable.

### 3. The Python package: our code, importable

`libs/utils/py/aei` already holds about 7 700 lines of Python that mirror
the TypeScript gears (D-024): counting, coverage, detectors (Poisson tail,
CUSUM, Gamma-Poisson), relations, EUCAST rules, THL readers, scoring. Today
it is the experiments' private helper package. Made installable, it would
become the researcher's way to use our methods on their own data:

```python
pip install "aei @ git+https://github.com/<org>/turku-hackathon#subdirectory=libs/utils/py"

import aei
pkg = aei.read_package("esbl-urology-spring-2025.zip")   # DataFrames with types and units
pkg.isolates.groupby("ward").size()

live = aei.connect("https://…", token=…)                  # the same rows from the live API
iso = live.isolates(site="tyks", ward="URO", since="2025-03-01")
proj = live.project("esbl-urology-x1y2")
proj.verify()                                             # frozen: refetch, compare the fingerprint (D-058)

aei.detect.poisson_tail(weekly, window=28)                # our detector on their own series
aei.coverage.wilson(iso, organism="E. coli", drug="TZP")  # the figure the doctor sees
```

Three parts, each small:

- **`aei.read_package`**: loads the research package, applying the types
  and units from `datapackage.json`.
- **`aei.connect`**: a thin client for the contract's routes (isolates,
  alerts, weekly, projects), which returns DataFrames. The contract would
  gain a generated OpenAPI file so R and other languages can have the same
  client.
- **The methods**: the existing modules with a stable, documented surface.
  The TypeScript is what the app runs, so each public Python method needs a
  parity test against the TypeScript gear on the same input
  (`jscompat.py` already matches JavaScript rounding and the seeded random
  generator, which such tests need). Without that, the Python and the app can
  disagree and nobody notices.

### 4. A Jupyter notebook template

`analysis.ipynb` opens with the data loaded through `aei.read_package`, the
scope and fingerprint printed, and the views on screen redrawn as plain
matplotlib code. The researcher edits from there, not from an empty file.
This is the hand-over that most shortens the time from "interesting signal"
to "figure in my report".

Jupyter rather than Quarto (Aapo, 2026-10-17): Jupyter is the default in
Python and opens in JupyterLab, VS Code and Colab, which suits exploring.
Quarto is for the finished, top-to-bottom report and runs Python through a
Jupyter kernel anyway; `quarto render analysis.ipynb` turns the same
notebook into HTML, PDF or Word, so we keep one template, not two.

### 4b. Reproduce it in Jupyter, inside the system (D-062)

In this order:

1. **Copy to notebook**: a project offers a ready cell for the
   researcher's own Jupyter (`aei.connect(url).project(id)`).
2. **`analysis.ipynb`** in the research package.
3. **JupyterLite in the research workspace**: a Reproduce window running
   JupyterLab in the browser (Pyodide), with the open project's data loaded
   and `aei` importable. Static files only: no code runs on our server and
   the data stays in the browser. Costs tens of MB on first load and a build
   step; `aei.connect` needs a Pyodide fetch backend. Notebooks are saved
   back as project notes (§5).
4. **Server-side Jupyter** (Jupyter Server or JupyterHub beside the API):
   native Python with kernels that have `aei`, opened prefilled from a
   project. Only after the API has per-user auth, since it runs users'
   code on our server.

### 5. Back into the tool

What the researcher learns returns as project notes (VISION.md §2): a
Markdown file, a figure, or a CSV of derived values (for example their own
case definition marking isolates in or out of a cluster). A derived column
keyed on `isolateId` can be shown in the line list and used as a filter. This
closes the loop, since the outbreak line list is exactly the table people
edit by hand.

### 6. Exchange formats for the networks (later)

Deferred (Aapo, 2026-10-17): useful in some cases, not planned yet.

Labs already move data in WHONET-style flat files, and we already ingest
that format (D-035). Exporting the line list in the same layout lets a lab
load our selection into WHONET, and WHONET's own exports go on to WHO GLASS.
This makes us a peer in the existing chain rather than a dead end.

## What every export carries (already started)

The bundle we built (D-059) already holds the scope, the as-of date, the
fingerprint for frozen projects and each number's method and parameters. It
still needs:

- the app version (git commit) and the dataset version
- the decision ids behind each method (e.g. "D-020, D-044"), linking to
  the Method page
- a suggested citation line

## Suggested order

1. The research package zip with `datapackage.json`, `methods.json`,
   README and the formats we have, which mostly reuses what is built today.
2. The installable `aei` Python package: `read_package` and `connect`
   first, then the methods with parity tests.
3. The Jupyter notebook template and the copy-to-notebook snippet.
4. JupyterLite in the workspace, then server-side Jupyter once there is
   auth (D-062).
5. Derived columns and notes coming back in.
6. Later: WHONET-layout export, and Excel if the team wants it.

## Open questions for the team

- **Zip**: the package needs a zip writer in the browser. `docx` already
  pulls in `jszip`, so making it a direct dependency adds no weight, but it
  is still a library choice. Alternatively, the API builds the zip.
- **Parquet**: much better than CSV for large or typed tables (R `arrow`,
  pandas). In the browser it means a WASM library of about 1 MB; on the
  server, one Node dependency. Or CSV only until someone asks.
- **Excel .xlsx**: probably the most used format in infection control. A
  library (SheetJS or ExcelJS), or CSV with the BOM, which Excel already
  opens.
- **Python package**: split `libs/utils/py` into its own installable
  `pyproject` (name `aei`?), published from git or to PyPI; which modules
  become the public API, and the parity-test rule for them.
- **API for scripts**: an OpenAPI file generated from the contract, and
  per-researcher tokens (today only sites have tokens, D-051).
- **Licence and data**: the organisers' dataset is not redistributable,
  so exports of it are for local use only. `datapackage.json` and the
  README should say so.
