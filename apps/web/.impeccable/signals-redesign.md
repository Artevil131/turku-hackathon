---
version: 1
slug: "signals-redesign"
primary_target: "apps/web/src/components/research/SignalFeed.tsx"
related_targets:
  - "apps/web/src/components/EventsStrip.tsx"
  - "apps/web/src/components/research/feed/IncidentRow.tsx"
  - "apps/web/src/components/research/feed/names.ts"
  - "apps/web/src/components/research/math/AlertMath.tsx"
---

# The signal section, 17 Oct 2026: one voice, one line, grouped by time

Mode: Operate. World: the clinical white of `surfaces/apps-web-src-app-tsx.md`,
unchanged. This page fixes how the three signal surfaces (the "Found so far"
strip, the Signals window, the Signal card) talk, not how the page looks.
Artem's verdict: "the whole signal section is confusing and overwhelming and
should be more intuitive and convenient."

Screenshots (1440×900 and 390×844, English, the MED-A ESBL incident selected)
live outside the repo in the session notes folder
`~/Library/Application Support/Claude/side-session-notes/local_c5d48446-493c-44e0-8404-4a3d8db8bbe5/m8-signals-shots/`:
`before-1440.png`, `before-signals-1440.png`, `before-card-1440.png`,
`before-strip-1440.png`, `before-390.png`, and the matching `after-*.png`
(`after-card-1440.png` is the layer in focus mode with its sections open,
`after-filter-1440.png` the open Filter popover).

## 1. What confuses today

1. **Three names for one thing.** The strip tile says "Internal medicine A /
   ESBL", the list row "ESBL · Internal medicine A", the card "cluster /
   ESBL (extended-spectrum beta-lactamase) in Internal medicine A". The
   researcher has to match them by eye.
2. **Jargon as kind words.** "sentinel", "cluster", "trend", "data" are the
   engine's names (ENGINE.md 3.6). A sentinel is not a word a ward nurse
   or an epidemiologist uses for "the first MRSA here in half a year".
3. **Six controls before the first signal.** Two selects, four kind chips
   with counts, a window count ("13 · 365 d"), an as-of date. Then a
   heading "Open incidents · 1" with an ⓘ that explains that "open" is a
   time window, not a status. A heading that needs a footnote is the wrong
   heading.
