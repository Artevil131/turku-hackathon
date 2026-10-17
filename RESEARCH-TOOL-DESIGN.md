# Research tool backbone: projects, notes, export, tools (design)

Written 2026-10-17 as a proposal for the project shell of VISION.md, scoped
by Artem's decisions of the same day (section 0). It is the brief for
whoever builds the projects and export side, in parallel with the unified
researcher view of RESEARCH-PLAN.md. Everything marked **team decision**
is not yet decided and goes into DECISIONS.md with the first change that
depends on it (AGENTS.md).

## 0. Decided by Artem, 2026-10-17

- Demo scope: the unified view (RESEARCH-PLAN.md 3.1 to 3.6) plus a project
  shell: projects as saved scope, continuous or frozen; notes anchored to a
  project, a date, a unit or a signal; export of a view as SVG/PNG, CSV of
  rows and derived data, results as JSON with the method, and a Word report.
  The tools layer is only stackable filters plus running the measured
  detectors on a selection.
- Storage: the API writes one JSON file per project to disk. No database.
  New gear `libs/utils/projects`, routes under `/api/projects`.
- Frozen project = an as-of date cut-off applied to every query, on the
  live data (the release index already supports `upTo(date)`).
- Motion: CSS and the View Transitions API, no new dependency.
- Decided on main meanwhile (D-051): several hospitals on one server, a
  sites file, `site?` on queries, `Meta.sites`, `hospital=` as a shared URL
  parameter. A project's scope therefore carries `sites: SiteId[]` beside
  `units`, and statistics stay within a site (sites README).
- Added to the vision the same evening (VISION.md, "The workbench"):
  notebook-style cells, comparing locked frames, free computation, the
  researcher's own tables injected into a project. Section 9 below says how
  this design grows into it without being rewritten.

## 1. What the code already gives us

- `ReleaseIndex.upTo(date)` is the only cut the server uses; every read
  route computes `asOf = clock.state().asOf` on one line, so a per-request
  cut is a one-line change per route. The caches already key by `asOf`.
- `/api/isolates` already clamps `to` to the clock; `min(requested, clock)`
  generalises to a frozen project's date.
- `samplingDrop` and `emptyRun` read only `ward` and `sampleDate` of a
  culture, so "run detectors on my selection" needs daily culture counts per
  unit, not culture rows.
- Size: 24.5k isolates, 46.8k cultures over three years; a year of isolates
  is about 8k records, 2 MB of JSON. Client-side filtering is fine for now.
- Patterns to copy: `@aei/dataset` is a gear that imports `node:fs` with
  `"types": ["node"]`; `@aei/coresistance` exposes a `./route` subpath with
  `parseQuery`/`handle` returning `{status, body}`, wired into
  `apps/api/src/main.ts` in six lines; `@aei/contract` depends on gears,
  never the reverse.
- `writeHashParams` uses `replaceState`, which fires no `hashchange`; the
  board only re-reads the URL on `hashchange`. That is why the timeline and
  the board cannot share `inc=` today (section 4.3 fixes it; it is step 0).
- `migrateLayout` rejects a saved dock layout whose window set differs from
  `WIN_IDS`, so adding windows resets everyone's layout once. Acceptable.
- The container mounts `data/` read-only; projects need their own writable
  volume.

## 2. Gear `libs/utils/projects` (`@aei/projects`)

Depends on `@aei/domain` and `@aei/replay` only; never on `@aei/contract`.
Two entry points, like `@aei/dataset/csv`: `"."` (types, pure functions,
memory store, route handler; no Node imports, the web bundles it) and
`"./fs"` (the file store; `node:fs/promises`, tsconfig `"types": ["node"]`).

### Types

