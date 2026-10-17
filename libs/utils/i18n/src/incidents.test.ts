import { describe, expect, it } from "vitest";
import { alertEvidence, incidentPriority, incidentResponsibility, t } from "./index.ts";

const surge = { kind: "detector", detector: "phenotype-excess", ward: "URO", date: "2025-06-07", observed: 2, expected: 0.3 } as const;
const cluster = { ...surge, detector: "profile-excess" } as const;

describe("incident presentation", () => {
  it("uses the highest rule severity, not the latest alert's severity", () => {
    expect(incidentPriority([surge, cluster])).toBe("high");
    expect(incidentPriority([surge])).toBe("medium");
    expect(incidentPriority([{ ...surge, severity: "high" }])).toBe("high");
    expect(incidentPriority([{ ...surge, kind: "cpe", ward: "URO" }])).toBe("high");
    expect(incidentPriority([{ ...surge, kind: "new-in-unit", ward: "PHC-N" }])).toBe("medium");
  });
  it.each(["fi", "en"] as const)("names the responsible party in %s without prescribing procedures", (locale) => {
    expect(incidentResponsibility(locale, [surge])).toBe(t(locale, "feedNotifyMedium"));
    expect(incidentResponsibility(locale, [surge, cluster])).toContain(locale === "fi" ? "vastuulääkäri" : "responsible doctor");
    expect(incidentResponsibility(locale, [{ ...surge, detector: "empty-run" }])).toBe(t(locale, "feedNotifyData"));
    expect(incidentResponsibility(locale, [{ ...cluster, ward: null }])).toBe(t(locale, "feedNotifyHospital"));
  });
  it("keeps patients, cultures, run days, and shares distinct", () => {
    expect(alertEvidence("en", surge)).toBe("2 patients observed · expected 0.3 · 28 days to 7.6.2025");
    expect(alertEvidence("fi", surge)).toContain("odotettu 0,3");
    expect(alertEvidence("en", { ...surge, expected: undefined })).toContain("expected not supplied");
    expect(alertEvidence("en", { ...surge, detector: "sampling-drop" })).toContain("2 cultures · expected 0.3 · 7 days");
    expect(alertEvidence("en", { ...surge, detector: "empty-run" })).toContain("2 days without cultures");
    expect(alertEvidence("en", { ...surge, detector: "rising-trend", observed: 0.2, expected: 0.1 })).toContain("20 % · baseline 10 %");
    expect(alertEvidence("en", { ...surge, kind: "cpe" })).toContain("1 patient");
  });
  it.each(["fi", "en"] as const)("distinguishes an incident from its alert count in %s", (locale) => {
    expect(t(locale, "feedIncidentOne")).toContain(locale === "fi" ? "1 siihen liittyvä hälytys" : "1 related alert");
    expect(t(locale, "feedIncidentMany", { n: 2 })).toContain(locale === "fi" ? "2 siihen liittyvää hälytystä" : "2 related alerts");
  });
});
