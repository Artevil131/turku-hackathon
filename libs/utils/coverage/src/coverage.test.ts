import type { IsolateRecord } from "@aei/domain";
import { addDays } from "@aei/replay";
import { describe, expect, it } from "vitest";
import { coverage, suggest, suggestCombinations, wilson } from "./index.ts";

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

describe("suggest", () => {
  it("puts Access before Watch among those that clear, and marks borderline and untested", () => {
    const records = Array.from({ length: 200 }, (_, i) =>
      iso({ results: { NIT: i < 196 ? "S" : "R", CIP: i < 198 ? "S" : "R", TMP: i < 170 ? "S" : "R", MEC: i < 184 ? "S" : "R" } }),
    );
    const list = suggest(coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "urine" }), "severe");
    const standing = Object.fromEntries(list.map((s) => [s.antibiotic, s.standing]));
    expect(list[0]?.antibiotic).toBe("NIT"); // Access, 98 %, clears 90 %
    expect(list.findIndex((s) => s.antibiotic === "NIT")).toBeLessThan(list.findIndex((s) => s.antibiotic === "CIP")); // CIP is Watch
    expect(standing.MEC).toBe("borderline"); // 92 %, interval reaches below 90 %
    expect(standing.TMP).toBe("below"); // 85 %
    expect(standing.CAZ).toBe("not assessable"); // never tested on E. coli
  });
});

describe("spectrum", () => {
  it("leaves organisms with no breakpoint out of the spectrum share, but keeps resistance by nature against it", () => {
    const records = [
      ...Array.from({ length: 30 }, () => iso({ results: { MEC: "S" } })), // E. coli, covered
      ...Array.from({ length: 10 }, () => iso({ organism: "Enterococcus faecalis", results: {} })), // mecillinam: no breakpoint
      ...Array.from({ length: 10 }, () => iso({ organism: "Klebsiella pneumoniae", results: { MEC: "R" } })),
    ];
    const mec = coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "urine" }).antibiotics.find((a) => a.antibiotic === "MEC");
    expect(mec?.share).toBeCloseTo(30 / 50, 10); // all organisms: Enterococcus counts as not covered
    expect(mec?.spectrum.share).toBeCloseTo(30 / 40, 10); // within spectrum: Enterococcus left out
    expect(mec?.outsideSpectrum).toEqual([{ organism: "Enterococcus faecalis", share: 0.2 }]);
  });
});

describe("combinations", () => {
  it("covers an isolate when either antibiotic does, and is suggested only when no single one clears", () => {
    const records = [
      ...Array.from({ length: 40 }, () => iso({ specimen: "blood", results: { TZP: "S", VAN: undefined } })), // E. coli: VAN intrinsic R
      ...Array.from(
        { length: 20 },
        () => iso({ specimen: "blood", organism: "Staphylococcus aureus", results: { FOX: "R", VAN: "S" } }), // MRSA: TZP inferred R
      ),
    ];
    const result = coverage(records, { asOf: "2026-06-30", ward: "ICU", specimen: "blood" });
    const pair = result.combinations.find((c) => c.antibiotics.includes("TZP") && c.antibiotics.includes("VAN"));
    expect(pair?.share).toBe(1);
    expect(result.antibiotics.find((a) => a.antibiotic === "TZP")?.share).toBeCloseTo(40 / 60, 10);
    const combos = suggestCombinations(result, "severe");
    expect(combos[0]?.standing).toBe("clears");
    expect(combos.some((c) => c.antibiotics.includes("TZP") && c.antibiotics.includes("VAN"))).toBe(true);
  });
});
