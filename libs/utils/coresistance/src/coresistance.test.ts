import type { IsolateRecord } from "@aei/domain";
import { ANTIBIOTICS } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { failsTogether, families, sameFamily } from "./index.ts";
import { handle, parseQuery } from "./route.ts";

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
    results: {},
    ...extra,
  };
};
const many = (k: number, extra: Partial<IsolateRecord>) => Array.from({ length: k }, () => iso(extra));
const q = { asOf: "2026-06-30", ward: "URO", specimen: "urine" } as const;

describe("failsTogether", () => {
  it("counts the share that also resisted B among isolates that resisted A and were tested for both", () => {
    const records = [
      ...many(27, { results: { CRO: "R", CXM: "R" } }),
      ...many(3, { results: { CRO: "R", CXM: "S" } }),
      ...many(20, { results: { CRO: "S", CXM: "S" } }),
    ];
    const r = failsTogether(records, q);
    const link = r.pairs.find((p) => p.antibiotic === "CRO" && p.partner === "CXM");
    expect(link).toMatchObject({ resisted: 30, resistedBoth: 27, share: 0.9, level: "unit" });
    expect(link?.interval[0]).toBeLessThan(0.9);
    expect(link?.interval[1]).toBeGreaterThan(0.9);
    // CXM resisted on only 27: below the floor at every level.
    expect(r.pairs.some((p) => p.antibiotic === "CXM")).toBe(false);
  });

  it("leaves out isolates not tested for B (no inferred or intrinsic values)", () => {
    const records = [...many(30, { results: { CRO: "R", CXM: "R" } }), ...many(40, { results: { CRO: "R" } })];
    const link = failsTogether(records, q).pairs.find((p) => p.antibiotic === "CRO" && p.partner === "CXM");
    expect(link).toMatchObject({ resisted: 30, resistedBoth: 30 });
  });

  it("does not report a pair below the floor anywhere", () => {
    const records = many(29, { results: { CRO: "R", CXM: "R" } });
    expect(failsTogether(records, q).pairs).toHaveLength(0);
    expect(failsTogether(records, { ...q, minResisted: 29 }).pairs).toHaveLength(2);
  });

  it("widens from the unit to its ward type, then the hospital", () => {
    const records = [
      ...many(10, { results: { CRO: "R", CXM: "R" } }),
      ...many(25, { ward: "SURG", results: { CRO: "R", CXM: "S" } }),
      ...many(40, { ward: "ED", results: { CRO: "R", CIP: "R" } }),
    ];
    const r = failsTogether(records, q);
    const cxm = r.pairs.find((p) => p.antibiotic === "CRO" && p.partner === "CXM");
    expect(cxm).toMatchObject({ level: "ward type", resisted: 35, resistedBoth: 10 });
    const cip = r.pairs.find((p) => p.antibiotic === "CRO" && p.partner === "CIP");
    expect(cip).toMatchObject({ level: "hospital", resisted: 40 });
  });

  it("drops patient filters at the unit before widening", () => {
    const records = [
      ...many(20, { sex: "F", results: { CRO: "R", CXM: "R" } }),
      ...many(20, { sex: "M", results: { CRO: "R", CXM: "S" } }),
    ];
    const r = failsTogether(records, { ...q, sex: "F" });
    expect(r.pairs.find((p) => p.antibiotic === "CRO")).toMatchObject({ level: "unit", filters: [], resisted: 40 });
    const enough = failsTogether([...records, ...many(10, { sex: "F", results: { CRO: "R", CXM: "R" } })], { ...q, sex: "F" });
    expect(enough.pairs.find((p) => p.antibiotic === "CRO")).toMatchObject({ level: "unit", filters: ["sex"], resisted: 30 });
  });

  it("counts first isolates only, in the window and specimen", () => {
    const base = many(30, { results: { CRO: "R", CXM: "R" } });
    const records = [
      ...base,
      // Same patient again: not a first isolate.
      iso({ patientId: base[0]?.patientId ?? "", sampleDate: "2026-06-10", results: { CRO: "R", CXM: "S" } }),
      // Outside the window and another specimen.
      iso({ sampleDate: "2025-01-01", results: { CRO: "R", CXM: "S" } }),
      iso({ specimen: "blood", results: { CRO: "R", CXM: "S" } }),
    ];
    const first = failsTogether(records, q).pairs.find((p) => p.antibiotic === "CRO");
    expect(first).toMatchObject({ resisted: 30, resistedBoth: 30 });
  });

  it("works for any codes and keeps the top linked partners per antibiotic", () => {
    const records = many(40, { results: { X1: "R", X2: "R", X3: "S" } as never });
    const r = failsTogether(records, { ...q, top: 1 });
    const x1 = r.byAntibiotic.find((b) => (b.antibiotic as string) === "X1");
    expect(x1?.linked).toHaveLength(1);
    expect(x1?.linked[0]).toMatchObject({ partner: "X2", share: 1 });
  });
});

describe("families", () => {
  it("groups by the code list's class in its order", () => {
    const f = families([
      { code: "a", class: "one" },
      { code: "b", class: "two" },
      { code: "c", class: "one" },
    ]);
    expect(f).toEqual([
      { class: "one", antibiotics: ["a", "c"] },
      { class: "two", antibiotics: ["b"] },
    ]);
  });

  it("puts ceftriaxone and ceftazidime together from the domain list", () => {
    const g = families(ANTIBIOTICS).find((x) => x.antibiotics.includes("CRO"));
    expect(g?.antibiotics).toContain("CAZ");
    expect(sameFamily(ANTIBIOTICS, "CRO", "CAZ")).toBe(true);
    expect(sameFamily(ANTIBIOTICS, "CRO", "CIP")).toBe(false);
  });
});

describe("route", () => {
  it("validates like /api/coverage", () => {
    const wards = ["URO"];
    const specimens = ["urine"];
    expect(parseQuery(new URLSearchParams("ward=URO&specimen=urine&sex=F"), wards, specimens)).toEqual({
      ok: true,
      query: { ward: "URO", specimen: "urine", sex: "F" },
    });
    expect(parseQuery(new URLSearchParams("ward=X&specimen=urine"), wards, specimens).ok).toBe(false);
    expect(parseQuery(new URLSearchParams("ward=URO&specimen=urine&windowDays=0"), wards, specimens).ok).toBe(false);
    expect(parseQuery(new URLSearchParams("ward=URO&specimen=urine&ageGroup=teen"), wards, specimens).ok).toBe(false);
  });

  it("answers with the result and the families", () => {
    const out = handle({ asOf: q.asOf, ward: "URO", specimen: "urine" }, many(30, { results: { CRO: "R", CXM: "R" } }));
    expect(out.asOf).toBe(q.asOf);
    expect(out.failsTogether.pairs).toHaveLength(2);
    expect(out.families.length).toBeGreaterThan(0);
  });
});
