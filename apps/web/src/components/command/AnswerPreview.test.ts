import type { Alert } from "@aei/contract";
import { describe, expect, it } from "vitest";
import { pickSignal, queryFromHref, signalLine } from "./AnswerPreview.tsx";

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
