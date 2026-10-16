# Design night, 2026-10-17: morning report

Status: **interim, refreshed 02:11; the run stopped here on a usage limit**. Refreshed every three hours and
finished between 08:30 and 09:00 (Artem's addendum of 01:15). Everything
below is what holds at the time written; the log
(`design-log.md`) has the minute-by-minute record.

Branch `overnight/design`, worktree `/Users/artevil/turku-hackathon-design`.
API on port 8788 and web on 5174 for the night, because another session
held 8787 and 5173. Screenshots are from the running app with headless
Chrome (`design/shoot.sh`), in `design/`.

## 1. What changed, by surface

| Surface | What changed | Before (phone, laptop) | After (phone, laptop) | Serves |
|---|---|---|---|---|
| Replay timeline (every view) | Was a date and two buttons in the top bar. Now a second bar on every view: replay label, play/pause, ±day, ±week, scrub track (seeks on release), four speeds, the three event dates as markers and a menu, keyboard shortcuts; on a phone a strip with the date and play that opens a full sheet | `home-before-phone.png`, `home-before-laptop.png` | pending the after shots | PRODUCT principle 4 (every view is current); U7 |
| Researcher's board | Shell only so far: feed left, Grid / Network / Map right, tabs under 1100 px, state in the URL | `research-before-*.png` | pending wave 1 | Principles 2 and 3; U2 |
| Doctor's list | In progress (wave 1) | `doctor-before-*.png` | pending | Usability criterion; U1 |
| App shell | API origin from `VITE_AEI_API_URL`; branding slot tokens; doctor grid bug at 981–1279 px fixed | | | Deployment shape (OBJECTIVES) |

## 2. The doctor's list and the researcher's board as they stand

Doctor (`#doctor`): opens on the remembered unit with defaults (urine,
any sex, mild 80 % bar, last year); one-click filters for specimen, sex,
age group, day 3+, severity and period (age group and day 3+ are shown
"not applied yet": the API has no such filter). Each row: covers %,
95 % interval band against the bar, n, the level the data came from,
result as glyph and word, and a "moved down because" line; likely
organisms beside the list; prints as one A4 page. Researcher (`#research`):
signal feed (incidents, pinned sentinels, one click to the isolates
behind an alert) beside a unit grid, hospital network and THL county map.
Judge walk-through: home → Doctor (list in 1 click) → F, 65+, severe (4
clicks) → Research → open the MED-A ESBL cluster (isolates in 1 click) →
Map → scrub the timeline to 10 Feb 2026 (ICU MRSA).

## 3. U metrics, before and after

From `design/u-metrics.md`. Before (clean build of ec23f01):

| Metric | Before | After |
|---|---|---|
| U1 clicks to the doctor's list, named context | not reachable | 4 clicks, about 8–10 s, laptop and phone (wave 2 review) |
| U2 clicks from the feed to an alert's isolates | not reachable | 1, no scroll at 1280×860 |
| U3 count and as-of on every number | no | yes on doctor, feed, grid, map, settings; badge fixed after wave 2; organisms rail and signals block lack as-of (states audit) |
| U4 Lighthouse accessibility home / doctor / research; contrast | 100 / 96 / 100; doctor fails one contrast item | 100 / 100 / 100; contrast passes |
| U5 missing i18n keys | 0 | 0 |
| U6 LCP, 4G phone, production build | 3.6 s on all three | 3.3 / 3.9 / 6.9 s; noisy (CPU shared), recorded only; home FCP 2.3 → 1.4 s |
| U7 timeline features | 2 of 5 | 5 of 5 |

## 4. Design decisions and alternatives rejected

- Timeline as a video-player transport with chart event flags (YouTube, TradingView) and a Grafana-style as-of readout; rejected a date picker, because scrubbing and jumping to the three events is the demo.
- Doctor's list as a patient-header strip of one-click filters over a full-width list (Epic storyboard, Google Flights "best / other" divider, local antibiogram apps); rejected the form-left layout, because the doctor types nothing (AUDIENCE.md 1).
- Researcher's board as one page with the feed always visible (PagerDuty incidents) beside one of grid, network or map (Grafana status history, Datadog service map, Our World in Data choropleth); rejected four equal tabs, because signals come first (principle 2).
- Certainty badge as a lookup on the level reached (own unit, similar units, hospital), not on n cut-offs the team has not chosen.

## 5. Accessibility and bilingual results

Pending measurement after wave 1.

## 6. Contract proposals

Collected here, not in DECISIONS.md (addendum point 4). D-040 stays.

| Proposal | View that needs it | State |
|---|---|---|
| `GET /api/counties`, county polygons (D-040) | Regional map | built, pending Artem |
| `CoverageQuery.ageGroup` and `onset` (day 3 or later) | Doctor's list: the age group and inpatient filters are shown but not applied | proposed; needs the team's rule for which filter is dropped first when the pool is thin (D-033 does this for sex) |
| `AntibioticCoverage.newest` (date of the newest result) | Doctor's list row | proposed |
| `CoverageQuery.patientId` → prior resistant findings | Doctor's list flag | proposed; privacy question |
| `Alert.severity` | Signal feed | proposed |
| `Alert.firstStep` | Signal feed (today a per-kind template, labelled) | proposed |
| `RelationsResponse.exposure` (ENGINE 4) | Hospital network: downstream shading (today flow share, labelled "not exposure") | proposed |
| `RegionalSeries.interval` | Regional map uncertainty view (today a count-based view) | proposed |
| `GET /api/weekly` observed and expected per unit-week | Unit grid shade by surprise (today a count) | proposed |

Blocked on decisions: the 90 % bar for hospital onset (ENGINE 2.6, τ per
syndrome); certainty cut-offs on n.

## 7. Where branding attaches

`apps/web/src/styles.css`, the first `:root` block: `--brand-accent`,
`--brand-accent-soft`, `--brand-accent-ink`, `--brand-font-ui`,
`--brand-font-data`, `--brand-radius`. Everything else is neutral or a
reserved status colour. The mark in the top bar is the logo slot. Copy
voice is plain and clinical; no brand voice was written.

## 8. With another night

Fix the states audit's list (review-states.md): loading/empty/error and
as-of on the organisms rail and signals block, clinical offline copy,
recovery in live.ts, stale-while-updating on grid/network/map, grid
weeks in the URL, a shorter tab order. Then the Ask field for research,
the Impeccable pass per surface and the two final Fable reviews, which
did not run before the usage limit.
