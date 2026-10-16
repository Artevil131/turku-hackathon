import type { Antibiotic, Result, SR } from "@aei/feed";
import { addDays, type Catalog } from "@aei/isolates";
import { describe, expect, it } from "vitest";
import { coverage, DEFAULT_COVERAGE, EVERY_UNIT, MIN_KNOWN_SHARE, monthly, treatmentsFor } from "./coverage.ts";
import type { CoverageOptions, DrugFigure } from "./types.ts";

// Hand-made fixtures: codes here are test data, not app logic.
const ab = (code: string, en: string, cls: string, reportedFor = "all"): Antibiotic => ({ code, en, fi: en, class: cls, reportedFor });
const catalog: Catalog = {
  units: [
    { code: "W1", en: "Ward 1", fi: "Osasto 1", type: "in", institution: "hospital" },
    { code: "W2", en: "Ward 2", fi: "Osasto 2", type: "in", institution: "hospital" },
  ],
  antibiotics: [
    ab("AMP", "ampicillin", "penicillins"), // Access
    ab("CIP", "ciprofloxacin", "fluoroquinolones"), // Watch
    ab("MEM", "meropenem", "carbapenems"), // Watch
    ab("NIT", "nitrofurantoin", "nitrofurans", "urine"), // Access, urine only
    ab("FOX", "cefoxitin (screen)", "MRSA screen"),
    ab("ESB", "ESBL detection", "Screening tests"),
    ab("GEN", "gentamicin", "aminoglycosides"), // never tested in these fixtures
  ],
};

const asOf = "2026-03-10";
const ago = (days: number) => addDays(asOf, -days);

let seq = 0;
function iso(over: Partial<Result> & { res?: Record<string, SR> }): Result {
  seq++;
  const { res, ...rest } = over;
  return {
    isolateId: `I${String(seq).padStart(5, "0")}`,
    cultureId: `C${seq}`,
    patientId: `P${seq}`,
    sampleDate: ago(1),
    admissionDate: null,
    ward: "W1",
    specimen: "urine",
    organism: "Org E",
    sex: "F",
    ageYears: 50,
    phenotypes: [],
    results: res ?? {},
    ...rest,
  };
}

const opts = (o: Partial<CoverageOptions>): Partial<CoverageOptions> => ({ minIsolates: 3, ...o });
const codes = (drugs: DrugFigure[]) => drugs.map((d) => d.antibiotic);
const drug = (drugs: DrugFigure[], code: string) => drugs.find((d) => d.antibiotic === code)!;
const allS = { AMP: "S", CIP: "S", MEM: "S", NIT: "S" } as const;

describe("treatmentsFor", () => {
  it("leaves out screening tests and antibiotics reported for another specimen", () => {
    expect(treatmentsFor(catalog, "urine").map((a) => a.code)).toEqual(["AMP", "CIP", "MEM", "NIT", "GEN"]);
    expect(treatmentsFor(catalog, "blood").map((a) => a.code)).toEqual(["AMP", "CIP", "MEM", "GEN"]);
  });
});

