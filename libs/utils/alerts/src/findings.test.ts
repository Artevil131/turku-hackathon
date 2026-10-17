import type { IsolateRecord } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { patientFindings } from "./index.ts";

const record = (isolateId: string, patientId: string, sampleDate: string, phenotypes: IsolateRecord["phenotypes"]): IsolateRecord => ({
  isolateId,
  cultureId: isolateId.split("-")[0] ?? isolateId,
  patientId,
  sampleDate,
  admissionDate: null,
  ward: "ICU",
  specimen: "urine",
  organism: "Escherichia coli",
  sex: "F",
  ageYears: 70,
  homeArea: "North",
  phenotypes,
  results: {},
});

describe("patientFindings (D-050)", () => {
  const records = [
    record("C1-1", "P1", "2025-06-01", ["esbl"]), // 365th day back from 2026-05-31: inside
    record("C2-1", "P1", "2025-05-31", ["mrsa"]), // 366th day back: outside
    record("C3-1", "P1", "2026-03-01", ["cpe", "esbl"]),
    record("C4-1", "P1", "2026-04-01", []), // no phenotype
    record("C5-1", "P2", "2026-04-01", ["vre"]), // another patient
    record("C6-1", "P1", "2026-06-01", ["vre"]), // after the as-of date
    record("C7-1", "P1", "2026-05-31", ["vre"]), // the as-of date itself
  ];

  it("lists the patient's flagged isolates of the past year, newest first, one row per phenotype", () => {
    expect(patientFindings(records, "P1", "2026-05-31").map((f) => [f.isolateId, f.phenotype, f.date])).toEqual([
      ["C7-1", "vre", "2026-05-31"],
      ["C3-1", "esbl", "2026-03-01"],
      ["C3-1", "cpe", "2026-03-01"],
      ["C1-1", "esbl", "2025-06-01"],
    ]);
    expect(patientFindings(records, "P1", "2026-05-31")[0]).toEqual({
      phenotype: "vre",
      date: "2026-05-31",
      ward: "ICU",
      organism: "Escherichia coli",
      isolateId: "C7-1",
    });
  });

  it("takes a shorter window, and gives an empty list for a patient without findings", () => {
    expect(patientFindings(records, "P1", "2026-05-31", 1).map((f) => f.isolateId)).toEqual(["C7-1"]);
    expect(patientFindings(records, "P9", "2026-05-31")).toEqual([]);
  });
});
