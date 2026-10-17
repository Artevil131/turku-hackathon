import { cochranArmitageRising } from "@aei/detect";
import { describe, expect, it } from "vitest";
import { betaPosterior, discountedBeta, proportionDifference, rateRatio, sharesByPeriod, trendAcross } from "./index.ts";

const area = (grid: { x: number; y: number }[]) =>
  grid.slice(1).reduce((s, g, i) => s + ((g.y + (grid[i] as { y: number }).y) / 2) * (g.x - (grid[i] as { x: number }).x), 0);

describe("proportionDifference", () => {
  it("10 of 100 against 20 of 100: diff 0.1, pooled z 1.980, p 0.0477, Newcombe 0.0001 to 0.1996", () => {
    const r = proportionDifference(10, 100, 20, 100);
    expect(r.p1).toBe(0.1);
    expect(r.p2).toBe(0.2);
    expect(r.diff).toBeCloseTo(0.1, 12);
    expect(r.z).toBeCloseTo(0.1 / Math.sqrt(0.15 * 0.85 * 0.02), 12); // 1.9803
    expect(r.p).toBeCloseTo(0.0476, 3);
    expect(r.interval.lo).toBeCloseTo(0.0001, 3);
    expect(r.interval.hi).toBeCloseTo(0.1996, 3);
  });
  it("equal shares: z 0, p 1, interval around 0", () => {
    const r = proportionDifference(5, 50, 10, 100);
    expect(r.diff).toBe(0);
    expect(r.z).toBe(0);
    expect(r.p).toBe(1);
    expect(r.interval.lo).toBeLessThan(0);
    expect(r.interval.hi).toBeGreaterThan(0);
  });
  it("k = n on both sides has no spread: z 0, p 1", () => {
    const r = proportionDifference(30, 30, 40, 40);
    expect(r).toMatchObject({ diff: 0, z: 0, p: 1 });
  });
  it("n = 0 on a side leaves only the shares", () => {
    const r = proportionDifference(0, 0, 3, 10);
    expect(r.p1).toBeNaN();
    expect(r.p2).toBe(0.3);
    expect(r.diff).toBeNaN();
    expect(r.p).toBeNaN();
  });
});

describe("rateRatio", () => {
  it("5 in 4 weeks against 15 in 4 weeks: ratio 3, exact 1.037 to 10.55, p 0.0414", () => {
    const r = rateRatio(5, 4, 15, 4);
    expect(r.rate1).toBe(1.25);
    expect(r.rate2).toBe(3.75);
    expect(r.ratio).toBe(3);
    // Clopper-Pearson on 15 of 20: 0.508954 to 0.913429 (scipy), as a ratio of odds
    expect(r.interval.lo).toBeCloseTo(0.5089541282920425 / (1 - 0.5089541282920425), 8);
    expect(r.interval.hi).toBeCloseTo(0.9134285308985655 / (1 - 0.9134285308985655), 6);
    expect(r.p).toBeCloseTo(0.04138946533203125, 10);
  });
  it("equal counts over equal time: ratio 1, p 1, interval symmetric on the log scale", () => {
    const r = rateRatio(5, 1, 5, 1);
    expect(r.ratio).toBe(1);
    expect(r.p).toBe(1);
    expect(r.interval.lo * r.interval.hi).toBeCloseTo(1, 9);
  });
  it("exposure scales the ratio", () => {
    expect(rateRatio(10, 2, 10, 8).ratio).toBe(0.25);
  });
  it("no events before: ratio Infinity, upper bound open", () => {
    const r = rateRatio(0, 4, 5, 4);
    expect(r.ratio).toBe(Number.POSITIVE_INFINITY);
    expect(r.interval.hi).toBe(Number.POSITIVE_INFINITY);
    expect(r.interval.lo).toBeCloseTo(0.025 ** 0.2 / (1 - 0.025 ** 0.2), 9); // 5 of 5: lower bound q^5 = 0.025
    expect(r.p).toBeCloseTo(2 * 0.5 ** 5, 12);
  });
  it("no events at all says nothing", () => {
    const r = rateRatio(0, 4, 0, 4);
    expect(r.ratio).toBeNaN();
    expect(r.interval).toEqual({ lo: 0, hi: Number.POSITIVE_INFINITY });
    expect(r.p).toBe(1);
  });
  it("rejects a zero exposure", () => {
    expect(() => rateRatio(1, 0, 1, 1)).toThrow(RangeError);
  });
});

describe("trendAcross", () => {
  it("is the live detector's Cochran-Armitage", () => {
    const bins = [
      { events: 1, n: 10 },
      { events: 2, n: 10 },
      { events: 5, n: 12 },
    ];
    expect(trendAcross(bins).p).toBe(cochranArmitageRising(bins));
    expect(trendAcross(bins).p).toBeLessThan(0.05);
  });
  it("a flat share is no trend", () => {
    expect(
      trendAcross([
        { events: 2, n: 10 },
        { events: 2, n: 10 },
        { events: 2, n: 10 },
      ]).p,
    ).toBeCloseTo(0.5, 6);
    expect(trendAcross([]).p).toBe(1);
  });
});

