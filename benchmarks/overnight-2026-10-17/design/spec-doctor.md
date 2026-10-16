# Spec: the doctor's list (`#doctor`)

Fable designer, 2026-10-17. Build-ready for one Sonnet pass. Replaces the
left-form / ranked-cards / spread-rail layout of `Treat.tsx` with a record
strip over a full-width list, fed by `GET /api/coverage` only.

## Patterns borrowed

- **Epic storyboard (patient header)**: the inputs are a row of prefilled
  chips reading like a record ("Urology · urine · F · 70 · community onset"),
  not a form. Tap a chip to change it. Why: the doctor types nothing
  (AUDIENCE.md 1); the common case is two taps.
- **Google Flights "Best / Other" divider**: a visible line separates rows
  that clear the bar from those that do not, and every row below the line
  carries a one-line "moved down because". Why: the ranking must explain
  itself, never prescribe.
- **Local antibiogram apps (Stanford, UCSF)**: each row is antibiotic,
  % susceptible, n. We add the interval bar and the level. Why: clinicians
  already read this row shape.

## Layout and the fold

Two regions, stacked: `RecordStrip` then `CoverageList`; on ≥ 1100 px a
third, `UnitContext`, sits right of the list (list 8/12, context 4/12).
The shared timeline (item 0) stays in the top bar; the list header repeats
`asOf`.

- **1280 px above the fold**: top bar + timeline; record strip (one line);
  list title "What covers here" with `asOf`, level and n; the bar
  threshold legend; the first four rows and the divider line. Context rail:
  likely organisms and the unit's active signals.
- **390 px above the fold**: collapsed timeline (date + play); record strip
  as two wrapping rows of chips; list title with level/n; the first three
  rows. Context rail moves below the list behind a `<details>` "In this
  unit".

U1: app open → "Doctor" (1) → site chip (2) → severity chip (3). Unit is
remembered (`aei.unit`); urine and mild are defaults, so the common case is
two taps including navigation.

## RecordStrip (inputs)

File `apps/web/src/components/doctor/RecordStrip.tsx` + `RecordStrip.css`.
Chips in order; each is a `<button aria-haspopup="listbox">` opening a
small popover (`role="listbox"`), except toggles which flip on tap.

| Chip | Options | API |
|---|---|---|
| Unit | the 9 wards, grouped hospital / primary care | `?ward=` |
| Site | urine / blood / wound | `?specimen=` |
| Sex | F / M / any | `?sex=`; if `coverage.sexApplied === false` while sex set, chip shows tag "dropped, keeping unit data" |
| Severity | mild (80 % bar) / severe (90 % bar) | `?severity=`; default mild |
| Onset | community / in hospital, day 3+ | **no API field**: switching to hospital sets severity to severe with the note "90 % bar because onset in hospital" (ENGINE 2.6 candidate τ; pending team confirmation). Chip tagged "sets the bar only" |
| Age | number entry | **no API field**: displayed with tag "not a filter yet"; never alters the list |
| Suspected organism | the 9, or none | **no API field**: presentation only, see row flags; never re-ranks |

Severe with blood site is suggested by a hint under the chip, not applied.

## CoverageList

File `apps/web/src/components/doctor/CoverageList.tsx` + `CoverageList.css`.
Data: `client.coverage({ward, specimen, sex?, severity})` → `CoverageResponse`.

**Header**: title; `asOf`; "{isolates} first isolates, {level}, since
{from}" from `coverage.isolates`, `coverage.level`, `coverage.from`;
bar legend "bar = {80|90} %" from `THRESHOLDS[severity]`.

**Rows** = `suggestions[]` in API order (already clears → borderline →
below → not assessable, Access before Watch). Divider `<li role="separator">`
"Below the {bar} bar" placed before the first non-`clears` row. Each row is
one `<li>` with a `<button aria-expanded>`:

| Cell | Source |
|---|---|
| Antibiotic name, tier | `antibiotic` via `antibioticName`; `aware` ("Access"/"Watch") as text chip |
| Covers % | `share` × 100, rounded; "–" when null |
| Interval bar | `interval[0..1]` drawn as a thick band on a 0–100 track; threshold as a vertical tick labelled with the bar value; point marker at `share`. The band, not the point, is the main glyph |
| n | `coverage.spectrum.counts.known` (mild) or `coverage.counts.known` (severe), "{covered} of {known} covered" in the expanded view |
| Level | `coverage.level` (one per query): "own unit" / "similar units" / "whole hospital" as text |
| Certainty badge | derived only from level and n, rule below |
| Last 28 days | `coverage.recent.covered` / `coverage.recent.known` as "last 28 d: 43 of 45", context only |
| Newest result | **not in API**: show `asOf` with label "results to"; gap G1 |
| Standing text | `standing`: "clears the bar" / "estimate clears, interval does not" / "below the bar" / "not assessable" |
| Reason line | template, see below |
| All-organism share | when `basis === "spectrum"`: "over all organisms {allOrganisms.share}% ({allOrganisms.interval})" small line |

