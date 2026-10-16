# Design night log, 2026-10-17

Orchestrator: Claude Code (Opus 5.5), operated by Artem. Brief:
prompts/overnight-2026-10-17/design.md. Times are local (Europe/Helsinki).

Setup: the branch `overnight/design` is a separate worktree at
`/Users/artevil/turku-hackathon-design`, because another session's dev
server already held 5173 and 8787 and the experiments night may use the
main checkout. Here the API runs on **8788** and the web dev server on
**5174** (`AEI_PORT=8788`, `AEI_API_URL=http://localhost:8788 vite --port 5174`).
Screenshots come from headless Chrome through
`design/shoot.sh` (390 and 1280 px wide).

| Time | Agent (model) | Event |
|---|---|---|
| 01:08 | orchestrator (Opus 5.5) | Worktree, servers on 8788/5174, before screenshots of home, doctor, research, settings at phone and laptop width |
| 01:08 | designer (Fable 5.1) | Started: timeline interaction model (spec-timeline.md) |
| 01:08 | designer (Fable 5.1) | Started: information architecture of the doctor's list and the researcher's board (spec-doctor.md, spec-research.md) |
| 01:08 | orchestrator (Opus 5.5) | Web app reads the API origin from VITE_AEI_API_URL (empty = same origin) instead of a fixed default |
| 01:08 | orchestrator (Opus 5.5) | `pnpm check` already fails on main with 6 errors, all in scripts/explore (surface.html, thl.js), outside tonight's bounds; the commit gate is Biome over apps/web, libs/utils/i18n and benchmarks/overnight-2026-10-17, plus pnpm typecheck and pnpm test:ts |
| 01:09 | orchestrator (Opus 5.5) | Branding slots: --brand-accent, -soft, -ink, fonts and radius feed the existing tokens; rendering unchanged (checked in browser) |
| 01:10 | orchestrator (Opus 5.5) | Additive optional route GET /api/counties (contract, client, API wiring, test, AEI_COUNTIES); DECISIONS.md D-040 proposed, pending Artem |
