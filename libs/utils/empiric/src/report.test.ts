import type { Result } from "@aei/feed";
import type { Catalog } from "@aei/isolates";
import { describe, expect, it } from "vitest";
import { EVERY_UNIT } from "./coverage.ts";
import { cellFromShare, REPORT_MIN, REPORT_RECENT_DAYS, REPORT_YEAR_DAYS, reportMatrix, reportTable } from "./report.ts";

// A small invented feed (test data only): two units, one specimen, two
// antibiotics, an organism EUCAST does not list (so a missing result is
// "not tested", never "expected resistant").

const catalog: Catalog = {
  units: [
    { code: "U1", en: "Ward one", fi: "Osasto yksi", type: "in", institution: "hospital" },
    { code: "U2", en: "Clinic two", fi: "Klinikka kaksi", type: "out", institution: "primary_care" },
  ],
  antibiotics: [
    { code: "A1", en: "drug one", fi: "lääke yksi", class: "c1", reportedFor: "all" },
    { code: "A2", en: "drug two", fi: "lääke kaksi", class: "c2", reportedFor: "urine" },
    { code: "S1", en: "screen (screen)", fi: "seula", class: "screen", reportedFor: "all" },
  ],
};
const asOf = "2024-06-30";

let seq = 0;
function res(p: Partial<Result> & { sampleDate: string; patientId: string }): Result {
  seq += 1;
  return {
    isolateId: `I${seq}`,
    cultureId: `C${seq}`,
    admissionDate: null,
    ward: "U1",
    specimen: "urine",
    organism: "Genus one",
    sex: "F",
    ageYears: 50,
    phenotypes: [],
    results: { A1: "S" },
    ...p,
  };
}

function feed(): Result[] {
  const out: Result[] = [];
  // U1, last 4 weeks: 40 patients, A1 works in 36.
  for (let i = 0; i < 40; i++) out.push(res({ patientId: `R${i}`, sampleDate: "2024-06-10", results: { A1: i < 36 ? "S" : "R" } }));
  // U1, earlier in the year: 50 patients, A1 works in 40; A2 tested in 20 of them.
  for (let i = 0; i < 50; i++) {
    const results: Result["results"] = { A1: i < 40 ? "S" : "R" };
    if (i < 20) results.A2 = "S";
    out.push(res({ patientId: `Y${i}`, sampleDate: "2024-01-15", results }));
  }
  // The same patient again in the window: not a first isolate.
  out.push(res({ patientId: "R0", sampleDate: "2024-06-20", results: { A1: "R" } }));
  // U2: 30 patients in March, all susceptible.
  for (let i = 0; i < 30; i++) out.push(res({ patientId: `U${i}`, ward: "U2", sampleDate: "2024-03-01", sex: "M", ageYears: 70 }));
  // U1, blood: only 5 patients in the year.
  for (let i = 0; i < 5; i++) out.push(res({ patientId: `B${i}`, specimen: "blood", sampleDate: "2024-05-01" }));
  // Older than a year: never counted.
  for (let i = 0; i < 5; i++) out.push(res({ patientId: `O${i}`, sampleDate: "2023-06-01", results: { A1: "R" } }));
  return out.sort((a, b) => (a.sampleDate < b.sampleDate ? -1 : a.sampleDate > b.sampleDate ? 1 : 0));
}

const results = feed();

describe("reportTable", () => {
  const model = reportTable(results, asOf, { ward: "U1", specimen: "urine" }, catalog);

  it("counts first isolates per window exactly as filtered, without widening", () => {
    expect(model.recentN).toBe(40);
    expect(model.yearN).toBe(90);
    expect(model.hospitalN).toBe(120);
    const a1 = model.rows.find((r) => r.code === "A1");
    expect(a1?.recent).toEqual({ state: "ok", share: { works: 36, n: 40 } });
    expect(a1?.year).toEqual({ state: "ok", share: { works: 76, n: 90 } });
    expect(a1?.hospital).toEqual({ state: "ok", share: { works: 106, n: 120 } });
    // 90 % vs 84.4 %: +6 points.
    expect(a1?.change).toBe(6);
    expect(a1?.months).toHaveLength(12);
  });

  it("leaves out screens and antibiotics tested in fewer than half of the isolates", () => {
    expect(model.rows.map((r) => r.code)).toEqual(["A1"]);
    expect(model.hidden).toEqual(["A2"]);
  });

  it("never shows a percentage under the floor, and no change from thin figures", () => {
    const thin = reportTable(results, asOf, { ward: "U1", specimen: "urine", sex: "F", age: "65plus" }, catalog);
    expect(thin.yearN).toBe(0);
    const men = reportTable(results, asOf, { ward: EVERY_UNIT, specimen: "urine", sex: "M" }, catalog);
    const a1 = men.rows.find((r) => r.code === "A1");
    expect(men.hospitalN).toBeNull();
    expect(a1?.year.state).toBe("ok");
    expect(a1?.recent.state).toBe("none");
    expect(a1?.change).toBeNull();
    expect(cellFromShare({ works: 29, n: 29 }).state).toBe("few");
    expect(cellFromShare({ works: REPORT_MIN, n: REPORT_MIN }).state).toBe("ok");
    expect(cellFromShare({ works: 0, n: 0 }).state).toBe("none");
  });

  it("travels as JSON unchanged", () => {
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });
});

describe("reportMatrix", () => {
  it("has one row per unit plus every unit, with the same counting", () => {
    const m = reportMatrix(results, asOf, { ward: EVERY_UNIT, specimen: "urine" }, catalog, REPORT_YEAR_DAYS);
    expect(m.columns.map((c) => c.code)).toEqual(["A1"]);
    expect(m.rows.map((r) => [r.ward, r.n])).toEqual([
      ["U1", 90],
      ["U2", 30],
    ]);
    expect(m.rows[1]!.cells.A1).toEqual({ state: "ok", share: { works: 30, n: 30 } });
    expect(m.all.n).toBe(120);
    expect(m.organisms[0]?.organism).toBe("Genus one");
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
  });

  it("marks thin and empty cells instead of giving a percentage", () => {
    const m = reportMatrix(results, asOf, { ward: EVERY_UNIT, specimen: "urine" }, catalog, REPORT_RECENT_DAYS);
    expect(m.rows[0]!.cells.A1?.state).toBe("ok");
    expect(m.rows[1]!.cells.A1?.state).toBe("none");
  });
});
