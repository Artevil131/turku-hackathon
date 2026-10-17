# Final UX review, doctor's journey (Fable reviewer)

Measured on http://localhost:5174 in my own browser tab at 1280×860 and at 375×812 (mobile preset), English and Finnish, plus headless shots of home, doctor (default, `unit=URO&sex=F&age=older&sev=severe`, `unit=ICU&site=blood&sev=severe`) and method at phone and laptop (deleted). The clock was not touched: it sits at 12.5.2025, paused, 1 day / 2 s. Language in my tab put back to English. No app code edited.

## Verdict

The doctor's screen now does what Artem asked: one screen with no page scroll at 1280×860, the forest plot answers "what clears the bar" in the first second, and every panel carries its count and as-of date, with the one exception of the Details pane. The timeline band is continuous, per-unit, ends at today with the future greyed and nothing drawn after it, and the method page shows the Wilson density and the Poisson test with live numbers. What remains is finish: the phone filter row breaks at the exact tap the U1 path needs, the Finnish banner overflows at 1280, and the per-row "own unit" glyph repeats ten times what the ladder already says.

## U1

| | Clicks | Time | Notes |
|---|---|---|---|
| Laptop (unit remembered as Urology) | 4 (Doctor, F, 65+, severe) | about 7 s including a 2 s page load | 6 if the unit must change (select, option). Defaults only: 1 click. The floor for three named filters is 4, so the 3-click target is reachable only with presets. |
| Phone | 5 (Doctor, Filters, F, 65+, severe) | about 12 s | The first clearing row is visible under the open filter panel without scrolling; the divider and the rest need one scroll or a collapse tap (6). |

U3 per panel: Coverage yes (n per row, as-of in the header), Data level yes, Likely organisms yes, Unit signals yes, Details **no** (figure and interval without a date in the panel or the phone sheet). U4: no visible text under 4.5:1 on the doctor page (DOM check); S/R and standing carry a glyph and a word; 46 tab stops, skip links first, focus rules on rows, chips, info buttons and the sheet. Text budget: no visible sentence over 12 words on the doctor page; the reasons live behind ⓘ and in Details. Wording: "clears", "at bar", "below", "moved down because …"; no "give" or "recommend" in `doctor.ts` (grepped, EN and FI).

## What works

- Forest plot with the dashed bar, `94 % · n 356`, a glyph and a word per standing, AWaRe chip; ten rows fit without scrolling.
- Row ⓘ (Enter/Esc, focus returns) gives the reason in one line plus the organisms it leaves out; the Details pane repeats it with interval, ±pts, last 28 d, and the signal explanation.
- The banner is one row of one-click filters with defaults already chosen; the URL carries the state; the age and day-3 chips say "not applied yet".
- Pairs appear only when nothing clears (ICU blood severe: `pip-tazo + clindamycin 100 % · n 49`) under a short divider.
- The ladder shows the level reached with n and from-date, the other steps hollow.
- The timeline reads as one object across pages: cultures per week, unit tracks with alert labels, event diamonds, cursor at today, future greyed, "Tänään · 12.5.2025" at the right end.
- Phone: summary line "Urology · urine · female · severe · last year · 65+", details as a bottom sheet with Close and Esc.

## The 8 fixes, ranked by value per 20 minutes (Sonnet-buildable before 11:30)

1. **Phone age row is unreadable** — `apps/web/src/components/doctor/RecordStrip.css` (the `.rs:not([data-wide])` block). With the "not applied yet" tag in the same flex line, "0–17" wraps and "65+"/"80+" clip to "65"/"80". Let the group wrap: `.rs:not([data-wide]) .rs-group { flex-wrap: wrap }`, give `.rs-choices` `flex: 1 1 100%` and each `.rs-choice` `flex: 1`, and put `.rs-tag` on its own line. Why: this is the one tap in the phone U1 path, and it is the row that breaks.
2. **Finnish banner overflows at 1280** — `RecordStrip.css` wide block (`.rs[data-wide]`). `.rs` scrollWidth 1274 vs clientWidth 1254: "4 vk" is clipped. Drop `.rs-body` gap to 6 px and `.rs-choice` padding to 8 px in wide mode, or drop the "Ikä"/"Age" prefix label (`RecordStrip.tsx` line 137 relabels "any" as "Age"; use "kaikki"/"any" and keep the group's `aria-label`). Why: the default Finnish laptop view shows a cut-off control.
3. **Details has no as-of (U3)** — `apps/web/src/components/doctor/DoctorPage.tsx`: add `<AsOf date={asOf} />` beside the "Details" title in the laptop panel (`dt-title`) and in `.dp-sheet-head`. Why: it is the only number set on the page without a date; one import, two lines.
4. **Drop the per-row level glyph** — `apps/web/src/components/doctor/CoverageList.tsx` (`cl-lvl` span) and the row grid in `CoverageList.css`. `coverage.level` is one value per response, so "● own unit" repeats on every row and says nothing the ladder does not; give the 24 px to the plot. Keep the glyph in Details. Why: less noise, wider interval bars (Artem: too much on screen).
5. **Phone: a "Show list" button at the end of the open filters** — `RecordStrip.tsx` (phone branch): a `rs-done` button that sets `more=false` and focuses `#dr-list`; plus shorten the phone label "Inpatient day 3 or later" (clipped to "Inpatient day 3 o") to "Day 3+ onset" / "Sairaalaperäinen" via a new key in `libs/utils/i18n/src/surfaces/doctor.ts`. Why: after three taps the doctor is 400 px above the list.
6. **Timeline labels collide** — `apps/web/src/components/hero/Seismograph.tsx`: "näytteet 39/70" sits on top of "ei näytteitä", "ESBL 7/1,4" runs under the cursor, and the dashed data boxes cross tracks. Cheapest: render text labels only for sentinel and cluster kinds; data alerts (`sampling-drop`, `empty-run`) keep their hollow glyph and the tooltip, and labels within 8 px of the right edge anchor `text-anchor="end"`. Why: the band is the first thing seen on every page and the overlaps read as a bug.
7. **Age buttons all titled "Age group"** — `RecordStrip.tsx` line 137: the third tuple element is `tr("drAge")` for every option, so hover and the accessibility description say "Age group" on "0–17" and "65+". Pass the title only for "any" ("Age group: any") and `undefined` for the rest. Why: five minutes, and it removes a false label from the only filter that carries a caveat.
8. **Home doctor card says "Default unit"** — `apps/web/src/components/Home.tsx` / `home/*`: when `aei.unit` is unset the Finnish card reads "Oletusyksikkö"; show the unit name it will open (`wardName(DEFAULT_UNIT)`) with the "Last used" tag only when stored. Why: the doctor should see the ward before the click, and the card is the U1 entry.

## Next (bigger than 20 minutes)

- Proper label collision avoidance on the seismograph (greedy placement per track, leader lines) instead of hiding a kind.
- Age group and day-3 onset applied by the coverage API (the chips are honest, but the doctor's named context is still not what the figures use).
- Method page in headless Chrome still showed "Loading…" after 14 s (it loaded in about 6 s in the browser); worth a skeleton or a check of the `asOf` dependency in `useCoverage`/`useAlert`.
- Phone details sheet: a scrim and swipe-to-close; today the list behind stays clickable.
- U6 (LCP) remains above 2.5 s on all pages; not touched in this wave.
