# apps/web

The website. A thin layer over `libs/utils`; see ../README.md.

## Smoke test

    pnpm smoke                      # starts API + web on the real dataset (clock 2025-06-10)
    pnpm smoke -- --fixture         # the small committed fixture, as CI runs it
    SMOKE_URL=http://localhost:5173 pnpm smoke   # an app that is already running

`scripts/smoke.mjs` drives Chrome over the DevTools protocol (no extra
dependencies): every route at desktop and phone size, then tab switching,
stepping the simulation a day and switching the language. It fails on a
console error, an uncaught exception, a failed `/api` request, a missing
heading, horizontal overflow or a page that never finishes loading, and
writes screenshots and `report.md` to `smoke-out/`. The fixture in
`scripts/smoke-fixture/` is written by its `gen.mjs` and passes the data
checks of `@aei/quality`.
