# Engine port: what would be created or changed, and on which decision

Written by Claude Code (operated by Artem) on 2026-10-17 at Artem's request,
**before any code**. Nothing here is built yet. Items marked **OK needed**
wait for Artem; the design session is wiring the doctor screen to
`/api/coverage`, so that route's shape does not change without his OK.

## Ground rules this plan follows

- Language: TypeScript for everything the app runs, Python for analysis only
  (D-024, D-032). The engine is what the app runs, so the port is TypeScript
  packages `@aei/<name>` in `libs/utils` (D-004). No new language and no new
  runtime dependency.
- The engine runs in its own backend container (OBJECTIVES.md, "Deployment
  shape"); `apps/api` only wires engine modules to contract routes; the web
  app reaches the engine only through `libs/utils/contract` over HTTP and
  server-sent events (D-006). Nothing imports from `experiments/`.
- Only what DECISIONS.md records is ported. Anything open in QUESTIONS.md
  stays out, or goes in as a marked placeholder that names the question.
- Every number the engine returns carries its isolate count, its period
  (from, to), its fallback level and a reliability label (Artem's point 5).
  The label rule is open (QUESTIONS B11), so the field exists from the start
  and its wording is a placeholder until B11 is answered.

## Modules (ENGINE.md section 6)

| Module | Create or change | What | Rests on | Open, so placeholder or left out |
|---|---|---|---|---|
| `libs/utils/asof` (`@aei/asof`) | **create** | The one table as of t (ENGINE.md 1): first isolates by `@aei/counting`, onset (day 3 of stay, as the dataset README and today's code), masks by `@aei/eucast`; weekly counts per unit × organism × flag and per unit cultures, read by `estimate` and `detect` | D-005 (results arrive on their sample date), D-023 (365-day window), D-042 (detection reads raw counts) | A1 lookback (a parameter, default the shipped 365 days, marked A1); A2 onset equivalence with GLASS (the README's rule kept, marked A2); A4 selective-testing flag left out |
| `libs/utils/estimate` (`@aei/estimate`) | **create** | The Beta-binomial of ENGINE.md 2.1 to 2.3: Beta posterior with parent pseudo-counts, the weekly discount filter, the Dirichlet organism mix; Wilson moved here from `@aei/coverage` (re-exported there, unchanged) | D-041 (method accepted) | M, M_ext, M_π and δ are required arguments with no defaults (B1 to B4). **Not wired to any route**: D-041 says the live list keeps D-023/D-033 until tested, and 0012 and 0013 found no replacement (benchmarks/overnight-2026-10-17/README.md) |
| `libs/utils/coverage` (`@aei/coverage`) | change, additive | Each antibiotic row and each pair gains `period` (from, to), `isolates` (the level's pool), `level` (already there) and `reliability`; the four-week counts already returned as context (`recent`) gain their share and period | D-023, D-026 to D-028, D-033 | The four-week "differs" flag is B10 (options in QUESTIONS.md): a `fourWeeks.differs` field set to null and marked B10, or left out; Artem to say which. Ranking (`suggest`) stays in this package, no separate `rank` module, since moving it changes nothing |
| `libs/utils/detect` (`@aei/detect`) | change, additive | Each signal gains `period` (its window), `isolates` (patients behind `observed`) and `reliability`; the live set unchanged | D-020 (provisional), D-022, D-031, D-042 | ENGINE.md 3.1 thresholds (C1), the Gamma-Poisson test with guard band and FDR (C3, C4; refuted on unit organism series by 0015), CUSUM (C5; 0016 trails the live set), trend window (C6), divergence (3.5): all left out |
| `libs/utils/alerts` (`@aei/alerts`) | change, additive | Alerts and incidents carry the same fields; the five kinds of ENGINE.md 3.6 as a `kind` field | D-014, D-021, D-022, D-034; `kind` as a lookup from the detector name (ENGINE.md 3.6) | Whether `kind` is shown, and its wording, after 0021 (running) is read; until then a field computed by lookup, marked 0021 |
| `libs/utils/relations` (`@aei/relations`) | no change | Patient flow and phenotype trails, ENGINE.md's `network/` | D-009, D-011 to D-013 | Exposure (ENGINE.md 4) left out: D1 and D2 are open and 0019 found it not above the label-permutation null |
| `libs/utils/replay` (`@aei/replay`) | no change | The clock and the release index | D-005, D-015 | — |
| Signal store | not created | Immutable signal records (OBJECTIVES.md) | — | F3 (storage) open; the API keeps signals in memory as today |

## Contract routes (`libs/utils/contract`)

| Route | Change | Rests on | OK |
|---|---|---|---|
| `/api/coverage` | additive fields on `CoverageResponse` rows: `period`, `isolates`, `reliability`; four-week share and period beside the annual one; no field removed or renamed | D-023, D-033, Artem's point 5 | **OK needed** (the design session is wiring this route) |
| `/api/alerts`, `/api/live` events | additive fields on `Alert`: `period`, `isolates`, `reliability`, `kind` | D-020, D-021, D-034 | proposed additive; tell me if the design session must be told first |
| `/api/regional` | additive: each signal's `period` (the month) and `cases` already present; `reliability` added | D-037 | proposed additive |
| new routes | none | — | — |

## Container (`deploy/`)

| Item | What | Rests on | Open |
|---|---|---|---|
| `deploy/engine/` (create) | A container definition for the backend: Node 22 running `apps/api` with the gears, the dataset mounted read-only, `AEI_*` settings from the environment (D-015 replay start, D-017 model endpoint), a health check on `/api/meta`; the web app gets the API base URL from its environment | OBJECTIVES.md "Deployment shape", D-006, D-017 | **OK needed**: the container runtime and base image are open (QUESTIONS F2, F3); I would propose an OCI image buildable by Docker or Podman and wait |

## `apps/api`

Wiring only: parse the query, call the engine module, return the contract
type. Logic now inside `apps/api/src/main.ts` beyond that (caching keys,
query parsing) stays; anything that computes a number moves into a module
if it does today. No behaviour change.

## Order, once approved

1. `@aei/asof` with tests, used by nothing yet.
2. Additive fields in `@aei/detect` and `@aei/alerts`, then the contract and
   `apps/api` for `/api/alerts`.
3. `/api/coverage` fields, only after Artem's OK on the shape.
4. `@aei/estimate`, unwired, with tests against the Python experiment 0012.
5. `deploy/engine/` after the runtime is chosen.

Each step on its own branch from main (not `overnight/experiments`), with
`pnpm check`, `pnpm typecheck`, `pnpm test` before every commit.
