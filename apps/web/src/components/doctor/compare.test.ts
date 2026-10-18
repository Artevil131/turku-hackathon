import type { CoverageResponse } from "@aei/contract";
import { describe, expect, it, vi } from "vitest";
import { compareRows, fetchCompare, overlaps, presetFrames } from "./compare.ts";

const response = (level: string, rows: Record<string, [number, number]>): CoverageResponse =>
  ({
    asOf: "2025-06-04",
    severity: "mild",
    coverage: { level },
    suggestions: Object.entries(rows).map(([antibiotic, [covered, known]]) => ({ antibiotic, coverage: { counts: { covered, known } } })),
    combinationSuggestions: [],
  }) as unknown as CoverageResponse;

describe("timeframe compare", () => {
  it("the default is the last 28 days against the 337 before them, no day in both", () => {
    const { a, b } = presetFrames("2025-06-04", 28);
    expect(a).toEqual({ from: "2025-05-08", to: "2025-06-04" });
    expect(b).toEqual({ from: "2024-06-05", to: "2025-05-07" });
    expect(overlaps(a, b as { from: string; to: string })).toBe(false);
    expect(presetFrames("2025-06-04", 365).b).toBeNull();
  });

  it("asks the shorter frame first and forces its level on the longer one", async () => {
    const coverage = vi.fn(async (q: { windowDays?: number; level?: string }) => response(q.level ?? "ward type", { CIP: [50, 100] }));
    const out = await fetchCompare(
      { coverage } as never,
      { ward: "URO", specimen: "urine" } as never,
      { from: "2025-05-08", to: "2025-06-04" },
      { from: "2024-06-05", to: "2025-05-07" },
    );
    expect(coverage.mock.calls[0]?.[0]).toMatchObject({ asOf: "2025-06-04", windowDays: 28 });
    expect(coverage.mock.calls[0]?.[0]).not.toHaveProperty("level");
    expect(coverage.mock.calls[1]?.[0]).toMatchObject({ asOf: "2025-05-07", windowDays: 337, level: "ward type" });
    expect(out.level).toBe("ward type");
  });

  it("marks a row only when the interval excludes zero and the frames are independent", () => {
    const a = response("unit", { CIP: [40, 100], AMP: [51, 100] });
    const b = response("unit", { CIP: [800, 1000], AMP: [500, 1000] });
    const rows = compareRows(a, b, true);
    expect(rows.map((r) => [r.antibiotic, r.marked])).toEqual([
      ["CIP", true],
      ["AMP", false],
    ]);
    expect(rows[0]?.diff).toBeCloseTo(-0.4);
    expect(compareRows(a, b, false).every((r) => !r.marked)).toBe(true);
  });

  it("gives no difference when a frame has no known result", () => {
    const rows = compareRows(response("unit", { CIP: [0, 0] }), response("unit", { CIP: [8, 10] }), true);
    expect(rows[0]).toMatchObject({ diff: null, marked: false });
  });
});
