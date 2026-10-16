import type { IsolateRecord } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { firstIsolates, susceptibilityCounts } from "./index.ts";

const iso = (isolateId: string, patientId: string, sampleDate: string, extra: Partial<IsolateRecord> = {}) => ({
  isolateId,
  patientId,
  sampleDate,
  organism: "Escherichia coli" as const,
  specimen: "urine" as const,
  ...extra,
});

describe("firstIsolates", () => {
  it("keeps one isolate per patient, organism and specimen, the earliest", () => {
    const records = [
      iso("C3-1", "P1", "2026-01-10", { specimen: "blood" }),
      iso("C2-1", "P1", "2026-01-05"),
      iso("C1-1", "P1", "2026-01-01"),
      iso("C4-1", "P1", "2026-01-02", { organism: "Klebsiella pneumoniae" }),
      iso("C5-1", "P2", "2026-01-03"),
    ];
    expect(firstIsolates(records).map((r) => r.isolateId)).toEqual(["C1-1", "C4-1", "C5-1", "C3-1"]);
  });

  it("starts again in each period", () => {
    const records = [iso("C1-1", "P1", "2026-01-01"), iso("C2-1", "P1", "2026-02-10"), iso("C3-1", "P1", "2026-02-20")];
    expect(firstIsolates(records, { from: "2026-02-01", to: "2026-02-28" }).map((r) => r.isolateId)).toEqual(["C2-1"]);
  });

  it("breaks same-day ties by isolate id and does not reorder the input", () => {
    const records = [iso("C9-1", "P1", "2026-01-01"), iso("C8-1", "P1", "2026-01-01")];
    expect(firstIsolates(records).map((r) => r.isolateId)).toEqual(["C8-1"]);
    expect(records.map((r) => r.isolateId)).toEqual(["C9-1", "C8-1"]);
  });
});

describe("susceptibilityCounts", () => {
  const record = (isolateId: string, patientId: string, sampleDate: string, extra: Partial<IsolateRecord> = {}): IsolateRecord => ({
    cultureId: isolateId,
    admissionDate: null,
    ward: "ICU",
    sex: "M",
    ageYears: 75,
    homeArea: "North",
    phenotypes: [],
    results: { AMP: "S" },
    ...iso(isolateId, patientId, sampleDate, extra),
  });
  it("uses the existing first-isolate rule before counting tested S and R results", () => {
    const records = [
      record("i2", "p1", "2025-01-02", { results: { AMP: "R" } }),
      record("i1", "p1", "2025-01-01"),
      record("i3", "p2", "2025-01-02", { results: { AMP: "R" } }),
      record("i4", "p3", "2025-01-02", { results: {} }),
    ];
    expect(susceptibilityCounts(records)).toEqual([
      { organism: "Escherichia coli", specimen: "urine", antibiotic: "AMP", susceptible: 1, resistant: 1, n: 2 },
    ]);
    expect(records[0]?.isolateId).toBe("i2");
  });
  it("keeps organisms and specimens separate and handles empty selections", () => {
    const counts = susceptibilityCounts([
      record("i1", "p1", "2025-01-01"),
      record("i2", "p1", "2025-01-02", { specimen: "blood" }),
      record("i3", "p1", "2025-01-03", { organism: "Klebsiella pneumoniae" }),
    ]);
    expect(counts).toHaveLength(3);
    expect(counts.every((c) => c.n === 1)).toBe(true);
    expect(susceptibilityCounts([])).toEqual([]);
  });
});
