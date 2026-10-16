import type { Alert } from "@aei/alerts";
import type { Antibiotic, IsoDate, IsolateRecord, Organism, Specimen, Ward, WardCode } from "@aei/domain";
import type { Flow, TrailLink } from "@aei/relations";
import type { ClockState } from "@aei/replay";

// The contract between the AEI server and its clients (web, later the
// phone app). The current server is apps/api in TypeScript; a Rust server
// can replace it by serving the same routes and events (DECISIONS.md D-006).

export const ROUTES = {
  meta: "/api/meta",
  clock: "/api/clock",
  isolates: "/api/isolates",
  relations: "/api/relations",
  alerts: "/api/alerts",
  live: "/api/live",
} as const;

export interface Meta {
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
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, String(value));
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
  meta(): Promise<Meta>;
  clock(): Promise<ClockState>;
  command(command: ClockCommand): Promise<ClockState>;
  isolates(query: IsolateQuery): Promise<IsolatesResponse>;
  relations(query: RelationsQuery): Promise<RelationsResponse>;
  alerts(query: AlertsQuery): Promise<AlertsResponse>;
  /** Opens the live stream; returns a function that closes it. */
  live(onEvent: (event: LiveEvent) => void, onError?: (error: Event) => void): () => void;
}

export function createAeiClient(options: AeiClientOptions): AeiClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const ES = options.EventSource ?? globalThis.EventSource;
  const url = (path: string) => `${options.baseUrl}${path}`;

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await doFetch(url(path), init);
    if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  return {
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
