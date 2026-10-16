import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EVERY_UNIT } from "./count.ts";
import type { Catalog } from "../../model/types.ts";
import type { FeedMeta, Result } from "../../feed/types.ts";
import { ReportScreen, type ReportPrefs } from "./index.tsx";
import {
  buildMatrix,
  buildTable,
  cellFromShare,
  csvField,
  csvFilename,
  largestDrop,
  matrixCsv,
  MIN,
  RECENT_DAYS,
  sortRows,
  tableCsv,
  tintOf,
  toCsv,
  YEAR_DAYS,
  type CsvLabels,
} from "./model.ts";

// A small invented feed (test data only): two units, E. coli with
// ciprofloxacin and nitrofurantoin, which it does not resist by nature (so a
// missing result is "not tested", never "expected resistant"), and a screen.

const meta: FeedMeta = {
  start: "2023-06-01",
  end: "2024-12-31",
  units: [
    { code: "U1", en: "Ward one", fi: "Osasto yksi", type: "in", institution: "hospital" },
    { code: "U2", en: "Clinic two", fi: "Klinikka kaksi", type: "out", institution: "primary_care" },
  ],
  antibiotics: [
    { code: "CIP", en: "drug one", fi: "lääke yksi", class: "c1", reportedFor: "all" },
    { code: "NIT", en: "drug two", fi: "lääke kaksi", class: "c2", reportedFor: "urine" },
    { code: "FOX", en: "screen (screen)", fi: "seula", class: "screen", reportedFor: "all" },
  ],
  organisms: ["Escherichia coli", "Klebsiella pneumoniae"],
  specimens: [
    { code: "urine", en: "urine", fi: "virtsa" },
    { code: "blood", en: "blood", fi: "veri" },
  ],
  ai: false,
};
const catalog: Catalog = { units: meta.units, antibiotics: meta.antibiotics };
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
    organism: "Escherichia coli",
    sex: "F",
    ageYears: 50,
    phenotypes: [],
    results: { CIP: "S" },
    ...p,
  };
}

function feed(): Result[] {
  const out: Result[] = [];
  // U1, last 4 weeks: 40 patients, CIP works in 36.
  for (let i = 0; i < 40; i++) out.push(res({ patientId: `R${i}`, sampleDate: "2024-06-10", results: { CIP: i < 36 ? "S" : "R" } }));
  // U1, earlier in the year: 50 patients, CIP works in 40; NIT tested in 20 of them.
  for (let i = 0; i < 50; i++) {
    const results: Result["results"] = { CIP: i < 40 ? "S" : "R" };
    if (i < 20) results.NIT = "S";
    out.push(res({ patientId: `Y${i}`, sampleDate: "2024-01-15", results }));
  }
  // The same patient again in the window: not a first isolate.
  out.push(res({ patientId: "R0", sampleDate: "2024-06-20", results: { CIP: "R" } }));
  // U2: 30 patients in March, all susceptible.
  for (let i = 0; i < 30; i++) out.push(res({ patientId: `U${i}`, ward: "U2", sampleDate: "2024-03-01", sex: "M", ageYears: 70 }));
  // U1, blood: only 5 patients in the year.
  for (let i = 0; i < 5; i++) out.push(res({ patientId: `B${i}`, specimen: "blood", sampleDate: "2024-05-01" }));
  // Older than a year: never counted.
  for (let i = 0; i < 5; i++) out.push(res({ patientId: `O${i}`, sampleDate: "2023-06-01", results: { CIP: "R" } }));
  return out.sort((a, b) => (a.sampleDate < b.sampleDate ? -1 : a.sampleDate > b.sampleDate ? 1 : 0));
}

const results = feed();

