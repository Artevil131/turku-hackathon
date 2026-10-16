import { describe, expect, it } from "vitest";
import type { Signal } from "../../model/types.ts";
import type { FeedMeta, IsoDate, Result } from "../../feed/types.ts";
import { byMonth, laneOrder, packSegments, updateStore, visibleSignals, weekly } from "./aggregate.ts";

// Week-by-week numbers for the Timeline: counted only up to asOf, extended in
// place as results arrive, first isolates per week for the flag share.

const meta: FeedMeta = {
  start: "2024-01-01", // a Monday
  end: "2024-03-31",
  units: [
    { code: "A", en: "Unit A", fi: "Yksikkö A", type: "in", institution: "hospital" },
    { code: "B", en: "Unit B", fi: "Yksikkö B", type: "out", institution: "primary_care" },
    { code: "C", en: "Unit C", fi: "Yksikkö C", type: "in", institution: "hospital" },
  ],
  antibiotics: [],
  organisms: [],
  specimens: [],
  ai: false,
};

let seq = 0;
function r(day: IsoDate, ward: string, patient = `p${seq}`, flags: string[] = [], organism = "o"): Result {
  seq++;
  return {
    isolateId: `i${seq}`,
    cultureId: `c${seq}`,
    patientId: patient,
    sampleDate: day,
    admissionDate: null,
    ward,
    specimen: "s",
    organism,
    sex: "F",
    ageYears: 50,
    phenotypes: flags,
    results: {},
  };
}

function sig(id: string, firstDate: IsoDate, lastDate: IsoDate, extra: Partial<Signal> = {}): Signal {
  return { id, kind: "surge", source: "phenotype-excess", severity: "high", firstDate, lastDate, ward: "A", observed: 3, isolateIds: [], related: [], ...extra };
}

describe("timeline aggregation", () => {
  it("covers whole weeks from the first to the last day of the feed", () => {
    const s = updateStore(null, meta, []);
    expect(s.weeks).toBe(13); // 1 Jan .. 31 Mar 2024: Mondays 1 Jan .. 25 Mar
    const v = weekly(s, "2024-01-10", ["A", "B", "C"]);
    expect(v.weeks[0]!.start).toBe("2024-01-01");
    expect(v.weeks[0]!.end).toBe("2024-01-07");
    expect(v.nowWeek).toBe(1);
    expect(v.weeks[1]!.released).toBe(3); // Mon, Tue, Wed
    expect(v.weeks[2]!.released).toBe(0);
  });

  it("counts results per week and per unit, never after asOf", () => {
    const res = [r("2024-01-01", "A"), r("2024-01-02", "A"), r("2024-01-03", "B"), r("2024-01-09", "A"), r("2024-01-20", "A")];
    const s = updateStore(null, meta, res);
    const v = weekly(s, "2024-01-10", ["A", "B", "C"]);
    expect(v.total.slice(0, 3)).toEqual([3, 1, 0]);
    expect(v.totalSoFar).toBe(4);
    expect(v.lanes[0]!.counts.slice(0, 3)).toEqual([2, 1, 0]);
    expect(v.lanes[1]!.counts.slice(0, 2)).toEqual([1, 0]);
    expect(v.lanes[2]!.totalSoFar).toBe(0);
  });

  it("extends in place when results only grow, and rebuilds after a rewind", () => {
    const a = [r("2024-01-01", "A"), r("2024-01-02", "A")];
    const s1 = updateStore(null, meta, a);
    const b = [...a, r("2024-01-08", "A")];
    const s2 = updateStore(s1, meta, b);
    expect(s2).toBe(s1);
    expect(weekly(s2, "2024-01-14", ["A"]).total.slice(0, 2)).toEqual([2, 1]);
    const rewound = [r("2024-01-01", "A")];
    const s3 = updateStore(s2, meta, rewound);
    expect(s3).not.toBe(s2);
    expect(weekly(s3, "2024-01-14", ["A"]).totalSoFar).toBe(1);
  });

  it("counts the flag share on the first isolate per patient, organism and specimen in the week", () => {
    const res = [
      r("2024-01-01", "A", "p1", ["esbl"]),
      r("2024-01-02", "A", "p1", ["esbl"]), // repeat: same patient, organism, specimen
      r("2024-01-03", "A", "p2", []),
      r("2024-01-04", "A", "p2", [], "other"), // another organism counts
    ];
    const v = weekly(updateStore(null, meta, res), "2024-01-07", ["A"]);
    expect(v.flag[0]).toEqual({ flagged: 1, n: 3 });
    expect(v.phenotypes).toEqual(["esbl"]);
  });

  it("marks weeks without results as gaps and scales heat by the unit's own typical week", () => {
    const res: Result[] = [];
    for (const day of ["2024-01-01", "2024-01-02", "2024-01-15", "2024-01-16", "2024-01-22"]) res.push(r(day, "A"));
    const v = weekly(updateStore(null, meta, res), "2024-01-28", ["A"]);
    const lane = v.lanes[0]!;
    expect(lane.heat[1]).toBe(0); // 8–14 Jan: nothing
    expect(lane.emptyWeeks).toBe(1);
    expect(lane.heat[0]).toBe(1);
    expect(lane.heat[3]).toBeGreaterThan(0);
    expect(lane.heat[3]).toBeLessThan(1);
  });

  it("orders lanes by institution as the feed lists them, unknown units last", () => {
    expect(laneOrder(meta, ["Z", "A"])).toEqual([
      { institution: "hospital", codes: ["A", "C"] },
      { institution: "primary_care", codes: ["B"] },
      { institution: null, codes: ["Z"] },
    ]);
  });

  it("never shows a signal that starts after asOf, and cuts the ones that run past it", () => {
    const out = visibleSignals([sig("a", "2024-01-05", "2024-01-20"), sig("b", "2024-01-15", "2024-01-16")], "2024-01-10");
    expect(out.map((s) => [s.id, s.lastDate])).toEqual([["a", "2024-01-10"]]);
  });

  it("packs overlapping segments on separate tracks and keeps them before NOW", () => {
    const x = (iso: IsoDate, end: boolean) => Number(iso.slice(8, 10)) - 1 + (end ? 1 : 0);
    const { items, tracks } = packSegments(
      [sig("a", "2024-01-01", "2024-01-05"), sig("b", "2024-01-03", "2024-01-04"), sig("c", "2024-01-20", "2024-01-20")],
      x,
      4,
      21,
    );
    expect(tracks).toBe(2);
    const c = items.find((i) => i.signal.id === "c")!;
    expect(c.x2).toBeLessThanOrEqual(21);
    expect(c.x2 - c.x1).toBe(4);
    expect(items.find((i) => i.signal.id === "b")!.track).toBe(1);
  });

  it("groups signals by the month they first showed, newest first", () => {
    const g = byMonth([sig("a", "2024-01-05", "2024-01-05"), sig("b", "2024-02-02", "2024-02-02"), sig("c", "2024-01-20", "2024-01-21")]);
    expect(g.map((m) => m.month)).toEqual(["2024-02-01", "2024-01-01"]);
    expect(g[1]!.items.map((s) => s.id)).toEqual(["c", "a"]);
  });
});
