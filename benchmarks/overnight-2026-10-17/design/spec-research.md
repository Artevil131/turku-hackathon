# Spec: the researcher's board (`#research`)

Fable designer, 2026-10-17. Build-ready for four Sonnet builders in
parallel: one file pair per panel under `apps/web/src/components/research/`.
`Research.tsx` becomes a thin shell that lays the four out; the integrator
owns the shell.

## Patterns borrowed

- **PagerDuty incidents**: alerts grouped into incidents, one card each,
  newest first, a pinned band for the urgent kind, chip filters. Why: D-034
  already groups by `incident`; the researcher wants "what changed", not a log.
- **Grafana status history / GitHub contribution heatmap**: units × weeks,
  one quantity, grey for missing data. Why: clusters read as dark patches,
  the sampling gap as a grey row.
- **Datadog service map** for the network (nodes lit by alerts, edges by
  traffic) and **Our World in Data choropleth with a month slider** for the
  map. Why: familiar, flat, and carry a legend and an "as of" by habit.

## One board, not four tabs

At ≥ 1100 px: two columns. The **signal feed** (5/12, sticky, scrolls
within) is always visible; the right column (7/12) holds a segmented
control **Grid / Network / Map** showing one panel. Linked: selecting an
incident highlights its unit in the open panel and sets the grid's
phenotype; clicking a unit in any panel filters the feed. At < 1100 px:
four tabs, Feed first; the feed stays mounted so expansion state survives.

The shared timeline (item 0) stays in the top bar. Every panel header
repeats `asOf` from its own response and its window; a clock move refetches
all four.

**Above the fold, 1280**: feed filter chips, pinned sentinel band, two or
three incident cards; right: the grid with 12 weeks visible.
**Above the fold, 390**: collapsed timeline, tabs, filter chips row
(horizontal scroll), pinned band, the first incident card fully.

URL state: `#research?panel=grid&unit=URO&kind=cluster&ph=esbl&inc=<id>`.

## SignalFeed

`research/SignalFeed.tsx` + `SignalFeed.css`. Data: `client.alerts({from:
asOf − 365 d})` (about 20 alerts a year; one call). Group by `alert.incident`
(fallback `id`); incident date = newest member `date`; sort newest first.

**Kind mapping** (ENGINE 3.6), text label with glyph: `cpe`,
`new-in-unit` → sentinel; `profile-excess`, `phenotype-excess` → cluster;
`rising-trend` → trend; `sampling-drop`, `empty-run` → data problem;
divergence chip disabled (`noDetectorYet`); `carrier` never pushed.

**Pinned band** "Sentinels": sentinel incidents of the last 180 days
(D-021 look-back), always on top, collapsible.

**Filters** (multi-select chips with counts): unit (`alert.ward`, null =
whole hospital), kind, phenotype (`alert.phenotype`; cpe alerts count as
`cpe`). State in the URL.

**Incident card** (`<article>`; header is a `<button aria-expanded>`):

| Field | Source |
|---|---|
| Kind label + glyph | mapping above |
| Title | templates: sentinel `alertCpe`/`alertNewInUnit` (existing keys); cluster "{phenotype or organism} in {unit}: {observed} in 28 d, usual {expected}"; trend "{antibiotic} resistance rising, {organism}: {observed}"; data "{unit}: {observed} samples, usual {expected}" |
| Unit | `ward` via `wardName`, or "whole hospital" |
| Date | newest member `date`; "first {firstDate}" when the incident has > 1 alert |
| Counts and baseline | `observed`, `expected` (1 decimal), `p` as "p < 0.001" / "p = 0.0007" (3 significant); new-in-unit: "none since {previous}" or "none before in the data"; cpe: "1 isolate, {organism}, {specimen}" |
| Severity | **not in API**: no severity word. The card shows the kind and the counts; gap R1 |
| Members | "{n} alerts" with the member list inside the expansion |
| Explanation | existing `AlertExplanation` per member (template, AI opt-in) |
| Suggested first step | **not in API**: a per-kind template line labelled "standard first step (template)": sentinel "isolation and contact screening per hospital guideline"; cluster "review the isolates and shared patients"; trend "review the unit's empirical guideline"; data "check the lab feed for the unit". Gap R2 |