**Certainty rule** (write in code as `certaintyOf(level, n)`):
`firm` = level unit and n ≥ 100; `fair` = level unit and 30 ≤ n < 100, or
level ward type and n ≥ 100; `thin` = everything else. Badge text is the
word plus "n {n}, {level}"; never colour alone.

**Reason line templates** (i18n keys below, all numbers from the row):
- clears: "clears the {bar} % bar on {n} {specimen} isolates, {level}, since {from}; {tier} tier"
- borderline: "moved down because the interval {lo}–{hi} does not clear {bar} %"
- below: "moved down because {share} % is below the {bar} % bar"
- not assessable, untested: "moved down because {untestedPct} % of isolates have no result for it" (sum of `coverage.untested[].share`)
- not assessable, few: "moved down because fewer than 30 isolates have a result"
- Watch after Access within clears: append "; after Access tier (WHO AWaRe)"

**Flags** (text chips with glyph, in the row):
- "Not for {organism}" when the suspected organism is in `coverage.notCovering[]` or `coverage.outsideSpectrum[]`; "untested on {organism}" when in `coverage.untested[]`. Without a suspected organism, the expanded view lists `notCovering` and `outsideSpectrum` with their pool shares.
- "Signal in this unit: {label}, {date}" when an alert from `/api/alerts?from=asOf−28d` has `ward === unit` (or ward in `previousUnits(flows, unit, 3)` → "in a feeding unit"); shown on the row only when `alert.antibiotic === row.antibiotic`, otherwise once in the list header.
- Prior resistant finding for this patient: **omitted** (no patient id, no API); gap G3.

**Expanded row**: covered/known, per-organism pools (`coverage.organisms[]`
share × row `notCovering`/`untested`), the all-organism line, the 28-day
line, and `Explain` is not used here (coverage has no explain id).

**Two together** (`combinationSuggestions[]`, severe only, appears only when
non-empty): after the divider, group "Two together, because no single
antibiotic clears": `antibiotics` joined with " + ", `coverage.share`,
`coverage.interval`, `coverage.counts`, `gain` as "+{gain} points over the
better alone", `access` count as text.

**Footer**: "Supports the decision; the doctor decides. Rules: D-023,
D-027, D-033." plus "Example data" chip only if any slot is an example
(none today).

## UnitContext

File `apps/web/src/components/doctor/UnitContext.tsx` + `UnitContext.css`.
- Likely organisms: `coverage.organisms[]` as name, `isolates`, `share` bar; tapping sets the suspected-organism chip (presentation only).
- Active signals in this unit: alerts (as above) with `AlertExplanation` from the shared component; button "Open in research" → `#research?unit=`.
- Last 28 days total: sum of `antibiotics[0].recent.known` is wrong; use `records` from `useLive` filtered by ward and specimen for "{n} isolates in 28 d".

## States (every panel)

- Loading: skeleton rows (4), header "Loading coverage for {unit}…", `aria-busy`.
- Empty: `suggestions.length === 0` → "No antibiotic assessable for {site} here on {asOf}: fewer than 30 results at any level."
- Error: `ApiError` → "Coverage could not be loaded." + Retry; offline banner already global.
- Sex dropped: inline note under the strip (`sexApplied === false`).

## Keyboard and focus

Tab order: timeline → record chips left to right → list rows (each row
one tab stop; Enter/Space expands) → combinations → context rail. Popover:
arrow keys move, Enter selects, Escape closes and returns focus to the
chip. The divider is not focusable. Skip link "to the list" first in the
page. Visible focus ring from `--live`.

## Print (`@media print` in `CoverageList.css`)

One page: record strip as a line of text, header with `asOf`, level and n,
every row as a table row (name, tier, covers %, interval text "lo–hi", n,
level, certainty, standing, reason), the divider as a bold row, flags as
text. Hide timeline, popovers, context rail, bars (print interval as
text), buttons. Footer with the rules and "printed from the replay as of
{asOf}".

## i18n keys (add to `en.ts` and `fi.ts`)

