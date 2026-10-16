# UX review, wave 2 (Sonnet reviewer)

Measured on http://localhost:5174 in my own tab, at 1280x860 and at 375x812 (mobile preset), plus headless phone shots (deleted). English and Finnish both read; language left on English, speed and clock put back (clock 2025-05-12, 1 day / 2 s, paused). One slip of mine: a stray click on "1 week / s" changed the shared speed for a few minutes; restored through the timeline button.

## U numbers

| Metric | Laptop | Phone |
|---|---|---|
| U1 (Urology, urine, F, 65+, severe) | Home -> Doctor 1, unit select 1 (the remembered unit was ICU), F, 65+, severe 3 = 5 clicks, about 10 s. With the unit already Urology: 4 clicks, about 8 s. Defaults only: 1 click, 3 s. | Open the doctor's list 1, F, 65+, severe 3 = 4 clicks, about 10 s (unit already Urology). Changing unit on the phone costs 2 more taps ("More filters", then the select) and a collapse to see the list. |
| U2 cluster | 1 click (card expands), then 1 scroll: at 860 px the isolates are below the fold behind two pinned sentinels and the chips. | 1 click and about 1 scroll. |
| U2 sentinel | 1 click, first isolate row visible without scrolling. | 1 click. |
| U7 | scrub (click and arrow keys, 1 day per key), play, pause, step day and week, 4 speeds, three event jumps, jump to any date (Events menu on desktop, sheet on phone; needs the "Go" button, Enter did not submit in my test), as-of on every panel: all present. | scrub, play, speeds, events, date entry in the sheet: present. |

Verdict: U1 is over the 3-click target only when the unit has to change (5), met for the remembered unit in the demo case (4 with three named filters is the floor; defaults are 1). U2 = 1.

## U3 per view

| View | Pass | Notes |
|---|---|---|
| Home | no | Research tab badge ("3" at 12 May 2025, "190" at 10 Feb 2026, "5" at 19 Sep 2024) has no label or date and disagrees with the card ("1 open signal, last 28 days") and the feed ("12 signals in 365 days"). The "What changed" strip is fine (counts, date). |
| Doctor | yes | n, interval, level, "results to <date>" per row; organism shares carry n and as-of. |
| Feed | yes | header gives count and window, as-of present; chip counts rely on the header. |
| Grid | yes | cell counts, totals, as-of. |
| Network | partly | node labels ("34 % from MED-A") still carry no n; the n ("29 of 86") sits in the list below the graph. |
| Map | yes | "Finland: 105 cases in April 2025"; county figures after a click. |
| Settings | yes | stale "example figures" sentence is gone. |
| Intro | n/a | explanatory caption carries n and as-of; footnote 12.5 px. |

## Wave-1 items

| # | Item | Status |
|---|---|---|
| 1 | Phone doctor needs a collapse before the list | Fixed: filters open, first row "clears the bar" visible on first screen after the 3 taps. Unit change still hides the list (see rank 3). |
| 2 | Phone research overflow | Fixed (scrollWidth 375; only the tab row scrolls by design). |
| 3 | Banner names only what was chosen | Fixed ("Age group is not applied to these figures yet"). |
| 4 | Not-assessable row looks like an answer | Fixed: "n 77 -, not assessable: 79 % of isolates untested". |
| 5 | Newest result date per row | Fixed ("results to 12 May 2025"). |
| 6 | Research badge unlabelled | NOT fixed, and the number is the largest on screen (190). |
| 7 | Doctor card first on Home | Fixed (doctor first, "Last used" tag). |
| 8 | Raw S/R string in isolates | Fixed ("resistant to: ampicillin, cefuroxime ..."). One feed card still shows a profile "SSR.SS.SSSS.." (trend card, Finnish "profiili SSR.SS.SSSS.."). |
| 9 | Copy | Mostly fixed: F->N in Finnish, "does not cover", D-ids gone, "1 löydös", decimal commas ("0,2", "p < 0,001"), Settings sentence. Still: "Päijät-Hämeen" cut genitive on the map, "28 päivässä 3, tavallisesti 0,0" reads oddly, "isolaatit" (Home) vs "löydökset" (doctor), English "F" is not spelled out. |
| 10 | Network n, sentinel lights unit, jump to date, map slider | Jump to date: fixed. Map slider: labelled ("independent of the replay clock") and now follows the month. Network n in node: not fixed. Selected sentinel does not light its unit: not fixed. |

## Other findings