**U2 = 1 click**: the expansion (the one click) contains the isolates
table, fetched on open: `client.isolates({ward, from: date − 28 d, to:
date, organism?})`, then client-side keep records whose `phenotypes`
include `alert.phenotype` (or `cpe`), or whose `results` match
`alert.profile` (13 WHONET codes in `ANTIBIOTICS` order, "." = untested),
or whose `isolateId === alert.isolateId`. Columns: sample date, patient id,
organism, specimen, stay day (`sampleDate − admissionDate + 1`, "outpatient"
when null), phenotypes, S/R results as letters. Data-problem incidents show
"no isolates: {observed} samples against {expected}" instead. Buttons:
"Open in doctor's list" (`#doctor?unit=&site=`), "Show in grid" (sets
panel grid, phenotype, highlights unit), "Mark seen" (existing
`acknowledge`).

States: three skeleton cards; `feedEmpty`; `feedError` + retry; isolate
sub-states inside the card.

## UnitGrid

`research/UnitGrid.tsx` + `UnitGrid.css`. Nine units across (columns in
`WARDS` order), ISO weeks down, newest week at the top, default 12 weeks
(control: 12 / 26 / 52). One phenotype selected (chips, default from the
feed selection, else `esbl`).

Data: `client.isolates({from: monday(asOf − weeks·7 d)})` once per window;
cell value = count of records with `ward`, week, and `phenotypes` including
the selected one. **The API has no weekly expected count**, so the shade
is the count, not surprise, and the header says so (`gridTitle`). Shade:
`color-mix(--live, white)` in 5 quantile steps over visible cells, 0 =
white; the number prints in the cell at ≥ 760 px and is always in
`aria-label` (`gridCell`). Grey hatched cell: the week containing a
`sampling-drop` or `empty-run` alert for that unit. Ring outline: week and
unit of a cluster incident. Row label: week start; column header: ward
code, full name in `title`. Totals row and column. Click a cell → feed
filtered to that unit and phenotype.

States: hatched skeleton; `gridEmpty`; error + retry; 26/52 weeks show
`gridSlow` while fetching.

## HospitalNetwork

`research/HospitalNetwork.tsx` + `HospitalNetwork.css`. Reuse `POS`,
`curve`, `tubeWidth`, `W`, `H` by import from `Network.tsx` (read-only).

Data: `client.relations({days: 28})` → `flows[]`, `links[]`; the feed's
alerts (last 28 days).

| Element | Source |
|---|---|
| Nodes | `WARDS`; label code + name; `aria-label` with everything below |
| Edges | `flows[]` undirected via `undirectedFlows`; width `tubeWidth(patients, max)`; `title` "{a}↔{b}: {patients} patients, {from}–{to}" |
| Lit node | any non-data alert in the unit in 28 days; badge text "{kind} · {phenotype or organism}", count when > 1 |
| Downstream shading | **no exposure in API**: for each lit unit, `nextUnits(flows, unit, 4)` shaded by `share` with label "{share} % of {lit unit}'s patients go here"; header says "share of patient flow, not exposure"; gap R3 |
| Trail layer | `links[]` as dashed arrows `from → to` with "{phenotype}: {patients} patients, {confirmed} confirmed"; toggle chip |
| Focus card | on hover/focus: the unit's flows in and out, its alerts (titles), button "Filter the feed" |

States: nodes only while loading; `noFlows`; error + retry; no pulses
under `prefers-reduced-motion`.

## RegionalMap

`research/RegionalMap.tsx` + `RegionalMap.css`. Port `pathOf` and the
projection constants (`LON0 19.0, LON1 31.8, LAT0 59.6, LAT1 70.2`,
cos 65°) from `scripts/explore/finland.html`; Tyks at lon 22.27, lat 60.45.
Polygons: copy `data/external/statfi/counties.geojson` (111 kB, 23
features; `properties.nimi` matches `regions[]` exactly) to
`apps/web/public/counties.geojson`, fetched relative to the page (route
alternative: gap R6). Data: `client.regional({group})`; 404 → `mapNoFile`.

