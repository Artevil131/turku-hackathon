import type { IsolateRecord } from "@aei/domain";
import { addDays } from "@aei/replay";
import { describe, expect, it } from "vitest";
import { coverage, wilson } from "./index.ts";

let n = 0;
const iso = (extra: Partial<IsolateRecord>): IsolateRecord => {
  n++;
  return {
    isolateId: `C${n}-1`,
    cultureId: `C${n}`,
    patientId: `P${n}`,
    sampleDate: "2026-06-01",
    admissionDate: null,
    ward: "URO",
    specimen: "urine",
    organism: "Escherichia coli",
    sex: "F",
    ageYears: 60,
    homeArea: "North",
    phenotypes: [],
    results: { CIP: "S", NIT: "S", CAZ: undefined },
    ...extra,
  };
};

describe("wilson", () => {
  it("matches a known interval and stays inside [0, 1]", () => {
    const [lo, hi] = wilson(3, 3);
    expect(lo).toBeCloseTo(0.4385, 3);
    expect(hi).toBe(1);
  });
});

describe("coverage", () => {
  it("uses the unit when it has enough results and falls back otherwise", () => {
    const records = [
      ...Array.from({ length: 40 }, (_, i) => iso({ results: { CIP: i < 4 ? "R" : "S" } })),
      ...Array.from({ length: 10 }, () => iso({ ward: "ICU", results: { CIP: "R" } })),
    ];
    const uro = coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "urine" });
    const cip = uro.antibiotics.find((a) => a.antibiotic === "CIP");
    expect(cip?.level).toBe("unit");
    expect(cip?.share).toBeCloseTo(0.9, 10);
    const icu = coverage(records, { asOf: "2026-06-30", ward: "ICU", specimen: "urine" });
    expect(icu.antibiotics.find((a) => a.antibiotic === "CIP")?.level).toBe("ward type");
  });

  it("counts resistance by nature as not covering and reports untested organisms", () => {
    const records = [
      ...Array.from({ length: 30 }, () => iso({ organism: "Proteus mirabilis", results: { NIT: "S" } })),
      ...Array.from({ length: 30 }, () => iso({})),
    ];
    const r = coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "urine" });
    const nit = r.antibiotics.find((a) => a.antibiotic === "NIT");
    expect(nit?.share).toBeCloseTo(0.5, 10); // Proteus is intrinsically resistant
    expect(nit?.notCovering).toEqual([{ organism: "Proteus mirabilis", share: 0.5 }]);
    const caz = r.antibiotics.find((a) => a.antibiotic === "CAZ");
    expect(caz?.untested.map((u) => u.organism)).toContain("Escherichia coli");
  });

  it("filters by sex and window, and keeps urine-only agents off blood", () => {
    const records = [iso({ sex: "M" }), iso({ sampleDate: addDays("2026-06-30", -400) })];
    expect(coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "urine", sex: "M" }).organisms).toEqual([
      { organism: "Escherichia coli", isolates: 1, share: 1 },
    ]);
    const blood = coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "blood" });
    expect(blood.antibiotics.map((a) => a.antibiotic)).not.toContain("NIT");
  });
});
