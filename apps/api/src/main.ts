import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import { buildAlerts, patientFindings, sortAlerts } from "@aei/alerts";
import {
  alertExplainInput,
  createAiMonitor,
  createLlm,
  explainAlert,
  fillSlots,
  LlmError,
  llmConfigFromEnv,
  parseQuestion,
  probeLlm,
} from "@aei/ask";
import {
  type ClockCommand,
  type ExplainResponse,
  type IsolateQuery,
  type LiveEvent,
  type Meta,
  type NationalResponse,
  type PatientFindingsResponse,
  type QualityResponse,
  type RegionalData,
  type RegionalQuery,
  type RelationsResponse,
  ROUTES,
  regionalUpTo,
  type SitesResponse,
} from "@aei/contract";
import {
  type FailsTogetherResponse,
  cacheKey as failsKey,
  handle as failsTogetherHandle,
  parseQuery as parseFailsQuery,
} from "@aei/coresistance/route";
import { barFor, type CoverageResult, coverage, ONSETS, type Onset, suggest, suggestCombinations } from "@aei/coverage";
import { type Dataset, joinIsolates, loadDataset } from "@aei/dataset";
import {
  AGE_GROUPS,
  ANTIBIOTICS,
  type AntibioticCode,
  type IsolateRecord,
  isAgeGroup,
  ORGANISMS,
  type Phenotype,
  SPECIMENS,
  type Specimen,
  type WardCode,
} from "@aei/domain";
import { defeatedBy } from "@aei/eucast";
import { packageFiles, projectBundle } from "@aei/export";
import { antibioticName, phenotypeName, registerSites, registerWards, specimenName, t, wardName } from "@aei/i18n";
import { asResult, type CodeMaps, DEFAULT_CODE_MAPS, detectFormat, extendCodeMaps, ingest, mergeResults } from "@aei/ingest";
import { isProjectId, matchesScope, type Project, type ProjectInput, parseProjectInput } from "@aei/projects";
import { createProjectStore, fingerprintRows, newProjectId } from "@aei/projects/node";
import { checkRows, type Finding, summarize } from "@aei/quality";
import { countFlows, patientMoves, phenotypeTrails, trailLinks } from "@aei/relations";
import { addDays, createReleaseIndex, createReplayClock } from "@aei/replay";
import {
  alertSite,
  authorize,
  type ConnectedSite,
  createFeedLog,
  qualifyResult,
  qualifyWard,
  rowsOfSite,
  SitesFileError,
  touchingSite,
} from "@aei/sites";
import { loadSites } from "@aei/sites/node";
import { type WeeklySeries, weeklySeries } from "@aei/viz";

// Development server for the AEI contract (libs/utils/contract). It loads
// the synthetic dataset, replays it day by day and pushes arrivals to
// clients over server-sent events, and takes lab results as they would come
// from a laboratory system (HL7 v2, FHIR or a CSV export) on POST /api/ingest
// (D-035). Wiring only; the logic is in the gears.

