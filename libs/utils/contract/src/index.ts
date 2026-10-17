import type { Alert } from "@aei/alerts";
import type { AgeGroup } from "@aei/ask";
import type { CombinationSuggestion, CoverageResult, CoverageQuery as GearCoverageQuery, Severity, Suggestion } from "@aei/coverage";
import type { Antibiotic, IsoDate, IsolateRecord, Organism, Sex, Specimen, Ward, WardCode } from "@aei/domain";
import type { CheckSummary } from "@aei/quality";
import type { Flow, TrailLink } from "@aei/relations";
import type { ClockState } from "@aei/replay";

// The contract between the AEI server and its clients (web, later the
// phone app). The current server is apps/api in TypeScript; a Rust server
// can replace it by serving the same routes and events (DECISIONS.md D-006).

export const ROUTES = {
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
  /** Plausibility checks over the rows the server holds (D-038). */
  quality: "/api/quality",
} as const;

export interface Meta {
  ai: boolean;
  datasetStart: IsoDate;
  datasetEnd: IsoDate;
  wards: readonly Ward[];
  antibiotics: readonly Antibiotic[];
  organisms: readonly Organism[];
  specimens: readonly { code: Specimen; en: string; fi: string }[];
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
}

export type { AntibioticCoverage, CombinationSuggestion, Counts, CoverageResult, Level, Severity, Suggestion } from "@aei/coverage";

/** The doctor's coverage list (D-023). The server sets the as-of date from its clock. */
export type CoverageQuery = Omit<GearCoverageQuery, "asOf" | "minTested"> & {
  /** How suggestions are judged (D-026, D-027); "mild" when omitted. */
  severity?: Severity;
};

export interface CoverageResponse {
  asOf: IsoDate;
  severity: Severity;
  coverage: CoverageResult;
  /** Ordered: clears, borderline, below, not assessable. Decision support only. */
  suggestions: Suggestion[];
  /** Pairs, only when no single antibiotic clears (D-028). */
  combinationSuggestions: CombinationSuggestion[];
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
  };
  /** YYYY-MM, oldest first. */
  months: string[];
  groups: string[];
  regions: string[];
  series: RegionalSeries[];
  /** Strongest first. */
  signals: RegionalSignal[];
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
 * series and signals matching the query. Group and region lists stay whole.
 */
export function regionalUpTo(data: RegionalData, asOf: IsoDate, query: RegionalQuery = {}): RegionalResponse {
  const month = asOf.slice(0, 7);
  const n = data.months.filter((m) => m < month).length;
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
  };
}

export type { CheckName, CheckSummary, Finding, Severity as FindingSeverity } from "@aei/quality";

/** Every check run over every row the server holds, grouped by check; no findings means every check passed. */
export interface QualityResponse {
  checked: { patients: number; cultures: number; isolates: number; results: number };
  summary: CheckSummary[];
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
  ask(text: string, lang: "en" | "fi"): Promise<AskResponse>;
  /** The code's template by default; `wording: "model"` asks the AI to reword it (D-029). */
  explain(id: string, lang: "en" | "fi", wording?: ExplainWording): Promise<ExplainResponse>;
  coverage(query: CoverageQuery): Promise<CoverageResponse>;
  meta(): Promise<Meta>;
  clock(): Promise<ClockState>;
  command(command: ClockCommand): Promise<ClockState>;
  isolates(query: IsolateQuery): Promise<IsolatesResponse>;
  relations(query: RelationsQuery): Promise<RelationsResponse>;
  alerts(query: AlertsQuery): Promise<AlertsResponse>;
  /** 404 when the server has no regional file. */
  regional(query: RegionalQuery): Promise<RegionalResponse>;
  quality(): Promise<QualityResponse>;
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

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await doFetch(url(path), init);
    if (!res.ok) throw new ApiError(res.status, `${init?.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  return {
    ask: (text, lang) =>
      json<AskResponse>(ROUTES.ask, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, lang }),
      }),
    explain: (id, lang, wording) => json<ExplainResponse>(withQuery(ROUTES.explain, { id, lang, wording })),
    coverage: (query) => json<CoverageResponse>(withQuery(ROUTES.coverage, query)),
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
    quality: () => json<QualityResponse>(ROUTES.quality),
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
