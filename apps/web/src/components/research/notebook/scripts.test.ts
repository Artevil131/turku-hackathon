import { execFileSync } from "node:child_process";
import type { IsolateRecord, Phenotype } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { codeFor } from "../tools/method.ts";
import { type CellResult, computeBeta, computeCompare, computeRate, computeShares, type Slice } from "../tools/model.ts";

// "Copy as Python" is a script that shows the working with the standard library. Run it with the real Python and
// it prints the numbers the cell shows (to the digits it prints). Skipped where no python3 is installed.

const hasPython = (() => {
  try {
    execFileSync("python3", ["-I", "-c", "pass"]);
    return true;
  } catch {
    return false;
  }
})();
const run = (r: CellResult) => execFileSync("python3", ["-I", "-c", codeFor(r, "python")], { encoding: "utf8" });

let seq = 0;
const rec = (date: string, esbl: boolean): IsolateRecord => ({
  isolateId: `i${++seq}`,
  cultureId: `c${seq}`,
  patientId: `p${seq}`,
  sampleDate: date,
  admissionDate: null,
  ward: "ICU",
  specimen: "urine",
  organism: "Escherichia coli",
  sex: "F",
  ageYears: 60,
  homeArea: "x",
  phenotypes: esbl ? (["esbl"] as Phenotype[]) : [],
  results: {},
});
const day = (m: string, i: number) => `2026-${m}-${String(1 + (i % 28)).padStart(2, "0")}`;
const A: Slice = { from: "2026-09-01", to: "2026-09-28", unit: "ICU", organism: "", specimen: "", phenotype: "esbl", firstOnly: false };
const B = { from: "2026-08-01", to: "2026-08-28", unit: "ICU" };
const rowsA = Array.from({ length: 900 }, (_, i) => rec(day("09", i), i % 7 === 0));
const rowsB = Array.from({ length: 300 }, (_, i) => rec(day("08", i), i % 11 === 0));
const ev = { type: "phenotype", code: "esbl" } as const;
const f = (v: number, d: number) => v.toFixed(d);

describe.skipIf(!hasPython)("Copy as Python runs and gives the cell's numbers", () => {
  it("rate: the exact Poisson interval per week and the Wilson share", () => {
    const r = computeRate(rowsA, A);
    const out = run(r);
    expect(out).toContain(`per week ${f(r.perWeek, 2)}, 95 % ${f(r.perWeekInterval.lo, 2)} to ${f(r.perWeekInterval.hi, 2)}`);
    expect(out).toContain(
      `share ${f(r.share?.share ?? 0, 3)}, 95 % ${f(r.share?.interval.lo ?? 0, 3)} to ${f(r.share?.interval.hi ?? 0, 3)}`,
    );
  });
  it("rate without a phenotype has no share line", () => {
    const out = run(computeRate(rowsA, { ...A, phenotype: "" }));
    expect(out).toContain("per week 225.00");
    expect(out).not.toContain("share");
  });
  it("compare: Newcombe's difference and the exact rate ratio", () => {
    const r = computeCompare(rowsA, rowsB, A, B, ev);
    const d = r.difference as NonNullable<typeof r.difference>;
    const rr = r.ratio as NonNullable<typeof r.ratio>;
    const out = run(r);
    const sign = (v: number) => (v >= 0 ? `+${f(v, 3)}` : f(v, 3));
    expect(out).toContain(`A - B ${sign(d.diff)}, 95 % ${sign(d.interval.lo)} to ${sign(d.interval.hi)}`);
    const ratio = /A \/ B ([\d.e+-]+), 95 % ([\d.e+-]+) to ([\d.e+-]+), p ([\d.e+-]+)/.exec(out);
    expect(Number(ratio?.[1])).toBeCloseTo(rr.ratio, 2);
    expect(Number(ratio?.[2])).toBeCloseTo(rr.interval.lo, 1);
    expect(Number(ratio?.[3])).toBeCloseTo(rr.interval.hi, 1);
    expect(Number(ratio?.[4]) / rr.p).toBeCloseTo(1, 2);
  });
  it("shares: one Wilson interval per period", () => {
    const r = computeShares(rowsA, A, ev, 7);
    const out = run(r);
    for (const p of r.points) expect(out).toContain(`${p.from}  ${p.k}/${p.n}  ${f(p.share ?? 0, 3)}  95 % ${f(p.interval?.lo ?? 0, 3)}`);
  });
  it("beta: flat and discounted posteriors", () => {
    const flat = computeBeta(rowsA, null, A, ev, null);
    expect(run(flat)).toContain(
      `mean ${f(flat.posterior.mean, 3)}, 95 % ${f(flat.posterior.interval.lo, 3)} to ${f(flat.posterior.interval.hi, 3)}`,
    );
    const disc = computeBeta(rowsA, rowsB, A, ev, { delta: 0.95, m: 30 });
    const p = disc.discounted?.posterior as NonNullable<typeof disc.discounted>["posterior"];
    expect(run(disc)).toContain(`mean ${f(p.mean, 3)}, 95 % ${f(p.interval.lo, 3)} to ${f(p.interval.hi, 3)}`);
  });
});
