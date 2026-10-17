import type { IsolateRecord } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { coverage } from "./index.ts";

// Every coverage level stays within the unit's site (D-051).

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
    results: { CIP: "S", NIT: "S" },
    ...extra,
  };
};

// Tyks: too few urology isolates for the unit, so the figure falls back past it.
const home = [
  ...Array.from({ length: 10 }, () => iso({ results: { CIP: "R" } })),
  ...Array.from({ length: 40 }, () => iso({ ward: "ICU", results: { CIP: "S" } })),
];
// Satasairaala: every isolate ciprofloxacin-resistant, in a unit with the same bare code.
const sata = Array.from({ length: 200 }, () => iso({ ward: "sata/URO", results: { CIP: "R" } }));
const q = { asOf: "2026-06-30", ward: "URO", specimen: "urine" as const };
const cip = (r: ReturnType<typeof coverage>) => r.antibiotics.find((a) => a.antibiotic === "CIP");

describe("coverage across sites", () => {
  it("a second site's rows do not change the first site's numbers", () => {
    const alone = coverage(home, q);
    expect(alone.level).not.toBe("unit");
    expect(cip(alone)?.counts.known).toBe(50);
    expect(coverage([...home, ...sata], q)).toEqual(alone);
  });

  it("a connected site's hospital level holds only its own rows", () => {
    const r = coverage([...home, ...sata.slice(0, 20)], { ...q, ward: "sata/URO" });
    expect(r.level).toBe("hospital");
    expect(r.isolates).toBe(20);
    expect(cip(r)?.share).toBeNull();
  });
});
