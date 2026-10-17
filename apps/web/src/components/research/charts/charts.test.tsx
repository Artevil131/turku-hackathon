import type { IsolateRecord, Phenotype } from "@aei/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartView } from "./ChartWindow.tsx";
import { chartTable, chartTitle, computeChart, recordQuery } from "./model.ts";
import { type ChartSpec, defaultSpec, parseSpec, resolveFrame } from "./spec.ts";

// Fixed records and a fixed spec: the figure is drawn from the gear's numbers, so the markup pins them.

let seq = 0;
const rec = (date: string, esbl: boolean, ward: string): IsolateRecord => {
  seq++;
  return {
    isolateId: `i${seq}`,
    cultureId: `c${seq}`,
    patientId: `p${seq}`,
    sampleDate: date,
    admissionDate: null,
    ward,
    specimen: "urine",
    organism: "Escherichia coli",
    sex: "F",
    ageYears: 60,
    homeArea: "x",
    phenotypes: esbl ? (["esbl"] as Phenotype[]) : [],
    results: {},
  } as IsolateRecord;
};
const day = (i: number) => `2026-09-${String(1 + (i % 28)).padStart(2, "0")}`;
const records = [
  ...Array.from({ length: 28 }, (_, i) => rec(day(i), i % 4 === 0, "ICU")),
  ...Array.from({ length: 14 }, (_, i) => rec(day(i * 2), i % 7 === 0, "URO")),
];
const frame = { from: "2026-09-01", to: "2026-09-28" };
const base: ChartSpec = defaultSpec({ window: frame, event: "phenotype:esbl", periodDays: 14, unit: "ICU" });
const icu = records.filter((r) => r.ward === "ICU");
const view = (spec: ChartSpec, rows = icu, locale: "en" | "fi" = "en") =>
  renderToStaticMarkup(<ChartView spec={spec} data={computeChart(rows, spec, frame)} locale={locale} asOf="2026-09-28" />);

describe("chart specs", () => {
  it("resolves a trailing window against the clock and a fixed one up to it", () => {
    expect(resolveFrame(defaultSpec({ window: { weeks: 2 } }), "2026-09-28")).toEqual({ from: "2026-09-15", to: "2026-09-28" });
    expect(resolveFrame(defaultSpec({ window: { weeks: 2 } }), null)).toBeNull();
    expect(resolveFrame(base, "2026-09-10")).toEqual({ from: "2026-09-01", to: "2026-09-10" });
  });
  it("survives JSON and refuses a malformed spec", () => {
    expect(parseSpec(JSON.parse(JSON.stringify(base)))).toEqual(base);
    expect(parseSpec({ ...base, type: "pie" })).toBeNull();
    expect(parseSpec({ ...base, event: "oops" })).toBeNull();
  });
  it("asks the API for the unit unless it draws every unit", () => {
    expect(recordQuery(base, frame)).toMatchObject({ ward: "ICU", from: "2026-09-01" });
    expect(recordQuery({ ...base, type: "multiples" }, frame)).not.toHaveProperty("ward");
  });
});

describe("a chart window", () => {
  it("draws the share line with its band, the title in words and a label that states the numbers", () => {
    const out = view(base);
    expect(chartTitle("en", { ...base, window: { from: "2026-02-03", to: "2026-05-20" } }, null)).toBe(
      "ESBL share per 14 days · Intensive care unit · Feb–May 2026",
    );
    expect(chartTitle("en", base, "2026-09-28")).toBe("ESBL share per 14 days · Intensive care unit · Sept 2026");
    expect(out).toContain("ESBL share per 14 days");
    expect(out).toContain('role="img"');
    // 7 ESBL in 28 ICU isolates is 25 %: the first period (14 isolates, 4 ESBL) and its Wilson interval are in the label.
    expect(out).toMatch(/aria-label="[^"]*1 Sept 28[^"]*%/);
    expect(out).toContain("ch-band");
    expect(out).toContain("Export SVG");
    expect(out).toContain("Export CSV");
    expect(out).toContain('role="button"');
  });
  it("draws bars of weekly counts", () => {
    const out = view({ ...base, type: "bars" });
    expect(out).toContain("ch-bar");
    expect(out).toContain("ESBL per week");
    expect(out).toMatch(/aria-label="[^"]*\d+\/\d+/);
  });
  it("draws the Beta posterior with its mean and credible interval", () => {
    const out = view({ ...base, type: "beta" });
    expect(out).toContain("Beta posterior");
    expect(out).toContain("7 of 28");
    // Flat prior: Beta(8, 22), mean 26.7 %.
    expect(out).toContain("mean 26.7 %");
  });
  it("draws one panel per unit, busiest first, and ignores the unit filter", () => {
    const spec = { ...base, type: "multiples" } as ChartSpec;
    const data = computeChart(records, spec, frame);
    expect(data.type === "multiples" && data.units.map((u) => u.unit)).toEqual(["ICU", "URO"]);
    const out = view(spec, records);
    expect(out.match(/class="ch-panel"/g)?.length).toBe(2);
    expect(out).toContain("weekly share per unit");
  });
  it("states an empty frame instead of drawing nothing", () => {
    const out = view(base, []);
    expect(out).toContain("No isolates in this frame.");
    expect(out).not.toContain('role="img"');
  });
  it("is Finnish in Finnish", () => {
    expect(view(base, icu, "fi")).toContain("Vie SVG");
  });
  it("exports the numbers as a table the CSV exporter takes", () => {
    const t = chartTable(computeChart(icu, base, frame));
    expect(t.columns.map((c) => c.key)).toEqual(["from", "to", "k", "n", "share", "lo", "hi", "slice"]);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]).toMatchObject({ from: "2026-09-01", k: 4, n: 14 });
  });
});
