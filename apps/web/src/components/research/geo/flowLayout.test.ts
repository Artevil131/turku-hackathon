import { describe, expect, it } from "vitest";
import { bandOpacity, bandPath, flowMatrix, groupFlows, layoutFlow, OTHERS, shadeStep } from "./flowLayout.ts";

const flows = [
  { unit: "MED-B", patients: 4 },
  { unit: "ED", patients: 29 },
  { unit: "ICU", patients: 12 },
  { unit: "GER", patients: 1 },
  { unit: "URO", patients: 1 },
  { unit: "SURG", patients: 12 },
] as const;

describe("groupFlows", () => {
  it("sorts by size, ties by unit code, and shares add up", () => {
    const items = groupFlows([...flows].filter((x) => x.patients > 1));
    expect(items.map((i) => i.unit)).toEqual(["ED", "ICU", "SURG", "MED-B"]);
    expect(items.reduce((s, i) => s + i.share, 0)).toBeCloseTo(1, 10);
  });
  it("groups small flows (under 3 % or n under 2) into one last band", () => {
    const items = groupFlows(flows);
    expect(items.at(-1)).toMatchObject({ key: OTHERS, unit: null, patients: 2 });
    expect(items.at(-1)?.units.sort()).toEqual(["GER", "URO"]);
    const big = [
      { unit: "ED" as const, patients: 100 },
      { unit: "ICU" as const, patients: 3 },
      { unit: "URO" as const, patients: 2 },
      { unit: "GER" as const, patients: 5 },
    ];
    expect(groupFlows(big).map((i) => i.key)).toEqual(["ED", "GER", OTHERS]);
  });
  it("keeps a single small flow under its own name", () => {
    const items = groupFlows([
      { unit: "ED", patients: 50 },
      { unit: "ICU", patients: 1 },
    ]);
    expect(items.map((i) => i.key)).toEqual(["ED", "ICU"]);
  });
  it("caps the number of named bands", () => {
    const items = groupFlows(flows, { maxItems: 2 });
    expect(items.map((i) => i.key)).toEqual(["ED", "ICU", OTHERS]);
    expect(items.at(-1)?.patients).toBe(4 + 12 + 1 + 1);
  });
  it("is empty without patients", () => {
    expect(groupFlows([])).toEqual([]);
  });
});

describe("layoutFlow", () => {
  const ins = groupFlows(flows);
  const outs = groupFlows([
    { unit: "ICU", patients: 20 },
    { unit: "ED", patients: 7 },
    { unit: "SURG", patients: 3 },
  ]);
  const lay = layoutFlow(ins, outs, { span: 300 });

  it("thickness is proportional to patients (above the minimum)", () => {
    const [a, b] = lay.ins;
    expect((a?.t ?? 0) / (a?.patients ?? 1)).toBeCloseTo(lay.k, 8);
    expect((b?.t ?? 0) / (b?.patients ?? 1)).toBeCloseTo(lay.k, 8);
  });
  it("stacks bands in order, touching, at the centre node", () => {
    for (const side of [lay.ins, lay.outs]) {
      for (let i = 1; i < side.length; i++) expect((side[i] as { c0: number }).c0).toBeCloseTo((side[i - 1] as { c1: number }).c1, 8);
      expect((side[0] as { c0: number }).c0).toBeGreaterThanOrEqual(lay.centre.c0 - 1e-9);
      expect((side.at(-1) as { c1: number }).c1).toBeLessThanOrEqual(lay.centre.c1 + 1e-9);
    }
  });
  it("keeps the same order at both ends, so bands never cross, and nodes do not overlap", () => {
    for (const side of [lay.ins, lay.outs]) {
      for (let i = 1; i < side.length; i++) {
        const p = side[i - 1];
        const q = side[i];
        if (!p || !q) continue;
        expect(q.b0).toBeGreaterThanOrEqual(p.b1);
        expect(q.n0).toBeGreaterThanOrEqual(p.n1);
      }
      for (const p of side) {
        expect(p.b0).toBeGreaterThanOrEqual(p.n0 - 1e-9);
        expect(p.b1).toBeLessThanOrEqual(p.n1 + 1e-9);
      }
    }
  });
  it("fits inside the axis even with many bands", () => {
    const many = groupFlows(
      ["ED", "ICU", "GER", "URO", "SURG", "MED-A", "MED-B", "PHC-N"].map((unit) => ({ unit: unit as "ED", patients: 10 })),
    );
    const l = layoutFlow(many, many, { span: 300 });
    expect(l.ins.at(-1)?.n1 ?? 0).toBeLessThanOrEqual(300);
    expect(l.ins[0]?.n0 ?? 0).toBeGreaterThanOrEqual(0);
  });
});

describe("bandPath", () => {
  it("is a closed cubic ribbon and swaps axes when vertical", () => {
    expect(bandPath(0, 10, 20, 100, 30, 40)).toBe("M0.0,10.0 C50.0,10.0 50.0,30.0 100.0,30.0 L100.0,40.0 C50.0,40.0 50.0,20.0 0.0,20.0 Z");
    expect(bandPath(0, 10, 20, 100, 30, 40, true).startsWith("M10.0,0.0 C10.0,50.0")).toBe(true);
  });
});

describe("bandOpacity and shadeStep", () => {
  it("ramps from light to strong, the largest strongest", () => {
    expect(bandOpacity(100, 100, 0.1, 0.6)).toBeCloseTo(0.6, 10);
    expect(bandOpacity(1, 100, 0.1, 0.6)).toBeGreaterThan(0.1);
    expect(bandOpacity(1, 100, 0.1, 0.6)).toBeLessThan(bandOpacity(30, 100, 0.1, 0.6));
    expect(bandOpacity(5, 0, 0.1, 0.6)).toBe(0.1);
  });
  it("shades cells in steps, none for no patients", () => {
    expect(shadeStep(0, 10)).toBe(0);
    expect(shadeStep(1, 100)).toBe(1);
    expect(shadeStep(100, 100)).toBe(7);
    expect(shadeStep(50, 100)).toBe(4);
  });
});

describe("flowMatrix", () => {
  const codes = ["ED", "ICU", "SURG"] as const;
  it("adds repeated pairs, blanks the diagonal and totals rows and columns", () => {
    const m = flowMatrix(
      [
        { from: "ED", to: "ICU", patients: 3 },
        { from: "ED", to: "ICU", patients: 2 },
        { from: "ICU", to: "ICU", patients: 9 },
        { from: "ICU", to: "SURG", patients: 4 },
        { from: "GER", to: "ED", patients: 7 },
      ],
      codes,
    );
    expect(m.n).toEqual([
      [0, 5, 0],
      [0, 0, 4],
      [0, 0, 0],
    ]);
    expect(m.max).toBe(5);
    expect(m.rowTotal).toEqual([5, 4, 0]);
    expect(m.colTotal).toEqual([0, 5, 4]);
  });
});