```ts
export type ProjectMode = "continuous" | "frozen";

/** A stackable filter beyond IsolateQuery; applied client-side (section 6). */
export type Filter =
  | { field: "antibiotic"; code: AntibioticCode; result: SR | "untested" }
  | { field: "sex"; value: Sex }
  | { field: "age"; min?: number; max?: number }
  | { field: "onset"; value: "hospital" | "community" }
  | { field: "homeArea"; value: string }
  | { field: "firstIsolate" };

export interface Scope {
  /** Inclusive frame; null from = dataset start, null to = the as-of date. */
  from: IsoDate | null;
  to: IsoDate | null;
  /** Empty lists mean all. */
  units: WardCode[];
  organisms: Organism[];
  specimens: Specimen[];
  phenotypes: Phenotype[];
  filters: Filter[];
}

export type NoteAnchor =
  | { kind: "project" }
  | { kind: "date"; date: IsoDate }
  | { kind: "unit"; unit: WardCode }
  | { kind: "signal"; incident: string }; // Incident.key = alert.incident ?? alert.id

export interface Note { id: string; anchor: NoteAnchor; text: string; createdAt: string; updatedAt: string; }

export interface Project {
  schema: 1;
  id: string;
  name: string;
  mode: ProjectMode;
  /** Frozen only: every query is cut here, never later than the server clock. */
  asOf?: IsoDate;
  scope: Scope;
  notes: Note[];
  createdAt: string;
  updatedAt: string;
  /** Bumped by the store on every write; a PUT carrying an older one is refused (409). */
  revision: number;
}

export type ProjectSummary = Pick<Project, "id" | "name" | "mode" | "asOf" | "updatedAt" | "revision"> & { notes: number };
export type NewProject = Pick<Project, "name" | "mode" | "scope"> & { asOf?: IsoDate };
export type NewNote = Pick<Note, "anchor" | "text">;
```

### Pure functions

```ts
export const EMPTY_SCOPE: Scope;
export function newProject(input: NewProject, now: string, id: string): Project;
export function validateProject(value: unknown): { ok: true; project: Project } | { ok: false; error: string };
export function validateNewProject(value: unknown): ...;
export function validateNewNote(value: unknown): ...;
export function migrateProject(raw: unknown): Project | null;
export function summarize(p: Project): ProjectSummary;

/** frozen: min(project.asOf, clockAsOf); continuous: clockAsOf. */
export function effectiveAsOf(p: Pick<Project, "mode" | "asOf">, clockAsOf: IsoDate): IsoDate;
export function scopeWindow(s: Scope, asOf: IsoDate, datasetStart: IsoDate): { from: IsoDate; to: IsoDate };
/** The broadest single-valued server query the scope allows. */
export function scopeQuery(s: Scope, asOf: IsoDate): { from?: IsoDate; to?: IsoDate; ward?: WardCode; organism?: Organism; specimen?: Specimen };
/** Everything the scope says, applied to a fetched record. */
export function scopePredicate(s: Scope): (r: IsolateRecord) => boolean;
export function scopeCoversSignal(s: Scope, x: { ward: WardCode | null; phenotypes: readonly Phenotype[]; date: IsoDate }): boolean;

export function addNote(p: Project, note: NewNote, now: string, id: string): Project;
export function updateNote(p: Project, noteId: string, text: string, now: string): Project;
export function removeNote(p: Project, noteId: string, now: string): Project;
export function notesAt(p: Project, anchor: NoteAnchor): Note[];
```

Validation is hand-written over `isWardCode`, `ORGANISMS`, `PHENOTYPES`,
`SPECIMENS`, `isAntibioticCode` and a `YYYY-MM-DD` test; no schema library.
`now` and `id` are passed in (deterministic tests); ids come from
`crypto.randomUUID()` at the call site.

### Store

```ts
export class RevisionConflict extends Error { readonly current: number; }
export interface ProjectStore {
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<Project | null>;
  /** Writes with revision + 1; throws RevisionConflict when the stored revision differs. */
  put(project: Project): Promise<Project>;
  delete(id: string): Promise<boolean>;
}
export function createMemoryStore(seed?: Project[]): ProjectStore; // "."
export function createFileStore(dir: string): ProjectStore;         // "./fs"
```

File store: `<dir>/<id>.json`, pretty-printed; `id` limited to
`[A-Za-z0-9_-]{1,64}`; write to `<id>.json.tmp` then rename; `list()` runs
`migrateProject` and skips broken files with a log line, never deletes.
Directory `AEI_PROJECTS_DIR`, default `../../data/projects` (git-ignored
with `data/`); compose adds a volume `aei-projects:/projects` with
`AEI_PROJECTS_DIR=/projects`. **Team decision:** optimistic revision (409)
rather than last write wins, because two tabs on one project is the normal
demo situation and notes are append-heavy.

