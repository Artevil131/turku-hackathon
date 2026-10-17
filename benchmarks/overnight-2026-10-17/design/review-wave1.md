# UX review, wave 1 (Sonnet reviewer)

Measured on http://localhost:5174, replay clock 2025-05-12, unit Urology. Language was Finnish by default (browser locale); I switched to English for the copy check and did not switch it back, so `aei.lang` in that browser is now English. Clock restored to 2025-05-12, paused.

## U1 Doctor's list (Urology, urine, female, 65+, severe)

| Device | Path | Clicks | Seconds (estimate) |
|---|---|---|---|
| Laptop | Home "Open the doctor's list" (or the Doctor tab) -> F -> 65+ -> severe | 4 | about 8 to 10 (unit preset, urine default; list renders as soon as the filters flip) |
| Laptop, defaults only | Home -> Doctor | 1 | about 3 |
| Phone 375 | Doctor tab -> Filters summary -> F -> 65+ -> severe (-> collapse Filters to see the list) | 5, or 6 with collapse | about 14 to 18 |

Verdict: laptop is 4 clicks (target <= 3, but with 3 named filters 4 is the floor; the two taps of the defaults case are met). Phone is over target.
Reading the list as a doctor with a minute: the top row and its "clears the bar" line are obvious; "Does not clear the 90 % bar" divider is clear; n, interval, level badge and as-of are all present; "not applied yet" is shown twice (chip and banner), which is good. Wording is within covers / clears the bar / moved down because on the doctor page. No "give" or "recommended" on screen, but see fix 9.

Problems found:
- Banner says "Age group and day-3 onset are not applied" even when only the age group was set (day 3 is "no"). Misleading about what the doctor chose.
- No per-row newest-result date (the brief asks for it); only the "since 13 May 2024" window start.
- Ceftazidime 18 % (n 77) is rendered in the same large type as real answers although "not assessable". A big 18 % invites misreading.
- "Standing" (EN) / "Asema" (FI) column header is vague; "not for E. faecalis" is weaker than "does not cover".
- "F / M" are untranslated in Finnish (should be N / M) and not spelled out in English.
- Footer shows internal decision ids to the doctor ("Säännöt D-023, D-027, D-033").
- On the laptop the timeline and filter strip take about 55 % of 860 px; only the first row is in view.
- Filter chips are 34 px high on laptop (phone is 44, good).

## U2 Researcher

Feed -> isolates is 1 click (expand the card) for the MED-A ESBL cluster (2025-04-30, 7 isolates) and for the CPE sentinel (1 isolate). U2 = 1 (plus a scroll: the cluster is below the fold at 860 px behind two pinned sentinels and the filters). Isolate rows show date, patient, organism, specimen, day, phenotype and a raw S/R string ("RRR.RR.SSSS.."), which contradicts AUDIENCE "susceptible and resistant, not S/R codes". Expanding also outlines MED-A / week 18 in the grid, and "Show in grid" / "Open in doctor's list" are there.

One glance and linking:
- Grid: yes, clusters read as the boxed cell; but shade is count, not surprise (the panel says so honestly).
- Network: yes, MED-A lit, downstream shaded. Clicking URO sets `unit=URO` and the feed filters to URO: unit selection links. A selected sentinel (ED) does not light ED on the network (only the active cluster unit is lit).
- Map: not one glance. The map starts below the legend and controls and is cut at 860 px; the unit selection does not apply (fine, regional) but nothing says so.

## U3 Count and as-of in the same element or direct label

| View | Yes/no | Offending elements |
|---|---|---|
| Home | no | Research tab badge "3" has no label or date and disagrees with the card ("1 open signal, last 28 days") and the feed ("13 signals in 365 days") |
| Doctor | yes | only gap: no newest result date per row; "ei vielä käytössä" fine |
| Feed | yes | unit/kind/phenotype chip counts rely on the header "13 signals in 365 days" plus as-of |
| Grid | yes | cell counts, totals and as-of in header |
| Network | no | node labels "34 % of MED-A" carry no count; the patient counts exist only in the SVG edge aria-labels |
| Map | yes | "Finland: 105 cases, April 2025"; per-county figures appear only after a click |
| Settings | no | "Resistance percentages are example figures until the counting method is decided" is stale: doctor figures are live |

## U7 Replay timeline