const env = process.env;
const llmConfig = llmConfigFromEnv();
const llm = llmConfig && createLlm(llmConfig);
console.log(`[aei-api] AI ${llm ? `configured; model ${llmConfig.model}` : "off"}`);
// Whether the model answers now (D-049): the team's model server runs only while its job is up, so
// it is probed at start, every minute and after a failed question; /api/meta reports the result.
const ai = createAiMonitor({
  probe: llmConfig && (() => probeLlm(llmConfig)),
  onChange: (status) => console.log(`[aei-api] AI ${status}`),
});
ai.start();
void ai.settled().then((status) => {
  if (status === "offline") console.log("[aei-api] AI offline: the model server does not answer; checking every minute");
});
const explanations = new Map<string, ExplainResponse>();
// coverage() takes about 0.25 s (pairs over three levels), so cache by query and replay date.
const coverages = new Map<string, CoverageResult>();
// Served as built JSON text, by replay date and query. Cleared on ingest with the caches above.
const alertsCache = new Map<string, string>();
const regionalCache = new Map<string, string>();
let countiesBody: string | undefined;
// "Fails together" (D-048), cached by query and replay date like coverage.
const failsTogethers = new Map<string, FailsTogetherResponse>();
const config = {
  port: Number(env.AEI_PORT ?? 8787),
  stateDir: env.AEI_STATE_DIR || undefined,
  dataDir: resolve(env.AEI_DATA_DIR ?? "../../data/synthetic_microbiology_dataset"),
  // Where the replay starts (D-015): by default three weeks before the
  // Urology ESBL E. coli cluster of June 2025 (experiments/0001), so the
  // demo shows a normal ward first and then the outbreak arriving.
  startAt: env.AEI_REPLAY_START ?? "2025-05-12",
  tickMs: Number(env.AEI_TICK_MS ?? 2000),
  daysPerTick: Number(env.AEI_DAYS_PER_TICK ?? 1),
  // Load only results sampled up to this date; later ones can then arrive through /api/ingest.
  loadUntil: env.AEI_LOAD_UNTIL || undefined, // empty counts as unset (compose passes empty variables)
  // A JSON file of the site's own codes (see @aei/ingest CodeMaps), merged over the defaults.
  codeMapFile: env.AEI_CODE_MAP,
  guideline: env.AEI_GUIDELINE ?? "",
  // THL county series and signals, written by scripts/fetch_thl_ttr.py (D-037); read on each request, so a re-fetch shows at once.
  regionalFile: resolve(env.AEI_REGIONAL ?? "../../data/external/thl/regional.json"),
  // County polygons for the regional map, written by scripts/fetch_county_geometry.py.
  countiesFile: resolve(env.AEI_COUNTIES ?? "../../data/external/statfi/counties.geojson"),
  // Other hospitals connected to this server, with their units and tokens (D-051); unset: the home site alone.
  // A relative path is read from where the command was started (pnpm's INIT_CWD, e.g. the repository root).
  sitesFile: env.AEI_SITES ? resolve(env.INIT_CWD ?? ".", env.AEI_SITES) : undefined,
  // THL Finres national reference, written by scripts/fetch_finres.py (D-048); read on each request.
  nationalFile: resolve(env.AEI_NATIONAL ?? "../../data/external/thl/finres.json"),
};
// Each browser has its own projects: an anonymous id in a cookie (no login), its projects in their own folder under
// the state directory, or in memory without one. Projects made before this, in <state>/projects, are no longer listed.
const VISITOR_COOKIE = "aei_visitor";
const memoryStores = new Map<string, ReturnType<typeof createProjectStore>>();
function visitorStore(visitor: string) {
  if (config.stateDir) return createProjectStore(join(config.stateDir, "visitors", visitor));
  const store = memoryStores.get(visitor) ?? createProjectStore();
  memoryStores.set(visitor, store);
  return store;
}
/** The request's visitor id from its cookie, or a new one, set on the response so the browser keeps it a year. */
function visitorOf(req: IncomingMessage, res: ServerResponse): string {
  const found = /(?:^|;\s*)aei_visitor=([a-f0-9]{32})(?:;|$)/.exec(req.headers.cookie ?? "")?.[1];
  if (found) return found;
  const id = randomBytes(16).toString("hex");
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("set-cookie", `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${secure}`);
  return id;
}
const codeMaps: CodeMaps = config.codeMapFile
  ? extendCodeMaps(JSON.parse(readFileSync(resolve(config.codeMapFile), "utf8")) as Partial<CodeMaps>)
  : DEFAULT_CODE_MAPS;
const registry = openSites();
const feeds = createFeedLog();

/** The sites file, or stop with every problem listed (D-051). */
function openSites() {
  try {
    const loaded = loadSites(config.sitesFile, { homeMaps: codeMaps, homeGuideline: config.guideline });
    for (const note of loaded.notes) console.warn(`[aei-api] ${note}`);
    registerWards(loaded.registry.wards);
    registerSites(loaded.registry.sites);
    if (config.sitesFile) console.log(`[aei-api] sites: ${loaded.registry.sites.map((s) => s.id).join(", ")}`);
    return loaded.registry;
  } catch (error) {
    if (error instanceof SitesFileError) console.error(`[aei-api] AEI_SITES=${config.sitesFile}: ${error.message}`);
    // Stop with the message alone; under the test runner, throw so the test sees it.
    if (error instanceof SitesFileError && !env.VITEST) process.exit(1);
    throw error;
  }
}

/** The coverage query's unit: with `site`, a bare code is that site's unit ("ICU" at sata is "sata/ICU"). */
function coverageWard(url: URL): string | null {
  const ward = url.searchParams.get("ward");
  const site = url.searchParams.get("site");
  if (!ward || !site) return ward;
  return registry.site(site) ? qualifyWard(site, ward, registry.home.id) : null;
}

/** A `site` query parameter: absent, or a registered site; anything else is a 400. */
function siteParam(url: URL): { site?: string; error?: string } {
  const site = url.searchParams.get("site");
  if (!site) return {};
  return registry.site(site) ? { site } : { error: `unknown site ${site}` };
}

console.log(`[aei-api] loading ${config.dataDir}`);
const full = await loadDataset(config.dataDir);
const fullDates = full.cultures.map((c) => c.sampleDate).sort();
const datasetStart = fullDates[0] ?? "";
const datasetEnd = fullDates.at(-1) ?? "";
let dataset: Dataset = config.loadUntil ? until(full, config.loadUntil) : full;

function until(d: Dataset, date: string): Dataset {
  const cultures = d.cultures.filter((c) => c.sampleDate <= date);
  const keep = new Set(cultures.map((c) => c.cultureId));
  const isolates = d.isolates.filter((i) => keep.has(i.cultureId));
  const ids = new Set(isolates.map((i) => i.isolateId));
  return { patients: d.patients, cultures, isolates, susceptibility: d.susceptibility.filter((s) => ids.has(s.isolateId)) };
}