- Keyboard: 53 tab stops on the doctor page; the "Skip to the list" link is stop 23, after 22 timeline stops (it should be first). The search is three stops (Open search, field, Close). "/" opens search, Esc closes, arrows and Enter choose. Focus ring visible.
- Search: "uro" (unit, alert, and cefuroxime as a substring match), "esbl" (phenotype and alert), "cipro" (ciprofloxacin only, opens doctor's list), "päivystys" (Emergency department, doctor's list or signals): all correct. Enter on the first result went to #doctor?unit=ED with the flag banner.
- Cold load: first load once showed "Server not reachable" for a few seconds while the server was up (dev server warm-up); #research is blank for about 3 to 4 s (lazy chunk, no skeleton visible in the pane).
- Map still starts at about y = 480 of 860 on the laptop; the hash `?panel=map` is ignored on a fresh load of /#research (panel comes from stored state).
- Network, grid and filter chips show raw unit codes (ED, MED-A, SURG, URO ...) in the grid header and chips; the doctor page uses names.
- Finnish and English: both complete on every surface I read; Home Finnish is natural.
- Print: `@media print` in CoverageList.css hides the console chrome (top bar, timeline), the record strip (`.rs`), the unit context (`.uc`) and the row detail, and lays each row as one grid line at 9 pt with `page-break-inside: avoid`. With 10 rows plus divider and footer it would print one clean A4 page. But what it prints lacks the context a clipboard sheet needs: `.print-only` is styled but no element uses it, so sex, age group, severity word and period (the filters) and the "replayed synthetic feed" label are not on the sheet; only unit, specimen, as-of and the bar in each row's text.
- Phone timeline sheet: complete (scrub, steps, speeds, events, date entry), but the collapsed bar has only play and the date.

## Ten remaining improvements, ranked by convenience per hour

1. Label the Research badge. Surface: top bar, all pages. Files: `TopBar.tsx`, `home/Roles.tsx`, i18n. Slows: an unexplained, changing number (3, 5, 190) that contradicts the feed; a doctor or researcher cannot tell what it counts. Change: show "open signals, 28 d" in the aria-label and a title, and use the same number as the feed's 28-day count (or drop the number and show a dot). 0.5 h.
2. Scroll the expanded alert into view and show isolates first. Surface: feed. Files: `research/SignalFeed.tsx`, `feed/*`. Slows: after the click at 860 px the isolates sit below the fold (cluster), so U2 is click plus scroll. Change: `scrollIntoView({block:"start"})` on expand and put "Isolates behind this signal" above "Explain". 0.5 h.
3. Phone: unit change keeps the list visible. Surface: doctor phone. Files: `doctor/RecordStrip.tsx`, `.css`, `DoctorPage.tsx`. Slows: "More filters" opens a tall panel that pushes the list off screen; unit change costs 2 taps plus a collapse. Change: collapse "More filters" after any selection, or put the unit select in the always-visible summary row. 0.75 h.
4. Skip link first, timeline off the tab path. Surface: all, keyboard. Files: `App.tsx`, `TopBar.tsx`, `Timeline.tsx`, `DoctorPage.tsx`. Slows: 22 timeline stops before the filters; skip link is stop 23. Change: move the skip link to the first stop, add "Skip to timeline" second; make the speed chips a radio group (one stop, arrows). 1 h.
5. Print sheet context line. Surface: doctor print. Files: `doctor/CoverageList.tsx`, `CoverageList.css`. Slows: the printed list does not say sex, age, severity, period or that data is replayed. Change: render the existing `.print-only` line: "Urology · urine · F · 65+ · severe, bar 90 % · last year · as of 12 May 2025 · replayed synthetic feed". 0.5 h.
6. Date field Enter and a visible hint. Surface: timeline Events menu and sheet. Files: `Timeline.tsx` (`DateJump`). Slows: the date field needs a separate "Go"; typing and Enter closed the menu without moving. Change: apply on `change` when valid (or Enter submits and keeps focus), keep Go for mouse users. 0.5 h.
7. Network node n and lit sentinel unit. Surface: network. Files: `research/HospitalNetwork.tsx`, `network/*`. Slows: "34 % from MED-A" without n; a selected sentinel's unit is not outlined. Change: "34 % (29 of 86)" in the label; outline the selected alert's unit. 1 h.
8. Unit names instead of codes in grid and chips. Surface: grid, feed filters. Files: `research/UnitGrid.tsx`, `SignalFeed.tsx`, i18n `unit` names. Slows: ED, MED-B, SURG, PHC-N are lab-internal codes (AUDIENCE: no codes). Change: short names ("Emergency", "Int. med. A") with the code in the title attribute; keep codes in the URL. 1 h.
9. Map above the fold at 860 px. Surface: map. Files: `research/RegionalMap.tsx`, `.css`. Slows: the map starts at y = 480; legend and controls come first. Change: put series/view on one row, legend beside the map, note under it; map starts at about y = 330. 1 h.
10. Finnish and English polish. Surface: copy. Files: `libs/utils/i18n/src/en.ts`, `fi.ts`, `surfaces/*.ts`, `Isolates` row. Slows: "Päijät-Hämeen" cut genitive on the map, "28 päivässä 3, tavallisesti 0,0", "isolaatit" vs "löydökset", English "F" and "M" not spelled out, the profile string on trend cards, "cefuroxime" matching "uro". Change: full county names, "3 löydöstä 28 päivässä (tavallisesti 0,2)", one term, "female / male" in the title attribute, prefix match first in search ranking. 1.25 h.
