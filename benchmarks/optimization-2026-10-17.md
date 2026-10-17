# Optimization, measured (2026-10-17)

Measured on commit `926376e` (the base of branch `claude/m5-optimize-014a29`), then after each change.
Each step is one commit and is remeasured with the same commands. Nothing here is a statistical
claim: these are timings and file sizes on one machine, one run of the dev servers, and the medians
of the stated repeats.

## How it was measured

- **Data and clock.** Synthetic dataset (`data/synthetic_microbiology_dataset`, git-ignored, read from the main
  checkout), THL regional and Statistics Finland county files as in the main checkout. The replay clock is
  paused at **2025-06-10** (seek, then pause), so every run sees the same `asOf`. `from` for the one-year
  queries is **2024-06-10** (365 days before the clock).
- **API.** API on `AEI_PORT=8798` (`pnpm dev:api`, Node 26 in this shell, node_modules installed for the
  worktree). `curl -w "%{time_total}"`, 5 requests per endpoint, median (the third value). The script is
  `/private/tmp/claude-501/bench/api.sh` (the commands are listed below).
- **Web build.** `pnpm --filter @aei/web build` (tsc, then `vite build`). Sizes from Vite's output, not gzip only.
- **Smoke.** `apps/web/scripts/smoke.mjs` against the Vite dev server on `:5188` (proxying the API above). The
  smoke prints no per-route timing, so each route was timed as one smoke run:
  `--routes <route> --interactions none`, both viewports, wall time from the shell, median of 3 runs.
  That wall time includes starting Chrome and the page loads of both viewports, so it is a fixed-overhead
  number; it is good for comparing before and after, not for reading an absolute latency.
  The full smoke (19 checks and interactions) was run once before and after: 19 of 19 passed at baseline.

Commands:

    curl -w "%{time_total}" "http://localhost:8798/api/alerts?from=2024-06-10"
    curl -w "%{time_total}" "http://localhost:8798/api/weekly"
    curl -w "%{time_total}" "http://localhost:8798/api/isolates?from=2024-06-10"
    curl -w "%{time_total}" "http://localhost:8798/api/regional"
    curl -w "%{time_total}" "http://localhost:8798/api/counties"
    pnpm --filter @aei/web build
    SMOKE_URL=http://localhost:5188 CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node apps/web/scripts/smoke.mjs

## Baseline (926376e)

### API response time, seconds (median of 5)

| Endpoint | Median | All five | Body |
|---|---|---|---|
| `/api/alerts?from=2024-06-10` | 0.000708 | 0.000959 0.000719 0.000668 0.000641 0.000708 | 4 099 B |
| `/api/weekly` | 0.000435 | 0.040645 0.000487 0.000435 0.000412 0.000400 | 10 624 B |
| `/api/isolates?from=2024-06-10` | 0.008374 | 0.018171 0.008374 0.008228 0.010589 0.007832 | 2 734 991 B |
| `/api/regional` | 0.001186 | 0.002270 0.001151 0.001149 0.001315 0.001186 | 90 210 B |
| `/api/counties` | 0.000960 | 0.001622 0.001054 0.000960 0.000898 0.000906 | 103 120 B |

### Web build, the three largest chunks (raw / gzip)

| Chunk | Raw | Gzip |
|---|---|---|
| `ResearchBoard-*.js` | 662.91 kB | 195.98 kB |
| `index-*.js` | 365.21 kB | 112.51 kB |
| `jsx-runtime-*.js` | 172.35 kB | 56.31 kB |

Other chunks: `ConnectPage` 44.96 kB, `MethodPage` 17.52 kB, `PitchIntro` 11.34 kB, `math` 11.38 kB,
`Settings` 2.22 kB, `surface` 5.27 kB. CSS: `index` 85.75 kB, `ResearchBoard` 35.90 kB.

### Smoke, wall seconds per route (both viewports, no interactions; median of 3)

| Route | Median | All three |
|---|---|---|
| home | 4.34 | 4.52 4.15 4.34 |
| doctor | 4.17 | 4.01 4.31 4.17 |
| research | 4.67 | 4.73 4.67 4.59 |
| method | 4.80 | 4.85 4.80 4.39 |

Full smoke at baseline: 19 of 19 passed in 50.0 s.

## Step 1: API caches (alerts, regional, counties)