| Element | Source |
|---|---|
| Group select | `groups[]`, default "MRSA carriage" |
| Month | `months[]`; the selected month is the last one ≤ `asOf`; the timeline moves it. A local month slider scrubs within `months[]` without touching the clock |
| Fill (rate view) | `series[].incidencePer100k[m]` for the region, 5 quantile steps of `--resist` mix; null → white with "no rate" hatch; national total shown as a figure under the legend, never on the map |
| Fill (uncertainty view) | **no interval in API**: the second view shades by `cases[m]` against `settings.minCases`: below it hatched "too few to rate"; above it plain. Legend states this. Gap R4 |
| Signals | `signals[]` for month ≤ selected: glyph on the county, filled for `strong`, hollow otherwise, `title` "{cases} vs {expected} expected, p {p}"; a list under the map, strongest first |
| Tyks | dot + label "Tyks, Turku" |
| Focus panel | region, cases, rate, 12-month sum of `cases`, signal if any; counties are `<path tabindex=0>` with `aria-label` |
| Footer | `source`, `fetchedOn` |

States: outline map while loading; `mapNoMonths`; error + retry; 404.

## Keyboard and focus

Tab order: timeline → feed filters → pinned band → incident cards (header
button, then its buttons when open) → segmented control → panel. Grid:
roving tabindex, arrows move, Enter filters the feed. Network: Tab across
nodes in `WARDS` order. Map: Tab across counties north to south, Enter
opens the focus panel. Escape closes an expansion and returns focus to its
header. Visible focus from `--live`.

## i18n keys (add to `en.ts` and `fi.ts`)