4. **The row says too much before it is asked.** Collapsed: title, date,
   status word ("Monitoring"), measure. Selected: eight lines, including a
   sentence that repeats the measure ("Latest alert: 7 patients observed ·
   expected 1.4 · 28 days to 30.4.2025"), an ownership line, the reach
   chips, a link to a card that is already open, and a "Member alerts"
   disclosure under it.
5. **Status words carry no decision.** "Monitoring" and "High priority"
   stand on every row in ink-3; they look like the measure's label.
6. **The card repeats the row.** Kind word, title, a where-line that
   restates the patient count the bars show one line later, and the same
   evidence sentence again inside "How we calculate it". The action row
   has five buttons for one card.
7. **The strip's label is a count without a reference.** "Found so far ·
   19": since when?

## 2. The rules

0. **The card is a layer, not a window.** Clicking a row goes one level
   deeper in the same Signals window: the list slides left, the card slides
   in (`--mo-3`, instant under reduced motion) with "Back to the list" and
   the row's title as its heading. `inc=` in the URL drives it, so a pill
   or a map click opens the same layer; Escape or Back returns to the list
   and clears `inc=`. The Signals window is therefore large by default
   (5 of 12 columns, full height); the card's own window and the assistant
   stay in the tray as pop-outs, closed by default. Inside the layer, under
   the measure: "What this signal may mean" (the assistant's reading,
   template text by default, the model's wording when the API offers it)
   and "Analyse this signal" (the event's share by week over 26 weeks with
   its chart, and the rate in the signal's window with its interval, both
   from the Tools model on the signal's own slice) with "Open in Tools",
   which presets the Tools window's slice and brings it forward.
1. **One voice.** Every surface shows the same title, built once in
   `feed/names.ts` (`signalTitle`): `{kind in plain words} · {what} ·
   {unit}`. "Cluster · ESBL · Internal medicine A", "New carrier · MRSA ·
   Intensive care unit", "Sampling gap · Health centre South", "Rising ·
   trimethoprim resistance in E. coli · hospital". The engine's kind ids
   stay in code and in the URL (`kind=cluster`); the UI never shows them.
2. **One line per signal.** Glyph · title · date (right), and under it one
   measure in ink-3, built once (`measureLine`): "7 patients · usual 1.4",
   "0 cultures · usual 52", "1 patient", "15 % → 20 %". Nothing else until
   selected. The selected row adds only the reach chips and one link,
   "Open the card"; "One incident · n related alerts" stays in the selected
   row in small type (the smoke reads it).
3. **Grouped by time, not status.** "This week", "This month" (28 days,
   the engine's window), "Earlier", relative to the replay clock, each a
   plain heading with a count. No "Open incidents", no ⓘ. High priority is
   a 6 px red dot before the title with the ownership sentence as its
   tooltip and hidden text; never a word in the row.
4. **One filter control.** A "Filter" button opens a compact popover with
   unit, kind (plain words, checkboxes) and phenotype; active filters are
   removable chips in one row under the header. Enter or Space opens,
   Escape closes and returns focus, Tab moves through the fields.
5. **The strip** reuses the title and the measure on each tile; its label
   reads "New since {replay start} · n"; "n more in the list" stays.
6. **The card** opens with the same title as its heading, then the two
   bars and the surprise, then one sentence in words ("More ESBL than this
   unit usually has, in 28 days"), then the collapsed sections (How we
   calculate it, Reaches, Isolates, Explain) and the actions. The evidence
   sentence lives only inside "How we calculate it". The audited
   `cardHow*` sentences (MATH-REVIEW.md) are untouched.
7. **Motion.** Rows expand with the existing `grid-template-rows` ease
   (`--mo-3`); group headings never animate; nothing else moves.

## 3. Vocabulary

| id (code, URL) | EN | FI | Title example EN | Title example FI |
|---|---|---|---|---|
| sentinel (`new-in-unit`) | New carrier | Uusi kantaja | New carrier · MRSA · Intensive care unit | Uusi kantaja · MRSA · Teho-osasto |
| sentinel (`cpe`) | New carrier | Uusi kantaja | New carrier · CPE Citrobacter freundii · Emergency department | Uusi kantaja · CPE Citrobacter freundii · Päivystys |
| cluster (`phenotype-excess`) | Cluster | Rypäs | Cluster · ESBL · Internal medicine A | Rypäs · ESBL · Sisätaudit A |
| cluster (`profile-excess`) | Cluster | Rypäs | Cluster · rare Escherichia coli profile · Urology | Rypäs · harvinainen Escherichia coli -profiili · Urologia |
| trend (`rising-trend`) | Rising | Nousussa | Rising · trimethoprim resistance in Escherichia coli · hospital | Nousussa · trimetopriimiresistenssi, Escherichia coli · sairaala |
| data (`sampling-drop`, `empty-run`) | Sampling gap | Näytekatko | Sampling gap · Health centre South | Näytekatko · Terveyskeskus Etelä |
| divergence (unused) | Divergence | Poikkeama | | |

Measures:

| Alert | EN | FI |
|---|---|---|
| phenotype- or profile-excess | 7 patients · usual 1.4 | 7 potilasta · tavallisesti 1,4 |
| sampling-drop | 0 cultures · usual 52 | 0 viljelyä · tavallisesti 52 |
| empty-run | 2 days without cultures · usual 4 a day | 2 päivää ilman viljelyjä · tavallisesti 4 päivässä |
| rising-trend | 15 % → 20 % | 15 % → 20 % |
| new-in-unit, cpe | 1 patient | 1 potilas |

Groups and controls:

| | EN | FI |
|---|---|---|
| group, 7 days | This week · {n} | Tällä viikolla · {n} |
| group, 28 days | This month · {n} | Tässä kuussa · {n} |
| group, older | Earlier · {n} | Aiemmin · {n} |
| filter button | Filter / Filter · {n} | Rajaa / Rajaa · {n} |
| popover fields | Unit · Kind · Phenotype | Yksikkö · Laji · Fenotyyppi |
| clear | Clear all | Poista kaikki |
| remove one chip | Remove {filter} | Poista {filter} |
| selected row link | Open the card | Avaa kortti |
| strip label | New since {date} · {n} | Uutta {date} jälkeen · {n} |
| high priority dot (tooltip) | the ownership sentence, e.g. "Inform: infection control and the responsible doctor for Urology" | "Ilmoitetaan: infektioiden torjunta ja yksikön Urologia vastuulääkäri" |

The card's meaning sentence (`cardMeans*`), one per detector:

| Alert | EN | FI |
|---|---|---|
| phenotype-excess | More {phenotype} than this unit usually has, in {days} days. | Enemmän {phenotype}-löydöksiä kuin tällä yksiköllä tavallisesti on, {days} päivässä. |
| profile-excess | More of one rare {organism} profile than expected for this unit, in {days} days. | Enemmän yhtä harvinaista {organism} -profiilia kuin tälle yksikölle on odotettavissa, {days} päivässä. |
| sampling-drop | Far fewer cultures from this unit than usual this week: a data gap, not a resistance change. | Selvästi vähemmän viljelyjä tältä yksiköltä kuin tavallisesti tällä viikolla: aineistokatko, ei resistenssin muutos. |
| empty-run | No cultures from this unit for {n} days: a data gap, not a resistance change. | Ei viljelyjä tältä yksiköltä {n} päivään: aineistokatko, ei resistenssin muutos. |
| rising-trend | {antibiotic} resistance in {organism} has been rising across the hospital. | {antibiotic}resistenssi ({organism}) on ollut nousussa koko sairaalassa. |
| new-in-unit | The first {phenotype} on this unit in {days} days. | Ensimmäinen {phenotype} tällä yksiköllä {days} päivään. |
| cpe | A CPE find; every one is an alert. | CPE-löydös; jokainen on hälytys. |

These sentences add no claim the audited `cardHow*` sentences do not make:
the phenotype baseline is the unit's own year, the profile baseline is
hospital-wide scaled to the unit, data alerts are sampling problems, the
trend is hospital-wide.

## 4. Structure (class names)

- Row: `article.feed-row[data-key][aria-current]` › `button.feed-row-main`
  (`.feed-kind`, `.feed-dot` when high priority, `.feed-name`,
  `time.feed-date`, `.feed-measure`) › `.feed-more[data-open]` ›
  `.feed-more-in` (`.feed-summary` small, `.sp-line`, `button.feed-open`).
  The article takes the click, so the smoke's `.feed-row.click()` selects.
- Groups: `section.feed-group` › `h2.feed-group-title` › `ul.feed-list`.
- Filter: `button.feed-filter[aria-expanded]` › `div.feed-pop[role=dialog]`
  (`select`, `fieldset.feed-pop-kinds` with checkboxes, `select`);
  `ul.feed-active` › `li` › `button.feed-active-chip`.
- Strip tile: `button.tl-ev` › `.tl-ev-code` (glyph) · `.tl-ev-name` ·
  `.tl-ev-what` (measure) · `.tl-ev-when`.
- Layer: `.feed-stack[data-layer=list|card]` › `.feed-pane-list` (header,
  groups) and `.feed-pane-card` (the card, `inert` when not shown).
- Card (`aside.sig.math`, `.sig-layer` inside the list): `.sig-head`
  (`button.sig-back`, `h2.sig-title` with glyph, dot, title) › `p.sig-where`
  (window, fired) › `.sig-bars` › `.sig-surprise` › `p.sig-means` ›
  `section.sig-section` (assistant inline) › `details.sig-analyse`
  (`.sig-result` ×2, `button.sig-tools`) › `details.sig-how` ›
  `details.sig-reach` › `details.sig-isolates` › `.math-explain` ›
  `footer.sig-actions`.
