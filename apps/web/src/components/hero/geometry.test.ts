import { describe, expect, it } from "vitest";
import { linePath, monotoneSegments, weekIndex } from "./geometry.ts";

describe("monotoneSegments", () => {
  it("never overshoots the data", () => {
    const pts = [
      [0, 0],
      [10, 5],
      [20, 5],
      [30, 1],
    ] as const;
    for (const s of monotoneSegments(pts)) {
      expect(s.c1[1]).toBeGreaterThanOrEqual(0);
      expect(s.c1[1]).toBeLessThanOrEqual(5);
      expect(s.c2[1]).toBeLessThanOrEqual(5);
    }
    expect(linePath(pts).startsWith("M0 0C")).toBe(true);
  });
});

describe("weekIndex", () => {
  it("finds the week holding a day", () => {
    expect(weekIndex([10, 17, 24], 18)).toBe(1);
    expect(weekIndex([10, 17, 24], 9)).toBe(-1);
    expect(weekIndex([10, 17, 24], 99)).toBe(2);
  });
});
