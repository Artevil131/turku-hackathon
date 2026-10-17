# apps/web

The website (React + Vite, D-003). A thin layer over `libs/utils`; see
../README.md.

    pnpm dev        # API and web together; open http://localhost:5173

The app reaches the backend only through `@aei/contract`. In development
Vite proxies `/api` to `AEI_API_URL` (default http://localhost:8787). A
build that talks to a separately hosted API sets `VITE_AEI_API_URL` to its
origin at build time; unset means same origin.

Pages (URL hash; each page keeps its view state in the hash, so any view is a link):

- **Home** (`/`): what changed since the previous replay day (isolates,
  resistant finds, signals, each linking to where it is shown) and the two
  role entries; the doctor's names the remembered unit.
- **Doctor** (`#doctor?unit&site&sex&age&onset&sev&period`): the doctor's
  list from `/api/coverage` (D-023, D-026, D-027, D-033). One-click filters
  with defaults, unit remembered; sex, age group and inpatient day 3 or
  later are sent to the server, which may drop them to keep the unit's own
  data (D-047), and the list says so. Each row: covers
  %, 95 % interval against the bar, n, the level the data came from,
  standing in words and glyph, and why it sits where it does. Likely
  organisms for the specimen on the unit beside the list. Printable.
- **Research** (`#research?panel&unit&kind&ph&inc`): the signal feed
  (incidents, pinned sentinels, one click to the isolates behind an alert)
  beside one of the unit grid (counts per unit-week), the hospital network
  (patient flow, alert-lit units) and the regional map (THL county series,
  `/api/regional` and `/api/counties`).
- **Settings** (`#settings`): language, remembered view, about the data.
- **Intro** (`#intro`): the pitch opening, a terraced picture of county
  pressure; not a working view.

The replay timeline sits under the top bar on every working page. Every
figure comes from the API; nothing on screen is example data.

Design: Impeccable (D-008). Product context in /PRODUCT.md, the direction
contract in `.impeccable/surfaces/`. Light mode only for now; dark tokens
stay in `src/styles.css` under `[data-theme="dark"]` (`THEME` in `App.tsx`).

## Optional assistant

When `/api/meta` reports `ai: true`, Doctor and Research offer a bilingual
Ask field. Parsed filters appear as removable chips; sex, inclusive age
bounds and dates are carried through to the isolate request. Unrecognised
words remain visible. The field hides on 503 and a 502 leaves manual
filters available. Requests are refreshed on replay-clock changes; stale
responses cannot replace newer data.

The incumbent antibiograms and history use invented example figures, not
an isolate-backed statistics pipeline. An active question therefore shows
an exact-selection results table instead of those example percentages or
history. Counts reuse `@aei/counting` first-isolate deduplication, grouped
by organism/specimen/antibiotic; the existing reporting floor still applies.
It makes no annual fallback or comparison beyond the requested records.
Clearing the question restores the ordinary example views. Research signals
continue through their existing finding list, populated from matched records.

Released CPE/carrier alerts have an inline Explain action, including without
an LLM. Template responses are explicitly marked; explanations reload when
the language changes. The model never supplies a susceptibility count.
