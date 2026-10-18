import type { Alert, PatientFinding } from "@aei/alerts";
import type { AgeGroup, AiStatus } from "@aei/ask";
import type { FailsTogetherResponse, FailsTogetherRouteQuery } from "@aei/coresistance/route";
import type { CombinationSuggestion, CoverageResult, CoverageQuery as GearCoverageQuery, Severity, Suggestion } from "@aei/coverage";
import type {
  Antibiotic,
  AntibioticCode,
  IsoDate,
  IsolateRecord,
  Organism,
  Phenotype,
  Sex,
  Site,
  SiteId,
  Specimen,
  Ward,
  WardCode,
} from "@aei/domain";
import type { Project, ProjectInput } from "@aei/projects";
import type { CheckSummary, Finding } from "@aei/quality";
import type { Flow, TrailLink } from "@aei/relations";
import type { ClockState } from "@aei/replay";
import type { WeeklySeries } from "@aei/viz";

export type { Project, ProjectInput, ProjectScope } from "@aei/projects";

export interface ProjectsResponse {
  projects: Project[];
}

export interface ProjectResponse {
  project: Project;
  drift?: boolean;
}

// The contract between the AEI server and its clients (web, later the
// phone app). The current server is apps/api in TypeScript; a Rust server
// can replace it by serving the same routes and events (DECISIONS.md D-006).

export const ROUTES = {
  /** Server-stored research scopes, continuous or frozen (D-057, D-058). */
  projects: "/api/projects",
  ask: "/api/ask",
  explain: "/api/explain",
  coverage: "/api/coverage",
  meta: "/api/meta",
  clock: "/api/clock",
  isolates: "/api/isolates",
  relations: "/api/relations",
  alerts: "/api/alerts",
  live: "/api/live",
  /** Lab results from a laboratory system: HL7 v2 ORU^R01, a FHIR R4 Bundle or CSV (D-035). */
  ingest: "/api/ingest",
  /** THL county series of MRSA, ESBL, VRE and CPE and their regional signals (D-025, D-037). */
  regional: "/api/regional",
  /**
   * Wellbeing services county polygons (Statistics Finland, CC BY 4.0) for the regional map, as
   * GeoJSON. Optional: 404 when the server has no geometry file. Proposed by Claude Code, pending Artem (D-043).
   */
  counties: "/api/counties",
  /**
   * Raw weekly counts per unit up to the clock: distinct patients per resistant phenotype and
   * cultures sampled (D-042). Optional; proposed by Claude Code, pending Artem.
   */
  weekly: "/api/weekly",
  /** Plausibility checks over the rows the server holds (D-038). */
  quality: "/api/quality",
  /** The hospitals connected to this server, each with its units, counts and feed status (D-051). */
  sites: "/api/sites",
  /** National reference per genus, antibiotic and specimen from THL's Finres cube (D-048); 404 without the file. */
  national: "/api/national",
  /** A patient's ESBL, MRSA, VRE and CPE findings of the year before the replay date (D-050). */
  patientFindings: "/api/patient/findings",
  /** Antibiotics that fail together, from the hospital's own first isolates (D-054). */
  failsTogether: "/api/fails-together",
} as const;

export interface Meta {
  /** The assistant can answer now: a model is configured and its server answered the last probe (D-049). */
  ai: boolean;
  /** "off": no model configured; "offline": configured but not answering; "ready": as `ai`. Optional for older servers. */
  aiStatus?: AiStatus;
  datasetStart: IsoDate;
  datasetEnd: IsoDate;
  wards: readonly Ward[];
  antibiotics: readonly Antibiotic[];
  organisms: readonly Organism[];
  specimens: readonly { code: Specimen; en: string; fi: string }[];
  /** Every site, home first; each `wards` entry names its site (D-051). Absent from servers older than D-051. */
  sites?: readonly Site[];
}