describe("report model: antibiotics", () => {
  const model = buildTable(results, asOf, { ward: "U1", specimen: "urine" }, catalog);

  it("counts first isolates per window exactly as filtered, without widening", () => {
    expect(model.recentN).toBe(40);
    expect(model.yearN).toBe(90);
    expect(model.hospitalN).toBe(120);
    const a1 = model.rows.find((r) => r.code === "CIP");
    expect(a1?.recent).toEqual({ state: "ok", share: { works: 36, n: 40 } });
    expect(a1?.year).toEqual({ state: "ok", share: { works: 76, n: 90 } });
    expect(a1?.hospital).toEqual({ state: "ok", share: { works: 106, n: 120 } });
    // 90 % vs 84.4 %: +6 points.
    expect(a1?.change).toBe(6);
    expect(a1?.months).toHaveLength(12);
  });

  it("leaves out screens and antibiotics with over a fifth of the isolates untested", () => {
    expect(model.rows.map((r) => r.code)).toEqual(["CIP"]);
    expect(model.hidden).toEqual(["NIT"]);
  });

  it("never shows a percentage under the floor, and no change from thin figures", () => {
    const thin = buildTable(results, asOf, { ward: "U1", specimen: "urine", sex: "F", age: "65plus" }, catalog);
    expect(thin.yearN).toBe(0);
    const men = buildTable(results, asOf, { ward: EVERY_UNIT, specimen: "urine", sex: "M" }, catalog);
    const a1 = men.rows.find((r) => r.code === "CIP");
    expect(men.hospitalN).toBeNull();
    expect(a1?.year.state).toBe("ok");
    expect(a1?.recent.state).toBe("none");
    expect(a1?.change).toBeNull();
    expect(cellFromShare({ works: 29, n: 29 }).state).toBe("few");
    expect(cellFromShare({ works: MIN, n: MIN }).state).toBe("ok");
    expect(cellFromShare({ works: 0, n: 0 }).state).toBe("none");
  });

  it("sorts by the lab list, the 12-month figure or the largest drop", () => {
    const rows = [
      { ...model.rows[0]!, code: "X", order: 0, change: -3 },
      { ...model.rows[0]!, code: "Y", order: 1, change: -12 },
      { ...model.rows[0]!, code: "Z", order: 2, change: null },
    ];
    expect(sortRows(rows, "drop").map((r) => r.code)).toEqual(["Y", "X", "Z"]);
    expect(sortRows(rows, "list").map((r) => r.code)).toEqual(["X", "Y", "Z"]);
    expect(largestDrop(rows)?.code).toBe("Y");
    expect(largestDrop(model.rows)).toBeNull();
  });
});

describe("report model: compare units", () => {
  it("has one row per unit plus every unit, with the same counting", () => {
    const m = buildMatrix(results, asOf, { ward: EVERY_UNIT, specimen: "urine" }, catalog, YEAR_DAYS);
    expect(m.columns.map((c) => c.code)).toEqual(["CIP"]);
    expect(m.rows.map((r) => [r.ward, r.n])).toEqual([
      ["U1", 90],
      ["U2", 30],
    ]);
    expect(m.rows[1]!.cells.get("CIP")).toEqual({ state: "ok", share: { works: 30, n: 30 } });
    expect(m.all.n).toBe(120);
    expect(m.organisms[0]?.organism).toBe("Escherichia coli");
  });

  it("marks thin and empty cells instead of giving a percentage", () => {
    const m = buildMatrix(results, asOf, { ward: EVERY_UNIT, specimen: "urine" }, catalog, RECENT_DAYS);
    expect(m.rows[0]!.cells.get("CIP")?.state).toBe("ok");
    expect(m.rows[1]!.cells.get("CIP")?.state).toBe("none");
  });

  it("shades less effective cells more strongly", () => {
    expect(tintOf(1)).toBe(0);
    expect(tintOf(0)).toBe(50);
    expect(tintOf(0.9)).toBeLessThan(tintOf(0.6));
  });
});

