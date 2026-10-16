# Context for every agent of the design night (2026-10-17)

You work for the orchestrating session of the overnight design run, operated
by Artem. The full brief is `prompts/overnight-2026-10-17/design.md` in the
main checkout `/Users/artevil/turku-hackathon`; read it first.

- **Where to work.** The branch `overnight/design` is checked out as a
  separate worktree at `/Users/artevil/turku-hackathon-design`. Edit files
  only there, never in `/Users/artevil/turku-hackathon`. Do not commit,
  push, switch branches or stash; the orchestrator commits.
- **Running app.** API on http://localhost:8788, web (Vite dev, hot reload)
  on http://localhost:5174, already running from the worktree. Do not
  start or stop servers. The replay clock is shared by everyone: do not
  leave it playing, and seek it back to 2025-05-12 (paused) when you are done if you
  moved it.
- **Screenshots.** `benchmarks/overnight-2026-10-17/design/shoot.sh
  http://localhost:5174 <label> <surface...>` writes
  `<surface>-<label>-phone.png` and `-laptop.png` (390 and 1280 wide) with
  headless Chrome; read the PNGs to see them. Use a label of your own
  (e.g. `wip-timeline`) for working shots and delete them afterwards;
  `before` and `after` labels are reserved for the orchestrator.
- **Bounds.** Only `apps/web/` and, for copy, `libs/utils/i18n/src/en.ts`,
  `fi.ts` (every key in both, natural Finnish). No new runtime
  dependencies; charts, maps and 3D are SVG or canvas in React. The
  contract (`libs/utils/contract`) is changed only by the orchestrator.
  The app reaches the backend only through `@aei/contract`'s client and
  the base URL from `import.meta.env.VITE_AEI_API_URL` (never hard-code
  localhost).
- **Product rules.** Every number comes from the API or carries a visible
  "example" label; never invent a figure. Every number shows its count
  and as-of date in the same element or its direct label. S/R and alert
  state never by colour alone. WCAG AA contrast, keyboard reachable,
  visible focus. Light mode. Wording for the doctor: "covers", "clears
  the bar", "moved down because"; never "give", "recommended",
  "recommendation" (medical-device boundary). Branding stays neutral:
  use the tokens in `apps/web/src/styles.css`, one accent (`--live`), no
  logo or brand voice.
- **Checks before you report done.** From the worktree root:
  `pnpm check` (Biome; `pnpm format` fixes formatting), `pnpm typecheck`,
  `pnpm test:ts`. Report failures you could not fix, and which files you
  touched.
- **Report back** in under 300 words: files touched, what changed, what
  you verified (with screenshot file names), anything left undone, any
  number the design needs that the API lacks.
