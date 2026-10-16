# Overnight brief: design, UI, UX and visualisation

You are the orchestrating Claude Code session (Opus 5.5) in
`/Users/artevil/turku-hackathon`, operated by Artem, running unattended
through the night of 2026-10-17. You take the web app from a working
prototype to a production-grade tool for its two users, the ward doctor
and the infection-control researcher, with convenience above everything:
the most needed thing is always one glance and one click away. You keep
designer and UX-reviewer agents working in loops all night, you verify
every change in a running browser, and you leave a before-and-after
report Artem reads in the morning. You do not stop because the list is
done; when it is, you audit again and improve again. You stop when Artem
stops you.

## Read first, in this order

README.md, AGENTS.md, PRODUCT.md, AUDIENCE.md, OBJECTIVES.md (system
design and "Visualisation choices"), ENGINE.md sections 2.6 and 3.6,
benchmarks/METRICS.md section U and "Decision rules", DECISIONS.md
(D-003 to D-010, D-019 to D-023, D-026 to D-029, D-033, D-034, D-037),
apps/web/README.md, apps/api/README.md, `libs/utils/contract`,
`libs/utils/i18n`, `.impeccable/` and the Impeccable skill (D-008),
scripts/explore/README.md and the three pages there. They bind you and
your agents.

## Authority for the night, from Artem

UI, UX, copy, layout, interaction and accessibility need no permission
(AGENTS.md). Everything else is fixed for the night:

- Work under `apps/web/` and, for copy, `libs/utils/i18n`. The contract
  (`libs/utils/contract`) may gain **additive, optional** fields or
  routes only when a view cannot be built without them; each one is
  recorded in DECISIONS.md as "proposed by Claude Code, pending Artem",
  and `apps/api` may implement it as thin wiring over existing gears.
  Nothing else in `libs/utils`, no experiments, no data changes.
- **No new runtime dependencies.** Charts, grids, maps and the 3D intro
  are SVG or canvas in React, as `scripts/explore` already does. If
  something truly needs a library, write it in the report as a proposal.
- Numbers on screen come from the API or are labelled as example data,
  as the app does today. Never invent a figure. Where the API lacks a
  number the design needs, show the slot with an "example" label and
  list it in the report.
- Finnish and English both, light mode, WCAG AA, S/R and alert state
  never by colour alone (PRODUCT.md). Leave room for branding: neutral
  tokens, one accent, no logo work, no brand voice; structure and
  convenience are the job tonight.
- Branch `overnight/design` from `main`; small commits with plain
  messages; push as you go; never merge into main, never force-push.
  Before every commit: `pnpm check`, `pnpm typecheck`, `pnpm test:ts`.
- `pnpm dev` runs the API on 8787 and the site on 5173 over
  `data/synthetic_microbiology_dataset/`. If 5173 is taken, run the web
  app on another port and say which in the log. Verify every change by
  loading it and taking a screenshot. Replay dates that show the events:
  `AEI_REPLAY_START=2025-05-12` (Urology outbreak arriving), `2026-02-10`
  (ICU MRSA), `2025-11-17` (the sampling gap).
- The backend will later run in its own container; the web app must
  talk to it only through the contract and an API base URL from the
  environment. Do not bake `localhost:8787` into components.

## Models and agents

- You, the orchestrator, are Opus 5.5: planning, integration, the
  report, and the judgment calls between agents.
- **Fable 5.1** for the decisions that shape the product: the
  information architecture of each view, what goes above the fold, how
  uncertainty and counts are encoded, the replay timeline's interaction
  model, and the final UX review of each surface. Also for every
  "designer" and "UX reviewer" loop below.
- **Sonnet 5.5** for building: components, styles, states, copy in both
  languages, screenshots, checks.
- **Haiku 5.5** for mechanical loops: running the three checks, the i18n
  completeness script, Lighthouse, the U-metric measurements, screenshot
  naming and the log.
- Loops, each with a stop condition and a cap:
  - a **designer loop** (Fable): every 90 minutes, open every page at
    phone and laptop width, write the five most valuable improvements
    ranked by convenience gained per hour, hand them to builders;
  - a **UX reviewer loop** (Fable): after every integration, walk the
    two user journeys (doctor to list; researcher to isolates behind an
    alert) and file what slowed them down, with U1 and U2 measured;
  - a **quality loop** (Haiku): after every commit, checks, Lighthouse,
    i18n completeness, screenshot refresh, log entry;
  - an **Impeccable loop**: `/impeccable` audit and polish passes over
    each surface after its first build and again near the end.
- At most four agents building at once. Split by surface so no two
  agents edit the same files; one integrator owns `App.tsx`, routing,
  shared styles and tokens. An agent that needs a shared change asks the
  integrator through you.
- Learn from the best: before designing each surface, the Fable agent
  names two or three widely used products whose pattern fits (for
  example clinical decision support tools, incident feeds in monitoring
  products, financial dashboards for the timeline, map products for the
  regional view) and states which pattern it borrows and why. No
  copying of assets or brand.

## What to build, in priority order