| key | en | fi |
|---|---|---|
| feedTitle | Signals | Signaalit |
| feedWindow | {n} signals in 365 days to {date} | {n} signaalia 365 päivässä {date} asti |
| panelGrid | Grid | Ruudukko |
| panelNetwork | Network | Verkosto |
| panelMap | Map | Kartta |
| kindSentinel | sentinel | vartija |
| kindCluster | cluster | rypäs |
| kindTrend | trend | trendi |
| kindDivergence | divergence | poikkeama |
| kindData | data problem | aineisto-ongelma |
| noDetectorYet | no detector yet | ei vielä ilmaisinta |
| pinnedSentinels | Sentinels, last 180 days | Vartijat, viimeiset 180 päivää |
| filterKind | Kind | Laji |
| incidentAlerts | {n} alerts | {n} hälytystä |
| firstSeen | first {date} | ensin {date} |
| clusterTitle | {what} in {unit}: {observed} in 28 d, usual {expected} | {what} yksikössä {unit}: {observed} 28 pv:ssä, tavallisesti {expected} |
| trendTitle | {antibiotic} resistance rising, {organism}: {observed} | {antibiotic}-resistenssi nousee, {organism}: {observed} |
| dataTitle | {unit}: {observed} samples, usual {expected} | {unit}: {observed} näytettä, tavallisesti {expected} |
| noneSince | none since {date} | ei yhtään {date} jälkeen |
| noneBefore | none before in the data | ei aiempia aineistossa |
| pValue | p {p} | p {p} |
| firstStepLabel | standard first step (template) | tavallinen ensiaskel (malli) |
| firstStepSentinel | isolation and contact screening per hospital guideline | eristys ja kontaktien seulonta sairaalan ohjeen mukaan |
| firstStepCluster | review the isolates and shared patients | tarkista löydökset ja yhteiset potilaat |
| firstStepTrend | review the unit's empirical guideline | tarkista yksikön empiirinen hoito-ohje |
| firstStepData | check the lab feed for the unit | tarkista yksikön laboratoriosyöte |
| isolatesBehind | Isolates behind this signal | Signaalin taustalla olevat löydökset |
| noIsolatesData | no isolates: {observed} samples against {expected} | ei löydöksiä: {observed} näytettä, odotettu {expected} |
| showInGrid | Show in grid | Näytä ruudukossa |
| openInDoctor | Open in doctor's list | Avaa lääkärin listassa |
| feedEmpty | No signals match in the 365 days to {date}. | Yhtään signaalia ei vastaa rajauksia 365 päivässä {date} asti. |
| feedError | Signals could not be loaded. | Signaaleja ei voitu ladata. |
| gridTitle | {phenotype} isolates per week (count) | {phenotype}-löydökset viikoittain (lukumäärä) |
| gridWeeks | {n} weeks | {n} viikkoa |
| gridCell | {unit}, week of {date}: {n} | {unit}, viikko {date}: {n} |
| gridQualityWeek | data-quality week | aineisto-ongelmaviikko |
| gridClusterWeek | cluster signal | rypässignaali |
| gridEmpty | no {phenotype} isolates in {n} weeks | ei {phenotype}-löydöksiä {n} viikossa |
| gridSlow | loading {n} weeks of isolates, may take a moment | ladataan {n} viikon löydökset, voi kestää hetken |
| networkTitle28 | Patient flow, {from}–{to} | Potilasvirta {from}–{to} |
| flowShareNote | share of patient flow, not exposure | osuus potilasvirrasta, ei altistuma |
| goesHere | {share} % of {unit}'s patients go here | {share} % yksikön {unit} potilaista siirtyy tänne |
| trailLayer | Phenotype trail | Fenotyyppijälki |
| trailEdge | {phenotype}: {patients} patients, {confirmed} confirmed | {phenotype}: {patients} potilasta, {confirmed} vahvistettu |
| filterFeed | Filter the feed | Rajaa syöte |
| noFlows | no transfers in the window | ei siirtoja jaksolla |
| mapTitle | Notified cases by county | Ilmoitetut tapaukset hyvinvointialueittain |
| mapGroup | Series | Sarja |
| mapMonth | Month | Kuukausi |
| viewRate | rate per 100,000 | tapauksia / 100 000 |
| viewCertainty | count certainty | lukumäärän varmuus |
| tooFewToRate | fewer than {n} cases, too few to rate | alle {n} tapausta, liian vähän arvioitavaksi |
| noRate | no rate from THL | ei THL:n ilmaantuvuutta |
| nationalTotal | Finland: {n} cases | Suomi: {n} tapausta |
| signalStrong | signal, survives correction | signaali, kestää korjauksen |
| signalWeak | signal, may be chance | signaali, voi olla sattumaa |
| signalDetail | {cases} vs {expected} expected, p {p} | {cases}, odotettu {expected}, p {p} |
| tyks | Tyks, Turku | Tyks, Turku |
| twelveMonths | {n} cases in 12 months | {n} tapausta 12 kuukaudessa |
| mapNoFile | Regional file not loaded on this server. | Alueellista tiedostoa ei ole ladattu palvelimelle. |
| mapNoMonths | No complete months before {date}. | Ei kokonaisia kuukausia ennen {date}. |
| fetchedOn | fetched {date}; THL revises recent months | haettu {date}; THL tarkistaa tuoreimmat kuukaudet |
| panelLoading | Loading… | Ladataan… |
| panelError | Could not be loaded. | Ei voitu ladata. |

## Contract gaps

| # | Need | Minimal additive change |
|---|---|---|
| R1 | severity of a signal | `Alert.severity?: "high" \| "medium" \| "low"` set by the alerts gear |
| R2 | suggested first step | `Alert.firstStep?: "isolate" \| "review" \| "guideline" \| "feed"` (client words it) |
| R3 | exposure per unit for downstream shading | `RelationsResponse.exposure?: {ward, phenotype, score}[]` (ENGINE 4) |
| R4 | uncertainty on the county rate | `RegionalSeries.interval?: ([number, number] \| null)[]` |
| R5 | weekly observed and expected per unit for the grid | `GET /api/weekly?phenotype&weeks` → `{asOf, weeks: IsoDate[], cells: {ward, week, observed, expected?, quality: boolean}[]}`; until then the grid is counts |
| R6 | county polygons from the API instead of a static copy | `GET /api/regional/counties` serving the GeoJSON |
