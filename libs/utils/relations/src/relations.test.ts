import type { WardCode } from "@aei/domain";
import { describe, expect, it } from "vitest";
import {
  carrierArrivals,
  countFlows,
  type Find,
  nextUnits,
  patientFlows,
  patientMoves,
  phenotypeTrails,
  previousUnits,
  type Sample,
  trailLinks,
  undirectedFlows,
} from "./index.ts";

let seq = 0;
const sample = (patientId: string, sampleDate: string, ward: WardCode): Sample => ({
  cultureId: `C${String(++seq).padStart(7, "0")}`,
  patientId,
  sampleDate,
  ward,
});
const esbl = (s: Sample): Find => ({ cultureId: s.cultureId, organism: "Escherichia coli", phenotypes: ["esbl"] });

describe("patientFlows", () => {
  it("counts consecutive samples in different units, once per patient", () => {
    const samples = [
      sample("P1", "2026-01-01", "ED"),
      sample("P1", "2026-01-02", "ED"),
      sample("P1", "2026-01-03", "MED-A"),
      sample("P1", "2026-02-01", "ED"),
      sample("P1", "2026-02-05", "MED-A"),
      sample("P2", "2026-01-10", "ED"),
      sample("P2", "2026-01-11", "ICU"),
      // ED → ICU → MED-A: only consecutive pairs count, not ED → MED-A
      sample("P3", "2026-01-10", "ED"),
      sample("P3", "2026-01-12", "ICU"),
      sample("P3", "2026-01-15", "MED-A"),
    ];
    expect(patientFlows(samples)).toEqual([
      { from: "ED", to: "ICU", patients: 2 },
      { from: "ED", to: "MED-A", patients: 1 },
      { from: "ICU", to: "MED-A", patients: 1 },
      { from: "MED-A", to: "ED", patients: 1 },
    ]);
  });

  it("orders samples by date, not input order", () => {
    const later = sample("P1", "2026-01-05", "URO");
    const earlier = sample("P1", "2026-01-01", "ED");
    expect(patientFlows([later, earlier])).toEqual([{ from: "ED", to: "URO", patients: 1 }]);
  });

  it("dates a move by its later sample", () => {
    const samples = [
      sample("P1", "2025-12-20", "ED"),
      sample("P1", "2026-01-03", "SURG"),
      sample("P2", "2026-02-01", "ED"),
      sample("P2", "2026-02-02", "GER"),
    ];
    expect(patientFlows(samples, { from: "2026-01-01", to: "2026-01-31" })).toEqual([{ from: "ED", to: "SURG", patients: 1 }]);
  });

  it("cuts moves computed once to any window", () => {
    const samples = [sample("P1", "2026-01-01", "ED"), sample("P1", "2026-01-03", "ICU"), sample("P1", "2026-02-03", "GER")];
    const moves = patientMoves(samples);
    expect(moves.map((m) => [m.from, m.to, m.date])).toEqual([
      ["ED", "ICU", "2026-01-03"],
      ["ICU", "GER", "2026-02-03"],
    ]);
    const window = { from: "2026-02-01", to: "2026-02-28" };
    expect(countFlows(moves, window)).toEqual(patientFlows(samples, window));
  });

  it("feeds the ward helpers", () => {
    const flows = [
      { from: "ED", to: "MED-A", patients: 3 },
      { from: "ED", to: "ICU", patients: 1 },
      { from: "MED-A", to: "ED", patients: 2 },
    ] as const;
    expect(nextUnits(flows, "ED")).toEqual([
      { ward: "MED-A", patients: 3, share: 0.75 },
      { ward: "ICU", patients: 1, share: 0.25 },
    ]);
    expect(previousUnits(flows, "ED")).toEqual([{ ward: "MED-A", patients: 2 }]);
    expect(undirectedFlows(flows)).toEqual([
      { a: "ED", b: "MED-A", patients: 5 },
      { a: "ED", b: "ICU", patients: 1 },
    ]);
  });
});

describe("phenotypeTrails", () => {
  it("follows a carrier into other units within the carrier period", () => {
    const found = sample("P1", "2026-01-01", "ICU");
    const samples = [
      found,
      sample("P1", "2026-01-05", "ICU"), // same unit: not a move
      sample("P1", "2026-01-20", "MED-A"), // carried, not seen again
      sample("P1", "2026-06-01", "GER"), // over 90 days after the find
    ];
    const trails = phenotypeTrails(samples, [esbl(found)]);
    expect(trails).toHaveLength(1);
    expect(trails[0]?.steps.map((s) => [s.ward, s.carriedFrom, s.organisms.length])).toEqual([
      ["ICU", null, 1],
      ["MED-A", "ICU", 0],
    ]);
    expect(trailLinks(trails)).toEqual([{ from: "ICU", to: "MED-A", phenotype: "esbl", patients: 1, confirmed: 0 }]);
  });

  it("restarts the carrier period at a new find and counts confirmations", () => {
    const a = sample("P1", "2026-01-01", "ED");
    const b = sample("P1", "2026-02-15", "URO");
    const c = sample("P1", "2026-05-01", "SURG"); // 75 days after the URO find, 120 after ED
    const trails = phenotypeTrails([a, b, c], [esbl(a), esbl(b)]);
    expect(trailLinks(trails)).toEqual([
      { from: "ED", to: "URO", phenotype: "esbl", patients: 1, confirmed: 1 },
      { from: "URO", to: "SURG", phenotype: "esbl", patients: 1, confirmed: 0 },
    ]);
    expect(carrierArrivals(trails)).toEqual([
      {
        patientId: "P1",
        phenotype: "esbl",
        cultureId: c.cultureId,
        date: "2026-05-01",
        ward: "SURG",
        from: "URO",
        foundOn: "2026-02-15",
        confirmed: false,
      },
      {
        patientId: "P1",
        phenotype: "esbl",
        cultureId: b.cultureId,
        date: "2026-02-15",
        ward: "URO",
        from: "ED",
        foundOn: "2026-01-01",
        confirmed: true,
      },
    ]);
    expect(carrierArrivals(trails, { from: "2026-04-01", to: "2026-04-30" })).toEqual([]);
  });

  it("keeps origins from before the window and drops trails outside it", () => {
    const old = sample("P1", "2025-12-01", "ICU");
    const moved = sample("P1", "2026-01-10", "GER");
    const elsewhere = sample("P2", "2025-06-01", "ED");
    const samples = [old, moved, elsewhere, sample("P2", "2025-06-03", "MED-B")];
    const window = { from: "2026-01-01", to: "2026-01-31" };
    const trails = phenotypeTrails(samples, [esbl(old), esbl(elsewhere)], { window });
    expect(trails.map((t) => t.patientId)).toEqual(["P1"]);
    expect(trailLinks(trails, window)).toEqual([{ from: "ICU", to: "GER", phenotype: "esbl", patients: 1, confirmed: 0 }]);
  });

  it("filters by phenotype", () => {
    const s = sample("P1", "2026-01-01", "ICU");
    const finds: Find[] = [{ cultureId: s.cultureId, organism: "Staphylococcus aureus", phenotypes: ["mrsa"] }];
    expect(phenotypeTrails([s], finds, { phenotype: "esbl" })).toEqual([]);
    expect(phenotypeTrails([s], finds, { phenotype: "mrsa" })).toHaveLength(1);
  });
});
