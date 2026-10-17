# Researcher view: plan, 2026-10-17

Goal (Artem, after the judges): one smooth, united researcher view where a
signal is easy to see, select and understand, and that takes in more data
(more hospitals, more feeds) without the inference falling over. UI first,
then the mathematics (correct, and understood), then the many-hospital
connections with the colleague who builds them.

Branch: `research/unified`, cut from `main` at 4fa9960. The judge's notes
are in JUDGE-FEEDBACK.md.

## 1. What main already has (so we build on it, not beside it)

- Timeline (`apps/web/src/components/Timeline.tsx`, `hero/WeeklyBand.tsx`):
  weekly resistant finds by phenotype, nine unit lanes, signal pills
  ("ESBL 3/0.2", "MRSA new", "2 signals"), speed menu (1 day / 2 s, day,
  week, month), "Demo jumps" menu with three hard-coded dates (E1, E3, E2;
  E4 the slow trend is missing), data-quality tick.
- Research board (`components/research/`): docked windows (signals feed,
  map, patient flow, unit grid, alert math, assistant), layout saved in
  localStorage, state in the URL hash (`#research?inc&unit&kind&ph&focus`).
  The feed selects an incident; the math panel and the unit highlight
  follow it. The timeline does not: it sits in App, above the board.
- Math: `components/math/` (PoissonTail, SurpriseScale, WeeklyWindow,
  CoverageShape), `research/math/AlertMath.tsx`, the Method page (`#method`).
- Map: `research/geo/GeoMap.tsx`, THL county rates, legend at the bottom,
  county detail, forecasts, Tyks comparison.

## 2. The one principle: a signal is selected once, everything follows

A click on a pill in the timeline, a row in the feed, a lit unit on the
flow graph or a glyph on the map means the same thing: "tell me about this
signal". One selection, kept in the URL (`inc=`), read by every panel.

Elaboration has three depths, so it is clear and never overwhelming:

1. **Hover or focus** (pill, row, glyph): one line. "ESBL E. coli, Urology,
   5 patients in 4 weeks, 0.2 usual."
2. **Selected** (the card, see 3.2): what, where, when, the two bars
   (observed against usual), the surprise, one sentence on how it is
   calculated, the isolates behind it, the units it reaches, and three
   actions: go to that day, show on the map, open the method.
3. **Method** (`#method`, and an ⓘ on each figure): the full test, the
   constants, the experiment that chose them.

Selecting never moves the replay clock by itself. "Go to this day" does,
on purpose. (Open question 2 below.)

## 3. Workstreams, in order

### 3.1 Selection wiring (UI, no decision needed)

- Timeline pills become selectable: click sets `inc=` in the hash; the
  timeline reads `inc=` and marks the selected pill (ring, lane lift) and
  the other pills of the same incident.
- Feed row selection scrolls the timeline to the pill's date and the pill
  into view; map and flow light the unit (the `focus` field already does
  this for the flow).
- Keyboard: arrows between pills, Enter selects, Escape clears. Hover gives
  depth 1 as a tooltip; focus the same.
- Files: `Timeline.tsx`, `hero/WeeklyBand.tsx`, `research/board.ts`
  (selection may need to move from the board to App or stay in the hash
  with a small `useHashParam` hook both read), `url.ts`.

### 3.2 The signal card (replaces "What these signals may mean" + "Alert math")

- One card, one column, in the reading order of depth 2 above. The current
  "Alert math" content (two bars, surprise, test line, isolates) is the
  core; it gains a title in words, the "how we calculate it" sentence, the
  reach chips (`feed/SpanChips.tsx`), and the three actions.
- The sentence per detector, with its numbers filled in, e.g. "We count
  distinct patients with this profile in the last 28 days on this unit (5)
  and compare with what the unit's own last year predicts (0.2). The chance
  of 5 or more by luck is 1 in 50 000." The ⓘ opens the PoissonTail figure.
  Sentinels say "a rule, no test: the first MRSA here in 180 days".
- Copy in `libs/utils/i18n/src/surfaces/`, both languages.

### 3.3 Events strip (the four planted events)

- "Demo jumps" becomes a visible strip of the four events from
  `benchmarks/planted-events/README.md` (E1 URO ESBL cluster, E2 ICU MRSA,
  E3 PHC-S sampling gap, E4 the slow TMP/TZP rises), each with a date, a
  one-line description and what the tool shows for it.
- Jump = seek the clock to the day the alert fires and select that incident,
  so the card and the timeline land on it together. E4 needs the
  rising-trend alert to exist at hospital level; check it does.
- The strip is the presenter's path through the demo. Not hidden in a menu.

