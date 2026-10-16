import type { Result } from "@aei/feed";
import { describe, expect, it } from "vitest";
import { ageBandOf, onsetOf } from "./patients.ts";

// Hand-made fixture: codes here are test data, not app logic.
function iso(over: Partial<Result>): Result {
  return {
    isolateId: "I1",
    cultureId: "C1",
    patientId: "P1",
    sampleDate: "2026-03-09",
    admissionDate: null,
    ward: "W1",
    specimen: "urine",
    organism: "Org E",
    sex: "F",
    ageYears: 50,
    phenotypes: [],
    results: {},
    ...over,
  };
}

describe("patient attributes", () => {
  it("counts a sample from day 3 of the stay on as hospital onset", () => {
    expect(onsetOf(iso({ admissionDate: null, sampleDate: "2026-03-05" }))).toBe("community");
    expect(onsetOf(iso({ admissionDate: "2026-03-05", sampleDate: "2026-03-05" }))).toBe("community"); // day 1
    expect(onsetOf(iso({ admissionDate: "2026-03-05", sampleDate: "2026-03-06" }))).toBe("community"); // day 2
    expect(onsetOf(iso({ admissionDate: "2026-03-05", sampleDate: "2026-03-07" }))).toBe("hospital"); // day 3
    expect(onsetOf(iso({ admissionDate: "2026-02-27", sampleDate: "2026-03-01" }))).toBe("hospital"); // across a month
  });

  it("bands age at 65", () => {
    expect(ageBandOf(64)).toBe("under65");
    expect(ageBandOf(65)).toBe("65plus");
  });
});
