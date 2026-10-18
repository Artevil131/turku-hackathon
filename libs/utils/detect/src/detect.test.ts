import type { Culture, IsolateRecord } from "@aei/domain";
import { addDays } from "@aei/replay";
import { describe, expect, it } from "vitest";
import {
  binomialUpper,
  cochranArmitageRising,
  emptyRun,
  episodes,
  LIVE_SETTINGS,
  normalUpper,
  poissonLower,
  poissonUpper,
  resistanceShift,
  risingTrend,
  samplingDrop,
  volumeJump,
} from "./index.ts";

describe("stats", () => {
  it("matches hand-computed values", () => {
    expect(poissonUpper(3, 1)).toBeCloseTo(1 - 2.5 / Math.E, 10);
    expect(poissonUpper(0, 4)).toBe(1);
    expect(poissonLower(0, 7)).toBeCloseTo(Math.exp(-7), 12);
    expect(normalUpper(1.959964)).toBeCloseTo(0.025, 5);
    expect(normalUpper(-1.959964)).toBeCloseTo(0.975, 5);
  });

  it("sums the exact binomial upper tail", () => {
    // Binomial(5, 1/2): P(X >= 4) = (5 + 1) / 32; P(X >= 3) = 16 / 32.
    expect(binomialUpper(4, 5, 0.5)).toBeCloseTo(6 / 32, 12);
    expect(binomialUpper(3, 5, 0.5)).toBeCloseTo(0.5, 12);
    // Binomial(10, 0.1): P(X >= 2) = 1 - 0.9^10 - 10 * 0.1 * 0.9^9 = 0.2639010709.
    expect(binomialUpper(2, 10, 0.1)).toBeCloseTo(0.2639010709, 10);
    expect(binomialUpper(0, 10, 0.1)).toBe(1);
    expect(binomialUpper(11, 10, 0.1)).toBe(0);
    expect(binomialUpper(1, 10, 0)).toBe(0);
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

const day0 = "2025-01-01";
const SHIFT = LIVE_SETTINGS.resistanceShift;

/** One E. coli result per day on URO for `days` days, resistant to CIP on days where `isR(d)`. */
const dailyCip = (days: number, isR: (d: number) => boolean, extra: Partial<IsolateRecord> = {}) =>
  Array.from({ length: days }, (_, d) => rec(`s${d}`, `S${d}`, addDays(day0, d), { results: { CIP: isR(d) ? "R" : "S" }, ...extra }));

describe("resistanceShift", () => {
  // 365 days at about 10 % resistant (every tenth day).
  const baseline = (n: number) => dailyCip(n, (d) => d % 10 === 0);

  it("signals a unit's resistant results far above its own year", () => {
    // The last 28 days: ten resistant results in a row, where about three are expected.
    const records = [
      ...baseline(365),
      ...dailyCip(28, (d) => d < 10).map((r, d) => ({ ...r, isolateId: `w${d}`, sampleDate: addDays(day0, 365 + d) })),
    ];
    const signals = resistanceShift(records, SHIFT);
    expect(signals.length).toBeGreaterThan(0);
    const first = signals[0];
    expect(first?.detector).toBe("resistance-shift");
    expect(first?.key).toBe("URO|urine|Escherichia coli|CIP");
    expect(first?.antibiotic).toBe("CIP");
    expect(first?.p).toBeLessThan(SHIFT.alpha);
    expect((first?.observed ?? 0) > (first?.expected ?? 0)).toBe(true);
  });

  it("is quiet on a flat series", () => {
    expect(resistanceShift(baseline(500), SHIFT)).toEqual([]);
  });

  it("needs 30 known results in the baseline", () => {
    // 29 baseline results all susceptible, then a burst of resistant ones: the window would be extreme.
    const burst = (n0: number) => [
      ...Array.from({ length: n0 }, (_, i) => rec(`b${i}`, `B${i}`, addDays(day0, i * 10), { results: { CIP: "S" } })),
      ...Array.from({ length: 6 }, (_, i) => rec(`r${i}`, `R${i}`, addDays(day0, 330 + i * 4), { results: { CIP: "R" } })),
    ];
    // Baseline for the last result (day 350) is days -43..., window days 323..350: 29 results before it.
    const at30 = resistanceShift(burst(30), SHIFT);
    expect(at30.length).toBeGreaterThan(0);
    expect(resistanceShift(burst(29), SHIFT)).toEqual([]);
  });

  it("needs 3 known results in the window", () => {
    const records = [
      ...baseline(365),
      rec("w0", "W0", addDays(day0, 400), { results: { CIP: "R" } }),
      rec("w1", "W1", addDays(day0, 401), { results: { CIP: "R" } }),
    ];
    expect(resistanceShift(records, SHIFT).filter((s) => s.date >= addDays(day0, 400))).toEqual([]);
  });

  it("leaves out isolates the exclude callback names", () => {
    const records = [
      ...baseline(365),
      ...Array.from({ length: 6 }, (_, i) => rec(`w${i}`, `W${i}`, addDays(day0, 370 + i), { results: { CIP: "R" } })),
    ];
    expect(resistanceShift(records, SHIFT).length).toBeGreaterThan(0);
    const excluded = resistanceShift(records, { ...SHIFT, exclude: (r) => r.isolateId.startsWith("w") });
    expect(excluded).toEqual([]);
  });
});

describe("volumeJump", () => {
  const culturesOn = (perDay: (d: number) => number, days: number): Culture[] => {
    const out: Culture[] = [];
    for (let d = 0; d < days; d++)
      for (let i = 0; i < perDay(d); i++)
        out.push({
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
    return out;
  };

  it("signals a week of tripled volume and not normal weeks", () => {
    const eps = episodes(
      volumeJump(
        culturesOn((d) => (d >= 90 && d < 97 ? 24 : 8), 120),
        LIVE_SETTINGS.volumeJump,
      ),
    );
    expect(eps).toHaveLength(1);
    // 8 a day gives 56 a week; a day at 24 takes the 7-day count to 72, then 88, 104 ...
    expect(eps[0]?.detector).toBe("volume-jump");
    const first = eps[0]?.first.date as string;
    expect(first >= addDays("2025-10-01", 90)).toBe(true);
    expect(first <= addDays("2025-10-01", 96)).toBe(true);
  });

  it("is quiet at a steady volume and does not signal a drop", () => {
    expect(
      volumeJump(
        culturesOn(() => 8, 120),
        LIVE_SETTINGS.volumeJump,
      ),
    ).toEqual([]);
    expect(
      volumeJump(
        culturesOn((d) => (d >= 90 && d < 97 ? 0 : 8), 120),
        LIVE_SETTINGS.volumeJump,
      ),
    ).toEqual([]);
  });

  it("does not test a unit with nothing in its baseline", () => {
    expect(
      volumeJump(
        culturesOn((d) => (d >= 70 ? 30 : 0), 120).filter((c) => c.sampleDate >= "2025-12-10"),
        LIVE_SETTINGS.volumeJump,
      ),
    ).toEqual([]);
  });
});
