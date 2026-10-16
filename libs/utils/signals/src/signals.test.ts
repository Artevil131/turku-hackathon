import type { Result } from "@aei/feed";
import type { Catalog } from "@aei/isolates";
import { beforeEach, describe, expect, it } from "vitest";
import { detectSignals, resetSignalCache } from "./signals.ts";
import { cochranArmitageUp, fisherMidPGreater, poissonLower, poissonUpper } from "./stats.ts";
import type { Signal } from "./types.ts";

const catalog: Catalog = { units: [], antibiotics: [] };
const DAY = 86_400_000;
const START = Date.UTC(2024, 0, 1) / DAY;
const iso = (offset: number) => new Date((START + offset) * DAY).toISOString().slice(0, 10);

let seq = 0;
function res(p: Partial<Result> & { day: number }): Result {
  const { day, ...rest } = p;
  seq++;
  return {
    isolateId: `I${seq}`,
    cultureId: `C${seq}`,
    patientId: `P${seq}`,
    sampleDate: iso(day),
    admissionDate: null,
    ward: "W1",
    specimen: "urine",
    organism: "Org a",
    sex: "F",
    ageYears: 60,
    phenotypes: [],
    results: { A1: "S", A2: "S", A3: "S" },
    ...rest,
  };
}

/** Deterministic pseudo-random numbers. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Steady background: `perDay` results a day on a unit for days [from, to). */
function background(ward: string, from: number, to: number, perDay: number, extra: Partial<Result> = {}): Result[] {
  const out: Result[] = [];
  for (let d = from; d < to; d++) for (let i = 0; i < perDay; i++) out.push(res({ day: d, ward, ...extra }));
  return out;
}

const of = (signals: Signal[], kind: Signal["kind"]) => signals.filter((s) => s.kind === kind);

beforeEach(() => {
  resetSignalCache();
  seq = 0;
});

describe("stats", () => {
  it("poisson tails", () => {
    expect(poissonUpper(0, 2)).toBe(1);
    expect(poissonUpper(1, 2)).toBeCloseTo(1 - Math.exp(-2), 10);
    expect(poissonLower(0, 2)).toBeCloseTo(Math.exp(-2), 10);
    expect(poissonUpper(3, 0.1)).toBeCloseTo(0.000155, 5);
    expect(poissonUpper(40, 1)).toBeGreaterThan(0);
  });
  it("fisher mid-p is small only when group 1 is higher", () => {
    expect(fisherMidPGreater(8, 10, 5, 100)).toBeLessThan(1e-6);
    expect(fisherMidPGreater(1, 10, 50, 100)).toBeGreaterThan(0.9);
  });
  it("cochran-armitage sees a rise", () => {
    const tot = Array(20).fill(100);
    expect(
      cochranArmitageUp(
        tot.map((_, i) => 5 + i),
        tot,
      ).p,
    ).toBeLessThan(1e-4);
    expect(
      cochranArmitageUp(
        tot.map(() => 10),
        tot,
      ).p,
    ).toBeCloseTo(0.5, 5);
  });
});

