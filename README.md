# turku-hackathon

Our challenge is the Antibiotic Efficacy Indicator (AEI) by Tyks
Laboratories: a continuously updated, ward-level view of antibiotic
resistance, for doctors choosing empirical treatment and for researchers
watching for spread. The problem, the data and the open questions are in
CONTEXT.md; who we build for and what they need is in AUDIENCE.md. This repository lays the foundation so that whatever we build,
a website and an iPhone app among it, sits on one structure.

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

    libs/utils/     reusable building blocks, one module per job (the gears)
    apps/           thin products that combine utils (the mechanisms)
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
    CONTEXT.md      the challenge: problem, data, open questions
    AUDIENCE.md     the two audiences, their needs, and who on the team does what
    PROTOCOL.md     how an experiment is planned, run and recorded in git,
                    and the rules for claims
    DECISIONS.md    every technical, mathematical or statistical choice the
                    team has made, with who made it and why
    AGENTS.md       rules for AI agents working here

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

No language, framework, model, database or hosting provider is chosen
yet. Each choice is made by the team and recorded in DECISIONS.md before
code depends on it.