| Feature | Present |
|---|---|
| Scrub (range input "Replay day") | yes |
| Play / pause | yes (Play -> "Pause", moved 1 day per 2 s) |
| Step day / week | yes |
| Speeds (4) | yes |
| Jump to the three events | yes (menu and ticks) |
| Jump to an arbitrary date | no on desktop (date is plain text; the phone date is a button that opens the control) |
| As-of on every panel | yes (Home, Doctor, feed, grid, network, map each show "as of ...") |
| "Lab feed, replayed" label | yes |

The map has a second slider, "Browse months (does not move the replay clock)", which sits next to the replay clock and competes with it.

## Keyboard, language, phone

- Keyboard: focus ring visible (2 px accent outline); skip link "Skip to the list" exists; order is logical (nav, timeline, filters, rows). About 20 stops of timeline before the filters.
- Finnish: "7 28 pv:ssä" (digit collision), "1 löydöstä" (should be "1 löydös"), decimal points "1.4" / "p 6.0e-5" (Finnish uses a comma), "Päijät-Hämeen" cut-off genitive, "avo" for outpatient unexplained.
- English: "Open recommendations" and "What to give the patient in front of you" still exist as i18n keys `roleDoctorAction` / `roleDoctorLead` (en.ts 191, 195; fi.ts 197 "Avaa suositukset"). Home currently shows other copy, so the keys are dead, but the strings violate the wording rule.
- Phone: research page overflows horizontally (scrollWidth 643 on a 375 window; the Kind chip row); on Home, "Last used" moves the Research card above the Doctor card so the doctor needs a scroll.
- Regression vs old app: none that I could verify without running the old build; the doctor's page lost the in-page Ask field by design (amendment 5).

## Ten fixes, ranked by convenience per hour

1. Phone doctor: after choosing a filter, keep the summary open but show the list directly below the sticky "Filters: ..." row; collapse automatically after the last tap or add "Show list" (saves 1 click, 3 s). Surface: doctor phone. Files: `apps/web/src/components/doctor/DoctorPage.tsx`, `RecordStrip.tsx`, `RecordStrip.css`. 0.5 h.
2. Phone research overflow: wrap the chip rows (`flex-wrap`) and set `min-width:0` on the feed column. Files: `research/SignalFeed.css`, `ResearchBoard.css`. 0.5 h.
3. Doctor banner: name only what was chosen ("Age group is not applied" / "Day 3 is not applied"). Files: `doctor/DoctorPage.tsx`, `libs/utils/i18n/src/surfaces/doctor.ts`. 0.25 h.
4. Not-assessable rows (ceftazidime 18 %): grey the figure, drop the bar, show "not assessable, 79 % untested". Files: `doctor/CoverageList.tsx`, `CoverageList.css`. 0.5 h.
5. Add the newest result date to each row, from the API field if it exists, else show "as of" only. Files: `doctor/CoverageList.tsx`. 0.5 h.
6. Home Research badge "3": label it ("3 open signals, 28 d") or drop it and use the same number as the card. Files: `TopBar.tsx`, `home/Roles.tsx`. 0.5 h.
7. Pin the doctor card first on Home regardless of "Last used" (show Last used as a tag only). Files: `home/Roles.tsx`. 0.25 h.
8. Replace the raw S/R string in isolate rows with a short list of the resistant drugs ("resistant: AMP, CRO, CIP ..."), keep the string on hover or in a details block. Files: `research/feed/*`, `surfaces/feed.ts`. 1 h.
9. Copy: remove dead "recommendation/give" keys; translate F/M (N/M); "not for" -> "does not cover"; rename "Standing" -> "Result"; strip D-ids from the doctor footer; fix Finnish plurals and decimal commas ("1,4", "6,0e-5" -> "0,00006"); fix the stale Settings sentence. Files: `libs/utils/i18n/src/en.ts`, `fi.ts`, `surfaces/doctor.ts`, `feed.ts`, `map.ts`. 1 h.
10. Network and timeline: show patient counts in the node label ("34 % of MED-A, n 53"); light the unit of the selected sentinel; add a "Jump to date" input to the timeline; on the map, link the month slider to the clock or label it as a separate browser. Files: `research/HospitalNetwork.tsx`, `Timeline.tsx`, `research/RegionalMap.tsx`. 2 h.
