import { describe, expect, it } from "vitest";
import { GLOSS_TERMS, GLOSSARY, t } from "./index.ts";
import { glossaryEn, glossaryFi } from "./surfaces/glossary.ts";

describe("glossary", () => {
  it("has a non-empty long form and meaning in both locales for every term", () => {
    for (const locale of ["en", "fi"] as const) {
      for (const term of GLOSS_TERMS) {
        const entry = GLOSSARY[locale][term];
        expect(entry, `${locale} ${term}`).toBeDefined();
        expect(entry.long.trim(), `${locale} ${term} long`).not.toBe("");
        expect(entry.meaning.trim(), `${locale} ${term} meaning`).not.toBe("");
      }
    }
  });

  it("has no entries beyond the term list", () => {
    for (const locale of ["en", "fi"] as const) {
      expect(Object.keys(GLOSSARY[locale]).sort()).toEqual([...GLOSS_TERMS].sort());
    }
  });

  it("names the UI strings in both locales", () => {
    expect(t("en", "glossTitle")).toBe("Glossary");
    expect(t("fi", "glossTitle")).toBe("Sanasto");
    expect(t("en", "glossFirstUse", { short: "ESBL", long: GLOSSARY.en.ESBL.long })).toBe("ESBL (extended-spectrum beta-lactamase)");
    expect(Object.keys(glossaryFi).sort()).toEqual(Object.keys(glossaryEn).sort());
    expect(glossaryFi.glossFirstUse).toBe(glossaryEn.glossFirstUse);
  });
});
