import type { IsolateRecord } from "@aei/domain";
import { addDays } from "@aei/replay";
import { describe, expect, it } from "vitest";
import { coverage, IV_ONLY, suggest, suggestCombinations, wilson } from "./index.ts";

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
    expect(uro.level).toBe("unit");
    expect(uro.antibiotics.find((a) => a.antibiotic === "CIP")?.share).toBeCloseTo(0.9, 10);
    const icu = coverage(records, { asOf: "2026-06-30", ward: "ICU", specimen: "urine" });
    expect(icu.level).toBe("ward type");
    expect(icu.isolates).toBe(50);
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

describe("review fixes (D-033)", () => {
  it("judges untested shares on the level actually used, so a sparse unit cannot hide them", () => {
    // PHC-N has 4 blood isolates, so the ward type is used; there a third are S. aureus, never tested on ciprofloxacin.
    const records = [
      ...Array.from({ length: 4 }, () => iso({ ward: "PHC-N", specimen: "blood", results: { CIP: "S" } })),
      ...Array.from({ length: 36 }, () => iso({ ward: "ED", specimen: "blood", results: { CIP: "S" } })),
      ...Array.from({ length: 20 }, () => iso({ ward: "ED", specimen: "blood", organism: "Staphylococcus aureus", results: { FOX: "S" } })),
    ];
    const result = coverage(records, { asOf: "2026-06-30", ward: "PHC-N", specimen: "blood" });
    expect(result.level).toBe("ward type");
    const cip = suggest(result, "severe").find((s) => s.antibiotic === "CIP");
    expect(cip?.standing).toBe("not assessable");
  });

  it("drops the sex filter before giving up the unit's own data", () => {
    const records = [...Array.from({ length: 25 }, () => iso({ sex: "F" })), ...Array.from({ length: 25 }, () => iso({ sex: "M" }))];
    const result = coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "urine", sex: "F" });
    expect(result.level).toBe("unit");
    expect(result.sexApplied).toBe(false);
    expect(result.isolates).toBe(50);
  });

  it("leaves injection-only drugs out of mild suggestions and always gives the all-organism share", () => {
    const records = Array.from({ length: 40 }, () => iso({ specimen: "wound", results: { MEM: "S", CXM: "S" } }));
    const list = suggest(coverage(records, { asOf: "2026-06-30", ward: "SURG", specimen: "wound" }), "mild");
    expect(list.some((s) => IV_ONLY.includes(s.antibiotic))).toBe(false);
    expect(list.find((s) => s.antibiotic === "CXM")?.allOrganisms.share).toBe(1);
  });

  it("does not suggest a pair whose partner adds nothing", () => {
    // Blood: TZP misses the MRSA, VAN covers it; CLI adds nothing over TZP.
    const records = [
      ...Array.from({ length: 40 }, () => iso({ specimen: "blood", results: { TZP: "S", CIP: "R" } })),
      ...Array.from({ length: 8 }, () =>
        iso({ specimen: "blood", organism: "Staphylococcus aureus", results: { FOX: "R", VAN: "S", CLI: "R" } }),
      ),
    ];
    const combos = suggestCombinations(coverage(records, { asOf: "2026-06-30", ward: "ICU", specimen: "blood" }), "severe");
    const names = combos.map((c) => c.antibiotics.join("+"));
    expect(names).toContain("TZP+VAN");
    expect(names.some((n) => n.includes("CLI"))).toBe(false);
    expect(combos.every((c) => c.gain >= 0.02)).toBe(true);
  });
});

describe("age group and onset (D-047)", () => {
  const day3 = { admissionDate: "2026-05-30", sampleDate: "2026-06-01" }; // day 3 of the stay
  const day2 = { admissionDate: "2026-05-31", sampleDate: "2026-06-01" };

  it("keeps only the age group and hospital-onset isolates asked for", () => {
    const records = [
      ...Array.from({ length: 30 }, () => iso({ ageYears: 70, ...day3, results: { CIP: "R" } })),
      ...Array.from({ length: 30 }, () => iso({ ageYears: 40, ...day3, results: { CIP: "S" } })),
      ...Array.from({ length: 30 }, () => iso({ ageYears: 70, ...day2, results: { CIP: "S" } })),
      ...Array.from({ length: 30 }, () => iso({ ageYears: 70, results: { CIP: "S" } })), // outpatient: no admission
    ];
    const r = coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "urine", ageGroup: "older", onset: "hospital" });
    expect(r.level).toBe("unit");
    expect(r.isolates).toBe(30);
    expect(r.ageGroupApplied).toBe(true);
    expect(r.onsetApplied).toBe(true);
    expect(r.query).toMatchObject({ ageGroup: "older", onset: "hospital" });
    expect(r.antibiotics.find((a) => a.antibiotic === "CIP")?.share).toBe(0);
    expect(coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "urine", ageGroup: "adult" }).isolates).toBe(30);
  });

  it("uses the fixed table's bounds, 80+ inside 65+", () => {
    const records = [17, 18, 64, 65, 79, 80].map((ageYears) => iso({ ageYears }));
    const n = (ageGroup: "child" | "adult" | "older" | "veryOld") =>
      coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "urine", ageGroup }).isolates;
    expect([n("child"), n("adult"), n("older"), n("veryOld")]).toEqual([1, 2, 3, 1]);
  });

  it("drops age group, then onset, then sex before giving up the unit's own data", () => {
    const records = [
      ...Array.from({ length: 20 }, () => iso({ sex: "M", ageYears: 70, ...day3 })),
      ...Array.from({ length: 15 }, () => iso({ sex: "M", ageYears: 40, ...day3 })),
      ...Array.from({ length: 20 }, () => iso({ sex: "F", ageYears: 70 })),
    ];
    const q = { asOf: "2026-06-30", ward: "URO", specimen: "urine", sex: "M", ageGroup: "older", onset: "hospital" } as const;
    const r = coverage(records, q);
    expect([r.level, r.isolates, r.ageGroupApplied, r.onsetApplied, r.sexApplied]).toEqual(["unit", 35, false, true, true]);
    const fewer = coverage(
      [
        ...Array.from({ length: 15 }, () => iso({ sex: "M", ageYears: 70, ...day3 })),
        ...Array.from({ length: 15 }, () => iso({ sex: "M", ageYears: 40 })),
        ...Array.from({ length: 20 }, () => iso({ sex: "F", ageYears: 70 })),
      ],
      q,
    ); // 30 men, 15 of them hospital-onset: age and onset go, sex stays
    expect([fewer.level, fewer.isolates, fewer.ageGroupApplied, fewer.onsetApplied, fewer.sexApplied]).toEqual([
      "unit",
      30,
      false,
      false,
      true,
    ]);
  });

  it("keeps every filter and widens the level when the unit is short even without them", () => {
    const records = [
      ...Array.from({ length: 10 }, () => iso({ ward: "ICU", ageYears: 85, ...day3 })),
      ...Array.from({ length: 40 }, () => iso({ ward: "MED-A", ageYears: 85, ...day3 })),
      ...Array.from({ length: 40 }, () => iso({ ward: "MED-A", ageYears: 30 })),
    ];
    const r = coverage(records, { asOf: "2026-06-30", ward: "ICU", specimen: "urine", ageGroup: "veryOld", onset: "hospital" });
    expect([r.level, r.isolates, r.ageGroupApplied, r.onsetApplied]).toEqual(["ward type", 50, true, true]);
  });
});
