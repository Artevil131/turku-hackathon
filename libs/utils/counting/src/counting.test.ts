import type { IsolateRecord } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { firstIsolates } from "./index.ts";

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