### 3.4 Timeline controls and legends

- Step and speed as two visible controls: Step `day · week · month`
  (buttons), Speed `slow · normal · fast`; "1 day / 2 s" explained in words
  on hover. The skip-to-start and skip-to-end buttons stay.
- The timeline says whose it is: a title "Tyks · nine units" (from
  `Meta`, so a second hospital names itself), next to the date.
- A legend for the lanes: what a bump is (cultures per week), what a pill
  is (a signal; "7/1.4 = observed/usual" moved next to the lanes and
  worded), the phenotype colours already in the top legend.
- Unit lanes are clickable and reliable: clicking the lane label (ED,
  MED-A, ...) sets `unit=` for the whole board (feed filter, lit unit on
  flow and grid, the lane raised and the others dimmed); clicking again
  clears it; the current unit is shown in the title ("Tyks · Urology").
  Today the lane labels are passive text, so a click does nothing.
- A caption at the top of the map: "THL notified cases per county, October
  2025. Colour: cases per 100 000 a year. Dots: county signals, filled =
  survives correction." The bottom legend stays. An ⓘ opens the source
  and method.

### 3.5 Abbreviations and figures

- A glossary (one i18n surface): ESBL, MRSA, VRE, CPE, n, %S, %R, usual,
  surprise, first isolate, day 3, unit codes (PHC-N = Health centre North).
  Any abbreviation on screen gets an `<abbr>` with the full name and a
  tooltip; the first use on a card spells it out.
- Every number that is a ratio shows what it is a ratio of ("5 patients,
  0.2 usual", never bare "5/0.2" without the legend in reach).

### 3.6 Motion

- A motion system in `styles.css`: three durations (120, 200, 320 ms), one
  easing, all behind `prefers-reduced-motion`. No new dependency: CSS
  transitions and the View Transitions API (React 19). (Open question 4.)
- Where it goes: selecting a pill (ring grows, lane lifts, feed row scrolls
  into view), the card's content cross-fades between incidents, numbers in
  the card tween, the playhead eases per tick, county fills transition when
  the month changes, workspace windows ease on dock and resize.

### 3.7 Mathematics, after the UI (team decisions)

- Correctness: the live detectors (D-020, D-044) are measured; the coverage
  list is Wilson (D-023/D-033) with the Beta-binomial accepted but not
  shipped (D-041, D-046). Nothing here changes until the team decides.
- Understanding: the per-detector sentences of 3.2 and the Method page are
  the deliverable. Artem reviews each sentence against ENGINE.md.

### 3.8 Many hospitals and more data (team decision; colleague builds the connections)

The server today holds one dataset (`apps/api/src/main.ts`, `derive()`),
one fixed unit list (`@aei/domain` `WARDS`, imported directly by many web
components although `Meta.wards` already comes from the server), and the
regional THL data beside it. Options:

- **A. One server per hospital, a registry.** A `sites` list (id, name,
  API origin, county). The web app gets a site switcher; the map's hospital
  marker opens that site's timeline. Data stays separate by construction;
  inference per site is unchanged. Cross-site views (two hospitals side by
  side) need the client to call two servers.
- **B. One server, datasets keyed by site.** Every route takes `?site=`;
  the server keeps a `Map<siteId, state>` and derives per site; the clock
  is per site or shared. One deployment, but every route and the live
  stream change, and one bad feed can affect the whole server.
- **C. A + a federation route.** As A, plus `/api/sites` served by any
  node so the map and a site switcher need one origin to start from.

Whichever is chosen: the web reads wards, organisms and antibiotics from
`Meta`, never from `WARDS` (a refactor across the research and doctor
components); new wards arriving through ingest need a ward type for the
coverage fallback (unit → ward type → hospital), so the code maps must
carry it; detectors already run per unit and adapt.

How the map joins the hospital: the county of the site (A/C carry it in
the registry) is the key; a county signal lists the sites in it, a site's
card names its county's signal.

## 4. Order of work

1. 3.1 selection wiring, 3.3 events strip (the demo path first).
2. 3.2 the signal card, 3.4 controls and legends, 3.5 glossary.
3. 3.6 motion over all of it.
4. 3.7 mathematics review with Artem.
5. 3.8 with the colleague, once option A/B/C is decided.

## 5. Open questions for Artem

1. Many hospitals: A, B or C (3.8)? Who owns the registry, us or the
   colleague's connection work?
2. Should selecting a signal ever move the replay clock, or only the
   explicit "go to this day"?
3. Are the four planted events the canonical event strip, and should the
   slow trend (E4) be shown as a hospital-level signal?
4. Motion with no new dependency (CSS + View Transitions), or add a library?