### Route handler (`./route`, mirrors `@aei/coresistance/route`)

```ts
export function parseProjectsPath(pathname: string): { id?: string; noteId?: string; notes: boolean } | null;
export function handleProjects(
  req: { method: string; path: string; body: unknown },
  store: ProjectStore,
  deps: { now: () => string; id: () => string; clockAsOf: () => IsoDate },
): Promise<{ status: number; body: unknown }>;
```

A frozen `asOf` later than `clockAsOf()` is refused with 400, so a frozen
project is reproducible on the day it is made.

## 3. Routes and the frozen cut

| Method, path | Body | Reply |
|---|---|---|
| `GET /api/projects` | | `{ projects: ProjectSummary[] }` |
| `POST /api/projects` | `NewProject` | 201 `Project` |
| `GET /api/projects/:id` | | `Project` or 404 |
| `PUT /api/projects/:id` | `Project` with `revision` | `Project`; 409 `{ error, current }` |
| `DELETE /api/projects/:id` | | 204 |
| `POST /api/projects/:id/notes` | `NewNote` | `Project` |
| `PUT /api/projects/:id/notes/:nid` | `{ text }` | `Project` |
| `DELETE /api/projects/:id/notes/:nid` | | `Project` |

Notes are nested so the server applies `addNote` and friends to the stored
copy and bumps the revision itself; a client never holds the whole project
to write a note. **Team decision:** nested note routes.

Contract: `ROUTES.projects`, re-export the types from `@aei/projects`, and
on `AeiClient`: `projects()`, `project(id)`, `createProject(input)`,
`saveProject(project)` (throws `ApiError` 409), `deleteProject(id)`,
`addNote(id, note)`, `updateNote(id, noteId, text)`, `deleteNote(id, noteId)`.

### How `asOf` flows for a frozen project

Server side. Only `/api/isolates` has a `to`; alerts, relations, weekly,
coverage, fails-together, regional and explain cut at the clock internally,
and a client cannot recompute coverage or alerts for an earlier date. Every
read query type gets `asOf?: IsoDate`, and `main.ts` gets one helper:

```ts
/** The requested as-of date, never later than the clock; the clock when absent or malformed. */
function cutAt(params: URLSearchParams): IsoDate {
  const asked = params.get("asOf");
  const now = clock.state().asOf;
  return asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked < now ? asked : now;
}
```

Each route replaces `const asOf = clock.state().asOf` with
`cutAt(url.searchParams)` (eight one-line edits); responses already carry
`asOf`, so a capped date is visible. In the contract:

```ts
/** The same client with asOf on every read; commands and the stream untouched. */
export function withAsOf(client: AeiClient, asOf: IsoDate | null): AeiClient;
```

The web passes `withAsOf(live.client, effectiveAsOf)` down as `client`, so
no panel or hook changes. In frozen mode `useLive` takes a `ceiling` and
ignores `arrivals` and `alerts` events past it; the timeline shows the frozen
date as the playhead with play and step disabled and a label "Frozen at
14.12.2025 · server at 27.9.2026". Opening a frozen project never seeks the
shared server clock. **Team decision:** `asOf` as a query parameter (not a
header, not client-side clamping).

## 4. Web

### 4.1 Where project state lives

- URL: `project=<id>` joins `SHARED_PARAMS` in `apps/web/src/url.ts` (next
  to `tl`), so it survives page switches. The URL still holds the view
  (`unit`, `inc`, `tl`); the project holds the scope.
- `apps/web/src/projects.ts`: `ProjectsContext` and `useProjects(client,
  clockAsOf)`, modelled on `FlowsContext` in `relations.ts`, owned by App:

```ts
export interface ProjectState {
  list: ProjectSummary[];
  current: Project | null;
  status: "idle" | "loading" | "ready" | "error" | "conflict";
  asOf: IsoDate | null;   // effectiveAsOf(current, clock) or the clock
  frozen: boolean;
  open(id: string | null): void;
  create(input: NewProject): Promise<Project>;
  save(patch: Partial<Pick<Project, "name" | "mode" | "asOf" | "scope">>): Promise<void>; // 409 → reload, status "conflict"
  remove(id: string): Promise<void>;
  addNote(note: NewNote): Promise<void>; updateNote(id: string, text: string): Promise<void>; deleteNote(id: string): Promise<void>;
}
```