describe("coverage: what is counted", () => {
  const e1 = iso({ res: { AMP: "S", CIP: "S", MEM: "S", NIT: "S" } });
  const e2 = iso({ res: { AMP: "R", CIP: "S", MEM: "S", NIT: "S" } });
  const f1 = iso({ organism: "Org F", res: { AMP: "S", NIT: "S" } });
  const future = iso({ sampleDate: addDays(asOf, 1), res: { AMP: "R", CIP: "R", MEM: "R", NIT: "R" } });
  const results = [e1, e2, f1, future];

  it("leaves an untested isolate out of n when the pair is not expected resistant (organism not known)", () => {
    // Org F is not in the EUCAST table: its missing CIP and MEM results are unknown, not failures.
    const r = coverage(results, asOf, { ward: "W1", specimen: "urine" }, catalog, opts({ rank: "coverage", minIsolates: 2 }));
    expect(r.basis).toMatchObject({ window: "recent", n: 3, recentN: 3, yearN: 3, enough: true, widened: [] });
    expect(drug(r.drugs, "AMP").main).toEqual({ works: 2, n: 3 });
    expect(drug(r.drugs, "CIP").main).toEqual({ works: 2, n: 2 });
    expect(drug(r.drugs, "MEM").main).toEqual({ works: 2, n: 2 });
    expect(drug(r.drugs, "NIT").main).toEqual({ works: 3, n: 3 });
  });

  it("leaves out screens, other specimens' antibiotics and antibiotics never tested", () => {
    const urine = coverage(results, asOf, { ward: "W1", specimen: "urine" }, catalog, opts({}));
    expect(codes(urine.drugs).sort()).toEqual(["AMP", "CIP", "MEM", "NIT"]);
    const blood = coverage(
      [iso({ specimen: "blood", res: { AMP: "S", NIT: "S", FOX: "S" } })],
      asOf,
      { ward: "W1", specimen: "blood" },
      catalog,
      opts({}),
    );
    expect(codes(blood.drugs)).toEqual(["AMP"]);
  });

  it("counts only isolates of the organism with a result once the organism is known", () => {
    const e = coverage(results, asOf, { ward: "W1", specimen: "urine", organism: "Org E" }, catalog, opts({ minIsolates: 2 }));
    expect(e.basis).toMatchObject({ n: 2, widened: [], window: "recent" });
    expect(drug(e.drugs, "AMP").main).toEqual({ works: 1, n: 2 });
    expect(drug(e.drugs, "CIP").main).toEqual({ works: 2, n: 2 });
    const f = coverage(results, asOf, { ward: "W1", specimen: "urine", organism: "Org F" }, catalog, opts({ minIsolates: 1 }));
    expect(codes(f.drugs).sort()).toEqual(["AMP", "NIT"]); // CIP and MEM: no result for Org F in the year
    expect(drug(f.drugs, "NIT").main).toEqual({ works: 1, n: 1 });
  });

  it("counts the first isolate per patient, organism and specimen in each window", () => {
    const p = { patientId: "PX" };
    const rs = [
      iso({ ...p, sampleDate: ago(100), res: { CIP: "S" } }),
      iso({ ...p, sampleDate: ago(50), res: { CIP: "R" } }),
      iso({ ...p, sampleDate: ago(5), res: { CIP: "R" } }),
      iso({ ...p, sampleDate: ago(4), specimen: "blood", res: { CIP: "R" } }), // another specimen: counted separately
    ];
    const r = coverage(rs, asOf, { ward: "W1", specimen: "urine" }, catalog, opts({ minIsolates: 1 }));
    expect(r.basis).toMatchObject({ recentN: 1, yearN: 1 });
    expect(drug(r.drugs, "CIP").year).toEqual({ works: 1, n: 1 }); // the year's first isolate
    expect(drug(r.drugs, "CIP").recent).toEqual({ works: 0, n: 1 }); // the four weeks' first isolate
  });

  it("lists the organisms behind the infection, most common first, whatever organism is asked", () => {
    const rs = [iso({ organism: "Org E" }), iso({ organism: "Org E" }), iso({ organism: "Org E" }), iso({ organism: "Org F" })];
    for (const organism of [undefined, "Org F"]) {
      const r = coverage(rs, asOf, { ward: "W1", specimen: "urine", ...(organism ? { organism } : {}) }, catalog, opts({ minIsolates: 1 }));
      expect(r.organisms).toEqual([
        { organism: "Org E", n: 3, share: 0.75 },
        { organism: "Org F", n: 1, share: 0.25 },
      ]);
    }
  });
});

