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