- `App.tsx`: `const projects = useProjects(live.client, live.clock?.asOf ?? null)`;
  `client = withAsOf(live.client, projects.frozen ? projects.asOf : null)`;
  pass `client` and `asOf` to Timeline, ResearchBoard, DoctorPage and
  MethodPage; wrap the tree in the provider; `useLive` gets the ceiling.
  This is the only App edit the project track makes.

### 4.2 Switcher, scope and view

- `components/project/ProjectSwitcher.tsx` in the TopBar, before the gear:
  the project name and a mode chip ("live" / "frozen 14.12.2025") or "No
  project". Menu: the list, "New project from this view", "Freeze here",
  "Save view to project" (a dot when the view differs from the saved
  scope), "Leave project".
- One rule, so there are not two sources of truth: **opening a project
  applies its scope to the URL once; after that the URL wins; "Save view"
  writes the URL back into the scope.** Helpers in
  `components/research/project/scope.ts`: `viewFromScope(s)`,
  `scopeFromView(board, layers, frame, filters)`,
  `viewMatchesScope(s, board, layers)`.
- Time frame: the band's `windowRows` gets an optional `frame {from, to}`
  from `useProjectFrame()`, a hook rendered by App, so the project track
  never edits `Timeline.tsx` while the view track restructures it.
- Feed: `ResearchBoard`'s `shown` memo adds one filter,
  `scopeCoversSignal(scope, incident)`.
- Notes: a new workspace window `notes` (and `tools`): `WIN_IDS` grows,
  `STORAGE_KEY` becomes `aei.research.layout.v3`, both start closed.
  `research/project/NotesPanel.tsx` groups notes by anchor, the selected
  signal's and focused unit's first; "Add note" offers the anchor from the
  current selection. The signal card gets a "Notes (n)" line.

### 4.3 Selection shared by the timeline and the board (step 0, one person)

A `useHashParam` hook, not lifting state to App; the URL stays the single
owner (RESEARCH-PLAN.md 2) and the doctor page can use it too.

```ts
// apps/web/src/url.ts
export function mergeHash(hash: string, params: Record<string, string | null | undefined>): string; // pure, testable
export function subscribeHash(fn: () => void): () => void; // fires after every replaceState done through this module
export function useHashParam(key: string): [string | null, (value: string | null) => void];
```

`writeHashParams` calls `mergeHash` then notifies; the hook listens to that
and to `hashchange`/`popstate`; `ResearchBoard` swaps its `hashchange`
listener for `subscribeHash`. `incident` stays in `BoardState`. A pill click
outside `#research` does `pushState` to `#research?inc=…`.

## 5. Gear `libs/utils/export` (`@aei/export`)

Split by what a function needs: pure builders in `"."` (Node and browser),
DOM-dependent SVG/PNG in `"./browser"` (tsconfig lib adds DOM), the Word
report in `"./docx"`. Saving a file (`download(blob, name)`) is app code in
`apps/web/src/export.ts`.

```ts
// "."
export interface CsvColumn<R> { key: string; label: string; value: (r: R) => string | number | null | undefined; }
export interface CsvOptions { delimiter?: "," | ";"; decimal?: "." | ","; bom?: boolean; newline?: "\n" | "\r\n"; }
/** RFC 4180 quoting. Defaults "," and "." for R and Python; ";" "," + BOM offered for Finnish Excel. */
export function toCsv<R>(rows: readonly R[], columns: readonly CsvColumn<R>[], o?: CsvOptions): string;
export const ISOLATE_COLUMNS: CsvColumn<IsolateRecord>[]; // one column per antibiotic (S/R/empty), phenotypes as 0/1
export function weeklyRows(s: WeeklySeries): { week: IsoDate; unit: WardCode; measure: "cultures" | Phenotype; value: number }[];
export const WEEKLY_COLUMNS: CsvColumn<...>[];
export function signalRows(signals: readonly Signal[]): Record<string, string | number | null>[];

export interface ResultsDocument {
  schema: 1;
  generatedAt: string;
  software: { name: "aei"; version: string; commit?: string };
  asOf: IsoDate;
  cut: Scope;
  method: { name: string; parameters: Record<string, unknown>; decision?: string; description: string };
  input: { records: number; cultures?: number; from: IsoDate; to: IsoDate };
  numbers: unknown; // Signal[] | episodes | CoverageResult | { observed, expected, p }
  notes?: Note[];
}
export function resultsDocument(x: ...): ResultsDocument;

// "./browser"
export function svgToString(svg: SVGSVGElement, o?: { inlineStyles?: boolean; width?: number; height?: number; background?: string | null; fontFamily?: string }): string;
export function svgToPng(svgText: string, o?: { scale?: number; background?: string }): Promise<Blob>; // scale 2 by default
```