describe("coverage: widening", () => {
  const admitted = ago(10);
  const rs = [
    iso({ sex: "F", ageYears: 70, admissionDate: admitted, sampleDate: ago(5) }),
    iso({ sex: "F", ageYears: 40, admissionDate: admitted, sampleDate: ago(5) }),
    iso({ sex: "M", ageYears: 50, admissionDate: admitted, sampleDate: ago(5) }),
    iso({ sex: "M", ageYears: 30, admissionDate: null, sampleDate: ago(5) }),
    iso({ ward: "W1", specimen: "blood" }),
    iso({ ward: "W2", specimen: "blood" }),
    iso({ ward: "W2", specimen: "blood" }),
    iso({ ward: "W2", specimen: "blood", organism: "Org F" }),
    iso({ ward: "W2", specimen: "wound", sex: "F" }),
  ].map((r) => ({ ...r, results: { ...allS } }));

  it("drops age, then sex, then onset, then ward, only as far as needed", () => {
    const r = coverage(rs, asOf, { ward: "W1", specimen: "urine", sex: "F", age: "65plus", onset: "hospital" }, catalog, opts({}));
    expect(r.basis.widened).toEqual(["age", "sex"]);
    expect(r.basis.query).toEqual({ ward: "W1", specimen: "urine", onset: "hospital" });
    expect(r.basis).toMatchObject({ yearN: 3, enough: true });
  });

  it("drops onset before ward", () => {
    const r = coverage(rs, asOf, { ward: "W1", specimen: "urine", onset: "community" }, catalog, opts({}));
    expect(r.basis.widened).toEqual(["onset"]);
    expect(r.basis.yearN).toBe(4);
  });

  it("widens to every unit, never dropping organism or specimen", () => {
    const blood = coverage(rs, asOf, { ward: "W1", specimen: "blood" }, catalog, opts({}));
    expect(blood.basis.widened).toEqual(["ward"]);
    expect(blood.basis.query).toEqual({ ward: EVERY_UNIT, specimen: "blood" });
    expect(blood.basis.yearN).toBe(4);

    const organism = coverage(rs, asOf, { ward: "W1", specimen: "blood", organism: "Org E" }, catalog, opts({}));
    expect(organism.basis.widened).toEqual(["ward"]);
    expect(organism.basis.query).toEqual({ ward: EVERY_UNIT, specimen: "blood", organism: "Org E" });
    expect(organism.basis).toMatchObject({ yearN: 3, enough: true });
  });

  it("says when even the widest query is not enough", () => {
    const r = coverage(rs, asOf, { ward: "W1", specimen: "wound", sex: "F" }, catalog, opts({}));
    expect(r.basis.widened).toEqual(["sex", "ward"]);
    expect(r.basis).toMatchObject({ yearN: 1, n: 1, enough: false, window: "year" });
  });
});

describe("coverage: windows and change", () => {
  const recentR = [1, 2, 3].map((d) => iso({ sampleDate: ago(d), res: { CIP: "R" } }));
  const oldS = [100, 101, 102].map((d) => iso({ sampleDate: ago(d), res: { CIP: "S" } }));
  const tooOld = iso({ sampleDate: ago(365), res: { CIP: "S" } }); // outside (asOf - 365, asOf]

  it("leads with the four weeks when they reach the floor, and reports the change", () => {
    const r = coverage([...recentR, ...oldS, tooOld], asOf, { ward: "W1", specimen: "urine" }, catalog, opts({}));
    expect(r.basis).toMatchObject({ window: "recent", n: 3, recentN: 3, yearN: 6 });
    const cip = drug(r.drugs, "CIP");
    expect(cip.main).toEqual(cip.recent);
    expect(cip.recent).toEqual({ works: 0, n: 3 });
    expect(cip.year).toEqual({ works: 3, n: 6 });
    expect(cip.change).toBe(-50);
  });

  it("falls back to the year and gives no change when the four weeks are thin", () => {
    const r = coverage([recentR[0]!, recentR[1]!, ...oldS], asOf, { ward: "W1", specimen: "urine" }, catalog, opts({}));
    expect(r.basis).toMatchObject({ window: "year", n: 5, recentN: 2, yearN: 5, enough: true });
    const cip = drug(r.drugs, "CIP");
    expect(cip.main).toEqual({ works: 3, n: 5 });
    expect(cip.change).toBeNull();
  });

  it("gives the hospital-wide year next to the unit's", () => {
    const rs = [
      ...[1, 2, 3].map((d) => iso({ ward: "W1", sampleDate: ago(d), res: { CIP: "S" } })),
      ...[1, 2, 3].map((d) => iso({ ward: "W2", sampleDate: ago(d), res: { CIP: "R" } })),
    ];
    const r = coverage(rs, asOf, { ward: "W1", specimen: "urine" }, catalog, opts({}));
    expect(drug(r.drugs, "CIP").year).toEqual({ works: 3, n: 3 });
    expect(drug(r.drugs, "CIP").hospitalYear).toEqual({ works: 3, n: 6 });
  });
});

