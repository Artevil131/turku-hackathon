import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Feed, FeedClock, FeedEvent, FeedMeta, IsoDate, Result } from "./types.ts";
import { BACKOFF_MS, CATCH_UP_MS, startFeedSync, type SyncState } from "./useFeed.ts";

// The feed sync against a fake feed: first load, arrivals, reset, gaps, drops.

const meta: FeedMeta = { start: "2024-01-01", end: "2024-12-31", units: [], antibiotics: [], organisms: [], specimens: [], ai: false };

function result(id: string, day: IsoDate): Result {
  return {
    isolateId: id,
    cultureId: id,
    patientId: `p${id}`,
    sampleDate: day,
    admissionDate: null,
    ward: "U",
    specimen: "s",
    organism: "o",
    sex: "F",
    ageYears: 50,
    phenotypes: [],
    results: {},
  };
}

class FakeFeed implements Feed {
  all: Result[] = [];
  asOf: IsoDate = "2024-01-03";
  listeners: { onEvent: (e: FeedEvent) => void; onError?: () => void; open: boolean }[] = [];
  historyCalls: { from?: string; to?: string }[] = [];
  down = false;

  clockNow(): FeedClock {
    return { asOf: this.asOf, start: meta.start, end: meta.end, running: false, tickMs: 2000, daysPerTick: 1 };
  }
  async meta() {
    if (this.down) throw new Error("down");
    return meta;
  }
  async clock() {
    if (this.down) throw new Error("down");
    return this.clockNow();
  }
  async history(range: { from?: IsoDate; to?: IsoDate } = {}) {
    if (this.down) throw new Error("down");
    this.historyCalls.push(range);
    return this.all.filter((r) => r.sampleDate <= this.asOf && (!range.from || r.sampleDate >= range.from) && (!range.to || r.sampleDate <= range.to));
  }
  subscribe(onEvent: (e: FeedEvent) => void, onError?: () => void) {
    const l = { onEvent, onError, open: true };
    this.listeners.push(l);
    return () => {
      l.open = false;
    };
  }
  async control() {
    return this.clockNow();
  }
  emit(e: FeedEvent) {
    for (const l of this.listeners) if (l.open) l.onEvent(e);
  }
  drop() {
    for (const l of this.listeners) if (l.open) l.onError?.();
  }
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("startFeedSync", () => {
  let feed: FakeFeed;
  let state: SyncState;
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    feed = new FakeFeed();
    feed.all = [result("a", "2024-01-01"), result("b", "2024-01-02"), result("c", "2024-01-03"), result("d", "2024-01-04"), result("e", "2024-01-06")];
  });
  afterEach(() => {
    stop?.();
    vi.useRealTimers();
  });

  function start() {
    const s = startFeedSync(feed, (next) => (state = next));
    stop = s.stop;
    return s;
  }

  it("loads the full history up to the clock and goes live", async () => {
    start();
    expect(state.status).toBe("connecting");
    await flush();
    expect(state.status).toBe("live");
    expect(state.results.map((r) => r.isolateId)).toEqual(["a", "b", "c"]);
    expect(state.asOf).toBe("2024-01-03");
    expect(state.generation).toBe(1);
    expect(feed.historyCalls[0]).toEqual({ from: "2024-01-01", to: "2024-01-03" });
  });

  it("appends arrivals as a new array that keeps the old one as its prefix", async () => {
    start();
    await flush();
    const before = state.results;
    feed.asOf = "2024-01-04";
    feed.emit({ type: "clock", clock: feed.clockNow() });
    feed.emit({ type: "arrivals", from: "2024-01-03", to: "2024-01-04", results: [result("d", "2024-01-04")] });
    expect(state.results).not.toBe(before);
    expect(state.results.slice(0, before.length).every((r, i) => r === before[i])).toBe(true);
    expect(state.results.map((r) => r.isolateId)).toEqual(["a", "b", "c", "d"]);
    expect(state.asOf).toBe("2024-01-04");
    expect(state.lastArrival).toMatchObject({ to: "2024-01-04", count: 1 });
    // The same batch again changes nothing.
    const after = state.results;
    feed.emit({ type: "arrivals", from: "2024-01-03", to: "2024-01-04", results: [result("d", "2024-01-04")] });
    expect(state.results).toBe(after);
  });

  it("holds events that arrive during the first load and applies them after it", async () => {
    start();
    feed.emit({ type: "arrivals", from: "2024-01-03", to: "2024-01-04", results: [result("d", "2024-01-04")] });
    await flush();
    expect(state.results.map((r) => r.isolateId)).toEqual(["a", "b", "c", "d"]);
    expect(state.asOf).toBe("2024-01-04");
  });

  it("an empty day still moves asOf", async () => {
    start();
    await flush();
    feed.emit({ type: "arrivals", from: "2024-01-03", to: "2024-01-04", results: [] });
    expect(state.asOf).toBe("2024-01-04");
    expect(state.lastArrival?.count).toBe(0);
  });

  it("reloads everything on reset", async () => {
    start();
    await flush();
    feed.asOf = "2024-01-02";
    feed.emit({ type: "reset", clock: feed.clockNow() });
    await flush();
    expect(state.results.map((r) => r.isolateId)).toEqual(["a", "b"]);
    expect(state.asOf).toBe("2024-01-02");
    expect(state.generation).toBe(2);
  });

  it("fetches missing days when a batch skips ahead", async () => {
    start();
    await flush();
    feed.asOf = "2024-01-06";
    feed.emit({ type: "arrivals", from: "2024-01-05", to: "2024-01-06", results: [result("e", "2024-01-06")] });
    await flush();
    expect(state.results.map((r) => r.isolateId)).toEqual(["a", "b", "c", "d", "e"]);
    expect(state.asOf).toBe("2024-01-06");
  });

  it("catches up when the clock moves and no arrivals follow", async () => {
    start();
    await flush();
    feed.asOf = "2024-01-04";
    feed.emit({ type: "clock", clock: feed.clockNow() });
    expect(state.asOf).toBe("2024-01-03");
    await vi.advanceTimersByTimeAsync(CATCH_UP_MS + 10);
    await flush();
    expect(state.asOf).toBe("2024-01-04");
    expect(state.results.map((r) => r.isolateId)).toEqual(["a", "b", "c", "d"]);
  });

  it("goes offline when the stream drops and fetches only the missing days on reconnect", async () => {
    start();
    await flush();
    feed.down = true;
    feed.drop();
    expect(state.status).toBe("offline");
    expect(state.retryAt).not.toBeNull();
    feed.down = false;
    feed.asOf = "2024-01-04";
    const calls = feed.historyCalls.length;
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[0] + 10);
    await flush();
    expect(state.status).toBe("live");
    expect(feed.historyCalls.slice(calls)).toEqual([{ from: "2024-01-04", to: "2024-01-04" }]);
    expect(state.results.map((r) => r.isolateId)).toEqual(["a", "b", "c", "d"]);
    expect(state.generation).toBe(1);
  });

  it("backs off while the feed stays down, and retry() tries at once", async () => {
    feed.down = true;
    const s = start();
    await flush();
    expect(state.status).toBe("offline");
    await vi.advanceTimersByTimeAsync(BACKOFF_MS[0] + 10);
    await flush();
    expect(state.status).toBe("offline");
    feed.down = false;
    s.retry();
    await flush();
    expect(state.status).toBe("live");
    expect(state.results).toHaveLength(3);
  });
});
