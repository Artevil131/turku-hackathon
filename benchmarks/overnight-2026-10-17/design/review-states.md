# State review: loading, empty, error, slow, offline, as-of (2026-10-17)

Method: own browser tabs on http://localhost:5174. A `fetch` wrapper (delay or reject per route) was installed before the app remounted (the contract client binds `fetch` at creation), plus code reading. The clock was not moved. Empty coverage cannot be produced from real data (the API always pools up to the whole hospital), so that branch is code-reviewed only.

Legend: P pass, F fail, ~ partial, n/a not applicable, (code) verified by reading only.

| Panel | Loading | Empty | Error + retry | Slow (stale kept?) | Offline | As-of |
|---|---|---|---|---|---|---|
| Home (Since, Roles) | P "connecting" note | P "nothing since" + hint | P offline note, auto retry every 4 s, recovered without reload | P | P note; banner repeats it | P |
| Doctor list | ~ skeleton is aria-hidden, no aria-busy; sr text only | P (code) `drEmpty` | P role=alert + Retry works; focus falls to body after retry | ~ filter change blanks to skeleton (by design: no figures under wrong filters); header says "as of <clock date>" while loading | ~ no panel message, only the global banner | P |
| Likely organisms rail | F blank list under heading | F blank, no text | F nothing on failure | F | F | ~ only after data |
| Signals in this unit (rail) | F says "No signals" while alerts not loaded | P | F failed backlog reads as "no signals" (misleading) | F | F | F no as-of on that block |
| Feed | P skeleton, aria-busy | P `feedEmpty` with date | P alert + Retry works | P keeps rows on clock tick, "updating to <date>" | ~ global banner only | P |
| Incident isolates | P (code) | P (code) | P (code) | n/a | ~ | ~ |
| Unit grid | P text "loading 26 weeks..., may take a moment" | P "no VRE isolates in 26 weeks" | P alert + Retry works | ~ table and as-of vanish on window change (no stale) | ~ banner | P (lost while loading) |
| Network | P `netLoading` | P `netNoFlows` | P alert + Retry; unit list still draws | ~ keeps data, aria-busy only, no visible indicator | ~ | P |
| Map | P "Loading…", aria-busy | P `mapNoMonths` | P (code) `mapError` + retry | ~ keeps data on group change, no indicator | ~ | P |
| Intro | ~ `introLoading` | P noGeo/noRegional | P (code) | ~ | ~ | ~ none shown |
| Timeline | P "Connecting" | n/a | P "Server not reachable, controls off" | n/a | P | P (the clock) |
| Search field | n/a | ~ "none for q" even when alerts failed | n/a | n/a | F | n/a |

## URL, memory, focus

- Doctor: `#doctor?unit=URO&site=blood&sex=F&age=older&onset=1&sev=severe&period=28` restored every filter in a fresh tab. P.
- Research with open incident (`#research?inc=...&focus=MED-A`) restored the open card with its isolates in a fresh tab. P.
- Gaps: grid week window (12/26/52) is local state, not in the URL; locale is not in the URL (recipient sees their own language; acceptable, but say so); doctor remembers only the unit, not specimen.
- Unit (`aei.unit`), locale (`aei.locale`) and last role survive a reload. P.
- Focus: visible 2 px ring on buttons and selects (`:focus-visible`, styles.css:145). P. Order: nine top-bar stops plus eight timeline stops precede any content. Research feed has about 35 tab stops (filter chips, pinned list, every row) before the grid. The panel tablist has all three tabs at tabindex 0 (no roving focus or arrow keys); "Signals" is not in the tablist at 1280 px. The doctor skip link sits after the timeline. After Retry, focus drops to body.

## Eight fixes, ranked by impact per hour

1. **Rail states.** `doctor/UnitContext.tsx`, `DoctorPage.tsx`: pass `status`; show skeleton, error text and "no isolates" under "Likely organisms"; show an as-of on the signals block; do not print "No signals" until alerts have loaded. About 1 h.
2. **Honest offline copy and banner.** `libs/utils/i18n/src/en.ts`, `fi.ts` (`offline`), `App.tsx`: drop "Start it with pnpm dev" (developer text), say what is stale and since when; show the last-good as-of. 0.5 h.
3. **Recovery in `live.ts`.** Retry the `relations` failure and a failed `loadBacklog` on `reset`; listen for window `online`/`offline`; clear "offline" when the native EventSource reconnects (a paused clock sends no event, so the banner can stick). 1 h.
4. **Stale-with-indicator on grid and network.** `UnitGrid.tsx`: keep the previous window's table dimmed with "updating" while the new one loads; `HospitalNetwork.tsx`, `RegionalMap.tsx`: visible "updating" next to the as-of, not only `aria-busy`. 1 h.
5. **Week window and panel into URL.** `ResearchBoard.tsx`/`url.ts`: add `weeks=` and keep `panel=`. 0.5 h.
6. **Skeleton accessibility.** `CoverageList.tsx`: `aria-busy` plus `role=status` text on the list; move focus to the list heading or Retry result. 0.5 h.
7. **Keyboard.** `ResearchBoard.tsx`: roving tabindex with arrow keys on the tablist; "Skip to panels" link after the feed filters; `Timeline` and top bar: skip link target should come before the timeline. 1.5 h.
8. **Search when offline.** `CommandField.tsx`: when alerts have not loaded, show "data not loaded" instead of "none for q". 0.5 h.