`inlineStyles` copies a fixed list of computed properties (fill, stroke,
widths, dashes, opacities, font family/size/weight, text-anchor,
dominant-baseline, paint-order, visibility, display) onto each element so
tokens and class rules survive outside the page; fonts are not embedded,
and the menu says so.

Where exports attach: the timeline band (SVG/PNG of what is on screen, CSV
of `weeklyRows`), the signal card (results JSON for the incident with the
detector's parameters from `LIVE_SETTINGS` and its D-number; CSV of the
isolates behind it), the tools panel (CSV of filtered rows; results JSON of
a run), the project menu (the Word report, the project JSON), and the
bundle from any view or tool run (section 5, "Reproducible bundle").

### Word report

| Option | Cost | Result |
|---|---|---|
| A. `docx` npm package, client side (runs in Node too) | one dependency (~300 KB gzipped, MIT); about 3 h | a real .docx; opens in Word, LibreOffice, Pages |
| B. HTML saved as .doc | no dependency; about 1 h | compatibility mode; base64 images unreliable in Word 365 |
| C. Server side, python-docx or pandoc | new route and Python dependency; about 4 h | the API becomes a renderer; the browser's SVG never reaches it |
| D. Hand-written OOXML zip | no dependency; about 4 h, brittle | correct if nothing goes wrong |

Recommended: **A**, as `buildReport(input: ReportInput): Promise<Uint8Array>`
in `@aei/export/docx`, bytes so a Node script and the browser share it; B is
the fallback with the same `ReportInput`. **Team decision:** the `docx`
dependency.

```ts
export interface ReportInput {
  locale: Locale;
  project: Pick<Project, "name" | "mode" | "asOf" | "scope" | "notes">;
  generatedAt: string; version: string; commit?: string; hospital: string;
  sections: { title: string; paragraphs: string[]; figure?: { png: Uint8Array; width: number; height: number; caption: string }; table?: { columns: string[]; rows: (string | number)[][] } }[];
  methods: ResultsDocument["method"][];
}
```

The web builds `sections` from what is on screen (the card's sentence via
the same i18n keys, the timeline PNG via `svgToPng`, tables via the CSV
column definitions), so report copy and screen copy never diverge.

### Reproducible bundle (the fourth export)

A bundle is what a researcher takes away to run the numbers again. It is
the export of a view or a tool run, not of the whole project. The builder is
pure, so Node and the browser share it, in `@aei/export/bundle`:

```ts
// "./bundle"
export interface BundleFile { path: string; text: string; }
export interface BundleInput {
  locale: Locale;
  tool: string;                                  // the engine-A tool's id in the menu (D-057)
  data: { rows: readonly Record<string, string | number | null>[]; columns: CsvColumn<Record<string, string | number | null>>[] }; // cut at the screen's floors
  parameters: Record<string, unknown>;           // the tool's inputs, with their D-numbers
  results: ResultsDocument;
  generatedAt: string; version: string; commit?: string;
}
/** Returns data.csv, analysis.R, analysis.py, analysis.ipynb, method.tex, results.json. */
export function buildBundle(input: BundleInput): BundleFile[];
```