Change: `/api/alerts` keeps its built JSON per `asOf|from|site` (50 entries, cleared like `weeklyCache`);
`/api/regional` keeps the built JSON per `asOf` and the query (JSON-quoted key, so group and region cannot
collide), 200 entries, and no longer reads and parses the file per request; `/api/counties` keeps the file
as compact JSON once (the file is pretty-printed, so the first version sent 111 095 B and was changed back
to the 103 120 B of the old response). All three are cleared on ingest, next to `coverages.clear()`, and
answer with `Cache-Control: no-store`, the only header added.

### After step 1

| Endpoint | Before (median) | After (median) | After, all five |
|---|---|---|---|
| `/api/alerts?from=2024-06-10` | 0.000708 | 0.000538 | 0.000738 0.000538 0.000568 0.000461 0.000498 |
| `/api/weekly` (not changed) | 0.000435 | 0.000545 | 0.029070 0.000545 0.000613 0.000468 0.000466 |
| `/api/isolates?from=2024-06-10` (not changed) | 0.008374 | 0.007063 | 0.007852 0.007063 0.006705 0.006915 0.008330 |
| `/api/regional` | 0.001186 | 0.000511 | 0.001946 0.000566 0.000511 0.000449 0.000434 |
| `/api/counties` | 0.000960 | 0.000437 | 0.001411 0.000437 0.000618 0.000431 0.000430 |

`/api/weekly` and `/api/isolates` were not touched; their differences are run-to-run noise on this machine
(the first request of a run is the slowest for every endpoint). Tests: `npx vitest run apps/api`, 17 of 17 passed.

## Step 2: web code split (export gear and projects window on demand; React in its own chunk)

Change: the export gear (`@aei/export`, which brings `docx` and `jszip`) is no longer imported by the research
page's code. `ProjectControls` loads it with `import()` when an export is asked for, and its export menu and the
projects window are `React.lazy` boundaries. `bundle.ts` imports `@aei/export` and `@aei/export/dom` on demand.
`vite.config.ts` puts `react`, `react-dom` and `scheduler` into one `react` chunk (`manualChunks`, through
`build.rolldownOptions`, since this is Vite 8).

What was already lazy and is left as it was: the Method page, the Connect page, Settings and the pitch intro
(`App.tsx`). Home and the doctor's list are in the main chunk, as before.

### Web build, after step 2 (raw / gzip)

| Chunk | Before | After |
|---|---|---|
| `ResearchBoard-*.js` | 662.91 kB / 195.98 kB | 101.74 kB / 32.05 kB |
| `index-*.js` | 365.21 kB / 112.51 kB | 154.47 kB / 46.96 kB |
| `jsx-runtime-*.js` (React, before) / `react-*.js` (after) | 172.35 kB / 56.31 kB | 218.76 kB / 68.27 kB |
| `src-*.js` (shared app code, after only) | — | 163.16 kB / 52.67 kB |
| `src-*.js` (export gear, lazy, after only) | — | 555.41 kB / 162.33 kB |
| `ExportMenu-*.js` / `ProjectsPanel-*.js` (lazy, after only) | — | 1.70 kB / 4.37 kB |

The lazy export chunk is above Vite's 500 kB warning limit; it loads only when an export is asked for.

### JavaScript on the first visit to `#research` (decoded bytes, measured in Chrome from the built app)

| Build | Files | Bytes | Gzip (build output) |
|---|---|---|---|
| Before (926376e) | `index` 365 212, `jsx-runtime` 172 354, `math` 11 382, `ResearchBoard` 662 917, `surface` 5 273 | 1 217 138 | 371.2 kB |
| After step 2 | `rolldown-runtime` 989, `index` 154 472, `react` 218 766, `src` (shared) 163 160, `math` 11 412, `ResearchBoard` 101 745, `surface` 5 273 | 655 817 | 206.9 kB |

First visit to `#home` before: `index` 365 212 and `jsx-runtime` 172 354, 537 566 bytes in total (the list in the
browser had only these two files). The after-step-2 home figure is in the table at the end.

Smoke: the full smoke passes (`apps/web/scripts/smoke.mjs` against the dev server, 23 of 23, including the
projects interaction that downloads each export format). The per-route wall times below are dev-server runs
with `--interactions none`; they measure the harness and Chrome start, not the bundle, because the dev server
does not bundle.

