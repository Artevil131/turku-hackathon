import type { Feed, FeedClock, FeedCommand, FeedEvent, FeedMeta, Result } from "./types.ts";

// A Feed over HTTP and server-sent events. Routes (relative to `base`):
//   GET  /api/meta                      code lists and date range
//   GET  /api/clock                     the clock
//   POST /api/clock {action...}         demo controls
//   GET  /api/isolates?from=&to=        results released so far
//   GET  /api/live                      events: clock, arrivals, reset
// This matches the team's development feed server (apps/api on ui/web-app),
// whose field names differ slightly; they are mapped here and nowhere else.

interface ServerMeta {
  datasetStart: string;
  datasetEnd: string;
  wards: FeedMeta["units"];
  antibiotics: FeedMeta["antibiotics"];
  organisms: string[];
  specimens: FeedMeta["specimens"];
  ai?: boolean;
}

type ServerEvent =
  | { type: "clock"; clock: FeedClock }
  | { type: "arrivals"; from: string; to: string; records: Result[] }
  | { type: "reset"; clock: FeedClock };

export function httpFeed(base = ""): Feed {
  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${base}${path}`, init);
    if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${res.status}`);
    return (await res.json()) as T;
  }
  const post = <T>(path: string, body: unknown) =>
    json<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  // The code lists do not change while the app runs: fetched once (a reconnect or a
  // remount reuses them; a failed fetch is forgotten so the next try asks again).
  let metaOnce: Promise<FeedMeta> | null = null;

  const feed: Feed = {
    meta() {
      metaOnce ??= json<ServerMeta>("/api/meta").then(
        (m) => ({
          start: m.datasetStart,
          end: m.datasetEnd,
          units: m.wards,
          antibiotics: m.antibiotics,
          organisms: m.organisms,
          specimens: m.specimens,
          ai: m.ai === true,
        }),
        (err: unknown) => {
          metaOnce = null;
          throw err;
        },
      );
      return metaOnce;
    },
    clock: () => json<FeedClock>("/api/clock"),
    async history(range = {}) {
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      const qs = params.toString();
      const { records } = await json<{ records: Result[] }>(`/api/isolates${qs ? `?${qs}` : ""}`);
      return records;
    },
    subscribe(onEvent, onError) {
      const source = new EventSource(`${base}/api/live`);
      const handle = (e: MessageEvent<string>) => {
        const event = JSON.parse(e.data) as ServerEvent;
        const mapped: FeedEvent =
          event.type === "arrivals" ? { type: "arrivals", from: event.from, to: event.to, results: event.records } : event;
        onEvent(mapped);
      };
      for (const type of ["clock", "arrivals", "reset"]) source.addEventListener(type, handle as EventListener);
      if (onError) source.onerror = onError;
      return () => source.close();
    },
    control: (command: FeedCommand) => post<FeedClock>("/api/clock", command),
  };
  return feed;
}