/** One site's feed of lab messages since the server started (wall-clock time, not the replay clock). */
export interface SiteFeed {
  /** Messages received on POST /api/ingest under this site, accepted or not. */
  messages: number;
  /** When the last message arrived, ISO 8601 wall-clock; null before the first. */
  lastAt: string | null;
  lastFormat: "hl7v2" | "fhir" | "csv" | null;
  /** Cultures accepted from the last message. */
  lastAccepted: number;
  /** Warnings over every message, including units the site did not register. */
  warnings: number;
  /** Cultures kept with a unit the site did not register. */
  unregistered: number;
  /** Messages refused (unknown format, nothing usable). */
  rejected: number;
}

export interface SiteStatus extends Site {
  home: boolean;
  /** The site's registered units, qualified. */
  wards: WardCode[];
  /** "home": the dataset's hospital; "connected": a site that has sent at least one message; "awaiting": none yet. */
  status: "home" | "connected" | "awaiting";
  /** Rows of the site up to the clock. */
  counts: { cultures: number; isolates: number; patients: number };
  feed: SiteFeed;
}

/** What POST /api/ingest answers (D-035, D-051): 200 with what was accepted, 422 with nothing usable, 401 or 415 with an error. */
export interface IngestResponse {
  format?: "hl7v2" | "fhir" | "csv";
  /** The site the token named (D-051). */
  site?: SiteId;
  accepted?: number;
  isolates?: number;
  results?: number;
  /** The clock after the results arrived; it moves forward to results dated after it. */
  asOf?: IsoDate;
  newAlerts?: string[];
  warnings?: string[];
  quality?: Finding[];
  error?: string;
}

export interface SitesResponse {
  asOf: IsoDate;
  sites: SiteStatus[];
}

export type { ClockState } from "@aei/replay";

export type ClockCommand =
  | { action: "play" }
  | { action: "pause" }
  | { action: "step"; days?: number }
  | { action: "seek"; date: IsoDate }
  | { action: "configure"; tickMs?: number; daysPerTick?: number };

/** Filters on released isolates. Omitted fields do not filter. */
export interface IsolateQuery {
  from?: IsoDate;
  to?: IsoDate;
  ward?: WardCode;
  specimen?: Specimen;
  organism?: Organism;
  sex?: Sex;
  ageMin?: number;
  ageMax?: number;
  /** Only this site's units (D-051). */
  site?: SiteId;
}

export type { AntibioticCoverage, CombinationSuggestion, Counts, CoverageResult, Level, Onset, Severity, Suggestion } from "@aei/coverage";
/**
 * The bar each severity is judged against (D-026, D-027), so clients label it from the same source;
 * `barFor` gives the one a query uses (hospital onset: 90 % whatever the severity, D-049).
 */
export { barFor, ONSETS, THRESHOLDS } from "@aei/coverage";

/**
 * The doctor's coverage list (D-023). The server sets the as-of date from its clock unless `asOf` asks for an
 * earlier day; `level` forces the level (D-082) and never widens.
 */
export type CoverageQuery = Omit<GearCoverageQuery, "asOf" | "minTested"> & {
  /** Describe the window ending this day instead of the replay date (D-082); never after the clock's date (400). */
  asOf?: IsoDate;
  /** How suggestions are judged (D-026, D-027); "mild" when omitted. */
  severity?: Severity;
  /** The site `ward` belongs to; a bare ward code is then that site's unit (D-051). */
  site?: SiteId;
};

export interface CoverageResponse {
  asOf: IsoDate;
  severity: Severity;
  /**
   * The bar the suggestions were judged against: `barFor(coverage.query, severity)` (D-049). Optional so
   * servers and fixtures from before D-049 still type; a client missing it computes `barFor` itself.
   */
  bar?: number;
  coverage: CoverageResult;
  /** Ordered: clears, borderline, below, not assessable. Decision support only. */
  suggestions: Suggestion[];
  /** Pairs, only when no single antibiotic clears (D-028). */
  combinationSuggestions: CombinationSuggestion[];
}

export type { PatientFinding } from "@aei/alerts";

/** A patient's earlier resistant findings (D-050), from released records only. */
export interface PatientFindingsResponse {
  asOf: IsoDate;
  patientId: string;
  /** ESBL, MRSA, VRE and CPE isolates sampled in the 365 days up to and including `asOf`, newest first. */
  findings: PatientFinding[];
  /** For each phenotype found, the antibiotics `@aei/eucast` infers resistant from it (empty when none). */
  affects: Partial<Record<Phenotype, AntibioticCode[]>>;
}

