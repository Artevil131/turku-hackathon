import { describe, expect, it } from "vitest";
import { phenotypeOfSeries, phenotypeWindows } from "./phenotypeWindows.ts";
import type { WeeklySeries } from "./weekly.ts";

const series = {
  weeks: Array.from({ length: 9 }, (_, i) => `2026-0${i + 1}-01`),
  units: {
    URO: { cultures: [], phenotypes: { mrsa: [999, 1, 2, 3, 4, 5, 6, 7, 8], esbl: [], vre: [], cpe: [] } },
    ICU: { cultures: [], phenotypes: { mrsa: [999, 2, 2, 2, 2, 3, 3, 3, 3], esbl: [], vre: [], cpe: [] } },
  },
} as unknown as WeeklySeries;

describe("hospital phenotype windows", () => {
  it.each(["MRSA carriage", "ESBL blood/CSF, E. coli", "VRE blood/CSF", "CPE carriage, K. pneumoniae"])(
    "matches the prefix, not the THL specimen or organism: %s",
    (group) => expect(phenotypeOfSeries(group)).toBe(group.split(" ")[0]?.toLowerCase()),
  );
  it("rejects an unknown series", () => expect(phenotypeOfSeries("Other MRSA")).toBeNull());
  it("sums units and weeks, using only the latest eight buckets", () => {
    expect(phenotypeWindows(series, "mrsa")).toEqual({
      previous: { from: "2026-02-01", to: "2026-05-01", count: 18 },
      recent: { from: "2026-06-01", to: "2026-09-01", count: 38 },
    });
  });
  it("does not pretend fewer than eight weeks are two four-week windows", () => {
    expect(phenotypeWindows({ ...series, weeks: series.weeks.slice(0, 7) }, "mrsa")).toBeNull();
    expect(phenotypeWindows({ weeks: [], units: {} } as unknown as WeeklySeries, "mrsa")).toBeNull();
  });
});
