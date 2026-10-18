import type { Alert } from "@aei/contract";
import { describe, expect, it } from "vitest";
import { linePath, monotoneSegments, pillLabel, pillTip, pillWords, weekIndex } from "./geometry.ts";

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

describe("pillLabel", () => {
  it("shows observed and usual with a middle dot, not a slash", () => {
    const profile: Alert = {
      kind: "detector",
      detector: "profile-excess",
      ward: "URO",
      date: "2025-06-07",
      observed: 7,
      expected: 1.4,
      p: 0.001,
    } as Alert;
    const samples: Alert = {
      kind: "detector",
      detector: "sampling-drop",
      ward: "PHC-S",
      date: "2025-06-07",
      observed: 39,
      expected: 70,
    } as Alert;
    const esbl: Alert = {
      kind: "detector",
      detector: "phenotype-excess",
      phenotype: "esbl",
      ward: "URO",
      date: "2025-06-07",
      observed: 3,
      expected: 0.2,
      p: 0.01,
    } as Alert;
    expect(pillLabel("en", profile)).toBe("profile 7 · 1.4");
    expect(pillLabel("en", samples)).toBe("samples 39 · 70");
    expect(pillLabel("en", esbl)).toBe("ESBL 3 · 0.2");
    expect(pillLabel("fi", profile)).toBe("profiili 7 · 1,4");
  });

  it("leaves a lone count without a separator", () => {
    const rising: Alert = { kind: "detector", detector: "rising-trend", ward: "URO", date: "2025-06-07" } as Alert;
    expect(pillLabel("en", rising)).toBe("trend ↗");
  });
});

describe("pillWords", () => {
  const det = (extra: Partial<Alert>) =>
    ({ kind: "detector", ward: "URO", date: "2025-06-07", observed: 2, expected: 0, ...extra }) as Alert;
  it("says in words what the short label counts", () => {
    expect(pillWords("en", det({ detector: "phenotype-excess", phenotype: "esbl" }))).toBe("ESBL: 2 seen, 0 usual");
    expect(pillWords("en", det({ detector: "sampling-drop", observed: 39, expected: 70 }))).toBe("Sampling: 39 cultures, 70 usual");
    expect(pillWords("en", det({ detector: "rising-trend", ward: null }))).toMatch(/^Rising trend/);
    expect(pillWords("fi", det({ detector: "phenotype-excess", phenotype: "esbl" }))).toBe("ESBL: 2 havaittu, 0 tavallinen");
  });
  it("heads a merged pill with how many signals it holds", () => {
    const a = det({ detector: "phenotype-excess", phenotype: "esbl", id: "a" } as Partial<Alert>);
    const tip = pillTip("en", [a, a, a]);
    expect(tip.split("\n")[0]).toBe("3 signals close together in time");
    expect(tip.split("\n")).toHaveLength(4);
  });
});