export interface AskResponse {
  asOf: IsoDate;
  filters: IsolateQuery;
  ageGroup?: AgeGroup;
  unmatched: string[];
}

export type ExplainWording = "template" | "model";

export interface ExplainResponse {
  id: string;
  text: string;
  source: "model" | "template";
}

export interface IsolatesResponse {
  asOf: IsoDate;
  records: IsolateRecord[];
}

export type { Alert, CarrierAlert, CpeAlert } from "@aei/alerts";
export type { Flow, TrailLink } from "@aei/relations";

/** Relation layers for the `days` days up to the clock's as-of date (D-011 to D-013). */
export interface RelationsQuery {
  days?: number;
  /** Only flows and links that touch this site's units: moves within it and to or from it (D-051). */
  site?: SiteId;
}

export interface RelationsResponse {
  asOf: IsoDate;
  /** The window, inclusive. */
  from: IsoDate;
  to: IsoDate;
  flows: Flow[];
  links: TrailLink[];
}

/** Alerts dated from `from` (inclusive) up to the clock's as-of date. */
export interface AlertsQuery {
  from?: IsoDate;
  /** Only this site's alerts; all sites when omitted (D-051). */
  site?: SiteId;
}

export interface AlertsResponse {
  asOf: IsoDate;
  alerts: Alert[];
}

/** One county series: monthly notified cases, aligned with `RegionalResponse.months`. */
export interface RegionalSeries {
  /** THL report group, e.g. "CPE carriage, E. coli". */
  group: string;
  /** Wellbeing services county, or "Finland (all counties)". */
  region: string;
  cases: number[];
  /** Null for the national total and for months THL gives no rate. */
  incidencePer100k: (number | null)[] | null;
}

/** A month whose count is above what the county's previous 36 months predict (experiments/0008). */
export interface RegionalSignal {
  group: string;
  region: string;
  /** YYYY-MM */
  month: string;
  cases: number;
  expected: number;
  dispersion: number;
  /** P(cases or more) under the fitted model; signals below `settings.alpha`. */
  p: number;
  /** Survives a Bonferroni correction: p below familyAlpha / testedSeriesMonths. Weaker signals may be chance. */
  strong: boolean;
}

/** One-month-ahead phenotype-total predictive count, experiment 0020 R1 (D-045). VRE is omitted. */
export interface RegionalForecast {
  phenotype: "MRSA" | "ESBL" | "CPE";
  region: string;
  /** Forecast month, YYYY-MM; trained only on months before it. */
  month: string;
  mean: number;
  low: number;
  high: number;
  /** Central predictive interval probability, e.g. 0.9. */
  level: number;
}

/** The regional view: the file `scripts/fetch_thl_ttr.py` writes, cut at the clock. */
export interface RegionalData {
  source: string;
  /** When the series were fetched; THL revises the latest months. */
  fetched: IsoDate;
  settings: {
    firstTarget: string;
    baseline: number;
    alpha: number;
    minCases: number;
    familyAlpha: number;
    /** Series times months tested, the Bonferroni denominator. */
    testedSeriesMonths: number;
    /** Phenotype-total forecast settings (D-045); absent in pre-forecast files. */
    forecastMethod?: string;
  };
  /** YYYY-MM, oldest first. */
  months: string[];
  groups: string[];
  regions: string[];
  series: RegionalSeries[];
  /** Strongest first. */
  signals: RegionalSignal[];
  forecasts: RegionalForecast[];
}

/** Optional filters; omitted fields do not filter. */
export interface RegionalQuery {
  group?: string;
  region?: string;
}

/** Months that ended before the clock's as-of date only, so the replay never shows later months. */
export interface RegionalResponse extends RegionalData {
  asOf: IsoDate;
}

/**
 * The regional data as known on `asOf`: months before the as-of month, and
 * series, signals and forecasts matching the query. Group and region lists stay whole.
 * Stored forecasts are usable only immediately after the last shown month; earlier
 * replay cuts omit them rather than exposing a model trained on later counts.
 */
