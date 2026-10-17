import type { Culture, Isolate, Patient, Susceptibility } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { type CheckName, checkRows, type Rows, summarize } from "./index.ts";

const patient = (patientId: string, birthYear = 1950): Patient => ({ patientId, sex: "F", birthYear, homeArea: "North" });
const culture = (cultureId: string, over: Partial<Culture> = {}): Culture => ({
  cultureId,
  patientId: "P1",
  ageYears: 75,
  sampleDate: "2025-06-04",
  isoYear: 2025,
  isoWeek: 23,
  ward: "URO",
  wardType: "in",
  admissionDate: "2025-06-01",
  specimen: "urine",
  result: "positive",
  nIsolates: 1,
  ...over,
});
const isolate = (isolateId: string, over: Partial<Isolate> = {}): Isolate => ({
  isolateId,
  cultureId: isolateId.split("-")[0] ?? "",
  isolateNo: 1,
  organism: "Escherichia coli",
  quantity: null,
  phenotypes: [],
  ...over,
});
const result = (isolateId: string, antibiotic: Susceptibility["antibiotic"], r: "S" | "R"): Susceptibility => ({
  isolateId,
  antibiotic,
  result: r,
  guideline: "EUCAST 2025",
});

const clean = (): Rows => ({
  patients: [patient("P1")],
  cultures: [culture("C1")],
  isolates: [isolate("C1-1")],
  susceptibility: [result("C1-1", "AMP", "R"), result("C1-1", "MEC", "S")],
});

const checks = (rows: Rows, asOf?: string): CheckName[] => [...new Set(checkRows(rows, asOf ? { asOf } : {}).map((f) => f.check))];

describe("checkRows", () => {
  it("finds nothing in consistent rows", () => {
    expect(checkRows(clean())).toEqual([]);
  });

  it("flags broken links, duplicates and counts", () => {
    const rows = clean();
    rows.patients.push(patient("P1"));
    rows.cultures[0] = culture("C1", { nIsolates: 2 });
    rows.cultures.push(culture("C2", { patientId: "P9", result: "negative", nIsolates: 0 }));
    rows.isolates.push(isolate("C3-1"));
    rows.susceptibility.push(result("C1-1", "AMP", "R"), result("C9-1", "CIP", "S"));
    expect(checks(rows).sort()).toEqual(["duplicate-id", "duplicate-result", "isolate-count", "missing-link"]);
  });

  it("flags impossible dates and ages", () => {
    const rows = clean();
    rows.patients[0] = patient("P1", 2026);
    rows.cultures[0] = culture("C1", { admissionDate: "2025-06-10" });
    expect(checks(rows, "2025-06-01").sort()).toEqual(["admission-after-sample", "future-sample", "sample-before-birth"]);
    rows.patients[0] = patient("P1", 1990);
    expect(checks(rows)).toContain("age-mismatch");
  });

  it("flags results that contradict EUCAST facts", () => {
    const rows = clean();
    rows.isolates[0] = isolate("C1-1", { organism: "Klebsiella pneumoniae" });
    rows.susceptibility = [result("C1-1", "AMP", "S")]; // Klebsiella resists ampicillin by nature
    expect(checks(rows)).toEqual(["intrinsic-susceptible"]);

    rows.isolates[0] = isolate("C1-1", { organism: "Enterococcus faecalis" });
    rows.susceptibility = [result("C1-1", "MEC", "S"), result("C1-1", "AMP", "S"), result("C1-1", "TZP", "R")];
    expect(checks(rows).sort()).toEqual(["inferred-contradiction", "no-breakpoint-reported"]);

    rows.cultures[0] = culture("C1", { specimen: "blood" });
    rows.isolates[0] = isolate("C1-1");
    rows.susceptibility = [result("C1-1", "NIT", "S")];
    expect(checks(rows)).toEqual(["specimen-antibiotic"]);
  });

  it("flags phenotypes that do not fit the organism or the marker result", () => {
    const rows = clean();
    rows.isolates[0] = isolate("C1-1", { phenotypes: ["mrsa"] });
    expect(checks(rows)).toEqual(["phenotype-organism"]);
    rows.isolates[0] = isolate("C1-1", { organism: "Staphylococcus aureus", phenotypes: ["mrsa"] });
    rows.susceptibility = [result("C1-1", "FOX", "S")];
    expect(checks(rows)).toEqual(["phenotype-result"]);
    rows.isolates[0] = isolate("C1-1", { organism: "Staphylococcus aureus" });
    rows.susceptibility = [result("C1-1", "FOX", "R")];
    expect(checkRows(rows)[0]?.message).toMatch(/not flagged MRSA, but FOX is R/);
  });

  it("flags a ward type that disagrees with the unit", () => {
    const rows = clean();
    rows.cultures[0] = culture("C1", { wardType: "out" });
    expect(checks(rows)).toEqual(["ward-type"]);
  });
});

describe("summarize", () => {
  it("puts errors first, then the largest counts", () => {
    const rows = clean();
    rows.cultures[0] = culture("C1", { wardType: "out" });
    rows.cultures.push(culture("C2", { patientId: "P9", result: "negative", nIsolates: 0, wardType: "out" }));
    const s = summarize(checkRows(rows));
    expect(s.map((x) => [x.check, x.severity, x.count])).toEqual([
      ["missing-link", "error", 1],
      ["ward-type", "suspect", 2],
    ]);
  });
});
