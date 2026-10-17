# Design night, 2026-10-17: morning report

Final, written 08:35–09:00 (Artem's addendum of 01:15). The build work
ran from 00:50 to about 02:30 and then stopped on a usage limit; it
resumed at 08:34, after the 08:30 cut-off, so nothing new was started
and this report was finished instead. The minute-by-minute record is
`design-log.md`; the reviews are in `design/review-wave1.md`,
`review-wave2.md` and `review-states.md`.

Branch `overnight/design` (pushed, not merged), built in a separate
worktree at `/Users/artevil/turku-hackathon-design` so the main checkout
and the experiments night were never touched. API on port 8788 and web
on 5174, because another session held 8787 and 5173. Every screenshot is
from the running app, taken with `design/shoot.mjs` (headless Chrome over
the DevTools protocol: true 390 px phone emulation at 2× density, and
1280 × 860 laptop). The "before" shots are the pre-night commit 98cfd99
served on a spare port. Replay date in all shots: 12 May 2025, the
default start.

## 1. What changed, by surface

All screenshot files are in `design/`. Before: `<surface>-before-phone.png`
and `-laptop.png`. After: `<surface>-after-phone.png` and `-laptop.png`.

| Surface | What changed | Before | After | Serves |
|---|---|---|---|---|
| Replay timeline (every view) | Was a date and two buttons. Now its own bar on every working page: a permanent "Replay · synthetic lab feed" label, play/pause with a state word, steps of a day and a week, a scrub track that seeks on release, four speeds, the three event dates as markers and a menu, a free date entry, keyboard shortcuts (Space, arrows, Shift+arrows); on a phone a strip with the date and play that opens a full sheet | `home-before-*` | `home-after-*` | PRODUCT principle 4 (every view is current), U7 |
| Doctor's list (`#doctor`) | Was a form with example figures. Now the list from `/api/coverage`: one-click filters with defaults, unit remembered; each row covers %, the 95 % interval against the bar, n, the level the data came from, the result in glyph and word, a "moved down because" line, "does not cover" flags; a line where antibiotics stop clearing the bar; likely organisms beside the list; prints as one A4 page | `doctor-before-*` | `doctor-after-*` | Usability criterion; principles 1 and 5; U1, U3 |
| Researcher's board (`#research`) | Was a table of resistant finds with example trends. Now the signal feed (incidents grouped, sentinels pinned, filters by unit, kind and phenotype, one click to the isolates behind an alert) beside one of three panels | `research-before-*` | `research-after-*` (grid) | Principles 2 and 3; detection criterion; U2 |
| Hospital network | Units placed as before, tubes by patient flow, units lit by the last 28 days of alerts with text badges, downstream units shaded by share of patient flow with counts (labelled "not exposure"), the phenotype trail as a layer, the open incident's unit ringed | (old map was in research) | `research-panel-network-after-*` | Product mechanism 4 (units are connected) |
| Regional map | New: THL county series as a flat stepped choropleth (rate per 100,000, and a count-certainty view), signals strong and weak, Tyks marked, month following the replay with a labelled independent browser | none | `research-panel-map-after-*` | Judges' wider-picture ask (AUDIENCE.md) |
| Home | New: "what changed since yesterday" (isolates, resistant finds, signals, each linked), the doctor and research entries with the remembered unit and the open-signal count | `home-before-*` | `home-after-*` | Principle 2 |
| Pitch intro (`#intro`) | New: terraced contour surface of the THL county rate (six flat steps), university and central hospitals on the referral tree with pulses, month slider, labelled "a picture of pressure, not a working view" | none | `intro-after-*` | Pitch opening (OBJECTIVES, visualisation choices) |
| Settings | Truthful "about the data" text; language also switchable from the top bar | `settings-before-*` | `settings-after-*` | Bilingual commitment |
| Shell | Search field (`/` or Ctrl+K) for units, antibiotics, organisms, phenotypes, alerts and pages; skip link and main landmark; URL state on every view; FI/EN switch; API origin from `VITE_AEI_API_URL`; branding tokens; research, settings and intro load on demand; 49 % of the stylesheet removed as dead | | | Item 3 of the brief; deployment shape |

## 2. The doctor's list and the researcher's board as they stand

**Doctor's list.** Opening `#doctor` shows the list at once for the
remembered unit with defaults already chosen: urine, any sex, mild
infection (80 % bar), the last year. One-click filters: specimen, sex,
age group, inpatient day 3 or later, severity (80 % or 90 % bar), period
(last year or last four weeks). Age group and day 3 or later are shown
but tagged "not applied yet", with a banner naming only what was chosen,
because the coverage API has no such filter. The header states the
level the figures come from ("own unit data", or similar units, or the
whole hospital when the unit has too few) and the pool ("365 first
isolates, own unit, since 13 May 2024"). Rows that clear the bar sit
above a line; below it each row says why it moved down. Not-assessable
rows show no figure, only the reason. Wording stays within "covers",
"clears the bar", "moved down because"; nothing says give or recommend.
The footer names the rules in plain words.

**Researcher's board.** The signal feed is always on the left on a
laptop (first tab on a phone): 13 signals in the 365 days to the replay
date at the default start, sentinels pinned on top, each incident card
naming its kind, unit, counts against the usual level and p, and opening
in one click to the isolates behind it (resistant antibiotics named),
then the member alerts, the explanation and a first step labelled as a
template. On the right, the unit grid (ESBL per unit per week, counts),
the network and the map, linked through the URL.

**A judge's first two minutes.** Home shows what arrived today and one
open signal → Doctor: the list for the remembered unit is already there
(1 click) → F, 65+, severe: 3 more clicks, the 90 % bar moves and rows
fall below the line with their reasons → Research: the MED-A ESBL
cluster, one click shows its 7 isolates → Network: MED-A ringed, where
its patients go next with counts → Map: the county picture around Tyks →
Timeline, Events, "ICU MRSA" (10 Feb 2026): every panel moves to the new
as-of date.

## 3. U metrics, before and after

From `design/u-metrics.md` (clock times and commits there). Before is the
pre-night commit measured cleanly; after is wave 2 (2b12f36) with the
wave-3 items noted.

| Metric | Target | Before | After |
|---|---|---|---|
| U1 clicks and seconds to the doctor's list for Urology, urine, F, 65+, severe | ≤ 3 clicks, ≤ 10 s laptop, ≤ 15 s phone | Not reachable (sex, age, onset could not be set; figures were examples) | 4 clicks, about 8 s laptop, about 10 s phone (the list itself is 1 click; the three filters are one each). Above the 3-click target because the named context has three non-default filters |
| U2 clicks from the feed to the isolates behind an alert | 1 | Not reachable | 1, no scroll at 1280 × 860 (wave 3) |
| U3 count and as-of on every number | all views yes | No | Yes on doctor list, feed, grid, network (counts added in wave 3), map, settings, home (badge fixed in wave 3). Still missing: the as-of on the doctor's organisms rail and signals block (states audit) |
| U4 Lighthouse accessibility home / doctor / research; contrast; never colour alone | ≥ 95; pass; pass | 100 / 96 / 100; doctor contrast fails | 100 / 100 / 100; contrast passes; results and alerts carry a glyph and a word |
| U5 missing i18n keys | 0 | 0 (213 keys) | 0 |
| U6 LCP, 4G phone, production build | ≤ 2.5 s | 3.6 / 3.6 / 3.6 s | 3.3 / 3.9 / 6.9 s; home first paint 2.3 → 1.4 s. Not met. Noisy tonight (CPU shared with the experiments night), recorded and not acted on per the addendum |
| U7 timeline: scrub, play, pause, jump to a date, per-panel as-of | all present | 2 of 5 | 5 of 5 |

No change was reverted: the one regression (U4 on home after wave 1, 100
→ 95) was fixed instead within the same hour and measured back at 100.

## 4. Design decisions and alternatives rejected

- Timeline borrows a video player's transport (YouTube), chart event flags (TradingView) and a monitoring time picker's as-of readout (Grafana); a plain date picker was rejected because scrubbing and jumping to the three events is the demo.
- Seeking happens on release of the track, not while dragging, so a drag does not hammer the shared server clock.
- Doctor's list borrows the patient-header strip (Epic storyboard), the "best / other" divider (Google Flights) and the antibiogram row (hospital antibiogram apps); the left-hand form was rejected because the doctor types nothing.
- No organism input on the doctor's page (Artem's addendum); likely organisms are shown beside the list instead.
- Age group and day 3 or later are shown and tagged "not applied yet" rather than hidden, because the doctor expects them and the API gap must be visible; silently filtering in the browser was rejected as statistics in the app.
- Hospital onset does not raise the bar automatically: the 90 % rule for it is undecided (ENGINE 2.6).
- The certainty badge is a lookup on the level the data came from; cut-offs on n were rejected because the team has not chosen them.
- Researcher's board is one page with the feed always visible (PagerDuty incidents) beside one of grid (Grafana status history), network (Datadog service map) or map (Our World in Data choropleth); four equal tabs were rejected because signals come first.
- The grid shades counts and says so; shading by surprise waits for weekly expected counts from the API.
- Network shading is the share of patient flow with counts, labelled "not exposure"; computing exposure in the browser was rejected.
- County polygons come through a new optional API route rather than a copy in the web app, because the data folder is git-ignored and the app reaches the backend only through the contract.
- The pitch intro draws flat terraces, not a smooth field, and is labelled a picture; pulses stay in the intro only.
- WHO AWaRe tier names stay "Access" and "Watch" in Finnish, as Finnish materials use them.

## 5. Accessibility and bilingual results

- Lighthouse accessibility 100 on home, doctor and research; colour contrast passes (`--ink-3` darkened from #5f7381 to #566a78); the last zero-weight audit (a button name not containing its visible text) was fixed.
- Results and alert states always have a glyph and a word; data-quality weeks are hatched and marked "!".
- A skip link is the first tab stop on every page; the timeline's speed control is one radio group and its steps one toolbar, so the content is reached in a few stops; focus is visible everywhere (2 px accent ring).
- Phone: 44 px targets, no sideways scrolling at 390 px on any board tab (the grid scrolls inside its own box).
- The doctor's list prints as one A4 page with the context line (all filters, as-of, "replay of a synthetic laboratory dataset; supports the decision, the doctor decides").
- Finnish and English: 0 missing keys. Copy is kept per surface in `libs/utils/i18n/src/surfaces/`. Fixed during the night: Finnish plurals, decimal commas, p-values in plain decimals, "löydökset" used consistently for isolates, N/M for sex in Finnish, THL region names as given. Not checked by a native reader.
- Open (states audit): the developer-facing offline text ("Start it with pnpm dev") is still shown to users; the organisms rail and the signals block have no loading or error state.

## 6. Contract fields and routes proposed

Collected here rather than in DECISIONS.md (addendum point 4); D-040 was
written before the addendum and stays as it is.

| Proposal | View that needs it | State |
|---|---|---|
| `GET /api/counties`, county polygons (DECISIONS.md D-040) | Regional map, pitch intro | built (contract, client, API wiring, test), pending Artem |
| `THRESHOLDS` re-exported from `@aei/contract` | Doctor's list bar labels, so they come from the gear and are not copied | built (additive) |
| `CoverageQuery.ageGroup` and `onset` | Doctor's list: age group and day 3 or later are shown but not applied | proposed; needs the rule for which filter is dropped first when the pool is thin (D-033 has it for sex) |
| `AntibioticCoverage.newest` | Doctor's list row, newest result date (today "results to {as-of}") | proposed |
| `CoverageQuery.patientId` → prior resistant findings | Doctor's list flag | proposed; a privacy question first |
| `Alert.severity` | Signal feed | proposed |
| `Alert.firstStep` | Signal feed (today a per-kind template, labelled) | proposed |
| `RelationsResponse.exposure` (ENGINE 4) | Network downstream shading (today flow share) | proposed |
| `RegionalSeries.interval` | Map uncertainty view (today count-based) | proposed |
| `GET /api/weekly`, observed and expected per unit-week with a quality flag | Unit grid shade by surprise (today counts) | proposed |

Blocked on decisions (QUESTIONS.md items not opened tonight): the bar
for hospital-onset infections (ENGINE 2.6, τ per syndrome); n cut-offs
for a certainty word; the choropleth's step breaks (the map uses zero
plus quartiles of non-zero months, the grid five steps over visible
cells; both are drawing choices to confirm).

## 7. Where branding attaches

- Tokens: the first `:root` block of `apps/web/src/styles.css`:
  `--brand-accent`, `--brand-accent-soft`, `--brand-accent-ink`,
  `--brand-font-ui`, `--brand-font-data`, `--brand-radius`. The working
  accent (`--live`), fonts and panel radius read from them; everything
  else is neutral or a reserved status colour (alert red, watch amber,
  ok green, resistance orange).
- Slots: the mark and name in the top bar (`TopBar.tsx`, `.mark`), the
  favicon (`apps/web/public/favicon.svg`), the intro's title block.
- Copy voice: plain and clinical, in `libs/utils/i18n`; no brand voice
  was written.

## 8. What I would do with another night

1. The states audit's list (`design/review-states.md`): loading, empty,
   error and as-of on the organisms rail and the signals block; clinical
   offline copy with the last good as-of; recovery in `live.ts` (retry,
   online and offline events); stale data with a visible "updating" on
   grid, network and map; the grid's week window in the URL; the board
   tabs as a roving tab list.
2. The Ask field on the research board with its chips, tested against a
   local fake model.
3. One Impeccable pass per surface, then the two final Fable UX reviews
   (doctor journey, researcher journey), which did not run.
4. U6: the research page's first meaningful content waits for a year of
   alerts; a smaller first request would bring it toward 2.5 s.
5. A Finnish reader through every surface, and a timed test on someone
   outside the team, as AUDIENCE.md asks.
6. Move reusable pieces out of the app into `libs/utils` as AGENTS.md
   asks: the search matcher, the number formatting helpers, the map
   projection.
