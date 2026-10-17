# Agents in this repository

Read README.md and docs/PROTOCOL.md before changing anything. They bind agents
the same way they bind people.

## Do not assume technical, mathematical or statistical choices

Ask the team before deciding anything technical, mathematical or
statistical that is not already recorded in docs/DECISIONS.md. This covers, for
example:

- languages, frameworks, libraries, databases, hosting and APIs
- embedding models, vector indexes, distance metrics, chunking
- statistical methods, tests, thresholds, sample sizes, metrics, baselines
- model choice, hyperparameters, training budgets
- data sources, filters and preprocessing
- architecture and interfaces between modules

State the options you see and what each costs, then wait for an answer.
Once the team decides, add the decision to docs/DECISIONS.md in the same change
that first depends on it. Do not fill a gap with a "reasonable default"
and move on; an unstated assumption in a gear spreads to every app that
uses it.

## UI, UX and design need no permission

Layout, visual design, copy, interaction, accessibility and other user
interface work can be done straight away, without asking.

## Placement

- Reusable logic goes in `libs/utils`, never inside an app. If unsure
  whether something is reusable, treat it as reusable.
- Apps only combine utils and present them.
- Deployment goes in `deploy/`, scripts in `scripts/`, benchmarks in
  `benchmarks/`, experiments in `experiments/` following docs/PROTOCOL.md.
- Respect the dependency direction in README.md.

## Records

- `by:` in an experiment record names the harness and the person operating
  it, for example `Claude Code, operated by Artem`.
- Ask the operator before a download over 1 GB, a run expected to take more
  than an hour, or anything that spends money (paid API calls at volume,
  cloud resources), stating the size, time or cost.