describe("report CSV", () => {
  const labels: CsvLabels = {
    unitName: (c) => meta.units.find((u) => u.code === c)?.en ?? c,
    allUnits: "All units",
    antibioticName: (c) => meta.antibiotics.find((a) => a.code === c)?.en ?? c,
    specimen: "urine",
    organism: null,
    sex: null,
    age: null,
  };

  it("quotes per RFC 4180 and defuses spreadsheet formulas", () => {
    expect(csvField('a "b", c')).toBe('"a ""b"", c"');
    expect(csvField("=SUM(CIP)")).toBe("'=SUM(CIP)");
    expect(csvField(-12)).toBe("-12");
    expect(csvField(null)).toBe("");
    expect(toCsv([["a", 1], ["b", null]])).toBe("a,1\r\nb,\r\n");
  });

  it("writes the antibiotics table with counts, and a percentage only from the floor", () => {
    const thin = buildTable(results, asOf, { ward: "U1", specimen: "urine", sex: "F" }, catalog);
    const lines = tableCsv(thin, labels).trim().split("\r\n");
    const head = lines[0]!.split(",");
    const row = lines[1]!.split(",");
    expect(row).toHaveLength(head.length);
    const get = (name: string) => row[head.indexOf(name)];
    expect(get("antibiotic")).toBe("drug one");
    expect(get("recent_works")).toBe("36");
    expect(get("recent_n")).toBe("40");
    expect(get("recent_percent_works")).toBe("90");
    expect(get("year_percent_works")).toBe("84.4");
    expect(get("all_units_year_n")).toBe("90");

    const men = buildTable(results, asOf, { ward: "U2", specimen: "urine", age: "65plus" }, catalog);
    const mline = tableCsv(men, labels).trim().split("\r\n")[1]!.split(",");
    expect(mline[head.indexOf("recent_status")]).toBe("no_results");
  });

  it("writes the unit comparison in long form, every unit included", () => {
    const m = buildMatrix(results, asOf, { ward: EVERY_UNIT, specimen: "urine" }, catalog, YEAR_DAYS);
    const lines = matrixCsv(m, labels).trim().split("\r\n");
    expect(lines).toHaveLength(1 + 3);
    expect(lines[3]).toContain("All units");
  });

  it("names the file after unit, specimen, organism and date", () => {
    expect(csvFilename(["MED-A", "urine", "Escherichia coli", null], "2025-05-12")).toBe("aei_med-a_urine_escherichia-coli_2025-05-12.csv");
    expect(csvFilename(["units", "wound", null, "12-months"], "2025-05-12")).toBe("aei_units_wound_12-months_2025-05-12.csv");
  });
});

describe("ReportScreen", () => {
  const prefs: ReportPrefs = { ward: "U1", specimen: "urine", organism: null, sex: null, age: null, view: "table" };
  const render = (p: Partial<ReportPrefs>, locale: "en" | "fi" = "en") =>
    renderToStaticMarkup(
      h(ReportScreen, { locale, meta, results, asOf, prefs: { ...prefs, ...p }, onPrefs: () => {}, onOpenTreat: () => {} }),
    );

  it("renders the antibiotics view with its evidence and the counting rule", () => {
    const html = render({});
    expect(html).toContain("Drug one");
    expect(html).toContain("n = 40");
    expect(html).toContain("First isolate per patient, organism and specimen in each period.");
    expect(html).toContain("Download CSV");
    expect(html).not.toContain("NaN");
  });

  it("renders the unit comparison, and both languages", () => {
    const html = render({ view: "units" });
    expect(html).toContain("Clinic two");
    expect(html).toContain("report-mx-cell");
    expect(render({ view: "units" }, "fi")).toContain("Yksiköt rinnakkain");
  });

  it("says too few instead of a percentage for a thin group", () => {
    const html = render({ specimen: "blood" });
    expect(html).toContain("Too few");
    expect(html).not.toMatch(/report-pct[^>]*>\d/);
  });
});