// Everything derived from the data, rebuilt when results are ingested. Relation layers and
// alerts depend only on earlier samples, so they are computed over all data and cut to the
// window up to the clock. A result "arrives" on its culture's sample date (D-005).
function derive(d: Dataset) {
  const records = joinIsolates(d);
  const trails = phenotypeTrails(d.cultures, records);
  return {
    records,
    released: createReleaseIndex(records, (r) => r.sampleDate),
    moves: patientMoves(d.cultures),
    trails,
    alerts: createReleaseIndex(buildAlerts(records, d.cultures, registry.wards), (a) => a.date),
  };
}
let state = derive(dataset);
const weeklyCache = new Map<string, WeeklySeries>();
const DEFAULT_RELATION_DAYS = 28;

function relations(asOf: string, days: number, site?: string): RelationsResponse {
  const window = { from: addDays(asOf, 1 - days), to: asOf };
  // Flow and trails are global, so a move between hospitals is a flow; a site sees those touching its units (D-051).
  const flows = countFlows(state.moves, window);
  const links = trailLinks(state.trails, window);
  if (!site) return { asOf, ...window, flows, links };
  return { asOf, ...window, flows: touchingSite(flows, site, registry.siteOfWard), links: touchingSite(links, site, registry.siteOfWard) };
}

const clock = createReplayClock({
  start: datasetStart,
  end: datasetEnd,
  asOf: config.loadUntil ?? config.startAt,
  tickMs: config.tickMs,
  daysPerTick: config.daysPerTick,
});

// The static part of Meta; `ai` and `aiStatus` are added per request from the live status.
const meta: Omit<Meta, "ai" | "aiStatus"> = {
  datasetStart,
  datasetEnd,
  wards: registry.wards,
  antibiotics: ANTIBIOTICS,
  organisms: ORGANISMS,
  specimens: SPECIMENS,
  sites: registry.sites,
};

const streams = new Set<ServerResponse>();
function broadcast(event: LiveEvent) {
  const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of streams) res.write(frame);
}

clock.subscribe((now, previous) => {
  if (now.asOf > previous) {
    broadcast({ type: "arrivals", from: previous, to: now.asOf, records: state.released.between(previous, now.asOf) });
    const fresh = state.alerts.between(previous, now.asOf);
    if (fresh.length) broadcast({ type: "alerts", from: previous, to: now.asOf, alerts: sortAlerts(fresh) });
    broadcast({ type: "clock", clock: now });
  } else if (now.asOf < previous) broadcast({ type: "reset", clock: now });
  else broadcast({ type: "clock", clock: now });
});

function matches(r: IsolateRecord, q: IsolateQuery): boolean {
  return (
    (!q.from || r.sampleDate >= q.from) &&
    (!q.to || r.sampleDate <= q.to) &&
    (!q.ward || r.ward === q.ward) &&
    (!q.specimen || r.specimen === q.specimen) &&
    (!q.organism || r.organism === q.organism) &&
    (!q.sex || r.sex === q.sex) &&
    (q.ageMin === undefined || r.ageYears >= q.ageMin) &&
    (q.ageMax === undefined || r.ageYears <= q.ageMax) &&
    (!q.site || registry.siteOfWard(r.ward) === q.site)
  );
}

/** Frozen cuts do not seek the shared clock (D-058); site uses the same predicate as /api/isolates. */
function projectFingerprint(input: ProjectInput) {
  return fingerprintRows(
    state.released
      .upTo(input.asOf as string)
      .filter((r) => matches(r, { site: input.scope.site }) && matchesScope(r, input.scope, input.asOf)),
  );
}

const litePackages = new Map<string, { key: string; files: ReturnType<typeof packageFiles> }>();

/** One package per saved project and replay date; ingestion invalidates corrected rows too. */
function liteFiles(project: Project) {
  const date = clock.state().asOf;
  const key = JSON.stringify([project.id, project.updatedAt, date]);
  const cached = litePackages.get(project.id);
  if (cached?.key === key) return cached.files;
  const asOf = project.mode === "frozen" && project.asOf && project.asOf < date ? project.asOf : date;
  const files = packageFiles(
    projectBundle({
      project,
      clock: date,
      records: state.released.upTo(asOf).filter((record) => matches(record, { site: project.scope.site })),
      alerts: state.alerts
        .upTo(asOf)
        .filter((alert) => !project.scope.site || alertSite(alert, registry.siteOfWard) === project.scope.site),
      antibiotics: ANTIBIOTICS.map((antibiotic) => antibiotic.code),
      labels: {
        isolates: t("en", "exportIsolates"),
        patients: t("en", "exportPatients"),
        alerts: t("en", "exportAlerts"),
        isolateMethod: t("en", "exportIsolateMethod"),
        patientMethod: t("en", "exportPatientMethod"),
        alertMethod: t("en", "exportAlertMethod"),
        frozenNote: t("en", "exportFrozenNote"),
      },
    }),
    { target: "lite" },
  );
  litePackages.set(project.id, { key, files });
  return files;
}

