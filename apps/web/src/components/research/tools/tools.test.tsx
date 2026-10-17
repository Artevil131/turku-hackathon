import type { IsolateRecord, Phenotype } from "@aei/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cellTable, computeBeta, computeCompare, computeDetector, computeRate, poissonInterval, pythonCall, type Slice } from "./model.ts";
import { ResultCell } from "./ResultCell.tsx";
import { previousFrame, sliceSentence, type ToolsProps, ToolsWindow } from "./ToolsWindow.tsx";

// Fixed inputs: every number the cells show comes from the gear calls, so the tests pin the figures.

let seq = 0;
function rec(date: string, esbl: boolean, ward = "ICU"): IsolateRecord {
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
  };
}
const day = (i: number) => `2026-09-${String(1 + (i % 28)).padStart(2, "0")}`;
const batch = (n: number, esbl: number, shift = 0) => Array.from({ length: n }, (_, i) => rec(day(i + shift), i < esbl));

const slice: Slice = { from: "2026-09-01", to: "2026-09-28", unit: "ICU", organism: "", specimen: "", phenotype: "esbl", firstOnly: true };
const frameB = { from: "2026-08-04", to: "2026-08-31", unit: "ICU" };
const html = (cell: Parameters<typeof ResultCell>[0]["cell"], locale: "en" | "fi" = "en") =>
  renderToStaticMarkup(<ResultCell cell={cell} locale={locale} />);

describe("tool 1: rate in a frame", () => {
  const rows = batch(20, 5);
  const result = computeRate(rows, slice);
  it("counts per week and per 100 cultures", () => {
    expect(result.count).toBe(5);
    expect(result.perWeek).toBeCloseTo(1.25, 10);
    expect(result.per100Cultures).toBeCloseTo(25, 10);
    const lo = poissonInterval(5);
    expect(lo.lo).toBeCloseTo(1.6235, 3);
    expect(lo.hi).toBeCloseTo(11.6683, 3);
  });
  it("renders the numbers, the method line and the buttons", () => {
    const out = html({ id: 1, result });
    expect(out).toContain("1.25");
    expect(out).toContain("25");
    expect(out).toContain("5/20");
    expect(out).toContain("Wilson");
    expect(out).toContain("Copy as Python");
    expect(out).toContain("Export CSV");
    expect(pythonCall(result)).toContain("aei.coverage.wilson(k=5, n=20)");
    expect(cellTable(result).rows[0]?.value).toBe(5);
  });
});

describe("tool 2: compare two frames", () => {
  const a = batch(20, 5);
  const b = batch(40, 6, 3);
  const result = computeCompare(a, b, slice, frameB, { type: "phenotype", code: "esbl" });
  it("gives the shares, their difference and the words", () => {
    expect(result.difference?.p1).toBeCloseTo(0.25, 10);
    expect(result.difference?.p2).toBeCloseTo(0.15, 10);
    expect(result.difference?.diff).toBeCloseTo(0.1, 10);
    expect(result.higher).toBe("a");
    expect(result.excludesZero).toBe(false);
    expect(result.ratio?.rate1).toBeCloseTo(5 / 4, 10);
  });
  it("renders both frames and the decision in words", () => {
    const out = html({ id: 2, result });
    expect(out).toContain("25");
    expect(out).toContain("5/20");
    expect(out).toContain("6/40");
    expect(out).toContain("ESBL is higher in frame A.");
    expect(out).toContain("The interval includes zero");
    expect(out.indexOf("ESBL is higher in frame A.")).toBeLessThan(out.indexOf("Frame A:"));
    expect(pythonCall(result)).toContain("aei.compare.proportion_difference(k1=5, n1=20, k2=6, n2=40)");
    expect(html({ id: 2, result }, "fi")).toContain("on suurempi jaksossa A.");
  });
});

describe("tool 4: Beta posterior", () => {
  const rows = batch(20, 5);
  it("flat prior: Beta(6, 16), mean 27.3 %", () => {
    const result = computeBeta(rows, null, slice, { type: "phenotype", code: "esbl" }, null);
    expect(result.posterior.a).toBe(6);
    expect(result.posterior.b).toBe(16);
    const out = html({ id: 3, result });
    expect(out).toContain("27.3");
    expect(out).toContain("5 of 20");
    expect(out).toContain('role="img"');
    expect(out).not.toContain("accepted (D-041)");
    expect(pythonCall(result)).toBe("aei.compare.beta_posterior(k=5, n=20)");
  });
  it("discounted: labelled accepted, with δ, m and the parent share", () => {
    const parent = batch(100, 10);
    const result = computeBeta(rows, parent, slice, { type: "phenotype", code: "esbl" }, { delta: 0.95, m: 30 });
    expect(result.discounted?.parentShare).toBeCloseTo(0.1, 10);
    const out = html({ id: 4, result });
    expect(out).toContain("accepted (D-041), not in the live list");
    expect(out).toContain("δ 0.95");
    expect(out).toContain("m 30");
    expect(pythonCall(result)).toContain("parent_share=0.1");
  });
});

describe("tool 5: detector here", () => {
  it("is labelled exploratory and lists nothing for quiet data", () => {
    const result = computeDetector(batch(60, 1), slice, "phenotype", ["esbl"]);
    const out = html({ id: 5, result });
    expect(out).toContain("exploratory: live thresholds (D-020)");
    expect(pythonCall(result)).toContain("aei.detect.phenotype_excess(records");
  });
});

describe("the Tools window", () => {
  const props = {
    client: {},
    locale: "en",
    asOf: "2025-04-30",
    state: {},
    onChange: () => {},
    reducedMotion: true,
    window: null,
  } as unknown as ToolsProps;
  const out = renderToStaticMarkup(<ToolsWindow {...props} />);

  it("says the slice in one sentence and offers Edit, not a form", () => {
    expect(sliceSentence("en", { ...slice, organism: "Escherichia coli", specimen: "urine" })).toMatch(
      /^Intensive care unit · Escherichia coli · .+ · ESBL · .+ · first isolates$/,
    );
    expect(out).toContain("All units · ");
    expect(out).toContain("Edit");
    expect(out).not.toContain('type="date"');
  });
  it("shows one tool at a time: a picker of five, the tool's line, an empty state in words and Run", () => {
    for (const name of ["Rate", "Compare", "Share over time", "Beta posterior", "Run a detector"])
      expect(out).toContain(`>${name}</button>`);
    expect(out.match(/role="tab"/g)).toHaveLength(5);
    expect(out).toContain("How many per week in this frame, with its interval.");
    expect(out).toContain("Choose a tool and run it on the slice above");
    expect(out).toContain(">Run</button>");
    expect(out).not.toContain("tl-tool");
  });
  it("puts frame B right before frame A, of the same length", () => {
    expect(previousFrame({ ...slice, from: "2026-09-01", to: "2026-09-28" })).toEqual({
      from: "2026-08-04",
      to: "2026-08-31",
      unit: "ICU",
    });
  });
});