describe("coverage: ranking", () => {
  const rs = [
    iso({ res: { AMP: "S", CIP: "S", MEM: "S", NIT: "S" } }),
    iso({ res: { AMP: "S", CIP: "S", MEM: "S", NIT: "S" } }),
    iso({ res: { AMP: "S", CIP: "S", MEM: "S", NIT: "R" } }),
    iso({ res: { AMP: "R", CIP: "R", MEM: "S", NIT: "R" } }),
  ];
  const q = { ward: "W1", specimen: "urine" };
  // MEM 4/4, AMP 3/4 (Access), CIP 3/4, NIT 2/4 (Access)

  it("coverage: highest share first, ties Access first", () => {
    const r = coverage(rs, asOf, q, catalog, opts({ rank: "coverage" }));
    expect(codes(r.drugs)).toEqual(["MEM", "AMP", "CIP", "NIT"]);
    expect(r.topReason).toEqual({ kind: "highest" });
  });

  it("access-first: keeps the strongest first when no Access antibiotic is within the margin", () => {
    const r = coverage(rs, asOf, q, catalog, opts({ rank: "access-first", accessMargin: 10 }));
    expect(codes(r.drugs)).toEqual(["MEM", "AMP", "CIP", "NIT"]);
    expect(r.topReason).toEqual({ kind: "highest" });
  });

  it("access-first: puts an Access antibiotic within the margin first and names the strongest", () => {
    const r = coverage(rs, asOf, q, catalog, opts({ rank: "access-first", accessMargin: 25 }));
    expect(codes(r.drugs)).toEqual(["AMP", "MEM", "CIP", "NIT"]);
    expect(r.topReason).toEqual({ kind: "access-preferred", strongest: "MEM", strongestShare: { works: 4, n: 4 } });
  });

  it("breaks ties Access first, then by catalog order", () => {
    const tied = [1, 2, 3].map(() => iso({ res: { AMP: "S", CIP: "S", MEM: "S", NIT: "R" } }));
    const r = coverage(tied, asOf, q, catalog, opts({ rank: "access-first" }));
    expect(codes(r.drugs)).toEqual(["AMP", "CIP", "MEM", "NIT"]);
    expect(r.topReason).toEqual({ kind: "highest" });
  });

  it("ranks a figure from too few isolates below the reliable ones, and none last", () => {
    const e = { organism: "Org E" };
    const thin = [
      iso({ ...e, res: { AMP: "R", CIP: "S", MEM: "S" } }),
      iso({ ...e, res: { AMP: "R", CIP: "S" } }),
      iso({ ...e, res: { AMP: "R", CIP: "S" } }),
      iso({ ...e, res: { AMP: "R", CIP: "R" } }),
      iso({ ...e, sampleDate: ago(200), res: { NIT: "S" } }), // NIT: a year result only, none in the four weeks
    ];
    const r = coverage(thin, asOf, { ...q, organism: "Org E" }, catalog, opts({ rank: "access-first" }));
    expect(r.basis.window).toBe("recent");
    // CIP 3/4 and AMP 0/4 rest on enough; MEM 1/1 does not; NIT has none in the four weeks.
    expect(codes(r.drugs)).toEqual(["CIP", "AMP", "MEM", "NIT"]);
    expect(drug(r.drugs, "NIT").main).toEqual({ works: 0, n: 0 });
    expect(r.topReason).toEqual({ kind: "highest" });
  });

  it("gives no top reason when there is nothing to rank", () => {
    const r = coverage([], asOf, q, catalog, opts({}));
    expect(r.drugs).toEqual([]);
    expect(r.topReason).toBeNull();
    expect(r.basis).toMatchObject({ n: 0, enough: false, widened: ["ward"] });
  });
});

