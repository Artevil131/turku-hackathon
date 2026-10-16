import type { Culture, IsolateRecord } from "@aei/domain";
import { addDays } from "@aei/replay";
import { describe, expect, it } from "vitest";
import {
  cochranArmitageRising,
  episodes,
  fisherMidPGreater,
  normalUpper,
  poissonLower,
  poissonUpper,
  profileRule,
  samplingDrop,
} from "./index.ts";

describe("stats", () => {
  it("matches hand-computed values", () => {
    expect(poissonUpper(3, 1)).toBeCloseTo(1 - 2.5 / Math.E, 10);
    expect(poissonUpper(0, 4)).toBe(1);
    expect(poissonLower(0, 7)).toBeCloseTo(Math.exp(-7), 12);
    expect(fisherMidPGreater(3, 0, 0, 3)).toBeCloseTo(0.025, 12);
    expect(fisherMidPGreater(0, 3, 3, 0)).toBeCloseTo(0.975, 12);
    expect(normalUpper(1.959964)).toBeCloseTo(0.025, 5);
    expect(normalUpper(-1.959964)).toBeCloseTo(0.975, 5);
  });

  it("survives a far tail of a tiny mean", () => {
    expect(poissonUpper(100, 1e-3)).toBe(0);
    expect(poissonUpper(3, 1e-3)).toBeGreaterThan(0);
  });

  it("finds a rising proportion and not a flat one", () => {
    expect(
      cochranArmitageRising([
        { events: 0, n: 10 },
        { events: 5, n: 10 },
        { events: 10, n: 10 },
      ]),
    ).toBeLessThan(0.001);
    expect(
      cochranArmitageRising([
        { events: 5, n: 10 },
        { events: 5, n: 10 },
        { events: 5, n: 10 },
      ]),
    ).toBeCloseTo(0.5, 5);
  });
});

const rec = (id: string, patientId: string, sampleDate: string, extra: Partial<IsolateRecord> = {}): IsolateRecord => ({
  isolateId: id,
  cultureId: id,
  patientId,
  sampleDate,
  admissionDate: addDays(sampleDate, -5),
  ward: "URO",
  specimen: "urine",
  organism: "Escherichia coli",
  sex: "F",
  ageYears: 70,
  homeArea: "North",
  phenotypes: [],
  results: { AMP: "R", CRO: "R", CIP: "S" },
  ...extra,
});

describe("profileRule", () => {
  it("fires on the third patient with the same resistant profile within the window", () => {
    const records = [
      rec("a", "P1", "2025-06-01"),
      rec("b", "P2", "2025-06-10"),
      rec("c", "P2", "2025-06-12"), // same patient again
      rec("d", "P3", "2025-06-20"),
      rec("e", "P4", "2025-09-01"),
      rec("f", "P5", "2025-06-15", { results: { AMP: "S", CRO: "S", CIP: "S" } }), // no acquired R
    ];
    const signals = profileRule(records, { minPatients: 3, windowDays: 28, hospitalOnsetOnly: false });
    expect(signals.map((s) => [s.date, s.observed])).toEqual([["2025-06-20", 3]]);
    expect(episodes(signals)).toHaveLength(1);
  });
});

describe("samplingDrop", () => {
  it("signals a week without samples and not normal weeks", () => {
    const cultures: Culture[] = [];
    for (let d = 0; d < 120; d++) {
      const date = addDays("2025-10-01", d);
      if (d >= 90 && d < 97) continue; // a silent week
      for (let i = 0; i < 8; i++) {
        cultures.push({
          cultureId: `C${d}-${i}`,
          patientId: `P${d}-${i}`,
          ageYears: 50,
          sampleDate: date,
          isoYear: 2025,
          isoWeek: 1,
          ward: "PHC-S",
          wardType: "out",
          admissionDate: null,
          specimen: "urine",
          result: "negative",
          nIsolates: 0,
        });
      }
    }
    const eps = episodes(samplingDrop(cultures, { windowDays: 7, baselineDays: 56, alpha: 0.001 }));
    expect(eps).toHaveLength(1);
    // Three silent days take the 7-day count from 56 to 32, below the threshold.
    expect(eps[0]?.first.date).toBe(addDays("2025-10-01", 92));
  });
});