- **Files.** `data.csv` (the rows behind the screen, through `toCsv`, cut at
  the same floors the screen uses); `analysis.R` (first, for statistics:
  base R and `stats` only, nothing to install); `analysis.py` and
  `analysis.ipynb` (the same steps for pipelines, using the `aei` package in
  `libs/utils/py`); `method.tex` (the method in LaTeX, constants and their
  D-numbers); `results.json` (`resultsDocument`, the numbers as produced).
- **Generated from a template, per engine-A tool.** Each tool in the menu
  (D-057) has one template for its R and Python scripts and its LaTeX; the
  builder fills in the tool's parameters. Nothing in a script is typed by
  hand, and no script contains a number the tool did not compute.
- **Zipped in the app.** `apps/web/src/export.ts` packs the files and saves
  them with `download`; the builder itself never touches a file.
- **Engine B** (D-057) gets the same bundle once its tools have templates.

## 6. Tools layer, minimal

### Stackable filters

Client side over fetched records; no API extension now. `Scope.filters` is
the stack; the server query stays `scopeQuery(scope, asOf)` and
`scopePredicate(scope)` narrows in the browser; `firstIsolate` uses
`@aei/counting firstIsolates` (the web adds that dependency; it is pure). A
`tools` window (`research/tools/ToolsPanel.tsx`) shows the stack as chips,
the count line "n isolates, m patients of the frame", and the two actions.
One `client.isolates(scopeQuery)` per (frame, asOf) in
`useScopedRecords(client, scope, asOf)` beside `useIncidents`, shared with
notes and export. Revisit when a scope exceeds a year or hospitals multiply.

### Run the measured detectors on my selection

`profileExcess`, `phenotypeExcess`, `risingTrend` and `episodes` take
`IsolateRecord[]` and already run in the browser. Missing inputs:

1. Baseline history: fetch `from − 365 d`, run, report only signals inside
   the frame; constants from `LIVE_SETTINGS`, shown with their D-number.
2. Cultures for `samplingDrop`/`emptyRun`: a daily aggregate
   `GET /api/cultures/daily?from&to → { asOf, days: { date, unit, cultures }[] }`
   plus loosening the two detectors to
   `readonly Pick<Culture, "ward" | "sampleDate">[]` and an
   `expandDailyCounts(days)` adapter. Smaller than culture rows and no
   patient ids leave the server. **Team decision:** the route and the
   type loosening.

**Statistical caveat, team decision:** `profileExcess`'s baseline is the
profile's share hospital-wide; a scope of one unit would make that unit
"the hospital". Proposal: fetch all units for frame + baseline, apply only
organism/specimen/phenotype/patient filters before running, filter the
*signals* to the scope's units afterwards, label the result "exploratory:
live thresholds (D-020) on your selection, no correction for the number of
selections tried". Results are not incidents: they never enter the feed or
`inc=`.

## 7. Order of work, two tracks that never edit the same file

Track A = RESEARCH-PLAN.md 3.1 to 3.6 (selection, card, events strip,
legends, glossary, motion). Track B = this document. Step 0 is shared and
done first by one person.