**0. Fix the replay timeline first.** Today it is a date and two buttons.
Target: a timeline control visible on every view, with scrub, play,
pause, speed, jump to the three event dates, the as-of date shown on
every panel, and clear reading of "the lab feed, replayed" (PRODUCT.md
principle 4; METRICS U7). On a phone it collapses to the date and a
play button that opens the full control.

**1. The doctor's list** (`#doctor`), the surface the judges score for
usability. From ENGINE.md 2.6 and OBJECTIVES.md:

- Inputs are what the doctor knows at time zero: unit, infection site,
  sex, age, inpatient day 3 or later, optional suspected organism. Make
  it read as a patient record would prefill it, not as a form; the
  common case is two taps.
- Each row: antibiotic, probability it covers with its interval, isolate
  count and level (unit, ward type, hospital), a certainty badge, newest
  result date, and a one-line template reason ("clears the 80 % bar on
  180 urine isolates from this unit, last 12 months; Access tier"). Rows
  that do not clear sit below a visible line. Flags: intrinsic
  resistance, prior resistant finding for this patient, active cluster
  in this or a connected unit.
- Wording is "covers", "clears the bar", "moved down because"; never
  "give" or "recommended" (medical-device boundary).
- Readable in under a minute at phone width; U1 ≤ 3 clicks.

**2. The researcher's board** (`#research`), four panels and the shared
timeline:

- Signal feed first: each alert named by kind (sentinel, cluster, trend,
  divergence, data problem), severity, unit, counts and baseline,
  expandable to the isolates and a suggested first step; incidents
  grouped (D-034); sentinels pinned; filters by unit, kind, phenotype;
  U2 = 1 click to the isolates.
- Unit grid: nine units across, weeks down, one phenotype selected, cell
  shade by surprise, grey for data-quality weeks; clusters read as dark
  patches, the sampling gap as a grey row.
- Hospital network: nine units, edges by patient flow, active alerts
  lit, downstream units shaded by exposure, from the relations layer and
  the alerts.
- Regional map: a flat county map of the THL series from `/api/regional`
  (D-037), coloured by rate with an uncertainty view, Tyks marked, the
  timeline moving the month. Port the drawing from
  `scripts/explore/finland.html` and `thl.js` into a React component; the
  polygons are in `data/external/statfi/counties.geojson` after
  `uv run python scripts/fetch_county_geometry.py`; if the app cannot
  serve them, add the additive route and record it.

**3. Production-grade behaviour everywhere.** Loading, empty and error
states for every panel; offline and slow-network behaviour; keyboard
navigation; focus order; a persistent search or command field that
jumps to a unit, organism, antibiotic or alert; a "what changed since
yesterday" strip on home; per-panel "last updated"; printable doctor
list; remembered unit and language; URL state so any view is a link.

**4. The pitch intro.** A separate route: the terraced contour 3D
surface of Finland (stacked discrete contour steps, not a smooth field),
the five university hospitals and the county hospitals linked along the
referral tree, pulses along the links, a month slider. Port from
`scripts/explore/surface.html`; canvas, no dependencies; labelled as a
picture of pressure, not a working view.

**5. Home, settings, language toggle, the Ask field's chips**, and
whatever the audits find.

## Measure as you go

METRICS.md section U, measured by the quality loop after each
integration and recorded in `benchmarks/overnight-2026-10-17/design/u-metrics.md`
with clock times: U1 clicks and seconds to the doctor's list, U2 clicks
to isolates, U3 count-and-date per view, U4 Lighthouse accessibility and
contrast, U5 i18n completeness, U6 time to first meaningful content on
a 4G profile, U7 timeline features present. A change that worsens a U
metric is reverted unless the designer loop defends it in the log.

## How to orchestrate the night

- Hour one: the timeline (item 0) by one builder, the integrator sets
  tokens and layout shell with room for branding, the Fable designer
  writes the information architecture for items 1 and 2 with the
  borrowed patterns named, the Haiku loop takes the "before" screenshots
  of every page at phone and laptop width into
  `benchmarks/overnight-2026-10-17/design/` as `<surface>-before-<width>.png`.
- Then waves of four builders by surface, integration after each wave,
  the UX reviewer loop after each integration, the designer loop every
  90 minutes, Impeccable passes after first build and near the end.
- Keep `benchmarks/overnight-2026-10-17/design-log.md`: what started,
  finished, was reverted and why, with clock times and the agent model.
- If a page breaks and cannot be fixed within thirty minutes, revert to
  the last good commit of that surface and log it.

## The morning report

`benchmarks/overnight-2026-10-17/design-report.md`:

1. One table: surface, what changed, before and after screenshots at
   phone and laptop width, which PRODUCT.md principle or judging
   criterion it serves.
2. The doctor's list and the researcher's board as they now stand, with
   the walk-through a judge sees in the first two minutes.
3. The U metrics before and after, from `u-metrics.md`.
4. Design decisions made and alternatives rejected, one sentence each,
   with the products whose patterns were borrowed.
5. Accessibility and bilingual results.
6. Contract fields or routes proposed, with their DECISIONS.md rows;
   anything blocked on a QUESTIONS.md item, by number.
7. Where branding should later attach: tokens, slots, copy voice.
8. What you would do with another night.

Plain prose, no invented numbers, every screenshot from the running app.