describe("detectSignals", () => {
  it("returns nothing for no results", () => {
    expect(detectSignals([], "2024-01-01", catalog)).toEqual([]);
  });

  it("sentinel: a CPE isolate is high at once; isolates within 28 days merge, later ones start a new episode", () => {
    const data = [
      ...background("W1", 0, 100, 1),
      res({ day: 10, phenotypes: ["cpe"], organism: "Org k" }),
      res({ day: 30, phenotypes: ["cpe"], organism: "Org k" }),
      res({ day: 90, phenotypes: ["cpe"], organism: "Org k" }),
    ];
    const s = of(detectSignals(data, iso(99), catalog), "sentinel");
    expect(s).toHaveLength(2);
    expect(s.every((x) => x.severity === "high" && x.phenotype === "cpe" && x.ward === "W1")).toBe(true);
    const first = s.find((x) => x.firstDate === iso(10))!;
    expect(first.lastDate).toBe(iso(30));
    expect(first.isolateIds).toHaveLength(2);
  });

  it("sentinel: another flag back on a unit after 90 quiet days is medium", () => {
    const data = [
      ...background("W1", 0, 400, 1),
      res({ day: 5, phenotypes: ["esbl"] }), // before the unit has history: no signal
      res({ day: 250, phenotypes: ["esbl"] }), // 245 days quiet: new
      res({ day: 260, phenotypes: ["esbl"] }), // joins it
      res({ day: 300, phenotypes: ["esbl"] }), // only 40 days quiet: nothing new
    ];
    const s = of(detectSignals(data, iso(399), catalog), "sentinel");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ severity: "medium", phenotype: "esbl", firstDate: iso(250), lastDate: iso(260), patients: 2 });
  });

  it("surge: many patients with a flag in two weeks against a quiet year", () => {
    const data = [...background("W1", 0, 420, 2)];
    for (let d = 20; d < 400; d += 60) data.push(res({ day: d, phenotypes: ["esbl"] }));
    for (let d = 405; d < 412; d++) data.push(res({ day: d, phenotypes: ["esbl"] }));
    const before = of(detectSignals(data, iso(400), catalog), "surge");
    expect(before).toHaveLength(0);
    const s = of(detectSignals(data, iso(415), catalog), "surge");
    expect(s).toHaveLength(1);
    expect(s[0]!.severity).toBe("high");
    expect(s[0]!.phenotype).toBe("esbl");
    expect(s[0]!.observed).toBeGreaterThanOrEqual(3);
    expect(s[0]!.expected!).toBeLessThan(1);
  });

  it("cluster: same organism and unusual profile on one unit, more than the hospital mix predicts", () => {
    const rand = rng(1);
    const data: Result[] = [];
    for (let d = 0; d < 420; d++) {
      for (const ward of ["W1", "W2", "W3"]) {
        data.push(res({ day: d, ward, results: { A1: rand() < 0.3 ? "R" : "S", A2: "S", A3: "S" } }));
      }
    }
    const profile = { A1: "R" as const, A2: "R" as const, A3: "R" as const };
    for (let d = 400; d < 408; d += 2) data.push(res({ day: d, ward: "W2", results: profile }));
    const s = of(detectSignals(data, iso(410), catalog), "cluster");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ ward: "W2", severity: "high", organism: "Org a", specimen: "urine", resists: ["A1", "A2", "A3"] });
    expect(s[0]!.patients).toBe(4);
    // The common profile (A1 only, 30 % of isolates) never makes a cluster.
    expect(s.some((x) => x.resists?.join() === "A1")).toBe(false);
  });

  it("data-gap: a unit that stops sending is a data problem", () => {
    const data = [...background("W1", 0, 300, 5), ...background("W2", 0, 310, 5)];
    const s = of(detectSignals(data, iso(306), catalog), "data-gap");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ ward: "W1", severity: "medium", isolateIds: [] });
    expect(s[0]!.observed).toBeLessThan(s[0]!.expected!);
    // Days after the last result of the whole feed are evaluated too.
    const later = of(detectSignals(data, iso(315), catalog), "data-gap");
    expect(later.map((x) => x.ward).sort()).toEqual(["W1", "W2"]);
  });

  it("shift: an antibiotic works much less often on a unit in the last 4 weeks", () => {
    const rand = rng(2);
    const data: Result[] = [];
    for (let d = 0; d < 400; d++) {
      const pR = d >= 380 ? 0.7 : 0.05;
      for (let k = 0; k < 2; k++) data.push(res({ day: d, results: { A1: rand() < pR ? "R" : "S", A2: "S", A3: "S" } }));
    }
    const s = of(detectSignals(data, iso(399), catalog), "shift");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ ward: "W1", antibiotic: "A1", severity: "medium" });
    expect(s[0]!.recent!.n).toBeGreaterThanOrEqual(30);
    expect(s[0]!.baseline!.n).toBeGreaterThanOrEqual(30);
    expect(s[0]!.observed).toBeGreaterThan(s[0]!.expected!);
  });

  it("shift: never raised on fewer than 30 recent isolates (the organiser's floor)", () => {
    const rand = rng(2);
    const data: Result[] = [];
    for (let d = 0; d < 400; d++) {
      // One isolate a day: 28 in the window, however clearly it fails.
      const pR = d >= 380 ? 0.9 : 0.05;
      data.push(res({ day: d, results: { A1: rand() < pR ? "R" : "S", A2: "S", A3: "S" } }));
    }
    expect(of(detectSignals(data, iso(399), catalog), "shift")).toHaveLength(0);
  });

  it("trend: resistance rising hospital-wide over years", () => {
    const rand = rng(3);
    const data: Result[] = [];
    for (let d = 0; d < 1000; d++) {
      const pR = 0.05 + (0.2 * d) / 1000;
      for (let i = 0; i < 3; i++)
        data.push(res({ day: d, ward: i ? "W1" : "W2", results: { A1: "S", A2: rand() < pR ? "R" : "S", A3: "S" } }));
    }
    const s = of(detectSignals(data, iso(999), catalog), "trend");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ ward: null, antibiotic: "A2", organism: "Org a", specimen: "urine" });
    expect(s[0]!.series!.length).toBeGreaterThan(8);
    expect(s[0]!.observed - s[0]!.expected!).toBeGreaterThanOrEqual(2);
  });

  it("is causal: later results never change what is known on an earlier day", () => {
    const rand = rng(4);
    const data: Result[] = [...background("W1", 0, 500, 3), ...background("W2", 0, 500, 2)];
    for (let d = 300; d < 500; d += 7) data.push(res({ day: d, phenotypes: rand() < 0.5 ? ["esbl"] : ["cpe"] }));
    for (let d = 450; d < 460; d++) data.push(res({ day: d, phenotypes: ["esbl"], ward: "W2" }));
    for (const cut of [320, 455, 499]) {
      const asOf = iso(cut);
      resetSignalCache();
      const withFuture = detectSignals(data, asOf, catalog);
      resetSignalCache();
      const past = detectSignals(
        data.filter((r) => r.sampleDate <= asOf),
        asOf,
        catalog,
      );
      expect(withFuture).toEqual(past);
      expect(withFuture.every((s) => s.lastDate <= asOf && s.firstDate <= s.lastDate)).toBe(true);
    }
    // And with a warm cache, going back in time gives the same answer as a cold call.
    const warm = detectSignals(data, iso(400), catalog);
    resetSignalCache();
    expect(detectSignals(data, iso(400), catalog)).toEqual(warm);
  });

  it("merges daily signals into episodes with stable ids as days pass", () => {
    // A unit stops for 10 days, recovers for 5, stops again: one episode. Then a stop 80 days later: a second one.
    const data = [...background("W2", 0, 520, 5)];
    for (let d = 0; d < 520; d++) {
      const off = (d >= 300 && d < 310) || (d >= 315 && d < 325) || (d >= 400 && d < 410);
      if (!off) data.push(...background("W1", d, d + 1, 5));
    }
    const ids = new Map<string, string>();
    let released: Result[] = [];
    let last: Signal[] = [];
    for (let d = 290; d < 520; d++) {
      // The app's way: a new, longer array every day.
      released = [...released, ...data.filter((r) => r.sampleDate === iso(d))];
      if (d === 290) released = data.filter((r) => r.sampleDate <= iso(d));
      last = detectSignals(released, iso(d), catalog);
      for (const s of last) {
        if (!ids.has(s.id)) ids.set(s.id, s.firstDate);
        expect(ids.get(s.id)).toBe(s.firstDate);
      }
    }
    const gaps = of(last, "data-gap");
    expect(gaps).toHaveLength(2);
    expect(gaps.every((g) => g.ward === "W1")).toBe(true);
    expect(gaps.every((g) => g.id === `data-gap|W1|${g.firstDate}`)).toBe(true);
    // Most severe first, then newest.
    expect(gaps[0]!.lastDate > gaps[1]!.lastDate).toBe(true);
    resetSignalCache();
    expect(detectSignals(data, iso(519), catalog)).toEqual(last);
  });

  it("orders by severity, then newest", () => {
    const data = [
      ...background("W1", 0, 400, 3),
      res({ day: 200, phenotypes: ["vre"], organism: "Org e" }),
      res({ day: 350, phenotypes: ["esbl"] }),
    ];
    const s = detectSignals(data, iso(399), catalog);
    expect(s.map((x) => x.severity)).toEqual(["high", "medium"]);
  });

  it("uses the sentinel flags it is given", () => {
    const data = [...background("W1", 0, 50, 1), res({ day: 20, phenotypes: ["XYZ"] })];
    expect(of(detectSignals(data, iso(49), catalog), "sentinel")).toHaveLength(0);
    resetSignalCache();
    const s = of(detectSignals(data, iso(49), catalog, { sentinelPhenotypes: ["xyz"] }), "sentinel");
    expect(s).toHaveLength(1);
    expect(s[0]!.severity).toBe("high");
  });
});
