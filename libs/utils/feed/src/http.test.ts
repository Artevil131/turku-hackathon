import { afterEach, describe, expect, it, vi } from "vitest";
import { httpFeed } from "./http.ts";
import type { FeedEvent, Result } from "./types.ts";

// A made-up feed server (test data only): the client maps its field names and
// asks for the routes in http.ts, nothing else.

const serverMeta = {
  datasetStart: "2024-01-01",
  datasetEnd: "2024-12-31",
  wards: [{ code: "U1", en: "Unit one", fi: "Yksikkö yksi", type: "in", institution: "hospital" }],
  antibiotics: [{ code: "A1", en: "drug one", fi: "lääke yksi", class: "c1", reportedFor: "all" }],
  organisms: ["Genus one"],
  specimens: [{ code: "urine", en: "urine", fi: "virtsa" }],
};

const record: Result = {
  isolateId: "I1",
  cultureId: "C1",
  patientId: "P1",
  sampleDate: "2024-03-01",
  admissionDate: null,
  ward: "U1",
  specimen: "urine",
  organism: "Genus one",
  sex: "F",
  ageYears: 40,
  phenotypes: [],
  results: { A1: "S" },
};

function fakeFetch(answer: (url: string, init?: RequestInit) => unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const body = answer(url, init);
    return { ok: body !== undefined, status: body === undefined ? 404 : 200, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("httpFeed", () => {
  it("maps the server's meta once and reuses it", async () => {
    const calls = fakeFetch((url) => (url === "/api/meta" ? serverMeta : undefined));
    const feed = httpFeed();
    const meta = await feed.meta();
    expect(meta).toEqual({
      start: "2024-01-01",
      end: "2024-12-31",
      units: serverMeta.wards,
      antibiotics: serverMeta.antibiotics,
      organisms: ["Genus one"],
      specimens: serverMeta.specimens,
      ai: false,
    });
    await feed.meta();
    expect(calls).toHaveLength(1);
  });

  it("forgets a failed meta fetch so the next try asks again", async () => {
    let up = false;
    const calls = fakeFetch(() => (up ? serverMeta : undefined));
    const feed = httpFeed("http://feed.test");
    await expect(feed.meta()).rejects.toThrow("GET /api/meta: 404");
    up = true;
    await expect(feed.meta()).resolves.toMatchObject({ start: "2024-01-01" });
    expect(calls.map((c) => c.url)).toEqual(["http://feed.test/api/meta", "http://feed.test/api/meta"]);
  });

  it("asks for history by date range and returns the records", async () => {
    const calls = fakeFetch((url) => (url.startsWith("/api/isolates") ? { records: [record] } : undefined));
    const feed = httpFeed();
    expect(await feed.history({ from: "2024-02-01", to: "2024-03-31" })).toEqual([record]);
    await feed.history();
    expect(calls.map((c) => c.url)).toEqual(["/api/isolates?from=2024-02-01&to=2024-03-31", "/api/isolates"]);
  });

  it("posts demo commands to the clock", async () => {
    const clock = { asOf: "2024-03-01", start: "2024-01-01", end: "2024-12-31", running: false, tickMs: 2000, daysPerTick: 1 };
    const calls = fakeFetch((url, init) => (url === "/api/clock" && init?.method === "POST" ? clock : undefined));
    expect(await httpFeed().control({ action: "seek", date: "2024-03-01" })).toEqual(clock);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ action: "seek", date: "2024-03-01" });
  });

  it("maps live arrivals and closes the stream", () => {
    const listeners = new Map<string, (e: MessageEvent<string>) => void>();
    let closed = false;
    class FakeEventSource {
      onerror: (() => void) | null = null;
      readonly url: string;
      constructor(url: string) {
        this.url = url;
      }
      addEventListener(type: string, fn: (e: MessageEvent<string>) => void) {
        listeners.set(type, fn);
      }
      close() {
        closed = true;
      }
    }
    vi.stubGlobal("EventSource", FakeEventSource);
    const events: FeedEvent[] = [];
    const close = httpFeed().subscribe((e) => events.push(e));
    const arrivals = { type: "arrivals", from: "2024-03-01", to: "2024-03-02", records: [record] };
    listeners.get("arrivals")?.({ data: JSON.stringify(arrivals) } as MessageEvent<string>);
    expect(events).toEqual([{ type: "arrivals", from: "2024-03-01", to: "2024-03-02", results: [record] }]);
    close();
    expect(closed).toBe(true);
  });
});
