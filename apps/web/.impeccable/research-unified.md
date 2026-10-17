---
version: 1
slug: "research-unified"
primary_target: "apps/web/src/components/research/ResearchBoard.tsx"
related_targets:
  - "apps/web/src/components/Timeline.tsx"
  - "apps/web/src/components/hero/WeeklyBand.tsx"
  - "apps/web/src/components/research/SignalFeed.tsx"
  - "apps/web/src/components/research/math/AlertMath.tsx"
  - "apps/web/src/components/research/geo/GeoMap.tsx"
  - "apps/web/src/components/research/HospitalNetwork.tsx"
---

# The unified researcher view: design direction

Mode: Operate. World: the clinical white of the surface contract
(`surfaces/apps-web-src-app-tsx.md`), as it ships today in `styles.css`:
flat white panels on a pale ground, one accent (`--live`, the brand violet)
for selection and primary actions, navy ink, status colours only with a word
or glyph, tabular figures. This document does not restart the direction. It
adds one thing the contract lacked: a selection model that every panel obeys,
and the motion that makes a selection feel like one event.

Plan sections covered: RESEARCH-PLAN.md 2 and 3.1 to 3.6. The parent session
wires state; this file and the CSS it names are presentational. Every class
the parent toggles is listed in section 8.

## 1. The principle in one sentence

A signal is selected once, by a click anywhere it appears, and the whole page
turns toward it: the selected thing gets the accent ring, its relatives get a
quiet mark, and everything unrelated steps back half a tone. Nothing moves
the replay clock except "Go to this day".

The visitor's success: find a signal, understand it in ten seconds, and know
where to look for more. That is depth 1 (one line on hover or focus), depth 2
(the card) and depth 3 (the Method page), exactly as the plan states.

## 2. Selection model and its visual states

### 2.1 The three states every surface knows

| State | Meaning | How it looks (one rule, every surface) |
|---|---|---|
| **selected** | the incident in `inc=` | 2 px accent ring (`--live`), offset 2 px, white gap between ring and element; the element itself rises: full opacity, label at 600 weight |
| **kin** | another appearance of the same incident, or a unit it reaches | 1 px accent ring, no lift; on the feed a thin accent dot in the gutter |
| **dimmed** | everything else while a selection exists | opacity 0.42 (`--dim-mark`) for marks without text: dots, ribbons, lane lines, map glyphs; 0.7 (`--dim-text`) for anything that carries text: pills, flow nodes, grid headers, so it stays above 4.5:1; hover restores 1; colour untouched so the phenotype coding survives. Lane labels and event tiles never dim by opacity: they step back by weight and tone |

A focused **unit** (`unit=`) is a second, orthogonal axis: it lifts a lane,
a flow node, a grid column and the feed filter, and dims the other units. The
two axes compose: a selected signal in a non-focused unit keeps its ring, but
its lane is dimmed as a lane. The ring always wins over the dim (a selected
element is never dimmed, even if its unit is not the focused one).

Dimming is applied by the **container**, not the element: `.has-selection` on
the container dims every candidate that is not `.is-selected` or `.is-kin`;
`.has-unit` on the container dims every lane or node that is not `.is-focus`.
The parent only has to set one class on the container and one on the hit.

### 2.2 Per surface

**Timeline pill** (`hero/WeeklyBand.tsx`, `.hs-pill`)
- selected: ring drawn as a second `rect` stroke on `.hs-pill-bg` (stroke
  accent 2 px, `paint-order: stroke`); the pill group gets
  `transform: translateY(-2px)` (the "lift"); the lane line under it goes to
  full `--line-strong`.
- kin: the other pills of the same incident get a 1 px accent stroke.
- dimmed: `.hs.has-selection .hs-pill:not(.is-selected):not(.is-kin)` at
  `--dim-text` (0.7), back to 1 on hover; pointer events still on.
- hover and keyboard focus keep the current accent 2 px stroke; focus ring on
  the pill is `--ink` so it reads apart from selection.

