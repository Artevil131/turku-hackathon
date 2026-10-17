import { describe, expect, it } from "vitest";
import { weeklyPatients } from "./index.ts";

describe("weeklyPatients", () => {
  const rec = (patientId: string, sampleDate: string, ward = "URO", phenotypes = ["esbl"]) =>
    ({ patientId, sampleDate, ward, phenotypes }) as never;
  it("counts distinct patients per week, ward and phenotype", () => {
    const w = weeklyPatients(
      [
        rec("a", "2025-06-02"),
        rec("a", "2025-06-05"),
        rec("b", "2025-06-08"),
        rec("c", "2025-06-09"),
        rec("d", "2025-06-09", "ICU"),
        rec("e", "2025-06-09", "URO", ["mrsa"]),
        rec("f", "2025-06-16"),
      ],
      "URO",
      "esbl",
      "2025-06-02",
      "2025-06-15",
    );
    expect(w).toEqual([
      { start: "2025-06-02", count: 2 },
      { start: "2025-06-09", count: 1 },
    ]);
  });
  it("drops a partial last week and leaves empty weeks at 0", () => {
    const w = weeklyPatients([], "URO", "esbl", "2025-06-01", "2025-06-24");
    expect(w.map((x) => x.start)).toEqual(["2025-06-01", "2025-06-08", "2025-06-15"]);
    expect(w.every((x) => x.count === 0)).toBe(true);
  });
});