export function regionalUpTo(data: RegionalData, asOf: IsoDate, query: RegionalQuery = {}): RegionalResponse {
  const month = asOf.slice(0, 7);
  const n = data.months.filter((m) => m < month).length;
  const last = data.months[n - 1];
  const next = last ? new Date(`${last}-01T00:00:00Z`) : null;
  if (next) next.setUTCMonth(next.getUTCMonth() + 1);
  const forecastMonth = next?.toISOString().slice(0, 7);
  const keep = (x: { group: string; region: string }) =>
    (!query.group || x.group === query.group) && (!query.region || x.region === query.region);
  return {
    ...data,
    asOf,
    months: data.months.slice(0, n),
    series: data.series
      .filter(keep)
      .map((s) => ({ ...s, cases: s.cases.slice(0, n), incidencePer100k: s.incidencePer100k?.slice(0, n) ?? null })),
    signals: data.signals.filter((s) => keep(s) && s.month < month),
    // Older fetched files have no forecasts yet.
    forecasts: (data.forecasts ?? []).filter(
      (f) =>
        (!query.group || query.group.startsWith(`${f.phenotype} `)) &&
        (!query.region || f.region === query.region) &&
        f.month === forecastMonth,
    ),
  };
}

/** One county polygon as `scripts/fetch_county_geometry.py` writes it; `name` matches `RegionalSeries.region`. */
export interface CountyFeature {
  type: "Feature";
  id?: string | number;
  properties: { hyvinvointialue: string; nimi: string; namn?: string; name: string };
  geometry: { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
}

export interface CountiesResponse {
  type: "FeatureCollection";
  features: CountyFeature[];
}

export type { UnitWeeks, WeeklySeries } from "@aei/viz";

/** Weeks from `from` (default: the dataset start) up to the clock's as-of date, never later. */
export interface WeeklyQuery {
  from?: IsoDate;
  /** One series per unit of this site; the home site when omitted (D-051). */
  site?: SiteId;
}

export interface WeeklyResponse extends WeeklySeries {
  asOf: IsoDate;
}

export type { CheckName, CheckSummary, Finding, Severity as FindingSeverity } from "@aei/quality";

/** Which site's rows the checks summarise; the home site when omitted (D-051). */
export interface QualityQuery {
  site?: SiteId;
}

/** Every check run over every row of one site, grouped by check; no findings means every check passed. */
export interface QualityResponse {
  checked: { patients: number; cultures: number; isolates: number; results: number };
  summary: CheckSummary[];
}

/** The genera Finres reports (D-048); Finres has no species. */
export type FinresGenus = "Escherichia" | "Klebsiella" | "Staphylococcus" | "Enterococcus" | "Pseudomonas";

/** Our antibiotic codes as Finres reports them, plus its three phenotype flags; the cefoxitin screen is the MRSA flag. */
export type NationalAntibiotic = Exclude<Antibiotic["code"], "FOX"> | "ESBL" | "MRSA" | "VRE";

/** One Finres cell; null where the cube has no figure (for example tested but %R not published). */
export interface NationalCell {
  genus: FinresGenus;
  antibiotic: NationalAntibiotic;
  specimen: Specimen;
  tests: number | null;
  resistant: number | null;
  /** Percent resistant, 0 to 100. */
  pctR: number | null;
  /** 95 % interval of `pctR`, in percent. */
  interval: [number, number] | null;
}

/** The file `scripts/fetch_finres.py` writes (`aei.finres`): the latest year with figures. */
export interface NationalResponse {
  source: string;
  licence: string;
  fetched: IsoDate;
  year: number;
  cells: NationalCell[];
}

/** The dataset's species to the Finres genus (D-048, mirrors `aei.finres.SPECIES_GENUS`); others have no national line. */
export const FINRES_GENUS: Partial<Record<Organism, FinresGenus>> = {
  "Escherichia coli": "Escherichia",
  "Klebsiella pneumoniae": "Klebsiella",
  "Klebsiella oxytoca": "Klebsiella",
  "Enterococcus faecalis": "Enterococcus",
  "Staphylococcus aureus": "Staphylococcus",
  "Pseudomonas aeruginosa": "Pseudomonas",
};

/** Our specimens to the Finres spec_type labels (mirrors `aei.finres.SPECIMEN_LABELS`). */
export const FINRES_SPECIMEN: Record<Specimen, string> = {
  urine: "virtsa",
  blood: "veri",
  wound: "märkä- ja muut löydökset",
};

/** The national cell for one of our species, antibiotics (or a flag) and specimens; undefined means no national line. */
export function nationalCell(
  response: NationalResponse,
  organism: Organism,
  antibiotic: Antibiotic["code"] | NationalAntibiotic,
  specimen: Specimen,
): NationalCell | undefined {
  const genus = FINRES_GENUS[organism];
  if (!genus) return undefined;
  const code = antibiotic === "FOX" ? "MRSA" : antibiotic;
  return response.cells.find((c) => c.genus === genus && c.antibiotic === code && c.specimen === specimen);
}

/** Server-sent events on ROUTES.live. The event name is the `type`. */
export type LiveEvent =
  | { type: "clock"; clock: ClockState }
  /** Isolates that arrived when the clock moved from `from` (exclusive) to `to`. */
  | { type: "arrivals"; from: IsoDate; to: IsoDate; records: IsolateRecord[] }
  /** Alerts dated after `from` up to `to`, newest first (D-014). */
  | { type: "alerts"; from: IsoDate; to: IsoDate; alerts: Alert[] }
  /** The clock moved backwards; clients should refetch what they show. */
  | { type: "reset"; clock: ClockState };

export const LIVE_EVENT_TYPES = ["clock", "arrivals", "alerts", "reset"] as const satisfies readonly LiveEvent["type"][];

export function isolatesUrl(query: IsolateQuery): string {
  return withQuery(ROUTES.isolates, query);
}

function withQuery(path: string, query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export interface AeiClientOptions {
  /** Origin of the server, e.g. "http://localhost:8787"; "" for same origin. */
  baseUrl: string;
  fetch?: typeof fetch;
  EventSource?: typeof EventSource;
}

export interface AeiClient {
  projects(): Promise<ProjectsResponse>;
  project(id: string): Promise<ProjectResponse>;
  createProject(input: ProjectInput): Promise<ProjectResponse>;
  updateProject(id: string, input: ProjectInput): Promise<ProjectResponse>;
  deleteProject(id: string): Promise<void>;
  /** `site` limits the units the question is read against to that hospital's; the home site's when omitted (D-051). */
  ask(text: string, lang: "en" | "fi", site?: string): Promise<AskResponse>;
  /** The code's template by default; `wording: "model"` asks the AI to reword it (D-029). */
  explain(id: string, lang: "en" | "fi", wording?: ExplainWording): Promise<ExplainResponse>;
  coverage(query: CoverageQuery): Promise<CoverageResponse>;
  failsTogether(query: FailsTogetherRouteQuery): Promise<FailsTogetherResponse>;
  meta(): Promise<Meta>;
  clock(): Promise<ClockState>;
  command(command: ClockCommand): Promise<ClockState>;
  isolates(query: IsolateQuery): Promise<IsolatesResponse>;
  relations(query: RelationsQuery): Promise<RelationsResponse>;
  alerts(query: AlertsQuery): Promise<AlertsResponse>;
  /** 404 when the server has no regional file. */
  regional(query: RegionalQuery): Promise<RegionalResponse>;
  /** County polygons for the regional map; 404 when the server has no geometry file. */
  counties(): Promise<CountiesResponse>;
  /** Weekly raw counts per unit up to the clock (optional route). */
  weekly(query: WeeklyQuery): Promise<WeeklyResponse>;
  /** The checks over one site's rows; the home site's when `site` is omitted (D-051). */
  quality(query?: QualityQuery): Promise<QualityResponse>;
  /** The connected hospitals with their status (D-051). */
  sites(): Promise<SitesResponse>;
  /**
   * Sends lab results to POST /api/ingest with the sending site's token (none for the home site without one).
   * Resolves with the server's answer and its HTTP status, also for 401, 415 and 422, which carry a reason.
   */
  ingest(body: string, contentType: string, token?: string): Promise<{ status: number; body: IngestResponse }>;
  /** Finres national reference (D-048); null when the server has no file (it answers 204). */
  national(): Promise<NationalResponse | null>;
  /** The patient's prior resistant findings (D-050); 400 without an id, an empty list for an unknown one. */
  patientFindings(id: string): Promise<PatientFindingsResponse>;
  /** Opens the live stream; returns a function that closes it. */
  live(onEvent: (event: LiveEvent) => void, onError?: (error: Event) => void): () => void;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function createAeiClient(options: AeiClientOptions): AeiClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const ES = options.EventSource ?? globalThis.EventSource;
  const url = (path: string) => `${options.baseUrl}${path}`;

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const res = await doFetch(url(path), init);
    if (!res.ok) throw new ApiError(res.status, `${init?.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
    return res;
  }

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    return (await (await request(path, init)).json()) as T;
  }

  const projectPath = (id: string) => `${ROUTES.projects}/${encodeURIComponent(id)}`;
  const projectWrite = (method: "POST" | "PUT", path: string, input: ProjectInput) =>
    json<ProjectResponse>(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(input) });

  return {
    projects: () => json<ProjectsResponse>(ROUTES.projects),
    project: (id) => json<ProjectResponse>(projectPath(id)),
    createProject: (input) => projectWrite("POST", ROUTES.projects, input),
    updateProject: (id, input) => projectWrite("PUT", projectPath(id), input),
    deleteProject: async (id) => {
      await request(projectPath(id), { method: "DELETE" });
    },
    ask: (text, lang, site) =>
      json<AskResponse>(ROUTES.ask, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(site ? { text, lang, site } : { text, lang }),
      }),
    explain: (id, lang, wording) => json<ExplainResponse>(withQuery(ROUTES.explain, { id, lang, wording })),
    coverage: (query) => json<CoverageResponse>(withQuery(ROUTES.coverage, query)),
    failsTogether: (query) => json<FailsTogetherResponse>(withQuery(ROUTES.failsTogether, query)),
    meta: () => json<Meta>(ROUTES.meta),
    clock: () => json<ClockState>(ROUTES.clock),
    command: (command) =>
      json<ClockState>(ROUTES.clock, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
      }),
    isolates: (query) => json<IsolatesResponse>(isolatesUrl(query)),
    relations: (query) => json<RelationsResponse>(withQuery(ROUTES.relations, query)),
    alerts: (query) => json<AlertsResponse>(withQuery(ROUTES.alerts, query)),
    regional: (query) => json<RegionalResponse>(withQuery(ROUTES.regional, query)),
    counties: () => json<CountiesResponse>(ROUTES.counties),
    weekly: (query) => json<WeeklyResponse>(withQuery(ROUTES.weekly, query)),
    quality: (query = {}) => json<QualityResponse>(withQuery(ROUTES.quality, query)),
    sites: () => json<SitesResponse>(ROUTES.sites),
    async ingest(body, contentType, token) {
      const res = await doFetch(url(ROUTES.ingest), {
        method: "POST",
        headers: { "content-type": contentType, ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body,
      });
      const text = await res.text();
      let parsed: IngestResponse;
      try {
        parsed = JSON.parse(text) as IngestResponse;
      } catch {
        parsed = { error: text };
      }
      return { status: res.status, body: parsed };
    },
    national: async () => {
      const res = await request(ROUTES.national);
      return res.status === 204 ? null : ((await res.json()) as NationalResponse);
    },
    patientFindings: (id) => json<PatientFindingsResponse>(withQuery(ROUTES.patientFindings, { id })),
    live(onEvent, onError) {
      const source = new ES(url(ROUTES.live));
      for (const type of LIVE_EVENT_TYPES) {
        source.addEventListener(type, (e) => onEvent(JSON.parse((e as MessageEvent).data as string) as LiveEvent));
      }
      if (onError) source.onerror = onError;
      return () => source.close();
    },
  };
}

export type { Family, Link as FailsTogetherLink } from "@aei/coresistance";
export type { FailsTogetherResponse, FailsTogetherRouteQuery as FailsTogetherQuery } from "@aei/coresistance/route";
