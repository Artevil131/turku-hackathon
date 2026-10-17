# Design night, 2026-10-17: morning report

Final, written 11:00–11:55. The night ran 00:50–02:30 and stopped on a
usage limit; it resumed at 08:34. At 08:50 Artem redirected the design
(less text, a Mylab-like look, everything useful on screen, the timeline
as the key element, the engine's math on screen, deadline 12:00), and the
morning went to that redesign. The minute-by-minute record is
`design-log.md`; reviews and audits are in `design/`.

Branch `overnight/design` (pushed, never merged), built in a separate
worktree at `/Users/artevil/turku-hackathon-design`. API on 8788 and web
on 5174 (another session held 8787 and 5173); an AI-enabled test stack
ran on 5176 (a local fake model for the Assistant panel). Screenshots
come from the running app through `design/shoot.mjs` (headless Chrome,
true 390 px phone emulation at 2×, laptop 1280×860). "Before" is the
pre-night commit 98cfd99; replay date in every shot 12 May 2025.

## 1. What changed, by surface

Files in `design/`: `<surface>-before-{phone,laptop}.png` and
`<surface>-final-{phone,laptop}.png`.

| Surface | What changed | Before | After | Serves |
|---|---|---|---|---|
| Timeline (every page) | From a date and two buttons to the hero: a continuous weekly stream of resistant finds by phenotype with sampling volume, nine unit lanes, signal pills that name their cause ("ESBL 7/1,4", "MRSA new", "no samples") with a −log10 p bar, a week readout, the axis ending at today with nothing after it; play, steps, speeds, date entry, demo jumps; a subtle Layers popover (lines, count or per 100 cultures, stacked or overlaid, lanes, signal kinds, window) whose choices persist and travel in the URL | `home-before-*` | `home-final-*`, `research-final-*` | PRODUCT principle 4; Artem's "timeline is the key element"; U7 |
| Doctor (`#doctor`) | From a form over example figures to a one-screen workspace from `/api/coverage`: one dense row of one-click filters (unit remembered; age group and day 3+ tagged not applied), the list as a forest plot (Wilson interval against the bar line, "94 % · n 356", result glyph and word, ⓘ per row), level ladder, likely organisms bar, unit signal chips, details on demand; prints as one A4 page | `doctor-before-*` | `doctor-final-*` | Usability criterion; principles 1 and 5; U1, U3 |
| Researcher (`#research`) | From a table of finds with example trends to a workspace of chrome-less panels (hover reveals move, resize and close; a subtle tray reopens them; layout persists; the page may scroll): signals (unfiltered by default, each showing the units it spans with counts), one Finland map (THL county rates and signals, the referral graph), the Tyks unit graph (flows, lit units, spread arrows with share · n), the alert math (observed vs usual, −log10 p, the test in one line, isolates inline), the unit grid, and an Assistant panel that words the selected signal (local model when configured, labelled; template otherwise) | `research-before-*` | `research-final-*` | Principles 2 and 3; detection criterion; Artem's points on multi-unit signals, one map, windows, the LLM; U2 |
| Method (`#method`) | New: the live rules drawn with live numbers (coverage as Beta(k+1, n−k+1) with the Wilson interval; the detector's Poisson tail, its −log10 p against α, the weekly window) beside the experiment figures 0012–0020; the discounted Beta-binomial and every live rule typeset in MathML (formula section by the experiments session at Artem's request) | none | `method-final-*` | Artem's "show the engine's math"; demonstrated understanding |
| Home | "What changed since yesterday" as three dated numbers and two role cards; the doctor card names the unit it opens | `home-before-*` | `home-final-*` | Principle 2 |
| Pitch intro (`#intro`) | Terraced contour surface of the THL county rate, hospitals on the referral tree, month slider, labelled a picture | none | `intro-final-*` | Pitch opening |
| Shell | Mylab-derived look (Inter, Bricolage Grotesque titles, violet accent, flat panels), search field (`/`), FI/EN switch, skip link, URL state everywhere, offline banner in clinical words with recovery, one live stream, API origin from `VITE_AEI_API_URL`, branding tokens, lazy pages, half the stylesheet removed | | | Item 3 of the brief; deployment shape |

## 2. The doctor's list and the researcher's board as they stand

**Doctor.** `#doctor` opens on the remembered unit with defaults chosen
(urine, any sex, mild 80 % bar, last year): zero input. The forest plot
shows every antibiotic's interval against the bar; rows that clear sit
above a labelled line, the rest say why they moved down. The ladder says
whether the unit's own results were enough or a wider pool was used.
Age group and inpatient day 3+ are shown and tagged "not applied yet",
because the API cannot filter by them. Wording stays within "covers",
"clears the bar", "moved down because".

**Researcher.** The timeline shows weekly resistant finds since the data
began, one lane per unit, with every signal named on its lane; today is
the right edge. Below it the panels: the signal list (13 in the 365 days
to 12 May 2025 at the demo start) where each row shows the units the
signal spans ("MED-A → ED 31 % · n 41"); the map; the unit graph with the
spread; the alert math; the Assistant.

**A judge's first two minutes.** Home: what arrived today → Doctor: the
list is already there → F, 65+, severe: the bar moves to 90 % and rows
fall below the line with reasons → Research: the timeline's lanes show
MED-A's ESBL rise → click the signal: its first 3 of 7 isolates inline, observed 7
against usual 1.4, −log10 p 3.1, its patients went on to ED and PHC-S →
the unit graph lights the spread → Method: the same signal's Poisson
tail and the formulas → Demo jumps → "ICU MRSA" (10 Feb 2026): every
panel moves to the new date, and still nothing after it is shown.

## 3. U metrics, before and after

From `design/u-metrics.md` (clock times and commits there). Before =
98cfd99/ec23f01; after = c202c03/6364306.

| Metric | Target | Before | After |
|---|---|---|---|
| U1 to the doctor's list for Urology, urine, F, 65+, severe | ≤ 3 clicks; ≤ 10 s laptop, ≤ 15 s phone | not reachable | 4 clicks, about 7 s laptop; 5 taps, about 12 s phone. The list itself is 1 click; the named context has three non-default filters, so the 3-click target is missed by one |
| U2 feed → isolates behind an alert | 1 | not reachable | 1 |
| U3 count and as-of on every number | all views | no | yes on every panel after the final-review fixes |
| U4 Lighthouse accessibility home / doctor / research; contrast | ≥ 95; pass | 100 / 96 / 100; doctor contrast fails | 100 / 95 / 100; contrast passes; the last doctor finding (list divider) fixed after the measurement |
| U5 missing i18n keys | 0 | 0 | 0 (239 keys) |
| U6 LCP, 4G phone, production build | ≤ 2.5 s | 3.6 / 3.6 / 3.6 s | 3.5 / 3.5 / 4.7 s. Not met; noisy (CPU shared), recorded only per the addendum |
| U7 scrub, play, pause, jump to a date, per-panel as-of | all present | 2 of 5 | 4 of 5: scrub dropped, because with today as the right edge (Artem's instruction) dragging would rescale the axis; date entry, steps and demo jumps move the clock |

Regressions and what happened: U4 fell twice (home 95 after wave 1;
doctor 92 and research 97 after the redesign) and was fixed within the
hour both times; U7 fell from 5 to 4 on Artem's instruction and was kept.
Performance (research page, 1440×900): the page grew to 1219 px at 900
because screen-reader text escaped its scroll boxes; fixed (900 / 900).
Live streams 2 → 1; relation requests deduplicated.

## 4. Design decisions and alternatives rejected

- Mylab's site for type, colour and flatness (Inter, Bricolage Grotesque standing in for the commercial Nohemi, violet #635BF1, navy ink), via the branding tokens; Mylab's logo and assets not used.
- Patterns borrowed: Bloomberg terminal (density, tabular numbers, detail on demand), Grafana (annotation band on a shared time axis), Epic's patient banner (one dense filter row), PagerDuty (incident list), Our World in Data (choropleth with a month).
- Timeline as a continuous stream with unit lanes; the earlier discrete seismograph was rejected by Artem as saying nothing about the metrics.
- The axis ends at today and nothing later is drawn; scrubbing the band was given up for it.
- Panels without window chrome; explicit windows with title bars were built and rejected by Artem the same hour.
- Network and regional map merged into one geographic view, then the Tyks unit graph given its own panel so both stay readable.
- The doctor types nothing: no organism input, age group and day 3+ shown but not applied rather than filtered in the browser.
- Certainty as the level reached, not n cut-offs the team has not chosen; hospital onset does not raise the bar on its own (ENGINE 2.6 open).
- The Assistant only words existing alerts through `/api/explain`; numbers never come from the model (D-019, D-029).
- The math drawn from fields the API already returns (the Poisson tail equals each alert's p to 1e-9 in tests); Beta posteriors with a team prior, CUSUM paths and funnel limits left as proposals.
- Per 100 cultures offered as a plain ratio of the same raw counts (D-039), not a model.
- AWaRe tier names kept as "Access" and "Watch" in Finnish.

## 5. Accessibility and bilingual results

- Lighthouse accessibility 100 / 95 / 100 at the final measurement, contrast passing everywhere; `--ink-3` darkened twice (#5f7381 → #566a78 → #5c6080 in the new palette); the list divider no longer a separate item.
- Glyph and word for every result and alert kind; patterns on the timeline's phenotype streams; data-quality weeks hatched.
- Skip link first on every page, visible focus rings, timeline speed as a radio group and steps as a toolbar, panels movable and resizable by keyboard.
- Finnish and English: 0 missing keys (239); copy per surface in `libs/utils/i18n/src/surfaces/`; Finnish plurals, decimal commas, plain p-values, THL series names in Finnish. Not read by a native speaker.

## 6. Contract fields and routes proposed

Collected here (addendum point 4); D-040 stays as written.

| Proposal | View that needs it | State |
|---|---|---|
| `GET /api/counties`, county polygons (D-040) | Map, pitch intro | built, pending Artem |
| `GET /api/weekly`, raw weekly counts per unit (patients per phenotype, cultures), cut at the clock; `@aei/viz` `weeklySeries` | Timeline stream and lanes | built, pending Artem |
| `THRESHOLDS` re-exported from `@aei/contract` | Doctor's bar labels | built (additive) |
| `RelationsQuery.from` / `to` | Spanned units of older signals (today the window always ends at today, so shares include later movement) | proposed |
| `CoverageQuery.ageGroup`, `onset` | Doctor filters shown but not applied | proposed; needs the rule for which filter drops first (D-033 has it for sex) |
| `AntibioticCoverage.newest` | Doctor row date | proposed |
| `CoverageQuery.patientId` → prior findings | Doctor flag | proposed; privacy first |
| `Alert.severity`, `Alert.firstStep` | Signals | proposed |
| `RelationsResponse.exposure` (ENGINE 4) | Unit graph spread (today flow share) | proposed |
| `RegionalSeries.interval` | Map uncertainty | proposed |
| Weekly expected counts, CUSUM path, funnel limits, Beta posterior with the team's prior, experiment results served by the API | Method page and alert math | proposed |
| An explain route over a whole incident (several alerts, units) | Assistant | proposed; today it words each member alert |

Blocked on decisions: the bar for hospital onset (ENGINE 2.6); n cut-offs
for certainty; colour breaks of the map and grid.

## 7. Where branding attaches

The `--brand-*` block at the top of `apps/web/src/styles.css` (accent,
soft, ink, display and UI fonts, radius) carries the Mylab-derived values
now; everything else is neutral or a status colour. Slots: the "AEI" mark
in the top bar, the favicon, the intro title. Copy voice plain and
clinical; no brand voice written.

## 8. With another night

1. Bring `origin/main` in: teammates pushed new screens, a data-quality
   route and a pitch film overnight (37 commits); this branch has not
   been merged with them.
2. The proposed routes above, starting with relations by window and
   weekly expected counts, so the lanes can show surprise rather than
   counts.
3. The Assistant over a whole incident, tested against the real local
   model in its container.
4. Artem's math engine in `libs/utils`, drawn through `@aei/viz`.
5. U6: the first meaningful content on the research page waits for a
   year of alerts and the weekly series; serve a smaller first response.
6. A Finnish reader through every surface; a timed test with someone
   outside the team.
