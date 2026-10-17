import type { Culture, IsolateRecord } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { weeklySeries, weekStart } from "./weekly.ts";

const rec = (over: Partial<IsolateRecord>): IsolateRecord => ({
  isolateId: "i",
  cultureId: "c",
  patientId: "p1",
  sampleDate: "2025-05-14",
  admissionDate: null,
  ward: "URO",
  specimen: "urine",
  organism: "Escherichia coli",
  sex: "F",
  ageYears: 70,
  homeArea: "North",
  phenotypes: ["esbl"],
  results: {},
  ...over,
});
const cul = (sampleDate: string, ward: Culture["ward"] = "URO") => ({ sampleDate, ward }) as Culture;

describe("weeklySeries", () => {
  it("starts weeks on Monday", () => {
    expect(weekStart("2025-05-14")).toBe("2025-05-12");
    expect(weekStart("2025-05-12")).toBe("2025-05-12");
    expect(weekStart("2025-05-18")).toBe("2025-05-12");
  });

  it("counts distinct patients per phenotype and cultures per week, and nothing after `to`", () => {
    const s = weeklySeries(
      [rec({}), rec({ isolateId: "j" }), rec({ patientId: "p2" }), rec({ patientId: "p3", sampleDate: "2025-05-20" })],
      [cul("2025-05-12"), cul("2025-05-13"), cul("2025-05-20"), cul("2025-05-13", "ICU")],
      "2025-05-12",
      "2025-05-19",
    );
    expect(s.weeks).toEqual(["2025-05-12", "2025-05-19"]);
    expect(s.units.URO?.phenotypes.esbl).toEqual([2, 0]);
    expect(s.units.URO?.cultures).toEqual([2, 0]);
    expect(s.units.ICU?.cultures).toEqual([1, 0]);
  });
});