describe("monthly", () => {
  const rs = [
    iso({ patientId: "A", sampleDate: "2025-12-20", res: { CIP: "R" } }), // before the 3 months
    iso({ patientId: "A", sampleDate: "2026-01-05", res: { CIP: "S" } }),
    iso({ patientId: "A", sampleDate: "2026-01-20", res: { CIP: "R" } }), // repeat in January
    iso({ patientId: "B", sampleDate: "2026-01-10", organism: "Org F", res: {} }), // not tested, not expected resistant: unknown
    iso({ patientId: "C", sampleDate: "2026-03-05", res: { CIP: "S" } }),
    iso({ patientId: "D", sampleDate: "2026-03-15", res: { CIP: "R" } }), // after asOf
    iso({ patientId: "E", sampleDate: "2026-03-06", ward: "W2", res: { CIP: "R" } }), // another unit
  ];

  it("gives each calendar month up to asOf, oldest first, first isolates only", () => {
    expect(monthly(rs, asOf, { ward: "W1", specimen: "urine" }, "CIP", 3)).toEqual([
      { month: "2026-01-01", share: { works: 1, n: 1 } }, // 1 of 2 first isolates known: exactly half, shown
      { month: "2026-02-01", share: { works: 0, n: 0 } },
      { month: "2026-03-01", share: { works: 1, n: 1 } },
    ]);
  });

  it("counts only tested isolates once the organism is known, and every unit when asked", () => {
    expect(monthly(rs, asOf, { ward: "W1", specimen: "urine", organism: "Org E" }, "CIP", 3)[0]!.share).toEqual({ works: 1, n: 1 });
    expect(monthly(rs, asOf, { ward: EVERY_UNIT, specimen: "urine" }, "CIP", 1)).toEqual([
      { month: "2026-03-01", share: { works: 1, n: 2 } },
    ]);
  });
});

// ---------- Untested antibiotics: expected resistance (EUCAST) vs simply not tested ----------

// Real organism names here, because expected resistance is looked up by name (eucast.ts).
const ECOLI = "Escherichia coli";
const PSA = "Pseudomonas aeruginosa";
const EFAE = "Enterococcus faecalis";
const SAUR = "Staphylococcus aureus";
const panel: Catalog = {
  units: catalog.units,
  antibiotics: [
    ab("AMP", "ampicillin", "penicillins"),
    ab("CRO", "ceftriaxone", "cephalosporins 3rd gen"),
    ab("CAZ", "ceftazidime", "cephalosporins 3rd gen"),
    ab("MEM", "meropenem", "carbapenems"),
    ab("VAN", "vancomycin", "glycopeptides"),
    ab("FOX", "cefoxitin (screen)", "MRSA screen"),
  ],
};

