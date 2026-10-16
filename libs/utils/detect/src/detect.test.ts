import type { Culture, IsolateRecord } from "@aei/domain";
import { addDays } from "@aei/replay";
import { describe, expect, it } from "vitest";
import { cochranArmitageRising, emptyRun, episodes, normalUpper, poissonLower, poissonUpper, risingTrend, samplingDrop } from "./index.ts";

describe("stats", () => {
  it("matches hand-computed values", () => {
    expect(poissonUpper(3, 1)).toBeCloseTo(1 - 2.5 / Math.E, 10);
    expect(poissonUpper(0, 4)).toBe(1);
    expect(poissonLower(0, 7)).toBeCloseTo(Math.exp(-7), 12);
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

describe("risingTrend", () => {
  it("signals a hospital-wide rise and not a flat series", () => {
    // URO resistance rises 0 % → 50 % over 20 bins; ED stays at 0 %, so the hospital as a whole rises.
    const records: IsolateRecord[] = [];
    for (let bin = 0; bin < 20; bin++) {
      for (let i = 0; i < 10; i++) {
        const date = addDays("2024-01-01", bin * 28 + i);
        const rising = i < bin / 4 ? "R" : "S";
        records.push(rec(`u${bin}-${i}`, `P${bin}-${i}`, date, { results: { CIP: rising } }));
        records.push(rec(`e${bin}-${i}`, `Q${bin}-${i}`, date, { ward: "ED", results: { CIP: "S" } }));
      }
    }
    const opts = { binDays: 28, minBins: 13, alpha: 0.001 };
    const rising = risingTrend(records, [{ organism: "Escherichia coli", antibiotic: "CIP" }], opts);
    expect(rising.length).toBeGreaterThan(0);
    expect(rising[0]?.key).toBe("Escherichia coli|CIP|all");
    const flat = records.filter((r) => r.ward === "ED");
    expect(risingTrend(flat, [{ organism: "Escherichia coli", antibiotic: "CIP" }], opts)).toEqual([]);
  });
});

describe("emptyRun", () => {
  it("signals once the run of empty days is improbable for the unit's volume", () => {
    const cultures: Culture[] = [];
    for (let d = 0; d < 120; d++) {
      if (d >= 90 && d < 95) continue; // five empty days
      for (let i = 0; i < 2; i++) {
        cultures.push({
          cultureId: `C${d}-${i}`,
          patientId: `P${d}-${i}`,
          ageYears: 50,
          sampleDate: addDays("2025-10-01", d),
          isoYear: 2025,
          isoWeek: 1,
          ward: "ICU",
          wardType: "in",
          admissionDate: null,
          specimen: "urine",
          result: "negative",
          nIsolates: 0,
        });
      }
    }
    // 2 a day: exp(-2·3) = 0.0025, exp(-2·4) = 0.00034 < 0.001, so the fourth empty day signals.
    const signals = emptyRun(cultures, { baselineDays: 56, alpha: 0.001 });
    expect(signals.map((s) => [s.date, s.observed])).toEqual([
      [addDays("2025-10-01", 93), 4],
      [addDays("2025-10-01", 94), 5],
    ]);
  });
});