describe("betaPosterior", () => {
  it("3 of 10 with a flat prior is Beta(4, 8): mean 1/3, interval 0.1093 to 0.6097", () => {
    const r = betaPosterior(3, 10);
    expect([r.a, r.b]).toEqual([4, 8]);
    expect(r.mean).toBeCloseTo(4 / 12, 15);
    expect(r.interval.lo).toBeCloseTo(0.10926344, 3);
    expect(r.interval.hi).toBeCloseTo(0.60974256, 3);
    expect(r.grid).toHaveLength(201);
    expect(r.grid[0]?.x).toBe(0);
    expect(r.grid[200]?.x).toBe(1);
    expect(area(r.grid)).toBeCloseTo(1, 3);
  });
  it("a prior adds its pseudo-counts", () => {
    const r = betaPosterior(3, 10, { a: 2, b: 5 }, 11);
    expect([r.a, r.b]).toEqual([5, 12]);
    expect(r.grid).toHaveLength(11);
  });
  it("n = 0 is the prior itself: Beta(1, 1), interval 0.025 to 0.975", () => {
    const r = betaPosterior(0, 0);
    expect(r.mean).toBe(0.5);
    expect(r.interval.lo).toBeCloseTo(0.025, 3);
    expect(r.interval.hi).toBeCloseTo(0.975, 3);
  });
  it("k = 0 and k = n stay inside 0 to 1 with one open side", () => {
    const none = betaPosterior(0, 10);
    expect(none.interval.lo).toBeCloseTo(0.00229897, 3);
    expect(none.interval.hi).toBeCloseTo(0.28491415, 3);
    const all = betaPosterior(10, 10);
    expect(all.mean).toBeCloseTo(11 / 12, 12);
    expect(all.interval.hi).toBeCloseTo(1 - 0.00229897, 3);
  });
  it("refuses a Beta that does not exist", () => {
    expect(() => betaPosterior(0, 0, { a: 0, b: 1 })).toThrow(RangeError);
  });
});

describe("discountedBeta", () => {
  const weeks = [
    { k: 3, n: 5 },
    { k: 0, n: 5 },
  ];
  it("delta 1 is the plain posterior with the pseudo-counts m × share and m × (1 − share)", () => {
    const d = discountedBeta(weeks, { delta: 1, m: 4, parentShare: 0.25 });
    const p = betaPosterior(3, 10, { a: 1, b: 3 });
    expect(d.a).toBe(p.a);
    expect(d.b).toBe(p.b);
    expect(d.mean).toBe(p.mean);
    expect(d.interval).toEqual(p.interval);
    expect(d.effectiveN).toBe(10);
  });
  it("delta 0.5 halves the older week: 1.5 of 7.5", () => {
    const d = discountedBeta(weeks, { delta: 0.5, m: 4, parentShare: 0.25 });
    expect(d.effectiveN).toBe(7.5);
    expect(d.a).toBeCloseTo(1 + 1.5, 12);
    expect(d.b).toBeCloseTo(3 + 6, 12);
  });
  it("asOfIndex ignores later weeks", () => {
    const d = discountedBeta(weeks, { delta: 0.5, m: 4, parentShare: 0.25, asOfIndex: 0 });
    expect(d.effectiveN).toBe(5);
    expect(d.a).toBe(4);
  });
  it("no weeks is the prior", () => {
    const d = discountedBeta([], { delta: 0.9, m: 10, parentShare: 0.3, points: 5 });
    expect([d.a, d.b, d.effectiveN]).toEqual([3, 7, 0]);
    expect(d.grid).toHaveLength(5);
  });
});

describe("sharesByPeriod", () => {
  const rs = [
    { sampleDate: "2025-01-01", r: true },
    { sampleDate: "2025-01-04", r: false },
    { sampleDate: "2025-01-04", r: true },
    { sampleDate: "2025-01-09", r: true },
    { sampleDate: "2025-01-10", r: true },
    { sampleDate: "2025-01-11", r: false }, // after `to`
    { sampleDate: "2024-12-31", r: false }, // before `from`
  ];
  it("cuts the window into periods, the last one at `to`", () => {
    const out = sharesByPeriod(rs, { from: "2025-01-01", to: "2025-01-10", periodDays: 4, event: (x) => x.r });
    expect(out.map((p) => [p.from, p.to, p.k, p.n])).toEqual([
      ["2025-01-01", "2025-01-04", 2, 3],
      ["2025-01-05", "2025-01-08", 0, 0],
      ["2025-01-09", "2025-01-10", 2, 2],
    ]);
    expect(out[0]?.share).toBeCloseTo(2 / 3, 15);
    expect(out[0]?.interval?.lo).toBeCloseTo(0.2077, 3);
    expect(out[1]).toMatchObject({ share: null, interval: null });
    expect(out[2]?.share).toBe(1);
    expect(out[2]?.interval?.hi).toBe(1);
  });
  it("a denominator narrows n, and k counts only inside it", () => {
    const out = sharesByPeriod(rs, {
      from: "2025-01-01",
      to: "2025-01-10",
      periodDays: 10,
      event: (x) => x.r,
      denominator: (x) => x.sampleDate >= "2025-01-04",
    });
    expect(out).toHaveLength(1);
    expect([out[0]?.k, out[0]?.n]).toEqual([3, 4]);
  });
  it("rejects a period that is not whole days", () => {
    expect(() => sharesByPeriod(rs, { from: "2025-01-01", to: "2025-01-10", periodDays: 0, event: () => true })).toThrow(RangeError);
  });
});