function liteMime(path: string): string {
  if (path.endsWith(".ipynb")) return "application/x-ipynb+json";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".csv")) return "text/csv";
  if (path.endsWith(".md")) return "text/markdown";
  if (path.endsWith(".py")) return "text/x-python";
  return "text/x-r-source";
}

/** Jupyter Server contents model, as emitted by the static JupyterLite build. */
function liteModel(path: string, created: string, modified: string, file?: { path: string; data: string | Uint8Array }) {
  return {
    name: path.split("/").at(-1) ?? "",
    path,
    type: file ? (path.endsWith(".ipynb") ? "notebook" : "file") : "directory",
    format: null,
    mimetype: file ? liteMime(path) : null,
    size: file ? Buffer.byteLength(file.data) : null,
    created,
    last_modified: modified,
    writable: true,
    hash: null,
    hash_algorithm: null,
    content: null,
  };
}

/** Every site with its units, rows up to the clock and feed status (D-051). */
function sites(): SitesResponse {
  const asOf = clock.state().asOf;
  const released = state.released.upTo(asOf);
  return {
    asOf,
    sites: registry.sites.map((s) => {
      const cultures = dataset.cultures.filter((c) => c.sampleDate <= asOf && registry.siteOfWard(c.ward) === s.id);
      const feed = feeds.status(s.id);
      return {
        ...s,
        home: s.id === registry.home.id,
        wards: registry.wardsOf(s.id).map((w) => w.code),
        status: s.id === registry.home.id ? "home" : feed.messages > 0 ? "connected" : "awaiting",
        counts: {
          cultures: cultures.length,
          isolates: released.filter((r) => registry.siteOfWard(r.ward) === s.id).length,
          patients: new Set(cultures.map((c) => c.patientId)).size,
        },
        feed,
      };
    }),
  };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

// A body built once and kept in a cache. no-store: the replay clock moves, so no browser or proxy may keep it.
function sendCached(res: ServerResponse, body: string) {
  res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(body);
}

async function readText(req: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  return JSON.parse((await readText(req)) || "{}");
}

/**
 * Lab results from a laboratory system (D-035): HL7 v2 ORU^R01, a FHIR R4 Bundle
 * or a flat isolate export, detected from the content type or the payload. A
 * culture sent again replaces the earlier one (a corrected or final report).
 * New results are pushed to open clients; if they are dated after the clock, the
 * clock moves to them, as a live feed would.
 */
function ingestPayload(body: string, contentType: string, from: ConnectedSite = registry.connection(registry.home.id) as ConnectedSite) {
  const format = detectFormat(body, contentType);
  if (!format) {
    feeds.record(from.site.id, { format: null, accepted: 0, warnings: 0, unregistered: 0 });
    return { status: 415, body: { error: "unknown format: send HL7 v2 (MSH...), a FHIR Bundle (JSON) or CSV" } };
  }
  // The sending site's codes and guideline; its units are qualified right after parsing (D-051).
  const { result, unregistered } = qualifyResult(
    ingest(body, format, { maps: from.maps, guideline: from.guideline }),
    from,
    registry.home.id,
  );
  feeds.record(from.site.id, {
    format,
    accepted: result.cultures.length,
    warnings: result.warnings.length,
    unregistered: unregistered.length,
  });
  // Plausibility checks on what arrived (D-038): reported with the response, rows kept as sent.
  const quality: Finding[] = checkRows(result, { asOf: new Date().toISOString().slice(0, 10), wards: registry.wards });
  if (!result.cultures.length) return { status: 422, body: { format, accepted: 0, warnings: result.warnings, quality } };
  const before = new Set(state.alerts.upTo(datasetEnd).map((a) => a.id));
  dataset = mergeResults(asResult(dataset), result);
  state = derive(dataset);
  coverages.clear();
  alertsCache.clear();
  regionalCache.clear();
  countiesBody = undefined;
  failsTogethers.clear();
  qualityCache.clear();
  litePackages.clear();
  const ids = new Set(result.cultures.map((c) => c.cultureId));
  const arrived = state.records.filter((r) => ids.has(r.cultureId));
  const latest =
    result.cultures
      .map((c) => c.sampleDate)
      .sort()
      .at(-1) ?? "";
  const asOf = clock.state().asOf;
  if (latest > asOf) {
    clock.seek(latest < datasetEnd ? latest : datasetEnd); // the subscription pushes arrivals and alerts
  } else {
    broadcast({ type: "arrivals", from: asOf, to: asOf, records: arrived });
    const fresh = state.alerts.upTo(asOf).filter((a) => !before.has(a.id));
    if (fresh.length) broadcast({ type: "alerts", from: asOf, to: asOf, alerts: sortAlerts(fresh) });
  }
  const newAlerts = state.alerts.upTo(clock.state().asOf).filter((a) => !before.has(a.id));
  return {
    status: 200,
    body: {
      format,
      site: from.site.id,
      accepted: result.cultures.length,
      isolates: result.isolates.length,
      results: result.susceptibility.length,
      asOf: clock.state().asOf,
      newAlerts: newAlerts.map((a) => a.id),
      warnings: result.warnings,
      quality,
    },
  };
}

const qualityCache = new Map<string, QualityResponse>();

/** The plausibility checks over one site's rows (D-038, D-051), computed once per change of the data. */
function quality(site: string = registry.home.id): QualityResponse {
  let cached = qualityCache.get(site);
  if (!cached) {
    const rows = registry.sites.length > 1 ? rowsOfSite(dataset, site, registry.siteOfWard) : dataset;
    cached = {
      checked: {
        patients: rows.patients.length,
        cultures: rows.cultures.length,
        isolates: rows.isolates.length,
        results: rows.susceptibility.length,
      },
      summary: summarize(checkRows(rows, { wards: registry.wards })),
    };
    qualityCache.set(site, cached);
  }
  return cached;
}

function runCommand(command: ClockCommand) {
  switch (command.action) {
    case "play":
      return clock.play();
    case "pause":
      return clock.pause();
    case "step":
      return clock.step(command.days);
    case "seek":
      return clock.seek(command.date);
    case "configure":
      return clock.configure(command);
    default:
      throw new Error(`unknown action ${(command as { action: string }).action}`);
  }
}

export const server = createServer(async (req, res) => {
  // The web dev server proxies /api, so CORS is only for other local clients.
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type, authorization");
  res.setHeader("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return void res.writeHead(204).end();

  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (url.pathname.startsWith("/api/lite/")) {
      if (req.method !== "GET") return send(res, 405, { error: "method not allowed" });
      const projects = visitorStore(visitorOf(req, res));
      if (url.pathname === "/api/lite/contents/projects/all.json") {
        const all = projects.list();
        const timestamp = new Date().toISOString();
        return send(res, 200, {
          ...liteModel("projects", timestamp, timestamp),
          format: "json",
          content: all.map((project) => liteModel(`projects/${project.id}`, project.createdAt, project.updatedAt)),
        });
      }
      const contents = /^\/api\/lite\/contents\/projects\/([^/]+)\/all\.json$/.exec(url.pathname);
      const download = /^\/api\/lite\/files\/projects\/([^/]+)\/([^/]+)$/.exec(url.pathname);
      const match = contents ?? download;
      if (!match || !isProjectId(match[1])) return send(res, 404, { error: "unknown project path" });
      const project = projects.get(match[1]);
      if (!project) return send(res, 404, { error: "unknown project" });
      const files = liteFiles(project);
      const path = `projects/${project.id}`;
      if (contents) {
        return send(res, 200, {
          ...liteModel(path, project.createdAt, project.updatedAt),
          format: "json",
          content: files.map((file) => liteModel(`${path}/${file.path}`, project.createdAt, project.updatedAt, file)),
        });
      }
      const file = files.find((file) => file.path === download?.[2]);
      if (!file) return send(res, 404, { error: "unknown project file" });
      res.writeHead(200, { "content-type": liteMime(file.path), "content-length": Buffer.byteLength(file.data) });
      return void res.end(file.data);
    }
    if (url.pathname === ROUTES.projects || url.pathname.startsWith(`${ROUTES.projects}/`)) {
      const projects = visitorStore(visitorOf(req, res));
      const id = url.pathname === ROUTES.projects ? undefined : decodeURIComponent(url.pathname.slice(ROUTES.projects.length + 1));
      if (id !== undefined && !isProjectId(id)) return send(res, 400, { error: "invalid project id" });
      if (id === undefined && req.method === "GET") return send(res, 200, { projects: projects.list() });
      const previous = id === undefined ? undefined : projects.get(id);
      if (id !== undefined && !previous) return send(res, 404, { error: "unknown project" });
      if (previous && req.method === "GET") {
        const fingerprint = previous.mode === "frozen" ? projectFingerprint(previous) : undefined;
        const drift =
          fingerprint && (fingerprint.rows !== previous.fingerprint?.rows || fingerprint.sha256 !== previous.fingerprint?.sha256);
        return send(res, 200, { project: previous, ...(fingerprint ? { drift } : {}) });
      }
      if (previous && req.method === "DELETE") {
        projects.delete(previous.id);
        litePackages.delete(previous.id);
        return void res.writeHead(204).end();
      }
      if ((id === undefined && req.method === "POST") || (previous && req.method === "PUT")) {
        const input = parseProjectInput(await readJson(req));
        // Rows after the replay clock are not released yet (D-058 cuts the live data, it does not see ahead).
        if (input.asOf !== undefined && input.asOf > clock.state().asOf) {
          return send(res, 400, { error: `asOf ${input.asOf} is after the replay clock ${clock.state().asOf}` });
        }
        if (input.scope.site !== undefined && !registry.site(input.scope.site)) {
          return send(res, 400, { error: `unknown site ${input.scope.site}` });
        }
        const timestamp = new Date().toISOString();
        const fingerprint =
          input.mode === "frozen"
            ? previous?.mode === "frozen" && previous.asOf === input.asOf && JSON.stringify(previous.scope) === JSON.stringify(input.scope)
              ? previous.fingerprint
              : projectFingerprint(input)
            : undefined;
        const project: Project = {
          ...input,
          id: previous?.id ?? newProjectId(input.name),
          description: input.description ?? "",
          createdAt: previous?.createdAt ?? timestamp,
          updatedAt: timestamp,
          ...(fingerprint ? { fingerprint } : {}),
        };
        projects.put(project);
        litePackages.delete(project.id);
        return send(res, previous ? 200 : 201, { project });
      }
      return send(res, 405, { error: "method not allowed" });
    }
    if (url.pathname === ROUTES.ask && req.method === "POST") {
      if (!llm) return send(res, 503, { error: "AI is not configured" });
      const body = (await readJson(req)) as { text?: unknown; lang?: unknown } | null;
      if (!body || typeof body.text !== "string" || !body.text.trim() || (body.lang !== "en" && body.lang !== "fi")) {
        return send(res, 400, { error: "text and lang (en or fi) are required" });
      }
      const asOf = clock.state().asOf;
      const parsed = await parseQuestion(llm, {
        text: body.text,
        asOf,
        vocabulary: {
          wards: meta.wards.map(({ code, en, fi }) => ({ code, en, fi })),
          organisms: [...meta.organisms],
          specimens: [...meta.specimens],
        },
      }).catch(async (error: unknown) => {
        // Probe again before answering, so the client's next read of /api/meta is current.
        if (error instanceof LlmError) await ai.report(false);
        throw error;
      });
      void ai.report(true);
      return send(res, 200, { asOf, ...parsed });
    }
    if (url.pathname === ROUTES.explain && req.method === "GET") {
      const id = url.searchParams.get("id");
      const lang = url.searchParams.get("lang");
      if (lang !== "en" && lang !== "fi") return send(res, 400, { error: "lang must be en or fi" });
      // The template by default: small models write unreliable Finnish (experiments/0003, D-029).
      const wording = url.searchParams.get("wording") ?? "template";
      if (wording !== "template" && wording !== "model") return send(res, 400, { error: "wording must be template or model" });
      const alert = state.alerts.upTo(clock.state().asOf).find((a) => a.id === id);
      if (!alert) return send(res, 404, { error: "unknown alert" });
      const key = `${alert.id}:${lang}:${wording}`;
      let explanation = explanations.get(key);
      if (!explanation) {
        const input = alertExplainInput(alert, lang, {
          ward: (code) => wardName(lang, code),
          phenotype: phenotypeName,
          organism: (name) => name,
          specimen: (code) => specimenName(lang, code),
          antibiotic: (code) => antibioticName(lang, code),
        });
        const result =
          llm && wording === "model"
            ? await explainAlert(llm, input)
            : { text: fillSlots(input.fallback, input.facts, lang), source: "template" as const };
        explanation = { id: alert.id, ...result };
        explanations.set(key, explanation);
      }
      return send(res, 200, explanation);
    }
    if (url.pathname === ROUTES.coverage) {
      const ward = coverageWard(url);
      const specimen = url.searchParams.get("specimen");
      const sex = url.searchParams.get("sex");
      const ageGroup = url.searchParams.get("ageGroup");
      const onset = url.searchParams.get("onset");
      const windowDays = url.searchParams.get("windowDays");
      const severity = url.searchParams.get("severity") ?? "mild";
      if (severity !== "mild" && severity !== "severe") return send(res, 400, { error: "severity must be mild or severe" });
      if (!meta.wards.some((w) => w.code === ward)) return send(res, 400, { error: "ward is required and must be a ward code" });
      if (!meta.specimens.some((x) => x.code === specimen)) return send(res, 400, { error: "specimen is required" });
      if (sex !== null && sex !== "F" && sex !== "M") return send(res, 400, { error: "sex must be F or M" });
      if (ageGroup !== null && !isAgeGroup(ageGroup))
        return send(res, 400, { error: `ageGroup must be one of ${Object.keys(AGE_GROUPS).join(", ")}` });
      if (onset !== null && !ONSETS.includes(onset as Onset)) return send(res, 400, { error: "onset must be hospital, community or any" });
      const days = windowDays === null ? undefined : Number(windowDays);
      if (days !== undefined && (!Number.isInteger(days) || days < 1))
        return send(res, 400, { error: "windowDays must be a positive integer" });
      const asOf = clock.state().asOf;
      // Only released records, so nothing after the replay date leaks in.
      const key = JSON.stringify([asOf, ward, specimen, sex, ageGroup, onset, days]);
      let result = coverages.get(key);
      if (!result) {
        if (coverages.size > 500) coverages.clear();
        result = coverage(
          state.released.upTo(asOf),
          {
            asOf,
            ward: ward as WardCode,
            specimen: specimen as Specimen,
            ...(sex ? { sex } : {}),
            ...(ageGroup ? { ageGroup } : {}),
            ...(onset ? { onset } : {}),
            ...(days ? { windowDays: days } : {}),
            onset: onset as Onset,
          },
          registry.wards,
        );
        coverages.set(key, result);
      }
      return send(res, 200, {
        asOf,
        severity,
        bar: barFor(result.query, severity),
        coverage: result,
        suggestions: suggest(result, severity),
        combinationSuggestions: suggestCombinations(result, severity),
      });
    }
    if (url.pathname === ROUTES.patientFindings) {
      const id = url.searchParams.get("id")?.trim();
      if (!id) return send(res, 400, { error: "id is required" });
      const asOf = clock.state().asOf;
      // Only released records, so nothing after the replay date leaks in (D-050).
      const findings = patientFindings(state.released.upTo(asOf), id, asOf);
      const affects: Partial<Record<Phenotype, AntibioticCode[]>> = {};
      for (const f of findings) affects[f.phenotype] ??= defeatedBy(f.phenotype);
      return send(res, 200, { asOf, patientId: id, findings, affects } satisfies PatientFindingsResponse);
    }
    if (url.pathname === ROUTES.failsTogether) {
      const parsed = parseFailsQuery(
        url.searchParams,
        meta.wards.map((w) => w.code),
        meta.specimens.map((x) => x.code),
      );
      if (!parsed.ok) return send(res, 400, { error: parsed.error });
      const asOf = clock.state().asOf;
      // Only released records, so nothing after the replay date leaks in.
      const key = failsKey(asOf, parsed.query);
      let result = failsTogethers.get(key);
      if (!result) {
        if (failsTogethers.size > 500) failsTogethers.clear();
        // Within the unit's own hospital (D-051).
        const site = registry.siteOfWard(parsed.query.ward);
        const own = state.released.upTo(asOf).filter((r) => registry.siteOfWard(r.ward) === site);
        result = failsTogetherHandle({ asOf, ...parsed.query }, own);
        failsTogethers.set(key, result);
      }
      return send(res, 200, result);
    }
    if (url.pathname === ROUTES.ingest && req.method === "POST") {
      // The token names the sending site (D-051); no token is the home site unless it has one.
      const auth = authorize(registry, req.headers.authorization);
      if (!auth.ok) return send(res, auth.status, { error: auth.error });
      const out = ingestPayload(await readText(req), req.headers["content-type"] ?? "", auth.site);
      return send(res, out.status, out.body);
    }
    if (url.pathname === ROUTES.sites) return send(res, 200, sites());
    if (url.pathname === ROUTES.quality) {
      const { site, error } = siteParam(url);
      return error ? send(res, 400, { error }) : send(res, 200, quality(site));
    }
    if (url.pathname === ROUTES.regional) {
      if (!existsSync(config.regionalFile))
        return send(res, 404, { error: "No regional data; run `uv run python scripts/fetch_thl_ttr.py`" });
      const query: RegionalQuery = { group: url.searchParams.get("group") ?? "", region: url.searchParams.get("region") ?? "" };
      const asOf = clock.state().asOf;
      const key = JSON.stringify([asOf, query.group, query.region]);
      let body = regionalCache.get(key);
      if (body === undefined) {
        if (regionalCache.size > 200) regionalCache.clear();
        const data = JSON.parse(readFileSync(config.regionalFile, "utf8")) as RegionalData;
        body = JSON.stringify(regionalUpTo(data, asOf, query));
        regionalCache.set(key, body);
      }
      return sendCached(res, body);
    }
    if (url.pathname === ROUTES.national) {
      if (!existsSync(config.nationalFile))
        return send(res, 404, { error: "No national data; run `uv run python scripts/fetch_finres.py`" });
      return send(res, 200, JSON.parse(readFileSync(config.nationalFile, "utf8")) as NationalResponse);
    }
    if (url.pathname === ROUTES.weekly) {
      const asOf = clock.state().asOf;
      const from = url.searchParams.get("from") || datasetStart;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return send(res, 400, { error: "from must be YYYY-MM-DD" });
      const { site = registry.home.id, error } = siteParam(url);
      if (error) return send(res, 400, { error });
      const key = `${asOf}|${from}|${site}`;
      let series = weeklyCache.get(key);
      if (!series) {
        if (weeklyCache.size > 50) weeklyCache.clear();
        // Only released rows: the series ends at the clock and never shows later days.
        // One site's units and rows (D-051); with the home site alone, every row as before.
        const own = registry.sites.length > 1;
        const records = state.released.upTo(asOf).filter((r) => !own || registry.siteOfWard(r.ward) === site);
        const cultures = own ? dataset.cultures.filter((c) => registry.siteOfWard(c.ward) === site) : dataset.cultures;
        series = weeklySeries(records, cultures, from, asOf, registry.wardsOf(site));
        weeklyCache.set(key, series);
      }
      return send(res, 200, { asOf, ...series });
    }
    if (url.pathname === ROUTES.counties) {
      if (!existsSync(config.countiesFile))
        return send(res, 404, { error: "No county geometry; run `uv run python scripts/fetch_county_geometry.py`" });
      countiesBody ??= JSON.stringify(JSON.parse(readFileSync(config.countiesFile, "utf8")));
      return sendCached(res, countiesBody);
    }
    if (url.pathname === ROUTES.meta) {
      // Waits for the first probe only, so the first answer after a start is already honest.
      const aiStatus = await ai.settled().then(() => ai.status());
      return send(res, 200, { ...meta, ai: aiStatus === "ready", aiStatus } satisfies Meta);
    }
    if (url.pathname === ROUTES.clock && req.method === "GET") return send(res, 200, clock.state());
    if (url.pathname === ROUTES.clock && req.method === "POST") {
      runCommand((await readJson(req)) as ClockCommand);
      return send(res, 200, clock.state());
    }
    if (url.pathname === ROUTES.isolates) {
      const q = Object.fromEntries(url.searchParams) as IsolateQuery;
      for (const key of ["ageMin", "ageMax"] as const) {
        if (url.searchParams.has(key)) {
          const value = Number(url.searchParams.get(key));
          if (!Number.isInteger(value) || value < 0 || value > 120)
            return send(res, 400, { error: `${key} must be an integer from 0 to 120` });
          q[key] = value;
        }
      }
      if (siteParam(url).error) return send(res, 400, { error: siteParam(url).error });
      const asOf = clock.state().asOf;
      const to = q.to && q.to < asOf ? q.to : asOf;
      return send(res, 200, { asOf, records: state.released.upTo(to).filter((r) => matches(r, { ...q, to })) });
    }
    if (url.pathname === ROUTES.relations) {
      const days = Number(url.searchParams.get("days") ?? DEFAULT_RELATION_DAYS);
      if (!Number.isInteger(days) || days < 1) return send(res, 400, { error: "days must be a positive integer" });
      const { site, error } = siteParam(url);
      if (error) return send(res, 400, { error });
      return send(res, 200, relations(clock.state().asOf, days, site));
    }
    if (url.pathname === ROUTES.alerts) {
      const asOf = clock.state().asOf;
      const from = url.searchParams.get("from") ?? "";
      const { site, error } = siteParam(url);
      if (error) return send(res, 400, { error });
      const key = `${asOf}|${from}|${site ?? ""}`;
      let body = alertsCache.get(key);
      if (body === undefined) {
        if (alertsCache.size > 50) alertsCache.clear();
        const alerts = state.alerts.upTo(asOf).filter((a) => a.date >= from && (!site || alertSite(a, registry.siteOfWard) === site));
        body = JSON.stringify({ asOf, alerts: sortAlerts(alerts) });
        alertsCache.set(key, body);
      }
      return sendCached(res, body);
    }
    if (url.pathname === ROUTES.live) {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`event: clock\ndata: ${JSON.stringify({ type: "clock", clock: clock.state() })}\n\n`);
      streams.add(res);
      req.on("close", () => streams.delete(res));
      return;
    }
    send(res, 404, { error: `no route ${url.pathname}` });
  } catch (error) {
    send(res, error instanceof LlmError ? 502 : 400, { error: error instanceof LlmError ? "The assistant is unavailable" : String(error) });
  }
});

// Stop promptly on SIGTERM and SIGINT: in a container Node runs as PID 1, which ignores signals it has no handler for.
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    server.closeAllConnections();
    server.close();
    process.exit(0);
  });

server.listen(config.port, () => {
  console.log(`[aei-api] ${state.records.length} isolates, ${datasetStart} to ${datasetEnd}; replay at ${clock.state().asOf}`);
  console.log(`[aei-api] ${state.moves.length} unit moves, ${state.trails.length} carrier trails, ${state.alerts.size} alerts`);
  const findings = quality().summary.reduce((n, c) => n + c.count, 0);
  console.log(`[aei-api] data checks: ${findings ? `${findings} findings, see ${ROUTES.quality}` : "every check passed"}`);
  console.log(`[aei-api] http://localhost:${config.port}${ROUTES.meta}`);
});
