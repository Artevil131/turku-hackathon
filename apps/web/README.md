# AEI web app

AEI (Antibiotic Efficacy Indicator) shows a doctor, for patients like theirs on
their unit lately, how often each antibiotic worked, before the patient's own
culture result is back. From the same laboratory results, updated as each day's
results arrive, it also finds deviations (resistant clusters, surges, an
antibiotic working less often, a unit whose results stopped arriving, slow
trends) and brings them to infection control, stewardship and the laboratory.

AEI informs; the doctor decides. It never recommends a treatment for a patient.

## Screens and who each is for

| Screen | For | What it answers |
|---|---|---|
| **Treat** (`#treat`, the default) | The ward doctor, in seconds | "What has worked here lately?" Unit remembered, first infection site preset: the best match, how often it worked (with its count), the last 4 weeks next to the past 12 months and next to all units, then every other antibiotic. Optional one-tap narrowing by sex, age, where it was caught (inpatient units only) and, once the lab has named it, the bacterium. On a phone the answer is on the first screen; the optional details open in a sheet. This unit's active alerts appear as one line each, and an antibiotic with an active "working less often" alert here is marked "Falling here". |
| **Alerts** (`#alerts`) | Infection control, stewardship, the laboratory | What the engine found, most serious first, newest first. One outbreak is one card with a dated story (e.g. cluster → surge → ceftriaxone working less often). Each step says what happened, where, since when, how unusual (observed against what the unit's own history predicts), who should act, the cases (patient codes shortened), and how it was found. |
| **Report** (`#report`) | Stewardship, ward chiefs, researchers | The brief taken literally: last 4 weeks next to the past 12 months, per antibiotic, filtered by unit, infection site, bacterium, sex and age; or every unit side by side. Both download as CSV with the counting rules applied (Finnish: semicolons and decimal commas, so Excel opens it in columns). |
| **Timeline** (`#timeline`) | The presenter, and anyone asking "what happened when" | The feed's whole period week by week per unit, every alert as a segment, nothing drawn after today. Tap a week to move the simulation there; "Show on timeline" from an alert scrolls to it. |
| **Settings** (`#settings`) | Everyone | Language (also the FI/EN button in the header), ranking preference, about the data, the optional AI's status, forgetting what this device remembers. |
| **Ask** (header button, only when a language model is configured) | Anyone | A question in your own words becomes filters you can see and change. The model never produces a number. A question about something unusual opens the unit's alerts. |

Finnish and English throughout; names of units, antibiotics and specimens come
from the feed in both languages.

## How data arrives

The app reads one feed and nothing else (it never reads the dataset's CSV files).

- **Format**: `@aei/feed` (`libs/utils/feed`, types only). `FeedMeta` (code lists: units with
  inpatient/outpatient type, antibiotics with class and the specimen they are
  reported for, organisms, specimens, the date range), `Result` (one isolate:
  sample date, admission date, unit, specimen, organism, sex, age, resistance
  flags, and antibiotic → S/R), `FeedClock` and the live `FeedEvent`s.
- **Transport**: `@aei/feed/http` (`libs/utils/feed/src/http.ts`), HTTP plus server-sent events, relative to
  the page's origin:

  | Route | |
  |---|---|
  | `GET /api/meta` | code lists and date range (fetched once) |
  | `GET /api/clock` | the clock: results are released up to `asOf` |
  | `POST /api/clock` | demo controls: `play`, `pause`, `step`, `seek`, `configure` |
  | `GET /api/isolates?from=&to=` | results released so far, by sample date |
  | `GET /api/live` | events: `clock`, `arrivals` (new results), `reset` (the clock went back) |

  The development feed's field names differ slightly (`datasetStart`, `wards`,
  `records`); they are mapped in `http.ts` and nowhere else.
- **Sync**: `src/feed/useFeed.ts` subscribes first, loads everything released
  so far, then appends each day's arrivals. The day shown (`asOf`) trails the
  feed clock until that day's results are in, so no screen computes a day from
  half its results. A dropped stream reconnects with backoff and fetches only
  the missing days.
- **Any feed**: the dev server proxies `/api` to `AEI_FEED_URL`
  (default `http://localhost:8787`). Any laboratory system that serves these
  routes drives the app. Nothing in the app names a unit, organism, antibiotic,
  specimen or date; the only public tables are the WHO AWaRe classification
  (`@aei/empiric` `aware.ts`), EUCAST expected resistant phenotypes (`@aei/empiric` `eucast.ts`)
  and the always-alert resistance flags CPE and VRE (`@aei/signals` `phenotypes.ts`).
  Anything not in those tables simply gets no badge or no special rule.

## Run it

Start the feed first, then the app.

```sh
# 1. the team's development feed (apps/api on the ui/web-app branch), port 8787
cd apps/api && node src/main.ts

# 2. this app, http://localhost:5173
# (the app's engines are workspace gears, so install from the repository root)
pnpm install
pnpm dev:web                                  # or: AEI_FEED_URL=http://other-host:8787 pnpm dev:web
```

`pnpm dev` from the root starts both. Checks: `pnpm -r typecheck` (types),
`pnpm test` (every test) and `pnpm check` (Biome) from the root; inside
`apps/web`, `npx vitest run` runs this app's tests only.

Optional AI layer (Ask): put `AEI_LLM_URL`, `AEI_LLM_MODEL`,
`AEI_LLM_ACCESS_ID`, `AEI_LLM_ACCESS_SECRET` in `../../.env.ai` (gitignored).
They stay on the dev server: the browser calls `/llm/v1/...` and the proxy adds
the credentials (see `vite.config.ts`). With `vite --host` the proxy is off
unless `AEI_LLM_ALLOW_LAN=1`. Without the variables, Ask is simply not shown.

Dev tooling over a feed export (`GET /api/isolates` at the end date and `GET /api/meta`):
`node benchmarks/planted-events/check-signals.ts isolates.json meta.json` (from the
repository root) replays every day through `@aei/signals` and measures it against
the planted events; `node scripts/check-screens.ts isolates.json meta.json 2025-06-20`
(from `apps/web`) prints what the screens would show on given days, asked through
the same analysis door as the app (`src/analytics`, local source).

## The demo simulation

The dataset is a fixed snapshot, so the feed replays it: its clock starts a few
months into the data and releases results day by day (1 day per 2 s, 0.5 s or
0.1 s), or jumps to a date. The violet **Simulation** band is the only place
this shows; a live hospital feed would have no such control. **Play to next
alert** plays and pauses by itself on the next new high alert. Everything AEI
shows is computed from the results released so far (in the browser by
default, see "Where the analysis runs"): when
something happens in the data, the app notices it by itself on the day the
data would have shown it. Going back reloads everything up to that day, and
no screen ever shows an alert or a figure from after the day shown.

## Where the analysis runs

The screens never call an engine. They ask one door, `src/analytics`
(`useCoverage`, `useMonthly`, `useReportTable`, `useReportMatrix`,
`useSignals`), and an `AnalyticsSource` answers. Which source is chosen once,
at build time, by `VITE_AEI_ANALYTICS`:

| `VITE_AEI_ANALYTICS` | Source | |
|---|---|---|
| `local` (default; also when unset or unknown, with a console warning) | `src/analytics/local.ts` | The gears run in this browser on the results `useFeed` holds; signals in a Web Worker |
| `remote` | `src/analytics/remote.ts` | The server answers; the app sends only the question and the day |

Settings says which ("Analysis runs in: this browser / the server"). Every
answer is exactly a gear type, so a server answers by running the same gears
over its own copy of the same feed, up to `asOf`. The routes a server
implements for `remote` (all `GET`, filters left out when not set, `ward`
always sent, empty = every unit):

| Route | Returns | Same as |
|---|---|---|
| `/api/analytics/coverage?asOf&ward&specimen[&sex&age&onset&organism]&rank` | `CoverageResult` | `@aei/empiric` `coverage(released, asOf, query, catalog, { rank })` |
| `/api/analytics/monthly?asOf&ward&specimen[&...]&antibiotic&months` | `MonthPoint[]` | `@aei/empiric` `monthly(...)` |
| `/api/analytics/signals?asOf` | `Signal[]` | `@aei/signals` `detectSignals(released, asOf, catalog)`; the app cuts it to `asOf` |
| `/api/analytics/report/table?asOf&ward&specimen[&...]` | `ReportTable` | `@aei/empiric` `reportTable(...)` |
| `/api/analytics/report/units?asOf&specimen[&...]&days` | `ReportMatrix` | `@aei/empiric` `reportMatrix(...)` |

An `asOf` after the server's clock should be refused (e.g. 409), not answered
from fewer results. While an answer is missing the screen waits; when the
server fails, a notice says so and offers "Try again". Answers are cached for
the session and forgotten when the feed reloads. These routes are not yet in
`@aei/contract` (whose `/api/coverage` is a different, `@aei/coverage`
answer); the contract's owner adds them when the server implements them.

## Engine rules

Pure functions in the gears `@aei/isolates`, `@aei/empiric` and
`@aei/signals` (`libs/utils`), run on the results released so far.

- **Counting** (organiser's rule): the first isolate per patient, per
  organism, per specimen in each window (`@aei/isolates` `counting.ts`). Filters (unit, sex,
  age, onset) are applied before the de-duplication, so a figure answers
  "patients like this" (see open question 1 below).
- **Floor** (organiser's rule): no percentage from fewer than 30 isolates
  (`@aei/isolates` `rules.ts`, `MIN_ISOLATES`); below it the screen shows the count and says
  "too few". Every figure shows the count it rests on.
- **Windows**: last 28 days and last 365 days, both ending on the day shown.
  The doctor's screen leads with the 4 weeks when they reach the floor,
  otherwise with the 12 months, and says so.
- **Widening**: when even the 12 months are too few, the doctor's screen drops
  filters in this order until enough: age, sex, where it was caught, then the
  unit (organism and specimen never), and says in one line what it left out.
- **Hospital-acquired**: sampled on day 3 of the stay or later
  (sample date ≥ admission date + 2 days); inpatient units only.
- **Untested antibiotics** (bacterium not yet known): a missing result counts
  as "doesn't work" only when EUCAST lists the pair as expected resistant;
  otherwise the isolate is left out of that antibiotic's count. An antibiotic
  is shown only when at least half the isolates have an answer for it (after
  THL Finres). When a figure rests on fewer than 95 % of the isolates, the
  screen says so: "rests on 418 of 523 · not tested for *E. faecalis*, *P. aeruginosa*".
- **Ranking**: figures resting on 30 or more first, then thinner ones, then
  none; within each, how often it worked. With "prefer Access" (default), a WHO
  Access antibiotic within 10 percentage points of the best goes first, and the
  screen names the stronger one it was preferred over.
- **Alerts** (`@aei/signals` `signals.ts`): each day is tested on data up to that day only;
  hits of the same kind and key within 28 days form one episode with a stable
  id. Kinds: rare resistance (sentinel), surge, cluster, results missing (data
  gap), working less often (shift), resistance slowly rising (trend). For the
  reader, signals on one unit with the same organism or flag within 14 days of
  each other are shown as one story (`episodes.ts`); detection is unchanged.

### Provisional thresholds, for the team to confirm (and record in DECISIONS.md)

Each is one constant; the file is given.

- [ ] `@aei/empiric` `coverage.ts`: half-known rule `MIN_KNOWN_SHARE` = 0.5; Access margin 10 points; widening order age → sex → onset → unit.
- [ ] `@aei/signals` `signals.ts`: a unit's own history is trusted after 182 days (`minHistoryDays`); episode gap 28 days; first-isolate look-back for alert baselines 365 days.
- [ ] Sentinel: CPE and VRE alert on every find (`@aei/signals` `phenotypes.ts`); any other flag alerts when it reappears on a unit after 90 quiet days; finds within 28 days join one episode.
- [ ] Surge: patients with a flag on a unit, last 14 days vs the unit's previous 365 days, Poisson p < 0.001, at least 3 patients.
- [ ] Cluster: same organism, specimen and resistance profile on a unit, last 28 days vs how common the profile was hospital-wide in the year before, Poisson p < 0.0001, at least 3 patients, the profile includes an antibiotic that most of that organism does not resist (not wild type), smoothing 0.5.
- [ ] Data gap: results from a unit, last 7 days vs its previous 84 days, Poisson p < 0.0001, or 5 days in a row with none when the unit usually sends at least 2 a day.
- [ ] Shift: % resistant on a unit, last 28 days vs the 336 days before, one-sided Fisher p < 0.001, at least 3 resistant, and **both windows at least 30 isolates** (`SHIFT_MIN_RECENT`, added in this round). Measured on the full replay: 22 shift episodes become 10; the 12 dropped rested on 3 to 26 isolates (9 on fewer than 10, e.g. "works 3 of 6"); all five planted Urology shifts (36–48 isolates) are kept; the ICU MRSA outbreak is still raised by its sentinel, surge and clusters. Set `SHIFT_MIN_RECENT` back to 0 to undo.
- [ ] Trend: hospital-wide Cochran–Armitage over 28-day blocks (26 to 39 blocks), p < 0.001, last 13 blocks at least 2 points higher, both parts at least 30 isolates.
- [ ] Wording of p-values: below 0.0001 "very unlikely to be chance", below 0.01 "unlikely to be chance".
- [ ] Screens: an alert is "active" for 28 days after it last fired (Alerts); the doctor sees this unit's alerts from the last 14 days, at most 2 lines; "worked often" from 80 %; "rests on X of Y" shown below 95 %; outbreak story links signals within 14 days.

### Open questions for the team

1. **First-isolate order**: filters are applied before choosing each patient's first isolate. Read literally (CLSI M39), the first isolate is chosen over the whole window and filters applied after. The alert engine uses a third definition (365-day look-back). One rule should be chosen and recorded.
2. **Ranking with partly tested antibiotics**: a figure that rests on 30 of 49 isolates (e.g. piperacillin-tazobactam in ICU blood, untested for *S. aureus*) can still lead the list. The screen now says what it leaves out; whether such figures should also rank below fully tested ones is a statistical decision.
3. **Institution names**: unit groups are labelled from the feed's `institution` code; "hospital" and "primary_care" have Finnish and English names, any other code is shown readably as written. A feed could send the names instead.

## Deliberately not shown

- **No inferred patient transfers.** The data has no transfer records; shared patients between units are not presented as movement.
- **No external figures.** No national, regional or THL/Finres numbers are shown next to the hospital's; the app shows only what the feed released.
- **No invented examples.** Every figure on screen is computed from released results and shows how many it rests on; nothing is shown before it exists in the feed.
- **No recommendation for a patient.** The screen says how often each antibiotic worked for similar patients here; the doctor decides (a prescribing tool would be a regulated medical device).
