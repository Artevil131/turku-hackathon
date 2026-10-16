# Decisions

Every technical, mathematical or statistical choice the team has made.
Code and experiments depend only on choices listed here (AGENTS.md). A
reversed decision is not deleted: add a new entry and mark the old one
`superseded by D-NNN`.

| ID | Date | Decision | Why | Decided by |
|----|------|----------|-----|------------|
| D-001 | 2026-10-16 | Repository layout and dependency direction as in README.md | Website and iPhone app share one set of reusable utils | Artem |
| D-002 | 2026-10-16 | Challenge: Antibiotic Efficacy Indicator by Tyks Laboratories (CONTEXT.md) | Team choice | Artem |
| D-003 | 2026-10-16 | Web in TypeScript with React + Vite. Rust is planned for some gears later, which ones not yet chosen | TS on the web; React pairs with a later Expo app | Aapo |
| D-004 | 2026-10-16 | pnpm workspaces: `apps/*` and `libs/utils/*` are packages, gears imported as `@aei/<name>`; packages export TypeScript source, Node runs it with type stripping (Node ≥ 22) | Strict deps keep the dependency direction honest; no build step for gears | Aapo |
| D-005 | 2026-10-16 | "Continuously updated" is shown by a replay clock over the dataset; the server pushes arrivals to clients with server-sent events. A result arrives on its culture's `sample_date`, the only date in the data | Lets the demo update live from a fixed snapshot (CONTEXT.md question 10) | Aapo |
| D-006 | 2026-10-16 | The API and event contract lives in `libs/utils/contract`; `apps/api` is a TypeScript dev server implementing it over the CSVs. A Rust server may replace it behind the same contract | Web work can start now without fixing the backend language | Aapo |
| D-007 | 2026-10-16 | Vitest for tests, Biome for lint and format | Vitest shares Vite; Biome is one tool for both | Aapo |
| D-008 | 2026-10-16 | Impeccable design skill installed in the repo for Claude Code and Codex (`.claude/`, `.agents/`); its engine binary is fetched on first run, not committed | Same design guidance and checks for every agent | Aapo |
| D-009 | 2026-10-16 | Units are related through two layers: patient flow (patients sampled in two units) and phenotype trail (a resistant phenotype seen in one unit, then another). How each is modelled is not decided | The team wants to model how findings in one unit inform treatment in another | Aapo |
| D-010 | 2026-10-16 | Both users served equally: the ward doctor choosing empirical treatment and the infection control team. UI in Finnish and English with a toggle | Team choice (PRODUCT.md) | Aapo |