**Timeline lane** (`<g class="hs-lane">`)
- focus (`.is-focus`): the lane label becomes 600 weight ink, the lane line
  goes solid at 0.8 opacity, the ribbon stays full. In the other lanes with
  `.hs.has-unit` the ribbon and line drop to `--dim-mark`; the label stays at
  full opacity in `--ink-3`, 400 weight, because it is a control.
- lane label is a control: cursor pointer, underline on hover, 44 px hit
  rect behind the text (`.hs-lane-hit`), `role="button"`, `aria-pressed`
  when focused.

**Feed row** (`.feed-row`)
- selected: as today (`aria-current="true"`: accent-soft background, accent
  left rule 3 px). The rule stays because it is the one place the contract
  already uses it; it is a selection marker, not a card decoration.
- kin: a 6 px accent dot in the left gutter (`.feed-row.is-kin::before`).
- dimmed: `.feed.has-selection .feed-row:not([aria-current="true"]):not(.is-kin)`
  text at `--ink-3`, glyph at 0.5 opacity. Row backgrounds unchanged so the
  list still scans.

**Map** (`geo/GeoMap.tsx`)
- county focus (`.geo-county.is-focus`): stroke `--ink` 2.5 px as the current
  selected county, plus the fill transitions (section 7); counties that are
  not the focused one with `.geo.has-selection` take a 30 % white wash
  (`fill-opacity: 0.7`) so the focused county is the darkest shape on the map.
- glyph selected (`.geo-glyph.is-selected`): radius unchanged, a 2 px accent
  halo ring (`r + 4`) drawn by the parent as a sibling circle `.geo-halo`, or
  by `stroke` on the glyph: stroke accent 2.5 px, `paint-order: stroke`.
- glyph dimmed: opacity 0.42.
- hospital marker selected (`.geo-hosp.is-selected`): same halo.

**Patient flow** (`HospitalNetwork.tsx`, `.hnet-node`)
- lit (`data-lit="true"`, existing): the amber 5 px stroke stays; it means
  "has a signal now", independent of selection.
