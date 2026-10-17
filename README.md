# turku-hackathon

Our challenge is the Antibiotic Efficacy Indicator (AEI) by Tyks
Laboratories: a continuously updated, ward-level view of antibiotic
resistance, for doctors choosing empirical treatment and for researchers
watching for spread. The problem, the data and the open questions are in
CONTEXT.md; who we build for and what they need is in AUDIENCE.md.
Where we are taking it, a full research tool, is in VISION.md.

## What we built: alerts we measured

We didn't stop at building alerts. We measured them. We planted 200
synthetic outbreaks for each scenario into the data. For four-patient
injections of a rare, identical resistance profile into this synthetic
dataset (a planted rare resistant clone; detection is by identical
profile), our detector at the shipped settings finds the cluster 89 % of the
time (95 % interval 84 to 93), with a median delay of 6 days, at about 4.5
signal episodes a year, about 1.0 of them cluster episodes. We tested 8
alternative methods from the surveillance literature: five detectors
(CUSUM, improved Farrington, Bayesian online change-point detection,
Gamma-Poisson with FDR, and an ensemble) and three coverage estimators. No
tested replacement met the predefined criteria at the shipped operating
point on this benchmark; that is not proof the method outperforms those
statistical families in general. These rates apply to outbreaks shaped like
our injections, which are identical copies of one isolate. The full results are in
[benchmarks/overnight-2026-10-17](benchmarks/overnight-2026-10-17/README.md).

## The repository

This repository lays the foundation so that whatever we build, a website and an
iPhone app among it, sits on one structure.

The architecture tries to generalise and keep everything as untangled as
possible. Each piece of logic is written once, in one place, behind a small
interface, and nothing reaches into another piece's internals. Making
something reusable and independent is worth an extra hour now. Untangling
it during the hackathon costs more.

## Gears and mechanisms

`libs/utils` holds the gears: embeddings, vector search, statistical
methods, data loading, scoring, API clients, anything that does one job
and can be reused. `apps/` holds the mechanisms: each app wires gears
together into something a user touches, and adds as little logic of its
own as it can. The website and the iPhone app are two mechanisms built
from the same gears, so they behave the same.

If a piece of code could be useful to a second app, a benchmark or an
experiment, it belongs in `libs/utils`, from the start.

## Layout

    libs/utils/     reusable building blocks, one module per job (the gears);
                    py/ holds the Python analysis helpers
    apps/           thin products that combine utils (the mechanisms)
      api/          development server implementing the API contract
      web/          the website
      ios/          the iPhone app
    deploy/         everything about deployment: infrastructure, containers,
                    CI/CD, environment configuration
    scripts/        every script: setup, data download, maintenance, one-offs
    benchmarks/     repeatable measurements of utils and apps (speed, quality,
                    cost) that are rerun as the code changes
    research/       background reading notes with sources (users, domain,
                    open data); describes the field, decides nothing
    experiments/    one directory per experiment, NNNN-slug/README.md,
                    started from experiments/TEMPLATE.md
    data/           datasets, git-ignored (PROTOCOL.md)
    prompts/        briefs for unattended agent sessions, dated; their reports go to benchmarks/
    CONTEXT.md      the challenge: problem, data, open questions
    AUDIENCE.md     the audiences, what each needs from the data, and who on
                    the team does what
    PRODUCT.md      product context for design work
    VISION.md       where we are going: a full research tool (projects,
                    notes, tools, export)
    OBJECTIVES.md   what we prove with the data, how it is measured, system design
    ENGINE.md       the mathematical engine, draft: every formula and output
    QUESTIONS.md    open machinery decisions with proposals, to be answered
    PROTOCOL.md     how an experiment is planned, run and recorded in git,
                    and the rules for claims
    DECISIONS.md    every technical, mathematical or statistical choice the
                    team has made, with who made it and why
    AGENTS.md       rules for AI agents working here
    pyproject.toml  the Python analysis environment, managed by uv (D-024)

## Dependency direction

Dependencies point one way:

    apps, benchmarks, experiments, scripts  ──▶  libs/utils

- `libs/utils` imports nothing from `apps/`, `benchmarks/`, `experiments/`,
  `scripts/` or `deploy/`.
- A utils module depends on another utils module only when it genuinely
  builds on it, and never in a cycle.
- Apps do not import each other. Logic two apps share moves to `libs/utils`.
- Nothing imports from `experiments/`. Code an experiment proves useful
  moves to `libs/utils` before anything else uses it.
- Configuration (keys, endpoints, model names) is passed in from outside,
  not hard-coded inside utils, so the same gear runs in every app and
  every environment.

## Stack

TypeScript on the web (React + Vite) in a pnpm workspace; Rust is planned
for some gears later. Data analysis (experiments, scripts, cross-checks)
is in Python with uv (D-024); anything the app runs stays in TypeScript.
The full list of choices, with who made them, is in DECISIONS.md. The data
store is not chosen yet.

## Running

Needs Node 22 or newer and pnpm. Unzip the organiser's dataset into
`data/synthetic_microbiology_dataset/`, then:

    pnpm install
    pnpm dev          # API on :8787 and the website on :5173
    pnpm demo         # the demo: data up to 1 June 2025, then a live HL7 lab feed (DEMO.md)
    AEI_SITES=deploy/container/config/sites.example.json pnpm dev:api   # a second hospital on the same server (deploy/integration.md)
    pnpm test         # unit tests (Vitest)
    pnpm typecheck
    pnpm check        # lint and format (Biome)

For Python analysis, with uv installed:

    uv sync
    uv run python scripts/crosscheck-stats/check.py   # TypeScript statistics against scipy

Design work goes through the Impeccable skill (`/impeccable`), installed in
the repo for Claude Code and Codex; PRODUCT.md holds the product context it
reads.
