import { isAntibioticCode, PHENOTYPES } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { carrierRule, firstChoiceCodes, guide, type Syndrome, syndromeDefaults, syndromesFor } from "./index.ts";

const byId = (id: string): Syndrome => {
  const s = guide().syndromes.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};
const ids = (list: Syndrome[]) => list.map((s) => s.id);

describe("guide", () => {
  it("returns Varha's guide by default", () => {
    const g = guide();
    expect(g.site).toBe("varha");
    expect(g.date).toBe("2026-04-13");
    expect(g.url).toMatch(/^https:\/\/hoito-ohjeet\.fi\//);
    expect(g.syndromes).toHaveLength(10);
  });

  it("throws for a site without a guide", () => {
    expect(() => guide("nowhere")).toThrow();
  });

  it("has unique syndrome ids", () => {
    const all = ids(guide().syndromes);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("data integrity", () => {
  const choices = guide().syndromes.flatMap((s) => [
    ...s.firstChoices,
    ...(s.allergyAlternative ?? []),
    ...Object.values(s.carrierRules).flatMap((r) => r?.choices ?? []),
  ]);

  it("uses only the dataset's antibiotic codes", () => {
    for (const c of choices) if (c.drug !== null) expect(isAntibioticCode(c.drug), c.drug).toBe(true);
  });

  it("gives every choice Finnish and English text", () => {
    for (const c of choices) {
      expect(c.text.fi.length).toBeGreaterThan(0);
      expect(c.text.en.length).toBeGreaterThan(0);
    }
  });

  it("gives every syndrome a source section and page, and at least one first choice", () => {
    for (const s of guide().syndromes) {
      expect(s.source.section.length, s.id).toBeGreaterThan(0);
      expect(Number.isInteger(s.source.page) && s.source.page > 0 && s.source.page <= 69, s.id).toBe(true);
      expect(s.firstChoices.length, s.id).toBeGreaterThan(0);
    }
  });

  it("keys carrier rules by known phenotypes only", () => {
    for (const s of guide().syndromes) for (const p of Object.keys(s.carrierRules)) expect(PHENOTYPES).toContain(p);
  });
});

describe("syndromesFor", () => {
  it("lists a specimen's syndromes, most specific first", () => {
    expect(ids(syndromesFor("urine"))).toEqual(["cystitis-woman", "cystitis-man", "pyelonephritis-man", "pyelonephritis"]);
  });

  it("filters by severity and sex; syndromes without a sex match either", () => {
    expect(ids(syndromesFor("urine", "mild", undefined, "F"))).toEqual(["cystitis-woman"]);
    expect(ids(syndromesFor("urine", "severe", "community", "M"))).toEqual(["pyelonephritis-man", "pyelonephritis"]);
    expect(ids(syndromesFor("urine", "severe", "community", "F"))).toEqual(["pyelonephritis"]);
  });

  it("filters by onset; onset any matches every query", () => {
    expect(ids(syndromesFor("blood", "severe", "hospital"))).toEqual(["sepsis-healthcare"]);
    expect(ids(syndromesFor("blood", "severe", "community"))).toEqual(["urinary-sepsis", "sepsis-unknown-focus"]);
    expect(ids(syndromesFor("wound", "severe", "hospital"))).toEqual(["wound-severe", "wound-moderate"]);
    expect(ids(syndromesFor("wound", "severe", "community"))).toEqual(["wound-moderate"]);
    expect(ids(syndromesFor("blood", "severe", "any"))).toHaveLength(3);
  });

  it("returns nothing when no syndrome matches", () => {
    expect(syndromesFor("urine", "severe", "hospital")).toEqual([]);
  });
});

describe("firstChoiceCodes", () => {
  it("keeps only drugs in the dataset, in the guide's order", () => {
    expect(firstChoiceCodes(byId("cystitis-woman"))).toEqual(["TMP", "NIT", "MEC"]);
    expect(firstChoiceCodes(byId("cystitis-man"))).toEqual(["TMP", "NIT"]);
    expect(firstChoiceCodes(byId("sepsis-healthcare"))).toEqual(["TZP", "MEM"]);
    expect(firstChoiceCodes(byId("wound-moderate"))).toEqual(["CXM"]);
  });

  it("is empty when the guide's drugs are all outside the dataset", () => {
    expect(firstChoiceCodes(byId("wound-mild"))).toEqual([]);
  });
});

describe("carrierRule", () => {
  it("returns the guide's rule per phenotype", () => {
    const sepsis = byId("sepsis-unknown-focus");
    expect(carrierRule(sepsis, "esbl")?.action).toBe("replace");
    expect(carrierRule(sepsis, "esbl")?.choices.map((c) => c.drug)).toEqual([null, "MEM"]);
    expect(carrierRule(sepsis, "mrsa")?.action).toBe("add");
    expect(carrierRule(sepsis, "mrsa")?.choices.map((c) => c.drug)).toEqual(["VAN"]);
    expect(carrierRule(sepsis, "cpe")?.action).toBe("consult");
    expect(carrierRule(sepsis, "vre")?.action).toBe("consult");
    expect(carrierRule(byId("pyelonephritis"), "esbl")?.choices[0]?.text.fi).toMatch(/ertapeneemi/);
  });

  it("is undefined when the guide gives no rule", () => {
    expect(carrierRule(byId("sepsis-healthcare"), "esbl")).toBeUndefined();
    expect(carrierRule(byId("cystitis-woman"), "mrsa")).toBeUndefined();
  });
});

describe("syndromeDefaults", () => {
  it("returns what the record strip sets", () => {
    expect(syndromeDefaults(byId("cystitis-woman"))).toEqual({ specimen: "urine", severity: "mild", onset: "community", sex: "F" });
    expect(syndromeDefaults(byId("wound-mild"))).toEqual({ specimen: "wound", severity: "mild", onset: "any", sex: null });
  });
});