| key | en | fi |
|---|---|---|
| doctorTitle | What covers here | Mikä kattaa täällä |
| recordStrip | Patient record | Potilastiedot |
| chipUnit | Unit | Yksikkö |
| chipSite | Site | Näyte |
| chipSex | Sex | Sukupuoli |
| chipSexAny | any | kaikki |
| chipSeverity | Severity | Vaikeusaste |
| severityMild | mild, 80 % bar | lievä, raja 80 % |
| severitySevere | severe, 90 % bar | vaikea, raja 90 % |
| chipOnset | Onset | Alku |
| onsetCommunity | community | avohoito |
| onsetHospital | in hospital, day 3+ | sairaalassa, 3. hoitopäivä tai myöhemmin |
| onsetSetsBar | sets the bar only | vaikuttaa vain rajaan |
| chipAge | Age | Ikä |
| notAFilterYet | not a filter yet | ei vielä rajaus |
| chipOrganism | Suspected organism | Epäilty mikrobi |
| organismNone | not known yet | ei vielä tiedossa |
| poolLine | {n} first isolates, {level}, since {from} | {n} ensilöydöstä, {level}, alkaen {from} |
| levelUnit | own unit | oma yksikkö |
| levelWardType | similar units | vastaavat yksiköt |
| levelHospital | whole hospital | koko sairaala |
| barLegend | bar = {bar} % | raja = {bar} % |
| coversHead | Covers | Kattaa |
| intervalHead | 95 % interval | 95 %:n väli |
| certaintyFirm | firm | vankka |
| certaintyFair | fair | kohtalainen |
| certaintyThin | thin | ohut |
| certaintyN | n {n}, {level} | n {n}, {level} |
| recentLine | last 28 d: {covered} of {known} | viim. 28 pv: {covered}/{known} |
| resultsTo | results to {date} | tulokset {date} asti |
| standingClears | clears the bar | ylittää rajan |
| standingBorderline | estimate clears, interval does not | arvio ylittää, väli ei |
| standingBelow | below the bar | rajan alle |
| standingNA | not assessable | ei arvioitavissa |
| belowDivider | Below the {bar} % bar | Rajan {bar} % alle |
| reasonClears | clears the {bar} % bar on {n} {specimen} isolates, {level}, since {from}; {tier} tier | ylittää rajan {bar} % {n} {specimen}löydöksellä, {level}, alkaen {from}; {tier}-luokka |
| reasonBorderline | moved down because the interval {lo}–{hi} does not clear {bar} % | siirretty alemmas, koska väli {lo}–{hi} ei ylitä {bar} % |
| reasonBelow | moved down because {share} % is below the {bar} % bar | siirretty alemmas, koska {share} % jää rajan {bar} % alle |
| reasonUntested | moved down because {pct} % of isolates have no result for it | siirretty alemmas, koska {pct} %:lla löydöksistä ei ole tulosta |
| reasonFew | moved down because fewer than 30 isolates have a result | siirretty alemmas, koska alle 30 löydöksellä on tulos |
| afterAccess | after Access tier (WHO AWaRe) | Access-luokan jälkeen (WHO AWaRe) |
| allOrganismsLine | over all organisms {share} % ({lo}–{hi}) | kaikki mikrobit {share} % ({lo}–{hi}) |
| notFor | not for {organism} | ei {organism}-löydöksiin |
| untestedOn | untested on {organism} | ei testattu: {organism} |
| signalHere | signal in this unit: {label}, {date} | signaali tässä yksikössä: {label}, {date} |
| signalFeeder | signal in a feeding unit: {unit}, {label}, {date} | signaali lähettävässä yksikössä: {unit}, {label}, {date} |
| twoTogether | Two together, because no single antibiotic clears | Kaksi yhdessä, koska yksikään ei yksin ylitä rajaa |
| gainLine | +{gain} points over the better alone | +{gain} pistettä parempaan yksin verrattuna |
| sexDropped | sex filter dropped to keep the unit's own data | sukupuolirajaus pudotettu, jotta yksikön oma aineisto säilyy |
| likelyOrganisms | Likely organisms | Todennäköiset mikrobit |
| inThisUnit | In this unit | Tässä yksikössä |
| coverageLoading | Loading coverage for {unit}… | Ladataan kattavuutta: {unit}… |
| coverageEmpty | No antibiotic assessable for {site} here on {date}: fewer than 30 results at any level. | Yhtään antibioottia ei voi arvioida ({site}) {date}: alle 30 tulosta kaikilla tasoilla. |
| coverageError | Coverage could not be loaded. | Kattavuutta ei voitu ladata. |
| doctorFoot | Supports the decision; the doctor decides. Rules D-023, D-027, D-033. | Tukee päätöstä; lääkäri päättää. Säännöt D-023, D-027, D-033. |
| printedAsOf | printed from the replay as of {date} | tulostettu toistosta, tilanne {date} |
| skipToList | Skip to the list | Siirry listaan |

## Contract gaps

| # | Need | Minimal additive change |
|---|---|---|
| G1 | newest result date per antibiotic | `AntibioticCoverage.newest?: IsoDate` |
| G2 | onset and age as filters | `CoverageQuery.onset?: "community" \| "hospital"`, `ageMin?/ageMax?` (same as `IsolateQuery`) |
| G3 | prior resistant finding for this patient | `CoverageQuery.patientId?` → `CoverageResponse.priorFindings?: {phenotype, date, ward}[]` |
| G4 | suspected organism as a filter (today presentation only) | `CoverageQuery.organism?: Organism` restricting the pool, with `isolates` reported for it |
| G5 | the threshold the onset chip implies | team confirmation that hospital onset uses the 90 % bar (ENGINE 2.6), to be recorded in DECISIONS.md |