- selected unit (`data-selected`, existing) and focus (`data-focus`,
  existing) stay as they are. New: `.hnet.has-selection .hnet-node:not([data-selected="true"]):not([data-focus="true"]):not(.is-kin)`
  at opacity 0.42, tubes not touching the selected unit at 0.25 stroke
  opacity. `.is-kin` on the nodes the selected signal reaches (the span
  chips' units) gives a 1 px accent ring.

**Unit grid** (`.ugrid-td[data-selected]`, existing)
- the existing selected cell style stays; add `.ugrid.has-unit th:not([data-selected="true"])`
  at opacity 0.6. Cells transition background (section 7).

**Events strip** (`.tl-ev`): `.is-current` when the selected incident is the
event's incident, drawn as the selected ring plus accent-soft fill.

### 2.3 Hover and focus: depth 1

One line, the same on every surface, from one i18n key per kind:

| | EN | FI |
|---|---|---|
| cluster | `{what} · {unit} · {n} patients in {weeks} weeks, usual {expected}` → "ESBL E. coli · Urology · 5 patients in 4 weeks, usual 0.2" | `{what} · {unit} · {n} potilasta {weeks} viikossa, tavallisesti {expected}` → "ESBL E. coli · Urologia · 5 potilasta 4 viikossa, tavallisesti 0,2" |
| sentinel | `{what} · {unit} · first in {days} days` → "MRSA · Intensive care · first in 180 days" | `{what} · {unit} · ensimmäinen {days} päivään` → "MRSA · Teho-osasto · ensimmäinen 180 päivään" |
| data | `{unit} · {n} cultures this week, usual {expected}` → "Health centre South · 0 cultures this week, usual 52" | `{unit} · {n} viljelyä tällä viikolla, tavallisesti {expected}` → "Terveyskeskus Etelä · 0 viljelyä tällä viikolla, tavallisesti 52" |
| trend | `{series} · {from} → {to} over {years} years` → "TMP in urinary E. coli · 15 % → 20 % resistant over 3 years" | `{series} · {from} → {to} {years} vuodessa` → "TMP virtsan E. colissa · 15 % → 20 % resistenttejä 3 vuodessa" |

Shown as the existing `.hs-read` popover on the timeline, a `title` plus a
`.gloss-tip` tooltip on the feed and the map. Never hover-only: keyboard
focus shows the same line.

## 3. The signal card (replaces "What these signals may mean" and "Alert math")

One white panel, one column, 12 px padding, reading top to bottom. It is the
depth-2 answer and its order is the order a researcher asks: what, where,
when; how much against usual; how sure; how we know; what it touches; the
evidence; what next.

```
┌ Signal ─────────────────────────────────── ⓘ ┐
│ ▲ Cluster                                     │   .sig-kind  (glyph + word)
│ ESBL E. coli in Urology                       │   .sig-title (15/600)
│ 5 patients, 2 Jun – 29 Jun 2025 · fired 9 Jun │   .sig-where (12, ink-2)
│                                               │
│ Observed  ████████████████████████  5         │   .sig-bar[data-tone=obs]
│ Usual     ▒▒                        0.2       │   .sig-bar[data-tone=usual]
│                                               │
│ 4.7  surprise · 1 in 50 000 by chance         │   .sig-surprise (22/600 + 12)
│                                               │
│ How we calculate it                       ⓘ   │   .sig-how
│ We count distinct patients with this profile  │
│ in the last 28 days on this unit (5) and      │
│ compare with what the unit's own last year    │
│ predicts (0.2). The chance of 5 or more by    │
│ luck is 1 in 50 000.                          │
│                                               │
│ Reaches  URO → MED-A · SURG   also GER        │   .sig-reach (SpanChips)
│                                               │
│ Isolates behind it (5)                    ▸   │   .sig-isolates (details)
│                                               │
├───────────────────────────────────────────────┤
│ [ Go to this day ]  [ Show on map ]  [ Method ]│   .sig-actions
└───────────────────────────────────────────────┘
```

Rules:
- **Title in words.** "ESBL E. coli in Urology", never "ESBL 3/0.2". The
  first abbreviation on the card is spelled out once in the where-line or
  the how-sentence (section 6): "ESBL (extended-spectrum beta-lactamase)".
- **Two bars, one scale.** Observed is a solid `--ink-2` bar, usual is the
  dashed outline bar already in `math.css`. Both share the same x scale so
  5 against 0.2 is seen before it is read. The value sits at the right end
  in 600 weight with its noun: "5 patients", "0.2 usual".
- **The surprise number** is the one display-size figure (`--t-l`, 22 px).
  Its label is a phrase, not a symbol: "surprise · 1 in 50 000 by chance".
  The ⓘ beside it opens the SurpriseScale figure. −log10 p appears only on
  the Method page.
- **"How we calculate it"** is one sentence per detector with the numbers
  filled in, under a 13/600 heading, with an ⓘ that opens the PoissonTail or
  the matching figure inline (a disclosure, not a route change). Sentinels:
  "A rule, no test: the first MRSA here in 180 days."
- **Reach chips** are the existing `feed/SpanChips.tsx`; clicking a chip
  sets `unit=` (the second axis) and the flow node lights.
- **Isolates** are a `<details>` closed by default with the count in the
  summary; opening it keeps the card in place (no "back" view).
- **Three actions**, pinned at the foot: primary "Go to this day" (accent
  fill; the only thing that moves the clock), "Show on map" (sets the map's
  county focus and scrolls the map window into view), "Method" (a link to
  `#method` with the detector anchored).
- **Empty state:** "Pick a signal: a pill on the timeline, a row in the
  list, a unit on the flow or a dot on the map." / "Valitse signaali:
  merkki aikajanalta, rivi listasta, yksikkö virtauksesta tai piste
  kartalta."
- **Switching incidents** cross-fades the card body (section 7); the panel
  frame and the action row never move.

### 3.1 Copy for the card

| Key (proposed, surface `math` or new `card`) | EN | FI |
|---|---|---|
| cardTitle | Signal | Signaali |
| cardObserved | Observed | Havaittu |
| cardUsual | Usual | Tavallinen |
| cardPatients | {n} patients | {n} potilasta |
| cardSurprise | surprise | yllättävyys |
| cardChance | 1 in {n} by chance | 1 : {n} sattumalta |
| cardHow | How we calculate it | Näin se lasketaan |
| cardHowCluster | We count distinct patients with this profile in the last {days} days on this unit ({n}) and compare with what the unit's own last year predicts ({expected}). The chance of {n} or more by luck is 1 in {odds}. | Laskemme tämän profiilin eri potilaat yksikössä viimeisten {days} päivän ajalta ({n}) ja vertaamme siihen, mitä yksikön oma edellinen vuosi ennustaa ({expected}). Todennäköisyys saada {n} tai enemmän sattumalta on 1 : {odds}. |
| cardHowSentinel | A rule, no test: the first {what} here in {days} days. | Sääntö, ei testiä: ensimmäinen {what} täällä {days} päivään. |
| cardHowData | We count cultures this unit sent this week ({n}) against its usual week ({expected}). Zero in a week that usually has {expected} is a feed or sampling problem, not a resistance change. | Laskemme yksikön tällä viikolla lähettämät viljelyt ({n}) ja vertaamme sen tavalliseen viikkoon ({expected}). Nolla viikolla, jolla tavallisesti on {expected}, on syöte- tai näytteenotto-ongelma, ei resistenssin muutos. |
| cardHowTrend | We take the resistant share of first isolates in each rolling twelve months ({from} → {to}) and test whether the slope is steeper than chance allows. | Otamme ensimmäisten isolaattien resistentin osuuden jokaiselta liukuvalta 12 kuukaudelta ({from} → {to}) ja testaamme, onko nousu jyrkempi kuin sattuma sallii. |
| cardReach | Reaches | Ulottuu |
| cardIsolates | Isolates behind it ({n}) | Isolaatit sen takana ({n}) |
| cardGoToDay | Go to this day | Siirry tähän päivään |
| cardShowMap | Show on map | Näytä kartalla |
| cardMethod | Method | Menetelmä |
| cardEmpty | Pick a signal: a pill on the timeline, a row in the list, a unit on the flow or a dot on the map. | Valitse signaali: merkki aikajanalta, rivi listasta, yksikkö virtauksesta tai piste kartalta. |
| cardFired | fired {date} | hälytti {date} |

The sentences are proposals for Artem to check against ENGINE.md (plan 3.7).
The constants in them (28 days, "last year") come from DECISIONS.md, not from
this file.

## 4. The events strip

Visible, not a menu. It sits at the right end of the timeline band on wide
screens and as a horizontal scroll row under the strip on the phone. Four
tiles, one per planted event, in demo order E1 E3 E2 E4 (the order the
replay meets them). Each tile:

```
┌────────────────────────────┐
│ E1  Jun 2025         URO   │   .tl-ev-code  .tl-ev-when  .tl-ev-unit
│ ESBL E. coli cluster       │   .tl-ev-name (13/600)
│ 5 a week against 0.2       │   .tl-ev-what (12, ink-2): what the tool shows
└────────────────────────────┘
```

- Tile is a button. Click = seek the clock to the day the alert fires and
  select the incident, together (one animation: the playhead eases to the
  day, the pill rings, the card cross-fades in).
- `.is-current` when the selection is that incident; `.is-past` (quiet
  check glyph before the code) when the clock is past it, so the presenter
  sees where they are in the demo.
- E4 is a trend at hospital level. If the hospital-level trend signal does
  not exist when the strip ships, the tile stays but says "trend, hospital
  level, 12 months" and jumps the clock with the window set to 12 months;
  it does not pretend to select an incident (plan open question 3).
- The strip label is a visible word, "Events" / "Tapahtumat", at 12/600
  `--ink-3`, not an eyebrow over a heading: it names a control group.

| Tile | EN name · what the tool shows | FI name · what the tool shows |
|---|---|---|
| E1 URO | ESBL E. coli cluster · 5 a week against 0.2 usual | ESBL E. coli -klusteri · 5 viikossa, tavallisesti 0,2 |
| E3 PHC-S | No samples for a week · 0 cultures, usual 52; a data problem | Viikko ilman näytteitä · 0 viljelyä, tavallisesti 52; dataongelma |
| E2 ICU | First MRSA, then 13 in a month · sentinel, then cluster | Ensimmäinen MRSA, sitten 13 kuukaudessa · vartija, sitten klusteri |
| E4 Hospital | TMP and TZP resistance rising · 15 % → 20 % over three years | TMP- ja TZP-resistenssi nousee · 15 % → 20 % kolmessa vuodessa |

Dates on the tiles are the first alert dates the detectors actually raise
(the parent reads them from the alerts); the mock uses the as-of dates from
`benchmarks/planted-events/README.md` as placeholders.

## 5. Timeline header, controls, legend, map caption

### 5.1 Title: whose timeline

`Tyks · 9 units` in the display face at 15/600, left of the date, from the
server's `Meta`. When a unit is focused the title reads `Tyks · Urology`
with the unit in the accent and an × to clear. `Meta` today has no hospital
name field (`libs/utils/contract/src/index.ts`); the parent adds one. Until
then the title falls back to "Tyks" from the deployment name. **This is a
question for Artem** (section 9).

| | EN | FI |
|---|---|---|
| tlTitle | {hospital} · {n} units | {hospital} · {n} yksikköä |
| tlTitleUnit | {hospital} · {unit} | {hospital} · {unit} |
| tlClearUnit | Show all units | Näytä kaikki yksiköt |

### 5.2 Step and speed, two visible controls

```
Step   [ day ][ week ][ month ]      Speed  [ slow ][ normal ][ fast ]
```

Two `.tl-ctl-group`s, each a 12/600 `--ink-3` label and a `.seg` segmented
control (the existing `.seg` with `aria-pressed`). The hover title on the
speed group says it in words: "normal: one day every two seconds" / "normaali:
yksi päivä kahdessa sekunnissa". Play, skip-to-start and skip-to-end stay as
icon buttons left of the groups.

| | EN | FI |
|---|---|---|
| tlStep | Step | Askel |
| tlStepDay / Week / Month | day · week · month | päivä · viikko · kuukausi |
| tlSpeed | Speed | Nopeus |
| tlSpeedSlow / Normal / Fast | slow · normal · fast | hidas · normaali · nopea |
| tlSpeedHint | {speed}: one {step} every {s} seconds | {speed}: yksi {step} joka {s}. sekunti |

### 5.3 Lane legend, in words

Under the lane labels, one line at 12 px `--ink-3`, left-aligned with the
lanes: "Lanes: each unit's resistant finds a week. A pill is a signal; its
number is observed against usual, so 7 against 1.4 means seven patients
where 1.4 were expected." / "Kaistat: yksikön resistentit löydökset
viikossa. Merkki on signaali; sen luku on havaittu suhteessa tavalliseen,
eli 7 / 1,4 tarkoittaa seitsemää potilasta, kun 1,4 oli odotettavissa."

The phenotype legend above the stream stays as is; the pill legend key
`tlPillLegend` ("7/1.4 = observed/usual") moves here and is reworded as
above. Pill text itself changes from "ESBL 3/0.2" to "ESBL 3 · 0.2" with the
same two numbers, so the slash stops reading as a date or fraction.

### 5.4 Map caption

At the top of the map window, under its title, 12 px `--ink-2`, with an ⓘ:
"THL notified cases per county, {month}. Colour: cases per 100 000 a year.
Dots: county signals, filled when the signal survives correction." /
"THL:n ilmoitetut tapaukset hyvinvointialueittain, {month}. Väri: tapauksia
100 000:ta kohti vuodessa. Pisteet: alueen signaalit, täytetty, kun signaali
kestää korjauksen." The ⓘ opens the source line and the method anchor. The
bottom legend stays.

## 6. The glossary pattern

One i18n surface, `glossary`, with a short form, a long form and a one-line
meaning for: ESBL, MRSA, VRE, CPE, n, %S, %R, usual, surprise, first isolate,
day 3, TMP, TZP, and every unit code (PHC-N = Health centre North).

Markup: `<abbr class="gloss" title="…">ESBL</abbr>`, dotted underline in
`--ink-3`, never on the pill text inside SVG (there the `<title>` carries
it). On a card, the first use is spelled out in running text, after the
abbreviation, in parentheses: "ESBL (extended-spectrum beta-lactamase)".
Later uses on the same card are the abbr alone. On the feed rows and the
timeline nothing is spelled out; the tooltip does it.

Every ratio shows what it is a ratio of: "5 patients, 0.2 usual", "%R 20 of
100 isolates". The bare form "5/0.2" does not appear anywhere on a card.

| Term | EN long · meaning | FI long · meaning |
|---|---|---|
| ESBL | extended-spectrum beta-lactamase · E. coli and Klebsiella that break down penicillins and most cephalosporins | laajakirjoinen beetalaktamaasi · E. coli ja Klebsiella, jotka hajottavat penisilliinit ja useimmat kefalosporiinit |
| MRSA | methicillin-resistant S. aureus | metisilliinille resistentti S. aureus |
| VRE | vancomycin-resistant enterococcus | vankomysiinille resistentti enterokokki |
| CPE | carbapenemase-producing Enterobacterales · every case is an alert | karbapenemaasia tuottava enterobakteeri · jokainen löydös on hälytys |
| n | number of first isolates the figure rests on | ensimmäisten isolaattien määrä, johon luku perustuu |
| %S / %R | share susceptible / resistant, of n | herkkien / resistenttien osuus n:stä |
| usual | what this unit's own last year predicts for the same window | mitä yksikön oma edellinen vuosi ennustaa samalle ikkunalle |
| surprise | how unlikely the observed count is by chance; 2 is 1 in 100, 4.7 is 1 in 50 000 | kuinka epätodennäköinen havaittu määrä on sattumalta; 2 on 1 : 100, 4,7 on 1 : 50 000 |
| first isolate | one per patient, species and specimen type in a period | yksi potilasta, lajia ja näytetyyppiä kohti jaksossa |
| day 3 | sample taken on the third day of the stay or later: counted as hospital-acquired | näyte otettu kolmantena hoitopäivänä tai myöhemmin: lasketaan sairaalaperäiseksi |
| TMP / TZP | trimethoprim / piperacillin-tazobactam | trimetopriimi / piperasilliini-tatsobaktaami |
| PHC-N / PHC-S | Health centre North / South | Terveyskeskus Pohjoinen / Etelä |

## 7. The motion system

Three durations, one easing, in `styles.css`:

```
--mo-1: 120ms   immediate feedback: ring appears, row highlight, chip press
--mo-2: 200ms   routine state change: lift, dim, county fill, playhead tick
--mo-3: 320ms   composition change: card cross-fade, number tween, dock/resize
--mo-ease: cubic-bezier(0.16, 1, 0.3, 1)   (the existing --ease-out)
```

Under `prefers-reduced-motion: reduce` the three tokens are 0 ms, the
cross-fade becomes an instant swap that keeps the opacity step (so the
change is still noticed), the playhead jumps, nothing translates. The
existing global rule in `styles.css` already clamps every transition; the
tokens going to 0 lets scripts that read them (the number tween) obey too.

Exits are faster than entrances: a dim takes `--mo-1`, an un-dim `--mo-2`.

| Moment | Property | Duration | Where |
|---|---|---|---|
| Selection ring and lift | stroke-width, opacity, transform | 1 in, 2 out | `.hs-pill`, `.geo-glyph`, `.hnet-node`, `.tl-ev` |
| Dim and un-dim | opacity | 1 dim, 2 un-dim | every `.has-selection` / `.has-unit` container |
| Feed row | background, border-color, color | 1 | `.feed-row` |
| Card cross-fade | opacity + 4 px translateY on the body only | 3, out 1 | `.sig-body` with `.is-leaving` / `.is-entering` |
| Number tween | registered custom property `--sig-n` | 3 | `.sig-num` (counter-based; the real number stays in the DOM for assistive tech) |
| Playhead | transform (translateX) | 2, linear while playing | `.hs-playhead` |
| County fill on month change | fill, fill-opacity | 2 | `.geo-county` |
| Dock and resize | flex-basis, opacity | 3; off while dragging | `.ws-win`, `.ws-column` |
| Lane focus | opacity, font-weight step | 2 | `.hs-lane` |

The one authored moment is the event jump: the playhead glides to the day
(`--mo-2`), the pill rings and lifts (`--mo-1`), the card body enters
(`--mo-3`). Three durations in cascade, no stagger script needed: the
natural order of the state changes produces it.

Nothing else animates. No entrance choreography on page load, no pulsing
beyond the existing live dot.

## 8. Class names the parent toggles

Container state (the parent sets these on the panel root):

| Class | On | Means |
|---|---|---|
| `has-selection` | `.hs`, `.feed`, `.geo`, `.hnet`, `.ugrid`, `.tl-events` | an `inc=` exists: dim the non-kin |
| `has-unit` | `.hs`, `.hnet`, `.ugrid` | a `unit=` exists: dim the other lanes / nodes / columns |

Element state:

| Class | On | Means |
|---|---|---|
| `is-selected` | `.hs-pill`, `.geo-glyph`, `.geo-hosp`, `.tl-ev` | the selected incident (feed rows keep `aria-current="true"`) |
| `is-kin` | `.hs-pill`, `.feed-row`, `.hnet-node`, `.geo-glyph` | same incident elsewhere, or a unit it reaches |
| `is-focus` | `.hs-lane`, `.geo-county` | the focused unit's lane / the focused county |
| `is-current` | `.tl-ev` | the event tile whose incident is selected |
| `is-past` | `.tl-ev` | the clock is past this event |
| `is-leaving` / `is-entering` | `.sig-body` | card cross-fade phases (add entering, remove on `animationend`) |
| `is-playing` | `.hs` | linear playhead easing while the clock runs |
| `data-resizing="true"` | `.ws` | kills dock transitions during a splitter drag |

New structural classes (the parent adds the elements):

- Timeline: `.hs-lane` (lane `<g>`), `.hs-lane-hit` (44 px rect behind the
  label), `.hs-playhead` (the moving today line when it is positioned by
  transform), `.tl-title`, `.tl-title-unit`, `.tl-title-clear`,
  `.tl-ctl-group`, `.tl-ctl-label`, `.tl-legend`, `.tl-events`,
  `.tl-events-label`, `.tl-ev`, `.tl-ev-code`, `.tl-ev-when`, `.tl-ev-unit`,
  `.tl-ev-name`, `.tl-ev-what`.
- Card: `.sig`, `.sig-head`, `.sig-body`, `.sig-kind`, `.sig-title`,
  `.sig-where`, `.sig-bars`, `.sig-bar[data-tone="obs"|"usual"]`,
  `.sig-bar-label`, `.sig-bar-track`, `.sig-bar-value`, `.sig-surprise`,
  `.sig-num`, `.sig-surprise-label`, `.sig-how`, `.sig-how-head`,
  `.sig-how-text`, `.sig-reach`, `.sig-isolates`, `.sig-actions`,
  `.sig-primary`, `.sig-btn`, `.sig-empty`.
- Map: `.geo-caption`, `.geo-halo`.
- Glossary: `abbr.gloss`, `.gloss-tip`.

CSS lives in: `styles.css` (tokens, `.gloss`, `.sig-*`), `hero/WeeklyBand.css`
(pills, lanes, playhead), `timeline.css` (title, control groups, legend,
events strip), `research/SignalFeed.css`, `research/geo/geo.css`,
`research/HospitalNetwork.css`, `research/UnitGrid.css`,
`research/workspace/workspace.css`.

## 9. Questions for Artem

1. `Meta` has no hospital name or unit count. Add `site: { id, name, county }`
   to `Meta` (the registry of plan 3.8 would carry the same object), or read
   the name from an environment variable for now?
2. The "how we calculate it" sentences in 3.1 name 28 days and "the unit's
   own last year" as the baseline. Are those the live detector's constants
   (D-020, D-044), and is "1 in 50 000" the right way to say p?
3. The pill text change from "ESBL 3/0.2" to "ESBL 3 · 0.2": accept, or keep
   the slash and rely on the legend?
4. Should the events strip order be the demo order (E1, E3, E2, E4, by date)
   or the README order (E1, E2, E3, E4)? The design assumes by date.
