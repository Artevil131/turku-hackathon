import type { Alert } from "@aei/alerts";
import { describe, expect, it } from "vitest";
import { alertExplainInput, checkSlots, fillSlots } from "./index.ts";

const names = {
  ward: (code: string) => `Ward ${code}`,
  organism: (name: string) => name,
  specimen: (code: string) => `Specimen ${code}`,
  phenotype: (code: string) => code.toUpperCase(),
};
const cpe: Alert = {
  kind: "cpe",
  id: "cpe:i",
  date: "2025-06-01",
  ward: "ICU",
  patientId: "p1",
  isolateId: "i",
  organism: "Escherichia coli",
  specimen: "blood",
};
const carrier: Alert = {
  kind: "carrier",
  id: "carrier:c:esbl",
  date: "2025-06-01",
  ward: "ICU",
  patientId: "p1",
  cultureId: "c",
  phenotype: "esbl",
  from: "URO",
  foundOn: "2025-05-02",
  confirmed: false,
};

describe("alertExplainInput", () => {
  for (const lang of ["en", "fi"] as const) {
    for (const alert of [cpe, carrier]) {
      it(`${alert.kind} ${lang} fallback includes every fact as a slot`, () => {
        const input = alertExplainInput(alert, lang, names);
        expect(checkSlots(input.fallback, Object.keys(input.facts))).toBe(true);
        for (const key of Object.keys(input.facts)) expect(input.fallback).toContain(`{${key}}`);
        expect(fillSlots(input.fallback, input.facts, lang)).not.toMatch(/[{}]/);
      });
    }
  }
  it("computes elapsed calendar days and localises confirmation", () => {
    expect(alertExplainInput(carrier, "fi", names).facts).toMatchObject({
      daysSinceFound: 30,
      confirmed: "ei",
      fromWard: "Ward URO",
      phenotype: "ESBL",
    });
    expect(alertExplainInput({ ...carrier, confirmed: true }, "en", names).facts.confirmed).toBe("yes");
    expect(alertExplainInput({ ...carrier, confirmed: true }, "fi", names).facts.confirmed).toBe("kyllä");
    expect(alertExplainInput(carrier, "en", names).facts.confirmed).toBe("no");
  });
  it("supplies CPE identifiers and named specimen and organism", () => {
    expect(alertExplainInput(cpe, "en", names).facts).toEqual({
      date: "2025-06-01",
      ward: "Ward ICU",
      organism: "Escherichia coli",
      specimen: "Specimen blood",
      patientId: "p1",
    });
  });
});

describe("alertExplainInput for every kind", () => {
  const detector = (over: Record<string, unknown>) =>
    ({
      kind: "detector",
      id: "d",
      date: "2025-06-04",
      ward: "URO",
      detector: "profile-excess",
      observed: 9,
      expected: 2.34,
      p: 0.00001,
      organism: "Escherichia coli",
      ...over,
    }) as Alert;

  it("fills a detector template whose every slot has a fact", () => {
    const input = alertExplainInput(detector({}), "en", names);
    expect(input.facts).toMatchObject({ observed: 9, expected: 2.3, ward: "Ward URO" });
    expect(input.facts).not.toHaveProperty("p");
    const text = fillSlots(input.fallback, input.facts, "en");
    expect(text).toContain("9 patients in Ward URO");
    expect(text).not.toMatch(/[{}]/);
  });

  it("shows a hospital-wide trend as a percentage and never leaves a raw slot", () => {
    const input = alertExplainInput(
      detector({ detector: "rising-trend", ward: null, observed: 0.2, expected: undefined, antibiotic: "TMP" }),
      "fi",
      names,
    );
    expect(input.facts.observed).toBe("20 %");
    expect(input.facts.ward).toBe("koko sairaala");
    expect(fillSlots(input.fallback, input.facts, "fi")).not.toMatch(/[{}]/);
  });

  it("falls back to a generic template when a detector lacks a fact its wording needs", () => {
    const input = alertExplainInput(detector({ organism: undefined }), "en", names);
    expect(fillSlots(input.fallback, input.facts, "en")).not.toMatch(/[{}]/);
  });

  it("explains new-in-unit alerts with and without a previous isolate", () => {
    const base = {
      kind: "new-in-unit",
      id: "n",
      date: "2026-03-03",
      ward: "ICU",
      phenotype: "mrsa",
      organism: "Staphylococcus aureus",
      patientId: "p",
      isolateId: "i",
    };
    const withPrev = alertExplainInput({ ...base, previous: "2025-08-01" } as Alert, "en", names);
    expect(withPrev.facts.daysSincePrevious).toBe(214);
    const first = alertExplainInput({ ...base, previous: null } as Alert, "fi", names);
    expect(first.facts.previous).toBeUndefined();
    for (const input of [withPrev, first]) expect(fillSlots(input.fallback, input.facts, input.lang)).not.toMatch(/[{}]/);
  });

  it("gives an unknown future kind its scalar fields and a generic template", () => {
    const input = alertExplainInput(
      { kind: "future", id: "f", date: "2026-01-01", ward: "ICU", n: 3, nested: { x: 1 } } as unknown as Alert,
      "en",
      names,
    );
    expect(input.facts).toEqual({ date: "2026-01-01", ward: "ICU", n: 3 });
    expect(fillSlots(input.fallback, input.facts, "en")).not.toMatch(/[{}]/);
  });
});
