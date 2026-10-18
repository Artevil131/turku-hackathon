import type { Alert, CoverageResponse } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { coverage, suggest } from "../../../../../libs/utils/coverage/src/index.ts";
import { coverageLine, pickSignal, queryFromHref, signalLine } from "./AnswerPreview.tsx";

const det = (over: Record<string, unknown>): Alert =>
  ({
    kind: "detector",
    detector: "phenotype-excess",
    ward: "MED-A",
    phenotype: "esbl",
    observed: 7,
    expected: 1.4,
    ...over,
  }) as unknown as Alert;

describe("queryFromHref", () => {
  it("translates a doctor link into the coverage query the doctor's page asks for", () => {
    expect(queryFromHref("#doctor?unit=URO&site=urine")).toEqual({ ward: "URO", specimen: "urine", severity: "mild", windowDays: 365 });
    expect(queryFromHref("#doctor?unit=ICU&site=blood&sev=severe&ab=MEM")).toMatchObject({
      ward: "ICU",
      specimen: "blood",
      severity: "severe",
    });
  });
  it("is null for anything but a doctor link", () => {
    expect(queryFromHref("#research?unit=MED-A&ph=esbl")).toBeNull();
  });
});

describe("pickSignal", () => {
  const alerts = [
    det({ id: "a", date: "2025-04-02" }),
    det({ id: "b", date: "2025-04-30" }),
    det({ id: "c", date: "2025-05-05", ward: "URO" }),
    det({ id: "d", date: "2025-05-06", phenotype: "mrsa" }),
  ];
  it("takes the newest alert of the unit and phenotype", () => {
    expect(pickSignal(alerts, "#research?unit=MED-A&ph=esbl")?.id).toBe("b");
  });
  it("matches the unit alone or the phenotype alone", () => {
    expect(pickSignal(alerts, "#research?unit=MED-A")?.id).toBe("d");
    expect(pickSignal(alerts, "#research?ph=esbl")?.id).toBe("c");
  });
  it("is null when nothing matches", () => {
    expect(pickSignal(alerts, "#research?unit=ICU&ph=esbl")).toBeNull();
    expect(signalLine("en", [], "#research?unit=ICU&ph=esbl")).toBe("No open signal");
  });
});

describe("coverageLine", () => {
  const records = Array.from(
    { length: 60 },
    (_, i): IsolateRecord => ({
      isolateId: `C${i}-1`,
      cultureId: `C${i}`,
      patientId: `P${i}`,
      sampleDate: "2026-06-01",
      admissionDate: null,
      ward: "URO",
      specimen: "urine",
      organism: "Escherichia coli",
      sex: "F",
      ageYears: 60,
      homeArea: "North",
      phenotypes: [],
      results: { MEC: "S", TMP: i < 40 ? "S" : "R" },
    }),
  );
  const result = coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "urine" });
  const data: CoverageResponse = {
    asOf: "2026-06-30",
    severity: "mild",
    coverage: result,
    suggestions: suggest(result, "mild"),
    combinationSuggestions: [],
  };
  it("words the first clearing drug as the answer card does, with its interval and n, never as an order", () => {
    const line = coverageLine("en", data, "#doctor?unit=URO&site=urine");
    expect(line).toMatch(/^Highest coverage clearing the 80 % bar: mecillinam · 100\u00a0% \(95\u00a0% CI \d+–100, n\u00a060\)/);
    expect(line).not.toContain("Start with");
    expect(coverageLine("fi", data, "#doctor?unit=URO&site=urine")).toMatch(/^Suurin kattavuus 80 %:n rajan ylittävistä: /);
  });
  it("gives the named drug's own row with its interval", () => {
    expect(coverageLine("en", data, "#doctor?unit=URO&site=urine&ab=TMP")).toMatch(
      /^trimethoprim · 67\u00a0% \(95\u00a0% CI \d+–\d+, n\u00a060\) · below the 80 % bar/,
    );
  });
});