First visit to `#home` after step 2 and 3: `rolldown-runtime` 989, `index` 154 472, `react` 218 766 and the shared
chunk `src-A3…` 163 160, 537 387 bytes in total, against 537 566 before. The split moves bytes out of `index`
into `react` and the shared chunk; the home page downloads the same amount. The shared chunk holds `@aei/sites`
and `@aei/ingest` (the lab code maps, `AEI_SITES`), which the web app reads for its hospital list on every page.
Keeping ingest out of the web bundle is the next thing to try (a follow-up: `sites.ts` is outside this change).

## Step 3: memoisation in the web app (groupIncidents, useWeekly)

Change: `useIncidents` keeps the alerts array the board already has when a new fetch returns the same alerts
(compared by value), and groups incidents once per alerts array (`useMemo` on `alerts`, not on the load
object, which changes on every clock tick because `asOf` is part of it). The `biome-ignore` comment on that
effect was removed: Biome reported it as unused, before and after the change. `useWeekly` remembers the window it
last asked for (`from` and `asOf`), so an effect run that does not move either one asks nothing, for example
when the client object is rebuilt.

What was measured and what was not:

- Requests are not changed by this step. The alert window still moves one day per clock tick (one `/api/alerts`
  per tick, as designed in `useIncidents`), and `/api/weekly` is still asked once per move as before. A browser
  count of requests during three clock steps was not possible: the Vite preview server does not pass the live
  event stream through to the page, so the page did not follow the steps (the smoke harness, which uses the dev
  server, does). The count is therefore not in this record.
- `groupIncidents` is no longer re-run on a tick whose alerts are the same as before. This is confirmed by reading
  the code (the memo is keyed on the array, and the array is kept when the values match). It was not measured with
  a profiler.
- Smoke against the dev server after step 3: 23 of 23 passed with the default routes (settings and intro
  included), 19 of 19 with the same four routes as the baseline.

### Summary of this step against the baseline

| What | Before | After |
|---|---|---|
| Alert grouping | recomputed on every clock tick | recomputed only when the alerts change (by reading the code) |
| `/api/alerts` and `/api/weekly` requests per clock tick | one each, as designed | unchanged |

## Measured, and what did not help (left out or reverted)

- The first version of the counties cache kept the file text as it is on disk. The file is pretty-printed, so the
  response grew from 103 120 to 111 095 bytes. It now keeps the compact JSON; the response matches the old one.
- The API caches save well under a millisecond per request on this data (the timings are in step 1). They are kept
  because they were asked for; they do not change anything a person can see.
- The Method and Connect pages were already `React.lazy` in `App.tsx`; nothing changed for them.
- Splitting React out does not reduce what Home downloads (537 kB before and after). It makes React cacheable on its
  own, which helps only on a second visit after an app change; it is not counted as a speed-up here.
- The per-route smoke timings are wall times of one smoke run each (both viewports, no interactions, median of
  three), and they are dominated by starting Chrome and loading the dev server (4.1 to 4.8 s in every case, with
  run-to-run spread of about 0.5 s). They show no change beyond that spread. The smoke prints no timing of its own.

## Final table

| Measure | Before (926376e) | After |
|---|---|---|
| `/api/alerts?from=2024-06-10`, median of 5 | 0.708 ms | 0.538 ms |
| `/api/weekly`, median of 5 | 0.435 ms | 0.545 ms (noise: first run 29 ms; not changed) |
| `/api/isolates?from=2024-06-10`, median of 5 | 8.374 ms | 7.063 ms (not changed) |
| `/api/regional`, median of 5 | 1.186 ms | 0.511 ms |
| `/api/counties`, median of 5 | 0.960 ms | 0.437 ms |
| First JS on `#research` (decoded) | 1 217 138 B | 655 817 B |
| First JS on `#home` (decoded) | 537 566 B | 537 387 B |
| `ResearchBoard` chunk | 662.91 kB (195.98 kB gz) | 101.74 kB (32.05 kB gz) |
| Largest entry chunk `index` | 365.21 kB (112.51 kB gz) | 154.47 kB (46.96 kB gz) |
| Smoke, home / doctor / research / method (wall s, dev server) | 4.34 / 4.17 / 4.67 / 4.80 | 4.11 / 4.11 / 4.69 / 4.32 |
| Full smoke, same four routes | 19 of 19 | 19 of 19 |

Commands: `npx vitest run apps/web apps/api`, `pnpm --filter @aei/web typecheck`, `pnpm --filter @aei/api typecheck`.