| Step | Track | Touches | Verified by |
|---|---|---|---|
| 0. `useHashParam`, `mergeHash`, `subscribeHash`; `project` in `SHARED_PARAMS`; board listens through `subscribeHash` | one person, first | `apps/web/src/url.ts`, two lines of `ResearchBoard.tsx` | `url.test.ts` on `mergeHash`; change `inc=` from the console, the board follows |
| 1. `@aei/projects` | B | new `libs/utils/projects/**` | vitest: validation, `effectiveAsOf` caps, `scopePredicate` on fixtures, file store round-trip in a tmp dir, 409 on a stale revision, path matcher |
| 2. Contract and API: routes, client methods, `asOf` on reads, `cutAt`, `withAsOf`, `AEI_PROJECTS_DIR`, compose volume | B | `libs/utils/contract/src/index.ts`, `apps/api/src/main.ts`, `deploy/container/compose.yaml` | `main.test.ts`: CRUD over HTTP; `/api/isolates?asOf=` earlier cuts, later is capped |
| 3. Web shell: `projects.ts`, App wiring, `ProjectSwitcher`, frozen label | B | new `apps/web/src/projects.ts`, `components/project/*`, `App.tsx`, `TopBar.tsx`, `live.ts`, i18n `surfaces/project.ts` | create, freeze, reload keeps `project=`; step the clock while frozen, nothing moves |
| 4. Scope ↔ view, notes panel, `WIN_IDS` + layout v3 | B | `research/project/*`, `workspace/layout.ts` (+ test), `Workspace.tsx` titles, `ResearchBoard.tsx` (one filter, two windows) | `layout.test.ts`; `scope.test.ts` round trip; a note on a signal appears when it is selected |
| 5. `@aei/export` and export menus | B | new `libs/utils/export/**`, `apps/web/src/export.ts`, `components/export/ExportMenu.tsx` | vitest on `toCsv`, `weeklyRows`, `resultsDocument`; SVG opens standalone with colours; CSV loads in R |
| 6. Word report, after the dependency decision | B | `libs/utils/export/src/docx.ts`, `package.json` | bytes start with `PK`; opens in Word and LibreOffice |
| 7. Tools panel, `/api/cultures/daily`, detector type loosening | B | `research/tools/*`, `main.ts` (one route), contract, `@aei/detect` signature | `samplingDrop` over `expandDailyCounts` equals over cultures; E1 frame + URO + E. coli reproduces the June 2025 cluster |
| 8. Records: DECISIONS.md entries, README gear list, VISION.md "what shipped" | both | `DECISIONS.md`, `README.md`, `libs/utils/README.md` | review |

File ownership. Track A owns `Timeline.tsx`, `hero/*`, `timeline.css`,
`research/SignalFeed*`, `research/math/*` (becoming `SignalCard`),
`research/geo/*`, `research/HospitalNetwork*`, `UnitGrid*`, `styles.css`,
`board.ts`, i18n `card.ts`, `glossary.ts` and the timeline keys. Track B
owns everything in the table above. Shared edges: `en.ts`/`fi.ts` (one
import and one spread each; agree the surface file names now: `project.ts`,
`export.ts`, `tools.ts` for B; `card.ts`, `glossary.ts` for A);
`Timeline.tsx` (B's frame crop lands last as one line through
`useProjectFrame`); `ResearchBoard.tsx` (step 0 and step 4 only).

## 8. Team decisions needed before or during the work

1. `asOf` as a query parameter on every read route and `withAsOf` in the
   contract.
2. Optimistic revision (409) for project files; notes as nested routes.
3. The `docx` dependency for the Word report (fallback B needs none).
4. `GET /api/cultures/daily` and loosening `samplingDrop`/`emptyRun` to
   `Pick<Culture, "ward" | "sampleDate">`.
5. How detectors treat a selection: baseline over all units, signals
   filtered to the scope, labelled exploratory.
6. `firstIsolate` filter semantics in the tools (period = the scope frame).
7. CSV defaults and the results JSON schema as a stable artefact.
8. Projects are shared by construction (one server, no auth, D-040); record
   that per-person scoping is a pilot question.
9. Still open elsewhere and needed here: the events strip order and E4 as
   a hospital-level signal (RESEARCH-PLAN.md question 3). (`Meta.site` is
   answered by D-051's `Meta.sites`.)
10. The computation cell's engine (section 9.3) and what a researcher's own
    table may contain and join on (section 9.4).
11. Bundle contents and floors (section 5): the files above, and which
    reporting floor and minimum counts cut `data.csv` so it matches the
    screen.
12. `aei` as a public package (`libs/utils/py`): its version and licence,
    and when an R mirror of the same functions follows.
13. The model's rule: a local model may draft code against `aei` for the
    researcher to read and run, but never supplies a number or a test. This
    extends D-019's rule to every export.

DECISIONS.md numbering: main is at D-056; the first entry from this work
is D-057.

## 9. Growing into the workbench (VISION.md, "The workbench")

The project shell above is the spine; the workbench adds cell types to it.
Nothing in sections 2 to 7 changes shape; three things grow.

### 9.1 Cells

A `Project` gains `cells: Cell[]`, ordered, each with an id and a kind:

```ts
export type Cell =
  | { kind: "note"; id: string; text: string; anchor?: NoteAnchor }
  | { kind: "view"; id: string; view: PinnedView }        // a frozen reference to something on screen
  | { kind: "table"; id: string; source: TableSource; columns?: string[] }
  | { kind: "compare"; id: string; frames: Frame[]; view: PinnedView["view"]; test?: CompareTest }
  | { kind: "compute"; id: string; engine: ComputeEngine; source: string; inputs: string[]; output?: ComputeOutput };

export interface Frame { label: string; from: IsoDate; to: IsoDate; units?: WardCode[]; sites?: SiteId[]; }
export type PinnedView =
  | { view: "timeline"; frame: Frame; layers: string }       // the band's tl= code
  | { view: "map"; month: string; group: string; region?: string }
  | { view: "signal"; incident: string }
  | { view: "grid"; frame: Frame; weeks: 12 | 26 | 52 }
  | { view: "chart"; spec: ChartSpec };                      // built from a table cell
```

Notes of section 2 become `note` cells with an anchor; `notesAt` is kept
as a lookup over cells. "Pin" is one action on every panel: it appends a
`view` cell with the panel's current state (the same state the URL holds,
so pinning is `boardToParams` plus the frame). In a continuous project a
`view` cell re-renders from live data; in a frozen one it renders at the
project's `asOf`.