describe("coverage: untested antibiotics (organism not known)", () => {
  // The lab reports CAZ only for Pseudomonas, VAN only for gram-positives, and
  // leaves out pairs EUCAST lists as expected resistant.
  const mixed = [
    ...[1, 2, 3, 4].map(() => iso({ organism: ECOLI, res: { AMP: "S", CRO: "S", MEM: "S" } })),
    ...[1, 2].map(() => iso({ organism: PSA, res: { CAZ: "S", MEM: "S" } })),
    ...[1, 2].map(() => iso({ organism: EFAE, res: { AMP: "S", VAN: "S" } })),
  ];
  const q = { ward: "W1", specimen: "urine" };
  const run = (rs: Result[], o: Partial<typeof DEFAULT_COVERAGE> = {}) =>
    coverage(rs, asOf, q, panel, { minIsolates: 1, rank: "coverage", ...o });

  it("counts a missing result as doesn't work only when the pair is expected resistant", () => {
    const r = run(mixed);
    expect(r.basis).toMatchObject({ n: 8, window: "recent" });
    // Pseudomonas: expected resistant to ampicillin.
    expect(drug(r.drugs, "AMP").main).toEqual({ works: 6, n: 8 });
    // Pseudomonas (cefotaxime/ceftriaxone) and enterococci (cephalosporins): expected resistant.
    expect(drug(r.drugs, "CRO").main).toEqual({ works: 4, n: 8 });
    // E. coli + vancomycin and Pseudomonas + vancomycin: expected resistant (glycopeptides).
    expect(drug(r.drugs, "VAN").main).toEqual({ works: 2, n: 8 });
  });

  it("leaves an untested isolate out of n when the pair is not expected resistant", () => {
    const r = run(mixed);
    // E. coli was never tested for ceftazidime: unknown, not "doesn't work". E. faecalis: expected resistant.
    expect(drug(r.drugs, "CAZ").main).toEqual({ works: 2, n: 4 });
    // E. faecalis was never tested for meropenem: unknown.
    expect(drug(r.drugs, "MEM").main).toEqual({ works: 6, n: 6 });
    expect(drug(r.drugs, "MEM").hospitalYear).toEqual({ works: 6, n: 6 });
    expect(codes(r.drugs)).not.toContain("FOX");
  });

  it("shows an antibiotic only when its known part is at least half of the first isolates", () => {
    expect(DEFAULT_COVERAGE.minKnownShare).toBe(MIN_KNOWN_SHARE);
    expect(MIN_KNOWN_SHARE).toBe(0.5);
    // CAZ known for 4 of 8: exactly half, shown (above). One more E. coli: 4 of 9, hidden.
    const more = [...mixed, iso({ organism: ECOLI, res: { AMP: "S", CRO: "S", MEM: "S" } })];
    expect(codes(run(more).drugs)).not.toContain("CAZ");
    expect(codes(run(more).drugs).sort()).toEqual(["AMP", "CRO", "MEM", "VAN"]);
    // The threshold is an option.
    expect(drug(run(more, { minKnownShare: 0 }).drugs, "CAZ").main).toEqual({ works: 2, n: 4 });
    expect(codes(run(mixed, { minKnownShare: 0.75 }).drugs).sort()).toEqual(["AMP", "CRO", "MEM", "VAN"]);
  });

  it("judges the half rule in the window the screen leads with", () => {
    // Four weeks: only E. coli (CAZ unknown for all). The year adds Pseudomonas tested for CAZ.
    const rs = [
      ...[1, 2, 3].map((d) => iso({ organism: ECOLI, sampleDate: ago(d), res: { AMP: "S", MEM: "S" } })),
      ...[100, 101, 102].map((d) => iso({ organism: PSA, sampleDate: ago(d), res: { CAZ: "S", MEM: "S" } })),
    ];
    const r = run(rs, { minIsolates: 3 });
    expect(r.basis.window).toBe("recent");
    expect(codes(r.drugs)).not.toContain("CAZ");
  });

  it("keeps the organism-known rule: n is that organism's isolates with a result", () => {
    const r = coverage(mixed, asOf, { ...q, organism: ECOLI }, panel, { minIsolates: 1 });
    expect(codes(r.drugs).sort()).toEqual(["AMP", "CRO", "MEM"]); // CAZ and VAN never reported for E. coli
    expect(drug(r.drugs, "MEM").main).toEqual({ works: 4, n: 4 });
  });

  it("leads with the year when the four weeks leave a shown antibiotic under the floor", () => {
    const rs = [
      ...[1, 2].map((d) => iso({ organism: ECOLI, sampleDate: ago(d), res: { MEM: "S" } })),
      ...[1, 2].map((d) => iso({ organism: SAUR, sampleDate: ago(d), res: { VAN: "S" } })),
      ...[100, 101].map((d) => iso({ organism: ECOLI, sampleDate: ago(d), res: { MEM: "R" } })),
    ];
    const r = coverage(rs, asOf, q, panel, { minIsolates: 3 });
    // Four weeks: 4 first isolates, but meropenem is known for only 2 (S. aureus untested).
    expect(r.basis).toMatchObject({ window: "year", recentN: 4, yearN: 6, n: 6, widened: [] });
    expect(drug(r.drugs, "MEM").main).toEqual({ works: 2, n: 4 });
    expect(drug(r.drugs, "VAN").main).toEqual({ works: 2, n: 6 }); // E. coli: expected resistant
  });

  it("widens until every shown antibiotic rests on enough known answers", () => {
    const rs = [
      ...[1, 2].map(() => iso({ ward: "W1", organism: ECOLI, sampleDate: ago(50), res: { MEM: "S" } })),
      ...[1, 2].map(() => iso({ ward: "W1", organism: SAUR, sampleDate: ago(50), res: { VAN: "S" } })),
      ...[1, 2].map(() => iso({ ward: "W2", organism: ECOLI, sampleDate: ago(50), res: { MEM: "S" } })),
    ];
    const r = coverage(rs, asOf, q, panel, { minIsolates: 3 });
    // W1 alone has 4 first isolates but meropenem known for only 2.
    expect(r.basis).toMatchObject({ widened: ["ward"], yearN: 6, window: "year" });
    expect(drug(r.drugs, "MEM").main).toEqual({ works: 4, n: 4 });
  });
});

