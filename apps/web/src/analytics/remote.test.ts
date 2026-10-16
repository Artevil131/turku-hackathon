import type { Catalog } from "@aei/isolates";
import { afterEach, describe, expect, it, vi } from "vitest";
import { remoteSource } from "./remote.ts";
import type { Released } from "./types.ts";

// A made-up analysis server (test data only): the remote source asks the
// documented routes with the query's filters, caches answers, and forgets
// them when the feed generation changes.

const catalog: Catalog = { units: [], antibiotics: [] };
const at: Released = { results: [], asOf: "2024-03-01", catalog };

function fakeFetch(answer: (url: string) => unknown, status = 200) {
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    urls.push(url);
    return { ok: status >= 200 && status < 300, status, json: async () => answer(url) } as Response;
  });
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("remoteSource", () => {
  it("sends every set filter, always the unit, and leaves unset ones out", async () => {
    const urls = fakeFetch(() => ({}));
    const src = remoteSource();
    await src.coverage(at, { ward: "U1", specimen: "urine", sex: "F", age: "65plus" }, "coverage");
    await src.reportMatrix(at, { ward: "U1", specimen: "urine" }, 28);
    expect(urls).toEqual([
      "/api/analytics/coverage?asOf=2024-03-01&ward=U1&specimen=urine&sex=F&age=65plus&rank=coverage",
      "/api/analytics/report/units?asOf=2024-03-01&specimen=urine&days=28",
    ]);
  });

  it("reuses an answer within a generation and asks again after a reload", async () => {
    const urls = fakeFetch(() => []);
    const src = remoteSource();
    await src.signals(at, 0);
    await src.signals(at, 0);
    expect(urls).toHaveLength(1);
    await src.signals(at, 1);
    expect(urls).toHaveLength(2);
  });

  it("rejects on an error status and asks again next time", async () => {
    const urls = fakeFetch(() => null, 503);
    const src = remoteSource();
    await expect(src.signals(at, 0)).rejects.toThrow("503");
    await expect(src.signals(at, 0)).rejects.toThrow("503");
    expect(urls).toHaveLength(2);
  });
});
