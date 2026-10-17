import { ANTIBIOTICS, ORGANISMS } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { effectiveResult, INTRINSIC, inferredResistantFrom, inferredResult, isIntrinsic, NO_BREAKPOINT, suitsSpecimen } from "./index.ts";

describe("rule tables", () => {
  it("name only the dataset's organisms and antibiotics, each pair once", () => {
    const codes = new Set(ANTIBIOTICS.map((a) => a.code));
    const seen = new Set<string>();
    for (const r of [...INTRINSIC, ...NO_BREAKPOINT]) {
      expect(ORGANISMS).toContain(r.organism);
      expect(codes.has(r.antibiotic)).toBe(true);
      const k = `${r.organism}|${r.antibiotic}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it("match the intrinsic pairs the dataset reports as always R", () => {
    // Measured in the dataset: 100 % R wherever tested.
    expect(isIntrinsic("Klebsiella pneumoniae", "AMP")).toBe(true);
    expect(isIntrinsic("Klebsiella oxytoca", "AMP")).toBe(true);
    expect(isIntrinsic("Citrobacter freundii", "AMP")).toBe(true);
    expect(isIntrinsic("Proteus mirabilis", "NIT")).toBe(true);
    expect(isIntrinsic("Escherichia coli", "AMP")).toBe(false);
  });
});

describe("suitsSpecimen", () => {
  it("keeps urine-only agents to urine and screens out of treatment", () => {
    expect(suitsSpecimen("NIT", "urine")).toBe(true);
    expect(suitsSpecimen("NIT", "blood")).toBe(false);
    expect(suitsSpecimen("CRO", "wound")).toBe(true);
    expect(suitsSpecimen("FOX", "blood")).toBe(false);
  });
});

describe("effectiveResult", () => {
  it("prefers intrinsic resistance over a reported S", () => {
    expect(effectiveResult({ organism: "Proteus mirabilis", results: { NIT: "S" } }, "NIT")).toEqual({ result: "R", basis: "intrinsic" });
  });

  it("infers staphylococcal beta-lactams from the cefoxitin screen", () => {
    const mssa = { organism: "Staphylococcus aureus" as const, results: { FOX: "S" as const } };
    const mrsa = { organism: "Staphylococcus aureus" as const, results: { FOX: "R" as const } };
    expect(effectiveResult(mssa, "CRO")).toEqual({ result: "S", basis: "inferred" });
    expect(effectiveResult(mssa, "AMP")).toEqual({ result: null, basis: "untested" });
    expect(effectiveResult(mrsa, "MEM")).toEqual({ result: "R", basis: "inferred" });
    expect(effectiveResult(mrsa, "CAZ")).toEqual({ result: "R", basis: "inferred" });
  });

  it("infers piperacillin-tazobactam from ampicillin in E. faecalis", () => {
    expect(inferredResult({ organism: "Enterococcus faecalis", results: { AMP: "S" } }, "TZP")).toBe("S");
    expect(inferredResult({ organism: "Enterococcus faecalis", results: {} }, "TZP")).toBeUndefined();
  });

  it("separates no breakpoint from not tested", () => {
    expect(effectiveResult({ organism: "Pseudomonas aeruginosa", results: {} }, "MEC").basis).toBe("no-breakpoint");
    expect(effectiveResult({ organism: "Escherichia coli", results: {} }, "CAZ").basis).toBe("untested");
    expect(effectiveResult({ organism: "Escherichia coli", results: { CIP: "R" } }, "CIP")).toEqual({ result: "R", basis: "tested" });
  });
});

describe("inferredResistantFrom (D-050)", () => {
  it("gives the beta-lactams the cefoxitin screen decides for MRSA, and nothing for the other phenotypes", () => {
    expect([...inferredResistantFrom("mrsa")].sort()).toEqual(["AMP", "CAZ", "CRO", "CXM", "MEC", "MEM", "TZP"]);
    expect(inferredResistantFrom("mrsa")).not.toContain("FOX"); // tested, not inferred
    expect(inferredResistantFrom("esbl")).toEqual([]);
    expect(inferredResistantFrom("vre")).toEqual([]);
    expect(inferredResistantFrom("cpe")).toEqual([]);
  });
});