describe("monthly: untested antibiotics", () => {
  const rs = [
    iso({ organism: ECOLI, sampleDate: "2026-03-02", res: { MEM: "S" } }),
    iso({ organism: ECOLI, sampleDate: "2026-03-03", res: { MEM: "S" } }),
    iso({ organism: EFAE, sampleDate: "2026-03-04", res: { VAN: "S" } }),
  ];
  const q = { ward: "W1", specimen: "urine" };

  it("counts expected resistance when given the catalog", () => {
    expect(monthly(rs, asOf, q, "VAN", 1, panel)).toEqual([{ month: "2026-03-01", share: { works: 1, n: 3 } }]);
  });

  it("gives no figure for a month whose known part is under half", () => {
    // Without the catalog the E. coli isolates are unknown for vancomycin: 1 of 3 known.
    expect(monthly(rs, asOf, q, "VAN", 1)).toEqual([{ month: "2026-03-01", share: { works: 0, n: 0 } }]);
    expect(monthly(rs, asOf, q, "VAN", 1, undefined, 0)).toEqual([{ month: "2026-03-01", share: { works: 1, n: 1 } }]);
    expect(monthly(rs, asOf, q, "MEM", 1, panel)).toEqual([{ month: "2026-03-01", share: { works: 2, n: 2 } }]);
  });
});

describe("coverage: what a figure leaves out, and the engine's own verdict", () => {
  const q = { ward: "W1", specimen: "urine" };

  it("names the organisms a figure has no answer for, most first (rests on X of Y)", () => {
    const rs = [
      ...[1, 2, 3, 4].map(() => iso({ organism: ECOLI, res: { MEM: "S" } })),
      ...[1, 2].map(() => iso({ organism: SAUR, res: { VAN: "S" } })),
      iso({ organism: EFAE, res: { VAN: "S" } }),
    ];
    const r = coverage(rs, asOf, q, panel, { minIsolates: 1, rank: "coverage" });
    const mem = drug(r.drugs, "MEM");
    expect(mem.isolates).toBe(7);
    expect(mem.main.n).toBe(4);
    expect(mem.untested).toEqual([
      { organism: SAUR, n: 2 },
      { organism: EFAE, n: 1 },
    ]);
  });

  it("says 'not enough' whenever the engine's own test fails, not only on the isolate count", () => {
    // Six first isolates (>= 4), but meropenem, shown (known for half), rests on only 3 answers.
    const rs = [
      ...[1, 2, 3].map(() => iso({ organism: ECOLI, sampleDate: ago(50), res: { MEM: "S" } })),
      ...[1, 2, 3].map(() => iso({ organism: SAUR, sampleDate: ago(50), res: { VAN: "S" } })),
    ];
    const r = coverage(rs, asOf, { ...q, ward: EVERY_UNIT }, panel, { minIsolates: 4 });
    expect(r.basis.n).toBe(6);
    expect(r.basis.enough).toBe(false);
  });

  it("applies the half-tested rule to the every-unit figure too", () => {
    const rs = [
      // W1: meropenem known for all.
      ...[1, 2, 3].map(() => iso({ ward: "W1", organism: ECOLI, res: { MEM: "S" } })),
      // W2: many isolates without a meropenem answer, so every unit together is under half known.
      ...[1, 2, 3, 4, 5, 6, 7].map(() => iso({ ward: "W2", organism: SAUR, res: { VAN: "S" } })),
    ];
    const r = coverage(rs, asOf, q, panel, { minIsolates: 1, rank: "coverage" });
    expect(drug(r.drugs, "MEM").main).toEqual({ works: 3, n: 3 });
    expect(drug(r.drugs, "MEM").hospitalYear).toEqual({ works: 0, n: 0 });
  });

  it("can skip the every-unit figure, and counts one window once", () => {
    const rs = [1, 2, 3].map(() => iso({ organism: ECOLI, res: { MEM: "S" } }));
    const r = coverage(rs, asOf, q, panel, { minIsolates: 0, recentDays: 365, yearDays: 365, withHospital: false });
    expect(drug(r.drugs, "MEM").hospitalYear).toEqual({ works: 0, n: 0 });
    expect(r.basis).toMatchObject({ recentN: 3, yearN: 3 });
  });
});