### 9.2 Compare frames

A `compare` cell holds two or more `Frame`s and one view kind. Rendering:
the same view once per frame in a row, then a difference row for views
that have a number per unit or per week (grid, timeline counts, coverage
shares): the difference, and a test with its method named. The first tests
are ones already in the gears: two-proportion comparison with Wilson
intervals (`@aei/coverage wilson`) for shares; Poisson rate ratio for
counts (`@aei/viz` distributions); the rising-trend test across the frames
(`@aei/detect cochranArmitageRising`). **Team decision:** the test set and
its wording; nothing beyond what is measured ships without an experiment.
The frames come from the timeline: a "lock this frame" action on the band
creates a `Frame`; two locks open a compare cell.

### 9.3 Compute cells

The engine is a team decision (VISION.md open questions). Options and
cost:

| Engine | Cost | Fits |
|---|---|---|
| A. Our tools as a menu with parameters, no code | lowest; each tool is a gear function behind a form | the two measures (clear, useful) for most researchers; limited to what we ship |
| B. A small expression language over tables (filter, group, derive, rate) | medium; a parser and evaluator gear, ~2 days | spreadsheet users; safe; exports as the same expressions |
| C. JavaScript in a sandboxed iframe/worker over the fetched rows | medium; sandboxing and a tiny API; no new dependency | people who code; hard to keep clear |
| D. Python in the browser (Pyodide, pandas; ~10 MB first load) | high; a worker, package loading, a bridge for tables | pandas users; the most "notebook" feel; slow first load |

Recommended for the hackathon: **A now, B next**, with the cell model
keeping `engine` so C or D can be added without touching projects. Every
compute cell stores `source`, `inputs` (cell ids or scope) and `output`
(a table or numbers) so it exports as a `ResultsDocument`.

### 9.4 Injecting the researcher's own data

`Project` gains `tables: ProjectTable[]`: a name, columns with types, the
rows (stored in the project file up to a size cap, else a sidecar
`<id>.<table>.csv` beside it), and a declared join (`date`, `unit`,
`patientId`, `site`). Upload is a CSV through a new
`POST /api/projects/:id/tables` (parsed with the same CSV reader as
`@aei/dataset/csv`). A `table` cell can show it; a `compute` cell can join
it; a derived rate (isolates per 100 bed-days) is the first use. The
hospital's own feed needs nothing new: `/api/ingest` per site (D-051)
already injects live data and a continuous project sees it. **Team
decision:** what a table may contain (no free-text patient data) and
whether patient ids are allowed as a join key.

### 9.5 Order after step 8

9. `cells` with `note` and `view` kinds; "Pin" on every panel; the notebook
   window renders the cells; notes migrate into cells (schema 2).
10. Frames: "lock this frame" on the band; `compare` cell with the two
    views side by side and the difference row; the first test.
11. `tables` upload and the `table` cell; the bed-day rate as a `compute`
    cell under engine A.
12. Export of a cell and of the notebook as the report (the `docx` path of
    section 5 takes cells as sections).
